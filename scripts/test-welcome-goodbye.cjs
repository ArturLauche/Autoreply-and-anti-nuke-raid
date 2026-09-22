// Test welcome.js — chào/tạm biệt thành viên:
//   - fillTemplate: {user} {username} {server} {count} {created} {boost} thay đúng + cắt 1500 ký tự
//   - handleWelcome/handleGoodbye: bỏ qua bot; tắt enabled → không gửi; thiếu kênh → không gửi
//   - payload: allowedMentions chỉ phép mention member (không @everyone từ nội dung)
//   - embed mode: content mention + embed description; plain mode: content trực tiếp
//   - kênh fetch lỗi / thiếu quyền gửi → bỏ qua im lặng (không crash, không gửi)
//   - nội dung trống → dùng mặc định theo ngôn ngữ server (locale quốc gia)
//   - v2: template ngẫu nhiên nhiều dòng, embed tùy chỉnh (màu/ảnh/thumbnail),
//     welcome DM riêng, autorole (trễ/include bot/role rác), RAID-SAFE lockdown → im lặng
// Không mạng, không Discord thật. Chạy: node scripts/test-welcome-goodbye.cjs

const path = require("path");
const Module = require("module");
const fs = require("fs");

let sent = [];
let fetchFail = false;
let noPerms = false;
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === "discord.js") {
    return path.join(__dirname, "_djs-welcome-mock.cjs");
  }
  return origResolve.call(this, request, ...args);
};
fs.writeFileSync(
  path.join(__dirname, "_djs-welcome-mock.cjs"),
  `module.exports = {
  Colors: { Green: 0x57f287, Grey: 0x99aab5 },
  PermissionFlagsBits: { SendMessages: 1 },
  EmbedBuilder: class {
    setColor(c) { this.__color = c; return this; }
    setDescription(d) { this.__desc = d; return this; }
    setTitle(t) { this.__title = t; return this; }
    setImage(u) { this.__image = u; return this; }
    setThumbnail(u) { this.__thumb = u; return this; }
    setTimestamp() { return this; }
  },
};`,
);
process.on("exit", () => {
  try {
    fs.unlinkSync(path.join(__dirname, "_djs-welcome-mock.cjs"));
  } catch {}
});
const welcome = require("../bot/src/handlers/welcome");
const { handleWelcome, handleGoodbye, WELCOME_DEFAULT, GOODBYE_DEFAULT, _fillTemplateForTest } =
  welcome;
const lang = require("../bot/src/handlers/lang");

let pass = 0,
  fail = 0;
function check(label, cond) {
  if (cond) {
    pass++;
    console.log("PASS", label);
  } else {
    fail++;
    console.log("FAIL", label);
  }
}

function makeGuild() {
  // guild.members.me.permissionsIn(channel) — mock để noPerms case hoạt động đúng.
  return {
    id: "g1",
    name: "Test Server",
    memberCount: 42,
    members: { me: { permissionsIn: () => ({ has: () => !noPerms }) } },
  };
}
function makeClient() {
  sent = [];
  return {
    channels: {
      fetch: async (id) => {
        if (fetchFail) throw new Error("kênh biến mất");
        if (noPerms)
          return {
            isTextBased: () => true,
            send: async () => {
              sent.push({});
              return {};
            },
          };
        return {
          id,
          isTextBased: () => true,
          send: async (payload) => {
            sent.push(payload);
            return {};
          },
        };
      },
    },
  };
}
function makeStore(cfg) {
  return { getConfig: async () => ({ emergencyAlertEnabled: true, ...cfg }) };
}
const guild = makeGuild();
// member.guild luôn tồn tại trên Discord thật (guildMemberAdd/Remove event) — fixture bám đúng đó.
const member = { id: "u1", user: { bot: false, username: "user1" }, guild };
const botMember = { id: "b1", user: { bot: true, username: "botbot" }, guild };

(async () => {
  // ── fillTemplate ──
  const filled = _fillTemplateForTest(
    "Chào {user} ({username}) đến {server} — thành viên #{count}",
    { member, guild, isGoodbye: false },
  );
  check("template: {user} → mention", filled.includes("<@u1>"));
  check("template: {username}", filled.includes("user1"));
  check("template: {server}", filled.includes("Test Server"));
  check("template: {count}", filled.includes("42"));

  const long = _fillTemplateForTest("x".repeat(2000), { member, guild, isGoodbye: false });
  check("template: cắt tối đa 1500 ký tự", long.length <= 1500);

  // ── welcome cơ bản ──
  sent = [];
  fetchFail = false;
  noPerms = false;
  await handleWelcome(
    makeClient(),
    makeStore({ welcomeEnabled: true, welcomeChannelId: "c1", welcomeMessage: "Hi {user}!" }),
    member,
  );
  check("welcome: gửi đúng 1 tin", sent.length === 1);
  check("welcome: plain mode — content trực tiếp", sent[0]?.content === "Hi <@u1>!");
  check(
    "welcome: allowedMentions chỉ member (không @everyone từ nội dung)",
    JSON.stringify(sent[0]?.allowedMentions) === JSON.stringify({ users: ["u1"], parse: [] }),
  );

  // ── embed mode ──
  sent = [];
  await handleWelcome(
    makeClient(),
    makeStore({
      welcomeEnabled: true,
      welcomeChannelId: "c1",
      welcomeMessage: "Hi {user}!",
      welcomeUseEmbed: true,
    }),
    member,
  );
  check(
    "welcome: embed mode — mention trong content + mô tả trong embed",
    sent[0]?.content === "<@u1>" && sent[0]?.embeds?.[0]?.__desc === "Hi <@u1>!",
  );

  // ── goodbye ──
  sent = [];
  await handleGoodbye(
    makeClient(),
    makeStore({ goodbyeEnabled: true, goodbyeChannelId: "c2", goodbyeMessage: "" }),
    member,
  );
  // Guild mock không có preferredLocale → mặc định sản phẩm VI (quy ước lang.js).
  check(
    "goodbye: nội dung trống → mặc định theo ngôn ngữ server (VI)",
    sent[0]?.content ===
      lang.goodbyeDefault("vi").replaceAll("{user}", "<@u1>").replaceAll("{server}", "Test Server"),
  );

  // ── auto ngôn ngữ theo quốc gia (guild.preferredLocale) ──
  const memberEn = { ...member, guild: { ...guild, preferredLocale: "en-US" } };
  sent = [];
  await handleWelcome(
    makeClient(),
    makeStore({ welcomeEnabled: true, welcomeChannelId: "c1", welcomeMessage: "" }),
    memberEn,
  );
  check(
    "welcome: locale en-US → mặc định EN",
    sent[0]?.content ===
      WELCOME_DEFAULT.replaceAll("{user}", "<@u1>")
        .replaceAll("{server}", "Test Server")
        .replaceAll("{count}", "42"),
  );
  sent = [];
  await handleGoodbye(
    makeClient(),
    makeStore({ goodbyeEnabled: true, goodbyeChannelId: "c2", goodbyeMessage: "" }),
    memberEn,
  );
  check(
    "goodbye: locale en-US → mặc định EN",
    sent[0]?.content ===
      GOODBYE_DEFAULT.replaceAll("{user}", "<@u1>").replaceAll("{server}", "Test Server"),
  );
  const memberJa = { ...member, guild: { ...guild, preferredLocale: "ja" } };
  sent = [];
  await handleWelcome(
    makeClient(),
    makeStore({ welcomeEnabled: true, welcomeChannelId: "c1", welcomeMessage: "" }),
    memberJa,
  );
  check("welcome: quốc gia không hỗ trợ (ja) → EN mặc định", sent[0]?.content.includes("Welcome"));
  // Nội dung tùy chỉnh luôn thắng mặc định bất kể ngôn ngữ server.
  sent = [];
  await handleWelcome(
    makeClient(),
    makeStore({ welcomeEnabled: true, welcomeChannelId: "c1", welcomeMessage: "Custom {user}" }),
    memberJa,
  );
  check("welcome: nội dung tùy chỉnh ưu tiên hơn mặc định", sent[0]?.content === "Custom <@u1>");

  // ── bỏ qua bot ──
  sent = [];
  await handleWelcome(
    makeClient(),
    makeStore({ welcomeEnabled: true, welcomeChannelId: "c1" }),
    botMember,
  );
  await handleGoodbye(
    makeClient(),
    makeStore({ goodbyeEnabled: true, goodbyeChannelId: "c2" }),
    botMember,
  );
  check("bot join/leave → không chào không tạm biệt", sent.length === 0);

  // ── tắt enabled ──
  sent = [];
  await handleWelcome(
    makeClient(),
    makeStore({ welcomeEnabled: false, welcomeChannelId: "c1" }),
    member,
  );
  check("welcomeEnabled=false → không gửi", sent.length === 0);

  // ── thiếu kênh ──
  sent = [];
  await handleWelcome(makeClient(), makeStore({ welcomeEnabled: true }), member);
  check("bật nhưng chưa chọn kênh → không gửi (không crash)", sent.length === 0);

  // ── kênh fetch lỗi ──
  sent = [];
  fetchFail = true;
  await handleWelcome(
    makeClient(),
    makeStore({ welcomeEnabled: true, welcomeChannelId: "cX" }),
    member,
  );
  check("kênh bị xoá → bỏ qua im lặng, không crash", sent.length === 0);

  // ── thiếu quyền gửi ──
  sent = [];
  fetchFail = false;
  noPerms = true;
  await handleWelcome(
    makeClient(),
    makeStore({ welcomeEnabled: true, welcomeChannelId: "c1" }),
    member,
  );
  check("bot thiếu quyền gửi trong kênh → bỏ qua", sent.length === 0);

  // ══ Welcome/Goodbye v2 (học Carl-bot/Welcomer/ProBot) ══
  noPerms = false; // khôi phục sau case thiếu quyền ở trên
  const { _pickTemplateForTest, _embedColorForTest, _buildPayloadForTest } = welcome;
  const pick = _pickTemplateForTest;

  // ── template ngẫu nhiên: mỗi dòng 1 câu, bot chọn 1 trong số đó ──
  const tpl3 = "Câu một\nCâu hai\nCâu ba";
  const picks = new Set();
  for (let i = 0; i < 200; i++) picks.add(pick(tpl3, "fallback"));
  check(
    "random: chọn từ đúng 3 dòng",
    picks.size === 3 && [...picks].every((s) => ["Câu một", "Câu hai", "Câu ba"].includes(s)),
  );
  check("random: config rỗng → fallback", pick("\n \n", "fallback") === "fallback");
  check("random: 1 dòng → luôn dòng đó", pick("Chỉ một", "x") === "Chỉ một");

  // ── embedColor: parse #hex 6/3, rác → fallback ──
  check("color: #57f287 → 5757287? parse đúng", _embedColorForTest("#57f287", 0) === 0x57f287);
  check("color: #abc → 0xaabbcc", _embedColorForTest("#abc", 0) === 0xaabbcc);
  check("color: rác → fallback", _embedColorForTest("tôi là màu", 0x123456) === 0x123456);
  check("color: number hợp lệ giữ nguyên", _embedColorForTest(42, 0) === 42);

  // ── safeUrl qua buildPayload: URL rác không nhét vào embed ──
  const guildV2 = { ...guild, premiumSubscriptionCount: 7 };
  const memberV2 = {
    id: "u1",
    user: { bot: false, username: "user1", createdTimestamp: Date.now() - 365 * 86_400_000 },
    guild: guildV2,
  };
  const payloadV2 = _buildPayloadForTest(
    "welcome",
    {
      welcomeUseEmbed: true,
      welcomeEmbedTitle: "🎉 {username}",
      welcomeEmbedColor: "#57f287",
      welcomeEmbedImage: "not-a-url",
      welcomeEmbedThumbnail: "https://example.com/a.png",
      welcomeRandom: "Chào {user}! Tuổi account {created} ngày, server có {boost} boost",
    },
    { member: memberV2, guild: guildV2 },
  );
  const emb = payloadV2.embeds?.[0];
  check("v2 embed: màu #hex parse thành số", emb?.__color === 0x57f287);
  check("v2 embed: title fill placeholder + cắt 256", emb?.__title === "🎉 user1");
  check("v2 embed: URL rác → không setImage", emb?.__image === undefined);
  check("v2 embed: URL hợp lệ → setThumbnail", emb?.__thumb === "https://example.com/a.png");
  check(
    "v2 embed: {created}/{boost} thay đúng",
    emb?.__desc?.includes("365") && emb?.__desc?.includes("7"),
  );
  check("v2 embed: content là mention member", payloadV2.content === "<@u1>");

  // ── welcome DM ──
  let dms = [];
  const clientDm = { channels: makeClient().channels };
  const memberDm = {
    ...memberV2,
    send: async (p) => {
      dms.push(p);
      return {};
    },
  };
  sent = [];
  await handleWelcome(
    clientDm,
    makeStore({
      welcomeEnabled: true,
      welcomeChannelId: "c1",
      welcomeDmEnabled: true,
      welcomeDmMessage: "DM chào {username}!",
    }),
    memberDm,
  );
  check("v2 DM: gửi 1 tin vào kênh + 1 tin DM", sent.length === 1 && dms.length === 1);
  check("v2 DM: nội dung fill placeholder", dms[0]?.content === "DM chào user1!");
  check(
    "v2 DM: allowedMentions giới hạn member",
    JSON.stringify(dms[0]?.allowedMentions) === JSON.stringify({ users: ["u1"], parse: [] }),
  );

  // DM tắt → không gửi DM
  dms = [];
  await handleWelcome(
    clientDm,
    makeStore({ welcomeEnabled: true, welcomeChannelId: "c1", welcomeDmEnabled: false }),
    memberDm,
  );
  check("v2 DM: tắt welcomeDmEnabled → không DM", dms.length === 0);

  // Bot không nhận DM
  dms = [];
  await handleWelcome(clientDm, makeStore({ welcomeDmEnabled: true, welcomeDmMessage: "hi" }), {
    ...botMember,
    send: async (p) => dms.push(p),
  });
  check("v2 DM: bot join → không DM", dms.length === 0);

  // ── autorole ──
  let roleAdds = [];
  const memberRole = {
    ...memberV2,
    roles: { add: async (id, reason) => roleAdds.push({ id, reason }) },
  };
  await handleWelcome(
    makeClient(),
    makeStore({ autoroleEnabled: true, autoroleRoleId: "111111111111111111", autoroleDelaySec: 0 }),
    memberRole,
  );
  await new Promise((r) => setTimeout(r, 20));
  check(
    "v2 autorole: cấp role ngay (trễ 0)",
    roleAdds.length === 1 && roleAdds[0].id === "111111111111111111",
  );
  check("v2 autorole: kèm lý do Protogon autorole", roleAdds[0]?.reason === "Protogon autorole");

  // Bot không nhận autorole trừ khi bật include
  roleAdds = [];
  const botRole = { ...botMember, roles: { add: async (id) => roleAdds.push(id) }, guild };
  await handleWelcome(
    makeClient(),
    makeStore({ autoroleEnabled: true, autoroleRoleId: "111111111111111111", autoroleDelaySec: 0 }),
    botRole,
  );
  await new Promise((r) => setTimeout(r, 20));
  check("v2 autorole: bot → không cấp role", roleAdds.length === 0);

  roleAdds = [];
  await handleWelcome(
    makeClient(),
    makeStore({
      autoroleEnabled: true,
      autoroleRoleId: "111111111111111111",
      autoroleDelaySec: 0,
      autoroleIncludeBots: true,
    }),
    botRole,
  );
  await new Promise((r) => setTimeout(r, 20));
  check("v2 autorole: includeBots → bot nhận role", roleAdds.length === 1);

  // roleId rác → không cấp (không crash)
  roleAdds = [];
  await handleWelcome(
    makeClient(),
    makeStore({ autoroleEnabled: true, autoroleRoleId: "not-an-id", autoroleDelaySec: 0 }),
    memberRole,
  );
  await new Promise((r) => setTimeout(r, 20));
  check("v2 autorole: roleId rác → bỏ qua", roleAdds.length === 0);

  // ── RAID-SAFE: lockdown đang hoạt động → im lặng hoàn toàn ──
  sent = [];
  dms = [];
  roleAdds = [];
  const memberLock = { ...memberRole, send: async (p) => dms.push(p) };
  await handleWelcome(
    makeClient(),
    makeStore({
      welcomeEnabled: true,
      welcomeChannelId: "c1",
      welcomeDmEnabled: true,
      autoroleEnabled: true,
      autoroleRoleId: "111111111111111111",
      autoroleDelaySec: 0,
      lockdownUntil: Date.now() + 60_000,
    }),
    memberLock,
  );
  await new Promise((r) => setTimeout(r, 20));
  check(
    "v2 lockdown: không chào, không DM, không autorole",
    sent.length === 0 && dms.length === 0 && roleAdds.length === 0,
  );

  // Lockdown hết hạn → hoạt động trở lại
  sent = [];
  roleAdds = [];
  await handleWelcome(
    makeClient(),
    makeStore({
      welcomeEnabled: true,
      welcomeChannelId: "c1",
      autoroleEnabled: true,
      autoroleRoleId: "111111111111111111",
      autoroleDelaySec: 0,
      lockdownUntil: Date.now() - 1_000,
    }),
    memberRole,
  );
  await new Promise((r) => setTimeout(r, 20));
  check("v2 lockdown hết hạn: chào + autorole trở lại", sent.length === 1 && roleAdds.length === 1);

  console.log(`\nKết quả welcome-goodbye: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
})();
