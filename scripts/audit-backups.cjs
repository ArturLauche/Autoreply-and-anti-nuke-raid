/**
 * audit-backups.cjs — QUÉT + DỌN BACKUP FAKE TRÊN DEPLOYMENT THẬT (chạy trên VPS).
 *
 * Cách chạy (trên VPS, trong thư mục bot có .env với CONVEX_URL + BOT_KEY):
 *   node scripts/audit-backups.cjs           # chỉ QUÉT + báo cáo (không xóa gì)
 *   node scripts/audit-backups.cjs --fix     # quét + XÓA bản "fake" (không thể khôi phục)
 *
 * Vì sao cần BOT_KEY thật: mọi mutation bot-side yêu cầu botKey
 * (SHA-256("protogon-bot-key::" + OWNER_SEED) protocol) — script tái dùng
 * ConvexStore của bot nên tự chèn key vào MỌI call. Không có cửa hậu: thiếu key
 * thì mutation xóa bị từ chối phía Convex (đúng chủ đích bảo mật).
 *
 * Việc xóa CHỈ xóa row "fake" (JSON hỏng/thiếu cấu trúc — chắc chắn không khôi
 * phục được). Bản "suspect" (checksum lệch/metadata lệch) chỉ BÁO, không xóa —
 * cần người xem tay vì đó có thể là backup bị can thiệp (bằng chứng quan trọng).
 */
const path = require("path");
const fs = require("fs");

// ── Nạp env từ bot/.env (nếu có) — không in giá trị ra console ──
(function loadBotEnv() {
  const candidates = [
    path.join(__dirname, "..", "bot", ".env"),
    path.join(__dirname, "..", ".env"),
  ];
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      for (const line of fs.readFileSync(file, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        const key = m[1];
        let value = m[2];
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = value;
      }
      break; // nạp file đầu tiên tìm thấy
    } catch {
      // không đọc được file — bỏ qua
    }
  }
})();

const backupAudit = require("../bot/src/backupAudit");
const ConvexStore = require("../bot/src/convex");

const FIX = process.argv.includes("--fix");

(async () => {
  if (!process.env.CONVEX_URL) {
    console.error("❌ CONVEX_URL chưa đặt — chạy script này trên VPS (có bot/.env).");
    process.exit(1);
  }
  let store;
  try {
    store = new ConvexStore();
  } catch (e) {
    console.error("❌ Không khởi tạo được ConvexStore:", e.message);
    process.exit(1);
  }

  // 1) Lấy danh sách mọi guild bot đang ở (1 query — botListGuildIds).
  let guilds = [];
  try {
    guilds = await store.client.query("guilds:botListGuildIds");
  } catch (e) {
    console.error("❌ Không liệt kê được guild (query guilds:botListGuildIds):", e.message);
    console.error("   Deploy bản Convex mới nhất trước: bun convex dev --once (hoặc push CI). ");
    process.exit(1);
  }
  if (!Array.isArray(guilds) || guilds.length === 0) {
    console.log("Không có guild nào trên deployment — không có backup để quét.");
    process.exit(0);
  }

  // 2) Quét backup từng guild (listGuild — tối đa 3 bản/guild theo schema).
  const report = [];
  let scanned = 0;
  for (const g of guilds) {
    const guildId = g.discordId ?? g.id;
    if (!guildId) continue;
    let backups;
    try {
      backups = await store.client.query("backup:listGuild", { guildId });
    } catch (e) {
      console.error(`[scan] ${guildId}: lỗi query backup:`, e.message);
      continue;
    }
    scanned += backups.length;
    for (const row of backups) {
      const verdict = backupAudit.classifyBackup(row);
      report.push({ row, verdict, guildName: g.name ?? row.guildName });
    }
  }

  // 3) In báo cáo.
  const summary = { real: 0, fake: 0, suspect: 0 };
  for (const item of report) summary[item.verdict.verdict]++;
  console.log(`\n════ BÁO CÁO AUDIT BACKUP (${scanned} bản / ${guilds.length} guild) ════`);
  console.log(`✅ Thật (real):    ${summary.real}   — bung được, cấu trúc chuẩn, checksum khớp`);
  console.log(
    `⚠️  Nghi (suspect): ${summary.suspect} — checksum/metadata lệch, CẦN XEM TAY (không xóa tự động)`,
  );
  console.log(
    `❌ Fake:           ${summary.fake}   — hỏng JSON/nén/thiếu cấu trúc, không thể khôi phục`,
  );

  for (const { row, verdict } of report) {
    if (verdict.verdict === "real") continue;
    console.log(
      `\n[${verdict.verdict.toUpperCase()}] ${row._id} · guild=${row.guildId} (${row.guildName}) · nguồn=${row.source ?? "?"} · tạo=${new Date(row.createdAt).toISOString()}`,
    );
    console.log(`  Lý do: ${verdict.reasons.join("; ")}`);
    if (verdict.verdict === "fake" && FIX) {
      try {
        const res = await store.client.mutation("bot_writes:botDeleteBackup", {
          backupId: row._id,
        });
        console.log(`  → ${res?.ok ? "ĐÃ XÓA (botKey tự chèn bởi ConvexStore)" : "xóa thất bại"}`);
      } catch (e) {
        console.error(`  → XÓA THẤT BẠI: ${e.message}`);
        console.error("    (botKey chưa cấp phát? Bot cần online 1 lần với bản mới để bootstrap)");
      }
    } else if (verdict.verdict === "fake") {
      console.log("  → Chạy lại với --fix để xóa các bản fake.");
    }
  }

  if (summary.suspect > 0) {
    console.log(
      "\n⚠️  Có bản SUSPECT — kiểm tra tay trước khi quyết định (checksum lệch có thể là backup bị can thiệp).",
    );
  }
  console.log(`\nHoàn tất${FIX ? " (chế độ --fix)" : " (chỉ quét — truyền --fix để xóa fake)"}.`);
  process.exit(0);
})();
