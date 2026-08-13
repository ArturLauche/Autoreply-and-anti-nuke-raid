const { messageFingerprint, isExternalAppSpam } = require("../bot/src/handlers/antinuke.js");

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

// Mô phỏng đúng cách bot tích lũy mẫu trong cửa sổ 15s (threshold mặc định = 2).
function simulate(messages, threshold = 2, windowSeconds = 15) {
  const samples = [];
  let result = null;
  for (const m of messages) {
    samples.push({ fp: messageFingerprint(m) });
    const now = Date.now();
    const cutoff = now - windowSeconds * 1000;
    const fresh = samples.filter((e) => e.ts === undefined || e.ts >= cutoff);
    result = isExternalAppSpam({
      samples: fresh,
      currentFingerprint: messageFingerprint(m),
      count: fresh.length,
      threshold,
      hay: `${m.content || ""} ${(m.embeds || []).map((e) => e.title || e.description || "").join(" ")}`,
    });
    if (result.triggered) break;
  }
  return result;
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

console.log(`\nKết quả: ${pass} đúng / ${fail} sai`);
process.exit(fail > 0 ? 1 : 0);
