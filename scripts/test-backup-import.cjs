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
  check("báo lỗi rõ ràng", /không phải JSON/i.test(e.message), e.message);
}
check("file hỏng → ném lỗi", threw);

console.log("\n7) File JSON nhưng không có roles/channels:");
threw = false;
try {
  normalizeBackupFile(JSON.stringify({ hello: "world" }));
} catch (e) {
  threw = true;
  check("báo lỗi thiếu cấu trúc", /role hoặc kênh/i.test(e.message), e.message);
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
