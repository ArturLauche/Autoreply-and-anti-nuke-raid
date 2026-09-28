#!/usr/bin/env node
/**
 * scripts/build-og-image.cjs — vẽ ảnh chia sẻ (Open Graph) của Protogon.
 *
 * Vì sao có script: og-image.png là ẢNH RASTER, sửa bằng tay thì mỗi lần đổi
 * logo/chép phải mở tool vẽ — không tái lập được, không review được. Script này
 * vẽ PNG bằng @napi-rs/canvas và xuất luôn bản SVG từ CÙNG một bộ hằng số bố cục
 * (CARD) nên hai bản không thể lệch nhau.
 *
 * FONT — mấu chốt của lần vẽ này: máy build KHÔNG có font hệ thống (fc-list
 * rỗng). Không đăng ký font thì canvas vẽ chữ xong ra TRANG TRẮNG, im lặng —
 * chính vì vậy ảnh cũ phải giữ logo mặt bot vẽ tay. Font đúng như web (Inter,
 * JetBrains Mono) tải về assets/brand/fonts/ (KHÔNG commit, đã gitignore):
 *
 *   UA='Mozilla/5.0 (Linux; U; Android 2.3.7; en-us; Nexus One Build/GRK39) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1'
 *   mkdir -p assets/brand/fonts
 *   for w in "Inter:wght@400:inter-400.ttf" "Inter:wght@700:inter-700.ttf" "JetBrains+Mono:wght@400:jbmono-400.ttf"; do
 *     url=$(curl -s "https://fonts.googleapis.com/css2?family=${w%:*}&display=swap" -H "User-Agent: $UA" \
 *       | grep -o 'https://fonts.gstatic.com/[^)]*' | head -1)
 *     curl -s -o "assets/brand/fonts/${w##*:}" "$url"
 *   done
 *
 *   (Bắt buộc ghi rõ wght trong query: bỏ wght thì Google trả bản VARIABLE, dùng
 *   cho canvas sẽ không đậm dù ghi font-weight 700.)
 *
 * (User-Agent Android cũ là để Google trả TTF thật; UA IE trả EOT, UA mới
 * trả WOFF2 — canvas không đọc được hai loại sau.) Thiếu font thì script tự
 * lùi về bot/assets/fonts/NotoSans-Regular.ttf (font có sẵn trong repo) và
 * in cảnh báo.
 *
 * Chạy: NODE_PATH=bot/node_modules node scripts/build-og-image.cjs [--preview]
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const canvasPath = require.resolve("@napi-rs/canvas", {
  paths: [path.join(ROOT, "bot", "node_modules")],
});
const { createCanvas, loadImage, GlobalFonts } = require(canvasPath);

// ─── Bố cục (dùng chung cho PNG và SVG) ────────────────────────────────────
const W = 1200;
const H = 630;
const CARD = {
  bg: "#111111",
  wave: { d: "M0 470C260 390 410 560 650 470s360-120 550-35v195H0Z", fill: "#1d1d1d" },
  glow: [
    { cx: 1010, cy: 124, r: 170, fill: "#1b2730", opacity: 0.8 },
    { cx: 1010, cy: 124, r: 110, fill: "#243746", opacity: 0.6 },
  ],
  // Tranh cá voi khổ rộng làm nền mờ bên phải — nét trắng nên hạ alpha.
  whale: { file: "public/brand-whale.png", x: 620, y: 230, w: 700, h: 446, alpha: 0.18 },
  // Logo: public/logo-mark.png là khối TỐI + cá voi trắng; ảnh OG nền tối nên
  // đảo màu thành khối sáng + cá voi tối (đúng cặp màu preloader ở chủ đề tối).
  mark: { file: "public/logo-mark.png", x: 92, y: 118, size: 86 },
  cta: {
    x: 94,
    y: 410,
    w: 300,
    h: 52,
    r: 12,
    fill: "#fafafa",
    text: { x: 126, y: 444, size: 22, weight: 700, fill: "#111111", text: "Open dashboard →" },
  },
  texts: [
    { x: 210, y: 180, size: 54, weight: 700, fill: "#fafafa", text: "Protogon." },
    { x: 94, y: 300, size: 64, weight: 700, fill: "#fafafa", text: "Discord server protection" },
    {
      x: 98,
      y: 360,
      size: 28,
      weight: 400,
      fill: "#bdbdbd",
      text: "Auto-replies · Heat moderation · Join Gate · Anti-nuke",
    },
    {
      x: 94,
      y: 560,
      size: 18,
      weight: 400,
      mono: true,
      fill: "#8f8f8f",
      text: "protogon.freebuff.app",
    },
  ],
};

/** Đăng ký font; trả về họ chữ dùng cho canvas (có fallback Noto trong repo). */
function registerFonts() {
  const dir = path.join(ROOT, "assets", "brand", "fonts");
  const want = [
    ["inter-700.ttf", "Inter", 700],
    ["inter-400.ttf", "Inter", 400],
    ["jbmono-400.ttf", "JetBrains Mono", 400],
  ];
  let fallback = false;
  for (const [file] of want) {
    const p = path.join(dir, file);
    if (fs.existsSync(p)) GlobalFonts.register(fs.readFileSync(p));
  }
  if (!GlobalFonts.families.some((f) => f.family === "Inter")) {
    fallback = true;
    const noto = path.join(ROOT, "bot", "assets", "fonts", "NotoSans-Regular.ttf");
    if (fs.existsSync(noto)) GlobalFonts.register(fs.readFileSync(noto), "OgFallback");
    console.warn(
      "⚠ không có Inter/JetBrains Mono trong assets/brand/fonts/ — lùi về Noto Sans (xem header script để tải font).",
    );
  }
  return { fallback };
}

// true khi không tìm thấy Inter/JetBrains Mono và phải lùi về Noto trong repo.
let useFallback = false;

const family = (t) => (useFallback ? "OgFallback" : t.mono ? "JetBrains Mono" : "Inter");
const weightOf = (t) => (useFallback ? 400 : t.weight);

function font(t) {
  return `${weightOf(t)} ${t.size}px ${family(t)}`;
}

/** Đảo RGB, giữ alpha: khối tối + nét trắng → khối sáng + nét tối. */
async function invertedMark() {
  const img = await loadImage(path.join(ROOT, CARD.mark.file));
  const cv = createCanvas(img.width, img.height);
  const g = cv.getContext("2d");
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, cv.width, cv.height);
  for (let k = 0; k < d.data.length; k += 4) {
    d.data[k] = 255 - d.data[k];
    d.data[k + 1] = 255 - d.data[k + 1];
    d.data[k + 2] = 255 - d.data[k + 2];
  }
  g.putImageData(d, 0, 0);
  return cv;
}

function drawWave(g) {
  // Dịch path SVG sang lệnh canvas (canvas không có lệnh "s" ngắn).
  g.beginPath();
  g.moveTo(0, 470);
  g.bezierCurveTo(260, 390, 410, 560, 650, 470);
  g.bezierCurveTo(890, 380, 1010, 350, 1200, 435);
  g.lineTo(1200, 630);
  g.lineTo(0, 630);
  g.closePath();
  g.fillStyle = CARD.wave.fill;
  g.fill();
}

function drawText(g, t) {
  g.font = font(t);
  g.fillStyle = t.fill;
  g.fillText(t.text, t.x, t.y);
}

async function renderPng() {
  const cv = createCanvas(W, H);
  const g = cv.getContext("2d");
  g.fillStyle = CARD.bg;
  g.fillRect(0, 0, W, H);

  const whale = await loadImage(path.join(ROOT, CARD.whale.file));
  g.globalAlpha = CARD.whale.alpha;
  g.drawImage(whale, CARD.whale.x, CARD.whale.y, CARD.whale.w, CARD.whale.h);
  g.globalAlpha = 1;

  for (const c of CARD.glow) {
    g.globalAlpha = c.opacity;
    g.fillStyle = c.fill;
    g.beginPath();
    g.arc(c.cx, c.cy, c.r, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;

  drawWave(g);

  const mark = await invertedMark();
  g.drawImage(mark, CARD.mark.x, CARD.mark.y, CARD.mark.size, CARD.mark.size);

  for (const t of CARD.texts) drawText(g, t);

  g.fillStyle = CARD.cta.fill;
  g.beginPath();
  g.roundRect(CARD.cta.x, CARD.cta.y, CARD.cta.w, CARD.cta.h, CARD.cta.r);
  g.fill();
  drawText(g, CARD.cta.text);

  return cv.toBuffer("image/png");
}

function renderSvg() {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const textNode = (t) =>
    `  <text x="${t.x}" y="${t.y}" fill="${t.fill}" font-family="${
      t.mono ? "JetBrains Mono" : "Inter"
    }, sans-serif" font-size="${t.size}" font-weight="${weightOf(t)}">${esc(t.text)}</text>`;
  const texts = CARD.texts.map(textNode).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc">
  <title id="title">Protogon — Discord server protection</title>
  <desc id="desc">Auto-replies, heat moderation, Join Gate, and anti-nuke protection for Discord.</desc>
  <defs>
    <!-- Logo: khối sáng + cá voi tối = bản đảo màu của public/logo-mark.png. Dùng
         feColorMatrix đảo RGB thay vì nhúng base64 (base64 làm file nặng gấp
         rưỡi mà bản PNG đã đảo sẵn rồi). -->
    <filter id="invert">
      <feColorMatrix type="matrix" values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="${CARD.bg}"/>
  <image href="${CARD.whale.file.replace("public/", "")}" x="${CARD.whale.x}" y="${CARD.whale.y}" width="${CARD.whale.w}" height="${CARD.whale.h}" opacity="${CARD.whale.alpha}"/>
${CARD.glow
  .map(
    (c) =>
      `  <circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" fill="${c.fill}" opacity="${c.opacity}"/>`,
  )
  .join("\n")}
  <path d="${CARD.wave.d}" fill="${CARD.wave.fill}"/>
  <image href="${CARD.mark.file.replace("public/", "")}" x="${CARD.mark.x}" y="${CARD.mark.y}" width="${CARD.mark.size}" height="${CARD.mark.size}" filter="url(#invert)"/>
${texts}
  <rect x="${CARD.cta.x}" y="${CARD.cta.y}" width="${CARD.cta.w}" height="${CARD.cta.h}" rx="${CARD.cta.r}" fill="${CARD.cta.fill}"/>
${textNode(CARD.cta.text)}
</svg>
`;
}

/** Xem trước bằng ASCII — máy/CI không xem được ảnh thì phải có cách tự kiểm. */
async function preview(file) {
  const img = await loadImage(path.join(ROOT, file));
  const cols = 96;
  const cv = createCanvas(cols, Math.round((cols * H) / W / 2));
  const g = cv.getContext("2d");
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

async function main() {
  useFallback = registerFonts().fallback;

  const png = await renderPng();
  fs.writeFileSync(path.join(ROOT, "public/og-image.png"), png);
  console.log(`→ public/og-image.png ${W}×${H} ${(png.length / 1024).toFixed(1)}KB`);

  fs.writeFileSync(path.join(ROOT, "public/og-image.svg"), renderSvg());
  console.log("→ public/og-image.svg (cùng bố cục, dùng cho nơi cần vector)");

  if (process.argv.includes("--preview")) await preview("public/og-image.png");
}

main().catch((e) => {
  console.error("LỖI:", e.message);
  process.exit(1);
});
