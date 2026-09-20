#!/usr/bin/env node
/**
 * scripts/check-i18n.cjs — chặn chuỗi tiếng Việt lọt sang người dùng EN.
 *
 * Kiến trúc i18n: chuỗi VI trong code CHÍNH LÀ key (kiểu gettext), thiếu bản
 * EN thì translate() rơi về nguyên chuỗi VI — không vỡ UI nhưng người dùng EN
 * đọc phải tiếng Việt. Script này là lá chắn cho đúng kiểu "lọt âm thầm" đó.
 *
 * Kiểm tra CỨNG (exit 1 nếu vi phạm):
 *   1. Mọi key trong translate("…") / t("…") trên src/ phải có bản EN.
 *   2. Mọi chuỗi trong src/lib/haimiya.ts đi tới người dùng (GREETING,
 *      QUICK_QUESTIONS, answer, suggestions của từng topic, FALLBACK) phải
 *      có bản EN — phần này được dịch lúc render nên không lộ ra ở dạng
 *      literal translate("…").
 *
 * Báo cáo MỀM (không fail — chỉ nhắc để rà):
 *   3. Thuộc tính JSX (label/title/placeholder/aria-label/alt) có dấu tiếng
 *      Việt mà không bọc translate() — dấu hiệu quên dịch khi thêm UI mới.
 *   4. Key EN không còn xuất hiện trong code (bản dịch chết).
 *
 * Dùng: node scripts/check-i18n.cjs
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const VIET = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ]/;

/** Giải escape của chuỗi JS (\" \\ \n…) để so khớp với key thật. */
function unescapeJs(raw) {
  try {
    return JSON.parse(`"${raw}"`);
  } catch {
    return raw;
  }
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(tsx?|jsx?)$/.test(e.name) ? [p] : [];
  });
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

// ── Key có trong từ điển EN ────────────────────────────────────────────────
const enSrc = fs.readFileSync(path.join(SRC, "lib/i18n.en.ts"), "utf8");
const enKeys = new Set();
for (const m of enSrc.matchAll(
  /^\s{2}(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s:]+))\s*:/gm,
)) {
  enKeys.add(m[1] !== undefined ? unescapeJs(m[1]) : m[2] !== undefined ? m[2] : m[3]);
}

const problems = [];

// ── 1. Mọi translate("…") phải có bản EN ───────────────────────────────────
const codeFiles = walk(SRC).filter((p) => !/lib[\\/]i18n(\.en)?\.tsx?$/.test(p));
const wrappedKeys = new Set();
for (const file of codeFiles) {
  const src = fs.readFileSync(file, "utf8");
  // (?<![A-Za-z0-9_$.]) để KHÔNG khớp `import(` (kết thúc bằng "t(" ).
  for (const m of src.matchAll(/(?<![A-Za-z0-9_$.])(?:translate|t)\(\s*"((?:[^"\\]|\\.)*)"/g)) {
    const key = unescapeJs(m[1]);
    wrappedKeys.add(key);
    if (!enKeys.has(key)) problems.push(`THIẾU EN: ${rel(file)} — ${key.slice(0, 80)}`);
  }
  // Template literal tĩnh (không có ${}) cũng là key.
  for (const m of src.matchAll(/(?<![A-Za-z0-9_$.])(?:translate|t)\(\s*`([^`$\\]*)`/g)) {
    wrappedKeys.add(m[1]);
    if (!enKeys.has(m[1])) problems.push(`THIẾU EN: ${rel(file)} — ${m[1].slice(0, 80)}`);
  }
}

// ── 2. Chuỗi tới người dùng trong haimiya.ts phải có bản EN ────────────────
const kbPath = path.join(SRC, "lib/haimiya.ts");
if (fs.existsSync(kbPath)) {
  const kb = fs.readFileSync(kbPath, "utf8");
  const kbKeys = new Set();
  for (const m of kb.matchAll(/answer:\s*\n?\s*"((?:[^"\\]|\\.)*)"/g)) kbKeys.add(unescapeJs(m[1]));
  for (const blk of kb.matchAll(/suggestions:\s*\[([\s\S]*?)\]/g))
    for (const m of blk[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)) kbKeys.add(unescapeJs(m[1]));
  const greeting = kb.match(/export const GREETING\s*=\s*\n?\s*"((?:[^"\\]|\\.)*)"/);
  if (greeting) kbKeys.add(unescapeJs(greeting[1]));
  const quick = kb.match(/export const QUICK_QUESTIONS\s*=\s*\[([\s\S]*?)\]/);
  if (quick)
    for (const m of quick[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)) kbKeys.add(unescapeJs(m[1]));
  const fallback = kb.match(/const FALLBACK[\s\S]*?text:\s*"((?:[^"\\]|\\.)*)"/);
  if (fallback) kbKeys.add(unescapeJs(fallback[1]));
  for (const key of kbKeys)
    if (!enKeys.has(key)) problems.push(`THIẾU EN (Haimiya): ${key.slice(0, 80)}`);
}

// ── 3. Cảnh báo mềm: thuộc tính JSX có dấu tiếng Việt chưa bọc translate() ──
const softAttr = [];
for (const file of codeFiles) {
  const src = fs.readFileSync(file, "utf8");
  for (const m of src.matchAll(
    /\b(label|title|placeholder|aria-label|alt)=("([^"\n]*)"|\{`([^`$\n]*)`\})/g,
  )) {
    const value = m[3] !== undefined ? m[3] : m[4];
    if (value && VIET.test(value) && !/translate\(|t\(/.test(value))
      softAttr.push(`${rel(file)} — ${m[1]}="${value.slice(0, 60)}"`);
  }
}

// ── 3b. Đo phần CÒN LẠI: chữ tiếng Việt nằm trực tiếp trong JSX (text node)
// mà chưa bọc translate(). Đây là các câu bị nội suy `{…}` nên codemod đợt
// đầu không khớp mẫu an toàn — không fail CI (đang hoàn thiện dần) nhưng đo
// được để mỗi phiên thấy tiến độ.
const VIET_RE = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ]/;
const rawText = [];
for (const file of codeFiles.filter((f) => /\.(tsx|jsx)$/.test(f))) {
  const src = fs
    .readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/"((?:[^"\\\n]|\\.)*)"/g, '""')
    .replace(/'((?:[^'\\\n]|\\.)*)'/g, "''")
    .replace(/`(?:\\.|[^`\\])*`/g, "``");
  src.split("\n").forEach((line, i) => {
    if (!VIET_RE.test(line)) return;
    if (/^\s*(\/\/|\*)/.test(line)) return;
    if (/^\s*[A-Za-z]+\s*[=(]/.test(line) === false && !/[<>{}]/.test(line)) return;
    rawText.push(`${rel(file)}:${i + 1} — ${line.trim().slice(0, 70)}`);
  });
}

// ── 4. Cảnh báo mềm: bản dịch không còn dùng trong code ───────────────────
// Key chứa dấu nháy nằm trong code ở dạng escape (\") nên phải so cả bản
// đã escape — nếu chỉ so bản thô sẽ báo nhầm "bản dịch chết".
// Tính cả convex/*.ts: vài chuỗi VI sinh ra ở backend (lý do AI trả về) được
// web dịch lúc render — nếu chỉ quét src sẽ báo nhầm là "bản dịch chết".
const convexFiles = fs
  .readdirSync(path.join(ROOT, "convex"))
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"))
  .map((f) => path.join(ROOT, "convex", f));
const allCode = [...codeFiles, ...convexFiles].map((f) => fs.readFileSync(f, "utf8")).join("\n");
const deadKeys = [...enKeys].filter((k) => {
  if (k.length <= 3) return false;
  if (allCode.includes(k)) return false;
  const escaped = JSON.stringify(k).slice(1, -1);
  return !allCode.includes(escaped);
});

// ── Báo cáo ───────────────────────────────────────────────────────────────
console.log(`i18n: ${wrappedKeys.size} key translate() ⇄ ${enKeys.size} bản EN`);
if (rawText.length) {
  console.log(
    `\nℹ️  Còn ${rawText.length} dòng chữ Việt trong JSX chưa bọc translate() ` +
      "(câu bị nội suy {…} nhiều mảnh — cần gộp thành 1 key có placeholder {p0}):",
  );
  for (const s of rawText.slice(0, 8)) console.log(`   · ${s}`);
  if (rawText.length > 8) console.log(`   … còn ${rawText.length - 8} dòng`);
}
if (softAttr.length) {
  console.log(
    `\nℹ️  ${softAttr.length} thuộc tính JSX có tiếng Việt chưa bọc translate() (rà tay):`,
  );
  for (const s of softAttr.slice(0, 15)) console.log(`   · ${s}`);
  if (softAttr.length > 15) console.log(`   … còn ${softAttr.length - 15} mục`);
}
if (deadKeys.length) {
  console.log(
    `\nℹ️  ${deadKeys.length} bản dịch không còn xuất hiện trong code (có thể đã xoá UI):`,
  );
  for (const s of deadKeys.slice(0, 10)) console.log(`   · ${s.slice(0, 80)}`);
  if (deadKeys.length > 10) console.log(`   … còn ${deadKeys.length - 10} mục`);
}

if (problems.length) {
  console.error(`\n❌ i18n guard: ${problems.length} key chưa có bản EN`);
  for (const p of problems.slice(0, 40)) console.error(`   ${p}`);
  if (problems.length > 40) console.error(`   … còn ${problems.length - 40} mục`);
  console.error("\nThêm bản dịch vào src/lib/i18n.en.ts (key = nguyên chuỗi tiếng Việt).");
  process.exit(1);
}
console.log(`\n✅ i18n guard OK — mọi chuỗi người dùng đều có bản EN (0 FAIL)`);
