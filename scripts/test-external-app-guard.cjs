const { messageFingerprint, isExternalAppSpam } = require("../bot/src/handlers/antinuke.js");
const { appNameSuspicion, isExternalAppTarget, buttonRaidSignal } = require("../bot/src/externalAppGuard");

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

// Mô phỏng ĐÚNG quy trình caller trong handleExternalAppMessage của bot:
// tích lũy mẫu { fp, ts } theo appId trong cửa sổ 15s, tính count = fresh.length
// (caller PHẢI khai báo `const count = fresh.length;` — thiếu là lỗi ReferenceError
// khi bot sắp chặn app, vụ từng xảy ra), rồi mới gọi isExternalAppSpam.
function simulate(messages, threshold = 2, windowSeconds = 15) {
  const appMsgSamples = []; // giống Map appMsgSamples.get(key) của bot
  let result = null;
  let count = 0;
  for (const m of messages) {
    appMsgSamples.push({ fp: messageFingerprint(m), ts: Date.now() });
    const now = Date.now();
    const cutoff = now - windowSeconds * 1000;
    const fresh = appMsgSamples.filter((e) => e.ts >= cutoff);
    count = fresh.length; // contract bắt buộc trong handleExternalAppMessage
    result = isExternalAppSpam({
      samples: fresh,
      currentFingerprint: messageFingerprint(m),
      count,
      threshold,
      hay: `${m.content || ""} ${(m.embeds || []).map((e) => e.title || e.description || "").join(" ")}`,
    });
    if (result.triggered) break;
  }
  return { ...result, callerCount: count };
}

console.log("1) Spam nội dung khác nhau từng tin (không invite) — trước đây KHÔNG phát hiện:");
let r = simulate([
  { content: "buy crypto now" },
  { content: "free nitro here" },
  { content: "join our telegram" },
  { content: "limited giveaway!!" },
]);
check("flood 4 tin trong cửa sổ → kích hoạt", r?.triggered === true, JSON.stringify(r));

console.log("\n2) Spam lặp nội dung giống hệt:");
r = simulate([{ content: "WIN A PRIZE" }, { content: "WIN A PRIZE" }]);
check("2 tin trùng → kích hoạt", r?.triggered === true, JSON.stringify(r));

console.log("\n3) Spam CHỈ gửi embed (text trống) — trước đây KHÔNG phát hiện:");
r = simulate([
  { content: "", embeds: [{ title: "🔥 LIMITED OFFER", description: "discord nitro" }] },
  { content: "", embeds: [{ title: "🔥 LIMITED OFFER", description: "discord nitro" }] },
]);
check("2 embed trùng → kích hoạt", r?.triggered === true, JSON.stringify(r));

console.log("\n4) App quảng cáo kèm link mời Discord:");
r = simulate([{ content: "join us discord.gg/xyz" }, { content: "free stuff discord.gg/abc" }]);
check("vượt ngưỡng (2) + có invite → kích hoạt", r?.triggered === true, JSON.stringify(r));

console.log("\n5) Bot quen thuộc gửi 2 tin khác nhau (không spam):");
r = simulate([{ content: "now playing: song A" }, { content: "now playing: song B" }]);
check("KHÔNG kích hoạt (tránh phạt nhầm)", r?.triggered === false, JSON.stringify(r));

console.log("\n6) Bot gửi 1 tin lẻ (không spam):");
r = simulate([{ content: "hello everyone" }]);
check("KHÔNG kích hoạt", r?.triggered === false, JSON.stringify(r));

console.log("\n7) Bot gửi 3 tin khác nhau (chưa đủ flood 4):");
r = simulate([{ content: "a" }, { content: "b" }, { content: "c" }]);
check("KHÔNG kích hoạt", r?.triggered === false, JSON.stringify(r));

console.log("\n8) Ngưỡng mod đặt cao (vd 5) — flood 4 tin không đủ:");
r = simulate([{ content: "a" }, { content: "b" }, { content: "c" }, { content: "d" }], 5);
check("KHÔNG kích hoạt", r?.triggered === false, JSON.stringify(r));

console.log("\n9) Caller contract — count phải khớp fresh.length (chống tái phát ReferenceError):");
r = simulate([{ content: "X" }, { content: "X" }]);
check("callerCount là số > 0, không phải undefined", typeof r?.callerCount === "number" && r.callerCount > 0, JSON.stringify(r));
check("callerCount khớp số tin trong cửa sổ", r?.callerCount === 2, JSON.stringify(r));

console.log("\n10) Biến thể lặp GẦN GIỐNG (đổi số/emoji/URL mỗi tin để né filter) — trước đây KHÔNG phát hiện:");
r = simulate([
  { content: "FREE NITRO GIVEAWAY claim now 1" },
  { content: "FREE NITRO GIVEAWAY claim now 2" },
  { content: "FREE NITRO GIVEAWAY claim now 3" },
]);
check("3 tin gần giống → kích hoạt", r?.triggered === true, JSON.stringify(r));
check("similar >= 2 được báo", r?.similar >= 2, JSON.stringify(r));

console.log("\n11) App spam @everyone/@here kèm quảng cáo:");
r = simulate([{ content: "@everyone join my server now" }, { content: "@here free nitro giveaway" }]);
check("2 tin có mention vượt ngưỡng → kích hoạt", r?.triggered === true, JSON.stringify(r));
check("hasEveryone được báo", r?.hasEveryone === true, JSON.stringify(r));

console.log("\n12) Từ khóa scam + link rút gọn (bit.ly/t.me...) — biến thể link lừa đảo:");
r = simulate([{ content: "free nitro here https://bit.ly/abc" }, { content: "claim your reward now https://t.me/xyz" }]);
check("2 tin scam + shortlink → kích hoạt", r?.triggered === true, JSON.stringify(r));
check("hasShortlink được báo", r?.hasShortlink === true, JSON.stringify(r));
check("scamHits >= 2 được báo", r?.scamHits >= 2, JSON.stringify(r));

console.log("\n13) Embed gần giống (chỉ đổi số ở footer/field mỗi tin) — né fingerprint cũ:");
r = simulate([
  { content: "", embeds: [{ title: "🔥 LIMITED OFFER", description: "discord nitro gift", fields: [{ name: "Code", value: "A1" }] }] },
  { content: "", embeds: [{ title: "🔥 LIMITED OFFER", description: "discord nitro gift", fields: [{ name: "Code", value: "B2" }] }] },
]);
check("2 embed gần giống → kích hoạt", r?.triggered === true, JSON.stringify(r));

console.log("\n14) Tên app đáng ngờ (giả mạo / scam / dạng máy) — dùng cho phát hiện trước ngưỡng:");
let a = appNameSuspicion("MEE6 Pro");
check("\"MEE6 Pro\" → giả mạo app nổi tiếng", a.score >= 3 && a.parts.some((p) => p.includes("giả mạo")), JSON.stringify(a));
a = appNameSuspicion("Free Nitro Giveaway");
check("\"Free Nitro Giveaway\" → từ khóa scam", a.score >= 3 && a.parts.some((p) => p.includes("scam")), JSON.stringify(a));
a = appNameSuspicion("MEE6");
check("\"MEE6\" (app thật) → KHÔNG nghi", a.score === 0, JSON.stringify(a));
a = appNameSuspicion("App 48291375");
check("\"App 48291375\" → tên dạng máy", a.score >= 1, JSON.stringify(a));

console.log("\n15) Flood không nội dung trùng (bot bị lợi dụng gửi nhiều tin khác nhau):");
r = simulate([{ content: "a" }, { content: "b" }, { content: "c" }, { content: "d" }]);
check("flood 4 tin khác nhau → vẫn kích hoạt (xóa tin, không ban nhầm)", r?.triggered === true, JSON.stringify(r));

console.log("\n16) Phân biệt bot được mời chính thức vs EXTERNAL APP (không cần mời bot vào server):");
// Tầng tin nhắn: bot user gửi tin (phải là thành viên) / webhook
check(
  "Bot có tick (verified) là thành viên gửi tin → KHÔNG phải external app",
  isExternalAppTarget({ isBot: true, isWebhook: false }) === false,
  JSON.stringify(isExternalAppTarget({ isBot: true, isWebhook: false })),
);
check(
  "Bot thường (không tick) là thành viên gửi tin → KHÔNG phải external app",
  isExternalAppTarget({ isBot: true, isWebhook: false }) === false,
  JSON.stringify(isExternalAppTarget({ isBot: true, isWebhook: false })),
);
check(
  "App gửi tin qua WEBHOOK → external app (không cần bot thành viên)",
  isExternalAppTarget({ isWebhook: true }) === true,
  JSON.stringify(isExternalAppTarget({ isWebhook: true })),
);
// Tầng audit IntegrationCreate
check(
  "Kết nối tài khoản Twitch → KHÔNG phải external app",
  isExternalAppTarget({ integrationType: "twitch" }) === false,
  JSON.stringify(isExternalAppTarget({ integrationType: "twitch" })),
);
check(
  "Kết nối tài khoản YouTube → KHÔNG phải external app",
  isExternalAppTarget({ integrationType: "youtube" }) === false,
  JSON.stringify(isExternalAppTarget({ integrationType: "youtube" })),
);
check(
  "App có bot user LÀ thành viên server (được mời chính thức) → KHÔNG phải external app",
  isExternalAppTarget({ integrationType: "discord", isGuildMember: true }) === false,
  JSON.stringify(isExternalAppTarget({ integrationType: "discord", isGuildMember: true })),
);
check(
  "App có tick xác minh (verified bot) nhưng không fetch được thành viên → KHÔNG phải external app",
  isExternalAppTarget({ integrationType: "discord", isGuildMember: false, hasVerifiedTick: true }) === false,
  JSON.stringify(isExternalAppTarget({ integrationType: "discord", isGuildMember: false, hasVerifiedTick: true })),
);
check(
  "App Discord kết nối từ ngoài, KHÔNG có bot thành viên, KHÔNG tick → external app",
  isExternalAppTarget({ integrationType: "discord", isGuildMember: false, hasVerifiedTick: false }) === true,
  JSON.stringify(isExternalAppTarget({ integrationType: "discord", isGuildMember: false, hasVerifiedTick: false })),
);

console.log("\n17) Raid bằng NÚT BẤM (button spam) — tin app có component:");
// Fingerprint phải bao gồm nút bấm để bắt flood tin app đăng nút làm mồi.
const btnMsg1 = { content: "claim now", components: [{ components: [{ type: 2, label: "Claim", customId: "c1" }] }] };
const btnMsg2 = { content: "claim now", components: [{ components: [{ type: 2, label: "Claim", customId: "c2" }] }] };
check(
  "Fingerprint khác nhau khi customId nút khác nhau (bắt flood đổi nút né filter)",
  messageFingerprint(btnMsg1) !== messageFingerprint(btnMsg2),
  JSON.stringify({ a: messageFingerprint(btnMsg1), b: messageFingerprint(btnMsg2) }),
);
check(
  "Fingerprint giống nhau khi cùng nội dung + cùng nút",
  messageFingerprint(btnMsg1) === messageFingerprint({ ...btnMsg1, components: [...btnMsg1.components] }),
  JSON.stringify(messageFingerprint(btnMsg1)),
);
r = simulate([
  { content: "claim now", components: [{ components: [{ type: 2, label: "Claim", customId: "c1" }] }] },
  { content: "claim now", components: [{ components: [{ type: 2, label: "Claim", customId: "c1" }] }] },
]);
check("2 tin app có nút bấm trùng nội dung → kích hoạt", r?.triggered === true, JSON.stringify(r));
// Tín hiệu bấm nút: 1 người spam bấm / làn sóng nhiều người bấm.
let b = buttonRaidSignal({ totalClicks: 2, sameUserClicks: 2, threshold: 2 });
check("2 lượt bấm (chưa đủ flood 6, chưa đủ 4 cùng người) → KHÔNG kích hoạt", b.triggered === false, JSON.stringify(b));
b = buttonRaidSignal({ totalClicks: 4, sameUserClicks: 4, threshold: 2 });
check("1 người bấm 4 lần → spamClicker (kẻ spam bấm)", b.triggered === true && b.spamClicker === true, JSON.stringify(b));
b = buttonRaidSignal({ totalClicks: 5, sameUserClicks: 5, threshold: 2 });
check("5 lần cùng 1 người → vẫn spamClicker dù chưa đủ flood", b.triggered === true && b.spamClicker === true, JSON.stringify(b));
b = buttonRaidSignal({ totalClicks: 6, sameUserClicks: 1, threshold: 2 });
check("6 lượt bấm khác người → clickFlood (làn sóng bấm)", b.triggered === true && b.clickFlood === true, JSON.stringify(b));
b = buttonRaidSignal({ totalClicks: 8, sameUserClicks: 3, threshold: 5 });
check("ngưỡng 5: 8 lượt bấm → clickFlood", b.triggered === true && b.clickFlood === true, JSON.stringify(b));

console.log(`\nKết quả: ${pass} đúng / ${fail} sai`);
process.exit(fail > 0 ? 1 : 0);
