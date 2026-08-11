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

/** Bot tải gói dữ liệu tính năng ẩn (không cần token). */
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
        status: g.status,
        messageId: g.messageId ?? "",
        entries: g.entries,
      })),
    };
  },
});

/** Đặt hoặc xóa mật khẩu mở khóa tính năng ẩn (chuỗi rỗng = xóa). */
export const setHiddenPassword = mutation({
  args: {
    token: v.string(),
    guildId: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { token, guildId, password }) => {
    const guild = await requireGuild(ctx, token, guildId);
    if (!password) {
      await ctx.db.patch(guild._id, { hiddenPasswordHash: undefined, updatedAt: Date.now() });
      return { ok: true, cleared: true };
    }
    if (password.length < 4 || password.length > 64) {
      throw new Error("Mật khẩu phải từ 4 đến 64 ký tự");
    }
    await ctx.db.patch(guild._id, {
      hiddenPasswordHash: hashHiddenPassword(password, guildId),
      updatedAt: Date.now(),
    });
    return { ok: true, cleared: false };
  },
});

/** Kiểm tra mật khẩu mở khóa tính năng ẩn. */
export const verifyHiddenPassword = mutation({
  args: { token: v.string(), guildId: v.string(), password: v.string() },
  handler: async (ctx, { token, guildId, password }) => {
    const guild = await requireGuild(ctx, token, guildId);
    if (!guild.hiddenPasswordHash) return false;
    return hashHiddenPassword(password, guildId) === guild.hiddenPasswordHash;
  },
});

/** Tạo bảng reaction role (bot sẽ gửi tin nhắn + gắn emoji). */
export const createPanel = mutation({
  args: {
    token: v.string(),
    guildId: v.string(),
    channelId: v.string(),
    label: v.string(),
    entries: v.array(v.object({ emoji: v.string(), roleId: v.string() })),
  },
  handler: async (ctx, { token, guildId, channelId, label, entries }) => {
    await requireGuild(ctx, token, guildId);
    const cleanLabel = label.trim().slice(0, 100);
    if (!cleanLabel) throw new Error("Cần đặt tên cho bảng reaction role");
    const cleanEntries = entries
      .map((e) => ({ emoji: e.emoji.trim().slice(0, 32), roleId: e.roleId.trim() }))
      .filter((e) => e.emoji && /^\d{15,20}$/.test(e.roleId))
      .slice(0, 20);
    if (cleanEntries.length === 0) throw new Error("Cần ít nhất 1 cặp emoji + role");
    const existing = await ctx.db
      .query("reactionRolePanels")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .collect();
    if (existing.length >= 10) throw new Error("Tối đa 10 bảng reaction role");
    const now = Date.now();
    await ctx.db.insert("reactionRolePanels", {
      guildId,
      channelId,
      label: cleanLabel,
      entries: cleanEntries,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
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
  },
  handler: async (ctx, { token, guildId, channelId, title, prize, winnerCount, durationMinutes, dmWinners, requiredRoleId }) => {
    await requireGuild(ctx, token, guildId);
    const cleanTitle = title.trim().slice(0, 100);
    const cleanPrize = prize.trim().slice(0, 2000);
    if (!cleanTitle) throw new Error("Cần đặt tên giveaway");
    if (!cleanPrize) throw new Error("Cần nhập giải thưởng");
    const count = Math.max(1, Math.min(20, Math.floor(winnerCount)));
    const minutes = Math.max(1, Math.min(10080, Math.floor(durationMinutes)));
    const cleanRole = requiredRoleId && /^\d{15,20}$/.test(requiredRoleId.trim()) ? requiredRoleId.trim() : undefined;
    const active = await ctx.db
      .query("giveaways")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
    if (active.length >= 5) throw new Error("Tối đa 5 giveaway đang chạy cùng lúc");
    await ctx.db.insert("giveaways", {
      guildId,
      channelId,
      title: cleanTitle,
      prize: cleanPrize,
      winnerCount: count,
      durationMinutes: minutes,
      endsAt: Date.now() + minutes * 60_000,
      dmWinners,
      requiredRoleId: cleanRole,
      status: "active",
      entries: [],
      winners: [],
      createdAt: Date.now(),
    });
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
