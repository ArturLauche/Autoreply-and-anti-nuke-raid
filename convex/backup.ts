import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getUserByToken, canManageGuild, guildAccessibleBy } from "./auth";
import { requireBotKeyStrict } from "./botAuth";

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
  args: {
    guildId: v.string(),
    /** Chìa khóa bot (botAuth) — chỉ bot có OWNER_SEED mới tính được. */
    botKey: v.optional(v.string()),
  },
  handler: async (ctx, { botKey, guildId }) => {
    await requireBotKeyStrict(ctx, botKey);
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
      // Yêu cầu mới = lần thử lại → xóa lỗi lượt trước (nếu có).
      backupError: undefined,
      backupErrorAt: undefined,
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
      restoreError: undefined,
      restoreErrorAt: undefined,
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
    if (!guild.botInGuild)
      throw new Error(
        "Bot chưa có trong server này — hãy mời bot vào trước khi tải file khôi phục",
      );
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
        importError: undefined,
        importErrorAt: undefined,
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

/**
 * Dashboard theo dõi trạng thái xử lý file import (.msc/.json): bot đã nhận chưa,
 * có lỗi gì không. Trả { requested, fileName, error, errorAt }: error != null là
 * bot đã xử lý và thất bại (kèm lý do); requested = false && error = null là xong.
 */
export const importStatus = query({
  args: { token: v.string(), guildId: v.string(), refresh: v.optional(v.number()) },
  handler: async (ctx, { token, guildId }) => {
    const user = await getUserByToken(ctx, token);
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild || !canManageGuild(user, guild)) return null;
    // Trạng thái bot (heartbeat mỗi 60s) để web tự chẩn đoán: bot offline / bản cũ
    // không xử lý được import là 2 lý do phổ biến nhất khi "không có gì xảy ra".
    const status = await ctx.db
      .query("botStatus")
      .withIndex("by_kind", (q) => q.eq("kind", "status"))
      .first();
    const botOnline = !!status?.online && Date.now() - (status.lastHeartbeat ?? 0) < 180_000;
    return {
      requested: !!guild.importRestoreRequested,
      fileName: guild.importFileName ?? null,
      error: guild.importError ?? null,
      errorAt: guild.importErrorAt ?? null,
      // Trạng thái khôi phục (nút "Khôi phục vào server này") — web hiển thị
      // tiến trình / lỗi thay vì người dùng bấm xong chờ mãi không thấy gì.
      restoreRequested: !!guild.restoreRequested,
      restoreError: guild.restoreError ?? null,
      restoreErrorAt: guild.restoreErrorAt ?? null,
      restoreFinishedAt: guild.restoreFinishedAt ?? null,
      // Trạng thái backup chủ động — bot báo lỗi (thiếu quyền, kick…) thay vì im lặng.
      backupRequested: !!guild.backupRequested,
      backupError: guild.backupError ?? null,
      backupErrorAt: guild.backupErrorAt ?? null,
      updatedAt: guild.updatedAt,
      botOnline,
      botVersion: status?.version ?? null,
      botGuildCount: status?.guildCount ?? 0,
      lastHeartbeat: status?.lastHeartbeat ?? null,
    };
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
 * Web bật/tắt khôi phục role / kênh / tin nhắn / emoji-sticker khi restore backup.
 * Bot đọc qua guilds:getBotConfig và bỏ qua phần đã tắt — áp dụng cho cả
 * backup Protogon lẫn file .msc/.json của bot nuke (cùng restoreCore).
 */
export const setRestoreOptions = mutation({
  args: {
    token: v.string(),
    guildId: v.string(),
    restoreRoles: v.optional(v.boolean()),
    restoreChannels: v.optional(v.boolean()),
    restoreMessages: v.optional(v.boolean()),
    restoreEmojis: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { token, guildId, restoreRoles, restoreChannels, restoreMessages, restoreEmojis },
  ) => {
    const user = await getUserByToken(ctx, token);
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild || !canManageGuild(user, guild)) {
      throw new Error("Không có quyền quản lý server này");
    }
    if (!guild.botInGuild) throw new Error("Bot chưa có trong server này");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (typeof restoreRoles === "boolean") patch.restoreRolesEnabled = restoreRoles;
    if (typeof restoreChannels === "boolean") patch.restoreChannelsEnabled = restoreChannels;
    if (typeof restoreMessages === "boolean") patch.restoreMessagesEnabled = restoreMessages;
    if (typeof restoreEmojis === "boolean") patch.restoreEmojisEnabled = restoreEmojis;
    await ctx.db.patch(guild._id, patch);
    return {
      ok: true,
      restoreRoles: guild.restoreRolesEnabled ?? true,
      restoreChannels: guild.restoreChannelsEnabled ?? true,
      restoreMessages: guild.restoreMessagesEnabled ?? true,
      restoreEmojis: guild.restoreEmojisEnabled ?? true,
    };
  },
});

/**
 * Bot quét mỗi giờ để tìm server đã đến hạn tự động backup
 * (bật lịch 2-30 ngày, chưa có yêu cầu đang chờ, chưa backup trong khoảng thời gian đó).
 */
export const botGetDueAuto = query({
  args: { botKey: v.optional(v.string()) },
  handler: async (ctx, { botKey }) => {
    await requireBotKeyStrict(ctx, botKey);
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

/**
 * Bot đọc thông tin bản backup gần nhất (để so khớp incremental):
 * - backupSnapshotChecksum: checksum "ổn định" → trùng là server KHÔNG ĐỔI (bỏ qua);
 * - backupMessageCount: > 0 nghĩa là bản gần nhất có kèm tin nhắn → backup
 *   tự động kế thừa chế độ này để so checksum CÙNG PHƯƠNG THỨC (không thì
 *   server không đổi vẫn tạo bản trùng lặp / bỏ nhầm bản mới).
 * Trả về null khi server chưa có backup nào.
 */
export const botGetLastChecksum = query({
  args: {
    guildId: v.string(),
    /** Chìa khóa bot (botAuth) — chỉ bot có OWNER_SEED mới tính được. */
    botKey: v.optional(v.string()),
  },
  handler: async (ctx, { botKey, guildId }) => {
    await requireBotKeyStrict(ctx, botKey);
    const last = await ctx.db
      .query("guildBackups")
      .withIndex("by_guildId_createdAt", (q) => q.eq("guildId", guildId))
      .order("desc")
      .first();
    if (!last) return null;
    return {
      backupSnapshotChecksum: last.backupSnapshotChecksum ?? null,
      backupMessageCount: last.messageCount ?? 0,
    };
  },
});

/** Bot quét mỗi ~20s để nhận yêu cầu tạo backup / khôi phục đang chờ. */
export const botGetPending = query({
  args: { botKey: v.optional(v.string()) },
  handler: async (ctx, { botKey }) => {
    await requireBotKeyStrict(ctx, botKey);
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
