/**
 * Test bộ chuẩn hóa file backup .msc/.json (bot nuke khác) + sắp xếp thứ tự.
 *
 * Chạy: node scripts/test-backup-import.cjs
 */
const {
  normalizeBackupFile,
  sortedRoles,
  sortedChannels,
  countMessages,
  resolveAttachment,
  nameFromUrl,
  normalizeEmoji,
  normalizeSticker,
  sanitizeEmojiName,
  slimBackupForStore,
} = require("../bot/src/handlers/backup.js");

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name} — ${detail ?? ""}`);
  }
}

console.log("1) File JSON trực tiếp (định dạng Protogon v2):");
let b = normalizeBackupFile(
  JSON.stringify({
    version: 2,
    guildId: "111",
    guildName: "Server A",
    roles: [
      { id: "r1", name: "Mod", color: 65280, position: 3 },
      { id: "r2", name: "Member", color: 0, position: 1 },
      { id: "r3", name: "Admin", color: 16711680, position: 5 },
    ],
    channels: [
      { id: "c1", name: "general", type: 0, position: 2, topic: "chào", overwrites: [] },
      { id: "c2", name: "Văn phòng", type: 4, position: 0, overwrites: [] },
    ],
  }),
);
check("đọc được guildName", b.guildName === "Server A", b.guildName);
check("đủ 3 role", b.roles.length === 3, String(b.roles.length));
check("đủ 2 kênh", b.channels.length === 2, String(b.channels.length));
check("giữ nguyên vị trí role", b.roles[0].position === 3 && b.roles[2].position === 5, JSON.stringify(b.roles.map((r) => r.position)));
check("sortedRoles theo đúng thứ tự file (Member → Mod → Admin)", sortedRoles(b).map((r) => r.name).join(",") === "Member,Mod,Admin", sortedRoles(b).map((r) => r.name).join(","));
check("sortedChannels danh mục trước kênh theo vị trí", sortedChannels(b).map((c) => c.name).join(",") === "Văn phòng,general", sortedChannels(b).map((c) => c.name).join(","));

console.log("\n2) File có lớp bọc ngoài (data / guild / server):");
b = normalizeBackupFile(
  JSON.stringify({
    data: {
      server: { name: "Server B" },
      guildRoles: [{ name: "Vip", color: "#ffd700", position: 2 }],
      guildChannels: [{ name: "chat", type: "text", position: 0 }],
    },
  }),
);
check("gỡ được wrapper → 1 role", b.roles.length === 1, String(b.roles.length));
check("gỡ được wrapper → 1 kênh", b.channels.length === 1, String(b.channels.length));
check("màu hex #ffd700 → 0xffd700", b.roles[0].color === 0xffd700, String(b.roles[0].color));
check("type kênh chuỗi 'text' → 0", b.channels[0].type === 0, String(b.channels[0].type));

console.log("\n3) File bọc base64:");
const raw = JSON.stringify({
  guildName: "Server C",
  roles: [{ name: "Mod", permissions: "8", position: 0 }],
  channels: [{ name: "general", type: "text", position: 0 }],
});
b = normalizeBackupFile(Buffer.from(raw).toString("base64"));
check("giải mã base64 → 1 role + 1 kênh", b.roles.length === 1 && b.channels.length === 1, `${b.roles.length}/${b.channels.length}`);
check("giữ quyền role", b.roles[0].permissions === "8", b.roles[0].permissions);

console.log("\n4) Tin nhắn trong kênh (author dạng chuỗi + object, timestamp ISO/ms):");
b = normalizeBackupFile(
  JSON.stringify({
    guildName: "Server D",
    roles: [],
    channels: [
      {
        name: "general",
        type: 0,
        position: 0,
        messages: [
          { content: "tin 1", author: { username: "Alice" }, timestamp: "2024-01-01T00:00:00.000Z" },
          { content: "tin 2", author: "Bob", timestamp: 1704067200000 },
          { content: "tin 3", author: { username: "Alice" }, timestamp: "2024-01-02T00:00:00.000Z" },
        ],
      },
    ],
  }),
);
check("chuẩn hóa đủ 3 tin", b.channels[0].messages.length === 3, String(b.channels[0].messages?.length));
check("messageCount = 3", countMessages(b) === 3, String(countMessages(b)));
check("timestamp ISO + ms đều về ms", b.channels[0].messages.every((m) => Number.isFinite(m.timestamp)), JSON.stringify(b.channels[0].messages.map((m) => m.timestamp)));
check("author object → username", b.channels[0].messages[0].authorName === "Alice", b.channels[0].messages[0].authorName);
check("author chuỗi → giữ nguyên", b.channels[0].messages[1].authorName === "Bob", b.channels[0].messages[1].authorName);
const order = b.channels[0].messages.map((m) => m.content).join(",");
check("thứ tự tin nhắn tăng dần theo thời gian", order === "tin 1,tin 2,tin 3", order);

console.log("\n5) Tên trường đa dạng (permission_overwrites, roleData, channel_id):");
b = normalizeBackupFile(
  JSON.stringify({
    guild_id: "999",
    roleData: [{ roleId: "x1", roleName: "Nuke Guard", permissions: 0, position: 4, colour: "#00ff00" }],
    channelData: [
      {
        channel_id: "y1",
        channelName: "raid-log",
        channelType: "announcement",
        position: 1,
        permission_overwrites: [{ id: "x1", type: 0, allow: "1024", deny: 0 }],
      },
    ],
  }),
);
check("roleData/roleId/roleName/colour → chuẩn hóa", b.roles.length === 1 && b.roles[0].name === "Nuke Guard" && b.roles[0].color === 0x00ff00, JSON.stringify(b.roles[0]));
check("channel_id/channelName/channelType 'announcement' → 5", b.channels[0].type === 5, String(b.channels[0].type));
check("overwrite giữ id/type/allow", b.channels[0].overwrites.length === 1 && b.channels[0].overwrites[0].allow === "1024", JSON.stringify(b.channels[0].overwrites));

console.log("\n6) File hỏng:");
let threw = false;
try {
  normalizeBackupFile("day khong phai json cung khong phai base64 !!!");
} catch (e) {
  threw = true;
  check("báo lỗi rõ ràng", /không đọc được file backup|không phải JSON/i.test(e.message), e.message);
}
check("file hỏng → ném lỗi", threw);

console.log("\n7) File JSON nhưng không có roles/channels:");
threw = false;
try {
  normalizeBackupFile(JSON.stringify({ hello: "world" }));
} catch (e) {
  threw = true;
  check("báo lỗi thiếu cấu trúc", /role.*kênh|kênh.*role/i.test(e.message), e.message);
}
check("thiếu roles/channels → ném lỗi", threw);

console.log("\n8) Sắp xếp ổn định khi thiếu position (fallback theo thứ tự file):");
b = normalizeBackupFile(
  JSON.stringify({
    roles: [
      { name: "A", position: 5 },
      { name: "B" },
      { name: "C", position: 5 },
      { name: "D", position: 2 },
    ],
  }),
);
const names = sortedRoles(b).map((r) => r.name).join(",");
check("position ưu tiên, thiếu thì theo thứ tự file (B,D,A,C)", names === "B,D,A,C", names);

console.log("\n9) Media — giữ nguyên khi import (URL + data URI base64) và tải về được:");
b = normalizeBackupFile(
  JSON.stringify({
    guildName: "Server E",
    roles: [],
    channels: [
      {
        name: "general",
        type: 0,
        position: 0,
        messages: [
          {
            content: "ảnh đây",
            author: "A",
            attachments: ["data:image/png;base64,iVBORw0KGgo="],
          },
          {
            content: "link",
            author: "B",
            attachments: [
              "https://cdn.discordapp.com/attachments/1/2/hinh%20x.png?ex=1&is=2",
            ],
          },
        ],
      },
    ],
  }),
);
check(
  "giữ data URI trong attachments",
  b.channels[0].messages[0].attachments[0].startsWith("data:image/png;base64,"),
  b.channels[0].messages[0].attachments[0],
);
check(
  "giữ URL attachment (kèm query CDN)",
  b.channels[0].messages[1].attachments[0] ===
    "https://cdn.discordapp.com/attachments/1/2/hinh%20x.png?ex=1&is=2",
  b.channels[0].messages[1].attachments[0],
);
check(
  "nameFromUrl bỏ query, giải mã %20 → tên sạch",
  nameFromUrl("https://cdn.discordapp.com/attachments/1/2/hinh%20x.png?ex=1&is=2") ===
    "hinh_x.png",
  nameFromUrl("https://cdn.discordapp.com/attachments/1/2/hinh%20x.png?ex=1&is=2"),
);

console.log("\n10) Emoji từ file bot nuke (chuỗi `<:name:id>` / `<a:...>` / object có url/raw):");
let e = normalizeEmoji("<:pepe:123>", 0);
check("chuỗi <:name:id> → name/id", e && e.name === "pepe" && e.id === "123", JSON.stringify(e));
e = normalizeEmoji("<a:boing:456>", 0);
check("chuỗi <a:name:id> → animated", e && e.name === "boing" && e.animated === true, JSON.stringify(e));
e = normalizeEmoji("vip:789", 0);
check("chuỗi name:id → name/id", e && e.name === "vip" && e.id === "789", JSON.stringify(e));
e = normalizeEmoji({ name: "happy", url: "https://cdn.discordapp.com/emojis/1.png", animated: false }, 0);
check("object có url → giữ url", e && e.name === "happy" && e.url === "https://cdn.discordapp.com/emojis/1.png", JSON.stringify(e));
e = normalizeEmoji({ emojiName: "wow", image: "data:image/png;base64,AAAA" }, 0);
check("object có raw base64 (image) → raw", e && e.name === "wow" && e.raw === "data:image/png;base64,AAAA", JSON.stringify(e));
check("emoji rỗng/null → null", normalizeEmoji("", 0) === null && normalizeEmoji(null, 0) === null);

console.log("\n11) Sticker từ file bot nuke (URL chuỗi / object có tags + url):");
let s = normalizeSticker("https://cdn.discordapp.com/stickers/1.png", 0);
check("sticker URL chuỗi → url", s && s.url === "https://cdn.discordapp.com/stickers/1.png", JSON.stringify(s));
s = normalizeSticker(
  { name: "cat", tags: "😀", url: "https://cdn.discordapp.com/stickers/2.png", formatType: 1 },
  0,
);
check("sticker object → name/tags/url/formatType", s && s.name === "cat" && s.tags === "😀" && s.formatType === 1, JSON.stringify(s));
s = normalizeSticker({ name: "dog", asset: "abc123" }, 0);
check("sticker asset → url null (không chết)", s && s.url === null && s.name === "dog", JSON.stringify(s));

console.log("\n12) normalizeBackupFile đọc emoji/sticker từ file nuke (nhiều tên trường):");
b = normalizeBackupFile(
  JSON.stringify({
    guildName: "Server F",
    roles: [],
    channels: [],
    emojis: ["<:pepe:111>", { name: "happy", url: "https://cdn.discordapp.com/emojis/9.png" }],
    stickers: [{ name: "cat", tags: "😀", url: "https://cdn.discordapp.com/stickers/2.png" }],
  }),
);
check(
  "đọc 2 emoji + 1 sticker + đếm đúng",
  b.emojis.length === 2 && b.stickers.length === 1 && b.emojiCount === 2 && b.stickerCount === 1,
  JSON.stringify({ e: b.emojis, s: b.stickers }),
);
check("file chỉ có emoji/sticker vẫn chấp nhận", b.roles.length === 0 && b.channels.length === 0);

console.log("\n13) sanitizeEmojiName (Discord: 2-32 ký tự, chữ thường + _):");
check("viết hoa + ký tự lạ → thường + _", sanitizeEmojiName("Pepe Hand") === "pepe_hand", sanitizeEmojiName("Pepe Hand"));
check("tên 1 ký tự → ít nhất 2 ký tự", sanitizeEmojiName("x").length >= 2, sanitizeEmojiName("x"));
check("tên > 32 ký tự → cắt về 32", sanitizeEmojiName("a".repeat(40)).length === 32);

console.log("\n14) slimBackupForStore — bỏ base64 nặng khi lưu bản import (chống vượt 1 MB Convex):");
const big = {
  guildName: "Server G",
  roles: [],
  channels: [
    {
      name: "general",
      type: 0,
      messages: [
        {
          content: "a",
          author: "A",
          attachments: [
            "data:image/png;base64,AAA",
            "https://cdn.discordapp.com/attachments/1/2/x.png",
          ],
        },
      ],
    },
  ],
  emojis: [{ name: "wow", raw: "data:image/png;base64,BBB" }],
  stickers: [{ name: "cat", raw: "data:image/png;base64,CCC", url: "https://cdn.discordapp.com/stickers/2.png" }],
};
const slim = slimBackupForStore(big);
check(
  "bỏ data URI trong attachment, giữ URL",
  slim.channels[0].messages[0].attachments.length === 1 &&
    slim.channels[0].messages[0].attachments[0].startsWith("https://"),
  JSON.stringify(slim.channels[0].messages[0].attachments),
);
check("bỏ raw emoji", slim.emojis[0].raw === undefined, JSON.stringify(slim.emojis[0]));
check("bỏ raw sticker, giữ url", slim.stickers[0].raw === undefined && slim.stickers[0].url !== null, JSON.stringify(slim.stickers[0]));
check(
  "bản gốc KHÔNG bị sửa đổi (vẫn dùng để đăng media thật)",
  big.channels[0].messages[0].attachments[0].startsWith("data:") && big.emojis[0].raw !== undefined,
  JSON.stringify(big.emojis[0]),
);

console.log("\n15) JSON nằm giữa văn bản thừa (dòng tiêu đề / trailer):");
b = normalizeBackupFile(
  "MSC BACKUP v1.0 — file khong sua doi\n" +
    JSON.stringify({ guildName: "Server H", roles: [{ name: "Mod" }], channels: [{ name: "general", type: 0 }] }) +
    "\n--- het file ---",
);
check("cắt được JSON giữa tiêu đề + trailer", b.roles.length === 1 && b.channels.length === 1, JSON.stringify({ r: b.roles.length, c: b.channels.length }));

console.log("\n16) Base64 có tiền tố (base64://, data:...;base64,) + URL-encode:");
const raw16 = JSON.stringify({ guildName: "Server I", roles: [{ name: "Vip" }] });
check(
  "base64:// prefix",
  normalizeBackupFile("base64://" + Buffer.from(raw16).toString("base64")).roles[0].name === "Vip",
  "",
);
check(
  "data:application/json;base64, prefix",
  normalizeBackupFile("data:application/json;base64," + Buffer.from(raw16).toString("base64")).roles[0].name === "Vip",
  "",
);
check(
  "URL-encode",
  normalizeBackupFile(encodeURIComponent(raw16)).roles[0].name === "Vip",
  encodeURIComponent(raw16).slice(0, 40),
);

console.log("\n17) Roles/channels dạng OBJECT keyed-by-id (không phải array):");
b = normalizeBackupFile(
  JSON.stringify({
    guildName: "Server J",
    roles: { r1: { name: "Admin", permissions: "administrator,ban_members" }, r2: { name: "Member" } },
    channels: {
      c1: { name: "general", type: 0 },
      c2: { name: "Văn phòng", type: 4 },
    },
  }),
);
check("object roles → 2 role đúng thứ tự", b.roles.length === 2 && b.roles[0].name === "Admin", JSON.stringify(b.roles.map((r) => r.name)));
check("object channels → 2 kênh", b.channels.length === 2, String(b.channels.length));

console.log("\n18) Quyền lưu theo TÊN → bitfield (administrator/ban_members, view_channel/send_messages):");
check(
  "administrator+ban_members → bitfield 12",
  b.roles[0].permissions === "12",
  b.roles[0].permissions,
);
b = normalizeBackupFile(
  JSON.stringify({
    guildName: "Server K",
    roles: [],
    channels: [
      {
        name: "general",
        type: 0,
        overwrites: [{ id: "x", type: 0, allow: ["view_channel", "send_messages"], deny: 0 }],
      },
    ],
  }),
);
check(
  "overwrite allow theo tên → bitfield 3072 (view_channel=1024, send_messages=2048)",
  b.channels[0].overwrites[0].allow === "3072",
  b.channels[0].overwrites[0].allow,
);

console.log("\n19) Wrapper sâu 5 lớp + wrapper chứa chuỗi JSON/base64 nhúng:");
b = normalizeBackupFile(
  JSON.stringify({ result: { data: { guild: { server: { backup: { snapshot: { roles: [{ name: "Deep" }] } } } } } } }),
);
check("wrapper 5 lớp → đọc được role", b.roles.length === 1 && b.roles[0].name === "Deep", String(b.roles.length));
const wrappedStr = JSON.stringify({
  ok: true,
  content: Buffer.from(JSON.stringify({ guildName: "Server L", roles: [{ name: "Nested" }] })).toString("base64"),
});
b = normalizeBackupFile(wrappedStr);
check("wrapper chứa chuỗi base64 nhúng → đệ quy đọc được", b.roles.length === 1 && b.roles[0].name === "Nested", JSON.stringify(b.roles));

(async () => {
  const f = await resolveAttachment("data:image/png;base64,iVBORw0KGgo=", 0);
  check(
    "giải mã data URI → buffer + tên .png",
    !!f && Buffer.isBuffer(f.attachment) && f.attachment.length > 0 && f.name.endsWith(".png"),
    JSON.stringify(f?.name),
  );
  const f2 = await resolveAttachment("data:text/plain;base64,SGVsbG8=", 1);
  check(
    "data URI text/plain → nội dung đúng + tên .txt",
    !!f2 && f2.attachment.toString("utf8") === "Hello" && f2.name.endsWith(".txt"),
    JSON.stringify(f2?.attachment?.toString("utf8")),
  );
  const f3 = await resolveAttachment("", 0);
  check("attachment rỗng → null", f3 === null);
  const f4 = await resolveAttachment("không phải url", 0);
  check("attachment không hợp lệ → null (không treo)", f4 === null);

  console.log(`\nKết quả: ${pass} đúng / ${fail} sai`);
  if (fail > 0) process.exit(1);
})();
