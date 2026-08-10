import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getUserByToken, canManageGuild } from "./auth";
import { isAntiNukeModule } from "./modules";

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
    timeoutSeconds: v.optional(v.number()),
    whitelistRoles: v.optional(v.array(v.string())),
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
    if (args.punish !== undefined) patch.punish = args.punish;
    if (args.timeoutSeconds !== undefined) {
      patch.timeoutSeconds = Math.max(1, Math.min(86400, Math.floor(args.timeoutSeconds)));
    }
    if (args.whitelistRoles !== undefined) patch.whitelistRoles = args.whitelistRoles;
    if (mod) {
      await ctx.db.patch(mod._id, patch);
    } else {
      await ctx.db.insert("antinukeModules", {
        guildId: args.guildId,
        module: args.module,
        enabled: args.enabled ?? true,
        threshold: args.threshold ?? 5,
        windowSeconds: args.windowSeconds ?? 10,
        punish: args.punish ?? "kick",
        timeoutSeconds: args.timeoutSeconds ?? 300,
        whitelistRoles: args.whitelistRoles ?? [],
        updatedAt: Date.now(),
      });
    }
    return { ok: true };
  },
});
