// Test Join Gate (bot/src/handlers/joinGate.js) — cổng vào server + Alt pipeline:
//   - bot → bỏ qua; verify đầy đủ → gán role unverified
//   - joinGate: tuổi acc / avatar / flag / raid-kick + whitelist + punish
//   - alt whitelist (user + role) → bỏ qua hoàn toàn
//   - analysis pass → chỉ ghi join history (recordJoin), không phạt
//   - analysis punish → executePunishment + markJoinPunished + event antinuke
// Không mạng, không DB thật. Chạy: node scripts/test-join-gate.cjs
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
  addFields(...f) { this.d.fields = [...(this.d.fields ?? []), ...f.flat(Infinity)]; return this; }
  setTimestamp() { return this; }
  setFooter(f) { this.d.footer = f; return this; }
}
module.exports = {
  Colors: new Proxy({}, { get: () => 0x000000 }),
  EmbedBuilder,
  PermissionFlagsBits: { ManageGuild: 1n << 5n, Administrator: 1n << 3n, ManageChannels: 1n << 4n },
  UserFlags: { VerifiedBot: 1n << 16n },
  ChannelType: { GuildText: 0, GuildVoice: 2 },
};
`,
);

(async () => {
  const DAY = 86_400_000;
  const joinGate = require("../bot/src/handlers/joinGate");

  const calls = {
    kicks: [],
    bans: [],
    timeouts: [],
    roleAdds: [],
    mutations: [],
    queries: [],
  };
  let config = {};
  const configs = new Map();

  const store = {
    client: {
      query: async (name) => {
        calls.queries.push(name);
        return name === "altDetection:botGetJoinHistory" ? [] : [];
      },
      mutation: async (name, args) => {
        calls.mutations.push({ name, args });
        return {};
      },
    },
    getConfig: async (guildId) => configs.get(guildId) ?? config,
  };

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

  function mkMember(
    id,
    username,
    { bot = false, avatar = "av", createdDaysAgo = 400, flagsBitfield = 128 } = {},
  ) {
    return {
      id,
      guild: null,
      user: {
        id,
        bot,
        username,
        avatar,
        createdTimestamp: Date.now() - createdDaysAgo * DAY,
        flags: { bitfield: flagsBitfield },
      },
      joinedTimestamp: Date.now(),
      roles: {
        cache: new Set(),
        add: async () => calls.roleAdds.push(id),
        some: () => false,
      },
      permissions: { has: () => false },
      kick: async () => calls.kicks.push(id),
      ban: async () => calls.bans.push(id),
      timeout: async () => calls.timeouts.push(id),
      send: async () => {},
    };
  }
  function mkGuild(id, members = []) {
    const cache = new Map(members.map((m) => [m.id, m]));
    const guild = {
      id,
      name: "G-" + id,
      ownerId: "owner-1",
      members: {
        cache,
        fetch: async (mid) => cache.get(mid) ?? null,
        ban: async () => {},
      },
      roles: { cache: new Map(), everyone: { id } },
      channels: { cache: { filter: () => [], values: () => [].values() } },
      bans: { fetch: async () => new Map() },
      fetchAuditLogs: async () => ({ entries: { first: () => null } }),
    };
    for (const m of members) m.guild = guild;
    // joinGate nhận member RỜI guild (member.guild phải tồn tại trước khi gọi) —
    // hàm này không tự gán guild như Discord runtime.
    guild.addMember = (m) => {
      m.guild = guild;
      cache.set(m.id, m);
      return m;
    };
    return guild;
  }

  const client = { user: { id: "bot-self" }, guilds: { cache: new Map() } };

  // ── 1. Bot join → bỏ qua hoàn toàn ──
  {
    clear();
    const g = mkGuild("g-1");
    configs.set("g-1", {});
    client.guilds.cache.set("g-1", g);
    await joinGate(client, mkMember("bot-1", "somebot", { bot: true }), store);
    check(
      "bot join → không kick/ban/timeout, không mutation",
      calls.kicks.length + calls.bans.length + calls.timeouts.length === 0 &&
        calls.mutations.length === 0,
    );
  }

  // ── 2. Verify đầy đủ → gán role unverified ──
  {
    clear();
    const g = mkGuild("g-verify");
    configs.set("g-verify", {
      verifyEnabled: true,
      unverifiedRoleId: "r-unv",
      verifiedRoleId: "r-ver",
      verifyChannelId: "c-verify",
    });
    client.guilds.cache.set("g-verify", g);
    const m = g.addMember(mkMember("new-1", "thanhvienmoi"));
    await joinGate(client, m, store);
    check("verify setup đủ → role unverified được gán", calls.roleAdds.includes("new-1"));
    check(
      "người thường hồ sơ sạch → không bị phạt",
      calls.kicks.length === 0 && calls.bans.length === 0,
    );
  }

  // ── 3. joinGate: acc quá trẻ → bị kick + ghi event ──
  {
    clear();
    const g = mkGuild("g-gate");
    configs.set("g-gate", {
      joinGateEnabled: true,
      joinGateMinAgeDays: 7,
      joinGatePunish: "kick",
      logChannelId: null,
    });
    client.guilds.cache.set("g-gate", g);
    await joinGate(
      client,
      g.addMember(mkMember("fresh-1", "accmoi", { createdDaysAgo: 2, flagsBitfield: 128 })),
      store,
    );
    check("acc 2 ngày (yêu cầu 7) → bị kick", calls.kicks.includes("fresh-1"));
    check(
      "ghi event antinuke module joinGate",
      calls.mutations.some(
        (mm) => mm.name === "bot_writes:botRecordAntinukeEvent" && mm.args.module === "joinGate",
      ),
    );
  }

  // ── 4. joinGate: whitelist → vào tự do ──
  {
    clear();
    const g = mkGuild("g-wl");
    configs.set("g-wl", {
      joinGateEnabled: true,
      joinGateMinAgeDays: 7,
      joinGateWhitelist: ["trusted-1"],
    });
    client.guilds.cache.set("g-wl", g);
    await joinGate(
      client,
      g.addMember(mkMember("trusted-1", "accmoi", { createdDaysAgo: 1 })),
      store,
    );
    check(
      "whitelist joinGate → không bị chặn dù acc mới",
      calls.kicks.length === 0 && calls.bans.length === 0,
    );
  }

  // ── 5. joinGate: thiếu avatar → chặn ──
  {
    clear();
    const g = mkGuild("g-av");
    configs.set("g-av", {
      joinGateEnabled: true,
      joinGateRequireAvatar: true,
      joinGatePunish: "kick",
    });
    client.guilds.cache.set("g-av", g);
    await joinGate(client, g.addMember(mkMember("noav-1", "khongavatar", { avatar: null })), store);
    check("không avatar riêng → bị kick", calls.kicks.includes("noav-1"));
  }

  // ── 6. alt whitelist (user + role) → bỏ qua alt pipeline ──
  {
    clear();
    const g = mkGuild("g-altwl");
    configs.set("g-altwl", {
      altDetectionEnabled: true,
      altMaxRiskScore: 10,
      altWhitelistUsers: ["trusted-alt"],
      logChannelId: null,
    });
    client.guilds.cache.set("g-altwl", g);
    await joinGate(
      client,
      g.addMember(mkMember("trusted-alt", "xkqe8291", { createdDaysAgo: 0.5 })),
      store,
    );
    check(
      "alt whitelist user → không phạt, không ghi recordJoin",
      calls.kicks.length === 0 &&
        !calls.mutations.some((mm) => mm.name === "altDetection:recordJoin"),
    );
  }

  // ── 7. Người thật sạch → chỉ ghi join history, không phạt ──
  {
    clear();
    const g = mkGuild("g-clean");
    configs.set("g-clean", { altDetectionEnabled: true, altMaxRiskScore: 70 });
    client.guilds.cache.set("g-clean", g);
    await joinGate(client, g.addMember(mkMember("good-1", "thanhlaphe", { avatar: "gav" })), store);
    check(
      "hồ sơ sạch → recordJoin được ghi (lịch sử phục vụ rejoin-evasion)",
      calls.mutations.some((mm) => mm.name === "altDetection:recordJoin"),
    );
    check(
      "hồ sơ sạch → không phạt",
      calls.kicks.length === 0 && calls.bans.length === 0 && calls.timeouts.length === 0,
    );
  }

  // ── 8. Alt chắc chắn (acc <1 ngày + tên trùng hệt member khác) → bị kick ──
  // Điểm: age<1d (+30) + sim 100 (+25) − hypesquad (+15) − avatar (+5) − tên thường (+5) = 30.
  // maxRisk 30 → chạm ngưỡng; strong = [age<3d, name_sim_85+] = 2 → kick thẳng.
  {
    clear();
    const origin = mkMember("origin-1", "vanghinhano", { avatar: "av-o" });
    const g = mkGuild("g-alt", [origin]);
    configs.set("g-alt", { altDetectionEnabled: true, altMaxRiskScore: 30, altPunish: "kick" });
    client.guilds.cache.set("g-alt", g);
    await joinGate(
      client,
      g.addMember(mkMember("alt-1", "vanghinhano", { avatar: "av-a", createdDaysAgo: 0.5 })),
      store,
    );
    check("alt chắc chắn → bị kick theo cấu hình", calls.kicks.includes("alt-1"));
    check(
      "bị phạt → markJoinPunished ghi nhận (phục vụ phát hiện rejoin)",
      calls.mutations.some((mm) => mm.name === "altDetection:markJoinPunished"),
    );
    check(
      "bị phạt → ghi event antinuke module altDetection",
      calls.mutations.some(
        (mm) =>
          mm.name === "bot_writes:botRecordAntinukeEvent" && mm.args.module === "altDetection",
      ),
    );
  }

  // ── 9. store.getConfig lỗi → không crash ──
  {
    clear();
    const brokenStore = {
      ...store,
      getConfig: async () => {
        throw new Error("db down");
      },
    };
    const g = mkGuild("g-err");
    client.guilds.cache.set("g-err", g);
    await joinGate(client, g.addMember(mkMember("m-err", "test")), brokenStore);
    check("getConfig lỗi → joinGate im lặng, không crash", calls.kicks.length === 0);
  }

  // ── 10. joinGate punish=ban → ban thay vì kick ──
  {
    clear();
    const g = mkGuild("g-ban");
    configs.set("g-ban", {
      joinGateEnabled: true,
      joinGateMinAgeDays: 7,
      joinGatePunish: "ban",
    });
    client.guilds.cache.set("g-ban", g);
    await joinGate(
      client,
      g.addMember(mkMember("fresh-ban", "accmoi", { createdDaysAgo: 1 })),
      store,
    );
    check(
      "joinGate punish=ban → ban (không kick)",
      calls.bans.includes("fresh-ban") && !calls.kicks.includes("fresh-ban"),
    );
  }

  // ── 11. joinGate yêu cầu huy hiệu + flag=0 → chặn ──
  {
    clear();
    const g = mkGuild("g-flag");
    configs.set("g-flag", {
      joinGateEnabled: true,
      joinGateRequireFlag: true,
      joinGatePunish: "kick",
    });
    client.guilds.cache.set("g-flag", g);
    await joinGate(
      client,
      g.addMember(mkMember("noflag-1", "khonghuyhieu", { flagsBitfield: 0 })),
      store,
    );
    check("flag = 0 → bị chặn", calls.kicks.includes("noflag-1"));

    clear();
    const g2 = mkGuild("g-flag-ok");
    configs.set("g-flag-ok", { joinGateEnabled: true, joinGateRequireFlag: true });
    client.guilds.cache.set("g-flag-ok", g2);
    await joinGate(
      client,
      g2.addMember(mkMember("hasflag-1", "cohuyhieu", { flagsBitfield: 128 })),
      store,
    );
    check("có huy hiệu → không bị chặn", calls.kicks.length === 0);
  }

  // ── 12. joinGate bị thiếu quyền (kick throw) → ghi event "không thể kick" ──
  {
    clear();
    const g = mkGuild("g-noperm");
    configs.set("g-noperm", {
      joinGateEnabled: true,
      joinGateMinAgeDays: 7,
      joinGatePunish: "kick",
    });
    client.guilds.cache.set("g-noperm", g);
    const m = g.addMember(mkMember("weak-1", "accmoi", { createdDaysAgo: 1 }));
    m.kick = async () => {
      throw new Error("Missing Permissions");
    };
    await joinGate(client, m, store);
    check(
      "kick thất bại → ghi event với 'không thể kick'",
      calls.mutations.some(
        (mm) =>
          mm.name === "bot_writes:botRecordAntinukeEvent" &&
          String(mm.args.action).includes("không thể kick"),
      ),
    );
  }

  // ── 13. alt whitelist ROLE → bỏ qua alt pipeline ──
  {
    clear();
    const g = mkGuild("g-altwl-role");
    configs.set("g-altwl-role", {
      altDetectionEnabled: true,
      altMaxRiskScore: 10,
      altWhitelistRoles: ["r-trusted"],
      logChannelId: null,
    });
    client.guilds.cache.set("g-altwl-role", g);
    const m = g.addMember(mkMember("role-user", "xkqe8291", { createdDaysAgo: 0.5 }));
    // discord.js Collection có .some/.has — mock Set không có, nên thay cache.
    m.roles.cache = {
      some: (fn) => fn({ id: "r-trusted" }),
      has: () => false,
    };
    await joinGate(client, m, store);
    check(
      "alt whitelist role → không phạt, không recordJoin",
      calls.kicks.length === 0 &&
        !calls.mutations.some((mm) => mm.name === "altDetection:recordJoin"),
    );
  }

  // ── 14. verify thiếu thành phần → KHÔNG gán role unverified ──
  {
    clear();
    const g = mkGuild("g-verify-partial");
    configs.set("g-verify-partial", {
      verifyEnabled: true,
      unverifiedRoleId: "r-unv",
      // thiếu verifiedRoleId + verifyChannelId
    });
    client.guilds.cache.set("g-verify-partial", g);
    await joinGate(client, g.addMember(mkMember("p-1", "thanhvienmoi")), store);
    check("verify thiếu thành phần → không gán role unverified", calls.roleAdds.length === 0);
  }

  // ── 15. member không có guild / là bot → bỏ qua hoàn toàn ──
  {
    clear();
    await joinGate(client, { user: { bot: false } }, store);
    check("member không guild → bỏ qua (không crash)", calls.kicks.length === 0);
  }

  console.log(`\nKết quả join gate: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
})();
