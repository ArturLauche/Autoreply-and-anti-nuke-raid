import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getUserByToken, canManageGuild } from "./auth";

const EVENT_TYPES = ["mod", "general"] as const;

async function requireGuild(ctx: QueryCtx | MutationCtx, token: string, guildId: string) {
  const user = await getUserByToken(ctx, token);
  const guild = await ctx.db
    .query("guilds")
    .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
    .first();
  if (!guild || !canManageGuild(user, guild)) throw new Error("Không có quyền quản lý server này");
  return guild;
}

/** Chuẩn hóa tên webhook: 1-80 ký tự, giữ nguyên emoji custom/unicode, bỏ khoảng trắng thừa. */
function cleanName(name: string): string {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!clean) throw new Error("Cần đặt tên cho webhook");
  if (clean.toLowerCase() === "clyde") throw new Error("Tên này không được phép (clyde)");
  return clean;
}

function cleanEventTypes(types: string[]): string[] {
  const cleaned = [...new Set(types.filter((t) => (EVENT_TYPES as readonly string[]).includes(t)))];
  if (cleaned.length === 0) throw new Error("Chọn ít nhất 1 loại sự kiện log");
  return cleaned;
}

function cleanAvatar(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const clean = url.trim().slice(0, 2000);
  if (!clean) return undefined;
  if (!/^https:\/\//i.test(clean)) throw new Error("Avatar phải là đường dẫn https://");
  return clean;
}

function cleanTemplate(tpl: string | undefined): string | undefined {
  if (!tpl) return undefined;
  const clean = tpl.trim().slice(0, 500);
  return clean || undefined;
}

function cleanColor(color: number | undefined): number | undefined {
  if (color === undefined) return undefined;
  return Math.max(0, Math.min(16777215, Math.floor(color)));
}

/** Web đọc danh sách webhook của server (không trả token — chỉ bot dùng). */
export const getGuildWebhooks = query({
  args: { token: v.string(), guildId: v.string() },
  handler: async (ctx, { token, guildId }) => {
    await requireGuild(ctx, token, guildId);
    const rows = await ctx.db
      .query("guildWebhooks")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .collect();
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((w) => ({
        _id: w._id,
        name: w.name,
        channelId: w.channelId,
        avatarUrl: w.avatarUrl ?? null,
        color: w.color ?? null,
        contentTemplate: w.contentTemplate ?? null,
        eventTypes: w.eventTypes,
        enabled: w.enabled,
        status: w.status,
        testRequested: w.testRequested ?? false,
        webhookId: w.webhookId ?? null,
        lastError: w.lastError ?? null,
        createdAt: w.createdAt,
      }));
  },
});

/** Web tạo yêu cầu webhook mới — bot sẽ tạo trên Discord trong ~1 phút. */
export const createWebhook = mutation({
  args: {
    token: v.string(),
    guildId: v.string(),
    name: v.string(),
    channelId: v.string(),
    avatarUrl: v.optional(v.string()),
    color: v.optional(v.number()),
    contentTemplate: v.optional(v.string()),
    eventTypes: v.array(v.string()),
  },
  handler: async (ctx, { token, guildId, channelId, ...rest }) => {
    await requireGuild(ctx, token, guildId);
    if (!/^\d{15,20}$/.test(channelId)) throw new Error("Kênh không hợp lệ");
    const count = await ctx.db
      .query("guildWebhooks")
      .withIndex("by_guildId", (q) => q.eq("guildId", guildId))
      .collect();
    if (count.length >= 5) throw new Error("Tối đa 5 webhook cho mỗi server");
    const now = Date.now();
    await ctx.db.insert("guildWebhooks", {
      guildId,
      channelId,
      name: cleanName(rest.name),
      avatarUrl: cleanAvatar(rest.avatarUrl),
      color: cleanColor(rest.color),
      contentTemplate: cleanTemplate(rest.contentTemplate),
      eventTypes: cleanEventTypes(rest.eventTypes),
      enabled: true,
      status: "pending_create",
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true };
  },
});

/** Web sửa webhook — bot đồng bộ tên/avatar qua Discord API rồi báo ready. */
export const updateWebhook = mutation({
  args: {
    token: v.string(),
    guildId: v.string(),
    webhookId: v.id("guildWebhooks"),
    name: v.optional(v.string()),
    channelId: v.optional(v.string()),
    avatarUrl: v.optional(v.union(v.string(), v.null())),
    color: v.optional(v.union(v.number(), v.null())),
    contentTemplate: v.optional(v.union(v.string(), v.null())),
    eventTypes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { token, guildId, webhookId, ...rest }) => {
    await requireGuild(ctx, token, guildId);
    const wh = await ctx.db.get(webhookId);
    if (!wh || wh.guildId !== guildId) throw new Error("Không tìm thấy webhook");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (rest.name !== undefined) patch.name = cleanName(rest.name);
    if (rest.channelId !== undefined) {
      if (!/^\d{15,20}$/.test(rest.channelId)) throw new Error("Kênh không hợp lệ");
      patch.channelId = rest.channelId;
    }
    if (rest.avatarUrl !== undefined) patch.avatarUrl = cleanAvatar(rest.avatarUrl ?? undefined);
    if (rest.color !== undefined) patch.color = cleanColor(rest.color ?? undefined);
    if (rest.contentTemplate !== undefined) patch.contentTemplate = cleanTemplate(rest.contentTemplate ?? undefined);
    if (rest.eventTypes !== undefined) patch.eventTypes = cleanEventTypes(rest.eventTypes);
    // Đã có webhook thật trên Discord → bot cần đồng bộ lại tên/avatar.
    if (wh.webhookId) patch.status = "pending_update";
    await ctx.db.patch(webhookId, patch);
    return { ok: true };
  },
});

/** Web bật/tắt webhook (tắt = bot ngừng gửi log qua webhook này). */
export const toggleWebhook = mutation({
  args: { token: v.string(), guildId: v.string(), webhookId: v.id("guildWebhooks") },
  handler: async (ctx, { token, guildId, webhookId }) => {
    await requireGuild(ctx, token, guildId);
    const wh = await ctx.db.get(webhookId);
    if (!wh || wh.guildId !== guildId) throw new Error("Không tìm thấy webhook");
    await ctx.db.patch(webhookId, { enabled: !wh.enabled, updatedAt: Date.now() });
    return { ok: true };
  },
});

/** Web yêu cầu xóa webhook — bot xóa trên Discord rồi xóa bản ghi. */
export const deleteWebhook = mutation({
  args: { token: v.string(), guildId: v.string(), webhookId: v.id("guildWebhooks") },
  handler: async (ctx, { token, guildId, webhookId }) => {
    await requireGuild(ctx, token, guildId);
    const wh = await ctx.db.get(webhookId);
    if (!wh || wh.guildId !== guildId) throw new Error("Không tìm thấy webhook");
    if (wh.webhookId) {
      await ctx.db.patch(webhookId, { status: "pending_delete", updatedAt: Date.now() });
    } else {
      // Chưa từng tạo trên Discord — xóa luôn.
      await ctx.db.delete(webhookId);
    }
    return { ok: true };
  },
});

/** Web yêu cầu bot gửi 1 embed test qua webhook (~1 phút). */
export const requestWebhookTest = mutation({
  args: { token: v.string(), guildId: v.string(), webhookId: v.id("guildWebhooks") },
  handler: async (ctx, { token, guildId, webhookId }) => {
    await requireGuild(ctx, token, guildId);
    const wh = await ctx.db.get(webhookId);
    if (!wh || wh.guildId !== guildId) throw new Error("Không tìm thấy webhook");
    if (!wh.webhookId || !wh.token) throw new Error("Webhook chưa được tạo trên Discord");
    await ctx.db.patch(webhookId, { testRequested: true, updatedAt: Date.now() });
    return { ok: true };
  },
});

/* ------------------------- Bot-side ------------------------- */

/** Bot quét việc cần làm (create/update/delete/test) cho MỌI guild trong 1 query. */
export const botGetWebhookJobs = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("guildWebhooks").collect();
    return rows
      .filter(
        (w) =>
          w.status === "pending_create" ||
          w.status === "pending_update" ||
          w.status === "pending_delete" ||
          w.testRequested === true,
      )
      .map((w) => ({
        _id: w._id,
        guildId: w.guildId,
        name: w.name,
        channelId: w.channelId,
        avatarUrl: w.avatarUrl ?? null,
        color: w.color ?? null,
        contentTemplate: w.contentTemplate ?? null,
        eventTypes: w.eventTypes,
        status: w.status,
        testRequested: w.testRequested ?? false,
        webhookId: w.webhookId ?? null,
        token: w.token ?? null,
      }));
  },
});

/** Bot tải webhooks (kèm token) của 1 guild để gửi log — cache ở phía bot. */
export const botGetWebhooks = query({
  args: { guildId: v.string() },
  handler: async (ctx, { guildId }) => {
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
      }));
  },
});

/** Bot báo đã tạo/sửa xong webhook trên Discord. */
export const botWebhookReady = mutation({
  args: {
    webhookId: v.id("guildWebhooks"),
    discordWebhookId: v.string(),
    token: v.string(),
  },
  handler: async (ctx, { webhookId, discordWebhookId, token }) => {
    const wh = await ctx.db.get(webhookId);
    if (!wh) return;
    await ctx.db.patch(webhookId, {
      webhookId: discordWebhookId,
      token,
      status: "ready",
      lastError: undefined,
      updatedAt: Date.now(),
    });
  },
});

/** Bot báo lỗi xử lý webhook. */
export const botWebhookFailed = mutation({
  args: { webhookId: v.id("guildWebhooks"), error: v.string() },
  handler: async (ctx, { webhookId, error }) => {
    const wh = await ctx.db.get(webhookId);
    if (!wh) return;
    await ctx.db.patch(webhookId, {
      status: "error",
      lastError: String(error).slice(0, 300),
      updatedAt: Date.now(),
    });
  },
});

/** Bot đã xóa webhook trên Discord → xóa bản ghi. */
export const botWebhookDeleted = mutation({
  args: { webhookId: v.id("guildWebhooks") },
  handler: async (ctx, { webhookId }) => {
    const wh = await ctx.db.get(webhookId);
    if (!wh) return;
    await ctx.db.delete(webhookId);
  },
});

/** Bot đã gửi xong embed test → xóa cờ. */
export const botWebhookTestDone = mutation({
  args: { webhookId: v.id("guildWebhooks") },
  handler: async (ctx, { webhookId }) => {
    const wh = await ctx.db.get(webhookId);
    if (!wh) return;
    await ctx.db.patch(webhookId, { testRequested: false, updatedAt: Date.now() });
  },
});