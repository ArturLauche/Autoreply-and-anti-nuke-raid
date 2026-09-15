// Test lớp audit log (antinuke/audit.js) — pipeline xử lý MỌI nuke cấu trúc:
//   handleAuditEntry / handleAttributeEvent (massBan, massKick, massMessageDelete…)
//   routeAuditEntry (định tuyến audit → module), tickUnlocks, tickHeatResets
// Che phủ: ngưỡng thường vs bot gây hại (threshold 1), miễn owner/exempt,
// bot logging hợp pháp không bị xử lý oan, thiếu member → chỉ ghi nhận,
// dedupe 1 hành vi = 1 phạt, tick mở khóa + xóa nhiệt từ dashboard.
// Không mạng, không DB thật. Chạy: node scripts/test-audit-layers.cjs
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
  ChannelType: { GuildText: 0, GuildVoice: 2, GuildCategory: 4, GuildAnnouncement: 5, GuildForum: 15 },
};
`,
);

(async () => {
  const calls = {
    events: [],
    raidSamples: [],
    modActions: [],
    memberBans: [],
    memberKicks: [],
    memberTimeouts: [],
    mutations: [],
    unlockEdits: [],
    heatResets: [],
  };

  function baseConfig(overrides = {}) {
    return {
      antinukeEnabled: true,
      lockdownEnabled: false,
      logChannelId: null,
      modLogChannelId: null,
      modules: [
        {
          module: "massBan",
          enabled: true,
          threshold: 3,
          windowSeconds: 10,
          punish: "ban",
          timeoutSeconds: 600,
          actions: ["ban"],
          whitelistRoles: [],
        },
        {
          module: "massChannelDelete",
          enabled: true,
          threshold: 2,
          windowSeconds: 10,
          punish: "ban",
          timeoutSeconds: 600,
          actions: ["ban"],
          whitelistRoles: [],
        },
        {
          module: "massMessageDelete",
          enabled: true,
          threshold: 2,
          windowSeconds: 10,
          punish: "timeout",
          timeoutSeconds: 600,
          actions: ["timeout"],
          whitelistRoles: [],
        },
        {
          module: "adminSelfGrant",
          enabled: true,
          threshold: 1,
          windowSeconds: 10,
          punish: "ban",
          timeoutSeconds: 600,
          actions: ["ban"],
          whitelistRoles: [],
        },
      ],
      whitelistUsers: [],
      whitelistRoles: [],
      adminRoles: [],
      modRoles: [],
      ...overrides,
    };
  }

  const configs = new Map(); // guildId -> config (đổi được giữa các case)
  const store = {
    client: {
      mutation: async (name, args) => {
        calls.mutations.push({ name, args });
        if (name === "bot_writes:botRecordAntinukeEvent") {
          calls.events.push(args);
          return { caseNumber: 1 };
        }
        if (name === "bot_writes:botRecordRaidSample") return {};
        if (name === "bot_writes:botRecordModAction") {
          calls.modActions.push(args);
          return { caseNumber: 77 };
        }
        return {};
      },
    },
    getConfig: async (guildId) => configs.get(guildId) ?? null,
  };

  const heat = {
    add: async () => ({ tier: "timeout", escalated: false, score: 35 }),
    markPunished: () => {},
    resetGuild: (guildId, userId) => calls.heatResets.push({ guildId, userId }),
  };

  // ---- Mock member / guild ----
  function makeMember(id, { bot = false, admin = false, joinedDaysAgo = 400 } = {}) {
    return {
      id,
      guild: null, // gán khi tạo guild
      user: {
        id,
        bot,
        username: id + "-name",
        tag: id + "-name#0001",
        createdTimestamp: Date.now() - 3 * 365 * 86_400_000,
        avatar: "av",
        flags: { has: () => false },
      },
      permissions: { has: (p) => admin && String(p) === String(1n << 3n) },
      roles: { cache: new Set() },
      joinedTimestamp: Date.now() - joinedDaysAgo * 86_400_000,
      timeout: async () => calls.memberTimeouts.push(id),
      ban: async () => calls.memberBans.push(id),
      kick: async () => calls.memberKicks.push(id),
      send: async () => calls.dm.push(id),
    };
  }

  // entry executor: user object (như Discord audit log) — không phải member
  function makeExecutorUser(id, { bot = false, username = id + "-name" } = {}) {
    return { id, bot, username, tag: username + "#0001", flags: { has: () => false } };
  }

  function makeGuild(id, membersList = [], auditEntries = []) {
    const membersMap = new Map(membersList.map((m) => [m.id, m]));
    for (const m of membersList) m.guild = null;
    const entries = [...auditEntries];
    entries.first = () => entries[0] ?? null;
    const guild = {
      id,
      available: true,
      ownerId: "owner-1",
      name: "G-" + id,
      roles: { cache: new Map(), everyone: { id: id }, fetch: async () => null },
      members: {
        cache: membersMap,
        fetch: async (mid) => membersMap.get(mid) ?? null,
        ban: async (mid) => calls.memberBans.push(mid),
      },
      channels: {
        cache: (() => {
          const m = new Map([
            [
              "ch-1",
              {
                id: "ch-1",
                type: 0,
                isTextBased: () => true,
                isThread: () => false,
                isVoiceBased: () => false,
                viewable: true,
                permissionOverwrites: { edit: async () => calls.unlockEdits.push(id) },
                messages: { filter: () => ({ first: () => [] }), fetch: async () => ({ size: 0 }) },
              },
            ],
          ]);
          m.filter = (fn) => {
            const out = [...m.values()].filter(fn);
            out.first = (n) => (typeof n === "number" ? out.slice(0, n) : out[0]);
            out.sort = Array.prototype.sort.bind(out);
            return out;
          };
          return m;
        })(),
      },
      fetchAuditLogs: async () => ({ entries }),
      member: async () => null,
    };
    for (const m of membersList) m.guild = guild;
    return guild;
  }

  // Ghép các lớp như orchestrator thật (index.js) nhưng AI/raidIntel là giả để đo được.
  const createState = require("../bot/src/handlers/antinuke/state");
  const createAi = require("../bot/src/handlers/antinuke/ai");
  const createEnforce = require("../bot/src/handlers/antinuke/enforce");
  const createAudit = require("../bot/src/handlers/antinuke/audit");

  let client = { user: { id: "bot-self" }, guilds: { cache: new Map() }, on: () => {} };
  const state = createState({ client, store });
  const realAi = createAi({ state });
  const ai = {
    aiClassify: realAi.aiClassify, // giữ thật — AI offline trả individual (an toàn)
    clusterStats: (profiles) => ({
      total: profiles.length,
      suspicious: 0,
      ratio: 0,
      freshAccounts: 0,
      defaultAvatars: 0,
      machineNames: 0,
    }),
  };
  const raidIntel = {
    huntRaidSource: async () => ({ banned: false }),
    recordRaidSample: async (guild, config, sample) => calls.raidSamples.push(sample),
  };
  const core = createEnforce({ client, store, heat, state });
  const audit = createAudit({ client, store, heat, state, core, ai, raidIntel });

  let pass = 0;
  let fail = 0;
  function check(label, cond) {
    if (cond) {
      pass++;
      console.log("PASS", label);
    } else {
      fail++;
      console.log("FAIL", label);
    }
  }
  const clear = () => {
    for (const k of Object.keys(calls)) calls[k].length = 0;
  };

  // ── 1. massBan người thật đạt ngưỡng 3 → phạt lần thứ 3 ──
  {
    clear();
    const gid = "g-massban";
    const raider = makeMember("raider-1");
    const guild = makeGuild(gid, [raider]);
    configs.set(gid, baseConfig());
    client.guilds.cache.set(gid, guild);
    const exec = makeExecutorUser("raider-1");
    const entry = { executor: exec, target: { id: "victim" }, changes: [] };
    await audit.handleAuditEntry(entry, guild, "massBan", "x1");
    await audit.handleAuditEntry(entry, guild, "massBan", "x2");
    check(
      "dưới ngưỡng: chưa phạt, chưa ghi sự kiện",
      calls.memberBans.length === 0 && calls.events.length === 0,
    );
    await audit.handleAuditEntry(entry, guild, "massBan", "x3");
    check("đạt ngưỡng 3 → ban thủ phạm", calls.memberBans.includes("raider-1"));
    const ev = calls.events.find((e) => e.module === "massBan");
    check("ghi sự kiện massBan count=3", !!ev && ev.count === 3);
    check(
      "ghi mẫu raid sample cho threat intel",
      calls.raidSamples.some((s) => s.module === "massBan" && s.count === 3),
    );
  }

  // ── 2. Owner → miễn tuyệt đối ──
  {
    clear();
    const gid = "g-owner";
    const guild = makeGuild(gid, []);
    configs.set(gid, baseConfig());
    client.guilds.cache.set(gid, guild);
    const entry = { executor: makeExecutorUser("owner-1"), target: { id: "victim" }, changes: [] };
    await audit.handleAuditEntry(entry, guild, "massBan", "x");
    await audit.handleAuditEntry(entry, guild, "massBan", "x");
    await audit.handleAuditEntry(entry, guild, "massBan", "x");
    check(
      "owner exempt: không phạt, không ghi sự kiện",
      calls.memberBans.length === 0 && calls.events.length === 0,
    );
  }

  // ── 3. Bot logging hợp pháp (Carl-bot) ban bot spam → KHÔNG bị xử lý oan ──
  {
    clear();
    const gid = "g-carl";
    const guild = makeGuild(gid, []);
    configs.set(gid, baseConfig());
    client.guilds.cache.set(gid, guild);
    const entry = {
      executor: makeExecutorUser("carl-1", { username: "Carl-bot" }),
      target: { id: "v" },
      changes: [],
    };
    await audit.handleAuditEntry(entry, guild, "massBan", "x");
    await audit.handleAuditEntry(entry, guild, "massBan", "x");
    await audit.handleAuditEntry(entry, guild, "massBan", "x");
    check(
      "Carl-bot ban bot spam → không bị coi là nuke",
      calls.memberBans.length === 0 && calls.events.length === 0,
    );
  }

  // ── 4. Bot gây hại (vừa thêm, không tick) → ngưỡng hạ xuống 1, bị ban NGAY ──
  {
    clear();
    const gid = "g-hostile";
    const hostile = makeMember("nuke-bot", { bot: true, joinedDaysAgo: 0.001 });
    const guild = makeGuild(gid, [hostile]);
    configs.set(gid, baseConfig());
    client.guilds.cache.set(gid, guild);
    const entry = {
      executor: makeExecutorUser("nuke-bot", { bot: true }),
      target: { id: "v" },
      changes: [],
    };
    await audit.handleAuditEntry(entry, guild, "massBan", "x");
    const ev = calls.events.find((e) => e.module === "massBan");
    check("bot gây hại bị xử lý ngay ở lượt đầu (count=1)", !!ev && ev.count === 1);
    check("bot gây hại bị ban", calls.memberBans.includes("nuke-bot"));
  }

  // ── 5. Bot tin cậy (đã ở lại 8 ngày) làm moderation → đi theo ngưỡng thường ──
  {
    clear();
    const gid = "g-trusted";
    const trusted = makeMember("carl-old", { bot: true, joinedDaysAgo: 8 });
    const guild = makeGuild(gid, [trusted]);
    configs.set(gid, baseConfig());
    client.guilds.cache.set(gid, guild);
    const entry = {
      executor: makeExecutorUser("carl-old", { bot: true }),
      target: { id: "v" },
      changes: [],
    };
    await audit.handleAuditEntry(entry, guild, "massBan", "x");
    await audit.handleAuditEntry(entry, guild, "massBan", "x");
    check(
      "bot tin cậy dưới ngưỡng → chưa bị phạt",
      calls.memberBans.length === 0 && calls.events.length === 0,
    );
  }

  // ── 6. Executor ngoài server (fetch không thấy) + người → chỉ ghi nhận, không ban mù ──
  {
    clear();
    const gid = "g-gone";
    const guild = makeGuild(gid, []); // không có member nào trong cache
    configs.set(gid, baseConfig());
    client.guilds.cache.set(gid, guild);
    const entry = { executor: makeExecutorUser("gone-user"), target: { id: "v" }, changes: [] };
    for (let i = 0; i < 3; i++) await audit.handleAuditEntry(entry, guild, "massBan", "x");
    const ev = calls.events.find((e) => e.module === "massBan");
    check("không fetch được member → không ban mù", calls.memberBans.length === 0);
    check(
      "vẫn ghi sự kiện với action 'đã ghi nhận'",
      !!ev && String(ev.action).startsWith("đã ghi nhận"),
    );
  }

  // ── 7. massMessageDelete qua handleAttributeEvent (MessageBulkDelete) ──
  {
    clear();
    const gid = "g-bulk";
    const raider = makeMember("bulk-raider");
    const guild = makeGuild(gid, [raider]);
    configs.set(gid, baseConfig());
    client.guilds.cache.set(gid, guild);
    guild.fetchAuditLogs = async () => ({
      entries: (() => {
        const arr = [{ executor: makeExecutorUser("bulk-raider"), target: null }];
        arr.first = () => arr[0];
        arr.find = Array.prototype.find.bind(arr);
        return arr;
      })(),
    });
    const messages = { first: () => ({ guild, channelId: "ch-1" }), size: 50 };
    await audit.handleMessageBulk(messages);
    await audit.handleMessageBulk(messages);
    const ev = calls.events.find((e) => e.module === "massMessageDelete");
    check(
      "xóa tin hàng loạt đạt ngưỡng → timeout thủ phạm",
      !!ev && calls.memberTimeouts.includes("bulk-raider"),
    );
  }

  // ── 8. tickHeatResets: dashboard bấm "Xóa nhiệt" → bot reset + xóa cờ ──
  {
    clear();
    const gid = "g-heat";
    const guild = makeGuild(gid, []);
    configs.set(gid, baseConfig({ heatResetRequested: true, heatResetUserId: "u9" }));
    client.guilds.cache.set(gid, guild);
    await audit.tickHeatResets();
    check(
      "xóa nhiệt guild theo yêu cầu dashboard",
      calls.heatResets.some((h) => h.guildId === gid && h.userId === "u9"),
    );
    check(
      "xóa cờ heatResetRequested sau khi reset",
      calls.mutations.some(
        (m) => m.name === "bot_writes:botClearHeatReset" && m.args.guildId === gid,
      ),
    );
  }

  // ── 9. tickUnlocks: lockdown hết hạn sau restart → mở khóa ĐÚNG 1 LẦN ──
  {
    clear();
    const gid = "g-lock";
    const guild = makeGuild(gid, []);
    configs.set(gid, baseConfig({ lockdownUntil: Date.now() - 1000 }));
    client.guilds.cache.set(gid, guild);
    await audit.tickUnlocks();
    const unlocks = calls.mutations.filter(
      (m) => m.name === "bot_writes:botLockState" && m.args.guildId === gid,
    );
    check(
      "lockdown hết hạn → mở khóa (reset overwrite + ghi trạng thái)",
      calls.unlockEdits.includes(gid) && unlocks.length === 1 && unlocks[0].args.until === null,
    );
    await audit.tickUnlocks();
    const unlocks2 = calls.mutations.filter(
      (m) => m.name === "bot_writes:botLockState" && m.args.guildId === gid,
    );
    check("cùng 1 mốc hết hạn → KHÔNG mở khóa lặp lại (chống spam log)", unlocks2.length === 1);
  }

  // ── 10. tickUnlocks: đang trong thời gian khóa (restart giữa chừng) → nhớ lại trạng thái ──
  {
    clear();
    const gid = "g-lock2";
    const guild = makeGuild(gid, []);
    configs.set(gid, baseConfig({ lockdownUntil: Date.now() + 60_000 }));
    client.guilds.cache.set(gid, guild);
    await audit.tickUnlocks();
    check(
      "đang khóa (chưa hết hạn) → không mở khóa",
      !calls.mutations.some((m) => m.name === "bot_writes:botLockState"),
    );
  }

  // ── 11. routeAuditEntry: định tuyến đúng module cho từng loại audit ──
  {
    clear();
    const gid = "g-route";
    const adminRole = {
      id: "role-admin",
      name: "Admin",
      permissions: { has: (p) => String(p) === String(1n << 3n) },
    };
    const normalRole = { id: "role-x", name: "X", permissions: { has: () => false } };
    const guild = makeGuild(gid, []);
    guild.roles.cache = new Map([
      ["role-admin", adminRole],
      ["role-x", normalRole],
    ]);
    const AE = require("discord.js").AuditLogEvent;
    const r1 = await audit.routeAuditEntry(
      { action: AE.WebhookCreate, target: { name: "w1" }, changes: [] },
      guild,
    );
    check("WebhookCreate → massWebhookCreate", r1?.module === "massWebhookCreate");
    const r2 = await audit.routeAuditEntry(
      {
        action: AE.ChannelUpdate,
        target: { name: "c" },
        changes: [{ key: "permission_overwrites" }],
      },
      guild,
    );
    check("ChannelUpdate đổi quyền → massChannelOverwrite", r2?.module === "massChannelOverwrite");
    const r3 = await audit.routeAuditEntry(
      { action: AE.ChannelUpdate, target: { name: "c" }, changes: [{ key: "name" }] },
      guild,
    );
    check("ChannelUpdate đổi tên → massChannelRename", r3?.module === "massChannelRename");
    const r4 = await audit.routeAuditEntry(
      {
        action: AE.MemberRoleUpdate,
        target: { id: "u1" },
        changes: [{ key: "$add", new: [{ id: "role-admin" }] }],
      },
      guild,
    );
    check("cấp role admin cho người khác → adminSelfGrant", r4?.module === "adminSelfGrant");
    const r5 = await audit.routeAuditEntry(
      {
        action: AE.MemberRoleUpdate,
        target: { id: "u1" },
        changes: [{ key: "$add", new: [{ id: "role-x" }] }],
      },
      guild,
    );
    check(
      "cấp role thường → massRoleAssign (không phải leo thang)",
      r5?.module === "massRoleAssign",
    );
    const r6 = await audit.routeAuditEntry(
      { action: AE.BotAdd, target: { username: "nuke-bot" }, changes: [] },
      guild,
    );
    check("BotAdd → massBotAdd", r6?.module === "massBotAdd");
    const r7 = await audit.routeAuditEntry(
      { action: AE.GuildUpdate, target: null, changes: [{ key: "icon_hash" }] },
      guild,
    );
    check("đổi icon server → guildTamper", r7?.module === "guildTamper");
    const r8 = await audit.routeAuditEntry(
      { action: AE.EmojiDelete, target: null, changes: [] },
      guild,
    );
    check("audit không liên quan → null (không xử lý)", r8 === null);
  }

  // ── 12. Dedupe: cùng 1 hành vi fire 2 lần audit → chỉ 1 sự kiện ──
  {
    clear();
    const gid = "g-dedupe";
    const raider = makeMember("dedupe-raider");
    const guild = makeGuild(gid, [raider]);
    configs.set(
      gid,
      baseConfig({
        modules: baseConfig().modules.map((m) =>
          m.module === "massChannelDelete" ? { ...m, threshold: 1 } : m,
        ),
      }),
    );
    client.guilds.cache.set(gid, guild);
    const entry = { executor: makeExecutorUser("dedupe-raider"), target: { id: "v" }, changes: [] };
    await audit.handleAuditEntry(entry, guild, "massChannelDelete", "x");
    await audit.handleAuditEntry(entry, guild, "massChannelDelete", "x");
    const evs = calls.events.filter((e) => e.module === "massChannelDelete");
    check(
      "1 hành vi = 1 phạt + 1 sự kiện (audit log thường fire 2 lần)",
      evs.length === 1 && calls.memberBans.filter((b) => b === "dedupe-raider").length === 1,
    );
  }

  fs.unlinkSync(path.join(__dirname, "..", "bot", "test-djs-mock.cjs"));
  console.log(`\nKết quả audit layers: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error("CRASH:", e);
  process.exit(1);
});
