// TEST LIVE Haimiya trên deployment THẬT (giống hệt đường đi của web).
// Chạy: bun scripts/test-haimiya-live.mjs [deployment-url] [session-token]
// Gọi action haimiya:ask qua ConvexHttpClient — cần SESSION TOKEN hợp lệ
// (action giờ yêu cầu đăng nhập khi chưa cấu hình FUNC_SEED).
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const url = process.argv[2] || "https://accomplished-chipmunk-74.convex.cloud";
const token = process.argv[3] || "";
console.log(
  "Deployment:",
  url,
  token ? "(có token)" : "(KHÔNG có token — sẽ bị từ chối nếu backend yêu cầu đăng nhập)",
);

const client = new ConvexHttpClient(url);

// Test 1: chat Haimiya cơ bản
const r1 = await client
  .action(anyApi.haimiya.ask, {
    messages: [
      { role: "user", content: "Haimiya ơi, hệ thống nhiệt độ của Protogon có mấy giai đoạn?" },
    ],
    token,
  })
  .catch((e) => ({ offline: true, reply: `TỪ CHỐI: ${e.message}` }));
console.log("[chat] offline:", r1.offline, "| reply:", String(r1.reply || "").slice(0, 220));

// Test 2: classifyViolation giờ CHỈ bot có BOT_KEY được gọi — call không key
// phải bị từ chối (xác nhận hành vi bảo mật mới).
const r2 = await client
  .action(anyApi.haimiya.classifyViolation, {
    guildId: "test",
    module: "spam",
    count: 8,
    windowSeconds: 10,
    threshold: 6,
    sampleMessages: [
      "@everyone JOIN NOW discord.gg/abc",
      "@everyone JOIN NOW discord.gg/abc",
      "@everyone JOIN NOW discord.gg/abc",
    ],
    recentJoins: 15,
    memberCount: 5000,
  })
  .then((v) => ({ denied: false, ...v }))
  .catch((e) => ({ denied: true, message: e.message }));
if (r2.denied) {
  console.log(
    `[classify] ✅ đã bị chặn khi thiếu botKey ("${String(r2.message).slice(0, 80)}") — đúng chính sách mới`,
  );
} else {
  console.log(
    `[classify] offline: ${r2.offline} | verdict: ${r2.classification} (${r2.confidence}) — ${r2.reason || ""}`.slice(
      0,
      260,
    ),
  );
}
console.log(
  `[classify] offline: ${r2.offline} | verdict: ${r2.classification} (${r2.confidence}) — ${r2.reason || ""}`.slice(
    0,
    260,
  ),
);

const ok1 = !r1.offline && String(r1.reply || "").length > 20;
console.log(
  ok1
    ? "\n✅ Haimiya chat LIVE — key AI trên deployment hoạt động"
    : "\n❌ Haimiya chat OFFLINE — deployment chưa có key AI hoặc provider lỗi",
);
process.exit(ok1 ? 0 : 1);
