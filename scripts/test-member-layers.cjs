// Test lớp thành viên (antinuke/members.js) — chỗ dễ ban oan nhất:
//   handleSuspiciousBotJoin — CHỈ cảnh báo bot lạ (không phạt), exempt + dedupe
//   handleHitAndRunLeave — bot tự rời ngay sau khi được thêm (bot nuke kinh điển);
//                          bỏ qua đúng: bot tin cậy, bot logging, bị kick (có audit)
//   handleRaidJoin — gate chống ban nhầm: hồ sơ bình thường → không phạt không khóa;
//                    cụm acc mới đáng ngờ → chỉ phạt acc ĐÁNG NGỜ, người thật bỏ qua
// Không mạng, không DB thật. Chạy: node scripts/test-member-layers.cjs
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
  const calls = {
    events: [],
    raidSamples: [],
    memberBans: [],
    memberKicks: [],
    memberTimeouts: [],
    memberDms: [],
    mutations: [],
    purgeCalls: [],
  };

  function baseConfig(overrides = {}) {
    return {
      antinukeEnabled: true,
      lockdownEnabled: false,
      logChannelId: null,
      modLogChannelId: null,
      modules: [
        {
          module: "suspiciousBotAlert",
          enabled: true,
          threshold: 1,
          windowSeconds: 10,
          punish: "warn",
          timeoutSeconds: 600,
          whitelistRoles: [],
        },
        {
          module: "botHitAndRun",
          enabled: true,
          threshold: 1,
          windowSeconds: 10,
          punish: "ban",
          timeoutSeconds: 600,
          whitelistRoles: [],
        },
        {
          module: "massJoin",
          enabled: true,
          threshold: 5,
          windowSeconds: 10,
          punish: "kick",
          timeoutSeconds: 600,
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

  const configs = new Map();
  const store = {
    client: {
      mutation: async (name, args) => {
        calls.mutations.push({ name, args });
        if (name === "bot_writes:botRecordAntinukeEvent") {
          calls.events.push(args);
          return { caseNumber: 1 };
        }
        return {};
      },
    },
    getConfig: async (guildId) => configs.get(guildId) ?? null,
  };

  const heat = {
    add: async () => ({ tier: "warn", escalated: false, score: 10 }),
    markPunished: () => {},
    resetGuild: () => {},
  };

  // member acc MỚI đáng ngờ: acc < 7 ngày, không avatar, tên máy móc (user123456)
  function makeMember(id, { bot = false, fresh = true, avatar = null, username, joinedTs } = {}) {
    return {
      id,
      guild: null,
      user: {
        id,
        bot,
        username: username ?? (fresh ? "u" + id.slice(-6) : "nguoi-that-" + id.slice(-3)),
        tag: (username ?? id) + "#0001",
        createdTimestamp: fresh ? Date.now() - 2 * 86_400_000 : Date.now() - 400 * 86_400_000,
        avatar,
        flags: { has: () => false },
      },
      permissions: { has: () => false },
      roles: { cache: new Set() },
      joinedTimestamp: joinedTs ?? Date.now(),
      timeout: async () => calls.memberTimeouts.push(id),
      ban: async () => calls.memberBans.push(id),
      kick: async () => calls.memberKicks.push(id),
      send: async () => calls.memberDms.push(id),
    };
  }

  function makeGuild(id, membersList = []) {
    const membersMap = new Map(membersList.map((m) => [m.id, m]));
    const guild = {
      id,
      available: true,
      ownerId: "owner-1",
      name: "G-" + id,
      roles: { cache: new Map(), everyone: { id } },
      members: {
        cache: membersMap,
        fetch: async (mid) => membersMap.get(mid) ?? null,
      },
      channels: { cache: { filter: () => [] } },
      fetchAuditLogs: async () => ({ entries: { first: () => null, find: () => undefined } }),
    };
    for (const m of membersList) m.guild = guild;
    return guild;
  }

  const createState = require("../bot/src/handlers/antinuke/state");
  const createAi = require("../bot/src/handlers/antinuke/ai");
  const createEnforce = require("../bot/src/handlers/antinuke/enforce");
  const createMembers = require("../bot/src/handlers/antinuke/members");

  let client = { user: { id: "bot-self" }, guilds: { cache: new Map() }, on: () => {} };
  const state = createState({ client, store });
  const realAi = createAi({ state });
  const ai = {
    aiClassify: realAi.aiClassify,
    clusterStats: (profiles) => {
      // Dùng hàm thật từ shared để gate chống ban nhầm chạy đúng logic
      const { joinClusterSuspicion } = require("../bot/src/handlers/antinuke/shared");
      return joinClusterSuspicion(profiles);
    },
  };
  const raidIntel = {
    huntRaidSource: async () => ({ banned: false }),
    recordRaidSample: async (guild, config, sample) => calls.raidSamples.push(sample),
  };
  const core = createEnforce({ client, store, heat, state });
  const members = createMembers({ store, state, core, ai, raidIntel });

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

  // ── 1. Bot lạ được thêm → CHỈ cảnh báo, KHÔNG phạt ──
  {
    clear();
    const gid = "g-alert";
    const strangeBot = makeMember("strange-bot", { bot: true, fresh: true });
    const guild = makeGuild(gid, [strangeBot]);
    configs.set(gid, baseConfig());
    client.guilds.cache.set(gid, guild);
    await members.handleSuspiciousBotJoin(strangeBot);
    check(
      "bot lạ → cảnh báo + ghi sự kiện, KHÔNG phạt",
      calls.events.some((e) => e.module === "suspiciousBotAlert") &&
        calls.memberBans.length === 0 &&
        calls.memberKicks.length === 0 &&
        calls.memberTimeouts.length === 0,
    );
    // Dedupe: bot vào/ra liên tục trong 10 phút chỉ cảnh báo 1 lần
    await members.handleSuspiciousBotJoin(strangeBot);
    check(
      "cùng bot cảnh báo lại trong 10 phút → không lặp",
      calls.events.filter((e) => e.module === "suspiciousBotAlert").length === 1,
    );
  }

  // ── 2. Bot có tick VerifiedBot → không cảnh báo ──
  {
    clear();
    const gid = "g-verified";
    const verifiedBot = makeMember("verified-bot", { bot: true });
    verifiedBot.user.flags = { has: (f) => String(f) === String(1n << 16n) };
    const guild = makeGuild(gid, [verifiedBot]);
    configs.set(gid, baseConfig());
    client.guilds.cache.set(gid, guild);
    await members.handleSuspiciousBotJoin(verifiedBot);
    check("bot verified (tick Discord) → không cảnh báo", calls.events.length === 0);
  }

  // ── 3. Hit-and-run: bot vào rồi TỰ RỜI trong cửa sổ → xử lý ──
  {
    clear();
    const gid = "g-har";
    const nukeBot = makeMember("har-bot", { bot: true });
    const guild = makeGuild(gid, [nukeBot]);
    configs.set(gid, baseConfig());
    client.guilds.cache.set(gid, guild);
    // Giả lập bot được thêm 30s trước (state botAddTimes do orchestrator index.js ghi)
    state.state.botAddTimes.set(gid + ":har-bot", Date.now() - 30_000);
    await members.handleHitAndRunLeave(nukeBot, null); // null = TỰ RỜI (không có audit kick)
    check(
      "bot tự rời < 10 phút sau khi thêm → xử lý hit-and-run",
      calls.events.some((e) => e.module === "botHitAndRun"),
    );
    // Một lần rời là hết — entry cũ bị xóa, gọi lại không xử lý nữa
    await members.handleHitAndRunLeave(nukeBot, null);
    check(
      "entry cũ bị xóa → không xử lý lặp",
      calls.events.filter((e) => e.module === "botHitAndRun").length === 1,
    );
  }

  // ── 4. Hit-and-run bỏ qua đúng: bot tin cậy / bot logging / bị kick / rời muộn ──
  {
    // 4a. Bot tin cậy (đã ở lại 8 ngày)
    clear();
    const gid = "g-har-trusted";
    const trustedBot = makeMember("trusted-bot", {
      bot: true,
      joinedTs: Date.now() - 8 * 86_400_000,
    });
    const guild = makeGuild(gid, [trustedBot]);
    configs.set(gid, baseConfig());
    client.guilds.cache.set(gid, guild);
    state.state.botAddTimes.set(gid + ":trusted-bot", Date.now() - 30_000);
    await members.handleHitAndRunLeave(trustedBot, null);
    check("bot tin cậy rời (mod gỡ cấu hình) → không xử lý", calls.events.length === 0);

    // 4b. Bị kick (có executor) → mod kick, không phải tự rời
    clear();
    state.state.botAddTimes.set(gid + ":trusted-bot", Date.now() - 30_000);
    await members.handleHitAndRunLeave(trustedBot, { id: "mod-1" });
    check("bot bị kick bởi mod → không kết luận hit-and-run", calls.events.length === 0);

    // 4c. Bot logging (Carl-bot) tự gỡ
    clear();
    const carl = makeMember("carl-x", { bot: true, username: "Carl-bot" });
    state.state.botAddTimes.set(gid + ":carl-x", Date.now() - 30_000);
    await members.handleHitAndRunLeave(carl, null);
    check("bot logging tự rời (gỡ cấu hình bình thường) → không xử lý", calls.events.length === 0);

    // 4d. Rời SAU cửa sổ 10 phút → không kết luận
    clear();
    state.state.botAddTimes.set(gid + ":old-leave", Date.now() - 30 * 60_000);
    const lateBot = makeMember("old-leave", { bot: true });
    await members.handleHitAndRunLeave(lateBot, null);
    check("bot rời sau 30 phút → không phải hit-and-run", calls.events.length === 0);

    // 4e. Người thật rời → không liên quan
    clear();
    const human = makeMember("human-1", { bot: false });
    await members.handleHitAndRunLeave(human, null);
    check("người thật rời → không xử lý", calls.events.length === 0);
  }

  // ── 5. massJoin: làn sóng hồ sơ BÌNH THƯỜNG (tăng trưởng tự nhiên) → KHÔNG phạt ──
  {
    clear();
    const gid = "g-natural";
    const humans = [];
    for (let i = 0; i < 5; i++) {
      humans.push(makeMember("real-" + i, { fresh: false, avatar: "av" + i }));
    }
    const guild = makeGuild(gid, humans);
    configs.set(gid, baseConfig());
    client.guilds.cache.set(gid, guild);
    for (const h of humans) await members.handleRaidJoin(h);
    const ev = calls.events.find((e) => e.module === "massJoin");
    check(
      "5 người thật (acc cũ + avatar) vào cùng lúc → chỉ ghi nhận, không phạt ai",
      !!ev &&
        String(ev.action).includes("bỏ qua") &&
        calls.memberKicks.length === 0 &&
        calls.memberBans.length === 0,
    );
    check(
      "không khóa kênh oan",
      !calls.mutations.some(
        (m) =>
          m.name === "bot_writes:botLockState" &&
          m.args.until !== null &&
          m.args.until !== undefined,
      ),
    );
  }

  // ── 6. massJoin: làn sóng acc mới đáng ngờ → chỉ phạt acc ĐÁNG NGỜ, người thật đi kèm được bỏ qua ──
  {
    clear();
    const gid = "g-raid";
    const bots = [];
    for (let i = 0; i < 6; i++) {
      // acc mới + không avatar + tên máy móc → suspicion >= 3
      bots.push(makeMember("alt" + String(100000 + i), { fresh: true, avatar: null }));
    }
    const realFriend = makeMember("guest-9", { fresh: false, avatar: "av" }); // hồ sơ bình thường lẫn trong sóng
    const guild = makeGuild(gid, [...bots, realFriend]);
    configs.set(gid, baseConfig());
    client.guilds.cache.set(gid, guild);
    for (const m of [...bots, realFriend]) await members.handleRaidJoin(m);
    // Window 10s còn chưa hết → các join sau vẫn cộng dồn: module bắn NHIỀU LẦN (5, 6, 7).
    // Lấy sự kiện CUỐI (đủ toàn bộ 7 join) để khẳng định guest-9 được bỏ qua.
    const ev = calls.events.filter((e) => e.module === "massJoin").at(-1);
    const punished = new Set([...calls.memberKicks, ...calls.memberBans, ...calls.memberTimeouts]);
    check(
      "cụm acc mới đáng ngờ → bị xử lý",
      calls.events.some((e) => e.module === "massJoin") && punished.size >= 3,
    );
    check(
      "người thật lẫn trong sóng được bỏ qua (không bị kick oan)",
      !punished.has("guest-9") && String(ev?.action ?? "").includes("bỏ qua"),
    );
    check(
      "ghi mẫu raid sample cho threat intel",
      calls.raidSamples.some((s) => s.module === "massJoin"),
    );
  }

  // ── 7. massJoin dưới ngưỡng → hoàn toàn im lặng ──
  {
    clear();
    const gid = "g-quiet";
    const few = [makeMember("solo-1", { fresh: true }), makeMember("solo-2", { fresh: true })];
    const guild = makeGuild(gid, few);
    configs.set(gid, baseConfig());
    client.guilds.cache.set(gid, guild);
    for (const m of few) await members.handleRaidJoin(m);
    check(
      "2 người vào (dưới ngưỡng 5) → không ghi sự kiện",
      !calls.events.some((e) => e.module === "massJoin"),
    );
  }

  fs.unlinkSync(path.join(__dirname, "..", "bot", "test-djs-mock.cjs"));
  console.log(`\nKết quả member layers: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error("CRASH:", e);
  process.exit(1);
});
