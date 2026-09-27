// Test research.js — threat intel pipeline với fetch + store GIẢ (không mạng thật).
// Chạy: node scripts/test-research.cjs

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
    {
      cveID: "CVE-2026-12345",
      vendorProject: "ExampleSoft",
      product: "WebGate",
      shortDescription: "Remote code execution in WebGate panel allows full takeover",
    },
    {
      cveID: "CVE-2026-67890",
      vendorProject: "HypotheticalCorp",
      product: "ChatRelay",
      shortDescription: "JWT bypass lets attacker impersonate webhook sender",
    },
  ],
};

const mutations = [];

const store = {
  client: {
    query: async (name) => {
      if (name === "threatIntel:botGetIntel") {
        return {
          researchEnabled: true,
          aiWeeklyEnabled: true,
          nextRunAt: 0,
          lastRunAt: 0,
          keywords: ["alreadyknown"],
        };
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
  check(
    "đã dùng nguồn reddit",
    res.sources.some((s) => s.startsWith("reddit")),
  );
  check("đã dùng nguồn cisa-kev", res.sources.includes("cisa-kev"));
  check("đã học từ raid-incidents", res.sources.includes("raid-incidents"));
  check("có từ khóa mới heuristic", res.newKeywords > 0);
  check("AI không được gọi khi chưa cấu hình key", res.aiUsed === false);

  const saved = mutations.find((m) => m.name === "threatIntel:botSetResearchRun");
  check("đã lưu 1 lượt nghiên cứu vào Convex", !!saved);
  if (saved) {
    check(
      "keyword từ Reddit được lưu",
      (saved.args.keywords || []).some(
        (k) => k.includes("token-stealer") || k.includes("phishing"),
      ),
    );
    check(
      "CVE được lưu thành phrase",
      (saved.args.scamPhrases || []).some((p) => p.startsWith("cve-")),
    );
    check(
      "nextRunAt là 4 giờ sau (interval ghim qua env)",
      saved.args.nextRunAt - Date.now() > 3.9 * 3600 * 1000,
    );
  }

  // Lượt 2: intel cũ giờ chứa từ khóa vừa lưu → không học lại từ khóa cũ (không spam).
  mutations.length = 0;
  const res2 = await research.runResearch(store);
  console.log("[result2]", JSON.stringify(res2));
  check("lượt 2: ít từ khóa mới hơn (không lặp)", res2.newKeywords <= res.newKeywords);

  // ── Digest tuần (buildWeeklyDigest + postDigestToLog) ──
  // Trước đây phần này không có test: suite cũ xoá sạch key AI nên
  // researchAvailable() luôn false → digest luôn null, hai hàm cuối file chỉ
  // nằm trên giấy. Rủi ro: digest là thứ admin ĐỌC để biết xu hướng tuần, hỏng
  // im lặng = admin tin nhầm là server yên ổn.
  {
    const aiPath = require.resolve("../bot/src/ai.js");
    const utilPath = require.resolve("../bot/src/util.js");
    const realAi = require.cache[aiPath];
    const realUtil = require.cache[utilPath];
    const digestCalls = [];
    const sent = [];
    // Nạp sẵn vào require.cache: research.js require("./ai") LÚC CHẠY nên
    // cache sẵn được dùng đúng, không cần sửa code production.
    require.cache[aiPath] = {
      id: aiPath,
      filename: aiPath,
      loaded: true,
      exports: {
        researchAvailable: () => true,
        researchChat: async (messages) => {
          // researchChat dùng chung cho cả aiSynthesize VÀ digest → chỉ tính
          // lời gọi nào thực sự là digest (prompt chứa "DIGEST").
          const isDigest = JSON.stringify(messages).includes("DIGEST");
          if (isDigest) digestCalls.push(messages);
          return isDigest ? "  Xu hướng tuần: raid giả mạo captcha Discord tăng mạnh.  " : "";
        },
        extractJson: () => ({}),
        aiAvailable: () => true,
        classifyViolation: async () => ({ ok: true }),
        analyzeRaid: async () => ({ ok: true }),
        analyzeExternalApp: async () => ({ ok: true }),
        chatForResearch: async () => "",
        aiStats: () => ({}),
      },
    };
    require.cache[utilPath] = {
      id: utilPath,
      filename: utilPath,
      loaded: true,
      exports: {
        Colors: new Proxy({}, { get: () => 0x000000 }),
        logEmbed: (o) => o,
        sendLog: async (guild, cfg, embed) => {
          sent.push({ guildId: guild.id, embed });
        },
      },
    };

    // Buộc digest ĐẾN HẠN: __protogonLastDigest là mốc process-wide, đặt về 0.
    globalThis.__protogonLastDigest = 0;
    mutations.length = 0;
    const digestStore = {
      client: {
        query: async (name) => {
          if (name === "threatIntel:botGetIntel") {
            return {
              researchEnabled: true,
              aiWeeklyEnabled: true,
              nextRunAt: 0,
              lastRunAt: 0,
              keywords: ["captcha-scam"],
              notifyEnabled: true,
            };
          }
          return [];
        },
        mutation: async (name, args) => {
          mutations.push({ name, args });
          return { ok: true };
        },
      },
      getConfig: async (guildId) => (guildId === "g-bad" ? null : { logChannelId: "L" }),
    };
    const mkClient = (n) => ({
      guilds: {
        cache: new Map(
          Array.from({ length: n }, (_, i) => [`g${i}`, { id: `g${i}`, name: `G${i}` }]),
        ),
      },
    });
    mkClient.gBad = null;
    const client = mkClient(5);
    client.guilds.cache.set("g-bad", { id: "g-bad", name: "GBad" });
    research.setupResearch(client, digestStore);
    await research.runResearch(digestStore);

    check("digest gọi AI đúng 1 lần", digestCalls.length === 1, String(digestCalls.length));
    const meta = mutations.find((m) => m.name === "threatIntel:botSetResearchMeta");
    check("digest được lưu lên Convex", !!meta, JSON.stringify(mutations.map((m) => m.name)));
    check(
      "digest cắt khoảng trắng thừa",
      meta?.args.digest === "Xu hướng tuần: raid giả mạo captcha Discord tăng mạnh.",
      JSON.stringify(meta?.args.digest),
    );
    check(
      "digest tôn trọng giới hạn 3 server (KHÔNG spam mọi server)",
      sent.length === 3,
      String(sent.length),
    );
    check(
      "digest bỏ qua guild không có cấu hình log",
      !sent.some((s2) => s2.guildId === "g-bad") && sent.every((s2) => s2.guildId.startsWith("g")),
      JSON.stringify(sent.map((s2) => s2.guildId)),
    );
    check(
      "mốc digest được ghi lại (không gửi lại trong 7 ngày)",
      globalThis.__protogonLastDigest > 0,
    );

    // Lượt sau: digest KHÔNG đến hạn → không gọi AI, không gửi log lần nữa.
    mutations.length = 0;
    sent.length = 0;
    digestCalls.length = 0;
    await research.runResearch(digestStore);
    check(
      "digest chưa đến hạn → không gọi lại AI",
      digestCalls.length === 0 &&
        !mutations.some((m) => m.name === "threatIntel:botSetResearchMeta"),
      `ai=${digestCalls.length}`,
    );

    // Không client Discord (bot chưa online / chưa setupResearch) → không ném.
    const savedClient = research.runResearch._client;
    research.runResearch._client = null;
    globalThis.__protogonLastDigest = 0;
    let threw = false;
    try {
      await research.runResearch(digestStore);
    } catch {
      threw = true;
    }
    check("digest không có client Discord → không ném ra ngoài", !threw);
    research.runResearch._client = savedClient;

    // Bỏ cờ notify → digest vẫn lưu Convex nhưng KHÔNG đăng kênh log.
    mutations.length = 0;
    sent.length = 0;
    globalThis.__protogonLastDigest = 0;
    const quietStore = {
      ...digestStore,
      client: {
        ...digestStore.client,
        query: async (name) =>
          name === "threatIntel:botGetIntel"
            ? {
                researchEnabled: true,
                aiWeeklyEnabled: true,
                nextRunAt: 0,
                keywords: ["x"],
                notifyEnabled: false,
              }
            : [],
      },
    };
    research.setupResearch(client, quietStore);
    await research.runResearch(quietStore);
    check(
      "tắt cờ thông báo → digest lưu Convex nhưng KHÔNG đăng kênh log",
      mutations.some((m) => m.name === "threatIntel:botSetResearchMeta") && sent.length === 0,
      `sent=${sent.length}`,
    );

    if (realUtil) require.cache[utilPath] = realUtil;
    else delete require.cache[utilPath];
    if (realAi) require.cache[aiPath] = realAi;
    else delete require.cache[aiPath];
  }

  globalThis.fetch = realFetch;
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error("ERROR:", e);
  globalThis.fetch = realFetch;
  process.exit(1);
});
