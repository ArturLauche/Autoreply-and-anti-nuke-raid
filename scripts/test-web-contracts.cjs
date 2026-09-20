#!/usr/bin/env node
/**
 * test-web-contracts.cjs — lá chắn hợp đồng dashboard web (20/09/2026).
 *
 * Chặn tái diễn 3 bug thật tìm thấy khi scan src/:
 *  1. OverviewPanel đọc token thô từ localStorage thay vì getSessionToken()
 *     → remember-mode gửi blob JSON {"t","e"} làm token (backend từ chối),
 *     session-mode gửi "" → khối "Hoạt động chống nuke gần đây" luôn trắng.
 *     Quy tắc: CHỈ src/lib/discord.ts được chạm storage thô của token.
 *  2. Nút "Hỏi Haimiya" ở Landing dispatch event "haimiya-open" nhưng Landing
 *     không mount <HaimiyaChat/> → bấm không có gì xảy ra (nút chết).
 *     Quy tắc: trang nào có chỗ dispatch thì phải mount HaimiyaChat.
 *  3. AnalyticsPanel + AuditLogPanel chết (không ai import) mà vẫn nằm trong
 *     repo, gây hiểu nhầm còn dùng được.
 *     Quy tắc: mọi panel trong components/dashboard/ phải được import ở đâu đó.
 *
 * Hermetic: chỉ đọc source bằng regex/fs, không cần bundler hay browser.
 * Chạy: node scripts/test-web-contracts.cjs
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");

let pass = 0;
let fail = 0;
function check(label, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Đọc mọi file .tsx/.ts trong src/, trả về Map<đường dẫn tương đối, nội dung>. */
function readSrc() {
  const out = new Map();
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(e.name)) {
        out.set(path.relative(SRC, full).replace(/\\/g, "/"), fs.readFileSync(full, "utf8"));
      }
    }
  })(SRC);
  return out;
}

const files = readSrc();

// ─── 1. Kỷ luật token phiên ────────────────────────────────────────────────
// Token lưu 2 dạng (discord.ts:setSessionToken): sessionStorage = token thô
// (không "Lưu đăng nhập"), localStorage = JSON {"t","e"} (có lưu, hết hạn 7
// ngày). Chỉ getSessionToken() biết bóc 2 dạng này — đọc thô ở nơi khác là bug.
const RAW_TOKEN_RE = /getItem\(\s*(SESSION_TOKEN_KEY|"wio_session_token")\s*\)/g;
const rawReaders = [...files.entries()]
  .filter(([rel, src]) => rel !== "lib/discord.ts" && RAW_TOKEN_RE.test(src))
  .map(([rel]) => rel);
check(
  "chỉ src/lib/discord.ts được đọc storage thô của token phiên",
  rawReaders.length === 0,
  rawReaders.length ? `vi phạm: ${rawReaders.join(", ")}` : "",
);

const overview = files.get("components/dashboard/OverviewPanel.tsx") ?? "";
check(
  "OverviewPanel lấy token qua getSessionToken()",
  /getSessionToken\(\)/.test(overview) && !RAW_TOKEN_RE.test(overview),
  "phải import { getSessionToken } từ ../../lib/discord, không localStorage.getItem thô",
);

// ─── 2. Nút Haimiya không được chết ─────────────────────────────────────────
// Mọi chỗ dispatch "haimiya-open" đều nằm trên cây render của Landing
// (Landing.tsx + sections.tsx chỉ Landing dùng) → Landing phải mount chat.
const dispatchers = [...files.entries()]
  .filter(([, src]) => src.includes('"haimiya-open"'))
  .map(([rel]) => rel);
const sectionUsers = [...files.entries()]
  .filter(([, src]) => /from\s+["']\.\.\/components\/landing\/sections["']/.test(src))
  .map(([rel]) => rel);
check(
  "sections.tsx (chứa nút Haimiya) chỉ dùng ở Landing",
  sectionUsers.length === 1 && sectionUsers[0] === "pages/Landing.tsx",
  `đang dùng ở: ${sectionUsers.join(", ") || "(không đâu)"}`,
);
const landing = files.get("pages/Landing.tsx") ?? "";
check(
  "Landing mount <HaimiyaChat/> để hứng event haimiya-open",
  /<HaimiyaChat[\s/>]/.test(landing),
  `dispatch ở: ${dispatchers.join(", ")}`,
);

// ─── 3. Không panel chết ────────────────────────────────────────────────────
// Mọi file trong components/dashboard/ phải được import bởi ≥1 file khác
// trong src/ (trực tiếp từ page hay gián tiếp qua panel khác như HiddenPanel).
const panels = [...files.keys()].filter((rel) => rel.startsWith("components/dashboard/"));
const dead = panels.filter((panel) => {
  const base = path.basename(panel, ".tsx");
  // Chấp nhận cả import tĩnh (from "...") lẫn lazy (import("...")).
  const re = new RegExp(`(?:from\\s+|import\\()\\s*["'][^"']*${base}\\.?["']`);
  return ![...files.entries()].some(([rel, src]) => rel !== panel && re.test(src));
});
check(
  "mọi dashboard panel đều được import ở đâu đó (không panel chết)",
  dead.length === 0,
  dead.length ? `chết: ${dead.join(", ")}` : "",
);

console.log(`\nKết quả web contracts: ${pass} PASS, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
