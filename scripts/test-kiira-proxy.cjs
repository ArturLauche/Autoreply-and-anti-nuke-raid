#!/usr/bin/env node
/**
 * test-kiira-proxy.cjs — kiểm tra retry proxy chống chập chờn Kiira (18/09/2026).
 *
 * Bối cảnh: gateway Kiira đôi lúc trả 5xx/429 hoặc rớt kết nối thoáng qua →
 * OpenCode báo "AI service stream failed" và ngắt phiên giữa chừng. OpenCode
 * không có retry tích hợp → repo thêm proxy nội bộ (scripts/kiira-retry-proxy.mjs)
 * đứng giữa OpenCode và Kiira, tự thử lại lỗi tạm thời với backoff.
 *
 * Suite này kiểm tra 2 lớp, KHÔNG cần mạng và KHÔNG gọi Kiira thật:
 *   1. Thử lại thật sự qua proxy chạy cục bộ: upstream giả trả 503 rồi 200 →
 *      client phải nhận 200 (proxy đã tự thử lại); upstream giả luôn 500 →
 *      client nhận 500 sau đúng N lần thử. Lỗi cứng 401 → chuyển thẳng 1 lần.
 *   2. Khóa hình thức file: KHÔNG log/ghi Authorization (secret không lọt qua
 *      proxy), lắng nghe 127.0.0.1 (không lộ ra internet), danh sách status
 *      retryable có 429/5xx.
 */

const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

const PROXY_SCRIPT = path.join(__dirname, "kiira-retry-proxy.mjs");
const PORT = 8791; // port test riêng, tránh đụng proxy thật (8787)

let pass = 0;
let fail = 0;
function check(label, cond) {
  if (cond) {
    pass++;
    console.log(`PASS ${label}`);
  } else {
    fail++;
    console.error(`FAIL ${label}`);
  }
}

function waitForPort(port, timeoutMs = 8000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    (function probe() {
      const req = http.get({ host: "127.0.0.1", port, path: "/__health", timeout: 500 }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on("error", () => {
        if (Date.now() - started > timeoutMs) return reject(new Error("proxy không lên được"));
        setTimeout(probe, 150);
      });
      req.on("timeout", () => req.destroy());
    })();
  });
}

function request(port, reqPath, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: reqPath, method, headers: { authorization: "Bearer test-secret" } },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

/** Upstream giả: trả `statuses` tuần tự theo MỖI path, đếm số lượt gọi. */
function startMockUpstream(statuses) {
  const hits = {};
  const server = http.createServer((req, res) => {
    hits[req.url] = (hits[req.url] ?? 0) + 1;
    const status = statuses[Math.min(hits[req.url] - 1, statuses.length - 1)];
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify({ mock: true, status, hit: hits[req.url] }));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, hits, port: server.address().port })));
}

function stopServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

function startProxy(upstream) {
  const child = spawn(process.execPath === process.argv[0] ? "bun" : "bun", [PROXY_SCRIPT], {
    env: { ...process.env, KIRA_PROXY_PORT: String(PORT), KIRA_UPSTREAM: upstream, KIRA_PROXY_RETRIES: "2", KIRA_PROXY_TIMEOUT_MS: "4000" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return child;
}

(async () => {
  const src = fs.readFileSync(PROXY_SCRIPT, "utf8");

  // ─── 1. Hành vi thử lại thật sự ─────────────────────────────────────────
  // 1a. 503 rồi 200 → client phải nhận 200 nhờ retry.
  {
    const mock = await startMockUpstream([503, 200]);
    const proxy = startProxy(`http://127.0.0.1:${mock.port}`);
    try {
      check("proxy khởi động (health 200)", (await waitForPort(PORT)) === 200);
      const res = await request(PORT, "/chat/completions");
      check("503 tạm thời → tự thử lại → client nhận 200", res.status === 200);
      check("upstream bị gọi đúng 2 lần (1 lỗi + 1 thành công)", mock.hits["/chat/completions"] === 2);
    } finally {
      proxy.kill();
      await stopServer(mock.server);
    }
  }

  // 1b. Luôn 500 → hết 3 lượt gọi (1 + 2 retry) → client nhận 500.
  {
    const mock = await startMockUpstream([500]);
    const proxy = startProxy(`http://127.0.0.1:${mock.port}`);
    try {
      await waitForPort(PORT);
      const res = await request(PORT, "/chat/completions");
      check("500 liên tục → client nhận 500 sau khi hết lượt thử", res.status === 500);
      check("đúng 3 lượt gọi upstream (1 + 2 retry)", mock.hits["/chat/completions"] === 3);
    } finally {
      proxy.kill();
      await stopServer(mock.server);
    }
  }

  // 1c. 401 sai key = lỗi cứng → chuyển thẳng, KHÔNG thử lại.
  {
    const mock = await startMockUpstream([401]);
    const proxy = startProxy(`http://127.0.0.1:${mock.port}`);
    try {
      await waitForPort(PORT);
      const res = await request(PORT, "/chat/completions");
      check("401 lỗi cứng → trả ngay, không retry", res.status === 401);
      check("401 chỉ gọi upstream đúng 1 lần", mock.hits["/chat/completions"] === 1);
    } finally {
      proxy.kill();
      await stopServer(mock.server);
    }
  }

  // ─── 2. Khóa hình thức: an toàn secret + cấu hình đúng ──────────────────
  check("KHÔNG log giá trị Authorization/header (secret không lọt qua log)",
    !/console\.(log|error|info)\([^)]*headers/i.test(src));
  check("chỉ chuyển tiếp header an toàn (authorization/content-type/accept/user-agent)",
    src.includes('PASS_HEADERS = ["authorization", "content-type", "accept", "user-agent"]'));
  check("lắng nghe 127.0.0.1 — không lộ proxy ra internet", src.includes('hostname: "127.0.0.1"'));
  check("danh sách retryable gồm 408 + 429 + 5xx chuẩn",
    src.includes("429") && src.includes("408") && src.includes("502") && src.includes("503") && src.includes("504"));
  check("backoff tăng dần kèm jitter chống thundering herd",
    src.includes("1000 * 2 ** attempt") && src.includes("Math.random()"));
  check("mặc định chịu nghẽn 5 lần thử (KIRA_PROXY_RETRIES ?? 5)", src.includes("KIRA_PROXY_RETRIES ?? 5"));
  check("log mỗi lần thử lại để chẩn đoán qua journalctl",
    src.includes("thử lại sau backoff"));
  check("lỗi cứng 400/401/403 không nằm trong danh sách retry", !/\b(400|401|403)\b[^\n]*RETRYABLE/.test(src));
  check("có health endpoint để giám sát", src.includes("/__health"));
  check("timeout mỗi lượt gọi (không treo vô hạn)", src.includes("AbortSignal.timeout"));
  check("systemd unit đi kèm — proxy tự sống lại khi crash/reboot",
    fs.existsSync(path.join(__dirname, "kiira-retry-proxy.service")) &&
    fs.readFileSync(path.join(__dirname, "kiira-retry-proxy.service"), "utf8").includes("Restart=always"));

  console.log(`\nKết quả kiira-proxy: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((err) => {
  console.error("LỖI SUITE:", err);
  process.exit(1);
});
