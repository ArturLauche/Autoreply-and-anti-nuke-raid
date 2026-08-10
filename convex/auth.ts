import { type QueryCtx, type MutationCtx } from "./_generated/server";

/** Resolve the logged-in user from a session token, or null. */
export async function getUserByToken(
  ctx: QueryCtx | MutationCtx,
  token: string,
) {
  if (!token) return null;
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();
  if (!session) return null;
  return await ctx.db.get(session.userId);
}

/** MANAGE_GUILD permission bit (Discord). */
export const PERM_MANAGE_GUILD = 0x20;

export function canManageGuild(
  user: { discordId: string } | null,
  guild: { managers: string[] } | null | undefined,
) {
  if (!user || !guild) return false;
  return guild.managers.includes(user.discordId);
}
