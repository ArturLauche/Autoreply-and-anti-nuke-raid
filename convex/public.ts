"use node";

/// <reference types="node" />

/** Minimal env typing so this file also type-checks from the Vite app. */
declare const process: {
  env: Record<string, string | undefined>;
};

import { action } from "./_generated/server";

/**
 * Reads non-secret public config from the environment. Only actions run on
 * Node.js, so this is an action rather than a query.
 */
export const publicConfig = action({
  args: {},
  handler: () => ({
    clientId: process.env.DISCORD_CLIENT_ID ?? "",
    discordInvite: process.env.DISCORD_INVITE ?? "https://discord.gg/rftv",
    facebookUrl:
      process.env.FACEBOOK_URL ??
      "https://www.facebook.com/profile.php?id=61592820547312",
  }),
});
