#!/usr/bin/env bun
/**
 * kiira-retry-proxy.mjs — proxy chống chập chờn cho Kiira AI (chạy trên VPS).
 *
 * Vấn đề: Kiira đôi lúc trả 5xx/429 hoặc rớt kết nối thoáng qua → OpenCode báo
 * "AI service stream failed: The AI model service is temporarily unavailable",
 * phiên làm việc bị ngắt giữa chừng. OpenCode không có tùy chọn retry tích hợp.
 *
 * Giải pháp: proxy HTTP nhỏ chạy tại 127.0.0.1:8787, đứng giữa OpenCode và
 * gateway Kiira:
 *   - Lỗi TẠM THỜI (5xx, 429, mạng, timeout) → tự thử lại tối đa N lần với
 *     backoff tăng dần (1s → 2s → 4s…) trước khi chịu trả lỗi về client.
 *   - Lỗi CỨNG (401 sai key, 400 sai request…) → chuyển thẳng ngay, không
 *     thử lại vô ích.
 *   - Streaming (SSE) chảy xuyên suốt bình thường — proxy chỉ chuyển tiếp.
 *
 * AN TOÀN SECRET: proxy KHÔNG cần API key — Authorization header từ OpenCode
 * được chuyển tiếp nguyên vẹn, không đọc, không ghi log giá trị header. Chỉ
 * forward header an toàn (auth + content-type + accept); các header hop-by-hop
 * bị bỏ theo chuẩn proxy.
 *
 * Cách chạy trên VPS (bền khi đóng SSH — xem docs Phần 5):
 *   tmux new -d -s kiira 'bun /root/Autoreply-and-anti-nuke-raid/scripts/kiira-retry-proxy.mjs'
 *
 * Env tùy chọn: KIRA_PROXY_PORT (8787), KIRA_UPSTREAM (https://kiraai.vn/api/v1),
 * KIRA_PROXY_RETRIES (5), KIRA_PROXY_TIMEOUT_MS (120000),
 * KIRA_PROXY_MAX_BACKOFF_MS (30000).
 */

const PORT = Number(process.env.KIRA_PROXY_PORT ?? 8787);
const UPSTREAM = (process.env.KIRA_UPSTREAM ?? "https://kiraai.vn/api/v1").replace(/\/+$/, "");
const RETRIES = Math.max(0, Number(process.env.KIRA_PROXY_RETRIES ?? 5));
const TIMEOUT_MS = Number(process.env.KIRA_PROXY_TIMEOUT_MS ?? 120_000);
// Trần chờ giữa 2 lần thử: backoff lũy tiến nhưng không vượt trần, tránh một
// lần nghẽn dài khiến phiên treo hàng phút.
const MAX_BACKOFF_MS = Math.max(0, Number(process.env.KIRA_PROXY_MAX_BACKOFF_MS ?? 30_000));

// Header từ client được chuyển tiếp — chỉ những header an toàn/ cần thiết.
const PASS_HEADERS = ["authorization", "content-type", "accept", "user-agent"];
// Status coi là "Kiira chập chờn" — đáng để thử lại.
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504, 522, 524]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Backoff tăng dần + jitter ngẫu nhiên (±30%) — nhiều request cùng dính nghẽn
// sẽ không dồn vào Kiira đúng một nhịp nữa (tránh "thundering herd").
// Kẹp trần MAX_BACKOFF_MS để tổng thời gian chờ luôn có biên.
const backoffMs = (attempt) =>
  Math.min(MAX_BACKOFF_MS, Math.round(1000 * 2 ** attempt * (0.7 + Math.random() * 0.6))); // ~0.7–1.3s, ~1.4–2.6s, ~2.8–5.2s… kẹp trần

// Tôn trọng header Retry-After của upstream (giây hoặc HTTP-date) — Kiira báo
// nghẽn bao lâu thì chờ đúng, thay vì đoán theo backoff. Vẫn kẹp trần.
function retryAfterMs(res) {
  const raw = res.headers.get("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0)
    return Math.min(MAX_BACKOFF_MS, Math.round(seconds * 1000));
  const at = Date.parse(raw);
  if (!Number.isNaN(at)) return Math.min(MAX_BACKOFF_MS, Math.max(0, at - Date.now()));
  return null;
}

async function forward(req, pathAndQuery, body, signal) {
  const headers = {};
  for (const name of PASS_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers[name] = value;
  }
  return fetch(UPSTREAM + pathAndQuery, {
    method: req.method,
    headers,
    body,
    // Hủy khi client ngắt kết nối (OpenCode bỏ cuộc) HOẶC quá timeout mỗi lượt.
    signal,
  });
}

async function handle(req) {
  const url = new URL(req.url);

  if (url.pathname === "/__health") {
    return Response.json({ ok: true, upstream: UPSTREAM, retries: RETRIES });
  }

  // Mọi path khác chuyển thẳng (giữ nguyên query string) — ví dụ /chat/completions,
  // /models. Client trỏ baseURL vào proxy nên path giữ nguyên hình dạng.
  const upstreamPath = url.pathname + url.search;

  // Đọc body MỘT LẦN duy nhất thành ArrayBuffer. Request body là stream dùng
  // một lần: nếu đọc trong từng lượt thử, lần retry thứ 2 sẽ ném
  // "Body already used" → mọi POST (chính là /chat/completions của OpenCode)
  // hỏng ngay khi upstream chập. ArrayBuffer tái sử dụng được cho mọi lần fetch.
  let body;
  if (!["GET", "HEAD"].includes(req.method)) {
    body = await req.arrayBuffer();
  }

  // Hủy thử lại khi client bỏ cuộc (đóng tab / ngắt stream) để không đốt lượt
  // gọi Kiira vô ích; mỗi lượt vẫn có trần timeout riêng.
  const clientGone = new AbortController();
  req.signal?.addEventListener("abort", () => clientGone.abort(req.signal.reason), { once: true });

  let lastError = null;
  let lastStatus = null;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const signal = AbortSignal.any([clientGone.signal, AbortSignal.timeout(TIMEOUT_MS)]);
    try {
      const res = await forward(req, upstreamPath, body, signal);
      if (RETRYABLE.has(res.status) && attempt < RETRIES) {
        // Đọc và bỏ body lỗi để giải phóng kết nối, rồi thử lại sau backoff.
        await res.text().catch(() => {});
        lastError = new Error(`upstream ${res.status}`);
        lastStatus = res.status;
        const waitMs = retryAfterMs(res) ?? backoffMs(attempt);
        console.log(
          `[kiira-retry-proxy] ${req.method} ${upstreamPath}: upstream ${res.status} → thử lại sau ${waitMs}ms (lần ${attempt + 1}/${RETRIES})`,
        );
        await sleep(waitMs);
        continue;
      }
      return res; // thành công hoặc lỗi cứng/lỗi sau khi hết lượt thử
    } catch (err) {
      // Client đã ngắt — không còn ai nhận kết quả, dừng ngay, không thử nữa.
      if (clientGone.signal.aborted) throw err;
      // Lỗi mạng/timeout — coi như chập chờn, thử lại nếu còn lượt.
      lastError = err;
      if (attempt < RETRIES) {
        const waitMs = backoffMs(attempt);
        console.log(
          `[kiira-retry-proxy] ${req.method} ${upstreamPath}: ${err?.name === "TimeoutError" ? "timeout" : "mất kết nối"} → thử lại sau ${waitMs}ms (lần ${attempt + 1}/${RETRIES})`,
        );
        await sleep(waitMs);
        continue;
      }
    }
  }
  console.log(
    `[kiira-retry-proxy] ${req.method} ${upstreamPath}: hết ${RETRIES} lượt thử (lỗi cuối: ${lastStatus ?? String(lastError)}) — trả lỗi về client`,
  );
  return Response.json(
    { error: "kiira-retry-proxy: upstream vẫn lỗi sau các lần thử lại", detail: String(lastError) },
    { status: 502 },
  );
}

Bun.serve({
  port: PORT,
  // Chỉ lắng nghe loopback — không lộ proxy ra internet.
  hostname: "127.0.0.1",
  fetch: handle,
});

console.log(
  `[kiira-retry-proxy] đang lắng nghe http://127.0.0.1:${PORT} → ${UPSTREAM} (retry ${RETRIES} lần, backoff + jitter)`,
);
