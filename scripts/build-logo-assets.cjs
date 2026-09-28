#!/usr/bin/env node
/**
 * scripts/build-logo-assets.cjs — sinh asset logo Protogon từ ảnh gốc.
 *
 * Vì sao có script này: logo của web KHÔNG còn là hình vector vẽ tay nữa mà là
 * ảnh cá voi do người dùng tạo (Gemini), giữ nguyên tỉ lệ. Ảnh gốc nặng 4.5MB
 * và còn dải chữ "BLUE WHALE / CONSERVATION & EXPLORATION" — không dùng thẳng
 * được. Script tách hình khỏi nền tối (luminance → trắng + alpha), cắt bỏ dải
 * chữ, rồi đóng khối bo góc cho từng cỡ. Mọi tham số nằm ở hằng số dưới đây:
 * muốn đổi khung cắt chỉ sửa CROP, không phải mò lại trong ảnh.
 *
 * Chạy: NODE_PATH=bot/node_modules node scripts/build-logo-assets.cjs [--preview]
 * (thư viện @napi-rs/canvas nằm trong bot/node_modules — dependency của bot).
 *
 * Đầu ra:
 *   public/logo-mark.png        256×256 — khối bo góc + cá voi, dùng trong web
 *   public/favicon.png           64×64  — favicon
 *   public/apple-touch-icon.png 180×180 — icon iOS (nền trắng đục)
 *   public/brand-whale.png      1024×652 — ảnh thương hiệu KHỔ RỘNG (cá voi +
 *     sóng, bỏ khối bo góc) để làm banner đầu trang chủ
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "assets", "brand", "whale-source.png");

// Vùng hình đo trên ảnh gốc 2816×1536: bỏ dải chữ ở dưới (~y 1056 trở xuống),
// giữ dư lề để không cắt mất nét vẽ.
const CROP = { x: 740, y: 215, w: 1260, h: 820 };
// Luminance → trắng + alpha: dưới floor là nền tối (bỏ), trên ceil là nét đặc.
const INK = { floor: 38, ceil: 215 };
const PAD = 14; // lề quanh nét sau khi trim
const PLATE = { bg: "#09090b", radius: 16 / 64, artWidth: 0.88, artHeight: 0.8 };
const OUT = {
  mark: { file: "public/logo-mark.png", size: 256, outer: null },
  favicon: { file: "public/favicon.png", size: 64, outer: null },
  // iOS không vẽ nền trong suốt — đệm nền trắng quanh khối bo góc.
  touch: { file: "public/apple-touch-icon.png", size: 180, outer: "#ffffff" },
};
// Ảnh thương hiệu khổ rộng: GIỮ NGUYÊN bức tranh (sóng + vệt nước), không đóng
// khối bo góc — web tự bọc nền tối quanh nó. Rộng hơn logo để nét mảnh của tranh
// còn đọc được ở cỡ hiển thị lớn trên trang chủ.
const HERO = { file: "public/brand-whale.png", width: 1024 };

const canvasPath = require.resolve("@napi-rs/canvas", {
  paths: [path.join(ROOT, "bot", "node_modules")],
});
const { createCanvas, loadImage, ImageData } = require(canvasPath);

/** Mọi pixel sáng hơn `floor` thành trắng với alpha theo độ sáng (bỏ nền + vignette). */
function toWhiteAlpha(data, w, h, floor, ceil) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = (j * w + i) * 4;
      const lum = (data[k] + data[k + 1] + data[k + 2]) / 3;
      const a = lum > floor ? Math.min(255, Math.round(((lum - floor) * 255) / (ceil - floor))) : 0;
      out[k] = 255;
      out[k + 1] = 255;
      out[k + 2] = 255;
      out[k + 3] = a;
    }
  }
  return out;
}

/** Khung bao của nét (alpha > min) — để cắt sát rồi mới thêm lề đều. */
function alphaBBox(data, w, h, min = 18) {
  let x0 = w;
  let x1 = -1;
  let y0 = h;
  let y1 = -1;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (data[(j * w + i) * 4 + 3] > min) {
        if (i < x0) x0 = i;
        if (i > x1) x1 = i;
        if (j < y0) y0 = j;
        if (j > y1) y1 = j;
      }
    }
  }
  if (x1 < 0) throw new Error("ảnh không có nét nào sáng hơn ngưỡng — kiểm tra CROP/INK");
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Ảnh cá voi trắng trên nền trong suốt, đã bỏ dải chữ và cắt sát nét. */
async function extractArt() {
  const src = await loadImage(SRC);
  const c = createCanvas(CROP.w, CROP.h);
  const cx = c.getContext("2d");
  cx.drawImage(src, CROP.x, CROP.y, CROP.w, CROP.h, 0, 0, CROP.w, CROP.h);

  const white = toWhiteAlpha(
    cx.getImageData(0, 0, CROP.w, CROP.h).data,
    CROP.w,
    CROP.h,
    INK.floor,
    INK.ceil,
  );
  const full = createCanvas(CROP.w, CROP.h);
  full.getContext("2d").putImageData(new ImageData(white, CROP.w, CROP.h), 0, 0);

  const bb = alphaBBox(white, CROP.w, CROP.h);
  const sx = Math.max(0, bb.x0 - PAD);
  const sy = Math.max(0, bb.y0 - PAD);
  const sw = Math.min(CROP.w - sx, bb.w + PAD * 2);
  const sh = Math.min(CROP.h - sy, bb.h + PAD * 2);

  const art = createCanvas(sw, sh);
  art.getContext("2d").drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh);
  return { art, ratio: sw / sh, source: `${src.width}×${src.height}`, crop: `${sw}×${sh}` };
}

/** Khối vuông bo góc tối + cá voi canh giữa, GIỮ NGUYÊN tỉ lệ ảnh (không bóp méo). */
function renderPlate(art, artRatio, { size, outer }) {
  const cv = createCanvas(size, size);
  const g = cv.getContext("2d");
  if (outer) {
    g.fillStyle = outer;
    g.fillRect(0, 0, size, size);
  }
  const inset = outer ? size * 0.055 : 0;
  const plate = size - inset * 2;
  g.fillStyle = PLATE.bg;
  g.beginPath();
  g.roundRect(inset, inset, plate, plate, PLATE.radius * plate);
  g.fill();

  let aw = plate * PLATE.artWidth;
  let ah = aw / artRatio;
  if (ah > plate * PLATE.artHeight) {
    ah = plate * PLATE.artHeight;
    aw = ah * artRatio;
  }
  g.imageSmoothingEnabled = true;
  g.drawImage(art, inset + (plate - aw) / 2, inset + (plate - ah) / 2, aw, ah);
  return cv;
}

async function main() {
  const { art, ratio, source, crop } = await extractArt();
  console.log(`ảnh gốc ${source} → hình ${crop} (tỉ lệ ${ratio.toFixed(3)})`);

  for (const [name, out] of Object.entries(OUT)) {
    const cv = renderPlate(art, ratio, out);
    const buf = cv.toBuffer("image/png");
    fs.writeFileSync(path.join(ROOT, out.file), buf);
    console.log(
      `→ ${out.file} ${out.size}×${out.size} ${(buf.length / 1024).toFixed(1)}KB (${name})`,
    );
  }

  // Ảnh thương hiệu khổ rộng: hình gốc đã bỏ chữ, chỉ thu về HERO.width.
  const heroW = HERO.width;
  const heroH = Math.round(heroW / ratio);
  const hero = createCanvas(heroW, heroH);
  const hg = hero.getContext("2d");
  hg.imageSmoothingEnabled = true;
  hg.drawImage(art, 0, 0, heroW, heroH);
  const heroBuf = hero.toBuffer("image/png");
  fs.writeFileSync(path.join(ROOT, HERO.file), heroBuf);
  console.log(`→ ${HERO.file} ${heroW}×${heroH} ${(heroBuf.length / 1024).toFixed(1)}KB`);

  // --preview: in ASCII khối logo để tự kiểm tra khi không xem được ảnh.
  if (process.argv.includes("--preview")) {
    const { loadImage } = require(canvasPath);
    const img = await loadImage(path.join(ROOT, OUT.mark.file));
    const cols = 60;
    const cv = createCanvas(cols, Math.round(cols / 2));
    const g = cv.getContext("2d");
    g.fillStyle = "#09090b";
    g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(img, 0, 0, cv.width, cv.height);
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    const ramp = " .:-=+*#%@";
    for (let j = 0; j < cv.height; j++) {
      let line = "";
      for (let i = 0; i < cols; i++) {
        const k = (j * cols + i) * 4;
        const v = 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2];
        line += ramp[Math.min(9, Math.round((v / 255) * 9))];
      }
      console.log(line);
    }
  }
}

main().catch((e) => {
  console.error("LỖI:", e.message);
  process.exit(1);
});
