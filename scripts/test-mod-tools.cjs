// Test modTools.js — công cụ moderation thủ công (ban/kick/timeout/warn/purge):
//   parseDuration/formatDuration (thuần), canMod/needPerm,
//   logModAction (ghi case + gửi embed, nuốt lỗi),
//   các hành động có kiểm tra trạng thái (untimeout/unban/unwarn),
//   purgeChannel (giới hạn 1..100, log).
// Mock discord.js + caseLog + timeoutWatch (không gửi Discord thật).
// Chạy: node scripts/test-mod-tools.cjs
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
  PermissionFlagsBits: { ManageGuild: 1n << 5n, Administrator: 1n << 3n },
};
`,
);

// ── Mock caseLog + timeoutWatch ──
const caseLogCalls = [];
let caseLogShouldThrow = false;
const timeoutWatchCalls = { track: [], forget: [] };
const caseLogMock = {
  CASE_LABEL: {
    ban: "🚫 Ban",
    timeout: "⏱️ Timeout",
    kick: "👢 Kick",
    untimeout: "🔓 Gỡ timeout",
    unban: "🔓 Gỡ ban",
    unwarn: "🧹 Gỡ warn",
    purge: "🧹 Purge",
  },
  async sendCaseLog(args) {
    caseLogCalls.push(args);
    if (caseLogShouldThrow) throw new Error("webhook sập");
  },
};
const timeoutWatchMock = {
  track(...a) {
    timeoutWatchCalls.track.push(a);
  },
  forget(...a) {
    timeoutWatchCalls.forget.push(a);
  },
};

const origLoad = Module._load;
Module._load = function (request, parent) {
  const fromModTools = parent && /handlers[\\/]modTools\.js$/.test(parent.filename);
  if (fromModTools) {
    if (request === "../caseLog") return caseLogMock;
    if (request === "../timeoutWatch") return timeoutWatchMock;
  }
  return origLoad.apply(this, arguments);
};

(async () => {
  const mod = require("../bot/src/handlers/modTools");

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
    caseLogCalls.length = 0;
    timeoutWatchCalls.track.length = 0;
    timeoutWatchCalls.forget.length = 0;
  };

  // ── 1. parseDuration ──
  check("parseDuration '10m' → 10", mod.parseDuration("10m") === 10);
  check("parseDuration '2h' → 120", mod.parseDuration("2h") === 120);
  check("parseDuration '1d' → 1440", mod.parseDuration("1d") === 1440);
  check("parseDuration '30' → 30 (mặc định phút)", mod.parseDuration("30") === 30);
  check("parseDuration '30s' → 1 (làm tròn phút)", mod.parseDuration("30s") === 1);
  check("parseDuration '1s' → 1 (tối thiểu 1)", mod.parseDuration("1s") === 1);
  check("parseDuration ' 5m ' → 5 (trim)", mod.parseDuration(" 5m ") === 5);
  check("parseDuration '7d' → 10080 (đúng trần)", mod.parseDuration("7d") === 10080);
  check("parseDuration '8d' → null (quá 7 ngày)", mod.parseDuration("8d") === null);
  check("parseDuration '0' → null", mod.parseDuration("0") === null);
  check("parseDuration '-5' → null", mod.parseDuration("-5") === null);
  check("parseDuration 'abc' → null", mod.parseDuration("abc") === null);
  check("parseDuration '' → null", mod.parseDuration("") === null);
  check("parseDuration null → null", mod.parseDuration(null) === null);

  // ── 2. formatDuration ──
  check("formatDuration 1440 → ngày", mod.formatDuration(1440) === "1 ngày");
  check("formatDuration 60 → giờ", mod.formatDuration(60) === "1 giờ");
  check("formatDuration 30 → phút", mod.formatDuration(30) === "30 phút");

  // ── 3. canMod / needPerm ──
  {
    const adminMember = { permissions: { has: () => true }, roles: { cache: new Set() } };
    check("canMod admin → true", mod.canMod({ member: adminMember }, {}) === true);
    const roleMember = { permissions: { has: () => false }, roles: { cache: new Set(["r-mod"]) } };
    check(
      "canMod theo modRole cấu hình → true",
      mod.canMod({ member: roleMember }, { modRoles: ["r-mod"] }) === true,
    );
    const plainMember = { permissions: { has: () => false }, roles: { cache: new Set() } };
    check("canMod người thường → false", mod.canMod({ member: plainMember }, {}) === false);

    const sent = [];
    await mod.needPerm({ send: async (t) => sent.push(t) });
    check(
      "needPerm gửi thông báo thiếu quyền",
      sent.length === 1 && sent[0].includes("Quản lý server"),
    );
  }

  // ── 4. logModAction: ghi case + gửi embed ──
  {
    clear();
    const mutations = [];
    const store = {
      client: {
        mutation: async (name, args) => {
          mutations.push({ name, args });
          return { caseNumber: 42 };
        },
      },
    };
    const guild = { id: "g1" };
    await mod.logModAction(
      guild,
      {},
      {
        actionKey: "ban",
        target: { id: "u1", username: "kẻ_phạm" },
        executor: { id: "m1", username: "mod" },
        reason: "spam",
        extra: [{ name: "Xóa tin nhắn", value: "1 ngày" }],
      },
      store,
    );
    check(
      "logModAction ghi botRecordModAction",
      mutations.length === 1 && mutations[0].name === "bot_writes:botRecordModAction",
    );
    check(
      "logModAction ghi đúng guild/target",
      mutations[0].args.guildId === "g1" && mutations[0].args.targetId === "u1",
    );
    check(
      "logModAction gửi embed kèm số case",
      caseLogCalls.length === 1 &&
        caseLogCalls[0].caseNumber === 42 &&
        caseLogCalls[0].action === "ban",
    );
  }

  // ── 5. logModAction: không có store vẫn gửi embed ──
  {
    clear();
    await mod.logModAction({ id: "g1" }, {}, { actionKey: "kick", target: { id: "u" } }, null);
    check(
      "không store → vẫn gửi embed (caseNumber undefined)",
      caseLogCalls.length === 1 && caseLogCalls[0].caseNumber === undefined,
    );
  }

  // ── 6. logModAction: lỗi mutation + lỗi sendCaseLog đều bị nuốt ──
  {
    clear();
    const brokenStore = {
      client: {
        mutation: async () => {
          throw new Error("DB sập");
        },
      },
    };
    caseLogShouldThrow = true;
    await mod.logModAction(
      { id: "g1" },
      {},
      { actionKey: "warn", target: { id: "u" } },
      brokenStore,
    );
    check("lỗi mutation + sendCaseLog → không crash", true);
    caseLogShouldThrow = false;
  }

  // ── 7. timeoutMember ──
  {
    clear();
    const store = { client: { mutation: async () => ({ caseNumber: 7 }) } };
    const member = {
      id: "u1",
      user: { tag: "user#1", id: "u1", username: "user" },
      timeout: async (ms) => (member.lastTimeout = ms),
    };
    const out = await mod.timeoutMember({
      guild: { id: "g1" },
      member,
      executor: { id: "m", username: "mod" },
      minutes: 10,
      reason: "spam",
      guildConfig: {},
      store,
    });
    check("timeoutMember gọi timeout đúng ms", member.lastTimeout === 10 * 60_000);
    check("timeoutMember theo dõi timeoutWatch", timeoutWatchCalls.track.length === 1);
    check("timeoutMember trả thông báo có tag", out.includes("user#1") && out.includes("10 phút"));
  }

  // ── 8. kickMember / banMember ──
  {
    clear();
    const store = { client: { mutation: async () => ({ caseNumber: 1 }) } };
    let kicked = null;
    let banned = null;
    const member = {
      id: "u1",
      user: { tag: "user#1", id: "u1", username: "user" },
      kick: async (r) => (kicked = r),
      ban: async (o) => (banned = o),
    };
    await mod.kickMember({
      guild: { id: "g1" },
      member,
      executor: null,
      reason: "x",
      guildConfig: {},
      store,
    });
    check("kickMember gọi member.kick", kicked === "x");
    await mod.banMember({
      guild: { id: "g1" },
      member,
      executor: null,
      reason: "y",
      deleteDays: 2,
      guildConfig: {},
      store,
    });
    check(
      "banMember xóa tin theo số ngày",
      banned.deleteMessageSeconds === 2 * 86_400 && banned.reason === "y",
    );
  }

  // ── 9. untimeoutMember: chưa bị timeout → throw ──
  {
    clear();
    const member = {
      id: "u1",
      user: { tag: "user#1" },
      isCommunicationDisabled: () => false,
      timeout: async () => {},
    };
    let threw = false;
    try {
      await mod.untimeoutMember({ guild: { id: "g1" }, member, executor: null, guildConfig: {} });
    } catch {
      threw = true;
    }
    check("untimeoutMember khi không bị timeout → throw", threw === true);

    member.isCommunicationDisabled = () => true;
    let timedOut = false;
    member.timeout = async (ms) => (timedOut = ms === null);
    await mod.untimeoutMember({ guild: { id: "g1" }, member, executor: null, guildConfig: {} });
    check(
      "untimeoutMember gỡ timeout + forget tracker",
      timedOut && timeoutWatchCalls.forget.length === 1,
    );
  }

  // ── 10. unbanMember: chưa bị ban → throw; có ban → unban ──
  {
    clear();
    let unbanned = null;
    const guild = {
      id: "g1",
      members: {
        fetchBan: async () => null,
        unban: async (id) => (unbanned = id),
      },
    };
    let threw = false;
    try {
      await mod.unbanMember({ guild, userId: "u1", executor: null, guildConfig: {} });
    } catch {
      threw = true;
    }
    check("unbanMember khi chưa bị ban → throw", threw === true);

    guild.members.fetchBan = async () => ({ user: { id: "u1", username: "nguoidung" } });
    await mod.unbanMember({ guild, userId: "u1", executor: null, guildConfig: {} });
    check("unbanMember có ban → gọi unban", unbanned === "u1");
  }

  // ── 11. unwarnMember: chưa có warn → throw; có warn → clear ──
  {
    clear();
    let cleared = null;
    const heat = {
      strikeCount: () => 0,
      clearStrikes: (g, u) => (cleared = u),
      strikeUsername: () => "nguoidung",
    };
    let threw = false;
    try {
      await mod.unwarnMember({
        guild: { id: "g1" },
        userId: "u1",
        heat,
        executor: null,
        guildConfig: {},
      });
    } catch {
      threw = true;
    }
    check("unwarnMember không có warn → throw", threw === true);

    heat.strikeCount = () => 3;
    const out = await mod.unwarnMember({
      guild: { id: "g1" },
      userId: "u1",
      heat,
      executor: null,
      guildConfig: {},
    });
    check("unwarnMember có warn → clearStrikes", cleared === "u1" && out.includes("3 warn"));
  }

  // ── 12. purgeChannel: giới hạn 1..100 + log ──
  {
    clear();
    const deleted = { size: 5 };
    const channel = {
      id: "c1",
      name: "chung",
      guild: { id: "g1" },
      bulkDelete: async (n) => {
        channel.lastN = n;
        return deleted;
      },
    };
    const out = await mod.purgeChannel(channel, 250, { id: "m", username: "mod" }, {}, null);
    check("purgeChannel cap số lượng ở 100", channel.lastN === 100);
    check(
      "purgeChannel gửi embed log",
      caseLogCalls.length === 1 && caseLogCalls[0].action === "purge",
    );
    check("purgeChannel trả số tin đã xóa", out.includes("5"));

    await mod.purgeChannel(channel, 0, { id: "m", username: "mod" }, {}, null);
    check("purgeChannel tối thiểu 1", channel.lastN === 1);
  }

  // ── 13. unwarnMember với HeatTracker THẬT ──
  // Test cũ dùng mock heat.strikeCount (không cần tham số) nên che bug: bản thật
  // strikeCount(guildId, userId, s) đọc s.warnStrikeWindowMin → gọi thiếu `s` sẽ
  // ném TypeError đúng lúc người dùng CÓ warn (chính lúc cần /unwarn).
  {
    clear();
    const { HeatTracker, heatSettings } = require("../bot/src/heat.js");
    const heat = new HeatTracker({}, {});
    const s = heatSettings({ warnStrikeLimit: 3, warnStrikePunish: "timeout" });
    heat.strike("g1", "u1", s, "nguoidung");
    let threw = "";
    let out = "";
    try {
      out = await mod.unwarnMember({
        guild: { id: "g1" },
        userId: "u1",
        heat,
        executor: null,
        reason: undefined,
        guildConfig: {},
        store: null,
      });
    } catch (e) {
      threw = e.message;
    }
    check("unwarnMember với HeatTracker thật không ném", threw === "", threw);
    check("unwarnMember xóa đúng warn tích lũy", out.includes("1 warn"));
    check("sau unwarn, strikeCount về 0", heat.strikeCount("g1", "u1", s) === 0);
  }

  fs.unlinkSync(path.join(__dirname, "..", "bot", "test-djs-mock.cjs"));
  console.log(`\nKết quả mod tools: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error("CRASH:", e);
  process.exit(1);
});
