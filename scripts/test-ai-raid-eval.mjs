// ĐÁNH GIÁ AI chống raid/nuke trên key THẬT (live, chạy tay — KHÔNG nằm trong
// `bun run test` vì run-all-tests chỉ glob test-*.cjs).
// Chạy: node scripts/test-ai-raid-eval.mjs
// Yêu cầu: env có key provider (GROQ_API_KEY / NVIDIA_API_KEY / KIRA_API_KEY...).
// Không key → SKIP (exit 0), không fail CI.
// Mục đích: đo độ CHÍNH XÁC + ĐỘ TRỄ của AI trên bộ case raid/benign gắn nhãn,
// để "huấn luyện" prompt có số liệu (sửa prompt → chạy lại → so sánh).
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ai = require("../bot/src/ai.js");

const LAT_BUDGET_MS = 15_000;
let pass = 0;
let fail = 0;
let skipped = 0;
const rows = [];

async function runCase(name, fn, check) {
  const t0 = Date.now();
  try {
    const res = await Promise.race([
      fn(),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), LAT_BUDGET_MS)),
    ]);
    const ms = Date.now() - t0;
    const ok = check(res);
    rows.push({ name, ok, ms, detail: JSON.stringify(res).slice(0, 160) });
    ok ? pass++ : fail++;
  } catch (e) {
    rows.push({ name, ok: false, ms: Date.now() - t0, detail: `LỖI: ${e.message}` });
    fail++;
  }
}

if (!ai.aiAvailable()) {
  console.log("SKIP: không có key provider AI nào trong env — không đánh giá được.");
  process.exit(0);
}

const spamRaid = Array.from({ length: 6 }, () => "@everyone FREE NITRO discord-gift.ru/claim");
const friendChat = ["haha", "haha", "kkk", "vui quá", "haha", "😂😂", "chơi tiếp không"];

await runCase(
  "classify: spam @everyone + link lạ từ acc mới → raid",
  () =>
    ai.classifyViolation({
      module: "spam",
      count: 8,
      windowSeconds: 10,
      threshold: 6,
      sampleMessages: spamRaid,
      recentJoins: 12,
      memberCount: 1200,
    }),
  (r) => r && !r.offline && r.classification === "raid" && r.confidence >= 0.6,
);

await runCase(
  "classify: 1 người spam 'haha' → individual (không phải raid)",
  () =>
    ai.classifyViolation({
      module: "spam",
      count: 7,
      windowSeconds: 10,
      threshold: 6,
      sampleMessages: friendChat,
      recentJoins: 0,
      memberCount: 1200,
    }),
  (r) => r && !r.offline && r.classification !== "raid",
);

await runCase(
  "analyzeRaid: cụm sockpuppet (mới + default avatar + tên máy + cùng nhịp) → coordinated",
  () =>
    ai.analyzeRaid({
      module: "massJoin",
      count: 8,
      windowSeconds: 10,
      threshold: 5,
      clusterProfile: [
        "1. user1001 (acc 1 ngày, avatar không, vào cùng nhịp)",
        "2. user1002 (acc 1 ngày, avatar không, vào cùng nhịp)",
        "3. user1003 (acc 0 ngày, avatar không, vào cùng nhịp)",
      ].join("\n"),
      recentActions: "3 lượt tạo invite trong 2 phút",
    }),
  (r) => r && !r.offline && r.coordinated === true && r.confidence >= 0.6,
);

await runCase(
  "analyzeRaid: nhóm bạn (tên người + avatar + rải rác) → không phối hợp",
  () =>
    ai.analyzeRaid({
      module: "massJoin",
      count: 6,
      windowSeconds: 20,
      threshold: 5,
      clusterProfile: [
        "1. Minh Anh (acc 400 ngày, avatar có)",
        "2. Thu Trang (acc 900 ngày, avatar có)",
        "3. Hoàng Nam (acc 30 ngày, avatar có)",
      ].join("\n"),
      recentActions: "(không có)",
    }),
  (r) => r && !r.offline && r.coordinated === false,
);

await runCase(
  "analyzeExternalApp: app 'Free Nitro Premium' + spam → isRaid",
  () =>
    ai.analyzeExternalApp({
      count: 4,
      windowSeconds: 30,
      threshold: 2,
      appProfile:
        'App "Free Nitro Premium" được 4 acc mới kết nối; tin: "@everyone claim bit.ly/xyz"',
      recentJoins: 6,
      memberCount: 800,
    }),
  (r) => r && !r.offline && r.isRaid === true,
);

await runCase(
  "analyzeExternalApp: mod thử app nhạc quen → không phải raid",
  () =>
    ai.analyzeExternalApp({
      count: 1,
      windowSeconds: 30,
      threshold: 2,
      appProfile: 'Mod kết nối app "Rythm" (nhạc); tin: "Now playing: ..."',
      recentJoins: 0,
      memberCount: 800,
    }),
  (r) => r && !r.offline && r.isRaid === false,
);

console.log("\nKết quả đánh giá AI (live):");
for (const row of rows) {
  console.log(`${row.ok ? "✅" : "❌"} [${row.ms}ms] ${row.name}\n   ${row.detail}`);
}
const lat = rows.map((r) => r.ms);
console.log(
  `\nTổng: ${pass} đúng / ${pass + fail} case · trễ TB ${Math.round(lat.reduce((a, b) => a + b, 0) / Math.max(1, lat.length))}ms · max ${Math.max(...lat)}ms`,
);
if (skipped) console.log(`Bỏ qua: ${skipped}`);
process.exit(fail === 0 ? 0 : 1);
