#!/usr/bin/env node
/**
 * test-brand-assets.cjs — chặn bẫy "chữ biến mất im lặng" trong ảnh thương hiệu.
 *
 * Bẫy: máy build KHÔNG có font hệ thống (fc-list rỗng — CI, container, VPS đều
 * vậy). @napi-rs/canvas không đăng ký font thì fillText() vẫn "thành công",
 * không ném lỗi, không cảnh báo — kết quả là ảnh có nền và logo nhưng TRỐNG
 * MỌI CHỮ. Đã xảy ra thật: og-image cũ vì thế phải giữ logo mặt bot vẽ tay.
 *
 * Vì sao đo pixel thay vì soi code: mọi kiểm tra kiểu "script có gọi fillText"
 * đều xanh ngay cả khi ảnh ra trắng. Chỉ nhìn được BITMAP mới biết chữ có thật.
 *
 * Suite này đọc PNG ĐÃ COMMIT nên không cần font trên máy chạy test (chạy được
 * cả khi GlobalFonts.families rỗng) — và cũng vì thế nó bắt được lỗi đúng lúc
 * người vẽ vừa commit ảnh hỏng, thay vì lúc khách share link.
 *
 * Chạy: node scripts/test-brand-assets.cjs [--self-test]
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SELF_TEST = process.argv.includes("--self-test");
const canvasPath = require.resolve("@napi-rs/canvas", {
  paths: [path.join(ROOT, "bot", "node_modules")],
});
const { createCanvas, loadImage } = require(canvasPath);

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

/** Đọc ảnh thành ImageData để đếm pixel. */
async function pixelsOf(relPath) {
  const img = await loadImage(path.join(ROOT, relPath));
  const cv = createCanvas(img.width, img.height);
  const g = cv.getContext("2d");
  g.drawImage(img, 0, 0);
  return { img, data: g.getImageData(0, 0, img.width, img.height).data };
}

const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

/** Đếm pixel trong hcnv chạm điều kiện sáng/tối. */
function countIn({ data, img }, x, y, w, h, pred) {
  let n = 0;
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      const i = (row * img.width + col) * 4;
      if (pred(lum(data, i))) n++;
    }
  }
  return n;
}

// Khối CTA đúng như CARD.cta trong build-og-image.cjs: chữ #111 trên nền
// #fafafa. Đây là VÙNG DUY NHẤT trong ảnh OG có nền phẳng — mọi vùng khác đều
// có tranh cá voi alpha 0.18 trên nên "đếm pixel sáng" bị nhiễu (đo thử: vùng
// tiêu đề 14480 pixel sáng, trong đó ~14000 đến từ tranh, không phải chữ).
const CTA = { x: 94, y: 410, w: 300, h: 52, r: 12 };

/** Số pixel tối trong khối CTA khi KHÔNG vẽ chữ — nhiễu nền từ bo góc. */
function ctaNoiseFloor() {
  const cv = createCanvas(1200, 630);
  const g = cv.getContext("2d");
  g.fillStyle = "#111111";
  g.fillRect(0, 0, 1200, 630);
  g.fillStyle = "#fafafa";
  g.beginPath();
  g.roundRect(CTA.x, CTA.y, CTA.w, CTA.h, CTA.r);
  g.fill();
  const data = g.getImageData(0, 0, 1200, 630).data;
  let n = 0;
  for (let row = CTA.y; row < CTA.y + CTA.h; row++) {
    for (let col = CTA.x; col < CTA.x + CTA.w; col++) {
      const i = (row * 1200 + col) * 4;
      if (lum(data, i) < 60) n++;
    }
  }
  return n;
}

const DARK = (l) => l < 60;
const FLOOR = ctaNoiseFloor();

// ─── Ảnh chia sẻ ─────────────────────────────────────────────────────────
(async () => {
  const og = await pixelsOf("public/og-image.png");
  check(
    "og-image.png đúng khổ 1200×630",
    og.img.width === 1200 && og.img.height === 630,
    `${og.img.width}×${og.img.height}`,
  );

  const ink = countIn(og, CTA.x, CTA.y, CTA.w, CTA.h, DARK);
  check(
    "og-image.png có CHỮ thật trong nút CTA (không phải chỉ bo góc)",
    ink > Math.max(400, FLOOR * 4),
    `mực=${ink}, nhiễu nền=${FLOOR} — máy vẽ thiếu font sẽ rơi về ~${FLOOR}`,
  );

  // Ảnh trắng tinh (script lỗi, canvas rỗng) — toàn ảnh chỉ có 1 màu.
  const first = [og.data[0], og.data[1], og.data[2]].join(",");
  let uniform = true;
  for (let i = 0; i < og.data.length; i += 4) {
    if (
      og.data[i] !== og.data[0] ||
      og.data[i + 1] !== og.data[1] ||
      og.data[i + 2] !== og.data[2]
    ) {
      uniform = false;
      break;
    }
  }
  check("og-image.png không phải ảnh một màu", !uniform, `màu đầu ${first}`);

  // Bản SVG phải khai báo đúng mọi dòng chữ của bản PNG, không thiếu dòng nào.
  const svg = fs.readFileSync(path.join(ROOT, "public", "og-image.svg"), "utf8");
  const svgTexts = [...svg.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((m) => m[1].trim());
  for (const t of [
    "Protogon.",
    "Discord server protection",
    "Open dashboard →",
    "protogon.freebuff.app",
  ]) {
    check(`og-image.svg có dòng chữ "${t}"`, svgTexts.includes(t));
  }
  check(
    "og-image.svg có phụ đề dài (không cắt bớt chữ)",
    svgTexts.some((t) => t.length > 40),
    `dòng dài nhất: ${Math.max(0, ...svgTexts.map((t) => t.length))} ký tự`,
  );

  // ─── Logo: file rỗng/trong suốt là thất bại im lặng khác ─────────────────
  for (const [file, size] of [
    ["logo-mark.png", 256],
    ["favicon.png", 64],
    ["apple-touch-icon.png", 180],
  ]) {
    const { img, data } = await pixelsOf(`public/${file}`);
    let filled = 0;
    const colors = new Set();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 8) filled++;
      colors.add((data[i] >> 3) * 1024 + (data[i + 1] >> 3) * 32 + (data[i + 2] >> 3));
    }
    const cover = filled / (img.width * img.height);
    check(
      `${file} đúng khổ ${size}×${size}`,
      img.width === size && img.height === size,
      `${img.width}×${img.height}`,
    );
    check(
      `${file} có nét vẽ, không phải ảnh trống`,
      colors.size >= 8 && cover >= 0.5,
      `màu≈${colors.size}, phủ=${cover.toFixed(2)}`,
    );
  }

  // ─── Tự kiểm: bộ đếm có thật sự bắt được bẫy không ───────────────────────
  // Dựng lại đúng ảnh hỏng (khối CTA không chữ) và chắc chắn bộ đếm phải loại
  // nó. Không có bước này thì một luật "luôn xanh" cũng qua được.
  if (SELF_TEST) {
    const cv = createCanvas(1200, 630);
    const g = cv.getContext("2d");
    g.fillStyle = "#111111";
    g.fillRect(0, 0, 1200, 630);
    g.fillStyle = "#fafafa";
    g.beginPath();
    g.roundRect(CTA.x, CTA.y, CTA.w, CTA.h, CTA.r);
    g.fill();
    const data = g.getImageData(0, 0, 1200, 630).data;
    let broken = 0;
    for (let row = CTA.y; row < CTA.y + CTA.h; row++) {
      for (let col = CTA.x; col < CTA.x + CTA.w; col++) {
        const i = (row * 1200 + col) * 4;
        if (lum(data, i) < 60) broken++;
      }
    }
    check(
      "self-test: ảnh KHÔNG có chữ bị loại đúng",
      broken <= Math.max(400, FLOOR * 4),
      `mực=${broken}, luật chặn từ ${Math.max(400, FLOOR * 4)}`,
    );
  }

  console.log(`\nKết quả brand assets: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
})();
