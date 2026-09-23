import { query } from "./_generated/server";
import { v } from "convex/values";
import { buildHiddenJobs, getBotStatus } from "./hidden";
import { requireBotKeyStrict } from "./botAuth";

/**
 * Batch TỔNG HỢP cho vòng quét định kỳ của bot (gọi mỗi 2 phút thay vì 3 query
 * riêng mỗi 20–120s — tiết kiệm ~40k+ function calls/tháng trên free tier):
 *  - hidden: panel reaction role chưa gửi, giveaway cần gửi/kết thúc, DM chờ,
 *    webhook mặc định cần tạo/gỡ (tái dùng buildHiddenJobs của hidden.ts).
 *  - verifyPanels: guild có cờ verifySendPanel (bot gửi panel xác minh rồi xóa cờ).
 *  - backups: yêu cầu backup/restore/import đang chờ + backup tự động đến hạn.
 *  - settingsChanges: guild vừa được dashboard sửa cấu hình (settingsChangedAt mới)
 *    → bot xóa cache getConfig của guild đó để thay đổi áp dụng trong ~1 tick.
 *  - meta: cờ lockdown/heat reset (tham khảo; bot vẫn đọc getConfig có cache).
 * Bot tự lọc guild mình đang ở. Query đọc-only, không có side effect.
 */
export const getPendingJobs = query({
  args: { botKey: v.optional(v.string()) },
  handler: async (ctx, { botKey }) => {
    await requireBotKeyStrict(ctx, botKey);
    const hidden = await buildHiddenJobs(ctx);

    // TỐI ƯU (audit Convex): bỏ collect() toàn bảng thứ 2 trong cùng 1 lượt tick
    // (buildHiddenJobs đã đọc guild đang hoạt động) — dùng index by_botInGuild.
    const guilds = await ctx.db
      .query("guilds")
      .withIndex("by_botInGuild", (q) => q.eq("botInGuild", true))
      .collect();
    const verifyPanels = guilds
      .filter((g) => g.verifySendPanel === true && g.verifyEnabled && g.verifyChannelId)
      .map((g) => ({
        guildId: g.discordId,
        verifyChannelId: g.verifyChannelId!,
        unverifiedRoleId: g.unverifiedRoleId ?? null,
        verifiedRoleId: g.verifiedRoleId ?? null,
        verifyMethod: g.verifyMethod ?? "button",
      }));

    // Cấu hình vừa đổi từ dashboard (updateSettings / module antinuke / alt config /
    // auto reply / tùy chỉnh khôi phục / lịch backup) → bot xóa cache config của
    // đúng guild đó. Không có tín hiệu này thì thay đổi phải chờ hết TTL cache (30
    // phút) mới tới bot, trong khi giao diện hứa "khoảng 3 phút" — bug thật 23/09
    // (bật welcome xong join thử mà bot im lặng).
    const nowMs = Date.now();
    const SETTINGS_FRESH_MS = 15 * 60_000;
    const settingsChanges = guilds
      .filter((g) => (g.settingsChangedAt ?? 0) > nowMs - SETTINGS_FRESH_MS)
      .map((g) => ({ guildId: g.discordId, at: g.settingsChangedAt as number }));

    const backups: {
      kind: string;
      guildId: string;
      pushToGithub?: boolean;
      includeMessages?: boolean;
      backupId?: string;
      backupJson?: string;
      guildName?: string;
      fileName?: string;
      importStorageId?: string;
      importFileUrl?: string;
    }[] = [];
    for (const g of guilds) {
      if (g.backupRequested) {
        backups.push({
          kind: "backup",
          guildId: g.discordId,
          pushToGithub: !!g.backupPushToGithub,
          includeMessages: !!g.backupIncludeMessages,
          guildName: g.name,
        });
      }
      if (g.restoreRequested && g.restoreBackupId) {
        const b = await ctx.db.get(g.restoreBackupId);
        if (b) {
          backups.push({
            kind: "restore",
            guildId: g.discordId,
            backupId: b._id,
            backupJson: b.backupJson,
            guildName: b.guildName,
          });
        }
      }
      if (g.importRestoreRequested && g.importStorageId) {
        const importFileUrl = await ctx.storage.getUrl(g.importStorageId).catch(() => null);
        backups.push({
          kind: "import",
          guildId: g.discordId,
          fileName: g.importFileName ?? "backup.msc",
          importStorageId: g.importStorageId,
          importFileUrl: importFileUrl ?? undefined,
          guildName: g.name,
        });
      }
    }

    // Cấu hình self-diagnose (bot tự chẩn đoán lỗi qua AI) + cờ học thủ công /
    // AI review Threat Intel — đi nhờ batch query sẵn có, bot không cần thêm
    // call mutation "claim mù" mỗi 10 phút nữa (tiết kiệm ~4.3k calls/tháng).
    const status = await getBotStatus(ctx);
    const selfDiagnose = {
      enabled: status?.selfDiagnoseEnabled ?? false,
    };
    const threatFlags = {
      selfDiagnoseEnabled: status?.selfDiagnoseEnabled ?? false,
      manualLearn: status?.threatManualLearnRequested
        ? { requestedBy: status.threatManualLearnBy ?? "admin" }
        : null,
      aiReview: !!status?.threatAiReviewRequested,
    };

    return { hidden, verifyPanels, backups, settingsChanges, selfDiagnose, threatFlags };
  },
});
