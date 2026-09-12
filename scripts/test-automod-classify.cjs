// TEST auto-mod: khả năng nhận diện bình thường lẫn AI (chat thật không bị phạt oan,
// vi phạm thật bị phát hiện). Chạy: node scripts/test-automod-classify.cjs
// Mô phỏng scanMessage (code bot thật) với Discord objects giả — không cần Discord thật.
const scanMessage = require("../bot/src/handlers/filters.js");
const {
  findMaliciousLink,
  findDangerousAttachment,
  findLearnedThreat,
  findSuspiciousLink,
  _setThreatIntelForTest,
} = require("../bot/src/handlers/filters.js");

let pass = 0;
let fail = 0;
const check = (label, ok) => {
  console.log(ok ? `  ✅ ${label}` : `  ❌ ${label}`);
  ok ? pass++ : fail++;
};

const OWNER_ID = "owner-1";
const ADMIN_ID = "admin-1";
const USER_A = "user-a";
const USER_B = "user-b";

// ==== Discord objects giả ====
function makeGuild() {
  const roles = new Map([["everyone", { id: "everyone", name: "@everyone" }]]);
  return {
    id: "guild-1",
    ownerId: OWNER_ID,
    roles: { cache: roles },
  };
}

function makePermissions(perms = []) {
  const set = new Set(perms);
  return { has: (p) => set.has(p) || set.has("Administrator") };
}

function makeMember(id, username, { bot = false, perms = [] } = {}) {
  const guild = makeGuild();
  return {
    id,
    user: { id, username, bot },
    guild,
    permissions: makePermissions(perms),
    roles: { cache: new Map() },
  };
}

function makeChannel() {
  return { isDMBased: () => false, id: "chan-1" };
}

function makeMessage({ content = "", attachments = [], mentions = 0, authorId = USER_A, username = "user" }) {
  const attMap = new Map();
  attachments.forEach((name, i) => attMap.set(`att-${i}`, { name }));
  const mentionUsers = new Map();
  for (let i = 0; i < mentions; i++) mentionUsers.set(`m-${i}`, { id: `m-${i}` });
  return {
    guild: makeGuild(),
    channel: makeChannel(),
    author: { id: authorId, username, bot: false },
    member: makeMember(authorId, username),
    content,
    attachments: attMap,
    mentions: { users: mentionUsers, roles: new Map(), channels: new Map(), everyone: false },
  };
}

// ==== Store + Heat giả, ghi lại hình phạt ====
const punished = [];
const heatStates = new Map();
const PUNISH_EVENTS = new Set(["bot_writes:botRecordAntinukeEvent", "bot_writes:botRecordPunishment"]);

const store = {
  async getConfig() {
    return {
      antinukeEnabled: true,
      adminRoles: [],
      modRoles: [],
      whitelistUsers: [],
      whitelistRoles: [],
      badWords: ["cc", "vcl", "dmml"],
      modules: [
        { module: "invite", enabled: true, punish: "warn", heat: 20, windowSeconds: 10, threshold: 1, actions: ["warn", "deleteMessages"] },
        { module: "badword", enabled: true, punish: "warn", heat: 10, windowSeconds: 10, threshold: 1, actions: ["warn", "deleteMessages"] },
        { module: "malware", enabled: true, punish: "timeout", heat: 25, windowSeconds: 10, threshold: 1, actions: ["timeout", "deleteMessages"] },
        { module: "mention", enabled: true, punish: "timeout", heat: 15, windowSeconds: 10, threshold: 10 },
        { module: "attachment", enabled: true, punish: "timeout", heat: 15, windowSeconds: 10, threshold: 5 },
      ],
    };
  },
  client: {
    async query(name) {
      if (name === "threatIntel:botGetIntel") return { keywords: [], scamPhrases: [] };
      return null;
    },
    async mutation(name, args) {
      // Chỉ đếm các mutation GHI PHẠT (event moderation) — bỏ qua đồng bộ nhiệt/warn.
      if (PUNISH_EVENTS.has(name) || name.endsWith("AntinukeEvent") || name.endsWith("RecordPunishment")) {
        punished.push({ name, module: args.module, punish: args.punish, reason: args.reason });
      }
      return { ok: true };
    },
  },
};

const heat = {
  store,
  async add(guildId, userId, username, points, s) {
    const key = `${guildId}:${userId}`;
    const prev = heatStates.get(key) ?? 0;
    const next = Math.min(100, prev + points);
    heatStates.set(key, next);
    let tier = "safe";
    if (next >= (s.banAt ?? 90)) tier = "ban";
    else if (next >= (s.kickAt ?? 70)) tier = "kick";
    else if (next >= (s.timeoutAt ?? 40)) tier = "timeout";
    else if (next >= (s.warnAt ?? 25)) tier = "warn";
    return { heat: next, added: points, tier, warned: tier === "warn", repeated: false, multiplier: 1 };
  },
  strike() {
    return { escalated: false, count: 1, punish: "warn" };
  },
  markPunished() {},
};

// ==== punishMember giả ====
const realPunishModule = require.cache[require.resolve("../bot/src/heat.js")];
if (!realPunishModule) throw new Error("heat.js chưa được load?");

// ==== Chạy scanMessage và trả về tổng số lần ghi phạt ====
async function runScan(msg) {
  const before = punished.length;
  await scanMessage({ user: { id: "bot-1" } }, msg, store, heat);
  return punished.slice(before);
}

(async () => {
  console.log("=== 1) CHAT BÌNH THƯỜNG LẪN — KHÔNG ĐƯỢC PHẠT OAN ===");

  const normalChats = [
    "server kia đang có giveaway hay lắm mọi người ơi",
    "mình vừa thấy airdrop token trên twitter",
    "cho mình hỏi cách đổi password discord với",
    "hôm qua tôi claim reward event xong rồi",
    "ai chơi free fire không teehee",
    "các bạn xem video này hay ghê https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "repo github của mình đây: https://github.com/wiothemilo-lang/protogon",
    "docs discord API: https://discord.com/developers/docs",
    "tham gia server mình nhé https://google.com",
    "link wikipedia về bitcoin nè https://en.wikipedia.org/wiki/Bitcoin",
  ];
  for (const content of normalChats) {
    const res = await runScan(makeMessage({ content, authorId: USER_A }));
    check(`"${content.slice(0, 50)}..." → không bị phạt`, res.length === 0);
  }

  console.log("\n=== 2) VI PHẠM THẬT — PHẢI ĐƯỢC PHÁT HIỆN ===");

  const v1 = await runScan(makeMessage({ content: "vào server mình nè https://discord.gg/abc123", authorId: USER_A }));
  check("link mời Discord → phạt", v1.length === 1 && v1[0].module === "invite");

  const v2 = await runScan(makeMessage({ content: "cái này là cc thật sự", authorId: USER_A }));
  check("từ ngữ xấu (badword) → phạt", v2.length === 1 && v2[0].module === "badword");

  const v3 = await runScan(makeMessage({ content: "nhận nitro miễn phí tại https://discord-nitro.ru/free", authorId: USER_A }));
  check("domain scam trong blacklist → phạt", v3.length === 1 && v3[0].module === "malware");

  const v4 = await runScan(makeMessage({ content: "free nitro click here http://sketchy-site.xyz/claim", authorId: USER_A }));
  check("scam signature KÈM link lạ → phạt", v4.length === 1 && v4[0].module === "malware");

  const v5 = await runScan(makeMessage({ content: "xem file này", attachments: ["virus.exe"], authorId: USER_A }));
  check("file .exe → phạt", v5.length === 1 && v5[0].module === "malware");

  // Spam mention: 10 tin có mention trong cửa sổ
  let mentionCount = 0;
  for (let i = 0; i < 10; i++) {
    const res = await runScan(makeMessage({ content: `xin chào @bạn số ${i}`, mentions: 1, authorId: USER_B }));
    mentionCount += res.length;
  }
  check("10 tin mention liên tiếp → phạt đúng 1 lần (đủ ngưỡng)", mentionCount === 1);

  // Spam attachment: 5 tin đính kèm
  let attCount = 0;
  for (let i = 0; i < 5; i++) {
    const res = await runScan(makeMessage({ content: `ảnh ${i}`, attachments: [`pic${i}.png`], authorId: USER_B }));
    attCount += res.length;
  }
  check("5 tin đính kèm liên tiếp → phạt đúng 1 lần", attCount === 1);

  console.log("\n=== 3) ĐƠN VỊ PHÁT HIỆN THUẦN (findMaliciousLink / learned threat) ===");

  check("domain scam → phát hiện", findMaliciousLink("vào đây https://discord-gift.ru/claim") !== null);
  check("IP trực tiếp → phát hiện", findMaliciousLink("xem http://192.168.1.5/payload") !== null);
  check("youtube (lành tính) → KHÔNG phát hiện", findMaliciousLink("xem https://www.youtube.com/watch?v=x") === null);
  check("từ giveaway KHÔNG link → KHÔNG phát hiện", findMaliciousLink("giveaway ở server kia vui ghê") === null);
  check("giveaway + link github (lành tính) → KHÔNG phát hiện", findMaliciousLink("giveaway script https://github.com/a/b") === null);
  check("free nitro + link lạ → phát hiện", findMaliciousLink("free nitro http://lừa-đảo.xyz") !== null);

  // Threat intel học được
  _setThreatIntelForTest(["credential", "infostealer"], ["free gift redeem now"]);
  check("từ học được + link github → KHÔNG phạt (từ chung)", findLearnedThreat("password flow https://github.com/a/b") === null);
  check("từ học được + link LẠ → phạt", findLearnedThreat("credential stealer download http://evil-site.xyz/x") !== null);
  check("cụm từ học được → phạt cả khi không link (đặc thù)", findLearnedThreat("bấm vào đây free gift redeem now") !== null);
  check("từ học được không nằm trong tin → null", findLearnedThreat("chill thôi https://youtube.com/x") === null);

  check("link youtube là lành tính (findSuspiciousLink)", findSuspiciousLink("xem https://youtu.be/abc") === null);
  check("link domain lạ là đáng ngờ (findSuspiciousLink)", findSuspiciousLink("xem http://sketchy.xyz/a") !== null);

  check("file .png → an toàn", findDangerousAttachment(new Map([["a", { name: "photo.png" }]])) === null);
  check("file .bat → nguy hiểm", findDangerousAttachment(new Map([["a", { name: "script.bat" }]])) !== null);

  console.log("\n=== 4) AI GUARD (antinuke): chat thường vs raid qua classifyViolation ===");
  // (đã test chi tiết ở test-chat-flow-classify — ở đây chỉ nhắc luồng: AI offline → heat, không ban)

  console.log(`\nKết quả: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
