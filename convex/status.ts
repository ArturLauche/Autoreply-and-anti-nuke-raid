import { query } from "./_generated/server";

/**
 * Trạng thái tổng thể của bot (công khai, không nhạy cảm): online hay không,
 * số server/thành viên, heartbeat gần nhất, và thông tin chủ bot mà bot tự
 * đồng bộ từ Discord mỗi phút (cập nhật 24/7).
 */
export const botStatus = query({
  args: {},
  handler: async (ctx) => {
    const status = await ctx.db
      .query("botStatus")
      .withIndex("by_kind", (q) => q.eq("kind", "status"))
      .first();
    if (!status) {
      return {
        online: false,
        guildCount: 0,
        memberCount: 0,
        lastHeartbeat: null,
        ownerName: null,
        ownerAvatarUrl: null,
      };
    }
    return {
      online: status.online && Date.now() - status.lastHeartbeat < 180_000,
      guildCount: status.guildCount,
      memberCount: status.memberCount,
      lastHeartbeat: status.lastHeartbeat,
      ownerName: status.ownerName ?? null,
      ownerAvatarUrl: status.ownerAvatarUrl ?? null,
    };
  },
});
