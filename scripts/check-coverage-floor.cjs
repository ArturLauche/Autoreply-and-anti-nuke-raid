#!/usr/bin/env node
/**
 * check-coverage-floor.cjs — CI gate NGƯỠNG SÀN THEO FILE cho các engine bảo vệ.
 *
 * Ngưỡng c8 toàn cục (58%) chỉ chặn coverage TỔNG tụt — code mới có thể làm rớt
 * coverage của engine chống nuke xuống gần 0 mà tổng vẫn pass (vì các file khác
 * bù lại). Script này chặn RIÊNG từng file quan trọng: coverage của engine bảo vệ
 * không được tụt dưới sàn — sửa engine mà không có test sẽ bị CI từ chối.
 *
 * Đọc coverage/coverage-summary.json do c8 sinh (bun run test:coverage).
 * Chạy: node scripts/check-coverage-floor.cjs  (thường qua npm script coverage:floor)
 */
const fs = require("fs");
const path = require("path");

/** Sàn tối thiểu theo file (lines %) — key là đường dẫn tương đối từ bot/src. */
const FLOORS = {
  "altDetection.js": 75,
  "actionBudget.js": 80,
  "externalAppGuard.js": 90,
  "handlers/antinuke/audit.js": 80,
  "handlers/antinuke/members.js": 85,
  "handlers/antinuke/messages.js": 90,
  "handlers/antinuke/shared.js": 95,
  "handlers/antinuke/externalApp.js": 85,
  "heat.js": 65,
  "threatEngine.js": 85,
  "handlers/filters.js": 90,
};

const summaryPath = path.join(process.cwd(), "coverage", "coverage-summary.json");
if (!fs.existsSync(summaryPath)) {
  console.error(
    "✗ Không tìm thấy coverage/coverage-summary.json — chạy `bun run test:coverage` trước.",
  );
  process.exit(2);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
const files = new Map();
for (const [fullPath, data] of Object.entries(summary)) {
  if (fullPath === "total") continue;
  const rel = fullPath.replace(/\\/g, "/");
  const m = rel.match(/bot\/src\/(.+)$/);
  if (m) files.set(m[1], data); // đường dẫn tương đối từ bot/src (khớp key FLOORS)
}

let violations = 0;
console.log("════ Coverage floor — sàn tối thiểu theo file (lines %) ════\n");
for (const [file, floor] of Object.entries(FLOORS)) {
  const data = files.get(file);
  if (!data) {
    console.log(`⚠️  ${file.padEnd(24)} — không có dữ liệu (file bị xóa/exclude?)`);
    continue;
  }
  const pct = data.lines.pct;
  const ok = pct >= floor;
  const mark = ok ? "✅" : "❌";
  console.log(`${mark} ${file.padEnd(24)} ${String(pct).padStart(6)}%  (sàn ${floor}%)`);
  if (!ok) violations++;
}

console.log("");
if (violations > 0) {
  console.error(
    `✗ ${violations} file tụt dưới sàn coverage — thêm/khôi phục test cho engine bảo vệ trước khi merge.`,
  );
  process.exit(1);
}
console.log("✅ Tất cả engine bảo vệ đạt sàn coverage.");
