import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getUserByToken, canManageGuild } from "./auth";
import { isAntiNukeModule } from "./modules";

/** Hành động hợp lệ của module: hình phạt thành viên + dọn tin nhắn. */
const ALLOWED_ACTIONS = [
  "warn",
  "kick",
  "ban",
  "timeout",
  "deleteMessages",
  "purgeMessages",
] as const;
const ACTION_STRENGTH: Record<string, number> = { warn: 1, timeout: 2, kick: 3, ban: 4 };

/** Lọc + chuẩn hóa danh sách hành động, trả về hình phạt mạnh nhất. */
function normalizeActions(raw: string[] | undefined): {
  actions: string[];
  strongest: "warn" | "kick" | "ban" | "timeout";
} {
  const actions = [...new Set((raw ?? []).filter((a) => (ALLOWED_ACTIONS as readonly string[]).includes(a)))].slice(0, 6);
  const member = actions
    .filter((a) => ACTION_STRENGTH[a] != null)
    .sort((a, b) => ACTION_STRENGTH[b] - ACTION_STRENGTH[a]);
  const strongest = (member[0] ?? "warn") as "warn" | "kick" | "ban" | "timeout";
  return { actions, strongest };
}

export const updateModule = mutation({
  args: {
    token: v.string(),
    guildId: v.string(),
    module: v.string(),
    enabled: v.optional(v.boolean()),
    threshold: v.optional(v.number()),
    windowSeconds: v.optional(v.number()),
    punish: v.optional(
      v.union(v.literal("warn"), v.literal("kick"), v.literal("ban"), v.literal("timeout")),
    ),
    actions: v.optional(v.array(v.string())),
    timeoutSeconds: v.optional(v.number()),
    whitelistRoles: v.optional(v.array(v.string())),
    heat: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!isAntiNukeModule(args.module)) throw new Error("Module không hợp lệ");
    const user = await getUserByToken(ctx, args.token);
    const guild = await ctx.db
      .query("guilds")
      .withIndex("by_discordId", (q) => q.eq("discordId", args.guildId))
      .first();
    if (!canManageGuild(user, guild)) throw new Error("Không có quyền quản lý server này");

    const mod = await ctx.db
      .query("antinukeModules")
      .withIndex("by_guild_module", (q) =>
        q.eq("guildId", args.guildId).eq("module", args.module),
      )
      .first();
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.enabled !== undefined) patch.enabled = args.enabled;
    if (args.threshold !== undefined) {
      patch.threshold = Math.max(1, Math.min(100, Math.floor(args.threshold)));
    }
    if (args.windowSeconds !== undefined) {
      patch.windowSeconds = Math.max(1, Math.min(3600, Math.floor(args.windowSeconds)));
    }
    if (args.actions !== undefined) {
      const { actions, strongest } = normalizeActions(args.actions);
      patch.actions = actions;
      patch.punish = strongest;
    } else if (args.punish !== undefined) {
      // Giữ tương thích: đổi punish → đồng bộ lại actions chỉ còn hình phạt đó.
      patch.punish = args.punish;
      patch.actions = [args.punish];
    }
    if (args.timeoutSeconds !== undefined) {
      patch.timeoutSeconds = Math.max(1, Math.min(86400, Math.floor(args.timeoutSeconds)));
    }
    if (args.whitelistRoles !== undefined) patch.whitelistRoles = args.whitelistRoles;
    if (args.heat !== undefined) patch.heat = Math.max(1, Math.min(100, Math.floor(args.heat)));
    if (mod) {
      await ctx.db.patch(mod._id, patch);
    } else {
      const { actions, strongest } = normalizeActions(args.actions);
      const punish = args.punish ?? strongest ?? "kick";
      await ctx.db.insert("antinukeModules", {
        guildId: args.guildId,
        module: args.module,
        enabled: args.enabled ?? true,
        threshold: args.threshold ?? 5,
        windowSeconds: args.windowSeconds ?? 10,
        punish,
        actions: actions.length > 0 ? actions : [punish],
        timeoutSeconds: args.timeoutSeconds ?? 300,
        whitelistRoles: args.whitelistRoles ?? [],
        heat: args.heat ?? 10,
        updatedAt: Date.now(),
      });
    }
    return { ok: true };
  },
});
