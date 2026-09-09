import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getUserByToken, canManageGuild } from "./auth";
import { hashHiddenPassword } from "./sha256";

async function requireGuild(ctx: QueryCtx | MutationCtx, token: string, guildId: string) {
  const user = await getUserByToken(ctx, token);
  const guild = await ctx.db
    .query("guilds")
    .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
    .first();
  if (!guild || !canManageGuild(user, guild)) throw new Error("Không có quyền quản lý server này");
  return guild;
}

/** Bot status row duy nhất (chứa ownerDiscordId + avatar tùy chỉnh). */
async function getBotStatus(ctx: QueryCtx | MutationCtx) {
  return await ctx.db
    .query("botStatus")
    .withIndex("by_kind", (q) => q.eq("kind", "status"))
    .first();
}

/**
 * Owner có hợp lệ không: phải khớp một tài khoản Discord đã từng đăng nhập web.
 * Nếu owner bị ghi sai (VD: ghi nhầm Team ID thay vì User ID) thì coi như chưa có,
 * để chủ bot thật có thể nhận lại quyền — đây cũng là cách tự phục hồi lỗi đổi ảnh.
 */
async function ownerIsValid(ctx: QueryCtx | MutationCtx, ownerId: string | undefined) {
  if (!ownerId || !/^\d{15,20}$/.test(ownerId)) return false;
  const user = await ctx.db
    .query("users")
    .withIndex("by_discordId", (q) => q.eq("discordId", ownerId))
    .first();
  return !!user;
}

/** Chỉ admin SỞ HỮU bot mới được tương tác mật khẩu / tính năng ẩn. */
async function requireBotOwner(ctx: QueryCtx | MutationCtx, user: { discordId: string } | null) {
  if (!user) throw new Error("Vui lòng đăng nhập");
  const status = await getBotStatus(ctx);
  const ownerId = status?.ownerDiscordId;
  if (ownerId && (await ownerIsValid(ctx, ownerId)) && ownerId !== user.discordId) {
    throw new Error("Chỉ admin sở hữu bot mới được phép tương tác tính năng ẩn 🔒");
  }
  // Chưa có chủ sở hữu (hoặc owner cũ không hợp lệ) → người đặt mật khẩu đầu tiên là chủ bot.
  return status;
}

/** Bot tải gói dữ liệu tính năng ẩn (không cần token). */
/**
 * Batch: trả toàn bộ "việc cần làm" của hidden system cho MỌI guild trong 1 query
 * (panel chưa gửi, giveaway active/chưa kết thúc, DM chờ) — thay cho việc bot
 * query getBotHidden riêng từng guild mỗi vòng quét (tiết kiệm operations).
 * Bot tự lọc guild mình đang ở.
 */
export const getBotHiddenJobs = query({
  args: {},
  handler: async (ctx) => {
    const guilds = await ctx.db.query("guilds").collect();
    const panels = await ctx.db.query("reactionRolePanels").collect();
    const giveaways = await ctx.db.query("giveaways").collect();
    // Gộp luôn việc webhook (tạo/sửa/xóa/test) vào batch này để bot chỉ cần
    // 1 query mỗi vòng quét thay vì 2 (tiết kiệm function calls cho free tier).
    // Webhook mặc định: query riêng bên dưới (chỉ cần tìm 1 row isDefault per guild).
    const jobs = [];
    for (const g of guilds) {
      const gPanels = panels.filter((p) => p.guildId === g.discordId && p.enabled && !p.messageId);
      const gGws = giveaways.filter((gw) => gw.guildId === g.discordId && gw.status === "active");

      // Webhook MẶC ĐỊNH của bot: tự tạo khi đã set kênh log (modLog ?? log),
      // tự gỡ khi bỏ set kênh hoặc kênh đổi sang chỗ khác.
      const gDefault = await ctx.db
        .query("guildWebhooks")
        .withIndex("by_guildId", (q) => q.eq("guildId", g.discordId))
        .filter((q) => q.eq(q.field("isDefault"), true))
        .first();
      const targetChannel = g.modLogChannelId ?? g.logChannelId;
      let defaultWebhook: {
        kind: "create" | "delete";
        channelId: string | null;
        webhookId: string | null;
        token: string | null;
      } | null = null;
      if (gDefault) {
        if (!targetChannel || gDefault.channelId !== targetChannel) {
          defaultWebhook = {
            kind: "delete",
            channelId: targetChannel ?? null,
            webhookId: gDefault.webhookId ?? null,
            token: gDefault.token ?? null,
          };
        }
      } else if (targetChannel) {
        defaultWebhook = {
          kind: "create",
          channelId: targetChannel,
          webhookId: null,
          token: null,
        };
      }
      const dm =
        !!g.dmRequested && !!g.dmTargetUserId && !!g.dmMessage;
      if (gPanels.length === 0 && gGws.length === 0 && !dm && !defaultWebhook) continue;
      jobs.push({
        guildId: g.discordId,
        panels: gPanels.map((p) => ({
          _id: p._id,
          channelId: p.channelId,
          label: p.label,
          description: p.description ?? null,
          thumbnailUrl: p.thumbnailUrl ?? null,
          entries: p.entries,
          messageId: p.messageId ?? "",
        })),
        giveaways: gGws.map((gw) => ({
          _id: gw._id,
          channelId: gw.channelId,
          title: gw.title,
          prize: gw.prize,
          winnerCount: gw.winnerCount,
          endsAt: gw.endsAt,
          dmWinners: gw.dmWinners,
          requiredRoleId: gw.requiredRoleId ?? null,
          prizeRoleId: gw.prizeRoleId ?? null,
          template: gw.template ?? "default",
          message: gw.message ?? null,
          imageUrl: gw.imageUrl ?? null,
          endMessage: gw.endMessage ?? null,
          messageId: gw.messageId ?? "",
          entries: gw.entries,
        })),
        defaultWebhook,
        dmRequested: dm,
        dmTargetUserId: dm ? g.dmTargetUserId ?? null : null,
        dmTargetUsername: dm ? g.dmTargetUsername ?? null : null,
        dmMessage: dm ? g.dmMessage ?? null : null,
      });
    }
    return jobs;
  },
});

export const getBotHidden = query({
  args: { guildId: v.string() },
  handler: async (ctx, { guildId }) => {
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild) return null;
    const panels = await ctx.db
      .query("reactionRolePanels")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .collect();
    const giveaways = await ctx.db
      .query("giveaways")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .collect();
    return {
      dmRequested: guild.dmRequested ?? false,
      dmTargetUserId: guild.dmTargetUserId ?? null,
      dmTargetUsername: guild.dmTargetUsername ?? null,
      dmMessage: guild.dmMessage ?? null,
      panels: panels.map((p) => ({
        _id: p._id,
        channelId: p.channelId,
        label: p.label,
        description: p.description ?? null,
        thumbnailUrl: p.thumbnailUrl ?? null,
        entries: p.entries,
        messageId: p.messageId ?? "",
        enabled: p.enabled,
      })),
      giveaways: giveaways.map((g) => ({
        _id: g._id,
        channelId: g.channelId,
        title: g.title,
        prize: g.prize,
        winnerCount: g.winnerCount,
        endsAt: g.endsAt,
        dmWinners: g.dmWinners,
        requiredRoleId: g.requiredRoleId ?? null,
        prizeRoleId: g.prizeRoleId ?? null,
        template: g.template ?? "default",
        message: g.message ?? null,
        imageUrl: g.imageUrl ?? null,
        endMessage: g.endMessage ?? null,
        status: g.status,
        messageId: g.messageId ?? "",
        entries: g.entries,
      })),
    };
  },
});

/** Trả về avatar tùy chỉnh của bot & Haimiya (công khai, dùng cho web). */
export const getBotBranding = query({
  args: {},
  handler: async (ctx) => {
    const status = await getBotStatus(ctx);
    return {
      botAvatarUrl: status?.botAvatarUrl ?? null,
      haimiyaAvatarUrl: status?.haimiyaAvatarUrl ?? null,
      ownerSet: !!status?.ownerDiscordId,
    };
  },
});

/** Bot báo chủ sở hữu (best-effort từ ứng dụng Discord) — ghi khi chưa có hoặc owner cũ sai. */
export const botSetOwner = mutation({
  args: {
    ownerId: v.string(),
    ownerName: v.optional(v.string()),
    ownerAvatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, { ownerId, ownerName, ownerAvatarUrl }) => {
    if (!/^\d{15,20}$/.test(ownerId)) return { ok: false };
    const status = await getBotStatus(ctx);
    if (status?.ownerDiscordId && (await ownerIsValid(ctx, status.ownerDiscordId))) {
      return { ok: false };
    }
    const patch: Record<string, unknown> = { ownerDiscordId: ownerId };
    if (ownerName !== undefined) patch.ownerName = ownerName ? ownerName.slice(0, 120) : undefined;
    if (ownerAvatarUrl !== undefined)
      patch.ownerAvatarUrl = ownerAvatarUrl ? ownerAvatarUrl.slice(0, 2000) : undefined;
    if (status) {
      await ctx.db.patch(status._id, patch);
    } else {
      const now = Date.now();
      await ctx.db.insert("botStatus", {
        kind: "status",
        online: false,
        guildCount: 0,
        memberCount: 0,
        lastHeartbeat: now,
        startedAt: now,
        version: "",
        ...patch,
      });
    }
    return { ok: true };
  },
});

/** Đổi avatar bot / Haimiya trên web (chỉ chủ sở hữu bot). */
export const setBotBranding = mutation({
  args: {
    token: v.string(),
    guildId: v.string(),
    botAvatarUrl: v.optional(v.union(v.string(), v.null())),
    haimiyaAvatarUrl: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { token, guildId, botAvatarUrl, haimiyaAvatarUrl }) => {
    const user = await getUserByToken(ctx, token);
    await requireGuild(ctx, token, guildId);
    await requireBotOwner(ctx, user);
    const status = await getBotStatus(ctx);
    const clean = (u: string | null | undefined) =>
      u ? u.trim().slice(0, 2000) : undefined;
    const patch: Record<string, unknown> = {};
    if (botAvatarUrl !== undefined) patch.botAvatarUrl = clean(botAvatarUrl);
    if (haimiyaAvatarUrl !== undefined) patch.haimiyaAvatarUrl = clean(haimiyaAvatarUrl);
    if (status) {
      await ctx.db.patch(status._id, patch);
    } else {
      const now = Date.now();
      await ctx.db.insert("botStatus", {
        kind: "status",
        online: false,
        guildCount: 0,
        memberCount: 0,
        lastHeartbeat: now,
        startedAt: now,
        version: "",
        ...patch,
      });
    }
    return { ok: true };
  },
});

/** Tạo URL upload ảnh avatar lên Convex storage (chỉ chủ sở hữu bot). */
export const generateUploadUrl = mutation({
  args: { token: v.string(), guildId: v.string() },
  handler: async (ctx, { token, guildId }) => {
    const user = await getUserByToken(ctx, token);
    await requireGuild(ctx, token, guildId);
    await requireBotOwner(ctx, user);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Lưu ảnh đã upload thành avatar bot / Haimiya (chỉ chủ sở hữu bot). */
export const saveBrandingUpload = mutation({
  args: {
    token: v.string(),
    guildId: v.string(),
    storageId: v.id("_storage"),
    slot: v.union(v.literal("bot"), v.literal("haimiya")),
  },
  handler: async (ctx, { token, guildId, storageId, slot }) => {
    const user = await getUserByToken(ctx, token);
    await requireGuild(ctx, token, guildId);
    await requireBotOwner(ctx, user);
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("Không tìm thấy file đã upload");
    const status = await getBotStatus(ctx);
    const field = slot === "bot" ? "botAvatarUrl" : "haimiyaAvatarUrl";
    if (status) {
      await ctx.db.patch(status._id, { [field]: url });
    } else {
      const now = Date.now();
      await ctx.db.insert("botStatus", {
        kind: "status",
        online: false,
        guildCount: 0,
        memberCount: 0,
        lastHeartbeat: now,
        startedAt: now,
        version: "",
        [field]: url,
      });
    }
    return { ok: true, url };
  },
});

/** Đặt hoặc xóa mật khẩu mở khóa tính năng ẩn (chuỗi rỗng = xóa). CHỈ chủ sở hữu bot. */
export const setHiddenPassword = mutation({
  args: {
    token: v.string(),
    guildId: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { token, guildId, password }) => {
    const user = await getUserByToken(ctx, token);
    const guild = await requireGuild(ctx, token, guildId);
    const status = await requireBotOwner(ctx, user);
    if (!password) {
      await ctx.db.patch(guild._id, { hiddenPasswordHash: undefined, updatedAt: Date.now() });
      return { ok: true, cleared: true };
    }
    if (password.length < 4 || password.length > 64) {
      throw new Error("Mật khẩu phải từ 4 đến 64 ký tự");
    }
    // Người đầu tiên đặt mật khẩu trở thành chủ sở hữu bot (bootstrap) —
    // cũng cho phép nhận lại quyền khi owner cũ ghi sai / không tồn tại.
    if (user && (!status?.ownerDiscordId || !(await ownerIsValid(ctx, status.ownerDiscordId)))) {
      await setOwnerId(ctx, user.discordId);
    }
    await ctx.db.patch(guild._id, {
      hiddenPasswordHash: hashHiddenPassword(password, guildId),
      updatedAt: Date.now(),
    });
    return { ok: true, cleared: false };
  },
});

async function setOwnerId(ctx: MutationCtx, ownerId: string) {
  const status = await getBotStatus(ctx);
  if (status) {
    await ctx.db.patch(status._id, { ownerDiscordId: ownerId });
  } else {
    const now = Date.now();
    await ctx.db.insert("botStatus", {
      kind: "status",
      online: false,
      guildCount: 0,
      memberCount: 0,
      lastHeartbeat: now,
      startedAt: now,
      version: "",
      ownerDiscordId: ownerId,
    });
  }
}

/** Kiểm tra mật khẩu mở khóa tính năng ẩn — CHỈ chủ sở hữu bot. */
export const verifyHiddenPassword = mutation({
  args: { token: v.string(), guildId: v.string(), password: v.string() },
  handler: async (ctx, { token, guildId, password }) => {
    const user = await getUserByToken(ctx, token);
    await requireGuild(ctx, token, guildId);
    try {
      await requireBotOwner(ctx, user);
    } catch {
      return false;
    }
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild?.hiddenPasswordHash) return false;
    return hashHiddenPassword(password, guildId) === guild.hiddenPasswordHash;
  },
});

/** Rút gọn emoji về dạng chuẩn: custom emoji → ID số; unicode → bỏ variation selector. */
function normalizeEmoji(emoji: string): string {
  const s = emoji.trim();
  const custom =
    /^<a?:[^:]+:(\d{15,20})>$/.exec(s) ?? /^[^:]+:(\d{15,20})$/.exec(s);
  if (custom) return custom[1];
  return s.replace(/\uFE0F/g, "").slice(0, 32);
}

function cleanPanelInput(input: {
  label: string;
  description?: string;
  thumbnailUrl?: string;
  entries: { emoji: string; roleId: string }[];
}) {
  const cleanLabel = input.label.trim().slice(0, 100);
  if (!cleanLabel) throw new Error("Cần đặt tên cho bảng reaction role");
  const cleanDescription = input.description
    ? input.description.trim().slice(0, 2000)
    : undefined;
  const cleanThumb = input.thumbnailUrl
    ? input.thumbnailUrl.trim().slice(0, 2000)
    : undefined;
  const cleanEntries = input.entries
    .map((e) => ({
      emoji: normalizeEmoji(e.emoji),
      roleId: e.roleId.trim(),
    }))
    .filter((e) => e.emoji && /^\d{15,20}$/.test(e.roleId))
    .slice(0, 20);
  if (cleanEntries.length === 0) throw new Error("Cần ít nhất 1 cặp emoji + role");
  return {
    label: cleanLabel,
    description: cleanDescription,
    thumbnailUrl: cleanThumb,
    entries: cleanEntries,
  };
}

/** Tạo bảng reaction role (bot sẽ gửi tin nhắn + gắn emoji). */
export const createPanel = mutation({
  args: {
    token: v.string(),
    guildId: v.string(),
    channelId: v.string(),
    label: v.string(),
    description: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    entries: v.array(v.object({ emoji: v.string(), roleId: v.string() })),
  },
  handler: async (ctx, { token, guildId, channelId, label, description, thumbnailUrl, entries }) => {
    await requireGuild(ctx, token, guildId);
    const clean = cleanPanelInput({ label, description, thumbnailUrl, entries });
    const existing = await ctx.db
      .query("reactionRolePanels")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .collect();
    if (existing.length >= 10) throw new Error("Tối đa 10 bảng reaction role");
    const now = Date.now();
    await ctx.db.insert("reactionRolePanels", {
      guildId,
      channelId,
      ...clean,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true };
  },
});

/** Bot tạo bảng reaction role từ lệnh (đã kiểm tra quyền ở phía bot). */
export const botCreatePanel = mutation({
  args: {
    guildId: v.string(),
    channelId: v.string(),
    label: v.string(),
    description: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    entries: v.array(v.object({ emoji: v.string(), roleId: v.string() })),
  },
  handler: async (ctx, { guildId, channelId, label, description, thumbnailUrl, entries }) => {
    const clean = cleanPanelInput({ label, description, thumbnailUrl, entries });
    const existing = await ctx.db
      .query("reactionRolePanels")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .collect();
    if (existing.length >= 10) throw new Error("Tối đa 10 bảng reaction role");
    const now = Date.now();
    await ctx.db.insert("reactionRolePanels", {
      guildId,
      channelId,
      ...clean,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true };
  },
});

/**
 * Cập nhật bảng reaction role (tên, mô tả, thumbnail, cặp emoji/role).
 * Nội dung thay đổi → xóa messageId để bot gửi bảng mới ở vòng quét kế tiếp.
 */
export const updatePanel = mutation({
  args: {
    token: v.string(),
    guildId: v.string(),
    panelId: v.id("reactionRolePanels"),
    label: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    thumbnailUrl: v.optional(v.union(v.string(), v.null())),
    entries: v.optional(v.array(v.object({ emoji: v.string(), roleId: v.string() }))),
  },
  handler: async (ctx, { token, guildId, panelId, label, description, thumbnailUrl, entries }) => {
    await requireGuild(ctx, token, guildId);
    const panel = await ctx.db.get(panelId);
    if (!panel || panel.guildId !== guildId) throw new Error("Không tìm thấy bảng reaction role");
    const patch: Record<string, unknown> = { updatedAt: Date.now(), messageId: undefined };
    if (label !== undefined) {
      const clean = label.trim().slice(0, 100);
      if (!clean) throw new Error("Cần đặt tên cho bảng reaction role");
      patch.label = clean;
    }
    if (description !== undefined) {
      patch.description = description ? description.trim().slice(0, 2000) : undefined;
    }
    if (thumbnailUrl !== undefined) {
      patch.thumbnailUrl = thumbnailUrl ? thumbnailUrl.trim().slice(0, 2000) : undefined;
    }
    if (entries !== undefined) {
      const cleanEntries = entries
        .map((e) => ({ emoji: normalizeEmoji(e.emoji), roleId: e.roleId.trim() }))
        .filter((e) => e.emoji && /^\d{15,20}$/.test(e.roleId))
        .slice(0, 20);
      if (cleanEntries.length === 0) throw new Error("Cần ít nhất 1 cặp emoji + role");
      patch.entries = cleanEntries;
    }
    await ctx.db.patch(panelId, patch);
    return { ok: true };
  },
});

/** Bot cập nhật bảng reaction role từ lệnh (đã kiểm tra quyền ở phía bot). */
export const botUpdatePanel = mutation({
  args: {
    guildId: v.string(),
    panelId: v.id("reactionRolePanels"),
    label: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    thumbnailUrl: v.optional(v.union(v.string(), v.null())),
    entries: v.optional(v.array(v.object({ emoji: v.string(), roleId: v.string() }))),
  },
  handler: async (ctx, { guildId, panelId, label, description, thumbnailUrl, entries }) => {
    const panel = await ctx.db.get(panelId);
    if (!panel || panel.guildId !== guildId) throw new Error("Không tìm thấy bảng reaction role");
    const patch: Record<string, unknown> = { updatedAt: Date.now(), messageId: undefined };
    if (label !== undefined) {
      const clean = label.trim().slice(0, 100);
      if (!clean) throw new Error("Cần đặt tên cho bảng reaction role");
      patch.label = clean;
    }
    if (description !== undefined) {
      patch.description = description ? description.trim().slice(0, 2000) : undefined;
    }
    if (thumbnailUrl !== undefined) {
      patch.thumbnailUrl = thumbnailUrl ? thumbnailUrl.trim().slice(0, 2000) : undefined;
    }
    if (entries !== undefined) {
      const cleanEntries = entries
        .map((e) => ({ emoji: normalizeEmoji(e.emoji), roleId: e.roleId.trim() }))
        .filter((e) => e.emoji && /^\d{15,20}$/.test(e.roleId))
        .slice(0, 20);
      if (cleanEntries.length === 0) throw new Error("Cần ít nhất 1 cặp emoji + role");
      patch.entries = cleanEntries;
    }
    await ctx.db.patch(panelId, patch);
    return { ok: true };
  },
});

export const deletePanel = mutation({
  args: { token: v.string(), guildId: v.string(), panelId: v.id("reactionRolePanels") },
  handler: async (ctx, { token, guildId, panelId }) => {
    await requireGuild(ctx, token, guildId);
    const panel = await ctx.db.get(panelId);
    if (!panel || panel.guildId !== guildId) throw new Error("Không tìm thấy bảng reaction role");
    await ctx.db.delete(panelId);
    return { ok: true };
  },
});

/** Bot xóa bảng reaction role từ lệnh (đã kiểm tra quyền ở phía bot). */
export const botDeletePanel = mutation({
  args: { guildId: v.string(), panelId: v.id("reactionRolePanels") },
  handler: async (ctx, { guildId, panelId }) => {
    const panel = await ctx.db.get(panelId);
    if (!panel || panel.guildId !== guildId) throw new Error("Không tìm thấy bảng reaction role");
    await ctx.db.delete(panelId);
    return { ok: true };
  },
});

export const togglePanel = mutation({
  args: { token: v.string(), guildId: v.string(), panelId: v.id("reactionRolePanels") },
  handler: async (ctx, { token, guildId, panelId }) => {
    await requireGuild(ctx, token, guildId);
    const panel = await ctx.db.get(panelId);
    if (!panel || panel.guildId !== guildId) throw new Error("Không tìm thấy bảng reaction role");
    await ctx.db.patch(panelId, { enabled: !panel.enabled, updatedAt: Date.now() });
    return { ok: true };
  },
});

/** Bot báo đã gửi tin nhắn bảng reaction role. */
export const panelPosted = mutation({
  args: { panelId: v.id("reactionRolePanels"), messageId: v.string() },
  handler: async (ctx, { panelId, messageId }) => {
    const panel = await ctx.db.get(panelId);
    if (!panel) return;
    await ctx.db.patch(panelId, { messageId, updatedAt: Date.now() });
  },
});

const GIVEAWAY_TEMPLATES = ["default", "luxury", "vip", "simple"] as const;

function cleanGiveawayInput({
  title,
  prize,
  winnerCount,
  durationMinutes,
  requiredRoleId,
  prizeRoleId,
  template,
  message,
  imageUrl,
  endMessage,
}: {
  title: string;
  prize: string;
  winnerCount: number;
  durationMinutes: number;
  requiredRoleId?: string;
  prizeRoleId?: string;
  template?: string;
  message?: string;
  imageUrl?: string;
  endMessage?: string;
}) {
  const cleanTitle = title.trim().slice(0, 100);
  const cleanPrize = prize.trim().slice(0, 2000);
  if (!cleanTitle) throw new Error("Cần đặt tên giveaway");
  if (!cleanPrize) throw new Error("Cần nhập giải thưởng");
  const count = Math.max(1, Math.min(20, Math.floor(winnerCount)));
  const minutes = Math.max(1, Math.min(10080, Math.floor(durationMinutes)));
  const cleanRole = requiredRoleId && /^\d{15,20}$/.test(requiredRoleId.trim()) ? requiredRoleId.trim() : undefined;
  const cleanPrizeRole = prizeRoleId && /^\d{15,20}$/.test(prizeRoleId.trim()) ? prizeRoleId.trim() : undefined;
  const cleanTemplate =
    template && (GIVEAWAY_TEMPLATES as readonly string[]).includes(template) ? template : "default";
  const cleanMessage = message ? message.trim().slice(0, 2000) : undefined;
  const cleanImage = imageUrl ? imageUrl.trim().slice(0, 2000) : undefined;
  const cleanEnd = endMessage ? endMessage.trim().slice(0, 1000) : undefined;
  return {
    title: cleanTitle,
    prize: cleanPrize,
    winnerCount: count,
    durationMinutes: minutes,
    requiredRoleId: cleanRole,
    prizeRoleId: cleanPrizeRole,
    template: cleanTemplate,
    message: cleanMessage,
    imageUrl: cleanImage,
    endMessage: cleanEnd,
  };
}

/** Tạo giveaway mới (bot sẽ gửi embed + phản ứng 🎉). */
export const createGiveaway = mutation({
  args: {
    token: v.string(),
    guildId: v.string(),
    channelId: v.string(),
    title: v.string(),
    prize: v.string(),
    winnerCount: v.number(),
    durationMinutes: v.number(),
    dmWinners: v.boolean(),
    requiredRoleId: v.optional(v.string()),
    prizeRoleId: v.optional(v.string()),
    template: v.optional(v.string()),
    message: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    endMessage: v.optional(v.string()),
  },
  handler: async (ctx, { token, guildId, channelId, ...rest }) => {
    await requireGuild(ctx, token, guildId);
    const clean = cleanGiveawayInput(rest);
    const active = await ctx.db
      .query("giveaways")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
    if (active.length >= 5) throw new Error("Tối đa 5 giveaway đang chạy cùng lúc");
    await ctx.db.insert("giveaways", {
      guildId,
      channelId,
      ...clean,
      endsAt: Date.now() + clean.durationMinutes * 60_000,
      dmWinners: rest.dmWinners,
      status: "active",
      entries: [],
      winners: [],
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Bot tạo giveaway từ lệnh slash / prefix (đã kiểm tra quyền ở phía bot). */
export const botCreateGiveaway = mutation({
  args: {
    guildId: v.string(),
    channelId: v.string(),
    title: v.string(),
    prize: v.string(),
    winnerCount: v.number(),
    durationMinutes: v.number(),
    dmWinners: v.boolean(),
    requiredRoleId: v.optional(v.string()),
    prizeRoleId: v.optional(v.string()),
    template: v.optional(v.string()),
    message: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    endMessage: v.optional(v.string()),
  },
  handler: async (ctx, { guildId, channelId, ...rest }) => {
    const clean = cleanGiveawayInput(rest);
    const active = await ctx.db
      .query("giveaways")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
    if (active.length >= 5) throw new Error("Tối đa 5 giveaway đang chạy cùng lúc");
    await ctx.db.insert("giveaways", {
      guildId,
      channelId,
      ...clean,
      endsAt: Date.now() + clean.durationMinutes * 60_000,
      dmWinners: rest.dmWinners,
      status: "active",
      entries: [],
      winners: [],
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Bot kết thúc giveaway sớm (đặt endsAt về hiện tại — poll sẽ chốt người thắng). */
export const botGiveawayEndNow = mutation({
  args: { guildId: v.string(), title: v.string() },
  handler: async (ctx, { guildId, title }) => {
    const giveaway = await ctx.db
      .query("giveaways")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("title"), title),
        ),
      )
      .first();
    if (!giveaway) return { ok: false };
    await ctx.db.patch(giveaway._id, { endsAt: Date.now() });
    return { ok: true };
  },
});

export const cancelGiveaway = mutation({
  args: { token: v.string(), guildId: v.string(), giveawayId: v.id("giveaways") },
  handler: async (ctx, { token, guildId, giveawayId }) => {
    await requireGuild(ctx, token, guildId);
    const giveaway = await ctx.db.get(giveawayId);
    if (!giveaway || giveaway.guildId !== guildId) throw new Error("Không tìm thấy giveaway");
    if (giveaway.status === "active") {
      await ctx.db.patch(giveawayId, { status: "cancelled" });
    }
    return { ok: true };
  },
});

/** Bot báo đã gửi tin nhắn giveaway. */
export const giveawayPosted = mutation({
  args: { giveawayId: v.id("giveaways"), messageId: v.string() },
  handler: async (ctx, { giveawayId, messageId }) => {
    const giveaway = await ctx.db.get(giveawayId);
    if (!giveaway) return;
    await ctx.db.patch(giveawayId, { messageId });
  },
});

/** Bot ghi nhận 1 lượt tham gia giveaway (từ reaction 🎉). */
export const giveawayEnter = mutation({
  args: { giveawayId: v.id("giveaways"), userId: v.string(), username: v.string() },
  handler: async (ctx, { giveawayId, userId, username }) => {
    const giveaway = await ctx.db.get(giveawayId);
    if (!giveaway || giveaway.status !== "active" || !giveaway.messageId) return { ok: false };
    if (giveaway.entries.some((e) => e.userId === userId)) return { ok: false };
    await ctx.db.patch(giveawayId, {
      entries: [...giveaway.entries, { userId, username: username || userId }],
    });
    return { ok: true };
  },
});

/** Bot kết thúc giveaway: chốt người thắng. */
export const giveawayEnd = mutation({
  args: {
    giveawayId: v.id("giveaways"),
    winners: v.array(v.object({ userId: v.string(), username: v.string() })),
  },
  handler: async (ctx, { giveawayId, winners }) => {
    const giveaway = await ctx.db.get(giveawayId);
    if (!giveaway || giveaway.status !== "active") return;
    await ctx.db.patch(giveawayId, { status: "ended", winners });
  },
});

/** Gửi tin nhắn DM trực tiếp cho người dùng (bot sẽ gửi). */
export const requestDm = mutation({
  args: {
    token: v.string(),
    guildId: v.string(),
    userId: v.string(),
    username: v.optional(v.string()),
    message: v.string(),
  },
  handler: async (ctx, { token, guildId, userId, username, message }) => {
    const guild = await requireGuild(ctx, token, guildId);
    if (!/^\d{15,20}$/.test(userId)) throw new Error("ID người dùng không hợp lệ");
    const clean = message.trim().slice(0, 2000);
    if (!clean) throw new Error("Cần nhập nội dung tin nhắn");
    await ctx.db.patch(guild._id, {
      dmTargetUserId: userId,
      dmTargetUsername: username ? username.slice(0, 60) : undefined,
      dmMessage: clean,
      dmRequested: true,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Bot báo đã gửi xong DM. */
export const botClearDm = mutation({
  args: { guildId: v.string() },
  handler: async (ctx, { guildId }) => {
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
      .first();
    if (!guild) return;
    await ctx.db.patch(guild._id, {
      dmRequested: false,
      dmTargetUserId: undefined,
      dmTargetUsername: undefined,
      dmMessage: undefined,
      updatedAt: Date.now(),
    });
  },
});
