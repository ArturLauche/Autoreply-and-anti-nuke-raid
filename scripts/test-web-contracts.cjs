#!/usr/bin/env node
/**
 * test-web-contracts.cjs — lá chắn hợp đồng dashboard web (20/09/2026).
 *
 * Chặn tái diễn 3 bug thật tìm thấy khi scan src/:
 *  1. OverviewPanel đọc token thô từ localStorage thay vì getSessionToken()
 *     → remember-mode gửi blob JSON {"t","e"} làm token (backend từ chối),
 *     session-mode gửi "" → khối "Hoạt động chống nuke gần đây" luôn trắng.
 *     Quy tắc: CHỈ src/lib/discord.ts được chạm storage thô của token.
 *  2. Nút "Hỏi Haimiya" ở Landing dispatch event "haimiya-open" nhưng Landing
 *     không mount <HaimiyaChat/> → bấm không có gì xảy ra (nút chết).
 *     Quy tắc: trang nào có chỗ dispatch thì phải mount HaimiyaChat.
 *  3. AnalyticsPanel + AuditLogPanel chết (không ai import) mà vẫn nằm trong
 *     repo, gây hiểu nhầm còn dùng được.
 *     Quy tắc: mọi panel trong components/dashboard/ phải được import ở đâu đó.
 *
 * Hermetic: chỉ đọc source bằng regex/fs, không cần bundler hay browser.
 * Chạy: node scripts/test-web-contracts.cjs
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");

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

/** Đọc mọi file .tsx/.ts trong src/, trả về Map<đường dẫn tương đối, nội dung>. */
function readSrc() {
  const out = new Map();
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(e.name)) {
        out.set(path.relative(SRC, full).replace(/\\/g, "/"), fs.readFileSync(full, "utf8"));
      }
    }
  })(SRC);
  return out;
}

const files = readSrc();

// ─── 1. Kỷ luật token phiên ────────────────────────────────────────────────
// Token lưu 2 dạng (discord.ts:setSessionToken): sessionStorage = token thô
// (không "Lưu đăng nhập"), localStorage = JSON {"t","e"} (có lưu, hết hạn 7
// ngày). Chỉ getSessionToken() biết bóc 2 dạng này — đọc thô ở nơi khác là bug.
const RAW_TOKEN_RE = /getItem\(\s*(SESSION_TOKEN_KEY|"wio_session_token")\s*\)/;
const rawReaders = [...files.entries()]
  .filter(([rel, src]) => rel !== "lib/discord.ts" && RAW_TOKEN_RE.test(src))
  .map(([rel]) => rel);
check(
  "chỉ src/lib/discord.ts được đọc storage thô của token phiên",
  rawReaders.length === 0,
  rawReaders.length ? `vi phạm: ${rawReaders.join(", ")}` : "",
);

const overview = files.get("components/dashboard/OverviewPanel.tsx") ?? "";
check(
  "OverviewPanel lấy token qua getSessionToken()",
  /getSessionToken\(\)/.test(overview) && !RAW_TOKEN_RE.test(overview),
  "phải import { getSessionToken } từ ../../lib/discord, không localStorage.getItem thô",
);

// ─── 2. Nút Haimiya không được chết ─────────────────────────────────────────
// Mọi chỗ dispatch "haimiya-open" đều nằm trên cây render của Landing
// (Landing.tsx + sections.tsx chỉ Landing dùng) → Landing phải mount chat.
const dispatchers = [...files.entries()]
  .filter(([, src]) => src.includes('"haimiya-open"'))
  .map(([rel]) => rel);
const sectionUsers = [...files.entries()]
  .filter(([, src]) => /from\s+["']\.\.\/components\/landing\/sections["']/.test(src))
  .map(([rel]) => rel);
check(
  "sections.tsx (chứa nút Haimiya) chỉ dùng ở Landing",
  sectionUsers.length === 1 && sectionUsers[0] === "pages/Landing.tsx",
  `đang dùng ở: ${sectionUsers.join(", ") || "(không đâu)"}`,
);
const landing = files.get("pages/Landing.tsx") ?? "";
check(
  "Landing mount <HaimiyaChat/> để hứng event haimiya-open",
  /<HaimiyaChat[\s/>]/.test(landing),
  `dispatch ở: ${dispatchers.join(", ")}`,
);

// ─── 3. Không panel chết ────────────────────────────────────────────────────
// Mọi file trong components/dashboard/ phải được import bởi ≥1 file khác
// trong src/ (trực tiếp từ page hay gián tiếp qua panel khác như HiddenPanel).
const panels = [...files.keys()].filter((rel) => rel.startsWith("components/dashboard/"));
const dead = panels.filter((panel) => {
  const base = path.basename(panel, ".tsx");
  // Chấp nhận cả import tĩnh (from "...") lẫn lazy (import("...")).
  const re = new RegExp(`(?:from\\s+|import\\()\\s*["'][^"']*${base}\\.?["']`);
  return ![...files.entries()].some(([rel, src]) => rel !== panel && re.test(src));
});
check(
  "mọi dashboard panel đều được import ở đâu đó (không panel chết)",
  dead.length === 0,
  dead.length ? `chết: ${dead.join(", ")}` : "",
);

// ─── 4. Khu vực riêng của chủ bot KHÔNG được rò rỉ ra trang công khai ──────
// Bug thật (22/09): trang chủ có khối "Khu vực riêng tư · chỉ chủ sở hữu bot" +
// "Một số khả năng đặc biệt…" quảng cáo sự tồn tại/phạm vi của tính năng ẩn,
// còn Haimiya thì để sẵn gợi ý "Cách đặt mật khẩu tính năng ẩn" và trả lời
// liệt kê tính năng ẩn (reaction role, giveaway, DM, branding) cho MỌI người.
const sections = files.get("components/landing/sections.tsx") ?? "";
check(
  "trang chủ không còn khối quảng cáo khu vực riêng của chủ bot",
  !/HiddenFeatures/.test(sections) && !/Khu vực riêng tư/.test(sections),
  "sections.tsx vẫn còn khối Khu vực riêng tư/HiddenFeatures",
);
check("Landing không import/render khối khu vực riêng nữa", !/HiddenFeatures/.test(landing));

const haimiya = fs.readFileSync(path.join(SRC, "lib/haimiya.ts"), "utf8");
const ownerAnswer = haimiya.match(/const OWNER_ONLY_ANSWER =\s*\n?\s*"([\s\S]*?)";/);
check("Haimiya có MỘT câu trả lời dùng chung cho khu vực riêng của chủ bot", !!ownerAnswer);
check(
  "câu trả lời đó không liệt kê tính năng ẩn (reaction role/giveaway/DM/giao diện)",
  !!ownerAnswer && !/(reaction|giveaway|\bDM\b|giao diện|tùy chỉnh|branding)/i.test(ownerAnswer[1]),
  ownerAnswer ? ownerAnswer[1].slice(0, 120) : "",
);
check(
  "5 topic thuộc khu vực riêng đều trả về OWNER_ONLY_ANSWER",
  (haimiya.match(/answer: OWNER_ONLY_ANSWER,/g) ?? []).length === 5,
  `đang có ${(haimiya.match(/answer: OWNER_ONLY_ANSWER,/g) ?? []).length}/5`,
);
check(
  "gợi ý/kho kiến thức không còn hướng dẫn mật khẩu tính năng ẩn",
  !haimiya.includes("Cách đặt mật khẩu tính năng ẩn"),
);

// ─── 5. Cấu hình kênh log chỉ có MỘT nơi ────────────────────────────────────
// Bug thiết kế (22/09): 3 chỗ chọn kênh log (kênh log chung, kênh log mod,
// kênh hình phạt) ghi đè nhau → cùng một case có thể bị đẩy vào hai kênh.
// Quy tắc: Settings là nơi chọn kênh duy nhất; Moderation chỉ ĐỌC lại.
const settings = files.get("components/dashboard/SettingsPanel.tsx") ?? "";
const moderation = files.get("components/dashboard/ModerationPanel.tsx") ?? "";
check(
  "Moderation không tự chọn kênh log nữa (chỉ đọc lại từ Cài đặt)",
  /Cài đặt → Kênh log/.test(moderation) &&
    !/punishNoticeChannelId:\s*channelId\s*===/.test(moderation),
);
check(
  "Moderation dọn kênh hình phạt riêng kiểu cũ khi lưu (một nguồn duy nhất)",
  /punishNoticeChannelId: ""/.test(moderation),
);
check(
  "Settings có đủ 2 lựa chọn kênh log (chung + hành động mod, tùy chọn)",
  /"Kênh log chung"/.test(settings) && /"Kênh log hành động mod \(tùy chọn\)"/.test(settings),
);
check("cấu hình kênh log nói rõ không nhân đôi log", /không nhân đôi log/.test(settings));
check(
  "không còn nhãn UI nhắc thương hiệu bot khác trong panel mod",
  !/kiểu Carl-bot/.test(files.get("components/dashboard/ModerationPanel.tsx") ?? "") &&
    !/kiểu Carl-bot/.test(files.get("components/dashboard/ModActionsPanel.tsx") ?? ""),
);

// ─── 6. Trang pháp lý (Terms / Privacy / Data deletion) ────────────────────
// Discord chỉ xác minh bot khi có URL RIÊNG, công khai, không cần đăng nhập cho
// Terms of Service và Privacy Policy. Ba luật dưới đây giữ chúng luôn tồn tại,
// luôn công khai và luôn tới được từ footer.
const appSrc = fs.readFileSync(path.join(SRC, "App.tsx"), "utf8");
const LEGAL_SLUGS = ["terms", "privacy", "data-deletion"];
check(
  "App.tsx lazy-import LegalPage (trang pháp lý dùng chung 1 component)",
  /const LegalPage = lazy\(\(\) => import\("\.\/pages\/LegalPage"\)\)/.test(appSrc),
);
for (const slug of LEGAL_SLUGS) {
  check(
    `Route /${slug} tồn tại và KHÔNG bọc RequireAuth (khách vẫn đọc được)`,
    new RegExp(`path="/${slug}"[^>]*<LegalPage slug="${slug}" />`).test(appSrc),
  );
}
check(
  '3 route pháp lý đứng trước catch-all path="*" (không bị 404 nuốt)',
  appSrc.indexOf('path="*"') > appSrc.indexOf('path="/data-deletion"'),
);

const footerSrc = fs.readFileSync(path.join(SRC, "components/landing/Footer.tsx"), "utf8");
for (const slug of LEGAL_SLUGS) {
  check(`Footer có liên kết tới /${slug}`, new RegExp(`to="/${slug}"`).test(footerSrc));
}

// Nội dung 3 văn bản × 3 ngôn ngữ: cấu trúc phải đủ (cổng 3f của
// check-i18n.cjs kiểm sâu theo từng đường dẫn; ở đây khoá mức thô để tránh
// trường hợp ai đó xoá nguyên một ngôn ngữ khỏi module).
const legalContent = fs.readFileSync(path.join(SRC, "lib/legalContent.ts"), "utf8");
check(
  "legalContent.ts có marker @i18n-content (điều kiện để cổng 3f kiểm cấu trúc)",
  legalContent.includes("@i18n-content"),
);
for (const lang of ["vi", "en", "de"]) {
  const blocks = legalContent.match(new RegExp(`const ${lang.toUpperCase()}: LegalDoc\\[\\]`, "g"));
  check(`legalContent.ts có bộ văn bản ${lang.toUpperCase()}`, !!blocks && blocks.length === 1);
}
for (const slug of LEGAL_SLUGS) {
  const hits = legalContent.split(`slug: "${slug}"`).length - 1;
  check(`văn bản "${slug}" có đủ 3 bản ngôn ngữ`, hits === 3, `đang có ${hits}/3`);
}

// Sitemap: URL pháp lý phải công khai cho công cụ tìm kiếm + trình xác minh.
const sitemap = fs.readFileSync(path.join(ROOT, "public/sitemap.xml"), "utf8");
for (const slug of LEGAL_SLUGS) {
  check(`sitemap.xml có ${slug}`, sitemap.includes(`/${slug}<`));
}

// ─── 7. Không quảng cáo thương hiệu bot khác trong chuỗi người dùng thấy ───
// Bug copy (22/09): 4 chuỗi UI gọi tên một bot đối thủ ("kiểu Carl-bot") — vừa
// hạ uy tín sản phẩm vừa nhập nhằng nguồn gốc. Đổi sang mô tả bằng chính tính
// năng. Luật: chuỗi hiển thị (translate("…") trong src/) không nhắc thương hiệu
// bot khác; từ điển là dữ liệu nên chỉ kiểm phần CODE.
const BOT_BRANDS = /Carl-?bot|MEE6|Dyno|ProBot/i;
const brandHits = [...files.entries()]
  .filter(([rel]) => rel !== "lib/i18n.en.ts" && rel !== "lib/i18n.de.ts")
  .flatMap(([rel, src]) =>
    [...src.matchAll(/translate\(\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g)]
      .filter((m) => BOT_BRANDS.test(m[1]))
      .map((m) => `${rel} — ${m[1].slice(0, 50)}`),
  );
check(
  "không còn chuỗi UI gọi tên bot khác (Carl-bot/MEE6/Dyno/ProBot)",
  brandHits.length === 0,
  brandHits.join(" | "),
);

// ─── 8. Tương phản: không dùng chữ trắng trên nền sáng ─────────────────────
// Bug thật (22/09): khối "Khóa kênh khi raid" ở trang chủ dùng text-white /
// bg-white/5 trong theme SÁNG → chữ trắng trên nền trắng, đọc không ra gì.
// Luật: trong sections.tsx, chữ phải dùng token theme (text-foreground /
// text-muted-foreground), không hardcode text-white.
check(
  "sections.tsx không hardcode text-white (chữ trắng trên nền sáng = vô hình)",
  !/(?<![:\w-])text-white(?![\w/])/.test(sections),
  "dùng text-foreground / text-muted-foreground theo token theme",
);

// ─── 9. Hợp đồng UI/production mới: không để regression âm thầm quay lại ─────
const requireAuth = files.get("components/RequireAuth.tsx") ?? "";
check(
  "RequireAuth chuyển hướng ngay khi chưa có token (không kẹt loading vô hạn)",
  /if \(!token\)[\s\S]*<Navigate/.test(requireAuth),
);
check(
  "App lazy-load Landing như các route nặng khác",
  /const Landing = lazy\(\(\) => import\("\.\/pages\/Landing"\)\)/.test(appSrc),
);
const seo = files.get("lib/seo.ts") ?? "";
check(
  "App có đồng bộ metadata/canonical/noindex theo route",
  /sync(Route|Document)Metadata/.test(appSrc) && /noindex/.test(seo),
);
check(
  "SEO dùng origin domain đang phục vụ sau hydration",
  /activeSiteUrl/.test(seo) && /window\.location\.origin/.test(seo),
);
const moduleCard = files.get("components/dashboard/ModuleCard.tsx") ?? "";
check("ModuleCard không dùng div role=button thiếu keyboard", !/role="button"/.test(moduleCard));
const multiSelect = files.get("components/ui/multi-select.tsx") ?? "";
check(
  "MultiSelect không nest button trong button",
  !/<button[\s\S]{0,450}<button/.test(multiSelect),
);
const haimiyaChat = files.get("components/HaimiyaChat.tsx") ?? "";
check(
  "Haimiya có semantics dialog + focus/Escape contract",
  /role="dialog"/.test(haimiyaChat) && /aria-modal/.test(haimiyaChat) && /Escape/.test(haimiyaChat),
);
check(
  "Haimiya message ID không reset mỗi render",
  /msgSeqRef = useRef\(0\)/.test(haimiyaChat) && /msgSeqRef\.current\+\+/.test(haimiyaChat),
);
const rootBoundary = files.get("components/RootErrorBoundary.tsx") ?? "";
const panelBoundary = files.get("components/PanelErrorBoundary.tsx") ?? "";
check(
  "error boundary không render raw backend exception cho người dùng",
  !/msg\.slice\(/.test(rootBoundary) && !/msg\.slice\(/.test(panelBoundary),
);
const welcomePanel = files.get("components/dashboard/WelcomePanel.tsx") ?? "";
check(
  "Welcome image URL mapping đủ card background slots",
  /welcomeCardBackground[\s\S]{0,700}goodbyeCardBackground/.test(welcomePanel),
);
const verifyPanel = files.get("components/dashboard/VerifyPanel.tsx") ?? "";
check(
  "Verify dùng timer độc lập cho từng field",
  /timers?Ref|fieldTimers|Record<string,.*setTimeout/.test(verifyPanel),
);
const settingsPanel = files.get("components/dashboard/SettingsPanel.tsx") ?? "";
check(
  "DiscordCallback không phụ thuộc public-config để xử lý code",
  !/usePublicConfig|configLoading|configError/.test(files.get("pages/DiscordCallback.tsx") ?? ""),
);
check(
  "MultiSelect có combobox/listbox semantics và input ngoài listbox",
  /aria-haspopup="listbox"/.test(multiSelect) &&
    /role="listbox"/.test(multiSelect) &&
    /aria-multiselectable="true"/.test(multiSelect) &&
    /role="listbox"[\s\S]{0,500}<input/.test(multiSelect) === false,
);
check(
  "Settings remount theo guild trước khi đổi state cục bộ",
  /PanelErrorBoundary key=\{`\$\{section\}:\$\{data\.guild\.discordId\}`\}/.test(
    files.get("pages/GuildPage.tsx") ?? "",
  ) && /useEffect[\s\S]{0,900}setWebhookEventTypes/.test(settingsPanel),
);
check(
  "Webhook eventTypes=[] được giữ nguyên khi hydrate",
  /current\.eventTypes\s*\?\?\s*DEFAULT_WEBHOOK_EVENT_TYPES/.test(settingsPanel) &&
    !/current\.eventTypes\?\.length\s*\?/.test(settingsPanel),
);
check(
  "AuthPage đọc lựa chọn nhớ đăng nhập đã lưu",
  /REMEMBER_LOGIN_KEY/.test(files.get("pages/AuthPage.tsx") ?? ""),
);
const historyPage = files.get("pages/GuildHistory.tsx") ?? "";
check("date filter dùng local day boundary, không UTC cứng", !/Date\.UTC\(/.test(historyPage));
const convexUrl = files.get("lib/convexUrl.ts") ?? "";
check(
  "Convex URL fail-closed khi env sai, không fallback im lặng",
  /throw new Error\("CONVEX_URL không hợp lệ/.test(convexUrl) &&
    /!configured\) throw new Error/.test(convexUrl),
);
check(
  "Convex validator nhận regional .convex.cloud cho API client",
  convexUrl.includes("convex") && convexUrl.includes(".cloud") && convexUrl.includes("[a-z0-9-]+"),
);
// Convex phục vụ HTTP actions (httpRouter) ở .convex.site — helper đổi suffix
// đúng chỗ, không đụng URL API .convex.cloud của ConvexReactClient.
check(
  "convexSiteUrl đổi suffix .convex.cloud → .convex.site cho HTTP actions",
  /replace\(\/\\.convex\\.cloud\$\/i, ".convex.site"\)/.test(convexUrl),
);
const buildShim = fs.readFileSync(path.join(ROOT, "scripts", "build.mjs"), "utf8");
const dockerfile = fs.readFileSync(path.join(ROOT, "Dockerfile.web"), "utf8");
check(
  "build shim: env hợp lệ thắng, không có env thì dùng đáy an toàn TƯỜNG MINH (không âm thầm, không chết máy)",
  /for \(const name of CONVEX_URL_VARS\)/.test(buildShim) &&
    /PROTOGON_DEFAULT_CONVEX_URL\s*=\s*"https:\/\/[a-z0-9-]+\.convex\.cloud"/.test(buildShim) &&
    /trimmedConvexUrl\s*=\s*PROTOGON_DEFAULT_CONVEX_URL/.test(buildShim) &&
    !/VITE_CONVEX_URL\s*=\s*trimmedConvexUrl\s*\|\|/.test(buildShim),
);
check(
  "build shim chọn biến URL Convex HỢP LỆ đầu tiên (blob rác không che biến đúng — bug 26/09)",
  /for \(const name of CONVEX_URL_VARS\)/.test(buildShim) &&
    /CONVEX_URL_VARS\s*=\s*\["CONVEX_URL", "VITE_CONVEX_URL"/.test(buildShim),
);
check(
  "Docker noindex chỉ áp route private và có branded 404",
  /auth\|discord\/callback\|admin\|stats/.test(dockerfile) &&
    !/terms\|privacy\|data-deletion\|monitor/.test(dockerfile) &&
    /error_page 404 \/404\.html/.test(dockerfile),
);
const notFoundPage = fs.readFileSync(path.join(ROOT, "public", "404.html"), "utf8");
const notFoundScript = fs.readFileSync(path.join(ROOT, "public", "404.js"), "utf8");
check(
  "404 static hỗ trợ VI/EN/DE qua script external",
  /404\.js/.test(notFoundPage) &&
    /navigator\.language/.test(notFoundScript) &&
    /protogon-lang/.test(notFoundScript),
);
check(
  "session token mới xóa storage cũ để không bị token cũ ghi đè",
  /sessionStorage\.removeItem\(SESSION_TOKEN_KEY\)/.test(files.get("lib/discord.ts") ?? "") &&
    /localStorage\.removeItem\(SESSION_TOKEN_KEY\)/.test(files.get("lib/discord.ts") ?? ""),
);
const utils = files.get("lib/utils.ts") ?? "";
const overviewPanel = files.get("components/dashboard/OverviewPanel.tsx") ?? "";
check(
  "online status dùng chung heartbeat freshness helper",
  /isHeartbeatFresh/.test(utils) && /isHeartbeatFresh/.test(overviewPanel),
);
check(
  "useBotStatus tự tạo lại trạng thái khi heartbeat cũ",
  /setInterval[\s\S]{0,180}setNow/.test(files.get("lib/useBotStatus.ts") ?? ""),
);

// ─── N. IP-detect ngôn ngữ ban đầu (không persist) ─────────────────────────
// Bug thực tế: người quốc tế mở landing lần đầu vẫn đọc tiếng Việt vì web chỉ
// theo navigator.language. Dò theo IP qua endpoint Convex /geo_lang (CSP chỉ
// cho *.convex.cloud) — chỉ khi CHƯA có lựa chọn lưu, và KHÔNG ghi
// localStorage (người dùng chưa từng chọn thì lần sau vẫn dò lại).
const i18nSrc = files.get("lib/i18n.tsx") ?? "";
check(
  "i18n.tsx có detectLangByIp gọi /geo_lang qua Convex (không fetch API ngoài trực tiếp)",
  /export async function detectLangByIp/.test(i18nSrc) &&
    /\/geo_lang/.test(i18nSrc) &&
    /convexSiteUrl\(\)/.test(i18nSrc) &&
    !/fetch\("https:\/\/api\.country/.test(i18nSrc),
);
// Bug thật 26/09: HTTP actions của Convex phục vụ ở .convex.site — fetch nhầm
// .convex.cloud → 404 âm thầm (catch → null) → geo-detect chết dù test xanh.
check(
  "detectLangByIp gọi qua helper convexSiteUrl (không fetch .cloud trực tiếp)",
  /convexSiteUrl\(\)/.test(i18nSrc) &&
    !/resolveConvexUrl\(\)\s*;[\s\S]{0,120}\/geo_lang/.test(i18nSrc),
);
check(
  "IP-detect chỉ áp dụng khi CHƯA có lựa chọn lưu, không ghi localStorage",
  /if \(saved\) return;/.test(i18nSrc) &&
    /setLangState\(detected\)/.test(i18nSrc) &&
    !/localStorage\.setItem\(LANG_KEY, detected\)/.test(i18nSrc),
);
check(
  "IP-detect chỉ ảnh hưởng ngôn ngữ hỗ trợ (VN→vi, DE/AT/CH/LI→de), còn lại giữ nguyên",
  /country === "VN"/.test(i18nSrc) &&
    /"AT"/.test(i18nSrc) &&
    /"CH"/.test(i18nSrc) &&
    /return null;/.test(i18nSrc),
);
const httpSrc = fs.readFileSync(path.join(ROOT, "convex", "http.ts"), "utf8");
check(
  "convex/http.ts route /geo_lang: đọc x-forwarded-for, fail-open về country rỗng",
  /x-forwarded-for/.test(httpSrc) &&
    /api\.country\.is/.test(httpSrc) &&
    /httpRouter\(\)/.test(httpSrc) &&
    /country: ""/.test(httpSrc),
);
check(
  "/geo_lang không lưu DB hay IP (chỉ pass-through), có CORS + cache",
  !/ctx\.db/.test(httpSrc) &&
    /access-control-allow-origin/.test(httpSrc) &&
    /cache-control/.test(httpSrc),
);
// Route phải được đăng ký đúng method — codegenConvex không chặn việc quên route.
check(
  "/geo_lang đăng ký đủ GET + OPTIONS",
  /path: "\/geo_lang", method: "GET"/.test(httpSrc) &&
    /path: "\/geo_lang", method: "OPTIONS"/.test(httpSrc),
);

// ─── O. Trang /features — SEO quốc tế ────────────────────────────────
// Bug lớp cần chặn: thêm trang công khai mà quên meta/sitemap/link thì trang
// "tồn tại" nhưng không ai tìm thấy — chết y nhánh SEO im lặng.
const featuresPageSrc = fs.readFileSync(
  path.join(ROOT, "src", "pages", "FeaturesPage.tsx"),
  "utf8",
);
const featuresContentSrc = fs.readFileSync(
  path.join(ROOT, "src", "lib", "featuresContent.ts"),
  "utf8",
);
check(
  "/features có route công khai + nội dung 3 thứ tiếng tự chứa (@i18n-content)",
  /path="\/features"/.test(appSrc) &&
    /@i18n-content/.test(featuresContentSrc) &&
    /\bvi:\s*\{/.test(featuresContentSrc) &&
    /\ben:\s*\{/.test(featuresContentSrc) &&
    /\bde:\s*\{/.test(featuresContentSrc),
);
check(
  "/features được index: seo.ts có kind features + sitemap + meta robots",
  /"features"/.test(seo) &&
    /path === "\/features"/.test(seo) &&
    fs.readFileSync(path.join(ROOT, "public", "sitemap.xml"), "utf8").includes("/features"),
);
check(
  "/features render nhãn đa ngữ qua translate() (không render trực tiếp từ doc)",
  /translate\(doc\.hero\.title\)/.test(featuresPageSrc) &&
    /translate\(block\.description\)/.test(featuresPageSrc) &&
    /translate\(step\)/.test(featuresPageSrc),
);

// ─── 10. TicketPanel: số liệu + link + cấu hình phải thật sự có tác dụng ───
// Cả 3 lỗi dưới đây đều từng xảy ra và đều im lặng — không crash, không log:
//   1. `openCount` đếm trên `tickets`, mà `tickets` chỉ chứa đúng tab đang xem
//      → bấm tab "Đã đóng" là badge báo "0 đang mở" dù server đang có.
//   2. Link kênh `/channels/@me/<id>` không có guildId → bấm ra trang trắng.
//   3. `ticketCloseNote` (ghi chú khi đóng ticket) được lưu vào DB và không
//      dùng ở bất kỳ đâu → chủ server gõ xong không thấy tác dụng.
const ticketPanel = files.get("components/dashboard/TicketPanel.tsx") ?? "";
check(
  "số ticket đang mở lấy từ ticketSummary (không đếm trên tab đang xem)",
  /useQuery\(\s*api\.tickets\.ticketSummary/.test(ticketPanel) &&
    /const openCount = summary\?\.openCount/.test(ticketPanel) &&
    !/tickets\?\.filter\(/.test(ticketPanel),
);
check(
  "link mở kênh có guildId, không dùng dạng @me",
  /discord\.com\/channels\/\$\{guildId\}\/\$\{t\.channelId\}/.test(ticketPanel) &&
    !/channels\/@me\//.test(ticketPanel),
);
check(
  "đóng ticket từ web dùng ghi chú đã cấu hình làm lý do",
  /reason: g\.ticketCloseNote/.test(ticketPanel),
);
const guildsSrc = fs.readFileSync(path.join(ROOT, "convex", "guilds.ts"), "utf8");
// Cắt từ `getBotConfig` tới export kế tiếp — `handler: async` nằm ở ngay sau
// args nên regex non-greedy sẽ cắt cụt, không chứa được phần field trả về.
const gi = guildsSrc.indexOf("export const getBotConfig");
const gNext = guildsSrc.indexOf("export const", gi + 10);
const botConfig = gi < 0 ? "" : guildsSrc.slice(gi, gNext > 0 ? gNext : undefined);
check(
  "bundle bot (getBotConfig) có ticketCloseNote — bot dựng topic từ đó",
  /ticketCloseNote: guild\.ticketCloseNote/.test(botConfig),
);
const ticketsHandler = fs.readFileSync(
  path.join(ROOT, "bot", "src", "handlers", "tickets.js"),
  "utf8",
);
check(
  "tạo kênh ticket dùng closeNote làm topic",
  // Prettier có thể tách chuỗi .trim().slice() ra nhiều dòng → bỏ khoảng trắng
  // và newline trước khi so khớp, nếu không test này sẽ đỏ vì lý do hình thức.
  /topic:\s*String\(closeNote\s*\|\|\s*""\)\s*\.trim\(\)\s*\.slice\(0,\s*1024\)/.test(
    ticketsHandler,
  ),
);

// ─── 11. Cờ cấu hình bot đọc thì phải có thật (schema + bundle + UI) ──────────
// `nukeRollback` đọc `config.rollbackEnabled === false` để cho phép chủ server
// tắt, nhưng field KHÔNG tồn tại ở đâu cả → nhánh "tắt" không bao giờ chạy và
// không ai có đường tắt. Lớp lỗi "hứa có, không có", chặn bằng cách bắt buộc
// đủ 3 tầng mỗi khi thêm cờ mới.
const antiNuke = files.get("components/dashboard/AntiNukePanel.tsx") ?? "";
const guildsSrc2 = fs.readFileSync(path.join(ROOT, "convex", "guilds.ts"), "utf8");
const schemaSrc = fs.readFileSync(path.join(ROOT, "convex", "schema.ts"), "utf8");
const gi2 = guildsSrc2.indexOf("export const getBotConfig");
const gn2 = guildsSrc2.indexOf("export const", gi2 + 10);
const botConfig2 = guildsSrc2.slice(gi2, gn2 > 0 ? gn2 : undefined);
for (const flag of ["rollbackEnabled"]) {
  check(
    `cờ ${flag} có trong schema`,
    new RegExp(`${flag}: v\\.optional\\(v\\.boolean\\(\\)\\)`).test(schemaSrc),
  );
  check(
    `cờ ${flag} có trong bundle bot (getBotConfig)`,
    new RegExp(`${flag}: guild\\.${flag}`).test(botConfig2),
  );
  check(`UI có nút bật/tắt cho ${flag}`, new RegExp(`${flag}`).test(antiNuke));
}

// ─── 12. Preloader: không bao giờ kẹt người dùng ở màn loading ────────────────
// Preloader nằm inline trong index.html (chạy trước bundle React) và tự fade
// khi window.__bootDone() được gọi. Ba đường kẹt người dùng đều phải chặn:
//   1. Không có JS → không ai gọi __bootDone → kẹt vĩnh viễn (phải có noscript).
//   2. Bundle lỗi / app crash → phải có chốt an toàn theo thời gian.
//   3. React ném lỗi toàn trang → RootErrorBoundary phải mở preloader ra,
//      nếu không người dùng thấy loading mãi dù app đã có màn báo lỗi.
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const bootAppSrc = files.get("App.tsx") ?? "";
const bootBoundary = files.get("components/RootErrorBoundary.tsx") ?? "";
check(
  "preloader có markup + role progressbar",
  /id="boot"/.test(html) && /role="progressbar"/.test(html),
);
check(
  "preloader có noscript ẩn (không JS không kẹt)",
  /<noscript>[\s\S]*?#boot[\s\S]*?<\/noscript>/.test(html),
);
check(
  "preloader có chốt an toàn theo thời gian",
  /setTimeout\(function \(\) \{\s*done = true;/.test(html),
);
check("preloader tôn trọng prefers-reduced-motion", /prefers-reduced-motion: reduce/.test(html));
check(
  "preloader bám chủ đề app (không lóe trắng trên máy chủ đề tối)",
  /protogon-theme/.test(html) && /prefers-color-scheme: dark/.test(html),
);
check("App gọi __bootDone khi đã vẽ xong", /window\.__bootDone/.test(bootAppSrc));
check(
  "Tín hiệu __bootDone nằm BÊN TRONG <Suspense> (không nhảy qua RouteFallback)",
  /<Suspense[^]*?\n\s*<BootSignal \/>/.test(bootAppSrc),
);
check("App lỗi toàn trang cũng mở preloader", /__bootDone/.test(bootBoundary));
check("App khai báo kiểu __bootDone cho TypeScript", /__bootDone\?: \(\) => void/.test(bootAppSrc));
// Đồng bộ thanh ↔ nhân vật: hai thứ PHẢI lấy cùng một giá trị %. Nếu thanh có
// transition width của CSS mà nhân vật đặt left tức thì, đầu thanh trễ ~150ms
// so với nhân vật → nhìn như nhân vật chạy trước thanh (bug thấy 27/09/2026).
// Bỏ comment CSS trước khi kiểm — rule .boot-fill có giải thích bằng chữ
// "transition" ngay trong đó, đọc thẳng sẽ ra kết quả sai.
const bootFillRule = (html.match(/\.boot-fill \{[^}]*\}/) || [""])[0].replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);
check(
  "Thanh + nhân vật dùng CHUNG một giá trị % (paint)",
  /fill\.style\.width = v \+ "%";[\s\S]{0,160}?run\.style\.left = v \+ "%";/.test(html),
);
check(
  "KHÔNG transition width trên .boot-fill (JS đã easing — transition làm lệch)",
  !/transition/.test(bootFillRule),
  bootFillRule.replace(/\s+/g, " ").slice(0, 90),
);
check(
  "Nhân vật canh giữa bằng translateX(-50%) để khớp đầu thanh",
  /\.boot-run \{[^}]*translateX\(-50%\)/.test(html),
);
// `bone()` quét theo trục chính và LUÔN vẽ bước cuối. Kiểu Bresenham "dừng
// khi x==x1 && y==y1" với toạ độ số thực không bao giờ đúng → vòng lặp chạy
// trọn và vẽ vệt dài tràn ra ngoài canvas.
check(
  "Nét chi/thân có dừng ở bước cuối (Bresenham với số thực là vệt tràn canvas)",
  /function bone\(x0, y0, x1, y1, w, c\)/.test(html) &&
    /var t = i \/ steps;/.test(html) &&
    !/if \(x === x1 && y === y1\) break;/.test(html),
);
check(
  "Bật giảm chuyển động: giá trị % chặn trên 100 (làm tròn bậc 8 → 104 là tràn thanh)",
  /Math\.min\(100, Math\.round\(p \/ 8\) \* 8\)/.test(html),
);
// Nhân vật được dựng vào MỘT lưới ô rời rạc rồi suy viền từ chính lưới đó
// (thay cho cách "phình từng mảnh rồi bù trừ" — cách cũ để lọt nét viền lạnh
// vào giữa hình và hay lệch một bên).
check(
  "Nhân vật dựng vào lưới ô + suy viền từ lưới (không phình từng mảnh)",
  /function flush\(\)/.test(html) &&
    /if \(grid\[y\]\[x\]\) continue;/.test(html) &&
    /x > 0 && grid\[y\]\[x - 1\]/.test(html) &&
    /function mark\(x, y, c\)/.test(html),
);
check(
  "Bitmap nhân vật vẽ theo devicePixelRatio (màn 2× không bị nhoè)",
  /devicePixelRatio/.test(html) && /run\.width = LW \* S \* dpr/.test(html),
);
check(
  "KHÔNG còn nhịp thân kiểu xung vuông (sin > 0 ? 0 : 1 → giật 1px mỗi nhịp)",
  !/Math\.sin\(t \* 2\) > 0 \? 0 : 1/.test(html),
);
check(
  "Nhịp chạy CỐ ĐỊNH (không tăng tốc đột ngột khi app báo xong)",
  /var CYCLE = \d+/.test(html) && /\/ CYCLE\) % 1/.test(html),
);
check(
  "Nội suy khung dùng smoothstep (tuyến tính để lại gãy tốc độ ở mỗi mốc)",
  /function ease\(u\)/.test(html) && /u \* u \* \(3 - 2 \* u\)/.test(html),
);
check(
  "Chi dựng bằng IK 2 khúc (bàn chân đặt đâu chạm đất đúng đó, không trượt)",
  /function ik\(hx, hy, ex, ey, l1, l2, forward\)/.test(html) &&
    /function leg\(ph, thigh, boot\)/.test(html),
);
// Đùi và cẳng chân phải là HAI vật liệu khác nhau: video gốc có vùng da ấm
// (56-68% điểm ảnh ấm) ở hàng 32-37 rồi vùng tối ngay dưới (0-2% ấm) — tức
// đùi hở + giày cao tới gối, không phải quần dài một màu. Gộp lại là mất nét
// nhận dạng rõ nhất ở nửa dưới nhân vật.
// Đùi dày 3 ô chứ không phải 2: gấu áo rộng 6-7 ô, đùi 2 ô để hở hai khe viền
// 2 ô mỗi bên ngay dưới gấu — nhìn như thân bị khoét thủng.
check(
  "Đùi hở và ống giày cao là hai vật liệu riêng (đúng hai dải màu của video)",
  /bone\(CX, hy, k\[0\], k\[1\], 3, thigh\)/.test(html) &&
    /bone\(k\[0\], k\[1\], ax, ay, 2, boot\)/.test(html),
);
// Thân + đầu PHẢI nhún theo nhịp hông. Nếu thân đứng yên còn chân quét qua
// lại thì mắt đọc ra con rối cắm trên hai cái càng — đúng lỗi "slop" cũ.
check(
  "Thân + đầu nhún theo nhịp hông (không phải thân đứng yên chỉ chân chạy)",
  /function bobOf\(ph\)/.test(html) &&
    /torso\(bob\)/.test(html) &&
    /head\(bob\)/.test(html) &&
    /arm\(f, PAL\.coatL, bob\)/.test(html),
);
// Đáy nhún phải là HẰNG SỐ suy từ chính bảng HIPY, và biên độ HIPY phải ≤
// 1,49 hàng. Nếu ai đó chỉnh HIPY mà quên đáy: bob = 2 → đỉnh đầu vượt mép
// canvas (bị cắt), bob = -1 → hở một hàng trống trên đầu. Kiểm bằng SỐ chứ
// không so chuỗi, để phép đo luôn đúng sau mọi lần chỉnh bảng.
const hipySrc = (html.match(/var HIPY = \[([^\]]+)\]/) || ["", ""])[1];
const hipyVals = hipySrc
  .split(",")
  .map((v) => Number(v.trim()))
  .filter((v) => !Number.isNaN(v));
const hipyMin = Math.min(...hipyVals);
const hipySpan = Math.max(...hipyVals) - hipyMin;
const hipyMinSrc = (html.match(/var HIPY_MIN = ([\d.]+);/) || ["", ""])[1];
check(
  "Nhún thân KHÔNG bao giờ âm: đáy nhún lấy từ hằng HIPY_MIN = min(HIPY)",
  /var bob = bobOf\(f\);/.test(html) &&
    /Math\.round\(at\(HIPY, ph\) - HIPY_MIN\)/.test(html) &&
    Number(hipyMinSrc) === hipyMin,
  `HIPY_MIN=${hipyMinSrc} nhưng min(HIPY)=${hipyMin}`,
);
check(
  "biên độ HIPY ≤ 1,49 hàng → bob chỉ nhận {0,1} (2 = tràn mép trên, -1 = cắt đầu)",
  hipySpan > 0.5 && hipySpan <= 1.49,
  `max-min = ${hipySpan.toFixed(2)} hàng`,
);

// ─── 13. Nhân vật preloader: tỉ lệ + hình dáng phải theo VIDEO tham chiếu ────
// Lần trước nhân vật bị dựng 26×24 ô (w/h = 1,08) trong khi khung nhân vật
// trong video "haimiya pixel animation" đo được 268×578 px (w/h = 0,46) → ra
// chibi bè ngang, người dùng báo "không một nét nào giống". Bốn luật dưới đây
// chốt lại tỉ lệ và các nét nhận dạng, để không bị bành ra lần nữa.
const lwSrc = Number((html.match(/var LW = (\d+)/) || ["", 0])[1]);
const lhSrc = Number((html.match(/var LH = (\d+)/) || ["", 0])[1]);
const sSrc = Number((html.match(/var S = (\d+)/) || ["", 0])[1]);
check(
  "khung nhân vật cao gầy đúng tỉ lệ video (LH/LW ≈ 2,0 — không phải chibi bè ngang)",
  lhSrc / lwSrc > 1.85 && lhSrc / lwSrc < 2.15,
  `LH/LW = ${(lhSrc / lwSrc).toFixed(2)} (video: 578/268 = 2,16)`,
);
check(
  "CSS chừa đúng chiều cao canvas mới (LH×S + 10px khe, không lệch)",
  new RegExp(`margin-top: ${lhSrc * sSrc + 10}px`).test(html),
  `cần margin-top: ${lhSrc * sSrc + 10}px cho canvas ${lwSrc * sSrc}×${lhSrc * sSrc}px`,
);
check(
  "canvas khai báo đúng kích thước lưới (nếu không sẽ nháy sai cỡ trước frame đầu)",
  new RegExp(`id="boot-run"\\s*width="${lwSrc * sSrc}"\\s*height="${lhSrc * sSrc}"`).test(html),
);
// Lọn tóc DÀI hai bên + mái chéo + mặt nhỏ: ba nét nhận dạng của nhân vật gốc.
check(
  "có bảng lọn tóc dài hai bên và được vẽ (tóc dài là nét nhận dạng rõ nhất)",
  /var STRAND = \[/.test(html) &&
    /function strands\(dy\)/.test(html) &&
    /strands\(bob\);/.test(html),
);
check(
  "tóc dài chạy qua hông (hàng cuối của STRAND ≥ 30) chứ không phải tóc ngắn",
  Math.max(
    ...[...html.matchAll(/^\s*\[(\d+), \d+, \d+, \d+, \d+\],$/gm)].map((m) => Number(m[1])),
  ) >= 30,
);
check(
  "mặt NHỎ hơn khối đầu (mặt ≤ 6 ô ngang, đầu ≥ 14 ô — video: da ~90px / đầu 174px)",
  /span\(10, 14, 1[0-3] \+ dy, PAL\.skin\)/.test(html) && /\[8, 3, 18\],/.test(html),
);
// Kiểm bằng HÌNH HỌC chứ không so chuỗi: phải tồn tại một span tóc ở CÙNG
// HÀNG với một span da và chồng lên nó — tức mái chéo phủ lên trán. Nếu ai đó
// xoá mái đi, mặt thành khối chữ nhật bo tròn và mất chất anime.
const headSrc = (html.match(/function head\(dy\) \{[\s\S]*?\n {8}\}/) || [""])[0];
const spanOf = (re, kind) =>
  [...headSrc.matchAll(re)].map((m) => ({ x0: +m[1], x1: +m[2], y: +m[3], kind }));
const skinSpans = spanOf(/span\((\d+), (\d+), (\d+) \+ dy, PAL\.skin\)/g, "skin");
const headHairSpans = spanOf(/span\((\d+), (\d+), (\d+) \+ dy, PAL\.hair\)/g, "hair");
check(
  "mái tóc phủ chéo trước trán (mặt không được là khối chữ nhật tròn trịa)",
  headHairSpans.some((h) => skinSpans.some((s) => s.y === h.y && h.x0 <= s.x1 && h.x1 >= s.x0)),
  "cần span PAL.hair cùng hàng và chồng lên span PAL.skin",
);
// Bảng màu phải có đủ sắc độ cho từng vật liệu ở CẢ HAI theme — thiếu sắc độ
// thì nhân vật thành khối phẳng, đúng lỗi "slop" cần tránh.
for (const key of [
  "hair",
  "hairL",
  "hairW",
  "hairD",
  "coat",
  "coatL",
  "coatD",
  "skin",
  "skinD",
  "thigh",
  "thighD",
  "boot",
  "bootL",
]) {
  const hits = (html.match(new RegExp(`\\b${key}: "#[0-9a-f]{6}"`, "g")) || []).length;
  check(`bảng màu có ${key} ở cả 2 theme`, hits === 2, `đang có ${hits}/2`);
}
check(
  "màu áo lấy từ đo video (#4c4e57) chứ không phải màu tự chọn",
  html.includes('coat: "#4c4e57"'),
);

// ─── 14. Vẽ THẬT 8 khung nhân vật bằng DOM giả — kiểm bằng SỐ ───────────────
// Ba loại lỗi hình không thể thấy bằng regex trên source:
//   1. LỖ KÍN — khoang trống không thông ra nền nằm lọt giữa thân thì mắt nhìn
//      XUYÊN QUA nhân vật thấy nền. Đã xảy ra thật ở khung 1 và 5 (khoang kẹt
//      giữa lọn tóc dài và đùi), source vẫn "đúng" nên regex mù hoàn toàn.
//   2. Ô vẽ TRÀN ra ngoài lưới LW×LH → canvas cắt cụt một mảng của hình.
//   3. KHÔNG có pha bay — khung nào cũng còn một bàn chân chạm đất → mắt đọc
//      ra đi bộ/ngồi xổm chứ không ra chạy.
// Nên: chạy chính script preloader trong vm với DOM giả, thu mọi fillRect,
// dựng lại lưới ô rồi đo. Hermetic: không cần browser, không cần bundler.
const vm = require("vm");

function renderRunnerFrames() {
  const lw = Number((html.match(/var LW = (\d+)/) || ["", 0])[1]);
  const lh = Number((html.match(/var LH = (\d+)/) || ["", 0])[1]);
  const s = Number((html.match(/var S = (\d+)/) || ["", 0])[1]);
  // Viền LUÔN phủ thêm 1 ô quanh silhouette, nên "hàng thấp nhất có vẽ" không
  // phải hàng bàn chân. Đo pha bay/chạm đất phải bỏ ô màu viền ra.
  const outColors = new Set(
    (html.match(/out: "#[0-9a-f]{6}"/gi) || []).map((s) => s.slice(6, -1).toLowerCase()),
  );
  const rects = [];
  const ctxStub = {
    fillStyle: "",
    fillRect(x, y, w, h) {
      rects.push([x, y, w, h, String(this.fillStyle).toLowerCase()]);
    },
    clearRect() {
      rects.length = 0;
    },
  };
  const makeEl = () => ({
    style: {},
    width: 0,
    height: 0,
    className: "",
    textContent: "",
    attrs: {},
    getContext: () => ctxStub,
    setAttribute(k, v) {
      this.attrs[k] = v;
    },
    getAttribute(k) {
      return this.attrs[k];
    },
    removeChild() {},
  });
  const els = { boot: makeEl(), "boot-fill": makeEl(), "boot-pct": makeEl(), "boot-run": makeEl() };
  let rafCb = null;
  let now = 0;
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    document: { getElementById: (id) => els[id] || null },
    window: {
      devicePixelRatio: 1,
      matchMedia: () => ({ matches: false }),
      localStorage: { getItem: () => "light" },
      __bootDone: null,
    },
    localStorage: { getItem: () => "light" },
    performance: { now: () => now },
    requestAnimationFrame: (cb) => {
      rafCb = cb;
      return 1;
    },
    setTimeout: () => 0,
  };
  sandbox.window.window = sandbox.window;
  const src = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .find((body) => body.includes("drawRunner"));
  if (!src) return null;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const frames = [];
  for (let k = 0; k < 8; k++) {
    now = (k / 8) * 400; // CYCLE = 400ms cho 8 khung
    const cb = rafCb;
    rafCb = null;
    if (!cb) return null;
    cb(now + 1);
    const grid = Array.from({ length: lh }, () => new Array(lw).fill(0));
    const solid = Array.from({ length: lh }, () => new Array(lw).fill(0));
    let off = 0;
    for (const [x, y, , , c] of rects) {
      const cx = Math.round(x / s);
      const cy = Math.round(y / s);
      if (cx < 0 || cy < 0 || cx >= lw || cy >= lh) {
        off++;
        continue;
      }
      grid[cy][cx] = 1;
      if (!outColors.has(c)) solid[cy][cx] = 1;
    }
    // lỗ kín: ô chưa vẽ mà không loang được từ mép lưới
    const seen = new Set();
    const stack = [];
    for (let x = 0; x < lw; x++) stack.push(x, (lh - 1) * lw + x);
    for (let y = 0; y < lh; y++) stack.push(y * lw, y * lw + lw - 1);
    while (stack.length) {
      const p = stack.pop();
      const px = p % lw;
      const py = (p - px) / lw;
      if (px < 0 || py < 0 || px >= lw || py >= lh) continue;
      if (grid[py][px] || seen.has(p)) continue;
      seen.add(p);
      stack.push(p - 1, p + 1, p - lw, p + lw);
    }
    let holes = 0;
    let bottom = -1;
    for (let y = 0; y < lh; y++)
      for (let x = 0; x < lw; x++) {
        if (!grid[y][x] && !seen.has(y * lw + x)) holes++;
        if (solid[y][x] && y > bottom) bottom = y;
      }
    frames.push({ off, holes, bottom, air: lh - 1 - bottom });
  }
  return frames;
}

const shot = renderRunnerFrames();
check(
  "dựng được 8 khung nhân vật từ chính script trong index.html (dom giả, không cần browser)",
  shot !== null,
);
if (shot) {
  check(
    "không ô nào vẽ tràn ra ngoài lưới LW×LH (ô ngoài lưới bị canvas cắt cụt)",
    shot.every((f) => f.off === 0),
    `ô ngoài lưới theo khung: ${shot.map((f) => f.off).join(",")}`,
  );
  check(
    "không khung nào có LỖ KÍN (ô không vẽ mà không thông ra nền = lỗ thủng giữa thân)",
    shot.every((f) => f.holes === 0),
    `lỗ kín theo khung: ${shot.map((f) => f.holes).join(",")}`,
  );
  check(
    "có pha BAY thật: ít nhất 1 khung cả hai bàn chân rời đất ≥2 hàng",
    shot.some((f) => f.air >= 2),
    `số hàng không có chân theo khung: ${shot.map((f) => f.air).join(",")} | đáy theo khung: ${shot.map((f) => f.bottom).join(",")}`,
  );
  check(
    "có khung CHẠM đất: đáy giày trùng hàng cuối canvas (không lơ lửng trên thanh)",
    shot.filter((f) => f.air === 0).length >= 2,
    `số khung chạm đất: ${shot.filter((f) => f.air === 0).length}/8`,
  );
}

console.log(`\nKết quả web contracts: ${pass} PASS, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
