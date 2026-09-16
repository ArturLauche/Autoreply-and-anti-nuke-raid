/**
 * tick.js — Vòng quét TỔNG HỢP của bot (chuyển bớt sang VPS, tiết kiệm Convex).
 *
 * Trước đây bot chạy 3 vòng quét riêng: hidden 120s (2 query), verify panel 120s
 * (1 query), backup 60s (1 query) → ~120 query/giờ kể cả khi không có việc gì.
 * Giờ 1 vòng tick duy nhất mỗi 60s gọi bot_tick:getPendingJobs — 1 query batch
 * trả { hidden, verifyPanels, backups } cho MỌI guild, bot tự lọc server mình
 * đang ở → tiết kiệm ~50% function calls của nhóm này trên Convex free tier,
 * đồng thời hidden/verify phản hồi NHANH HƠN (60s thay vì 120s).
 *
 * Khi batch lỗi (query chưa deploy, lỗi mạng thoáng qua) → fallback về 3 query
 * riêng đúng như hành vi cũ để KHÔNG bỏ lỡ việc. Sau lỗi batch, tạm tránh gọi
 * batch trong 10 phút (chống spam log khi query chưa có trên deployment).
 *
 * Việc xử lý tái dùng processor của từng module (không nhân bản logic):
 *  - hidden jobs  → hidden.processHiddenJobsData (panel, giveaway, DM, webhook log)
 *  - verify panel → hidden.processVerifyPanelItems
 *  - backup       → backup.runBackup / runRestore / runImportRestore + claim
 */

// TỐI ƯU I/O: 180s (trước 120s, ban đầu 60s) — các cờ backup/restore/panel vẫn
// xử lý trong ~3 phút, đủ nhanh cho trải nghiệm; giảm thêm 33% reads của batch
// query (mỗi lượt collect() toàn bảng guilds/panels/giveaways là nguồn I/O lớn).
const TICK_INTERVAL_MS = 180_000;
/** Sau khi batch lỗi, tránh gọi lại batch trong khoảng này (dùng fallback). */
const BATCH_RETRY_AFTER_MS = 10 * 60_000;

const hiddenMod = require("./handlers/hidden");
const backupMod = require("./handlers/backup");

/** Chống xử lý trùng trong process: item đang chạy bị bỏ qua ở lượt sau. */
const backupInFlight = new Set();
let batchBrokenUntil = 0;

/**
 * Giành quyền xử lý trên Convex — chỉ ai claim được mới chạy (chống trùng khi
 * chạy 2 bot / 2 lượt quét chồng nhau — giống claim trong handlers/backup.js).
 */
async function claimBackup(store, guildId, kind) {
  try {
    const res = await store.client.mutation("bot_writes:botClaimBackup", {
      guildId,
      kind,
    });
    return !!res?.ok;
  } catch (e) {
    console.error(`[tick:backup:claim] ${guildId}:`, e.message);
    return false;
  }
}

/** Tải nội dung file import từ Convex file storage (URL trong batch trả về). */
async function readImportContent(item) {
  if (item.importFileUrl) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60_000);
    try {
      const res = await fetch(item.importFileUrl, { signal: ctrl.signal });
      if (res.ok) return await res.text();
      throw new Error(
        `Không tải được file backup từ đám mây (HTTP ${res.status}) — hãy thử tải lại file`,
      );
    } catch (e) {
      if (e?.name === "AbortError" || e?.code === "ABORT_ERR") {
        throw new Error("Tải file backup từ đám mây quá lâu (> 60 giây) — hãy thử lại", {
          cause: e,
        });
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  if (item.fileContent) return item.fileContent;
  throw new Error("Không lấy được file backup từ đám mây — hãy thử tải lại file");
}

/** Xử lý các yêu cầu backup/restore/import trong batch (như pollBackups cũ). */
async function runBackupJobs(client, store, items) {
  if (!items || items.length === 0) return;
  for (const item of items) {
    const key = `${item.guildId}:${item.kind}`;
    if (backupInFlight.has(key)) continue;
    const won = await claimBackup(store, item.guildId, item.kind);
    if (!won) continue;
    backupInFlight.add(key);
    try {
      if (item.kind === "backup") {
        await backupMod.runBackup(client, store, item.guildId, {
          pushToGithub: !!item.pushToGithub,
          includeMessages: !!item.includeMessages,
          // Yêu cầu đến từ người dùng (dashboard/lệnh) hoặc lịch tự động —
          // nếu bị skip vì "không thay đổi" thì phải thông báo, không im lặng.
          skipNotice: true,
        });
      } else if (item.kind === "restore") {
        await backupMod.runRestore(client, store, item.guildId, item.backupJson, item.guildName);
      } else if (item.kind === "import") {
        const content = await readImportContent(item);
        await backupMod.runImportRestore(client, store, item.guildId, content, item.fileName);
      }
    } catch (e) {
      console.error(`[tick:backup:${item.kind}] ${item.guildId}:`, e.message);
      // Mọi nhánh đều BÁO LỄN lên dashboard để người dùng thấy lý do thay vì
      // chờ mãi không thấy gì (restore/import trước đây xóa cờ IM LẶNG).
      if (item.kind === "import") {
        await store.client
          .mutation("bot_writes:botReportImportError", {
            guildId: item.guildId,
            error: String(e?.message || "Lỗi không xác định").slice(0, 300),
          })
          .catch(() => {});
      } else if (item.kind === "restore") {
        await store.client
          .mutation("bot_writes:botReportRestoreError", {
            guildId: item.guildId,
            error: String(e?.message || "Lỗi không xác định").slice(0, 300),
          })
          .catch(() => {});
      } else {
        await store.client
          .mutation("bot_writes:botReportBackupError", {
            guildId: item.guildId,
            error: String(e?.message || "Lỗi không xác định").slice(0, 300),
          })
          .catch(() => {});
      }
    } finally {
      backupInFlight.delete(key);
    }
  }
}

/** Một lượt tick: 1 query batch → xử lý toàn bộ việc chờ của mọi guild. */
async function runTickOnce(client, store) {
  let jobs = null;
  if (Date.now() >= batchBrokenUntil) {
    try {
      jobs = await store.client.query("bot_tick:getPendingJobs", {});
      batchBrokenUntil = 0;
    } catch (e) {
      batchBrokenUntil = Date.now() + BATCH_RETRY_AFTER_MS;
      console.warn(`[tick] batch lỗi, tạm dùng fallback 10 phút: ${e?.message || e}`);
    }
  }

  if (jobs && typeof jobs === "object") {
    // Self-Diagnose: đồng bộ flag bật/tắt từ batch (không tốn call thêm).
    try {
      require("./handlers/selfDiagnose").setEnabledFromJobs(jobs.selfDiagnose);
    } catch {}
    try {
      await hiddenMod.processHiddenJobsData(client, store, jobs.hidden ?? []);
    } catch (e) {
      console.error("[tick:hidden]", e?.message || e);
    }
    try {
      await hiddenMod.processVerifyPanelItems(client, store, jobs.verifyPanels ?? []);
    } catch (e) {
      console.error("[tick:verify]", e?.message || e);
    }
    await runBackupJobs(client, store, jobs.backups ?? []);
    return;
  }

  // ---- Fallback: 3 query riêng (đúng hành vi cũ, chỉ khi batch không dùng được) ----
  try {
    const hiddenJobs = await store.client.query("hidden:getBotHiddenJobs", {});
    await hiddenMod.processHiddenJobsData(client, store, hiddenJobs ?? []);
  } catch (e) {
    console.error("[tick:hidden:fallback]", e?.message || e);
  }
  try {
    const items = await store.client.query("guilds:getVerifySendPanelGuilds", {});
    await hiddenMod.processVerifyPanelItems(client, store, items ?? []);
  } catch (e) {
    console.error("[tick:verify:fallback]", e?.message || e);
  }
  try {
    const pending = await store.client.query("backup:botGetPending", {});
    await runBackupJobs(client, store, pending ?? []);
  } catch (e) {
    console.error("[tick:backup:fallback]", e?.message || e);
  }
}

/** Gắn vòng tick sau khi bot online. Gọi 1 lần từ index.js. */
function setupTick(client, store) {
  client.once("ready", () => {
    // Chạy ngay 1 lượt sau 15s (đợi gateway ổn định) — việc chờ từ lúc bot
    // offline (backup/panel/webhook log) được xử lý sớm, không đợi hết chu kỳ.
    setTimeout(() => runTickOnce(client, store).catch(() => {}), 15_000).unref?.();
    const interval = setInterval(() => {
      runTickOnce(client, store).catch((e) => console.error("[tick]", e?.message || e));
    }, TICK_INTERVAL_MS);
    interval.unref?.();
  });
}

module.exports = { setupTick, runBackupJobs, runTickOnce };
