#!/usr/bin/env node
/**
 * scripts/build-pwa-icons.cjs — sinh icon PWA + favicon.ico cho dashboard.
 *
 * Vì sao có script (thay vì commit file nhị phân vô danh): favicon.ico và icon
 * PWA phải sinh TỪ CHÍNH logo-mark.png đã commit — đổi logo thì chạy lại script,
 * không phải mò tool vẽ. Mọi output là binary quyết định được bởi một nguồn duy
 * nhất, review được bằng mắt (logo gì → icon đó).
 *
 * Dùng @napi-rs/canvas (đã có trong bot/package.json — KHÔNG cài thêm dep).
 * Chạy: node scripts/build-pwa-icons.cjs
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");

// Canvas nằm ở bot/node_modules (dep native bên bot) — cùng cách build-og-image.cjs
// đã phân giải; không cài thêm dep vào root.
const canvasPath = require.resolve("@napi-rs/canvas", {
  paths: [path.join(ROOT, "bot", "node_modules")],
});
const { createCanvas, loadImage } = require(canvasPath);

/** ICO chứa PNG 64×64: ICONDIR (6B) + ICONDIRENTRY (16B) + dữ liệu PNG. */
function icoFromPng(png) {
  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(0, 0); // reserved
  dir.writeUInt16LE(1, 2); // type: 1 = icon
  dir.writeUInt16LE(1, 4); // số ảnh

  const entry = Buffer.alloc(16);
  entry.writeUInt8(64, 0); // width
  entry.writeUInt8(64, 1); // height
  entry.writeUInt8(0, 2); // palette count (0 = truecolor)
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // kích thước dữ liệu ảnh
  entry.writeUInt32LE(dir.length + entry.length, 12); // offset ảnh trong file

  return Buffer.concat([dir, entry, png]);
}

async function main() {
  const logo = await loadImage(path.join(PUBLIC, "logo-mark.png"));

  // Icon PWA: 192 + 512 (chuẩn tối thiểu Chrome/Android nhận diện được).
  for (const size of [192, 512]) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(logo, 0, 0, size, size);
    fs.writeFileSync(path.join(PUBLIC, `icon-${size}.png`), canvas.toBuffer("image/png"));
    console.log(`→ public/icon-${size}.png`);
  }

  // favicon.ico (PNG-in-ICO): trình duyệt TỰ ĐỘNG请求 /favicon.ico kể cả khi
  // HTML đã khai báo icon khác; thiếu file này thì log tràn 404 và tab mất
  // biểu tượng ở công cụ cũ. Mọi trình duyệt hiện đại đọc được PNG-in-ICO.
  const png64 = fs.readFileSync(path.join(PUBLIC, "favicon.png"));
  fs.writeFileSync(path.join(PUBLIC, "favicon.ico"), icoFromPng(png64));
  console.log(`→ public/favicon.ico (${icoFromPng(png64).length}B)`);
}

main().catch((error) => {
  console.error(`[build-pwa-icons] ${error.message}`);
  process.exit(1);
});
