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
 *       node scripts/check-i18n.cjs --all   # in HẾT danh sách việc còn lại
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
const enKeys = new Set();
for (const name of ["i18n.en.ts", "i18n.en.panels.ts"]) {
  const p = path.join(SRC, "lib", name);
  if (!fs.existsSync(p)) continue;
  const enSrc = fs.readFileSync(p, "utf8");
  for (const m of enSrc.matchAll(
    /^\s{2}(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s:]+))\s*:/gm,
  )) {
    enKeys.add(m[1] !== undefined ? unescapeJs(m[1]) : m[2] !== undefined ? m[2] : m[3]);
  }
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
  // Chuỗi nháy ĐƠN (thường dùng khi key chứa dấu ") — bản regex cũ bỏ sót
  // nhóm này nên key nháy đơn lọt lưới hoàn toàn.
  for (const m of src.matchAll(/(?<![A-Za-z0-9_$.])(?:translate|t)\(\s*'((?:[^'\\\n]|\\.)*)'/g)) {
    const key = unescapeJs(m[1].replace(/\\'/g, "'"));
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

// ── 3. Chữ Việt còn nằm TRỰC TIẾP trong JSX (text node) hoặc trong thuộc
// tính dạng chuỗi → chưa bọc translate(), người dùng EN sẽ đọc tiếng Việt.
//
// Phát hiện bằng PARSER THẬT (typescript đã có trong devDependency) chứ không
// dùng regex theo dòng: JsxText mới là chữ hiển thị thật, còn comment / code
// JS / chuỗi trong translate() đều không phải JsxText nên KHÔNG báo nhầm.
// Bản regex cũ bỏ sót text node một từ đứng riêng dòng (nút "Backup ngay")
// và bỏ sót text node nhiều dòng — đúng kiểu lọt âm thầm cần chặn.
const ts = require("typescript");
const unresolved = [];
for (const file of codeFiles.filter((f) => /\.(tsx|jsx)$/.test(f))) {
  const source = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.JSX,
  );
  const lineOf = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  // Miễn trừ có ghi chú: dữ liệu nhãn được dịch LÚC RENDER (translate(label))
  // nên chuỗi gốc còn tiếng Việt là đúng ý — đánh dấu `// i18n-ok: <lý do>`
  // trong vòng 2 dòng phía trên để script không báo nhầm.
  const sourceLines = source.split("\n");
  const suppressed = (node, line) => {
    // 1) Mảng/object chứa node có ghi chú i18n-ok → cả khối được miễn trừ
    //    (nhãn dữ liệu dịch lúc render, ví dụ translate(item.label)).
    //    Duyệt MỌI mảng/object bao ngoài (tuple lồng trong mảng lớn vẫn tính).
    let sawContainer = false;
    for (let p = node.parent; p; p = p.parent) {
      if (ts.isArrayLiteralExpression(p) || ts.isObjectLiteralExpression(p)) {
        sawContainer = true;
        if (p.getText(sf).includes("i18n-ok")) return true;
      }
    }
    if (sawContainer) return false;
    // 2) Không thuộc mảng/object: dùng ghi chú gần đó (±2 dòng phía trên).
    return sourceLines.slice(Math.max(0, line - 3), line + 1).some((l) => l.includes("i18n-ok"));
  };
  const flag = (node, kind, value) => {
    const line = lineOf(node.getStart(sf));
    if (suppressed(node, line)) return;
    unresolved.push({
      file: rel(file),
      line,
      kind,
      text: value.replace(/\s+/g, " ").trim().slice(0, 70),
    });
  };
  const isTranslateCall = (node) =>
    ts.isCallExpression(node) && /(^|\.)(translate|t)$/.test(node.expression.getText(sf));
  // `inExpr` = đang ở trong một {…} của JSX. Chuỗi VI nằm ở đó vẫn hiển thị
  // ({cond ? "Bật" : "Tắt"}, {"Trực tuyến"}, ` · lần cuối ${x}`) nhưng JSXText
  // không bắt được — đúng nhóm "bấm nút không đổi ngôn ngữ" người dùng thấy.
  const visit = (node, inExpr) => {
    if (isTranslateCall(node)) return; // cả cây đối số đã được dịch
    if (ts.isJsxText(node)) {
      const raw = node.getText(sf);
      if (VIET.test(raw)) flag(node, "text", raw);
      return;
    }
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const value = node.initializer.text;
      if (VIET.test(value)) flag(node, `attr ${node.name.getText(sf)}`, value);
    }
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && inExpr) {
      // Bỏ qua giá trị thuộc tính JSX — nhánh JsxAttribute đã xử lý riêng.
      const isAttrValue = ts.isJsxAttribute(node.parent);
      if (!isAttrValue && VIET.test(node.text)) flag(node, "expr", node.text);
    }
    if (inExpr && ts.isTemplateExpression(node)) {
      if (VIET.test(node.head.text)) flag(node, "expr", node.head.text);
      for (const span of node.templateSpans)
        if (VIET.test(span.literal.text)) flag(span.literal, "expr", span.literal.text);
    }
    const next = ts.isJsxExpression(node) ? true : inExpr;
    ts.forEachChild(node, (child) => visit(child, next));
  };
  visit(sf, false);
}
const rawText = unresolved.filter((u) => u.kind === "text");
const exprText = unresolved.filter((u) => u.kind === "expr");
const softAttr = unresolved.filter((u) => u.kind.startsWith("attr "));
for (const u of unresolved) problems.push(`CHƯA DỊCH (${u.kind}): ${u.file}:${u.line} — ${u.text}`);

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
  const rawShow = process.argv.includes("--all") ? rawText : rawText.slice(0, 8);
  for (const s of rawShow) console.log(`   · ${s.file}:${s.line} — ${s.text}`);
  if (rawShow.length < rawText.length)
    console.log(`   … còn ${rawText.length - rawShow.length} dòng`);
}
if (exprText.length) {
  console.log(
    `\nℹ️  ${exprText.length} chuỗi Việt nằm trong biểu thức JSX {} chưa bọc translate() ` +
      "(nhãn điều kiện, template literal, chuỗi hiển thị trực tiếp):",
  );
  const exprShow = process.argv.includes("--all") ? exprText : exprText.slice(0, 8);
  for (const s of exprShow) console.log(`   · ${s.file}:${s.line} — ${s.text}`);
  if (exprShow.length < exprText.length)
    console.log(`   … còn ${exprText.length - exprShow.length} dòng`);
}
if (softAttr.length) {
  console.log(
    `\nℹ️  ${softAttr.length} thuộc tính JSX có tiếng Việt chưa bọc translate() (rà tay):`,
  );
  const attrShow = process.argv.includes("--all") ? softAttr : softAttr.slice(0, 15);
  for (const s of attrShow) console.log(`   · ${s.file}:${s.line} — ${s.text}`);
  if (attrShow.length < softAttr.length)
    console.log(`   … còn ${softAttr.length - attrShow.length} mục`);
}
if (deadKeys.length) {
  console.log(
    `\nℹ️  ${deadKeys.length} bản dịch không còn xuất hiện trong code (có thể đã xoá UI):`,
  );
  for (const s of deadKeys.slice(0, 10)) console.log(`   · ${s.slice(0, 80)}`);
  if (deadKeys.length > 10) console.log(`   … còn ${deadKeys.length - 10} mục`);
}

if (problems.length) {
  console.error(`\n❌ i18n guard: ${problems.length} mục chưa dịch / thiếu bản EN`);
  const all = process.argv.includes("--all");
  for (const p of all ? problems : problems.slice(0, 40)) console.error(`   ${p}`);
  if (!all && problems.length > 40)
    console.error(`   … còn ${problems.length - 40} mục (--all để in hết)`);
  console.error("\nThêm bản dịch vào src/lib/i18n.en.ts (key = nguyên chuỗi tiếng Việt).");
  process.exit(1);
}
console.log(`\n✅ i18n guard OK — mọi chuỗi người dùng đều có bản EN (0 FAIL)`);
