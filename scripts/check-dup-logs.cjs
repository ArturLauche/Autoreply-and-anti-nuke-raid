// Kiểm tra log "chồng chặp" (trùng lặp) trên dữ liệu thật:
//  - antinukeEvents: 2 sự kiện cùng (module, executorId, count, threshold) ghi cách nhau < 2s
//  - modActions: 2 bản ghi cùng (action, targetId, executorId, reason) cách nhau < 2s
// Chạy: node scripts/check-dup-logs.cjs
require("../bot/src/loadenv").loadEnv();
const { ConvexHttpClient } = require("../bot/node_modules/convex/browser");

(async () => {
  const url = process.env.CONVEX_URL;
  if (!url) {
    console.log("NO CONVEX_URL");
    return;
  }
  const client = new ConvexHttpClient(url);
  if (process.env.CONVEX_DEPLOY_KEY) client.setAdminAuth(process.env.CONVEX_DEPLOY_KEY);

  const since = Date.now() - 14 * 24 * 3600 * 1000;
  const events = await client.query("reports:getDailyEvents", { since });
  console.log(`antinukeEvents (14 ngày): ${events.length}`);

  // Nhóm theo module + executorId + count + threshold, sắp theo thời gian để so delta.
  const byKey = new Map();
  for (const e of events) {
    const key = `${e.module}|${e.executorId ?? ""}|${e.count}|${e.threshold}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(e);
  }

  let dupEvents = 0;
  for (const [key, arr] of byKey) {
    if (arr.length < 2) continue;
    const sorted = [...arr].sort((a, b) => a.createdAt - b.createdAt);
    for (let i = 1; i < sorted.length; i++) {
      const delta = sorted[i].createdAt - sorted[i - 1].createdAt;
      if (delta < 2000) {
        dupEvents++;
        console.log(
          "  ⚠️ trùng gần:",
          key,
          "| delta",
          delta,
          "ms |",
          new Date(sorted[i - 1].createdAt).toISOString(),
          "→",
          new Date(sorted[i].createdAt).toISOString(),
          "| action:",
          String(sorted[i - 1].action).slice(0, 60),
          "||",
          String(sorted[i].action).slice(0, 60),
        );
      }
    }
  }
  console.log(dupEvents === 0 ? "✅ Không có antinukeEvent trùng lặp" : `⚠️ ${dupEvents} cặp sự kiện trùng gần nhau`);

  // Các module xuất hiện + phân bố theo thời gian (xem có cụm spam log không).
  const moduleCount = {};
  for (const e of events) moduleCount[e.module] = (moduleCount[e.module] ?? 0) + 1;
  console.log("Phân bố theo module:", JSON.stringify(moduleCount));

  // modActions — cần token admin để đọc qua query hiện có? Không có query công khai,
  // nên chỉ ước lượng qua số case counter của từng guild nếu dữ liệu cho phép.
  try {
    const status = await client.query("status:botStatus");
    console.log("\nbotStatus:", status.online ? "online" : "offline", `| ${status.guildCount} server · ${status.memberCount} thành viên`);
  } catch (err) {
    console.log("botStatus lỗi:", err.message);
  }
})().catch((err) => {
  console.log("ERROR:", err.message);
  process.exit(1);
});
