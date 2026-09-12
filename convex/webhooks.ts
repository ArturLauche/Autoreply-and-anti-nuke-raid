import { action, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getUserByToken, canManageGuild } from "./auth";
import { requireBotKey } from "./botAuth";

async function requireGuild(ctx: QueryCtx | MutationCtx, token: string, guildId: string) {
  const user = await getUserByToken(ctx, token);
  const guild = await ctx.db
    .query("guilds")
    .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
    .first();
  if (!guild || !canManageGuild(user, guild)) throw new Error("Không có quyền quản lý server này");
  return guild;
}

/* ======================== Web đọc ======================== */

/** Web đọc thông tin webhook mặc định của server (để hiển thị trạng thái). */
export const getGuildWebhooks = query({
  args: { token: v.string(), guildId: v.string() },
  handler: async (ctx, { token, guildId }) => {
    await requireGuild(ctx, token, guildId);
    const rows = await ctx.db
      .query("guildWebhooks")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .collect();
    // Chỉ trả về webhook mặc định (isDefault) — webhook tùy chỉnh không lưu trên Convex nữa.
    return rows
      .filter((w) => w.isDefault)
      .map((w) => ({
        _id: w._id,
        name: w.name,
        channelId: w.channelId,
        enabled: w.enabled,
        status: w.status,
        isDefault: true,
        lastError: w.lastError ?? null,
        createdAt: w.createdAt,
      }));
  },
});

/* ======================== Webhook mặc định ======================== */

/** Tắt/mở webhook MẶC ĐỊNH của bot (chỉ chủ server quản lý được). */
export const toggleDefaultWebhook = mutation({
  args: { token: v.string(), guildId: v.string() },
  handler: async (ctx, { token, guildId }) => {
    await requireGuild(ctx, token, guildId);
    const wh = await ctx.db
      .query("guildWebhooks")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .filter((q) => q.eq(q.field("isDefault"), true))
      .first();
    if (!wh) throw new Error("Server chưa có webhook mặc định — set kênh log trong Cài đặt để bot tự tạo");
    await ctx.db.patch(wh._id, { enabled: !wh.enabled, updatedAt: Date.now() });
    return { ok: true, enabled: !wh.enabled };
  },
});

/* ======================== Bot-side ======================== */

/** Bot tải webhooks (kèm token) của 1 guild để gửi log — cache ở phía bot. */
export const botGetWebhooks = query({
  args: { guildId: v.string(),
    /** Chìa khóa bot (botAuth) — chỉ bot có OWNER_SEED mới tính được. */
    botKey: v.optional(v.string()), },
  handler: async (ctx, { botKey, guildId }) => {
    await requireBotKey(ctx, botKey);
    const rows = await ctx.db
      .query("guildWebhooks")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .collect();
    return rows
      .filter((w) => w.enabled && w.status === "ready" && w.webhookId && w.token)
      .map((w) => ({
        _id: w._id,
        name: w.name,
        webhookId: w.webhookId!,
        token: w.token!,
        color: w.color ?? null,
        contentTemplate: w.contentTemplate ?? null,
        eventTypes: w.eventTypes,
        isDefault: w.isDefault ?? false,
      }));
  },
});

/** Bot báo đã tự tạo xong webhook MẶC ĐỊNH (upsert row isDefault cho guild). */
export const botDefaultWebhookReady = mutation({
  args: {
    guildId: v.string(),
    channelId: v.string(),
    discordWebhookId: v.string(),
    token: v.string(),
    /** Chìa khóa bot (botAuth) — chỉ bot có OWNER_SEED mới tính được. */
    botKey: v.optional(v.string()),
  },
  handler: async (ctx, { botKey, guildId, channelId, discordWebhookId, token }) => {
    await requireBotKey(ctx, botKey);
    const existing = await ctx.db
      .query("guildWebhooks")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .filter((q) => q.eq(q.field("isDefault"), true))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        channelId,
        webhookId: discordWebhookId,
        token,
        status: "ready",
        lastError: undefined,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("guildWebhooks", {
        guildId,
        name: "Protogon Log",
        channelId,
        eventTypes: ["all"],
        enabled: true,
        status: "ready",
        isDefault: true,
        webhookId: discordWebhookId,
        token,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { ok: true };
  },
});

/** Bot báo đã gỡ webhook MẶC ĐỊNH (kênh log bị bỏ/đổi → xóa row). */
export const botDefaultWebhookDeleted = mutation({
  args: { guildId: v.string(),
    /** Chìa khóa bot (botAuth) — chỉ bot có OWNER_SEED mới tính được. */
    botKey: v.optional(v.string()), },
  handler: async (ctx, { botKey, guildId }) => {
    await requireBotKey(ctx, botKey);
    const rows = await ctx.db
      .query("guildWebhooks")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .collect();
    for (const row of rows) {
      if (row.isDefault) await ctx.db.delete(row._id);
    }
    return { ok: true };
  },
});

/* ======================== Cấu hình webhook mặc định từ web ======================== */

/** Web chủ server cập nhật cấu hình webhook MẶC ĐỊNH (eventTypes, color, contentTemplate). */
export const updateDefaultWebhook = mutation({
  args: {
    token: v.string(),
    guildId: v.string(),
    eventTypes: v.optional(v.array(v.string())),
    color: v.optional(v.union(v.number(), v.null())),
    contentTemplate: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { token, guildId, eventTypes, color, contentTemplate }) => {
    await requireGuild(ctx, token, guildId);
    const wh = await ctx.db
      .query("guildWebhooks")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .filter((q) => q.eq(q.field("isDefault"), true))
      .first();
    if (!wh) throw new Error("Server chưa có webhook mặc định — hãy set kênh log trước");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (eventTypes !== undefined) patch.eventTypes = eventTypes;
    if (color !== undefined) patch.color = color;
    if (contentTemplate !== undefined) patch.contentTemplate = contentTemplate;
    await ctx.db.patch(wh._id, patch);
    return { ok: true };
  },
});

/* ======================== Discord Webhook Sender (discohook.org style) ======================== */

/** Gửi embed qua Discord Webhook URL — chạy server-side để tránh CORS. */
export const sendEmbed = action({
  args: {
    webhookUrl: v.string(),
    content: v.optional(v.string()),
    username: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    embeds: v.array(
      v.object({
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        color: v.optional(v.number()),
        author: v.optional(
          v.object({
            name: v.optional(v.string()),
            icon_url: v.optional(v.string()),
            url: v.optional(v.string()),
          }),
        ),
        fields: v.optional(
          v.array(
            v.object({
              name: v.string(),
              value: v.string(),
              inline: v.optional(v.boolean()),
            }),
          ),
        ),
        image: v.optional(v.object({ url: v.string() })),
        thumbnail: v.optional(v.object({ url: v.string() })),
        footer: v.optional(
          v.object({
            text: v.optional(v.string()),
            icon_url: v.optional(v.string()),
          }),
        ),
        timestamp: v.optional(v.string()),
      }),
    ),
  },
  handler: async (_ctx, { webhookUrl, content, username, avatarUrl, embeds }) => {
    // Validate Discord webhook URL
    if (
      !/^https:\/\/discord\.com\/api\/webhooks\/\d{17,20}\/[\w-]{60,68}(\?wait=\d+)?$/.test(
        webhookUrl,
      )
    ) {
      throw new Error(
        "URL webhook không hợp lệ. Định dạng: https://discord.com/api/webhooks/{id}/{token}",
      );
    }

    // Validate embed size (Discord limit: 6000 chars total across all embeds)
    let totalChars = 0;
    for (const e of embeds) {
      totalChars += (e.title?.length ?? 0) + (e.description?.length ?? 0) + (e.author?.name?.length ?? 0) + (e.footer?.text?.length ?? 0);
      for (const f of e.fields ?? []) {
        totalChars += f.name.length + f.value.length;
      }
    }
    if (totalChars > 6000) {
      throw new Error(`Tổng ký tự embed vượt quá 6000 (${totalChars.toLocaleString()})`);
    }

    const payload: Record<string, unknown> = {};
    if (content) payload.content = content;
    if (username) payload.username = username;
    if (avatarUrl) payload.avatar_url = avatarUrl;
    if (embeds.length > 0) payload.embeds = embeds;

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      let msg = `Discord trả lỗi HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(body);
        if (parsed.message) msg += `: ${parsed.message}`;
      } catch {
        if (body) msg += `: ${body.slice(0, 200)}`;
      }
      throw new Error(msg);
    }

    return { ok: true };
  },
});
