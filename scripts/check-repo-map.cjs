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

/**
 * Cắt đúng 1 mục "## tên" của bản đồ (tới mục "##" kế tiếp).
 * Vì sao cần: bản cũ tìm TÊN FILE bằng phép "chuỗi con" trên TOÀN BỘ bản đồ,
 * nên `bot/src/ai.js` qua cửa vì chữ "ai" nằm trong "raid"/"haimiya", còn
 * `convex/foo.ts` qua cửa vì "foo" xuất hiện ở mục khác — bản đồ thiếu dòng
 * vẫn báo xanh (đúng kiểu lỗi im lặng script này sinh ra để chặn).
 */
function mapSection(mapText, heading) {
  const after = mapText.split(new RegExp(`^## ${heading}`, "m"))[1];
  return after ? after.split(/^## /m)[0] : "";
}

/**
 * Tên file phải xuất hiện như MỘT TOKEN riêng trong mục, không phải chuỗi con
 * của từ khác: "ai" không khớp trong "raid", "util" không khớp trong "utilities".
 */
function mentions(section, name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![A-Za-z0-9_.-])${esc}(?![A-Za-z0-9_])`, "i").test(section);
}

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
// So trong ĐÚNG bảng convex/, không phải toàn bộ bản đồ
const convexSection = mapSection(mapText, "convex/");
for (const file of convexFiles) {
  if (!mentions(convexSection, file)) {
    problems.push(
      `TRẮNG: convex/${file}.ts chưa được nhắc trong bản đồ (bảng "convex/ — backend")`,
    );
  }
}

// ── 3. bot/src/*.js — module top-level phải thuộc 1 nhóm hoặc được nhắc ──
const botFiles = listDir("bot/src", ".js");
const botSection = mapSection(mapText, "bot/");
for (const file of botFiles) {
  // Tên file phải được nhắc trong bảng bot/ (khớp theo token, xem `mentions`).
  // Bản cũ còn một nhánh kiểm tra `isDirectory()` — code chết: listDir chỉ trả
  // file *.js nên `file` không bao giờ là thư mục.
  if (!mentions(botSection, file)) {
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
