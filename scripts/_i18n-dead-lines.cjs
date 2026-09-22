// Script TẠM: in nguyên văn ENTRY cần xoá khỏi từ điển, theo từng khối nhỏ
// (công cụ patch chỉ áp được ~30 thay thế mỗi lượt).
//
//  --file=<tên>   i18n.en.ts | i18n.en.panels.ts | i18n.de.ts | i18n.de.panels.ts
//  --from=<n> --to=<n>  khoảng entry (0-based, nửa mở) để chia khối
//  --orphan-de    thay vì "key chết", in entry DE mồ côi (không có bản EN)
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const DICT_RE = /^lib[\\/]i18n(\.en|\.de)?(\.(panels|labels))?\.tsx?$/;
const arg = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(tsx?|jsx?)$/.test(e.name) ? [p] : [];
  });
}
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const codeFiles = walk(SRC).filter((p) => !DICT_RE.test(rel(p).replace(/^src[\\/]/, "")));
const convexFiles = fs
  .readdirSync(path.join(ROOT, "convex"))
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"))
  .map((f) => path.join(ROOT, "convex", f));
const allCode = [...codeFiles, ...convexFiles].map((f) => fs.readFileSync(f, "utf8")).join("\n");

function unescapeJs(raw) {
  try {
    return JSON.parse(`"${raw}"`);
  } catch {
    return raw;
  }
}
const DICT_KEY_RE = /^\s{2}(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s:]+))\s*:/gm;
const dictKey = (m) =>
  m[1] !== undefined ? unescapeJs(m[1]) : m[2] !== undefined ? unescapeJs(m[2]) : m[3];

const keysOf = (names) => {
  const set = new Set();
  for (const name of names) {
    const src = fs.readFileSync(path.join(SRC, "lib", name), "utf8");
    for (const m of src.matchAll(DICT_KEY_RE)) set.add(dictKey(m));
  }
  return set;
};
const enKeys = keysOf(["i18n.en.ts", "i18n.en.panels.ts", "i18n.en.labels.ts"]);

const isDead = (k) =>
  k.length > 3 && !allCode.includes(k) && !allCode.includes(JSON.stringify(k).slice(1, -1));

/** Entry (1-2 dòng) của những key thoả điều kiện `wanted`. */
function entries(file, wanted) {
  const lines = fs.readFileSync(path.join(SRC, "lib", file), "utf8").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s{2}(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*:/.exec(lines[i]);
    if (!m) continue;
    const k = dictKey(m);
    if (!wanted(k)) continue;
    const entry = [lines[i]];
    if (!/,\s*$/.test(lines[i]) && /^\s{4}\S/.test(lines[i + 1] || "")) entry.push(lines[i + 1]);
    out.push(entry);
    i += entry.length - 1;
  }
  return out;
}

const file = arg("file", "i18n.en.ts");
const orphanDe = process.argv.includes("--orphan-de");
const wanted = orphanDe
  ? (k) => !enKeys.has(k) // DE mồ côi: key không có bản EN
  : (k) => enKeys.has(k) && isDead(k); // key chết theo EN

let rows = entries(file, wanted);
// i18n.*.de.* : bản DE của key chết (đối xứng), hoặc entry mồ côi.
const from = Number(arg("from", 0));
const to = Number(arg("to", rows.length));
const total = rows.length;
rows = rows.slice(from, to);
console.log(`# ${file} · ${orphanDe ? "mồ côi (DE thừa)" : "bản dịch chết"} · tổng ${total} entry · in [${from},${to})`);
for (const r of rows) console.log(r.join("\n"));
