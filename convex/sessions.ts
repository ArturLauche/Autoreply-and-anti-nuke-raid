import { mutation, query } from "./_generated/server";
import { v, type GenericId } from "convex/values";
import { getUserByToken, PERM_MANAGE_GUILD } from "./auth";

export const login = mutation({
  args: {
    token: v.string(),
    user: v.object({
      discordId: v.string(),
      username: v.string(),
      globalName: v.optional(v.string()),
      avatar: v.optional(v.string()),
    }),
    guilds: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        icon: v.optional(v.string()),
        permissions: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const manageable = args.guilds
      .filter((g) => (BigInt(g.permissions) & BigInt(PERM_MANAGE_GUILD)) !== 0n)
      .map((g) => g.id);

    let userId: GenericId<"users">;
    const existing = await ctx.db
      .query("users")
      .withIndex("by_discordId", (q) => q.eq("discordId", args.user.discordId))
      .first();
    if (existing) {
      userId = existing._id;
      await ctx.db.patch(existing._id, {
        username: args.user.username,
        globalName: args.user.globalName,
        avatar: args.user.avatar,
        manageableGuildIds: manageable,
        lastLoginAt: Date.now(),
      });
    } else {
      userId = await ctx.db.insert("users", {
        discordId: args.user.discordId,
        username: args.user.username,
        globalName: args.user.globalName,
        avatar: args.user.avatar,
        manageableGuildIds: manageable,
        lastLoginAt: Date.now(),
      });
    }

    // Register the user as a manager on every guild they can manage.
    for (const guildId of manageable) {
      const guild = await ctx.db
        .query("guilds")
        .withIndex("by_discordId", (q) => q.eq("discordId", guildId))
        .first();
      if (guild && !guild.managers.includes(args.user.discordId)) {
        await ctx.db.patch(guild._id, {
          managers: [...guild.managers, args.user.discordId],
        });
      }
    }

    const stale = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (stale) await ctx.db.delete(stale._id);
    await ctx.db.insert("sessions", {
      token: args.token,
      userId,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (session) await ctx.db.delete(session._id);
    return { ok: true };
  },
});

export const me = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await getUserByToken(ctx, token);
    if (!user) return null;
    const allGuilds = await ctx.db.query("guilds").collect();
    const guilds = allGuilds
      .filter((g) => g.managers.includes(user.discordId))
      .map((g) => ({
        discordId: g.discordId,
        name: g.name,
        icon: g.icon ?? null,
        memberCount: g.memberCount ?? null,
        prefix: g.prefix,
        antinukeEnabled: g.antinukeEnabled,
        botInGuild: g.botInGuild,
        lastHeartbeat: g.lastHeartbeat ?? null,
      }));
    const status = await ctx.db
      .query("botStatus")
      .withIndex("by_kind", (q) => q.eq("kind", "status"))
      .first();
    return {
      user: {
        discordId: user.discordId,
        username: user.username,
        globalName: user.globalName ?? null,
        avatar: user.avatar ?? null,
      },
      guilds,
      botOnline: status?.online ?? false,
      botGuildCount: status?.guildCount ?? 0,
      botMemberCount: status?.memberCount ?? 0,
    };
  },
});
