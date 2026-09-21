#!/usr/bin/env node
/**
 * test-i18n.cjs — khoá hệ đa ngôn ngữ VI/EN/DE (thêm 20/09/2026).
 *
 * Bối cảnh: web trước đây chỉ có tiếng Việt cứng trong JSX. Khi thêm tiếng Anh,
 * ba lỗi cấu trúc đã thật sự xảy ra và đều "im lặng" (UI vẫn chạy, chỉ sai
 * ngôn ngữ), nên phải có test chặn:
 *   1. Chuỗi bọc translate() mà thiếu bản EN → người dùng EN đọc tiếng Việt.
 *   2. Nhãn nằm trong hằng số cấp module (NAV_ITEMS của sidebar) — không bao
 *      giờ được dịch vì eval một lần lúc import.
 *   3. Quên gắn LangProvider, hoặc App không phải consumer → đổi ngôn ngữ
 *      nhưng cây UI không re-render (React bail-out khi element không đổi).
 *   4. Chữ Việt nằm TRỰC TIẾP trong JSX (kể cả trong {…} của biểu thức và trong
 *      nhãn dữ liệu cấp module) — không có translate() nào để dịch. Đợt trước
 *      chỉ rà bằng regex theo dòng nên bỏ sót text node một từ và cả nhóm trong
 *      {"…"}; nay check-i18n.cjs bắt bằng parser TypeScript và FAIL cứng.
 *
 * Ngoài ra khoá: định dạng ngày/giờ theo ngôn ngữ (bug locale rác "vi-VV"),
 * công tắc ngôn ngữ có mặt ở chrome mọi trang, và Convex nhận lang để AI trả
 * lời đúng ngôn ngữ người dùng chọn. Tiếng Đức (DE) phải đủ 100% key EN —
 * thiếu là lỗi cứng (người dùng DE sẽ đọc tiếng Anh nguyên bản).
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let pass = 0;
let fail = 0;
function check(label, cond) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    console.error(`  ❌ ${label}`);
  }
}

// ─── 1. Lõi i18n: API + mặc định + placeholder + locale ─────────────────────
const i18n = read("src/lib/i18n.tsx");
check(
  "i18n.tsx export LangProvider/useT/translate/dateLocale/currentLanguage",
  /export function LangProvider/.test(i18n) &&
    /export function useT/.test(i18n) &&
    /export function translate/.test(i18n) &&
    /export function dateLocale/.test(i18n) &&
    /export function currentLanguage/.test(i18n),
);
check(
  "translate() rơi về chuỗi VI khi thiếu bản dịch (không vỡ UI)",
  /DICTS\[currentLang\]\[s\] \?\? s/.test(i18n) && /DICTS\[lang\]\[s\] \?\? s/.test(i18n),
);
check(
  "Từ điển EN gộp 3 file (i18n.en.ts + i18n.en.panels.ts + i18n.en.labels.ts) — không mất bản dịch",
  /import \{ EN_PANELS \} from "\.\/i18n\.en\.panels"/.test(i18n) &&
    /import \{ EN_LABELS \} from "\.\/i18n\.en\.labels"/.test(i18n) &&
    /const DICTS: Record<Exclude<Lang, "vi">, Record<string, string>> = \{/.test(i18n) &&
    fs.existsSync(path.join(ROOT, "src/lib/i18n.en.panels.ts")) &&
    fs.existsSync(path.join(ROOT, "src/lib/i18n.en.labels.ts")),
);
check("Lưu lựa chọn ngôn ngữ vào localStorage (protogon-lang)", /protogon-lang/.test(i18n));
check("Cập nhật <html lang> khi đổi ngôn ngữ", /document\.documentElement\.lang = lang/.test(i18n));

// ─── 2. Gắn provider + consumer (điều kiện để đổi ngôn ngữ re-render) ──────
const main = read("src/main.tsx");
check("main.tsx bọc app trong LangProvider", /<LangProvider>/.test(main));
check(
  "LangProvider nằm NGOÀI mọi provider khác (dịch được cả màn hình lỗi)",
  main.indexOf("<LangProvider>") < main.indexOf("<ConvexProvider"),
);
const app = read("src/App.tsx");
check(
  "App.tsx là consumer của LangContext (useT) → đổi ngôn ngữ vẽ lại toàn cây",
  /const \{ lang \} = useT\(\);/.test(app),
);
check(
  "TitleSync dịch title route và phụ thuộc lang",
  /translate\(match \? match\[1\] : BASE_TITLE\)/.test(app) &&
    /\}, \[pathname, lang\]\);/.test(app),
);

// ─── 3. Công tắc ngôn ngữ có ở chrome mọi trang ────────────────────────────
const switchSrc = read("src/components/LangSwitch.tsx");
check("LangSwitch dùng useT (tự re-render khi đổi ngôn ngữ)", /useT\(\)/.test(switchSrc));
check(
  "LangSwitch có aria-label + aria-pressed (a11y)",
  /aria-label=\{t\("Ngôn ngữ"\)\}/.test(switchSrc) &&
    /aria-pressed=\{lang === code\}/.test(switchSrc),
);

const OPTIONS_SRC = read("src/components/LangSwitch.tsx");
check(
  "LangSwitch có 3 nút VI/EN/DE",
  /\["vi", "VI"\]/.test(OPTIONS_SRC) &&
    /\["en", "EN"\]/.test(OPTIONS_SRC) &&
    /\["de", "DE"\]/.test(OPTIONS_SRC),
);

const chrome = [
  "src/components/Taskbar.tsx",
  "src/components/landing/Nav.tsx",
  "src/pages/Dashboard.tsx",
  "src/pages/GuildPage.tsx",
  "src/pages/Monitor.tsx",
  "src/pages/Admin.tsx",
  "src/pages/StatsPage.tsx",
  "src/pages/GuildHistory.tsx",
  "src/pages/AuthPage.tsx",
];
for (const f of chrome) {
  const src = read(f);
  check(`${f} có <LangSwitch`, /<LangSwitch/.test(src));
}

// ─── 4. KHÔNG còn nhãn sidebar ở dạng chuỗi thô ────────────────────────────
const guildPage = read("src/pages/GuildPage.tsx");
check(
  "Nhãn NAV_ITEMS được dịch lúc render (translate(item.label))",
  /translate\(item\.label\)/.test(guildPage),
);

// ─── 5. Locale ngày/giờ đi qua dateLocale(), không hardcode ────────────────
const walk = (dir) =>
  fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) return walk(p);
    return /\.(tsx?|jsx?)$/.test(e.name) && !/i18n\.(en|tsx)$/.test(e.name) ? [p] : [];
  });
const srcFiles = walk("src");
const hardcodedLocale = srcFiles.filter((f) => /"vi-VN"|"vi-VV"/.test(read(f)));
check(
  `Không file nào hardcode locale ngày/giờ (còn: ${hardcodedLocale.join(", ") || "không"})`,
  hardcodedLocale.length === 0,
);
check(
  'Bug locale rác "vi-VV" ở WebhookPanel đã hết',
  !read("src/components/dashboard/WebhookPanel.tsx").includes("vi-VV"),
);

// ─── 6. Chat Haimiya: phần giới thiệu + chrome phải có bản EN ──────────────
const en = read("src/lib/i18n.en.ts");
const kb = read("src/lib/haimiya.ts");
const greeting = kb.match(/export const GREETING\s*=\s*\n?\s*"((?:[^"\\]|\\.)*)"/)[1];
check(
  "GREETING của Haimiya có bản EN (phần giới thiệu đầu)",
  en.includes(JSON.parse(`"${greeting}"`)),
);
for (const m of kb
  .match(/export const QUICK_QUESTIONS\s*=\s*\[([\s\S]*?)\]/)[1]
  .matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
  check(
    `Câu hỏi gợi ý có bản EN: ${JSON.parse(`"${m[1]}"`).slice(0, 40)}`,
    en.includes(JSON.parse(`"${m[1]}"`)),
  );
}
check(
  "Chat dịch tin nhắn + gợi ý lúc render (đổi ngôn ngữ cập nhật ngay)",
  /translate\(m\.text\)/.test(read("src/components/HaimiyaChat.tsx")) &&
    /translate\(s\)/.test(read("src/components/HaimiyaChat.tsx")),
);

// ─── 7. Backend AI nhận ngôn ngữ người dùng chọn ───────────────────────────
const convexHaimiya = read("convex/haimiya.ts");
check(
  "haimiya.ask nhận arg lang (vi|en|de) — không phá call cũ vì optional",
  /lang: v\.optional\(v\.union\(v\.literal\("vi"\), v\.literal\("en"\), v\.literal\("de"\)\)\)/.test(
    convexHaimiya,
  ),
);
check(
  "System prompt có placeholder {LANG} và được thay theo lựa chọn",
  /Trả lời bằng \{LANG\}/.test(convexHaimiya) &&
    /SYSTEM_PROMPT\.replace\(\s*"\{LANG\}"/.test(convexHaimiya),
);
check(
  "HaimiyaChat gửi currentLanguage() lên Convex",
  /lang: currentLanguage\(\)/.test(read("src/components/HaimiyaChat.tsx")),
);

// ─── 8. Lá chắn CI: mọi chuỗi người dùng phải có bản EN ───────────────────
// Bắt bằng parser TypeScript (không phải regex theo dòng) → phủ cả text node
// nhiều dòng, text node một từ, góc {"…"} và {cond ? "A" : "B"}.
const guardSrc = read("scripts/check-i18n.cjs");
check(
  "check-i18n.cjs phát hiện chữ Việt bằng parser TypeScript (ts.isJsxText)",
  /ts\.isJsxText/.test(guardSrc) && /CHƯA DỊCH/.test(guardSrc),
);
check(
  "check-i18n.cjs đọc cả 2 bộ từ điển EN + DE (không bỏ sót ngôn ngữ)",
  /i18n\.en\.panels\.ts/.test(guardSrc) &&
    /i18n\.de\.labels\.ts/.test(guardSrc) &&
    /THIẾU DE/.test(guardSrc),
);
check(
  "Không còn chữ Việt chưa bọc translate() trong JSX (0 mục)",
  execFileSync("node", [path.join(__dirname, "check-i18n.cjs"), "--all"], {
    cwd: ROOT,
    encoding: "utf8",
  }).includes("0 FAIL"),
);

let guardOk = false;
let guardOut;
try {
  execFileSync("node", [path.join(__dirname, "check-i18n.cjs")], {
    cwd: ROOT,
    encoding: "utf8",
  });
  guardOk = true;
} catch (e) {
  guardOut = `${e.stdout || ""}\n${e.stderr || ""}`;
}
check("scripts/check-i18n.cjs xanh (không key nào thiếu bản EN/DE)", guardOk);
if (!guardOk) console.error(String(guardOut).split("\n").slice(0, 12).join("\n"));

console.log(`\nKết quả i18n suite: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
