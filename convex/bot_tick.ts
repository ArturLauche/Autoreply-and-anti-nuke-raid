import { query } from "./_generated/server";
import { buildHiddenJobs } from "./hidden";

/**
 * Batch TỔNG HỢP cho vòng quét định kỳ của bot (gọi mỗi 2 phút thay vì 3 query
 * riêng mỗi 20–120s — tiết kiệm ~40k+ function calls/tháng trên free tier):
 *  - hidden: panel reaction role chưa gửi, giveaway cần gửi/kết thúc, DM chờ,
 *    webhook mặc định cần tạo/gỡ (tái dùng buildHiddenJobs của hidden.ts).
 *  - verifyPanels: guild có cờ verifySendPanel (bot gửi panel xác minh rồi xóa cờ).
 *  - backups: yêu cầu backup/restore/import đang chờ + backup tự động đến hạn.
 *  - meta: cờ lockdown/heat reset (tham khảo; bot vẫn đọc getConfig có cache).
 * Bot tự lọc guild mình đang ở. Query đọc-only, không có side effect.
 */
export const getPendingJobs = query({
  args: {},
  handler: async (ctx) => {
    const hidden = await buildHiddenJobs(ctx);

    const guilds = await ctx.db.query("guilds").collect();
    const verifyPanels = guilds
      .filter((g) => g.verifySendPanel === true && g.verifyEnabled && g.verifyChannelId)
      .map((g) => ({
        guildId: g.discordId,
        verifyChannelId: g.verifyChannelId!,
        unverifiedRoleId: g.unverifiedRoleId ?? null,
        verifiedRoleId: g.verifiedRoleId ?? null,
        verifyMethod: g.verifyMethod ?? "button",
      }));

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

    return { hidden, verifyPanels, backups };
  },
});
