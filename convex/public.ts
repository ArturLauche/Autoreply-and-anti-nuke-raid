"use node";

/// <reference types="node" />

/** Minimal env typing so this file also type-checks from the Vite app. */
declare const process: {
  env: Record<string, string | undefined>;
};

import { action } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Reads non-secret public config from the environment. Only actions run on
 * Node.js, so this is an action rather than a query.
 *
 * FIX (15/09): web production Broken — DISCORD_CLIENT_ID chỉ được đặt trên
 * hosting tĩnh, KHÔNG có trên deployment Convex, nên clientId luôn trả "" →
 * nút đăng nhập Discord + chat Haimiya (đòi đăng nhập) chết theo.
 * Fallback: botStatus.botApplicationId — Application ID của bot do bootstrap
 * lưu khi bot online (chính là Client ID Discord; đây là thông tin công khai
 * của bot, không phải secret).
 */
export const publicConfig = action({
  args: {},
  handler: async (ctx) => {
    let clientId = process.env.DISCORD_CLIENT_ID ?? "";
    if (!clientId) {
      try {
        const status = await ctx.runQuery(internal.hidden.getBotStatusInternal);
        clientId = status?.botApplicationId ?? "";
      } catch {
        // Deployment chưa bootstrap bot → giữ rỗng, web hiển thị hướng dẫn cấu hình.
      }
    }
    return {
      clientId,
      discordInvite: process.env.DISCORD_INVITE ?? "https://discord.gg/rftv",
      facebookUrl:
        process.env.FACEBOOK_URL ?? "https://www.facebook.com/profile.php?id=61592820547312",
    };
  },
});
