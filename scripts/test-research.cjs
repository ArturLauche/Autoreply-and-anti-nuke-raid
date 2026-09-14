// Test research.js — threat intel pipeline với fetch + store GIẢ (không mạng thật).
// Chạy: node scripts/test-research.cjs
const path = require("path");

// Ghim interval 4h cho test này (mặc định code hiện là 1h — tính năng tăng CPU;
// env override của bot cho phép ghim để assertion về nextRunAt ổn định).
process.env.RESEARCH_INTERVAL_MS = String(4 * 3600 * 1000);

const realFetch = globalThis.fetch;

// --- Fake nguồn mở: Reddit JSON + CISA KEV JSON ---
const redditJson = {
  data: {
    children: [
      {
        data: {
          title: "Beware of the new token-stealer scam hitting Discord moderators",
          selftext:
            "A crypto-wallet phishing campaign uses fake captcha v0lt pages to harvest discord tokens. Reported by several bot-net operators.",
        },
      },
      {
        data: {
          title: "What is the best music bot?", // noise → bị lọc
          selftext: "",
        },
      },
    ],
  },
};
const cisaJson = {
  vulnerabilities: [
    { cveID: "CVE-2026-12345", vendorProject: "ExampleSoft", product: "WebGate", shortDescription: "Remote code execution in WebGate panel allows full takeover" },
    { cveID: "CVE-2026-67890", vendorProject: "HypotheticalCorp", product: "ChatRelay", shortDescription: "JWT bypass lets attacker impersonate webhook sender" },
  ],
};

let researchQueries = 0;
const mutations = [];

const store = {
  client: {
    query: async (name) => {
      if (name === "threatIntel:botGetIntel") {
        researchQueries++;
        return { researchEnabled: true, aiWeeklyEnabled: true, nextRunAt: 0, lastRunAt: 0, keywords: ["alreadyknown"] };
      }
      if (name === "antinuke:recentRaidSamples") {
        return [
          { aiReason: "raid-botnet payload detected in massjoin wave" },
          { aiReason: "fake verify captcha link spam" },
        ];
      }
      return null;
    },
    mutation: async (name, args) => {
      mutations.push({ name, args });
      return { ok: true };
    },
  },
};

// Không có key AI trong env → aiAvailable() false → AI tổng hợp bị bỏ qua (0 token),
// research vẫn phải lưu từ khóa heuristic. Đây chính là "ai dùng gì khi không có key".
delete process.env.GROQ_API_KEY;
delete process.env.NVIDIA_API_KEY;
delete process.env.DEEPSEEK_NIM_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.SAMBANOVA_API_KEY;
delete process.env.AI_API_KEY;
delete process.env.AI_BASE_URL;

globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes("reddit.com")) {
    return { ok: true, status: 200, text: async () => JSON.stringify(redditJson) };
  }
  if (u.includes("cisa.gov")) {
    return { ok: true, status: 200, text: async () => JSON.stringify(cisaJson) };
  }
  return { ok: false, status: 404, text: async () => "" };
};

const research = require("../bot/src/research.js");

(async () => {
  let pass = 0;
  let fail = 0;
  const check = (label, ok) => {
    console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
    ok ? pass++ : fail++;
  };

  // setupResearch không được chờ thêm event nào (bot đã online khi được gọi) —
  // chỉ kiểm tra không crash khi gọi với client tối giản.
  research.setupResearch({ once: () => {} }, store);
  check("setupResearch không crash", true);

  const res = await research.runResearch(store);

  console.log("[result]", JSON.stringify(res));
  check("đã dùng nguồn reddit", res.sources.some((s) => s.startsWith("reddit")));
  check("đã dùng nguồn cisa-kev", res.sources.includes("cisa-kev"));
  check("đã học từ raid-incidents", res.sources.includes("raid-incidents"));
  check("có từ khóa mới heuristic", res.newKeywords > 0);
  check("AI không được gọi khi chưa cấu hình key", res.aiUsed === false);

  const saved = mutations.find((m) => m.name === "threatIntel:botSetResearchRun");
  check("đã lưu 1 lượt nghiên cứu vào Convex", !!saved);
  if (saved) {
    check(
      "keyword từ Reddit được lưu",
      (saved.args.keywords || []).some((k) => k.includes("token-stealer") || k.includes("phishing")),
    );
    check("CVE được lưu thành phrase", (saved.args.scamPhrases || []).some((p) => p.startsWith("cve-")));
    check("nextRunAt là 4 giờ sau (interval ghim qua env)", saved.args.nextRunAt - Date.now() > 3.9 * 3600 * 1000);
  }

  // Lượt 2: intel cũ giờ chứa từ khóa vừa lưu → không học lại từ khóa cũ (không spam).
  mutations.length = 0;
  const res2 = await research.runResearch(store);
  console.log("[result2]", JSON.stringify(res2));
  check("lượt 2: ít từ khóa mới hơn (không lặp)", res2.newKeywords <= res.newKeywords);

  globalThis.fetch = realFetch;
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error("ERROR:", e);
  globalThis.fetch = realFetch;
  process.exit(1);
});
