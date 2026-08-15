import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getUserByToken, canManageGuild, guildAccessibleBy } from "./auth";

/**
 * Backup server → đám mây GitHub.
 *
 * Luồng:
 *  1. Dashboard bấm "Backup ngay" → requestBackup đặt cờ backupRequested trên guild.
 *  2. Bot quét backup:botGetPending mỗi ~20s, thấy cờ → chụp role/kênh/quyền → lưu
 *     vào bảng guildBackups (bot_writes:botStoreBackup). Nếu yêu cầu đẩy GitHub → gọi
 *     action backup:githubPush (đọc GITHUB_TOKEN từ Keys của Convex) tạo Gist riêng tư.
 *  3. Server bị nuke phá sập → mời bot vào server phụ → dashboard bấm "Khôi phục" →
 *     requestRestore đặt cờ restoreRequested + id backup → bot đọc JSON và tạo lại
 *     role (tên/màu/quyền), danh mục, kênh + quyền truy cập, và cấu hình cơ bản.
 */

/**
 * Giới hạn file backup .msc/.json tải lên: 8 MB — đủ cho backup có kèm media
 * (ảnh/video dạng data URI base64 trong file của bot nuke). File được giữ trong
 * Convex file storage (không giới hạn kích thước) chứ không nhét vào document
 * (document chỉ chứa tối đa 1 MB).
 */
const MAX_IMPORT_FILE_BYTES = 8_000_000;

/** Liệt kê các backup mà người dùng có quyền truy cập (từ mọi server họ quản lý). */
export const listMine = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await getUserByToken(ctx, token);
    if (!user) return [];
    const all = await ctx.db.query("guilds").collect();
    const mine = all.filter((g) => guildAccessibleBy(user, g));
    const out = [];
    for (const g of mine) {
      const backups = await ctx.db
        .query("guildBackups")
        .withIndex("by_guildId_createdAt", (q) => q.eq("guildId", g.discordId))
        .order("desc")
        .take(3);
      for (const b of backups) {
        out.push({
          _id: b._id,
          guildId: b.guildId,
          guildName: b.guildName,
          createdAt: b.createdAt,
          roleCount: b.roleCount,
          channelCount: b.channelCount,
          emojiCount: b.emojiCount ?? 0,
          stickerCount: b.stickerCount ?? 0,
          messageCount: b.messageCount ?? 0,
          source: b.source ?? "backup",
          githubUrl: b.githubUrl ?? null,
          pushedToGithub: b.pushedToGithub,
        });
      }
    }
    return out.sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
  },
});

/** Bot (lệnh !backup / /backup) liệt kê backup của 1 server — chỉ cần guildId. */
export const listGuild = query({
  args: { guildId: v.string() },
  handler: async (ctx, { guildId }) => {
    const backups = await ctx.db
      .query("guildBackups")
      .withIndex("by_guildId_createdAt", (q) => q.eq("guildId", guildId))
      .order("desc")
      .take(3);
    return backups.map((b) => ({
      _id: b._id,
      guildId: b.guildId,
      guildName: b.guildName,
      createdAt: b.createdAt,
      roleCount: b.roleCount,
      channelCount: b.channelCount,
      emojiCount: b.emojiCount ?? 0,
      stickerCount: b.stickerCount ?? 0,
      messageCount: b.messageCount ?? 0,
      source: b.source ?? "backup",
      githubUrl: b.githubUrl ?? null,
      pushedToGithub: b.pushedToGithub,
    }));
  },
});

/** Dashboard yêu cầu bot tạo backup cho server hiện tại. */
export const requestBackup = mutation({
  args: {
    token: v.string(),
    guildId: v.string(),
    pushToGithub: v.optional(v.boolean()),
    /** Kèm tin nhắn (tối đa 50 tin/kênh) khi chụp backup. */
    includeMessages: v.optional(v.boolean()),
  },
  handler: async (ctx, { token, guildId, pushToGithub, includeMessages }) => {
    const user = await getUserByToken(ctx, token);
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild || !canManageGuild(user, guild)) {
      throw new Error("Không có quyền quản lý server này");
    }
    if (!guild.botInGuild) throw new Error("Bot chưa có trong server này");
    await ctx.db.patch(guild._id, {
      backupRequested: true,
      backupPushToGithub: !!pushToGithub,
      backupIncludeMessages: !!includeMessages,
      backupClaimedAt: undefined,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Dashboard yêu cầu bot khôi phục một backup vào server hiện tại. */
export const requestRestore = mutation({
  args: {
    token: v.string(),
    guildId: v.string(),
    backupId: v.id("guildBackups"),
  },
  handler: async (ctx, { token, guildId, backupId }) => {
    const user = await getUserByToken(ctx, token);
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild || !canManageGuild(user, guild)) {
      throw new Error("Không có quyền quản lý server này");
    }
    if (!guild.botInGuild) throw new Error("Bot chưa có trong server này");
    const backup = await ctx.db.get(backupId);
    if (!backup) throw new Error("Backup không tồn tại hoặc đã bị xóa");
    // Người khôi phục phải cũng là người quản lý server gốc đã tạo backup.
    const source = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", backup.guildId))
      .first();
    if (!source || !canManageGuild(user, source)) {
      throw new Error("Bạn không có quyền với server gốc của backup này");
    }
    await ctx.db.patch(guild._id, {
      restoreRequested: true,
      restoreBackupId: backupId,
      restoreClaimedAt: undefined,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/**
 * Dashboard xin URL upload file backup .msc/.json (bot nuke) — file được POST
 * thẳng lên Convex file storage (không giới hạn kích thước, POST có timeout 2
 * phút) rồi chỉ lưu mã file vào document.
 */
export const generateImportUploadUrl = mutation({
  args: { token: v.string(), guildId: v.string() },
  handler: async (ctx, { token, guildId }) => {
    const user = await getUserByToken(ctx, token);
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild || !canManageGuild(user, guild)) {
      throw new Error("Không có quyền quản lý server này");
    }
    if (!guild.botInGuild) throw new Error("Bot chưa có trong server này — hãy mời bot vào trước khi tải file khôi phục");
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Dashboard tải file backup .msc/.json (từ bot nuke khác) lên để bot khôi phục
 * server hiện tại theo đúng thứ tự role/kênh/tin nhắn có trong file. File đã nằm
 * trong Convex file storage — chỉ cần lưu mã file (storageId) vào guild.
 */
export const requestImportRestore = mutation({
  args: {
    token: v.string(),
    guildId: v.string(),
    fileName: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { token, guildId, fileName, storageId }) => {
    const user = await getUserByToken(ctx, token);
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    // Xóa file đã upload nếu có lỗi bất kỳ xảy ra sau khi tải lên (tránh rác storage).
    const cleanupUploaded = async () => {
      try {
        await ctx.storage.delete(storageId);
      } catch {
        // đã xóa / không tồn tại — bỏ qua
      }
    };
    try {
      if (!guild || !canManageGuild(user, guild)) {
        throw new Error("Không có quyền quản lý server này");
      }
      if (!guild.botInGuild) throw new Error("Bot chưa có trong server này");
      const meta = await ctx.storage.getMetadata(storageId);
      if (!meta) {
        throw new Error("File không tồn tại hoặc đã bị xóa — hãy chọn lại file");
      }
      if (meta.size > MAX_IMPORT_FILE_BYTES) {
        throw new Error(
          `File quá lớn (tối đa ${MAX_IMPORT_FILE_BYTES / 1_000_000} MB — file này ${(meta.size / 1_000_000).toFixed(1)} MB). Hãy nén hoặc bỏ bớt media nặng rồi thử lại.`,
        );
      }
      // Dọn file import cũ chưa xử lý (nếu có) để không rác storage.
      if (guild.importStorageId && guild.importStorageId !== storageId) {
        await ctx.storage.delete(guild.importStorageId).catch(() => {});
      }
      await ctx.db.patch(guild._id, {
        importRestoreRequested: true,
        importFileName: String(fileName || "backup.msc").slice(0, 120),
        importStorageId: storageId,
        restoreClaimedAt: undefined,
        updatedAt: Date.now(),
      });
      return { ok: true };
    } catch (e) {
      await cleanupUploaded();
      throw e;
    }
  },
});

/** Dashboard bật/tắt tự động backup theo số ngày (2-30; 0 = tắt). */
export const setAutoBackup = mutation({
  args: { token: v.string(), guildId: v.string(), days: v.number() },
  handler: async (ctx, { token, guildId, days }) => {
    const user = await getUserByToken(ctx, token);
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild || !canManageGuild(user, guild)) {
      throw new Error("Không có quyền quản lý server này");
    }
    if (!guild.botInGuild) throw new Error("Bot chưa có trong server này");
    const next = days <= 0 ? 0 : Math.max(2, Math.min(30, Math.floor(days)));
    await ctx.db.patch(guild._id, {
      backupAutoDays: next,
      updatedAt: Date.now(),
    });
    return { ok: true, days: next };
  },
});

/**
 * Bot quét mỗi giờ để tìm server đã đến hạn tự động backup
 * (bật lịch 2-30 ngày, chưa có yêu cầu đang chờ, chưa backup trong khoảng thời gian đó).
 */
export const botGetDueAuto = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const all = await ctx.db.query("guilds").collect();
    const due: { guildId: string; days: number }[] = [];
    for (const g of all) {
      const days = g.backupAutoDays ?? 0;
      if (days <= 0 || !g.botInGuild || g.backupRequested) continue;
      if (g.lastBackupAt === undefined || now - g.lastBackupAt >= days * 86_400_000) {
        due.push({ guildId: g.discordId, days });
      }
    }
    return due;
  },
});

/** Bot quét mỗi ~20s để nhận yêu cầu tạo backup / khôi phục đang chờ. */
export const botGetPending = query({
  args: {},
  handler: async (ctx) => {
    const out: {
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
    const all = await ctx.db.query("guilds").collect();
    for (const g of all) {
      if (g.backupRequested) {
        out.push({
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
          out.push({
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
        out.push({
          kind: "import",
          guildId: g.discordId,
          fileName: g.importFileName ?? "backup.msc",
          importStorageId: g.importStorageId,
          importFileUrl: importFileUrl ?? undefined,
          guildName: g.name,
        });
      }
    }
    return out;
  },
});
