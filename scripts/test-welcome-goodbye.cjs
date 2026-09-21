// Test welcome.js — chào/tạm biệt thành viên:
//   - fillTemplate: {user} {username} {server} {count} thay đúng + cắt 1500 ký tự
//   - handleWelcome/handleGoodbye: bỏ qua bot; tắt enabled → không gửi; thiếu kênh → không gửi
//   - payload: allowedMentions chỉ phép mention member (không @everyone từ nội dung)
//   - embed mode: content mention + embed description; plain mode: content trực tiếp
//   - kênh fetch lỗi / thiếu quyền gửi → bỏ qua im lặng (không crash, không gửi)
//   - nội dung trống trong config → dùng mặc định
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
    setColor() { return this; }
    setDescription(d) { this.__desc = d; return this; }
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
const { handleWelcome, handleGoodbye, GOODBYE_DEFAULT, _fillTemplateForTest } = welcome;

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
  check(
    "goodbye: nội dung trống → dùng mặc định",
    sent[0]?.content ===
      GOODBYE_DEFAULT.replaceAll("{user}", "<@u1>").replaceAll("{server}", "Test Server"),
  );

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

  console.log(`\nKết quả welcome-goodbye: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
})();
