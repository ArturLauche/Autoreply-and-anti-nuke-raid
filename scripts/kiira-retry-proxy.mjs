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
 * BẢN TĂNG CƯỜNG (19/09/2026) — vì sao vẫn kẹt dù đã có retry:
 *   1. TÁCH "chờ byte đầu" khỏi "chờ cả lượt". Bản cũ dùng một timeout 120s cho
 *      mỗi lượt fetch: Kiira treo (nhận kết nối nhưng không trả header) thì mỗi
 *      lượt đứng im 2 phút → 5 lượt ~10 phút treo cứng. Giờ chỉ chờ tối đa
 *      KIRA_PROXY_FIRST_BYTE_MS (15s) để thấy phản hồi đầu; quá hạn coi là nghẽn
 *      và thử lại ngay.
 *   2. IDLE WATCHDOG cho stream. Timer cũ 120s còn CẮT OAN stream hợp lệ dài hơn
 *      120s (model chậm, câu trả lời dài). Giờ stream được phép chạy bao lâu cũng
 *      được miễn là giữa 2 chunk không im lặng quá KIRA_PROXY_IDLE_MS (60s); im
 *      lặng quá lâu → cắt và thử lại.
 *   3. NGÂN SÁCH TỔNG (KIRA_PROXY_TOTAL_BUDGET_MS, mặc định 10 phút). Chặn việc
 *      cộng dồn nhiều lượt retry thành một phiên treo vô tận; hết ngân sách thì
 *      trả lỗi sớm để OpenCode báo rõ thay vì đứng chờ mù.
 *   4. NGẮT MẠCH BÁN MỞ (circuit breaker). Khi Kiira lỗi liên tục nhiều lượt,
 *      đừng đập vào cửa đang đóng: tạm ngưng thử trong KIRA_PROXY_BREAKER_MS rồi
 *      cho MỘT request "thăm dò" đi trước. Thăm dò thành công → đóng mạch lại
 *      ngay; thất bại → tiếp tục nghỉ. Tránh dồn tải lên gateway đang nghẽn.
 *   5. TÔN TRỌNG Retry-After nhưng KẸP theo ngân sách còn lại, không vượt trần.
 *
 * AN TOÀN SECRET: proxy KHÔNG cần API key — Authorization header từ OpenCode
 * được chuyển tiếp nguyên vẹn, không đọc, không ghi log giá trị header. Chỉ
 * forward header an toàn (auth + content-type + accept); các header hop-by-hop
 * bị bỏ theo chuẩn proxy.
 *
 * Cách chạy trên VPS (bền khi đóng SSH — xem docs Phần 4.5):
 *   systemctl enable --now kiira-retry-proxy
 *
 * Env tùy chọn:
 *   KIRA_PROXY_PORT (8787), KIRA_UPSTREAM (https://kiraai.vn/api/v1),
 *   KIRA_PROXY_RETRIES (6), KIRA_PROXY_TIMEOUT_MS (120000 — trần cứng mỗi lượt),
 *   KIRA_PROXY_FIRST_BYTE_MS (15000 — chờ phản hồi đầu), KIRA_PROXY_IDLE_MS
 *   (60000 — im lặng tối đa giữa 2 chunk), KIRA_PROXY_TOTAL_BUDGET_MS (600000),
 *   KIRA_PROXY_MAX_BACKOFF_MS (30000), KIRA_PROXY_BREAKER_THRESHOLD (5),
 *   KIRA_PROXY_BREAKER_MS (15000).
 */

const PORT = Number(process.env.KIRA_PROXY_PORT ?? 8787);
const UPSTREAM = (process.env.KIRA_UPSTREAM ?? "https://kiraai.vn/api/v1").replace(/\/+$/, "");
const RETRIES = Math.max(0, Number(process.env.KIRA_PROXY_RETRIES ?? 6));
// Trần cứng cho MỘT lượt fetch (không phải thời gian stream — stream do idle
// watchdog canh). Đủ rộng cho câu trả lời dài, đủ hẹp để không treo vô hạn.
const TIMEOUT_MS = Number(process.env.KIRA_PROXY_TIMEOUT_MS ?? 120_000);
// Chờ tối đa để thấy byte đầu (header) của upstream. Quá hạn = upstream nghẽn,
// thử lại ngay thay vì đứng chờ hết TIMEOUT_MS.
const FIRST_BYTE_MS = Math.max(1, Number(process.env.KIRA_PROXY_FIRST_BYTE_MS ?? 15_000));
// Stream im lặng quá lâu giữa 2 chunk = kết nối đã chết trên thực tế.
const IDLE_MS = Math.max(1, Number(process.env.KIRA_PROXY_IDLE_MS ?? 60_000));
// Ngân sách tổng cho cả request (mọi lượt retry + mọi lần chờ stream).
const TOTAL_BUDGET_MS = Math.max(1, Number(process.env.KIRA_PROXY_TOTAL_BUDGET_MS ?? 600_000));
// Trần chờ giữa 2 lần thử: backoff lũy tiến nhưng không vượt trần, tránh một
// lần nghẽn dài khiến phiên treo hàng phút.
const MAX_BACKOFF_MS = Math.max(0, Number(process.env.KIRA_PROXY_MAX_BACKOFF_MS ?? 30_000));
// Ngắt mạch bán mở: đủ nhiều thất bại liên tiếp thì tạm ngưng thử.
const BREAKER_THRESHOLD = Math.max(1, Number(process.env.KIRA_PROXY_BREAKER_THRESHOLD ?? 5));
const BREAKER_MS = Math.max(0, Number(process.env.KIRA_PROXY_BREAKER_MS ?? 15_000));
// Log mọi response (status + content-type) để chẩn đoán khi vẫn kẹt mà không
// thấy dòng retry nào — bật bằng KIRA_PROXY_LOG_ALL=1. KHÔNG log header/secret.
const LOG_ALL = ["1", "true", "yes"].includes(
  String(process.env.KIRA_PROXY_LOG_ALL ?? "").toLowerCase(),
);
// Bắt lỗi nằm trong thân SSE khi upstream vẫn trả HTTP 200 (mặc định bật).
const ERROR_IN_STREAM = !["0", "false", "no"].includes(
  String(process.env.KIRA_PROXY_ERROR_IN_STREAM ?? "1").toLowerCase(),
);

// Header từ client được chuyển tiếp — chỉ những header an toàn/ cần thiết.
const PASS_HEADERS = ["authorization", "content-type", "accept", "user-agent"];
// Status coi là "Kiira chập chờn" — đáng để thử lại. Gồm cả 5xx Cloudflare
// (520-527) vì kiraai.vn đứng sau Cloudflare; 529 là "site quá tải". Bản cũ chỉ
// có 522/524 nên các mã như 520/521/523/525/529 bị coi là lỗi cứng → không retry
// → client nhận "stream failed" dù proxy còn dư lượt thử.
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 525, 527, 529]);
// Trần cho phần thân lỗi đọc lại khi thử lại (chặn upstream lỗi trả body khổng lồ).
const MAX_ERROR_BODY = 64 * 1024;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now();
// Backoff tăng dần + jitter ngẫu nhiên (±30%) — nhiều request cùng dính nghẽn
// sẽ không dồn vào Kiira đúng một nhịp nữa (tránh "thundering herd").
// Kẹp trần MAX_BACKOFF_MS để tổng thời gian chờ luôn có biên.
const backoffMs = (attempt) =>
  Math.min(MAX_BACKOFF_MS, Math.round(1000 * 2 ** attempt * (0.7 + Math.random() * 0.6))); // ~0.7–1.3s, ~1.4–2.6s, ~2.8–5.2s… kẹp trần

// ─── Ngắt mạch MỀM ──────────────────────────────────────────────────────────
// Bài học 19/09/2026: ngắt mạch CỨNG (trả 503 khi mở) phản tác dụng — chính nó
// biến một đợt nghẽn Kiira tạm thời thành "service unavailable" hàng loạt cho
// client, đúng loại lỗi ta muốn diệt. Proxy là lớp retry, KHÔNG được từ chối
// phục vụ khi upstream còn có thể hồi phục.
//
// Vì vậy dùng ngắt mạch MỀM: khi upstream vừa lỗi liên tiếp, GIẢM số lượt thử
// của các request mới (đỡ dội tải vào gateway đang nghẽn) nhưng KHÔNG bao giờ
// chặn/trả 503. Request vẫn được thử, chỉ là thử ít lượt hơn; thành công lại
// thì mọi thứ trở về bình thường.
let breakerFails = 0; // số thất bại liên tiếp (kết cục request)
let breakerOpenedAt = 0; // thời điểm bắt đầu "nghỉ" (0 = đang khỏe)

// Số lượt thử áp dụng cho request hiện tại. Đang khỏe → RETRIES đầy đủ. Đang
// nghỉ (sau nhiều thất bại liên tiếp) → giảm còn một nửa, tối thiểu 1, để không
// dội tải; hết thời gian nghỉ → trở lại đầy đủ.
function effectiveRetries() {
  if (!breakerOpenedAt) return RETRIES;
  if (now() - breakerOpenedAt < BREAKER_MS) return Math.max(1, Math.floor(RETRIES / 2));
  return RETRIES;
}
function breakerSuccess() {
  breakerFails = 0;
  breakerOpenedAt = 0;
}
function breakerFailure() {
  breakerFails++;
  if (!breakerOpenedAt && breakerFails >= BREAKER_THRESHOLD) {
    breakerOpenedAt = now();
    console.log(
      `[kiira-retry-proxy] upstream lỗi liên tiếp ${breakerFails} lần → giảm số lượt thử trong ${BREAKER_MS}ms (không chặn request)`,
    );
  }
}

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
    // Hủy khi client ngắt, quá timeout lượt, hoặc hết ngân sách tổng.
    signal,
  });
}

// Đọc tối đa `max` byte của body lỗi rồi bỏ phần còn lại — giải phóng kết nối
// mà không kéo cả body khổng lồ của upstream đang lỗi.
async function drain(res) {
  const reader = res.body?.getReader();
  if (!reader) return;
  let read = 0;
  try {
    while (read < MAX_ERROR_BODY) {
      const { done, value } = await reader.read();
      if (done) break;
      read += value?.length ?? 0;
    }
  } catch {
    /* upstream lỗi giữa chừng — bỏ qua */
  } finally {
    await reader.cancel().catch(() => {});
  }
}

// Kết quả sentinel cho cuộc đua với idle watchdog — dùng RESOLVE (không reject)
// vì Bun v1.4.2 in reject từ timer như uncaught exception và reset socket.
const IDLE = Symbol("idle");

// Chờ chunk đầu tiên của upstream, tối đa IDLE_MS. Trả { idle:true } nếu upstream
// im lặng quá lâu TRƯỚC KHI gửi gì — lúc này chưa có byte nào tới client nên
// proxy an toàn hủy lượt và thử lại (đây chính là ca "kẹt" hay gặp: gateway nhận
// kết nối nhưng không chịu trả dữ liệu).
async function waitFirstChunk(reader) {
  let timer = null;
  const readPromise = reader.read();
  readPromise.catch(() => {}); // thua cuộc đua rồi bị cancel → không unhandled
  const idle = new Promise((resolve) => {
    timer = setTimeout(() => resolve(IDLE), IDLE_MS);
  });
  const result = await Promise.race([readPromise, idle]);
  clearTimeout(timer);
  if (result === IDLE) return { idle: true };
  return { idle: false, done: result.done, value: result.value };
}

// Xem trước nội dung chunk để chẩn đoán (chỉ khi LOG_ALL). Cắt ngắn 300 ký tự,
// thay xuống dòng bằng khoảng trắng. KHÔNG log header/secret.
function preview(value) {
  try {
    const text = new TextDecoder().decode(value).slice(0, 300).replace(/\s+/g, " ");
    return text;
  } catch {
    return "<binary>";
  }
}

// Đọc thân phản hồi lỗi để chẩn đoán VÀ phân loại, dùng bản clone nên KHÔNG
// tiêu thụ body thật trả về client. Cắt ngắn, KHÔNG đụng tới header/secret.
async function peekError(res) {
  try {
    const text = await res.clone().text();
    return text.slice(0, 500).replace(/\s+/g, " ") || "<rỗng>";
  } catch {
    return "<không đọc được>";
  }
}

// Kiira (sau Cloudflare) dùng 404 kèm thân "provider_error" cho lỗi TẠM THỜI của
// model — quan sát thực tế 19/09/2026:
//   404 {"error":{"message":"AI service stream failed: ... temporarily
//   unavailable ...","code":"provider_error"}}
// Nếu chỉ dựa vào mã status, 404 bị coi là lỗi cứng → không retry → client nhận
// đúng "AI service stream failed" dù proxy còn dư lượt. Vì vậy phân loại thêm
// theo THÂN lỗi. Chỉ nhận dạng cấu trúc rõ ràng, tránh retry nhầm lỗi thật.
function isRetryableErrorBody(text) {
  if (!text) return false;
  return (
    /"code"\s*:\s*"(provider_error|server_error|upstream_error|service_unavailable)"/i.test(text) ||
    /temporarily unavailable/i.test(text) ||
    /AI service stream failed/i.test(text)
  );
}

// Phát hiện lỗi nằm TRONG thân SSE/JSON khi upstream vẫn trả HTTP 200. Kiira có
// thể trả 200 rồi gửi event lỗi — nếu proxy không bắt, client nhận "stream
// failed" mà proxy không hề retry. Chỉ soi CHUNK ĐẦU và chỉ nhận dạng cấu trúc
// lỗi rõ ràng (khóa "error" / thông điệp quen thuộc), tránh retry nhầm khi model
// viết chữ "500" trong nội dung trả lời.
function looksLikeErrorChunk(value) {
  let text;
  try {
    text = new TextDecoder().decode(value).slice(0, 2000).trim();
  } catch {
    return false;
  }
  if (!text) return false;
  const payload = text.replace(/^data:\s*/, "");
  return (
    /^\{\s*"error"\s*:/.test(payload) ||
    /"error"\s*:\s*\{/.test(payload) ||
    /temporarily unavailable/i.test(payload) ||
    /"code"\s*:\s*"(no_api_key_provided|rate_limit[^"]*|server_error)"/.test(payload)
  );
}

// Sau khi đã có chunk đầu, chuyển tiếp phần còn lại và reset idle watchdog sau
// mỗi chunk. Im lặng giữa 2 chunk quá IDLE_MS → đóng stream (KHÔNG dùng
// controller.error/abort vì Bun reset socket thô; đóng sạch để client tự xử lý).
//
// BUG ĐÃ VÁ (19/09/2026): reader.read() có thể REJECT khi upstream reset socket
// GIỮA stream (sau chunk đầu). Bản cũ await thẳng trong pull() không bắt reject
// → pull ném ra ngoài → ReadableStream chuyển sang errored state → client nhận
// ECONNRESET/"terminated" ĐỘT NGỘT, đúng kiểu "AI service stream failed" dù
// chunk đầu đã tới. Giờ bọc try/catch: rớt giữa stream được coi là HẾT stream
// (đóng sạch), giữ nguyên phần đã gửi — không thể retry vì đã gửi byte cho
// client (retry sẽ nhân đôi nội dung).
function continueStream(reader, firstValue) {
  let closed = false;
  return new ReadableStream({
    start(controller) {
      controller.enqueue(firstValue);
    },
    async pull(controller) {
      if (closed) return;
      let timer = null;
      let result;
      try {
        const readPromise = reader.read();
        readPromise.catch(() => {});
        const idle = new Promise((resolve) => {
          timer = setTimeout(() => resolve(IDLE), IDLE_MS);
        });
        result = await Promise.race([readPromise, idle]);
      } catch (err) {
        // Upstream rớt giữa stream — đóng SẠCH thay vì để stream lỗi đột ngột.
        clearTimeout(timer);
        if (closed) return;
        closed = true;
        console.log(
          `[kiira-retry-proxy] upstream rớt giữa stream (${err?.message || err}) → đóng sạch`,
        );
        await reader.cancel().catch(() => {});
        try {
          controller.close();
        } catch {
          /* đã đóng */
        }
        return;
      }
      clearTimeout(timer);
      if (result === IDLE) {
        closed = true;
        console.log(`[kiira-retry-proxy] stream im lặng > ${IDLE_MS}ms → đóng kết nối`);
        await reader.cancel().catch(() => {});
        controller.close();
        return;
      }
      if (closed) return;
      if (result.done) {
        closed = true;
        controller.close();
        return;
      }
      controller.enqueue(result.value);
    },
    cancel(reason) {
      closed = true;
      return reader.cancel(reason).catch(() => {});
    },
  });
}

async function handle(req) {
  const url = new URL(req.url);

  if (url.pathname === "/__health") {
    return Response.json({
      ok: true,
      upstream: UPSTREAM,
      retries: RETRIES,
      firstByteMs: FIRST_BYTE_MS,
      idleMs: IDLE_MS,
      totalBudgetMs: TOTAL_BUDGET_MS,
      breaker: {
        // "open" = đang giảm lượt thử do upstream lỗi liên tiếp (KHÔNG chặn request).
        open: Boolean(breakerOpenedAt),
        fails: breakerFails,
        forMs: breakerOpenedAt ? Math.max(0, BREAKER_MS - (now() - breakerOpenedAt)) : 0,
        effectiveRetries: effectiveRetries(),
      },
    });
  }

  // Mọi path khác chuyển thẳng (giữ nguyên query string) — ví dụ /chat/completions,
  // /models. Client trỏ baseURL vào proxy nên path giữ nguyên hình dạng.
  const upstreamPath = url.pathname + url.search;

  // Ngắt mạch MỀM: không chặn request, chỉ giảm số lượt thử khi upstream đang lỗi
  // liên tiếp (xem effectiveRetries).
  const maxAttempts = effectiveRetries();

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

  const deadline = now() + TOTAL_BUDGET_MS;
  let lastError = null;
  let lastStatus = null;
  // Lượt vừa rồi có phải lỗi tạm thời không — dùng để chốt ngắt mạch đúng khi
  // hết lượt retry (lỗi tạm thời dai dẳng = thất bại thật).
  let lastTransient = false;
  // Ngắt mạch chỉ được CHỐT đúng MỘT lần cho cả request, ở nhánh kết thúc. Các
  // nhánh retry trung gian KHÔNG đụng tới — nếu đếm từng lượt, nhiều request
  // song song cùng retry sẽ đẩy bộ đếm vượt ngưỡng sau vài lượt và mở mạch oan.
  let breakerSettled = false;
  const settleBreaker = (ok) => {
    if (breakerSettled) return;
    breakerSettled = true;
    if (ok) breakerSuccess();
    else breakerFailure();
  };

  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    const remaining = deadline - now();
    if (remaining <= 0) {
      lastError = new Error("hết ngân sách tổng");
      break;
    }
    // Chờ byte đầu (header) tối đa first-byte; KIRA_PROXY_TIMEOUT_MS là trần dự
    // phòng nếu first-byte bị đặt 0. Kẹp theo ngân sách còn lại.
    const headerWaitMs = Math.min(FIRST_BYTE_MS > 0 ? FIRST_BYTE_MS : TIMEOUT_MS, remaining);
    // Controller thủ công để HỦY timer ngay khi nhận header — nếu dùng
    // AbortSignal.timeout, nó vẫn nổ sau 15s và cắt oan stream đang chảy.
    const attemptController = new AbortController();
    const signal = AbortSignal.any([clientGone.signal, attemptController.signal]);
    const firstByteTimer = setTimeout(
      () => attemptController.abort(new Error("chờ phản hồi đầu quá hạn")),
      headerWaitMs,
    );

    try {
      const res = await forward(req, upstreamPath, body, signal);
      // Đã thấy header — tắt đồng hồ chờ byte đầu; phần thân do idle watchdog canh.
      clearTimeout(firstByteTimer);
      // Chẩn đoán: log MỌI response để biết vì sao không retry (chỉ status +
      // content-type, KHÔNG log header/secret). Bật/tắt qua KIRA_PROXY_LOG_ALL.
      if (LOG_ALL) {
        console.log(
          `[kiira-retry-proxy] ${req.method} ${upstreamPath}: ← ${res.status} ${res.headers.get("content-type") ?? ""}`,
        );
      }

      if (RETRYABLE.has(res.status) && attempt < maxAttempts) {
        // Đọc và bỏ body lỗi để giải phóng kết nối, rồi thử lại sau backoff.
        await drain(res);
        lastError = new Error(`upstream ${res.status}`);
        lastStatus = res.status;
        lastTransient = true;
        // KHÔNG tính ngắt mạch ở đây: đây mới là một LƯỢT thử, chưa phải kết cục
        // của request. Đếm từng lượt khiến nhiều request song song cùng retry
        // đẩy bộ đếm vượt ngưỡng chỉ sau vài lượt → mở mạch oan, chặn các request
        // khác dù chúng có thể tự retry thành công.
        const waitMs = Math.min(
          retryAfterMs(res) ?? backoffMs(attempt),
          Math.max(0, deadline - now()),
        );
        console.log(
          `[kiira-retry-proxy] ${req.method} ${upstreamPath}: upstream ${res.status} → thử lại sau ${waitMs}ms (lần ${attempt + 1}/${maxAttempts})`,
        );
        await sleep(waitMs);
        continue;
      }

      // Lỗi KHÔNG thuộc danh sách status nhưng thân báo lỗi tạm thời của Kiira
      // (điển hình 404 provider_error) → vẫn đáng thử lại. Kiểm tra thân qua
      // bản clone, giữ nguyên body cho client nếu không retry.
      if (!RETRYABLE.has(res.status) && res.status >= 400) {
        const bodyText = await peekError(res);
        if (isRetryableErrorBody(bodyText)) {
          lastError = new Error(`upstream ${res.status} (${bodyText.slice(0, 120)})`);
          lastStatus = res.status;
          lastTransient = true;
          if (attempt < maxAttempts) {
            const waitMs = Math.min(backoffMs(attempt), Math.max(0, deadline - now()));
            console.log(
              `[kiira-retry-proxy] ${req.method} ${upstreamPath}: ${res.status} nhưng thân báo lỗi tạm thời → thử lại sau ${waitMs}ms (lần ${attempt + 1}/${maxAttempts})`,
            );
            await sleep(waitMs);
            continue;
          }
          // Hết lượt mà vẫn lỗi tạm thời → thất bại thật, rơi xuống chốt mạch.
        }
      }

      // Kết cục CUỐI của request (không còn continue). Lỗi cứng (401/400…) =
      // upstream còn sống → đóng mạch; còn lại là thất bại thật → tính MỘT lần
      // cho cả request vào ngắt mạch.
      if (RETRYABLE.has(res.status)) lastTransient = true;
      settleBreaker(!lastTransient);

      // Lỗi (>=400) hoặc không có body → chuyển thẳng, không stream.
      if (res.status >= 400 || !res.body) {
        // Chẩn đoán lỗi CỨNG: đây là loại proxy không retry, nếu không log thì
        // "mù" khi client báo "stream failed". Đọc thân lỗi qua bản clone để
        // KHÔNG tiêu thụ body thật của client.
        console.log(
          `[kiira-retry-proxy] ${req.method} ${upstreamPath}: lỗi ${res.status} (không retry) → ${await peekError(res)}`,
        );
        return res;
      }

      // Chờ chunk ĐẦU với idle watchdog. Nếu upstream im lặng trước khi gửi gì,
      // chưa có byte nào tới client → hủy lượt và thử lại (ca "kẹt" hay gặp).
      const reader = res.body.getReader();
      const first = await waitFirstChunk(reader);
      if (first.idle) {
        await reader.cancel().catch(() => {});
        lastError = new Error("upstream im lặng trước chunk đầu");
        lastTransient = true;
        if (attempt < maxAttempts) {
          const waitMs = Math.min(backoffMs(attempt), Math.max(0, deadline - now()));
          console.log(
            `[kiira-retry-proxy] ${req.method} ${upstreamPath}: upstream im lặng trước chunk đầu → thử lại sau ${waitMs}ms (lần ${attempt + 1}/${maxAttempts})`,
          );
          await sleep(waitMs);
          continue;
        }
        break;
      }
      if (first.done) {
        settleBreaker(true);
        return new Response(null, { status: res.status, headers: res.headers });
      }

      // Kiira có thể trả HTTP 200 rồi gửi lỗi TRONG thân SSE/JSON. Nếu chunk đầu
      // là tín hiệu lỗi, coi như chập chờn và thử lại (thay vì để client nhận
      // "stream failed" mà proxy không hề retry).
      if (ERROR_IN_STREAM && looksLikeErrorChunk(first.value)) {
        if (LOG_ALL) {
          console.log(
            `[kiira-retry-proxy] ${req.method} ${upstreamPath}: 200 nhưng thân báo lỗi → ${preview(first.value)}`,
          );
        }
        await reader.cancel().catch(() => {});
        lastError = new Error("upstream 200 nhưng thân báo lỗi");
        lastTransient = true;
        if (attempt < maxAttempts) {
          const waitMs = Math.min(backoffMs(attempt), Math.max(0, deadline - now()));
          console.log(
            `[kiira-retry-proxy] ${req.method} ${upstreamPath}: upstream 200 nhưng thân báo lỗi → thử lại sau ${waitMs}ms (lần ${attempt + 1}/${maxAttempts})`,
          );
          await sleep(waitMs);
          continue;
        }
        break;
      }
      if (LOG_ALL) {
        console.log(
          `[kiira-retry-proxy] ${req.method} ${upstreamPath}: chunk đầu → ${preview(first.value)}`,
        );
      }

      // Đã có chunk đầu — stream phần còn lại, idle watchdog canh giữa chừng.
      settleBreaker(true);
      return new Response(continueStream(reader, first.value), {
        status: res.status,
        headers: res.headers,
      });
    } catch (err) {
      clearTimeout(firstByteTimer);
      // Client đã ngắt — không còn ai nhận kết quả, dừng ngay, không thử nữa.
      if (clientGone.signal.aborted) {
        throw err;
      }
      lastError = err;
      lastTransient = true;
      if (attempt < maxAttempts) {
        const label =
          err?.message === "chờ phản hồi đầu quá hạn" ? "chờ phản hồi đầu quá hạn" : "mất kết nối";
        const waitMs = Math.min(backoffMs(attempt), Math.max(0, deadline - now()));
        console.log(
          `[kiira-retry-proxy] ${req.method} ${upstreamPath}: ${label} → thử lại sau ${waitMs}ms (lần ${attempt + 1}/${maxAttempts})`,
        );
        await sleep(waitMs);
        continue;
      }
    }
  }

  // Hết lượt / hết ngân sách / hết đường retry → đây mới là thất bại của request.
  settleBreaker(false);
  console.log(
    `[kiira-retry-proxy] ${req.method} ${upstreamPath}: hết ${maxAttempts} lượt thử (lỗi cuối: ${lastStatus ?? String(lastError)}) — trả lỗi về client`,
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
  `[kiira-retry-proxy] đang lắng nghe http://127.0.0.1:${PORT} → ${UPSTREAM} (retry ${RETRIES} lần, first-byte ${FIRST_BYTE_MS}ms, idle ${IDLE_MS}ms, ngân sách ${TOTAL_BUDGET_MS}ms, breaker ${BREAKER_THRESHOLD}/${BREAKER_MS}ms)`,
);
