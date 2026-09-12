/**
 * Chẩn đoán "server biến mất" do sync guild sai:
 *  - botStatus.guildCount: số guild bot đang thấy (heartbeat gần nhất).
 *  - botGuildStats: tổng guild trong Convex, số đang hiển thị (botInGuild=true),
 *    số đã ẩn (botInGuild=false), số đang hiển thị nhưng heartbeat cũ > 15 phút.
 *
 * Nếu gone lớn hoặc inGuild < botStatus.guildCount → sync đã từng chạy với cache
 * thiếu và đánh dấu nhầm. Bản vá guildSync (v43) sẽ tự hồi phục các server vẫn
 * còn trong cache bot ở lần sync tin cậy kế tiếp.
 *
 * Chạy: node scripts/check-guild-sync.cjs
 */
require("../bot/src/loadenv").loadEnv();
const { ConvexHttpClient } = require("../bot/node_modules/convex/browser");

(async () => {
  const url = process.env.CONVEX_URL;
  if (!url) {
    console.log("NO CONVEX_URL — chạy từ thư mục có bot/.env hoặc đặt biến môi trường");
    process.exit(1);
  }
  const client = new ConvexHttpClient(url);
  if (process.env.CONVEX_DEPLOY_KEY) client.setAdminAuth(process.env.CONVEX_DEPLOY_KEY);
  // botKey (botAuth): chèn CHỈ KHI hàm chưa có botKey trong args — nếu không sẽ
  // đè lên giá trị args thật hoặc gửi thừa tham số làm hàm public từ chối.
  const botKey = process.env.BOT_KEY ? String(process.env.BOT_KEY).trim() : null;
  const withKey = (args) => {
    const payload = args && typeof args === "object" ? { ...args } : {};
    if (botKey && payload.botKey === undefined) payload.botKey = botKey;
    return payload;
  };
  const _q = client.query.bind(client);
  const _m = client.mutation.bind(client);
  client.query = (fn, args) => _q(fn, withKey(args));
  client.mutation = (fn, args) => _m(fn, withKey(args));

  const status = await client.query("status:botStatus");
  console.log("botStatus (heartbeat gần nhất):");
  console.log("  online:", status.online, "| guildCount:", status.guildCount, "| memberCount:", status.memberCount);
  console.log("  lastHeartbeat:", status.lastHeartbeat ? new Date(status.lastHeartbeat).toISOString() : null,
    "| cách đây:", status.lastHeartbeat ? Math.round((Date.now() - status.lastHeartbeat) / 1000) + "s" : null);

  const stats = await client.query("guilds:botGuildStats");
  const missing = (status.guildCount ?? 0) - stats.inGuild;
  console.log("\nguilds trong Convex:");
  console.log("  tổng:", stats.total);
  console.log("  đang hiển thị (botInGuild=true):", stats.inGuild);
  console.log("  đã ẩn (botInGuild=false):", stats.gone);
  console.log("  hiển thị nhưng heartbeat >15 phút:", stats.staleInGuild);
  console.log("  heartbeat cũ nhất trong số đang hiển thị:",
    stats.oldestHeartbeat ? Math.round((Date.now() - stats.oldestHeartbeat) / 60000) + " phút trước" : null);

  if (stats.gone > 0) {
    console.log(`\n⚠️ Có ${stats.gone} guild bị ẩn — đây là số server "mất" trên dashboard.`);
    if (stats.gone > 500) {
      console.log("   Nghi do sync chạy với cache guild thiếu (bot khởi động lại / gateway lấp dần).");
      console.log("   Bản v43: sync chỉ sweep khi danh sách đầy đủ + vắng >10 phút → các server còn trong bot sẽ tự hiện lại.");
    }
  } else {
    console.log("\n✅ Không có guild nào bị ẩn nhầm.");
  }
  if (missing > 0) {
    console.log(`\n⚠️ Bot đang thấy ${status.guildCount} server nhưng Convex chỉ hiển thị ${stats.inGuild} — cache bot đang thiếu ${missing} guild.`);
  }
})().catch((err) => {
  console.log("ERROR:", err.message);
  process.exit(1);
});
