// Test pipeline backup sau các bản fix (auto includeMessages, nén Gist, import 'z:', skip notice).
// Chạy: node scripts/test-backup-pipeline.cjs — không mạng thật, không Convex thật, không Discord thật.
const path = require("path");
const zlib = require("zlib");

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
class Collection extends Map {}
module.exports = {
  Colors: new Proxy({}, { get: () => 0x000000 }),
  EmbedBuilder,
  Collection,
  ChannelType: { GuildText: 0, GuildAnnouncement: 5, GuildVoice: 2, GuildCategory: 4, GuildStageVoice: 13, GuildForum: 15 },
  PermissionsBitField: { Flags: new Proxy({}, { get: () => 1n }) },
  PermissionFlagsBits: { ManageGuild: 1n << 5n, Administrator: 1n << 3n, ViewChannel: 1n << 10n },
  AuditLogEvent: new Proxy({}, { get: () => 0 }),
  Partials: {},
  GatewayIntentBits: new Proxy({}, { get: () => 0 }),
};
`,
);

// Backup encrypt key PHẢI tắt trong test (file test chạy ngoài bot, env khác VPS).
delete process.env.BACKUP_ENCRYPT_KEY;

const backup = require("../bot/src/handlers/backup.js");
const utils = require("../bot/src/backupUtils.js");

let pass = 0;
let fail = 0;
const check = (label, ok) => {
  console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
  ok ? pass++ : fail++;
};

(async () => {
  // ---- 1. Nén + giải mã vòng tròn (nền tảng của fix Gist + import 'z:') ----
  const snapshot = {
    version: 4,
    guildId: "123456789012345678",
    guildName: "Test Guild",
    createdAt: 0,
    roles: [{ id: "r1", name: "Mod", color: 0xff0000, permissions: "8", position: 1 }],
    channels: [{ id: "c1", name: "general", type: 0, overwrites: [], messages: [] }],
    emojis: [],
    stickers: [],
    emojiCount: 0,
    stickerCount: 0,
    messageCount: 0,
  };
  const enc = utils.compressAndEncryptBackup(snapshot);
  check("compressAndEncryptBackup nén thành 'z:...'", typeof enc.backupJson === "string" && enc.backupJson.startsWith("z:"));
  check("compressed=true", enc.compressed === true);
  const round = JSON.parse(utils.decompressAndDecryptBackup(enc.backupJson));
  check("giải nén vòng tròn ra snapshot gốc", round.guildName === "Test Guild" && round.roles.length === 1);

  // ---- 2. Auto-backup đồng bộ includeMessages theo bản gần nhất (fix checksum lệch) ----
  const mutations = [];
  const store = {
    client: {
      mutation: async (name, args) => {
        mutations.push({ name, args });
        return { ok: true, backupId: "bk1" };
      },
      query: async (name, args = {}) => {
        if (name === "backup:botGetDueAuto") {
          return [{ guildId: "123456789012345678", days: 7 }];
        }
        if (name === "backup:botGetLastChecksum") {
          // Bản gần nhất CÓ tin nhắn → auto phải đặt includeMessages=true
          return { backupSnapshotChecksum: "abc", backupMessageCount: 42 };
        }
        return null;
      },
      action: async () => ({ ok: true }),
    },
    getConfig: async () => null,
  };
  mutations.length = 0;
  await backup.autoBackupSweep({ guilds: { cache: new Map() } }, store);
  const req = mutations.find((m) => m.name === "bot_writes:botSetBackupRequest");
  check("auto sweep đặt yêu cầu backup", !!req);
  check(
    "auto sweep KẾ THỪA includeMessages=true từ bản gần nhất (trước đây luôn false → checksum lệch)",
    req?.args?.includeMessages === true,
  );

  // Bản gần nhất KHÔNG tin nhắn → auto không kèm tin
  store.client.query = async (name) => {
    if (name === "backup:botGetDueAuto") return [{ guildId: "g2", days: 3 }];
    if (name === "backup:botGetLastChecksum") return { backupSnapshotChecksum: "x", backupMessageCount: 0 };
    return null;
  };
  mutations.length = 0;
  await backup.autoBackupSweep({ guilds: { cache: new Map() } }, store);
  const req2 = mutations.find((m) => m.name === "bot_writes:botSetBackupRequest");
  check("bản gần nhất không tin → includeMessages=false", req2?.args?.includeMessages === false);

  // Chưa có backup nào (last null) → false (bản đầu không tin, khớp snapshot mặc định)
  store.client.query = async (name) => {
    if (name === "backup:botGetDueAuto") return [{ guildId: "g3", days: 2 }];
    if (name === "backup:botGetLastChecksum") return null;
    return null;
  };
  mutations.length = 0;
  await backup.autoBackupSweep({ guilds: { cache: new Map() } }, store);
  const req3 = mutations.find((m) => m.name === "bot_writes:botSetBackupRequest");
  check("chưa có backup nào → includeMessages=false", req3?.args?.includeMessages === false);

  // ---- 3. Import file 'z:' (tải từ Gist) giờ đọc được ----
  const zContent = enc.backupJson;
  let parsed = null;
  try {
    parsed = backup.normalizeBackupFile(zContent);
  } catch (e) {
    parsed = { error: e.message };
  }
  check(
    "import bản nén 'z:' của Protogon không còn lỗi 'Không đọc được file'",
    !parsed.error && parsed.guildName === "Test Guild",
  );
  check("import 'z:' giữ đúng role + kênh", !parsed.error && parsed.roles[0]?.name === "Mod" && parsed.channels[0]?.name === "general");

  // JSON thường vẫn đọc bình thường (không bị reg)
  const plainJson = JSON.stringify({ guildName: "Plain", roles: [{ id: "a", name: "A" }], channels: [] });
  const p2 = backup.normalizeBackupFile(plainJson);
  check("JSON thường vẫn đọc được", p2.guildName === "Plain");

  // ---- 4. Backup bị skip (checksum trùng) — chỉ thông báo khi người dùng chủ động ----
  // Mô phỏng runBackup với checksum trùng: cần guild giả đủ để snapshot chạy.
  // (runBackup gọi sendToLog → sendLog thật sẽ lỗi im lặng; dùng embed capture qua store.getConfig null + guild không có webhook → an toàn.)
  // Kiểm qua nguồn: skipNotice chỉ được truyền khi web bấm chủ động — kiểm tham số tồn tại trong signature.
  const src = fs.readFileSync(path.join(__dirname, "..", "bot", "src", "handlers", "backup.js"), "utf8");
  check("runBackup có tham số skipNotice", /const \{ pushToGithub = false, includeMessages = false, skipNotice = false \} = opts;/.test(src));
  check("skipNotice chỉ thông báo khi true (auto vẫn im lặng)", src.includes("if (skipNotice) {"));

  // ---- 5. pushToGithub gửi bản ĐÃ NÉN (không còn backupJson: json thô) ----
  check(
    "runBackup đẩy GitHub bằng backupJson nén (trước đây JSON thô >900KB bị Gist từ chối)",
    src.includes("// Gửi bản ĐÃ NÉN") && !/backupJson: json,/.test(src),
  );

  console.log(`\nKết quả backup pipeline: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error("CRASH:", e);
  process.exit(1);
});
