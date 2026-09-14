// Test 3 tầng External App Guard (antinuke/externalApp.js):
//   Tầng 1: handleExternalApp — audit log IntegrationCreate (loạt kết nối app)
//   Tầng 2: handleExternalAppMessage — spam do app gửi (webhook/bot lạ)
//   Tầng 3: handleButtonRaid — spam bấm nút trên tin mồi của app
// Che phủ: AI raid / AI not-raid / AI offline, exempt (owner/whitelist/bot tin cậy),
// phân biệt app ngoài vs bot được mời vs kết nối twitch/youtube, dedupe 1 làn sóng,
// xóa webhook + truy thủ phạm, debounce bấm nút. Không mạng, không DB thật.
// Chạy: node scripts/test-external-app-layers.cjs
const path = require("path");

const Module = require("module");
const fs = require("fs");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === "discord.js") return path.join(__dirname, "..", "bot", "test-djs-mock.cjs");
  return origResolve.call(this, request, ...args);
};
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
module.exports = {
  Colors: new Proxy({}, { get: () => 0x000000 }),
  EmbedBuilder,
  PermissionFlagsBits: { ManageGuild: 1n << 5n, Administrator: 1n << 3n, ManageRoles: 1n << 28n, ManageWebhooks: 1n << 29n, BanMembers: 1n << 2n },
  UserFlags: { VerifiedBot: 1n << 16n },
  AuditLogEvent: new Proxy({}, { get: (t, k) => (t[k] ??= Symbol(k)) }),
};
`,
);

(async () => {
  // ---- Bộ đếm + store giả (mutation chỉ ghi nhận, không mạng) ----
  const calls = { recordEvent: [], raidSample: [], modAction: [], ban: [], kick: [], timeout: [], dm: [], logs: [], cases: [], lockdown: [], webhookDeleted: [], msgDeleted: [] };
  const mutatedEvents = () => calls.recordEvent;

  let config = baseConfig();
  const store = {
    client: { mutation: async (name, args) => {
      if (name === "bot_writes:botRecordAntinukeEvent") { calls.recordEvent.push(args); return { caseNumber: 1 }; }
      if (name === "bot_writes:botRecordRaidSample") { calls.raidSample.push(args); return {}; }
      if (name === "bot_writes:botRecordModAction") { calls.modAction.push(args); return { caseNumber: 77 }; }
      return {};
    } },
    getConfig: async () => config,
  };

  function baseConfig(overrides = {}) {
    return {
      antinukeEnabled: true,
      lockdownEnabled: false,
      modules: [
        { module: "externalAppRaid", enabled: true, threshold: 2, windowSeconds: 15, punish: "kick", timeoutSeconds: 600, whitelistRoles: [], actions: ["kick"] },
      ],
      whitelistUsers: [],
      whitelistRoles: [],
      adminRoles: [],
      modRoles: [],
      ...overrides,
    };
  }

  // ---- Heat giả: trả kết quả cố định để đo được hình phạt ----
  const heat = {
    add: async () => ({ tier: "warn", escalated: false, score: 10 }),
    markPunished: () => {},
    resetGuild: () => {},
  };

  // ---- client giả: guilds cache + users fetch (cho check tick VerifiedBot) ----
  function makeClient() {
    return {
      user: { id: "bot-self" },
      guilds: { cache: new Map() },
      on: () => {},
      users: { fetch: async () => { throw new Error("unknown user"); } },
    };
  }

  // Truy cập 3 tầng qua các factory riêng (index không expose layer handles).
  const createState = require("../bot/src/handlers/antinuke/state");
  const createAi = require("../bot/src/handlers/antinuke/ai");
  const createRaidIntel = require("../bot/src/handlers/antinuke/raidIntel");
  const createEnforce = require("../bot/src/handlers/antinuke/enforce");
  const createExternalApp = require("../bot/src/handlers/antinuke/externalApp");
  const client = makeClient();
  const state = createState({ client, store });
  const ai = createAi({ state });
  const raidIntel = createRaidIntel({ client, store, ai });
  const core = createEnforce({ client, store, heat, state });
  const { handleExternalApp, handleExternalAppMessage, handleButtonRaid } = createExternalApp({ client, store, heat, state, core, ai, raidIntel });

  let pass = 0;
  let fail = 0;
  function check(cond, label) {
    if (cond) { pass++; console.log("PASS", label); }
    else { fail++; console.log("FAIL", label); }
  }
  const resetCalls = () => {
    calls.recordEvent.length = 0; calls.raidSample.length = 0; calls.modAction.length = 0;
    calls.ban.length = 0; calls.kick.length = 0; calls.timeout.length = 0; calls.dm.length = 0;
    calls.logs.length = 0; calls.cases.length = 0; calls.lockdown.length = 0;
    calls.webhookDeleted.length = 0; calls.msgDeleted.length = 0;
  };

  // ---- Mock member/guild ----
  function makeMember(id, { bot = false, admin = false, freshAcc = false, verifiedTick = false } = {}) {
    const createdTs = freshAcc ? Date.now() - 2 * 86_400_000 : Date.now() - 3 * 365 * 86_400_000;
    const flags = { has: (f) => verifiedTick && String(f) === String(1n << 16n) };
    return {
      id,
      user: { id, bot, username: id + "-name", tag: id + "-name#0001", createdTimestamp: createdTs, flags },
      permissions: { has: (p) => admin && String(p) === String(1n << 3n) },
      roles: { cache: new Set() },
      joinedTimestamp: Date.now() - (freshAcc ? 60_000 : 30 * 86_400_000),
      ban: async (opts) => { calls.ban.push({ id, reason: opts?.reason }); },
      kick: async (reason) => { calls.kick.push({ id, reason }); },
      timeout: async (ms, reason) => { calls.timeout.push({ id, ms, reason }); },
      send: async (content) => { calls.dm.push({ id, content }); },
      guild: null,
    };
  }

  function makeGuild({ membersMap = {}, ownerId = "owner-1" } = {}) {
    const members = {
      fetch: async (id) => membersMap[id] ?? null,
      cache: new Map(Object.entries(membersMap)),
    };
    const guild = {
      id: "g1",
      name: "Test Guild",
      available: true,
      ownerId,
      memberCount: 100,
      members,
      roles: { cache: new Map(), fetch: async () => null },
      channels: { cache: { filter: () => ({ first: () => [] }) } },
      client: makeClient(),
      fetchAuditLogs: async () => ({ entries: new Map() }),
    };
    for (const m of Object.values(membersMap)) m.guild = guild;
    return guild;
  }

  // ==== TẦNG 1: handleExternalApp (IntegrationCreate) ====
  console.log("\n===== TẦNG 1 — IntegrationCreate (audit) =====");

  {
    resetCalls();
    const raider = makeMember("raider-1", { freshAcc: true });
    const guild = makeGuild({ membersMap: { "raider-1": raider } });
    const entry = { executor: raider, target: { type: "discord", id: "app-9", name: "Free Nitro Generator" } };
    for (let i = 0; i < 3; i++) await handleExternalApp(entry, guild);
    const skip = mutatedEvents().find((e) => (e.action || "").includes("bỏ qua"));
    check(!skip, "T1: app scam + acc mới đủ nghi vấn — không bị bỏ qua là 'bình thường'");
    const punished = mutatedEvents().find((e) => e.punish && e.punish !== "none");
    check(!!punished, "T1: có ghi nhận xử phạt khi score >= 4 + đủ ngưỡng");
    check(calls.kick.length + calls.ban.length + calls.timeout.length > 0, "T1: thành viên bị áp hình phạt thật");
    const before = mutatedEvents().length;
    await handleExternalApp(entry, guild);
    check(mutatedEvents().length === before, "T1: dedupe — IntegrationCreate kế tiếp trong window không log vụ mới");
  }

  {
    resetCalls();
    const user = makeMember("user-1");
    const guild = makeGuild({ membersMap: { "user-1": user } });
    const entry = { executor: user, target: { type: "twitch", id: "tw-1", name: "My Twitch" } };
    for (let i = 0; i < 3; i++) await handleExternalApp(entry, guild);
    check(mutatedEvents().length === 0, "T1: kết nối twitch/youtube bị bỏ qua hoàn toàn");
  }

  {
    resetCalls();
    const user = makeMember("user-2");
    const botMember = makeMember("app-bot-1", { bot: true });
    const guild = makeGuild({ membersMap: { "user-2": user, "app-bot-1": botMember } });
    const entry = { executor: user, target: { type: "discord", id: "app-bot-1", name: "SomeApp" } };
    for (let i = 0; i < 3; i++) await handleExternalApp(entry, guild);
    check(mutatedEvents().length === 0, "T1: app có bot thành viên server → bỏ qua (thuộc massBotAdd)");
  }

  {
    resetCalls();
    const user = makeMember("user-3");
    const client2 = makeClient();
    client2.users.fetch = async () => ({ bot: true, flags: { has: (f) => String(f) === String(1n << 16n) } });
    const guild = makeGuild({ membersMap: { "user-3": user } });
    guild.client = client2;
    const entry = { executor: user, target: { type: "discord", id: "verified-app", name: "VerifiedApp" } };
    for (let i = 0; i < 3; i++) await handleExternalApp(entry, guild);
    check(mutatedEvents().length === 0, "T1: bot xác minh (tick) không bị coi là external app");
  }

  {
    resetCalls();
    const owner = makeMember("owner-1", { freshAcc: true });
    const guild = makeGuild({ membersMap: { "owner-1": owner } });
    const entry = { executor: owner, target: { type: "discord", id: "app-x", name: "Free Nitro Generator" } };
    for (let i = 0; i < 3; i++) await handleExternalApp(entry, guild);
    check(mutatedEvents().every((e) => e.punish === "none" || !e.punish), "T1: owner không bị phạt (exempt)");
  }

  // ==== TẦNG 2: handleExternalAppMessage (spam qua webhook/bot) ====
  console.log("\n===== TẦNG 2 — tin nhắn spam của app =====");

  function makeMsg(guild, { webhookId = null, content = "hello", embeds = [] } = {}) {
    return {
      guild,
      channel: { id: "ch-1", isDMBased: () => false, fetchWebhooks: async () => new Map() },
      author: { id: "author-1", bot: !webhookId ? true : false, username: webhookId ? "EvilApp" : "BotName" },
      webhookId,
      applicationId: null,
      content,
      embeds,
      components: [],
      id: "m" + Math.random().toString(36).slice(2),
      deletable: true,
      delete: async () => { calls.msgDeleted.push(1); },
      member: null,
    };
  }

  {
    resetCalls();
    const guild = makeGuild({ membersMap: {} });
    for (let i = 0; i < 5; i++) {
      await handleExternalAppMessage(makeMsg(guild, { webhookId: "wh-1", content: "FREE NITRO CLAIM NOW discord.gg/xyz" }));
    }
    const evt = mutatedEvents().find((e) => e.module === "externalAppRaid");
    check(!!evt, "T2: webhook spam lặp nội dung + link mời bị phát hiện");
    const punishEvt = mutatedEvents().find((e) => e.punish && e.punish !== "none");
    check(!!punishEvt, "T2: ghi nhận xử lý (không chỉ bỏ qua)");
  }

  {
    resetCalls();
    const guild = makeGuild({ membersMap: {} });
    for (let i = 0; i < 4; i++) {
      const msg = makeMsg(guild, { webhookId: "wh-carl", content: "log entry " + i });
      msg.author.username = "Carl-bot";
      await handleExternalAppMessage(msg);
    }
    check(mutatedEvents().length === 0, "T2: bot logging hợp pháp (Carl-bot) không bị xử lý");
  }

  {
    resetCalls();
    const guild = makeGuild({ membersMap: {} });
    config = baseConfig({ whitelistUsers: ["wh-ok"] });
    for (let i = 0; i < 6; i++) {
      await handleExternalAppMessage(makeMsg(guild, { webhookId: "wh-ok", content: "FREE NITRO discord.gg/x spam " + i }));
    }
    check(mutatedEvents().length === 0, "T2: app trong whitelist không bị xử lý");
    config = baseConfig();
  }

  // ==== TẦNG 3: handleButtonRaid ====
  console.log("\n===== TẦNG 3 — bấm nút spam trên tin app =====");

  function makeInteraction(guild, { userId = "clicker-1", msgId = "m-1" } = {}) {
    return {
      isMessageComponent: () => true,
      inGuild: () => true,
      guild,
      user: { id: userId, username: userId + "-u" },
      message: {
        id: msgId,
        webhookId: "wh-bait",
        author: { username: "BaitApp" },
        components: [{ components: [{ type: 2, label: "Claim", customId: "c1" }] }],
        channel: { id: "ch-9" },
        deletable: true,
        delete: async () => { calls.msgDeleted.push(1); },
      },
    };
  }

  {
    resetCalls();
    const clicker = makeMember("clicker-1");
    const guild = makeGuild({ membersMap: { "clicker-1": clicker } });
    for (let i = 0; i < 4; i++) {
      await handleButtonRaid(makeInteraction(guild, { userId: "clicker-1", msgId: "m-spam" }));
    }
    const evt = mutatedEvents().find((e) => e.module === "externalAppRaid");
    check(!!evt, "T3: spam bấm nút (4 lượt cùng người) bị phát hiện");
    check(calls.msgDeleted.length >= 1, "T3: tin mồi bị xóa");
    check(calls.kick.length + calls.ban.length + calls.timeout.length > 0, "T3: kẻ spam bấm bị phạt");
    check(!mutatedEvents().some((e) => (e.action || "").includes("làn sóng")), "T3: AI offline → không khóa kênh chỉ vì bấm nhiều");
    const before = mutatedEvents().length;
    await handleButtonRaid(makeInteraction(guild, { userId: "clicker-2", msgId: "m-spam" }));
    check(mutatedEvents().length === before, "T3: debounce — vụ đã xử lý trong window không kích hoạt lại");
  }

  {
    resetCalls();
    const guild = makeGuild({ membersMap: {} });
    const inter = makeInteraction(guild, { userId: "u-1", msgId: "m-clean" });
    inter.message.webhookId = null;
    for (let i = 0; i < 4; i++) await handleButtonRaid(inter);
    check(mutatedEvents().length === 0, "T3: nút bấm trên tin bot được mời (không phải webhook) không bị soi");
  }

  {
    resetCalls();
    // Minigame: 8 người khác nhau bấm tin app — AI offline + không spamClicker → bỏ qua
    const guild = makeGuild({ membersMap: {} });
    for (let i = 0; i < 8; i++) {
      await handleButtonRaid(makeInteraction(guild, { userId: "user-" + i, msgId: "m-game" }));
    }
    const evt = mutatedEvents().find((e) => e.module === "externalAppRaid");
    check(!evt || evt.punish === "none", "T3: minigame đông người bấm — AI offline → không phạt/khóa kênh oan");
  }

  console.log(`\nKết quả: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error("CRASH:", e);
  process.exit(1);
});
