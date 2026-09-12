"use node";

/// <reference types="node" />

/** Minimal env typing so this file also type-checks from the Vite app. */
declare const process: {
  env: Record<string, string | undefined>;
};

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { requireBotKey } from "./botAuth";

/**
 * Đẩy backup lên đám mây GitHub dưới dạng Gist riêng tư (không cần repo).
 * Cần biến GITHUB_TOKEN trong Keys của Convex (quyền "gist").
 * Được bot gọi sau khi lưu backup vào bảng guildBackups.
 */
export const githubPush = action({
  args: {
    guildId: v.string(),
    backupId: v.id("guildBackups"),
    backupJson: v.string(),
    guildName: v.optional(v.string()),
    /** Chìa khóa bot (botAuth) — chỉ bot có OWNER_SEED mới tính được. */
    botKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireBotKey(ctx, args.botKey);
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return { ok: false, error: "GITHUB_TOKEN chưa được cấu hình trong Keys" };
    }
    const label = (args.guildName || args.guildId).slice(0, 60);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `protogon-backup-${args.guildId}-${stamp}.json`;
    let res: Response;
    try {
      res = await fetch("https://api.github.com/gists", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "protogon-bot",
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          description: `Protogon backup: ${label} (${new Date().toISOString()})`,
          public: false,
          files: { [filename]: { content: args.backupJson } },
        }),
      });
    } catch (e) {
      return { ok: false, error: `Không kết nối được GitHub: ${(e as Error).message}` };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: `GitHub lỗi ${res.status}: ${text.slice(0, 200) || "xem log Convex"}`,
      };
    }
    const data = (await res.json()) as { html_url?: string };
    const url = data?.html_url;
    if (url) {
      await ctx.runMutation(api.bot_writes.botSetBackupGithub, {
        backupId: args.backupId,
        url,
      });
    }
    return { ok: true, url: url ?? null };
  },
});
