// TEST LIVE Haimiya trên deployment THẬT (giống hệt đường đi của web).
// Chạy: bun scripts/test-haimiya-live.mjs [deployment-url]
// Gọi action haimiya:ask qua ConvexHttpClient — nếu key AI đã đặt trên deployment
// thì nhận reply thật; nếu chưa → { reply: "", offline: true }.
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const url = process.argv[2] || "https://accomplished-chipmunk-74.convex.cloud";
console.log("Deployment:", url);

const client = new ConvexHttpClient(url);

// Test 1: chat Haimiya cơ bản
const r1 = await client.action(anyApi.haimiya.ask, {
  messages: [{ role: "user", content: "Haimiya ơi, hệ thống nhiệt độ của Protogon có mấy giai đoạn?" }],
});
console.log("[chat] offline:", r1.offline, "| reply:", String(r1.reply || "").slice(0, 220));

// Test 2: classifyViolation (đường AI Guard DỰ PHÒNG trên Convex — bot chính chạy
// phân loại trực tiếp từ VPS nên action này không ảnh hưởng bảo vệ). Chỉ in verdict.
const r2 = await client.action(anyApi.haimiya.classifyViolation, {
  guildId: "test", module: "spam", count: 8, windowSeconds: 10, threshold: 6,
  sampleMessages: ["@everyone JOIN NOW discord.gg/abc", "@everyone JOIN NOW discord.gg/abc", "@everyone JOIN NOW discord.gg/abc"],
  recentJoins: 15, memberCount: 5000,
});
console.log(
  `[classify] offline: ${r2.offline} | verdict: ${r2.classification} (${r2.confidence}) — ${r2.reason || ""}`.slice(0, 260),
);

const ok1 = !r1.offline && String(r1.reply || "").length > 20;
console.log(ok1 ? "\n✅ Haimiya chat LIVE — key AI trên deployment hoạt động" : "\n❌ Haimiya chat OFFLINE — deployment chưa có key AI hoặc provider lỗi");
process.exit(ok1 ? 0 : 1);
