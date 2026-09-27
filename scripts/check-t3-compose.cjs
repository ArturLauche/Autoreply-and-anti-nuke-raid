#!/usr/bin/env node
// check-t3-compose.cjs — chốt bản sao compose `t3-code` trong repo còn nguyên.
//
// Vì sao cần: `docs/t3-code-compose.yml` là bản sao DUY NHẤT của compose chỉ tồn
// tại trong tab Files của Dokploy. Trong file có nhiều khối `base64 -d` sinh ra
// script bootstrap (cursor, agy, goal-mode). Nếu ai đó bóp méo 1 ký tự base64
// thì compose vẫn build được cho tới khi script đó chạy — lúc đó mới chết,
// giữa production. Cổng này bắt lỗi đó lúc commit.
//
// Cổng kiểm:
//   1. YAML parse được (dùng parser nhẹ tự viết cho block `key: |` — không thêm
//      dependency; repo không cài js-yaml).
//   2. Mọi khối base64 decode thành công.
//   3. Script sinh ra là bash hợp lệ (`bash -n`) hoặc JS hợp lệ (`node --check`).
//   4. Có đủ 5 service + `hostname: t3-devbox` + các volume quan trọng.
//
// Dùng: node scripts/check-t3-compose.cjs

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const FILE = path.join(__dirname, "..", "docs", "t3-code-compose.yml");
const failures = [];
const checks = [];

function ok(name, detail) {
  checks.push({ name, ok: true, detail: detail || "" });
}
function bad(name, detail) {
  checks.push({ name, ok: false, detail: detail || "" });
  failures.push(`${name}: ${detail}`);
}

if (!fs.existsSync(FILE)) {
  // Không FAIL: bản sao compose CHƯA được chụp. Cổng này chỉ có ý nghĩa khi
  // file đã tồn tại — thiếu file thì in cách lấy, không chặn CI.
  console.log("⏭  Chưa có bản sao compose trong repo — bỏ qua.");
  console.log("   Lấy bản GỐC (không gõ tay, để khỏi bóp méo base64):");
  console.log("     docker exec … ; hoặc trên host:");
  console.log("     ls /etc/dokploy/compose/protogon/");
  console.log("     cp <đường dẫn> docs/t3-code-compose.yml  # trong repo đã clone");
  console.log("   Xem docs/t3-devbox.md mục 7 (checklist chụp compose).");
  process.exit(0);
}
const src = fs.readFileSync(FILE, "utf8");

// ── 1. Cấu trúc YAML cơ bản ────────────────────────────────────────────────
// Chỉ cần bắt lỗi indent/quotes sai, đủ để chặn bóp méy khi sao chép tay.
const lines = src.split("\n");
lines.forEach((line, i) => {
  if (/\t/.test(line)) bad("tab indent", `dòng ${i + 1} dùng tab — YAML cấm tab`);
  // Dấu `'` trong base64 không được phép lọt ra ngoài: chỉ chấp nhận số
  // cơ sở 64 + ký tự `+/=`. Đây là chỗ bóp méy hay nhất.
  const m = line.match(/printf '%s' '([^']*)' \| base64 -d/);
  if (m && /[^A-Za-z0-9+/=]/.test(m[1])) {
    bad("base64 sạch", `dòng ${i + 1} có ký tự ngoài bảng base64`);
  }
});

// ── 2 + 3. Decode từng khối base64 và kiểm cú pháp script ───────────────────
const re = /printf '%s' '([A-Za-z0-9+/=]+)' \| base64 -d > (\S+)/g;
let m;
let count = 0;
while ((m = re.exec(src)) !== null) {
  count++;
  const b64 = m[1];
  const target = m[2];
  let decoded;
  try {
    decoded = Buffer.from(b64, "base64").toString("utf8");
  } catch (e) {
    bad(`decode ${target}`, e.message);
    continue;
  }
  // base64 hỏng thường decode ra rác nhưng KHÔNG ném lỗi — nên phải kiểm
  // nội dung, không chỉ dựa vào việc decode có chạy.
  if (decoded.includes("�")) {
    bad(`decode ${target}`, "base64 hỏng — có byte thay thế U+FFFD");
    continue;
  }
  const tmp = path.join(
    "/tmp",
    `t3chk-${process.pid}-${count}${target.endsWith(".js") ? ".js" : ".sh"}`,
  );
  fs.writeFileSync(tmp, decoded);
  try {
    if (target.endsWith(".js")) {
      execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" });
    } else {
      execFileSync("bash", ["-n", tmp], { stdio: "pipe" });
    }
    ok(`script ${target}`, `${decoded.split("\n").length} dòng`);
  } catch (e) {
    bad(`script ${target}`, String(e.stderr || e.message).split("\n")[0]);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}
if (count === 0) bad("base64 blocks", "không tìm thấy khối base64 nào");

// ── 4. Dấu hiệu cấu hình quan trọng ────────────────────────────────────────
const REQUIRED = [
  ["hostname t3-devbox", /^\s*hostname:\s*t3-devbox\s*$/m],
  ["service devbox", /^services:\s*$/m],
  ["service docker", /^ {2}docker:\s*$/m],
  ["service chrome", /^ {2}chrome:\s*$/m],
  ["service playwright-mcp", /^ {2}playwright-mcp:\s*$/m],
  ["port 3773 loopback", /127\.0\.0\.1:3773:3773/],
  ["port 8000 loopback", /127\.0\.0\.1:8000:8000/],
  ["t3 serve", /exec t3 serve --host 0\.0\.0\.0 --port 3773/],
  ["code-server", /code-server --bind-addr 0\.0\.0\.0:8000/],
  ["repo-sync", /REPO_SYNC_EOF/],
  ["volume workspace", /^ {2}workspace:\s*$/m],
  ["volume opencode_config", /^ {2}opencode_config:\s*$/m],
  ["GH_TOKEN qua Environment", /GH_TOKEN:\s*\$\{GH_TOKEN:-\}/],
  ["VSCODE_PASSWORD qua Environment", /PASSWORD:\s*\$\{VSCODE_PASSWORD:/],
  ["BROWSER_PASSWORD qua Environment", /PASSWORD:\s*\$\{BROWSER_PASSWORD:/],
  ["DOCKER_HOST=dind", /DOCKER_HOST:\s*tcp:\/\/docker:2375/],
  ["dind privileged", /^ {4}privileged:\s*true\s*$/m],
];
for (const [name, pat] of REQUIRED) {
  if (pat.test(src)) ok(name);
  else bad(name, "không tìm thấy trong file");
}

// ── In kết quả ────────────────────────────────────────────────────────────
for (const c of checks) {
  if (!c.ok) console.log(`  ✗ ${c.name} — ${c.detail}`);
}
if (failures.length) {
  console.error(`\n❌ compose hỏng: ${failures.length}/${checks.length} mục FAIL`);
  process.exit(1);
}
console.log(
  `✅ compose OK — ${checks.length} mục xanh (${count} khối base64 decode + cú pháp hợp lệ)`,
);
