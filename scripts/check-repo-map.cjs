#!/usr/bin/env node
/**
 * scripts/check-repo-map.cjs — So khớp docs/repo-map.md với cấu trúc thật của repo.
 *
 * Mục đích: bản đồ thu gọn (docs/repo-map.md) là tài liệu agent đọc đầu mỗi
 * phiên. Nếu nó lệch thực tế (thêm/xoá trang, panel, module bot, Convex
 * function) thì agent cứ theo bản đồ mà đi lạc. Script này chặn lệch NGAY
 * LÚC CI — đọc cấu trúc filesystem so với các dòng liệt kê trong bản đồ.
 *
 * Đầu ra: exit 0 khi khớp; exit 1 + danh sách lệch khi không. Có cờ --fix
 * chỉ IN đề xuất sửa (bản đồ là văn xuôi nên không tự sửa được — agent
 * hoặc người dùng đọc đề xuất rồi cập nhật tay).
 *
 * Quy tắc so khớp (thế giới thật → thế giới bản đồ):
 *  - src/pages/*.tsx        → bảng "src/ — dashboard web", phần Trang
 *  - convex/*.ts (không _*) → dòng trong bảng "convex/ — backend"
 *  - bot/src/*.js (top)     → bảng "bot/ — Discord bot" (nhóm hoặc tên file)
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MAP_PATH = path.join(ROOT, "docs", "repo-map.md");

function listDir(dir, ext) {
  try {
    return fs
      .readdirSync(path.join(ROOT, dir))
      .filter((f) => f.endsWith(ext))
      .map((f) => f.replace(ext, ""));
  } catch {
    return [];
  }
}

const mapText = fs.existsSync(MAP_PATH) ? fs.readFileSync(MAP_PATH, "utf8") : "";
const problems = [];

// ── 1. src/pages/*.tsx — trang phải được nhắc trong bản đồ ──
const pages = listDir("src/pages", ".tsx");
const pageSection = mapText.split("## bot/")[0] || "";
for (const page of pages) {
  if (!pageSection.includes(`pages/${page}.tsx`)) {
    problems.push(
      `TRẮNG: trang src/pages/${page}.tsx chưa có trong bản đồ (bảng "src/ — dashboard web")`,
    );
  }
}
// Trang trong bản đồ nhưng file không tồn tại nữa
const pageMentions = [...pageSection.matchAll(/pages\/([A-Za-z0-9_]+)\.tsx/g)].map((m) => m[1]);
for (const mentioned of pageMentions) {
  if (!pages.includes(mentioned)) {
    problems.push(
      `LỖ THỜI: bản đồ nhắc pages/${mentioned}.tsx nhưng file không tồn tại — xoá dòng`,
    );
  }
}

// ── 2. convex/*.ts — function file phải được nhắc (lặng lẽ bỏ _generated) ──
const convexFiles = listDir("convex", ".ts").filter((f) => !f.startsWith("_"));
// Tên file convex cho phép dạng "bot_tick" — so trên chữ thường
const mapLower = mapText.toLowerCase();
for (const file of convexFiles) {
  if (!mapLower.includes(file.toLowerCase())) {
    problems.push(
      `TRẮNG: convex/${file}.ts chưa được nhắc trong bản đồ (bảng "convex/ — backend")`,
    );
  }
}

// ── 3. bot/src/*.js — module top-level phải thuộc 1 nhóm hoặc được nhắc ──
const botFiles = listDir("bot/src", ".js");
const botSection = mapText.split("## bot/")[1]?.split("## convex/")[0] || "";
const botSectionLower = botSection.toLowerCase();
for (const file of botFiles) {
  const base = file.toLowerCase();
  // Chấp nhận: tên file được nhắc trực tiếp, hoặc thuộc một dòng nhóm
  // (ví dụ dòng "commands/, handlers/" bao phủ thư mục).
  const covered =
    botSectionLower.includes(base) ||
    (fs.existsSync(path.join(ROOT, "bot/src", file)) &&
      fs.statSync(path.join(ROOT, "bot/src", file)).isDirectory() &&
      botSectionLower.includes(`${base}/`));
  if (!covered) {
    problems.push(
      `TRẮNG: bot/src/${file}.js chưa được nhắc hoặc không thuộc dòng nhóm nào trong bản đồ (bảng "bot/ — Discord bot")`,
    );
  }
}

// ── Kết luận ──
if (problems.length === 0) {
  console.log(
    `repo-map OK — ${pages.length} trang, ${convexFiles.length} convex, ${botFiles.length} module bot khớp bản đồ`,
  );
  process.exit(0);
}

console.error(`repo-map LỆCH — ${problems.length} điểm cần cập nhật docs/repo-map.md:\n`);
for (const p of problems) console.error(`  - ${p}`);
console.error(
  "\nSửa: cập nhật đúng dòng trong docs/repo-map.md (mỗi dòng = 1 đơn vị + mô tả ngắn).",
);
process.exit(1);
