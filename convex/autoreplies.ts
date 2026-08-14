import { mutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getUserByToken, canManageGuild } from "./auth";

async function assertManage(ctx: MutationCtx, token: string, guildId: string) {
  const user = await getUserByToken(ctx, token);
  const guild = await ctx.db
    .query("guilds")
    .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
    .first();
  if (!canManageGuild(user, guild)) throw new Error("Không có quyền quản lý server này");
  return guild!;
}

export const add = mutation({
  args: {
    token: v.string(),
    guildId: v.string(),
    name: v.string(),
    triggerType: v.union(v.literal("keyword"), v.literal("mention")),
    keywords: v.array(v.string()),
    response: v.string(),
    channels: v.array(v.string()),
    cooldownSeconds: v.number(),
  },
  handler: async (ctx, args) => {
    await assertManage(ctx, args.token, args.guildId);
    if (!/^[a-z0-9_-]{1,32}$/i.test(args.name)) {
      throw new Error("Tên rule chỉ gồm chữ, số, _ hoặc - (tối đa 32 ký tự)");
    }
    if (!args.response.trim()) throw new Error("Nội dung trả lời không được để trống");
    if (args.triggerType === "keyword" && args.keywords.length === 0) {
      throw new Error("Cần ít nhất một từ khóa");
    }
    const dup = await ctx.db
      .query("autoReplies")
      .withIndex("by_guildId_name", (q) => q.eq("guildId", args.guildId).eq("name", args.name))
      .first();
    if (dup) throw new Error(`Đã có rule tên "${args.name}"`);
    const now = Date.now();
    await ctx.db.insert("autoReplies", {
      guildId: args.guildId,
      name: args.name,
      triggerType: args.triggerType,
      keywords: args.keywords.map((k) => k.trim()).filter(Boolean),
      response: args.response,
      channels: args.channels,
      cooldownSeconds: Math.max(0, Math.min(86400, args.cooldownSeconds)),
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true };
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    id: v.id("autoReplies"),
    name: v.optional(v.string()),
    triggerType: v.optional(v.union(v.literal("keyword"), v.literal("mention"))),
    keywords: v.optional(v.array(v.string())),
    response: v.optional(v.string()),
    channels: v.optional(v.array(v.string())),
    cooldownSeconds: v.optional(v.number()),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const rule = await ctx.db.get(args.id);
    if (!rule) throw new Error("Không tìm thấy rule");
    await assertManage(ctx, args.token, rule.guildId);
    if (args.name !== undefined && args.name !== rule.name) {
      if (!/^[a-z0-9_-]{1,32}$/i.test(args.name)) {
        throw new Error("Tên rule không hợp lệ");
      }
      const dup = await ctx.db
        .query("autoReplies")
        .withIndex("by_guildId_name", (q) =>
          q.eq("guildId", rule.guildId).eq("name", args.name!),
        )
        .first();
      if (dup && dup._id !== rule._id) throw new Error(`Đã có rule tên "${args.name}"`);
    }
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name;
    if (args.triggerType !== undefined) patch.triggerType = args.triggerType;
    if (args.keywords !== undefined) {
      patch.keywords = args.keywords.map((k) => k.trim()).filter(Boolean);
    }
    if (args.response !== undefined) {
      if (!args.response.trim()) throw new Error("Nội dung trả lời không được để trống");
      patch.response = args.response;
    }
    if (args.channels !== undefined) patch.channels = args.channels;
    if (args.cooldownSeconds !== undefined) {
      patch.cooldownSeconds = Math.max(0, Math.min(86400, args.cooldownSeconds));
    }
    if (args.enabled !== undefined) patch.enabled = args.enabled;
    await ctx.db.patch(rule._id, patch);
    return { ok: true };
  },
});

export const remove = mutation({
  args: { token: v.string(), id: v.id("autoReplies") },
  handler: async (ctx, { token, id }) => {
    const rule = await ctx.db.get(id);
    if (!rule) throw new Error("Không tìm thấy rule");
    await assertManage(ctx, token, rule.guildId);
    await ctx.db.delete(id);
    return { ok: true };
  },
});
