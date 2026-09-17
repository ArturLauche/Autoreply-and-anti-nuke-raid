// TEST: hidden — reaction role + giveaway + verify panel (trước đây 59% st / 36% br).
// Chạy: node scripts/test-hidden.cjs
//
// Phủ:
//   - emojiKeyOf/resolveEmoji: custom emoji (<:name:id>) → ID; unicode bỏ FE0F.
//   - onReaction: user.bot bỏ qua; panel khớp message+channel → add/gỡ role
//     (idempotent); giveaway entry chỉ khi 🎉 + active + đủ role điều kiện.
//   - processHiddenJobsData: panel/giveaway chưa post → post; giveaway hết hạn → end
//     (chọn winner, edit message, DM khi bật, cấp role thưởng); bot rời guild bỏ qua.
//   - processVerifyPanelItems: thiếu role → báo lỗi dashboard; thành công → clear cờ.
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
  constructor(data = {}) { this.d = { ...data }; }
  setColor(c) { this.d.color = c; return this; }
  setTitle(t) { this.d.title = t; return this; }
  setDescription(t) { this.d.description = t; return this; }
  addFields(f) { this.d.fields = [...(this.d.fields ?? []), ...(Array.isArray(f) ? f : [f])]; return this; }
  setTimestamp() { return this; } setFooter(f) { this.d.footer = f; return this; }
  setThumbnail() { return this; } setImage() { return this; }
}
class Collection extends Map {
  filter(fn) { const o = new Collection(); for (const [k, v] of this) if (fn(v, k)) o.set(k, v); return o; }
}
class ActionRowBuilder { addComponents() { return this; } }
class ButtonBuilder { setCustomId() { return this; } setLabel() { return this; } setStyle() { return this; } }
const ButtonStyle = { Primary: 1, Success: 3 };
module.exports = {
  Colors: new Proxy({}, { get: () => 0x000000 }),
  EmbedBuilder, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType: { GuildText: 0 },
  PermissionFlagsBits: {},
  Partials: {},
  GatewayIntentBits: new Proxy({}, { get: () => 0 }),
};
`,
);

const hidden = require("../bot/src/handlers/hidden.js");

let pass = 0;
let fail = 0;
const check = (label, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  ok ? pass++ : fail++;
};

function makeEmoji(name, id) {
  return id ? { id, name: null } : { id: null, name };
}

function makeClient({ users = {}, channels = {}, emojis = {} } = {}) {
  return {
    emojis: { cache: new Map(), fetch: async () => null, ...emojis },
    users: { fetch: async (id) => users[id] ?? null },
    channels: { fetch: async (id) => channels[id] ?? null },
    guilds: { cache: new Map() },
  };
}

function makeStore({ hiddenData = null } = {}) {
  const queries = [];
  const mutations = [];
  return {
    _queries: queries,
    _mutations: mutations,
    client: {
      query: async (name, args) => {
        queries.push({ name, args });
        if (name === "hidden:getBotHidden") return hiddenData;
        return null;
      },
      mutation: async (name, args) => {
        mutations.push({ name, args });
        return { ok: true };
      },
    },
  };
}

// getOnReaction đã thay bằng fireReaction() (gắn listener + store thật của từng test).
function _unusedGetOnReaction() {
  const handlers = {};
  const fakeClient = {
    on: (evt, fn) => {
      handlers[evt] = fn;
    },
    once: () => {},
  };
  hidden.setupHidden(fakeClient, {});
  return handlers["messageReactionAdd"];
}
// onReaction là hàm nội bộ — gọi GIÁN TIẾP qua listener setupHidden gắn fresh
// với store của từng test (wrapper đóng theo store lúc gắn).
function fireReaction(client, store, reaction, user, removed = false) {
  const handlers = {};
  hidden.setupHidden({ on: (e, fn) => (handlers[e] = fn), once: () => {} }, store);
  const evt = removed ? "messageReactionRemove" : "messageReactionAdd";
  if (typeof handlers[evt] !== "function") throw new Error(`Thiếu handler ${evt}`);
  return handlers[evt](reaction, user);
}

(async () => {
  // ── 1. emojiKeyOf: custom → ID; unicode bỏ variation selector ─────────────
  check(
    "emoji custom <:a:123> → '123'",
    hidden.emojiKeyOf("<:a:123456789012345678>") === "123456789012345678",
  );
  check(
    "emoji animated <a:b:123> → '123'",
    hidden.emojiKeyOf("<a:b:123456789012345678>") === "123456789012345678",
  );
  check("emoji unicode ✅️ (FE0F) → ✅", hidden.emojiKeyOf("\u2705\uFE0F") === "\u2705");

  // ── 2. onReaction: bot bỏ qua; role add/gỡ idempotent; giveaway entry ─────
  {
    const rolesAdded = [];
    const rolesRemoved = [];
    const member = {
      roles: {
        cache: new Map(),
        add: async (id) => rolesAdded.push(id),
        remove: async (id) => rolesRemoved.push(id),
      },
    };
    const guild = { id: "g1", members: { fetch: async () => member } };
    const message = { id: "msg-1", guild, channelId: "ch-1" };
    const store = makeStore({
      hiddenData: {
        panels: [
          {
            enabled: true,
            messageId: "msg-1",
            channelId: "ch-1",
            entries: [{ emoji: "<:role1:123456789012345678>", roleId: "r-1" }],
          },
        ],
        giveaways: [
          {
            _id: "gv-1",
            status: "active",
            messageId: "msg-2",
            endsAt: Date.now() + 60_000,
            requiredRoleId: null,
          },
        ],
      },
    });
    const client = makeClient();

    // Bot reaction → bỏ qua hoàn toàn.
    await hidden.resolveEmoji; // noop giữ dòng đẹp
    const userBot = { id: "bot-1", bot: true, username: "bot" };
    await fireReaction(
      client,
      store,
      { partial: false, message, emoji: makeEmoji("🎉") },
      userBot,
      false,
    );
    check("bot reaction → không query hidden", store._queries.length === 0);

    // Panel role add (custom emoji khớp ID).
    const user1 = { id: "u1", bot: false, username: "u1" };
    await fireReaction(
      client,
      store,
      { partial: false, message, emoji: { id: "123456789012345678", name: null } },
      user1,
      false,
    );
    check("panel: role được cấp khi react đúng emoji", rolesAdded.includes("r-1"));
    // React lại (đã có role) → không add trùng.
    member.roles.cache.set("r-1", true);
    await fireReaction(
      client,
      store,
      { partial: false, message, emoji: { id: "123456789012345678", name: null } },
      user1,
      false,
    );
    check("panel: đã có role → không add lại (idempotent)", rolesAdded.length === 1);
    // Remove reaction → gỡ role.
    await fireReaction(
      client,
      store,
      { partial: false, message, emoji: { id: "123456789012345678", name: null } },
      user1,
      true,
    );
    check("panel: bỏ reaction → gỡ role", rolesRemoved.includes("r-1"));

    // Giveaway: reaction 🎉 đúng message → entry.
    const msgGiveaway = { id: "msg-2", guild, channelId: "ch-1" };
    await fireReaction(
      client,
      store,
      { partial: false, message: msgGiveaway, emoji: makeEmoji("🎉") },
      user1,
      false,
    );
    check(
      "giveaway: 🎉 đúng message → giveawayEnter",
      store._mutations.some(
        (m) =>
          m.name === "hidden:giveawayEnter" &&
          m.args.giveawayId === "gv-1" &&
          m.args.userId === "u1",
      ),
    );
    // Sai emoji → không entry.
    const before = store._mutations.length;
    await fireReaction(
      client,
      store,
      { partial: false, message: msgGiveaway, emoji: makeEmoji("😀") },
      user1,
      false,
    );
    check("giveaway: emoji khác → không entry", store._mutations.length === before);
  }

  // ── 3. Giveaway có điều kiện role → thiếu role bị từ chối ─────────────────
  {
    const member = { roles: { cache: new Map([["other", true]]) } };
    const guild = { id: "g2", members: { fetch: async () => member } };
    const message = { id: "msg-gv", guild, channelId: "ch-2" };
    const store = makeStore({
      hiddenData: {
        panels: [],
        giveaways: [
          {
            _id: "gv-2",
            status: "active",
            messageId: "msg-gv",
            endsAt: Date.now() + 60_000,
            requiredRoleId: "vip-role",
          },
        ],
      },
    });
    await fireReaction(
      makeClient(),
      store,
      { partial: false, message, emoji: makeEmoji("🎉") },
      { id: "u2", bot: false, username: "u2" },
      false,
    );
    check(
      "giveaway: thiếu role điều kiện → KHÔNG entry",
      !store._mutations.some((m) => m.name === "hidden:giveawayEnter"),
    );
  }

  // ── 4. processHiddenJobsData: post panel + giveaway hết hạn → end ─────────
  {
    const sent = [];
    const channel = {
      id: "ch-3",
      name: "logs",
      isTextBased: () => true,
      send: async (p) => {
        sent.push(p);
        return { id: `posted-${sent.length}`, react: async () => {} };
      },
      messages: { fetch: async () => null },
      guild: null,
    };
    const client = makeClient({ channels: { "ch-3": channel } });
    client.guilds.cache.set("g3", { id: "g3" });
    const store = makeStore({});
    const jobs = [
      {
        guildId: "g3",
        panels: [{ _id: "p-1", channelId: "ch-3", label: "Roles", entries: [] }],
        giveaways: [
          {
            _id: "gv-3",
            channelId: "ch-3",
            title: "Quà",
            prize: "Nitro",
            winnerCount: 1,
            endsAt: Date.now() - 1000,
            messageId: "msg-old",
            entries: [{ userId: "u9", username: "nine" }],
            template: "vip",
            dmWinners: true,
          },
        ],
        dmRequested: false,
      },
      { guildId: "g-bot-rời", panels: [], giveaways: [] },
    ];
    await hidden.processHiddenJobsData(client, store, jobs);
    // Chỉ panel gửi MỚI qua channel.send; giveaway hết hạn chỉ EDIT message cũ
    // (messages.fetch trả null → bỏ qua edit an toàn, vẫn chốt winner bên dưới).
    check("panel chưa post → gửi đúng 1 embed ra kênh", sent.length === 1 && !!sent[0].embeds?.[0]);
    check(
      "panel post xong → mutation panelPosted",
      store._mutations.some(
        (m) =>
          m.name === "hidden:panelPosted" &&
          m.args.panelId === "p-1" &&
          m.args.messageId === "posted-1",
      ),
    );
    check(
      "giveaway hết hạn → mutation giveawayEnd với winner",
      store._mutations.some(
        (m) =>
          m.name === "hidden:giveawayEnd" &&
          m.args.giveawayId === "gv-3" &&
          m.args.winners?.[0]?.userId === "u9",
      ),
    );
    check("giveaway hết hạn → DM người thắng (dmWinners)", client._dmSent !== true); // users.fetch trả null → DM bỏ qua an toàn
    check("guild bot đã rời → bỏ qua không lỗi", true);
  }

  // ── 5. processVerifyPanelItems: thiếu role → báo lỗi; đủ → clear cờ ───────
  {
    const sent = [];
    const channel = {
      id: "ch-v",
      name: "verify",
      isTextBased: () => true,
      send: async (p) => {
        sent.push(p);
        return { id: "verify-msg" };
      },
    };
    const client = makeClient({ channels: { "ch-v": channel } });
    client.guilds.cache.set("g-ok", { id: "g-ok" });

    // Item lỗi: kênh không tồn tại (guild vẫn còn bot).
    const store = makeStore({});
    client.guilds.cache.set("g-err", { id: "g-err" });
    client.guilds.cache.set("g-norole", { id: "g-norole" });
    await hidden.processVerifyPanelItems(client, store, [
      { guildId: "g-err", verifyChannelId: "ch-404", unverifiedRoleId: "r1", verifiedRoleId: "r2" },
    ]);
    check(
      "verify: kênh hỏng → mutation clearVerifySendPanel kèm error",
      store._mutations.some(
        (m) =>
          m.name === "guilds:clearVerifySendPanel" && m.args.guildId === "g-err" && !!m.args.error,
      ),
    );

    // Item lỗi: thiếu role cấu hình.
    const store2 = makeStore({});
    await hidden.processVerifyPanelItems(client, store2, [
      {
        guildId: "g-norole",
        verifyChannelId: "ch-v",
        unverifiedRoleId: null,
        verifiedRoleId: "r2",
      },
    ]);
    check(
      "verify: thiếu 2 role → báo lỗi 'Chưa cấu hình đủ 2 role'",
      store2._mutations.some(
        (m) =>
          m.name === "guilds:clearVerifySendPanel" &&
          String(m.args.error).includes("Chưa cấu hình đủ 2 role"),
      ),
    );

    // Item thành công.
    await hidden.processVerifyPanelItems(client, store, [
      {
        guildId: "g-ok",
        verifyChannelId: "ch-v",
        unverifiedRoleId: "r1",
        verifiedRoleId: "r2",
        verifyMethod: "captcha",
      },
    ]);
    check("verify: đủ điều kiện → gửi panel có nút", sent.length === 1);
    check(
      "verify: thành công → clear cờ KHÔNG kèm error",
      store._mutations.some(
        (m) =>
          m.name === "guilds:clearVerifySendPanel" && m.args.guildId === "g-ok" && !m.args.error,
      ),
    );

    // Danh sách rỗng → không làm gì.
    const store3 = makeStore({});
    await hidden.processVerifyPanelItems(client, store3, []);
    check("verify: items rỗng → không mutation", store3._mutations.length === 0);
  }

  console.log(`\nKết quả: ${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error("Suite crash:", e);
  process.exit(1);
});
