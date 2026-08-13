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

/**
 * True khi người dùng có quyền quản lý guild này.
 * Chấp nhận cả: (1) đã được ghi trong guild.managers, hoặc (2) guild nằm trong
 * manageableGuildIds — danh sách server mà Discord xác nhận người dùng có quyền
 * Manage Server tại lần đăng nhập / làm mới gần nhất.
 * Nhờ đó server mới mời bot (được bot đồng bộ sau đó) vẫn hiện trên dashboard
 * mà người dùng không cần đăng nhập lại.
 */
export function guildAccessibleBy(
  user: { discordId: string; manageableGuildIds?: string[] } | null,
  guild: { discordId?: string; managers?: string[] } | null | undefined,
) {
  if (!user || !guild) return false;
  return (
    (guild.managers ?? []).includes(user.discordId) ||
    (user.manageableGuildIds ?? []).includes(guild.discordId ?? "")
  );
}

export function canManageGuild(
  user: { discordId: string; manageableGuildIds?: string[] } | null,
  guild: { managers: string[]; discordId?: string } | null | undefined,
) {
  return guildAccessibleBy(user, guild);
}
