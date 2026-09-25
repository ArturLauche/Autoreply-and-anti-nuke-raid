// Test interactionCreate.js — toàn bộ luồng tương tác:
//   - nút verify_request_captcha (captcha DM) + verify_confirm (xác minh + alt gate)
//   - lệnh slash: report, research, ping, help, prefix, autoreply, badword, heat,
//     antinuke, mod, giveaway, reactionrole, backup, verify, setup, alt
//   - phân quyền (needPerm) + bắt lỗi từng nhánh
// Mock discord.js + mọi module phụ thuộc; không mạng, không Discord thật.
// Chạy: node scripts/test-interaction-create.cjs
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
  constructor(data = {}) { this.data = { ...data }; this.d = this.data; }
  setColor(c) { this.data.color = c; return this; }
  setTitle(t) { this.data.title = t; return this; }
  setDescription(t) { this.data.description = t; return this; }
  addFields(...f) { this.data.fields = [...(this.data.fields ?? []), ...f.flat(Infinity)]; return this; }
  setTimestamp() { return this; }
  setFooter(f) { this.data.footer = f; return this; }
  setThumbnail() { return this; }
}
class ActionRowBuilder { constructor() { this.components = []; } addComponents(...c) { this.components.push(...c.flat(Infinity)); return this; } }
class ButtonBuilder { setCustomId(v){this.customId=v;return this;} setLabel(v){this.label=v;return this;} setStyle(v){this.style=v;return this;} }
module.exports = {
  Colors: new Proxy({}, { get: () => 0x000000 }),
  EmbedBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle: { Primary: 1, Success: 2, Danger: 3, Secondary: 4 },
};
`,
);

// ── Trạng thái điều khiển từ test ──
const ctl = {
  perms: { manage: true, admin: false, mod: true },
  isLocked: false,
  unlockGuildCalls: 0,
  parseDuration: (s) => (/^(\d+)m$/.test(s || "") ? parseInt(s, 10) : null),
  actionThrows: false,
  reportInteractive: null,
  handleResearch: null,
};
const calls = {
  mutations: [],
  queries: [],
  markLocked: [],
  captchaSet: [],
  dms: [],
};

const utilMock = {
  canManageGuild: () => ctl.perms.manage,
  isAdmin: () => ctl.perms.admin,
  canManageWithConfig: () => ctl.perms.manage,
  fillPlaceholders: (t, a) => t.replaceAll("{user}", `<@${a.id}>`),
  logEmbed: (o) => ({ data: o }),
  async sendLog() {},
  async sendModLog() {},
};
const lockdownMock = {
  isLocked: () => ctl.isLocked,
  markLocked: (id) => calls.markLocked.push(id),
  async unlockGuild() {
    ctl.unlockGuildCalls++;
    ctl.isLocked = false;
  },
};
const hiddenMock = { emojiKeyOf: (e) => String(e).trim() };
const modToolsMock = {
  parseDuration: (s) => ctl.parseDuration(s),
  canMod: () => ctl.perms.mod,
  async timeoutMember() {
    if (ctl.actionThrows) throw new Error("timeout fail");
    return "timeout OK";
  },
  async kickMember() {
    if (ctl.actionThrows) throw new Error("kick fail");
    return "kick OK";
  },
  async banMember() {
    if (ctl.actionThrows) throw new Error("ban fail");
    return "ban OK";
  },
  async purgeChannel() {
    if (ctl.actionThrows) throw new Error("purge fail");
    return "purge OK";
  },
  async untimeoutMember() {
    if (ctl.actionThrows) throw new Error("untimeout fail");
    return "untimeout OK";
  },
  async unbanMember() {
    if (ctl.actionThrows) throw new Error("unban fail");
    return "unban OK";
  },
  async unwarnMember() {
    if (ctl.actionThrows) throw new Error("unwarn fail");
    return "unwarn OK";
  },
};
const captchaMock = {
  genCaptcha: () => "123456",
  setCode: (g, u, c) => calls.captchaSet.push({ g, u, c }),
};
let altAnalysis = { riskScore: 0, action: "pass", riskFactors: [] };
let punishResult = { executed: false };
let altAnalysisCalls = 0;
const altMock = {
  analyzeNewMember: async () => {
    altAnalysisCalls++;
    return altAnalysis;
  },
  executePunishment: async () => punishResult,
  buildRiskEmbed: () => ({
    data: {},
    setTitle() {
      return this;
    },
    setDescription() {
      return this;
    },
  }),
};

const origLoad = Module._load;
Module._load = function (request, parent) {
  const fromIC = parent && /handlers[\\/]interactionCreate\.js$/.test(parent.filename);
  if (fromIC) {
    if (request === "../util") return utilMock;
    if (request === "../lockdown") return lockdownMock;
    if (request === "./hidden") return hiddenMock;
    if (request === "./modTools") return modToolsMock;
    if (request === "../captchaStore") return captchaMock;
    if (request === "../altDetection") return altMock;
    if (request === "./incidentReport") {
      return { reportInteractive: (...a) => ctl.reportInteractive(...a) };
    }
    if (request === "./researchCommands") {
      return { handleResearch: (...a) => ctl.handleResearch(...a) };
    }
  }
  return origLoad.apply(this, arguments);
};

(async () => {
  const onInteractionCreate = require("../bot/src/handlers/interactionCreate");

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

  const configs = new Map();
  const store = {
    getConfig: async (guildId) => configs.get(guildId) ?? null,
    invalidate: () => {},
    client: {
      mutation: async (name, args) => {
        calls.mutations.push({ name, args });
        if (name === "hidden:botGiveawayEndNow") return { ok: ctl.giveawayEndOk !== false };
        return { ok: true };
      },
      query: async (name) => {
        calls.queries.push(name);
        return ctl.queryResult ?? null;
      },
    },
  };
  const heat = {};
  const client = { ws: { ping: 42 } };

  const replies = [];
  function reset() {
    calls.mutations.length = 0;
    calls.queries.length = 0;
    calls.markLocked.length = 0;
    calls.captchaSet.length = 0;
    calls.dms.length = 0;
    replies.length = 0;
    ctl.perms = { manage: true, admin: false, mod: true };
    ctl.isLocked = false;
    ctl.unlockGuildCalls = 0;
    ctl.actionThrows = false;
    ctl.queryResult = null;
    ctl.giveawayEndOk = true;
    altAnalysis = { riskScore: 0, action: "pass", riskFactors: [] };
    punishResult = { executed: false };
    altAnalysisCalls = 0;
  }

  function mkMember(id = "u1", { hasUnverified = true } = {}) {
    return {
      id,
      user: { id, username: "nguoidung" },
      roles: {
        cache: { has: (rid) => (rid === "r-unv" ? hasUnverified : false) },
        add: async () => {},
        remove: async () => {},
      },
      send: async (p) => calls.dms.push(p),
    };
  }
  function mkGuild(id = "g1", member = mkMember()) {
    return {
      id,
      name: "Server " + id,
      iconURL: () => null,
      members: {
        cache: new Map([[member.id, member]]),
        fetch: async () => member,
      },
      channels: { cache: new Map() },
      roles: { cache: { find: () => null } },
    };
  }

  function mkInteraction(opts = {}) {
    const member = opts.member ?? mkMember();
    const guild = opts.guild ?? mkGuild(opts.guildId ?? "g1", member);
    const interaction = {
      user: opts.user ?? { id: member.id, username: "nguoidung" },
      member: opts.memberOverride ?? { permissions: { has: () => ctl.perms.manage } },
      guild: opts.noGuild ? null : guild,
      channel: opts.channel ?? { id: "c1", name: "chung", toString: () => "#chung" },
      isButton: () => !!opts.isButton,
      isChatInputCommand: () => !!opts.isChatInputCommand,
      customId: opts.customId,
      commandName: opts.commandName,
      replied: false,
      reply: async (payload) => {
        replies.push(payload);
        interaction.replied = true;
        return {};
      },
      options: {
        getSubcommand: () => opts.subcommand,
        getString: (name, req) => {
          const v = opts.strings?.[name];
          if (v === undefined && req) throw new Error(`missing ${name}`);
          return v ?? null;
        },
        getInteger: (name) => opts.integers?.[name] ?? null,
        getBoolean: (name) => opts.booleans?.[name] ?? null,
        getMember: (name) => opts.members?.[name] ?? null,
        getUser: (name) => opts.users?.[name] ?? null,
        getRole: (name) => opts.roles?.[name] ?? null,
        getChannel: (name) => opts.channels?.[name] ?? null,
      },
    };
    return interaction;
  }

  const run = (opts) => onInteractionCreate(client, mkInteraction(opts), store, heat);

  // ══════════════════ NÚT BẤM ══════════════════

  // ── 1. verify_request_captcha ──
  {
    reset();
    await run({ isButton: true, customId: "verify_request_captcha", noGuild: true });
    check("captcha: không guild → im lặng", replies.length === 0);

    reset();
    configs.set("g1", { verifyEnabled: false });
    await run({ isButton: true, customId: "verify_request_captcha" });
    check("captcha: verify tắt → từ chối", replies[0].content.includes("đã bị tắt"));

    reset();
    configs.set("g1", { verifyEnabled: true });
    await run({ isButton: true, customId: "verify_request_captcha" });
    check("captcha: thiếu role → từ chối", replies[0].content.includes("Chưa cấu hình role"));

    reset();
    configs.set("g1", { verifyEnabled: true, unverifiedRoleId: "r-unv" });
    const noMemberGuild = mkGuild("g1", mkMember());
    noMemberGuild.members.cache = new Map();
    noMemberGuild.members.fetch = async () => null;
    await run({ isButton: true, customId: "verify_request_captcha", guild: noMemberGuild });
    check(
      "captcha: không tìm thấy member → từ chối",
      replies[0].content.includes("Không tìm thấy"),
    );

    reset();
    await run({
      isButton: true,
      customId: "verify_request_captcha",
      member: mkMember("u1", { hasUnverified: false }),
    });
    check("captcha: đã xác minh rồi → thông báo", replies[0].content.includes("đã xác minh rồi"));

    reset();
    await run({ isButton: true, customId: "verify_request_captcha" });
    check(
      "captcha: thành công → set mã + gửi DM",
      calls.captchaSet.length === 1 &&
        calls.dms.length === 1 &&
        replies[0].content.includes("Đã gửi mã"),
    );

    reset();
    const noDmMember = mkMember();
    noDmMember.send = async () => {
      throw new Error("DM đóng");
    };
    await run({ isButton: true, customId: "verify_request_captcha", member: noDmMember });
    check(
      "captcha: không gửi được DM → hướng dẫn bật DM",
      replies[0].content.includes("cho phép tin nhắn trực tiếp"),
    );
  }

  // ── 2. verify_confirm ──
  {
    reset();
    await run({ isButton: true, customId: "verify_confirm", noGuild: true });
    check("confirm: không guild → im lặng", replies.length === 0);

    reset();
    configs.set("g1", { verifyEnabled: false });
    await run({ isButton: true, customId: "verify_confirm" });
    check("confirm: verify tắt → từ chối", replies[0].content.includes("đã bị tắt"));

    reset();
    configs.set("g1", { verifyEnabled: true, unverifiedRoleId: "r-unv" });
    await run({ isButton: true, customId: "verify_confirm" });
    check(
      "confirm: thiếu verified role → từ chối",
      replies[0].content.includes("Chưa cấu hình role"),
    );

    reset();
    configs.set("g1", {
      verifyEnabled: true,
      unverifiedRoleId: "r-unv",
      verifiedRoleId: "r-ver",
      altDetectionEnabled: true,
    });
    await run({
      isButton: true,
      customId: "verify_confirm",
      member: mkMember("u1", { hasUnverified: false }),
    });
    check(
      "confirm: thiếu role chưa xác minh → chặn trước analysis/grant",
      replies[0].content.includes("role chưa xác minh") &&
        altAnalysisCalls === 0 &&
        calls.mutations.length === 0,
    );

    reset();
    configs.set("g1", { verifyEnabled: true, unverifiedRoleId: "r-unv", verifiedRoleId: "r-ver" });
    await run({ isButton: true, customId: "verify_confirm" });
    check(
      "confirm: xác minh bình thường → thành công",
      replies[0].content.includes("Đã xác minh thành công"),
    );

    reset();
    configs.set("g1", {
      verifyEnabled: true,
      unverifiedRoleId: "r-unv",
      verifiedRoleId: "r-ver",
      verifyWelcomeEnabled: true,
      verifyWelcomeTitle: "Chào {user}",
    });
    await run({ isButton: true, customId: "verify_confirm" });
    check("confirm: bật DM chào mừng → gửi DM", calls.dms.length === 1);

    // Alt chặn
    reset();
    configs.set("g1", {
      verifyEnabled: true,
      unverifiedRoleId: "r-unv",
      verifiedRoleId: "r-ver",
      altDetectionEnabled: true,
      altMaxRiskScore: 70,
    });
    altAnalysis = { riskScore: 95, action: "ban", riskFactors: ["acc mới"] };
    punishResult = { executed: true, action: "ban" };
    await run({ isButton: true, customId: "verify_confirm" });
    check(
      "confirm: alt rủi ro cao → từ chối + đánh dấu",
      replies[0].content.includes("Xác minh bị từ chối") &&
        calls.mutations.some((m) => m.name === "altDetection:markJoinPunished"),
    );

    // Alt phạt thất bại → fail-open
    reset();
    configs.set("g1", {
      verifyEnabled: true,
      unverifiedRoleId: "r-unv",
      verifiedRoleId: "r-ver",
      altDetectionEnabled: true,
      altMaxRiskScore: 70,
    });
    altAnalysis = { riskScore: 95, action: "ban", riskFactors: ["acc mới"] };
    punishResult = { executed: false, reason: "thiếu quyền" };
    await run({ isButton: true, customId: "verify_confirm" });
    check(
      "confirm: phạt thất bại → fail-open cho xác minh",
      replies[0].content.includes("Đã xác minh thành công"),
    );

    // Nút lạ
    reset();
    await run({ isButton: true, customId: "khong-biet" });
    check("nút lạ → bỏ qua", replies.length === 0);
  }

  // ══════════════════ LỆNH SLASH ══════════════════

  // ── 3. Không phải chat input / không guild ──
  {
    reset();
    await run({});
    check("không phải chat input → bỏ qua", replies.length === 0);

    reset();
    await run({ isChatInputCommand: true, commandName: "ping", noGuild: true });
    check(
      "slash ngoài server → từ chối",
      replies[0].content.includes("chỉ hoạt động trong server"),
    );
  }

  // ── 4. report / research / ping / help / default ──
  {
    reset();
    ctl.reportInteractive = async () => {
      replies.push({ content: "report-called" });
    };
    await run({ isChatInputCommand: true, commandName: "report" });
    check(
      "report → uỷ quyền cho reportInteractive",
      replies.some((r) => r.content === "report-called"),
    );

    reset();
    ctl.handleResearch = async () => {
      replies.push({ content: "research-called" });
    };
    await run({ isChatInputCommand: true, commandName: "research" });
    check(
      "research → uỷ quyền cho handleResearch",
      replies.some((r) => r.content === "research-called"),
    );

    reset();
    await run({ isChatInputCommand: true, commandName: "ping" });
    check(
      "ping → pong kèm ms",
      replies[0].content.includes("Pong") && replies[0].content.includes("42"),
    );

    reset();
    await run({ isChatInputCommand: true, commandName: "help" });
    check("help → embed hướng dẫn", replies[0].embeds?.[0]?.data?.title?.includes("Lệnh"));

    reset();
    await run({ isChatInputCommand: true, commandName: "khong-co" });
    check("lệnh không hỗ trợ → thông báo", replies[0].content.includes("chưa được hỗ trợ"));
  }

  // ── 5. prefix ──
  {
    reset();
    configs.set("g1", { prefix: "!" });
    await run({ isChatInputCommand: true, commandName: "prefix" });
    check("prefix: xem hiện tại", replies[0].content.includes("Prefix hiện tại"));

    reset();
    ctl.perms.manage = false;
    await run({ isChatInputCommand: true, commandName: "prefix", strings: { set: "^" } });
    check("prefix: thiếu quyền → needPerm", replies[0].content.includes("không có quyền"));

    reset();
    await run({ isChatInputCommand: true, commandName: "prefix", strings: { set: "abc" } });
    check("prefix: ký tự không hợp lệ → từ chối", replies[0].content.includes("1-3 ký tự"));

    reset();
    await run({ isChatInputCommand: true, commandName: "prefix", strings: { set: "^" } });
    check(
      "prefix: hợp lệ → ghi mutation + đổi",
      calls.mutations.some((m) => m.name === "bot_writes:botUpdateSettings") &&
        replies[0].content.includes("Đã đổi prefix"),
    );
  }

  // ── 6. autoreply ──
  {
    reset();
    configs.set("g1", { autoReplies: [] });
    await run({ isChatInputCommand: true, commandName: "autoreply", subcommand: "list" });
    check("autoreply list rỗng → thông báo", replies[0].content.includes("Chưa có rule"));

    reset();
    configs.set("g1", {
      autoReplies: [{ name: "r1", triggerType: "keyword", keywords: ["hi"], enabled: true }],
    });
    await run({ isChatInputCommand: true, commandName: "autoreply", subcommand: "list" });
    check(
      "autoreply list có rule → embed",
      replies[0].embeds?.[0]?.data?.title?.includes("Auto reply"),
    );

    reset();
    ctl.perms.manage = false;
    await run({ isChatInputCommand: true, commandName: "autoreply", subcommand: "add" });
    check("autoreply add thiếu quyền → needPerm", replies[0].content.includes("không có quyền"));

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "autoreply",
      subcommand: "add",
      strings: { name: "r", trigger: "keyword", response: "x", keywords: "", cooldown: null },
    });
    check(
      "autoreply add keyword thiếu từ khóa → từ chối",
      replies[0].content.includes("cần nhập từ khóa"),
    );

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "autoreply",
      subcommand: "add",
      strings: {
        name: "r",
        trigger: "keyword",
        response: "xin chào",
        keywords: "hi,hello",
        cooldown: 10,
      },
    });
    check(
      "autoreply add hợp lệ → lưu mutation",
      calls.mutations.some((m) => m.name === "bot_writes:botAutoReplyUpsert"),
    );

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "autoreply",
      subcommand: "remove",
      strings: { name: "r" },
    });
    check(
      "autoreply remove → mutation xóa",
      calls.mutations.some((m) => m.name === "bot_writes:botAutoReplyRemove"),
    );

    reset();
    configs.set("g1", { autoReplies: [] });
    await run({
      isChatInputCommand: true,
      commandName: "autoreply",
      subcommand: "edit",
      strings: { name: "missing" },
      integers: { cooldown: null },
    });
    check(
      "autoreply edit rule không tồn tại → thông báo",
      replies[0].content.includes("Không tìm thấy rule"),
    );

    reset();
    configs.set("g1", {
      autoReplies: [
        {
          name: "r1",
          triggerType: "keyword",
          keywords: ["hi"],
          response: "cũ",
          enabled: true,
          channels: [],
        },
      ],
    });
    await run({
      isChatInputCommand: true,
      commandName: "autoreply",
      subcommand: "edit",
      strings: { name: "r1", response: "mới" },
      integers: { cooldown: null },
    });
    check(
      "autoreply edit hợp lệ → cập nhật",
      calls.mutations.some((m) => m.name === "bot_writes:botAutoReplyUpsert"),
    );
  }

  // ── 7. badword ──
  {
    reset();
    configs.set("g1", { badWords: [] });
    await run({ isChatInputCommand: true, commandName: "badword", subcommand: "list" });
    check("badword list rỗng → thông báo", replies[0].content.includes("đang trống"));

    reset();
    configs.set("g1", { badWords: ["xấu"] });
    await run({ isChatInputCommand: true, commandName: "badword", subcommand: "list" });
    check(
      "badword list có từ → embed",
      replies[0].embeds?.[0]?.data?.title?.includes("từ ngữ xấu"),
    );

    reset();
    ctl.perms.manage = false;
    await run({ isChatInputCommand: true, commandName: "badword", subcommand: "add" });
    check("badword add thiếu quyền → needPerm", replies[0].content.includes("không có quyền"));

    reset();
    configs.set("g1", { badWords: [] });
    await run({
      isChatInputCommand: true,
      commandName: "badword",
      subcommand: "add",
      strings: { word: "  " },
    });
    check("badword add từ trống → từ chối", replies[0].content.includes("không được để trống"));

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "badword",
      subcommand: "add",
      strings: { word: "a".repeat(41) },
    });
    check("badword add quá 40 ký tự → từ chối", replies[0].content.includes("tối đa 40"));

    reset();
    configs.set("g1", { badWords: ["xấu"] });
    await run({
      isChatInputCommand: true,
      commandName: "badword",
      subcommand: "add",
      strings: { word: "xấu" },
    });
    check("badword add từ đã có → thông báo", replies[0].content.includes("đã có"));

    reset();
    configs.set("g1", { badWords: Array.from({ length: 100 }, (_, i) => "w" + i) });
    await run({
      isChatInputCommand: true,
      commandName: "badword",
      subcommand: "add",
      strings: { word: "mới" },
    });
    check("badword add đủ 100 → từ chối", replies[0].content.includes("tối đa 100"));

    reset();
    configs.set("g1", { badWords: [] });
    await run({
      isChatInputCommand: true,
      commandName: "badword",
      subcommand: "add",
      strings: { word: "Xấu" },
    });
    check(
      "badword add hợp lệ → mutation",
      calls.mutations.some((m) => m.name === "bot_writes:botUpdateSettings"),
    );

    reset();
    configs.set("g1", { badWords: ["xấu"] });
    await run({
      isChatInputCommand: true,
      commandName: "badword",
      subcommand: "remove",
      strings: { word: "không-có" },
    });
    check("badword remove không thấy → thông báo", replies[0].content.includes("Không tìm thấy"));

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "badword",
      subcommand: "remove",
      strings: { word: "xấu" },
    });
    check(
      "badword remove hợp lệ → mutation",
      calls.mutations.some((m) => m.name === "bot_writes:botUpdateSettings"),
    );
  }

  // ── 8. heat ──
  {
    reset();
    configs.set("g1", { heatStates: [{ userId: "u1", heat: 50 }], safetyPercent: 80 });
    await run({ isChatInputCommand: true, commandName: "heat" });
    check(
      "heat có dữ liệu → embed nhiệt độ",
      replies[0].embeds?.[0]?.data?.title?.includes("Nhiệt độ"),
    );

    reset();
    configs.set("g1", { heatStates: [] });
    await run({ isChatInputCommand: true, commandName: "heat" });
    check(
      "heat không dữ liệu → thông báo an toàn",
      replies[0].embeds?.[0]?.data?.fields?.[0]?.value.includes("an toàn"),
    );
  }

  // ── 9. antinuke ──
  {
    reset();
    configs.set("g1", {
      antinukeEnabled: true,
      modules: [
        { module: "massBan", enabled: true, threshold: 3, windowSeconds: 10, punish: "ban" },
      ],
    });
    await run({ isChatInputCommand: true, commandName: "antinuke", subcommand: "status" });
    check(
      "antinuke status → embed trạng thái",
      replies[0].embeds?.[0]?.data?.title?.includes("Chống nuke"),
    );

    reset();
    ctl.perms.manage = false;
    await run({ isChatInputCommand: true, commandName: "antinuke", subcommand: "on" });
    check("antinuke on thiếu quyền → needPerm", replies[0].content.includes("không có quyền"));

    reset();
    await run({ isChatInputCommand: true, commandName: "antinuke", subcommand: "on" });
    check(
      "antinuke on → mutation botSetAntinuke",
      calls.mutations.some((m) => m.name === "bot_writes:botSetAntinuke"),
    );

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "antinuke",
      subcommand: "lockdown",
      strings: { value: "sai" },
    });
    check("antinuke lockdown giá trị sai → từ chối", replies[0].content.includes("on hoặc off"));

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "antinuke",
      subcommand: "lockdown",
      strings: { value: "on" },
    });
    check(
      "antinuke lockdown on → mutation",
      calls.mutations.some((m) => m.name === "bot_writes:botUpdateLockdown"),
    );

    reset();
    ctl.isLocked = false;
    configs.set("g1", {});
    await run({ isChatInputCommand: true, commandName: "antinuke", subcommand: "unlock" });
    check(
      "antinuke unlock khi không khóa → thông báo",
      replies[0].content.includes("không ở trạng thái khóa"),
    );

    reset();
    ctl.isLocked = true;
    configs.set("g1", {});
    await run({ isChatInputCommand: true, commandName: "antinuke", subcommand: "unlock" });
    check(
      "antinuke unlock khi đang khóa → mở khóa",
      ctl.unlockGuildCalls === 1 && replies[0].content.includes("Đã mở khóa"),
    );

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "antinuke",
      subcommand: "module",
      strings: { module: "sai-module", value: "on" },
    });
    check("antinuke module sai tên → từ chối", replies[0].content.includes("Module phải thuộc"));

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "antinuke",
      subcommand: "module",
      strings: { module: "massBan", value: "off" },
    });
    check(
      "antinuke module hợp lệ → mutation",
      calls.mutations.some((m) => m.name === "bot_writes:botModuleUpdate"),
    );
  }

  // ── 10. mod ──
  {
    const target = {
      id: "t1",
      user: { tag: "target#1", username: "target" },
      timeout: async () => {},
      kick: async () => {},
      ban: async () => {},
    };

    reset();
    ctl.perms.mod = false;
    await run({
      isChatInputCommand: true,
      commandName: "mod",
      subcommand: "kick",
      members: { user: target },
    });
    check("mod thiếu quyền → needPerm", replies[0].content.includes("không có quyền"));

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "mod",
      subcommand: "timeout",
      members: { user: null },
      strings: { duration: "10m" },
    });
    check("mod timeout không thấy member → từ chối", replies[0].content.includes("Không tìm thấy"));

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "mod",
      subcommand: "timeout",
      members: { user: target },
      strings: { duration: "sai" },
    });
    check(
      "mod timeout thời lượng sai → từ chối",
      replies[0].content.includes("Thời lượng không hợp lệ"),
    );

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "mod",
      subcommand: "timeout",
      members: { user: target },
      strings: { duration: "10m", reason: "spam" },
    });
    check("mod timeout hợp lệ → OK", replies[0].content.includes("timeout OK"));

    reset();
    ctl.actionThrows = true;
    await run({
      isChatInputCommand: true,
      commandName: "mod",
      subcommand: "timeout",
      members: { user: target },
      strings: { duration: "10m" },
    });
    check("mod timeout lỗi → thông báo lỗi", replies[0].content.includes("Không thể timeout"));

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "mod",
      subcommand: "kick",
      members: { user: target },
    });
    check("mod kick hợp lệ → OK", replies[0].content.includes("kick OK"));

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "mod",
      subcommand: "ban",
      members: { user: target },
      integers: { delete_days: 3 },
    });
    check("mod ban hợp lệ → OK", replies[0].content.includes("ban OK"));

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "mod",
      subcommand: "purge",
      integers: { count: 5 },
    });
    check("mod purge hợp lệ → OK", replies[0].content.includes("purge OK"));

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "mod",
      subcommand: "untimeout",
      members: { user: target },
    });
    check("mod untimeout hợp lệ → OK", replies[0].content.includes("untimeout OK"));

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "mod",
      subcommand: "unban",
      users: { user: { id: "t1" } },
    });
    check("mod unban hợp lệ → OK", replies[0].content.includes("unban OK"));

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "mod",
      subcommand: "unwarn",
      users: { user: { id: "t1" } },
    });
    check("mod unwarn hợp lệ → OK", replies[0].content.includes("unwarn OK"));
  }

  // ── 11. giveaway ──
  {
    reset();
    configs.set("g1", { giveaways: [] });
    await run({ isChatInputCommand: true, commandName: "giveaway", subcommand: "list" });
    check("giveaway list rỗng → thông báo", replies[0].content.includes("Chưa có giveaway"));

    reset();
    configs.set("g1", { giveaways: [{ title: "G", status: "active", entries: [1, 2] }] });
    await run({ isChatInputCommand: true, commandName: "giveaway", subcommand: "list" });
    check("giveaway list có → embed", replies[0].embeds?.[0]?.data?.title?.includes("Giveaway"));

    reset();
    ctl.perms.mod = false;
    await run({ isChatInputCommand: true, commandName: "giveaway", subcommand: "start" });
    check("giveaway start thiếu quyền → needPerm", replies[0].content.includes("không có quyền"));

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "giveaway",
      subcommand: "start",
      strings: { title: "G", prize: "P", duration: "sai" },
    });
    check(
      "giveaway start thời lượng sai → từ chối",
      replies[0].content.includes("Thời lượng không hợp lệ"),
    );

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "giveaway",
      subcommand: "start",
      strings: { title: "G", prize: "P", duration: "30m" },
      integers: { winners: 2 },
    });
    check(
      "giveaway start hợp lệ → mutation tạo",
      calls.mutations.some((m) => m.name === "hidden:botCreateGiveaway"),
    );

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "giveaway",
      subcommand: "end",
      strings: { title: "G" },
    });
    check("giveaway end tìm thấy → OK", replies[0].content.includes("Đã kết thúc"));

    reset();
    ctl.giveawayEndOk = false;
    await run({
      isChatInputCommand: true,
      commandName: "giveaway",
      subcommand: "end",
      strings: { title: "X" },
    });
    check(
      "giveaway end không thấy → thông báo",
      replies[0].content.includes("Không tìm thấy giveaway"),
    );
  }

  // ── 12. reactionrole ──
  {
    reset();
    ctl.queryResult = { panels: [] };
    await run({ isChatInputCommand: true, commandName: "reactionrole", subcommand: "list" });
    check("reactionrole list rỗng → thông báo", replies[0].content.includes("Chưa có bảng"));

    reset();
    ctl.queryResult = {
      panels: [
        {
          _id: "p1",
          label: "Bảng",
          channelId: "c1",
          entries: [{ emoji: "✅", roleId: "r1" }],
          enabled: true,
        },
      ],
    };
    await run({ isChatInputCommand: true, commandName: "reactionrole", subcommand: "list" });
    check(
      "reactionrole list có → embed",
      replies[0].embeds?.[0]?.data?.title?.includes("Reaction role"),
    );

    reset();
    ctl.perms.manage = false;
    ctl.queryResult = { panels: [] };
    await run({ isChatInputCommand: true, commandName: "reactionrole", subcommand: "create" });
    check(
      "reactionrole create thiếu quyền → needPerm",
      replies[0].content.includes("không có quyền"),
    );

    reset();
    ctl.queryResult = { panels: [] };
    const channel = { id: "c1", isTextBased: () => true, toString: () => "#chung" };
    await run({
      isChatInputCommand: true,
      commandName: "reactionrole",
      subcommand: "create",
      channels: { channel },
      strings: { label: "B", pairs: "✅:123456789012345" },
    });
    check(
      "reactionrole create hợp lệ → mutation tạo panel",
      calls.mutations.some((m) => m.name === "hidden:botCreatePanel"),
    );

    reset();
    ctl.queryResult = { panels: [] };
    await run({
      isChatInputCommand: true,
      commandName: "reactionrole",
      subcommand: "create",
      channels: { channel },
      strings: { label: "B", pairs: "sai" },
    });
    check("reactionrole create cặp sai → từ chối", replies[0].content.includes("ít nhất 1 cặp"));

    reset();
    ctl.queryResult = {
      panels: [{ _id: "p1", label: "Bảng", entries: [{ emoji: "✅", roleId: "r1" }] }],
    };
    await run({
      isChatInputCommand: true,
      commandName: "reactionrole",
      subcommand: "add",
      strings: { label: "Bảng", emoji: "✅" },
      roles: { role: { id: "r2" } },
    });
    check(
      "reactionrole add emoji trùng → từ chối",
      replies[0].content.includes("đã có trong bảng"),
    );

    reset();
    ctl.queryResult = {
      panels: [{ _id: "p1", label: "Bảng", entries: [{ emoji: "✅", roleId: "r1" }] }],
    };
    await run({
      isChatInputCommand: true,
      commandName: "reactionrole",
      subcommand: "add",
      strings: { label: "Bảng", emoji: "⭐" },
      roles: { role: { id: "r2" } },
    });
    check(
      "reactionrole add hợp lệ → mutation cập nhật",
      calls.mutations.some((m) => m.name === "hidden:botUpdatePanel"),
    );

    reset();
    ctl.queryResult = {
      panels: [{ _id: "p1", label: "Bảng", entries: [{ emoji: "✅", roleId: "r1" }] }],
    };
    await run({
      isChatInputCommand: true,
      commandName: "reactionrole",
      subcommand: "remove",
      strings: { label: "Bảng", emoji: "khong-co" },
    });
    check(
      "reactionrole remove emoji không thấy → từ chối",
      replies[0].content.includes("Không tìm thấy emoji"),
    );

    reset();
    ctl.queryResult = {
      panels: [{ _id: "p1", label: "Bảng", entries: [{ emoji: "✅", roleId: "r1" }] }],
    };
    await run({
      isChatInputCommand: true,
      commandName: "reactionrole",
      subcommand: "remove",
      strings: { label: "Bảng", emoji: "✅" },
    });
    check(
      "reactionrole remove hợp lệ → mutation cập nhật",
      calls.mutations.some((m) => m.name === "hidden:botUpdatePanel"),
    );

    reset();
    ctl.queryResult = {
      panels: [{ _id: "p1", label: "Bảng", entries: [{ emoji: "✅", roleId: "r1" }] }],
    };
    await run({
      isChatInputCommand: true,
      commandName: "reactionrole",
      subcommand: "edit",
      strings: { label: "Bảng" },
    });
    check(
      "reactionrole edit thiếu trường → từ chối",
      replies[0].content.includes("ít nhất một trường"),
    );

    reset();
    ctl.queryResult = {
      panels: [{ _id: "p1", label: "Bảng", entries: [{ emoji: "✅", roleId: "r1" }] }],
    };
    await run({
      isChatInputCommand: true,
      commandName: "reactionrole",
      subcommand: "edit",
      strings: { label: "Bảng", new_label: "Bảng mới" },
    });
    check(
      "reactionrole edit hợp lệ → mutation cập nhật",
      calls.mutations.some((m) => m.name === "hidden:botUpdatePanel"),
    );

    reset();
    ctl.queryResult = {
      panels: [{ _id: "p1", label: "Bảng", entries: [{ emoji: "✅", roleId: "r1" }] }],
    };
    await run({
      isChatInputCommand: true,
      commandName: "reactionrole",
      subcommand: "delete",
      strings: { label: "Bảng" },
    });
    check(
      "reactionrole delete → mutation xóa panel",
      calls.mutations.some((m) => m.name === "hidden:botDeletePanel"),
    );

    reset();
    ctl.queryResult = { panels: [] };
    await run({
      isChatInputCommand: true,
      commandName: "reactionrole",
      subcommand: "add",
      strings: { label: "Không có", emoji: "⭐" },
      roles: { role: { id: "r2" } },
    });
    check(
      "reactionrole add panel không thấy → thông báo",
      replies[0].content.includes("Không tìm thấy bảng"),
    );
  }

  // ── 13. backup ──
  {
    reset();
    ctl.queryResult = [];
    await run({ isChatInputCommand: true, commandName: "backup", subcommand: "list" });
    check("backup list rỗng → thông báo", replies[0].content.includes("Chưa có backup"));

    reset();
    ctl.queryResult = [
      {
        _id: "b1",
        guildName: "G",
        createdAt: Date.now(),
        roleCount: 1,
        channelCount: 2,
        pushedToGithub: true,
      },
    ];
    await run({ isChatInputCommand: true, commandName: "backup", subcommand: "list" });
    check("backup list có → embed", replies[0].embeds?.[0]?.data?.title?.includes("Backup"));

    reset();
    ctl.perms.manage = false;
    await run({
      isChatInputCommand: true,
      commandName: "backup",
      subcommand: "restore",
      integers: { index: 1 },
    });
    check("backup restore thiếu quyền → needPerm", replies[0].content.includes("không có quyền"));

    reset();
    ctl.queryResult = [];
    await run({
      isChatInputCommand: true,
      commandName: "backup",
      subcommand: "restore",
      integers: { index: 5 },
    });
    check(
      "backup restore index sai → từ chối",
      replies[0].content.includes("Không tìm thấy backup"),
    );

    reset();
    ctl.queryResult = [{ _id: "b1", guildName: "G", roleCount: 1, channelCount: 2 }];
    await run({
      isChatInputCommand: true,
      commandName: "backup",
      subcommand: "restore",
      integers: { index: 1 },
    });
    check(
      "backup restore hợp lệ → mutation yêu cầu",
      calls.mutations.some((m) => m.name === "bot_writes:botSetRestoreRequest"),
    );

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "backup",
      subcommand: "auto",
      integers: { days: 1 },
    });
    check("backup auto ngày không hợp lệ → từ chối", replies[0].content.includes("2 đến 30"));

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "backup",
      subcommand: "auto",
      integers: { days: 7 },
    });
    check(
      "backup auto hợp lệ → mutation",
      calls.mutations.some((m) => m.name === "bot_writes:botSetAutoBackup"),
    );

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "backup",
      subcommand: "now",
      booleans: { github: true },
    });
    check(
      "backup now → mutation yêu cầu backup",
      calls.mutations.some((m) => m.name === "bot_writes:botSetBackupRequest"),
    );
  }

  // ── 14. verify (setup/toggle/method) ──
  {
    reset();
    ctl.perms.manage = false;
    await run({
      isChatInputCommand: true,
      commandName: "verify",
      subcommand: "toggle",
      strings: { value: "on" },
    });
    check("verify thiếu quyền → needPerm", replies[0].content.includes("không có quyền"));

    reset();
    const vchannel = { id: "c-v", send: async () => {}, toString: () => "#verify" };
    await run({
      isChatInputCommand: true,
      commandName: "verify",
      subcommand: "setup",
      channels: { channel: vchannel },
      roles: { unverified_role: { id: "r-unv" }, verified_role: { id: "r-ver" } },
      strings: { method: "captcha" },
    });
    check(
      "verify setup captcha → mutation + gửi panel",
      calls.mutations.some((m) => m.name === "bot_writes:botUpdateSettings") &&
        replies[0].content.includes("Đã thiết lập"),
    );

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "verify",
      subcommand: "toggle",
      strings: { value: "sai" },
    });
    check("verify toggle giá trị sai → từ chối", replies[0].content.includes("on hoặc off"));

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "verify",
      subcommand: "toggle",
      strings: { value: "off" },
    });
    check(
      "verify toggle off → mutation",
      calls.mutations.some((m) => m.name === "bot_writes:botUpdateSettings"),
    );

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "verify",
      subcommand: "method",
      strings: { type: "sai" },
    });
    check("verify method sai → từ chối", replies[0].content.includes("button hoặc captcha"));

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "verify",
      subcommand: "method",
      strings: { type: "captcha" },
    });
    check(
      "verify method captcha → mutation",
      calls.mutations.some((m) => m.name === "bot_writes:botUpdateSettings"),
    );
  }

  // ── 15. setup ──
  {
    reset();
    ctl.perms.manage = false;
    await run({ isChatInputCommand: true, commandName: "setup", subcommand: "log-channel" });
    check("setup thiếu quyền → needPerm", replies[0].content.includes("không có quyền"));

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "setup",
      subcommand: "log-channel",
      channels: { channel: { id: "c-log", toString: () => "#log" } },
    });
    check(
      "setup log-channel → mutation",
      calls.mutations.some((m) => m.name === "bot_writes:botUpdateSettings"),
    );

    reset();
    configs.set("g1", { modRoles: ["r1"] });
    await run({
      isChatInputCommand: true,
      commandName: "setup",
      subcommand: "mod-role",
      roles: { role: { id: "r2", toString: () => "@Mod" } },
    });
    check(
      "setup mod-role → mutation gộp role",
      calls.mutations.some(
        (m) =>
          m.name === "bot_writes:botUpdateSettings" &&
          m.args.modRoles.includes("r1") &&
          m.args.modRoles.includes("r2"),
      ),
    );

    reset();
    configs.set("g1", { adminRoles: [] });
    await run({
      isChatInputCommand: true,
      commandName: "setup",
      subcommand: "admin-role",
      roles: { role: { id: "r3", toString: () => "@Admin" } },
    });
    check(
      "setup admin-role → mutation",
      calls.mutations.some((m) => m.name === "bot_writes:botUpdateSettings"),
    );
  }

  // ── 16. alt ──
  {
    reset();
    ctl.perms.manage = false;
    ctl.perms.admin = false;
    configs.set("g1", {});
    await run({ isChatInputCommand: true, commandName: "alt", subcommand: "status" });
    check("alt thiếu quyền → needPerm", replies[0].content.includes("không có quyền"));

    reset();
    configs.set("g1", { altDetectionEnabled: true, altVpnMode: "strict" });
    await run({ isChatInputCommand: true, commandName: "alt", subcommand: "status" });
    check("alt status → embed", replies[0].embeds?.[0]?.data?.title?.includes("Alt Detection"));

    reset();
    await run({ isChatInputCommand: true, commandName: "alt", subcommand: "on" });
    check(
      "alt on → mutation",
      calls.mutations.some((m) => m.name === "bot_writes:botUpdateSettings"),
    );

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "alt",
      subcommand: "punish",
      strings: { type: "sai" },
    });
    check("alt punish sai → từ chối", replies[0].content.includes("kick, ban, timeout"));

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "alt",
      subcommand: "punish",
      strings: { type: "ban" },
    });
    check(
      "alt punish hợp lệ → mutation",
      calls.mutations.some((m) => m.name === "bot_writes:botUpdateSettings"),
    );

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "alt",
      subcommand: "threshold",
      integers: { value: 5 },
    });
    check("alt threshold ngoài 10-100 → từ chối", replies[0].content.includes("10 đến 100"));

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "alt",
      subcommand: "threshold",
      integers: { value: 50 },
    });
    check(
      "alt threshold hợp lệ → mutation",
      calls.mutations.some((m) => m.name === "bot_writes:botUpdateSettings"),
    );

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "alt",
      subcommand: "vpn",
      strings: { mode: "sai" },
    });
    check("alt vpn sai → từ chối", replies[0].content.includes("strict, warn"));

    reset();
    await run({
      isChatInputCommand: true,
      commandName: "alt",
      subcommand: "vpn",
      strings: { mode: "warn" },
    });
    check(
      "alt vpn hợp lệ → mutation",
      calls.mutations.some((m) => m.name === "bot_writes:botUpdateSettings"),
    );
  }

  fs.unlinkSync(path.join(__dirname, "..", "bot", "test-djs-mock.cjs"));
  console.log(`\nKết quả interaction create: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error("CRASH:", e);
  process.exit(1);
});
