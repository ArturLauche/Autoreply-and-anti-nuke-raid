#!/usr/bin/env node
// Script TẠM (cặp với _i18n-dead-lines.cjs): XOÁ entry chết khỏi từ điển.
// Dùng đúng bộ lọc của _i18n-dead-lines.cjs để không xoá oan: key chết = key EN
// không còn xuất hiện trong code (src/ + convex/), key mồ côi DE = key không có
// bản EN. Sau khi chạy, `node scripts/check-i18n.cjs` phải hết mục ℹ️.
//
// Cách hoạt động: đọc từng file từ điển, parse entry 1–2 dòng (key + value),
// giữ nguyên mọi dòng khác (comment, export, cấu trúc) — chỉ lược bỏ đúng entry
// khớp điều kiện xoá. Backup file cũ sang /tmp trước khi ghi để đối chiếu.
//
// Chạy: node scripts/_i18n-dead-remove.cjs [--dry]   (--dry: chỉ in số đếm)

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const DICT_RE = /^lib[\\/]i18n(\.en|\.de)?(\.(panels|labels))?\.tsx?$/;
const dry = process.argv.includes("--dry");

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

/**
 * Vị trí entry (key, mở/đóng dòng value) trong file từ điển.
 *
 * Hai dạng entry 2 dòng đều hợp lệ trong repo này:
 *   a. dòng key kết thúc BẰNG DẤU PHẲY nhưng value vẫn nằm dòng dưới? — KHÔNG,
 *      dòng key có phẩy là entry 1 dòng trọn vẹn;
 *   b. dòng key kết thúc bằng ":" (không phẩy) → dòng kế là value (kết thúc phẩy).
 * An toàn quan trọng nhất: dòng value PHẢI bắt đầu bằng 4+ spaces (cách thụt lề
 * chuẩn của Prettier) VÀ PHẢI là một string/number kết thúc phẩy — nếu dòng kế
 * trông giống một KEY mới (dạng `  "…":`) thì entry hiện tại là 1 dòng thật,
 * và cứ tiếp tục duyệt (đừng nuốt dòng kế vào entry).
 * Đã từng nuốt nhầm: xoá entry "Khi bot xác nhận…" làm rơi value của nó nhưng
 * giữ lại dòng key kế tiếp không có value → tsc vỡ (TS1005). Backup + tsc sau
 * mỗi lượt là bắt buộc.
 */
function parseEntries(lines) {
  const out = [];
  const entryRe = /^  ("((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([A-Za-z][A-Za-z0-9_]*))\s*:/;
  for (let i = 0; i < lines.length; i++) {
    const m = entryRe.exec(lines[i]);
    if (!m) continue;
    const rawKey = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4];
    const key = unescapeJs(rawKey);
    // entry 2 dòng: dòng key kết thúc bằng ":" (không phẩy) → dòng kế là value.
    let end = i;
    if (!/,\s*$/.test(lines[i])) {
      const next = lines[i + 1] || "";
      const nextIsKey = entryRe.test(next);
      if (!nextIsKey && /^\s{4}("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[A-Za-z0-9_\-+.]+)/.test(next) && /,\s*$/.test(next)) {
        end = i + 1;
      } else {
        continue; // cấu trúc lạ — bỏ qua, không đụng
      }
    }
    out.push({ start: i, end, key });
    i = end;
  }
  return out;
}

const keysOf = (name) => {
  const set = new Set();
  for (const m of parseEntries(fs.readFileSync(path.join(SRC, "lib", name), "utf8").split("\n"))) {
    set.add(m.key);
  }
  return set;
};
// EN đầy đủ nằm ở 3 file (giống _i18n-dead-lines.cjs) — thiếu file nào là mọi
// key DE tương ứng bị coi là mồ côi và xoá oan cả file.
const enKeys = new Set([
  ...keysOf("i18n.en.ts"),
  ...keysOf("i18n.en.panels.ts"),
  ...keysOf("i18n.en.labels.ts"),
]);

const isDead = (k) =>
  k.length > 3 && !allCode.includes(k) && !allCode.includes(JSON.stringify(k).slice(1, -1));

const FILES = [
  "i18n.en.ts",
  "i18n.en.panels.ts",
  "i18n.en.labels.ts",
  "i18n.de.ts",
  "i18n.de.panels.ts",
  "i18n.de.labels.ts",
];

let totalRemoved = 0;
for (const file of FILES) {
  const p = path.join(SRC, "lib", file);
  const lines = fs.readFileSync(p, "utf8").split("\n");
  const isEn = file.startsWith("i18n.en");
  const entries = parseEntries(lines);
  const remove = new Set();
  for (const e of entries) {
    if (isEn) {
      if (isDead(e.key)) {
        remove.add(e.start);
        if (e.end !== e.start) remove.add(e.end); // entry 2 dòng: xoá cả dòng value
      }
    } else if (!enKeys.has(e.key)) {
      remove.add(e.start); // mồ côi DE
      if (e.end !== e.start) remove.add(e.end);
    }
  }
  if (remove.size === 0) {
    console.log(`${file}: 0 entry`);
    continue;
  }
  const kept = [];
  for (let i = 0; i < lines.length; i++) {
    if (!remove.has(i)) kept.push(lines[i]);
  }
  if (!dry) {
    fs.copyFileSync(p, `/tmp/${file}.bak`);
    fs.writeFileSync(p, kept.join("\n"));
    // Kiểm ngay sau khi ghi: file phải vẫn parse được bằng esbuild (tsc/CI sẽ
    // bắt nếu hỏng, nhưng fail-fast tại đây đỡ phải hồi phục nhiều file).
    const { execFileSync } = require("child_process");
    try {
      execFileSync("bunx", ["esbuild", p, "--loader:.ts=ts", "--bundle=false"], { stdio: "pipe" });
    } catch (e) {
      fs.copyFileSync(`/tmp/${file}.bak`, p);
      throw new Error(`${file} hỏng sau khi xoá (đã khôi phục từ backup): ${e.stderr || e.message}`);
    }
  }
  totalRemoved += remove.size;
  console.log(`${file}: xoá ${remove.size}/${entries.length} entry`);
}
console.log(dry ? `(dry-run) tổng sẽ xoá: ${totalRemoved}` : `TỔNG ĐÃ XOÁ: ${totalRemoved}`);
