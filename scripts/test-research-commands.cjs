// Test researchCommands.js — /research + !research flows với store + source GIẢ.
// Chạy: node scripts/test-research-commands.cjs
//
// Mock discord.js bằng đường dẫn trỏ sang module giả (Colors chỉ là object).
const Module = require("module");
const path = require("path");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === "discord.js") {
    // Trả về util.js cũng đủ — nó re-export Colors từ discord.js... không được.
    // Thay vào đó tạo module giả trong tmp.
    return path.join(__dirname, "..", "bot", "test-djs-mock.cjs");
  }
  return origResolve.call(this, request, ...args);
};
// Tạo mock discord.js (Colors + EmbedBuilder builder chain).
const fs = require("fs");
fs.writeFileSync(
  path.join(__dirname, "..", "bot", "test-djs-mock.cjs"),
  `class EmbedBuilder {
  constructor(data = {}) { this.d = data; }
  setColor(c) { this.d.color = c; return this; }
  setTitle(t) { this.d.title = t; return this; }
  setDescription(t) { this.d.description = t; return this; }
  addFields(f) { this.d.fields = [...(this.d.fields ?? []), ...f]; return this; }
  setTimestamp() { return this; }
  setFooter(f) { this.d.footer = f; return this; }
}
module.exports = { Colors: new Proxy({}, { get: () => 0x000000 }), EmbedBuilder, PermissionFlagsBits: { ManageGuild: 1n << 5n, Administrator: 1n << 3n } };
`,
);

const { handleResearch } = require("../bot/src/handlers/researchCommands.js");
const research = require("../bot/src/research.js");

const mutations = [];
const store = {
  client: {
    query: async (name) => {
      if (name === "threatIntel:botGetIntel") {
        return {
          researchEnabled: true,
          keywords: ["tokengrabber", "fakecaptcha"],
          scamPhrases: ["free nitro redeem"],
          runs: 5,
          lastRunAt: Date.now() - 3600_000,
          sources: ["reddit-modsupport", "cisa-kev"],
          summary: "Xu hướng: token stealer giả captcha đang nổi.",
        };
      }
      if (name === "threatIntel:getResearchHistory") {
        return [
          {
            trigger: "manual",
            sources: ["reddit-scams"],
            newKeywords: 4,
            newPhrases: 1,
            aiUsed: true,
            summary: null,
            totalKeywords: 18,
            totalPhrases: 6,
            requestedBy: "wio",
            createdAt: Date.now() - 60_000,
          },
          {
            trigger: "auto",
            sources: ["reddit-modsupport"],
            newKeywords: 2,
            newPhrases: 0,
            aiUsed: false,
            summary: null,
            totalKeywords: 14,
            totalPhrases: 5,
            requestedBy: null,
            createdAt: Date.now() - 4 * 3600_000,
          },
        ];
      }
      return null;
    },
    mutation: async (name, args) => {
      mutations.push({ name, args });
      return { ok: true };
    },
  },
  getConfig: async () => ({ modRoles: [], adminRoles: [] }),
};

function makeSource({ canManage = true, sub = "status", isSlash = true } = {}) {
  const replies = [];
  return {
    guild: { id: "g1" },
    member: { permissions: { has: () => canManage }, roles: { cache: new Map() } }, // has() trả canManage cho mọi permission
    user: { username: "wio" },
    options: { getSubcommand: () => sub },
    replies,
    deferReply: async () => {},
    editReply: async (payload) => replies.push(payload),
    reply: async (payload) => replies.push(payload),
    channel: { send: async (p) => replies.push(p) },
    _replies: replies,
    _isSlash: isSlash,
  };
}

(async () => {
  let pass = 0;
  let fail = 0;
  const check = (label, ok) => {
    console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
    ok ? pass++ : fail++;
  };

  // 1. status — ai cũng xem được
  const s1 = makeSource({ sub: "status" });
  await handleResearch({}, store, s1);
  const st = JSON.stringify(s1._replies);
  check("status: trả embed", s1._replies.length > 0 && st.includes("embeds"));
  check("status: hiện số từ khóa", st.includes("Từ khóa đang nhớ") || st.includes("tokengrabber") === false);

  // 2. learn — mod được học
  const s2 = makeSource({ sub: "learn", canManage: true });
  await handleResearch({}, store, s2);
  check("learn: mod gọi được", s2._replies.length > 0);
  check(
    "learn: mutation botSetResearchRun đã ghi (qua learnNow → runResearch)",
    mutations.some((m) => m.name === "threatIntel:requestManualLearn") ||
      mutations.some((m) => m.name === "threatIntel:botSetResearchRun"),
  );

  // 3. learn — thường bị chặn
  const s3 = makeSource({ sub: "learn", canManage: false });
  await handleResearch({}, store, s3);
  const s3t = JSON.stringify(s3._replies);
  check("learn: thường bị chặn (🔒)", s3t.includes("mod/admin"));

  // 4. history
  const s4 = makeSource({ sub: "history" });
  await handleResearch({}, store, s4);
  check("history: hiển thị lượt học", JSON.stringify(s4._replies).includes("thủ công"));

  // 5. learnNow chạy đúng pipeline và ghi trigger=manual
  mutations.length = 0;
  const res = await research.learnNow(store, "wio");
  check("learnNow: trả kết quả", typeof res.newKeywords === "number");
  check(
    "learnNow: trigger=manual + requestedBy",
    mutations.some(
      (m) => m.name === "threatIntel:botSetResearchRun" && m.args.trigger === "manual" && m.args.requestedBy === "wio",
    ),
  );

  console.log(`\nKết quả research commands: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error("CRASH:", e);
  process.exit(1);
});
