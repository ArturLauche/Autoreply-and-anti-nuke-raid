// Test lang.js — tự chọn ngôn ngữ theo QUỐC GIA của server:
//   - langForLocale: locale có bản dịch (vi/en/de) → dùng; biến thể vùng
//     (en-US, pt-BR, de-AT…) quy về phần ngôn ngữ; quốc gia khác (ja, ko, ru…)
//     và rỗng/lạ → EN mặc định (riêng rỗng → VI, sản phẩm gốc tiếng Việt).
//   - langForGuild: đọc guild.preferredLocale dạng string lẫn object { code }.
//   - Template welcome/goodbye theo ngôn ngữ + fallback EN cho lang lạ.
// Hermetic: không mạng, không Discord SDK. Chạy: node scripts/test-lang.cjs

const lang = require("../bot/src/handlers/lang");

let pass = 0,
  fail = 0;
function check(label, cond) {
  if (cond) {
    pass++;
    console.log("PASS", label);
  } else {
    fail++;
    console.log("FAIL", label);
  }
}

// ── langForLocale: quốc gia có bản dịch riêng ──
check("vi → vi", lang.langForLocale("vi") === "vi");
check("en → en", lang.langForLocale("en") === "en");
check("de → de", lang.langForLocale("de") === "de");

// ── biến thể vùng: quy về phần ngôn ngữ trước gạch nối ──
check("en-US → en", lang.langForLocale("en-US") === "en");
check("en-GB → en", lang.langForLocale("en-GB") === "en");
check("pt-BR → en (bản dịch pt chưa có)", lang.langForLocale("pt-BR") === "en");
check("de-AT → de", lang.langForLocale("de-AT") === "de");

// ── quốc gia chưa có bản dịch riêng → EN mặc định ──
check("ja → en", lang.langForLocale("ja") === "en");
check("ko → en", lang.langForLocale("ko") === "en");
check("ru → en", lang.langForLocale("ru") === "en");
check("zh-CN → en", lang.langForLocale("zh-CN") === "en");
check("fr → en", lang.langForLocale("fr") === "es" ? false : lang.langForLocale("fr") === "en");

// ── dữ liệu lạ không crash ──
check("rỗng → vi (mặc định sản phẩm)", lang.langForLocale("") === "vi");
check("undefined → vi", lang.langForLocale(undefined) === "vi");
check("null → vi", lang.langForLocale(null) === "vi");
check("dấu gạch dưới (en_US) → en", lang.langForLocale("en_US") === "en");
check("có khoảng trắng (  vi  ) → vi", lang.langForLocale("  vi  ") === "vi");

// ── langForGuild: guild thật (string) lẫn mock (object { code }) ──
check("guild string vi", lang.langForGuild({ preferredLocale: "vi" }) === "vi");
check(
  "guild object { code: 'en-US' }",
  lang.langForGuild({ preferredLocale: { code: "en-US" } }) === "en",
);
check("guild không có preferredLocale → vi", lang.langForGuild({}) === "vi");
check("guild null → vi", lang.langForGuild(null) === "vi");

// ── template welcome/goodbye theo ngôn ngữ ──
check("welcome vi giữ placeholder {user}", lang.welcomeDefault("vi").includes("{user}"));
check("welcome en khác bản vi", lang.welcomeDefault("en") !== lang.welcomeDefault("vi"));
check("goodbye de khác bản en", lang.goodbyeDefault("de") !== lang.goodbyeDefault("en"));
check("welcome lang lạ → fallback EN", lang.welcomeDefault("xx") === lang.welcomeDefault("en"));
check("goodbye lang lạ → fallback EN", lang.goodbyeDefault("zz") === lang.goodbyeDefault("en"));
// Placeholder bắt buộc phải đủ ở mọi bản dịch — fillTemplate phụ thuộc chúng.
for (const [code, tpl] of Object.entries({
  vi: lang.welcomeDefault("vi"),
  en: lang.welcomeDefault("en"),
  de: lang.welcomeDefault("de"),
})) {
  check(
    `welcome ${code} đủ 3 placeholder ({user}/{server}/{count})`,
    tpl.includes("{user}") && tpl.includes("{server}") && tpl.includes("{count}"),
  );
  check(
    `goodbye ${code} đủ 2 placeholder ({user}/{server})`,
    lang.goodbyeDefault(code).includes("{user}") && lang.goodbyeDefault(code).includes("{server}"),
  );
}

// ── SUPPORTED khớp số bản dịch template ──
check("SUPPORTED = vi,en,de", [...lang.SUPPORTED].sort().join(",") === "de,en,vi");

console.log(`\nKết quả lang: ${pass} PASS, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
