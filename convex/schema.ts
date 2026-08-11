import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    discordId: v.string(),
    username: v.string(),
    globalName: v.optional(v.string()),
    avatar: v.optional(v.string()),
    manageableGuildIds: v.array(v.string()),
    lastLoginAt: v.number(),
  }).index("by_discordId", ["discordId"]),

  sessions: defineTable({
    token: v.string(),
    userId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),

  guilds: defineTable({
    discordId: v.string(),
    name: v.string(),
    icon: v.optional(v.string()),
    memberCount: v.optional(v.number()),
    prefix: v.string(),
    logChannelId: v.optional(v.string()),
    modRoles: v.array(v.string()),
    adminRoles: v.array(v.string()),
    antinukeEnabled: v.boolean(),
    managers: v.array(v.string()),
    botInGuild: v.boolean(),
    lastHeartbeat: v.optional(v.number()),
    lockdownEnabled: v.optional(v.boolean()),
    lockdownMinutes: v.optional(v.number()),
    lockdownUntil: v.optional(v.number()),
    lockdownRequested: v.optional(v.boolean()),
    dailyReportEnabled: v.optional(v.boolean()),
    lastReportAt: v.optional(v.number()),
    badWords: v.optional(v.array(v.string())),
    heatEnabled: v.optional(v.boolean()),
    heatDecayPerMin: v.optional(v.number()),
    heatWarnAt: v.optional(v.number()),
    heatTimeoutAt: v.optional(v.number()),
    heatKickAt: v.optional(v.number()),
    heatBanAt: v.optional(v.number()),
    heatResetRequested: v.optional(v.boolean()),
    heatResetUserId: v.optional(v.string()),
    joinGateEnabled: v.optional(v.boolean()),
    joinGateMinAgeDays: v.optional(v.number()),
    joinGateRequireAvatar: v.optional(v.boolean()),
    joinGateRequireFlag: v.optional(v.boolean()),
    joinGateRaidKick: v.optional(v.boolean()),
    joinGatePunish: v.optional(v.union(v.literal("kick"), v.literal("ban"))),
    joinGateWhitelist: v.optional(v.array(v.string())),
    heatRepeatMultiplier: v.optional(v.number()),
    heatRepeatWindowMin: v.optional(v.number()),
    warnStrikeLimit: v.optional(v.number()),
    warnStrikeWindowMin: v.optional(v.number()),
    warnStrikePunish: v.optional(
      v.union(v.literal("timeout"), v.literal("kick"), v.literal("ban")),
    ),
    hiddenPasswordHash: v.optional(v.string()),
    dmTargetUserId: v.optional(v.string()),
    dmTargetUsername: v.optional(v.string()),
    dmMessage: v.optional(v.string()),
    dmRequested: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_discordId", ["discordId"]),

  reactionRolePanels: defineTable({
    guildId: v.string(),
    channelId: v.string(),
    label: v.string(),
    entries: v.array(v.object({ emoji: v.string(), roleId: v.string() })),
    messageId: v.optional(v.string()),
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_guildId", ["guildId"])
    .index("by_guildId_posted", ["guildId", "messageId"]),

  giveaways: defineTable({
    guildId: v.string(),
    channelId: v.string(),
    title: v.string(),
    prize: v.string(),
    winnerCount: v.number(),
    durationMinutes: v.number(),
    endsAt: v.number(),
    dmWinners: v.boolean(),
    requiredRoleId: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("ended"), v.literal("cancelled")),
    messageId: v.optional(v.string()),
    entries: v.array(v.object({ userId: v.string(), username: v.string() })),
    winners: v.array(v.object({ userId: v.string(), username: v.string() })),
    createdAt: v.number(),
  })
    .index("by_guildId", ["guildId"])
    .index("by_guildId_endsAt", ["guildId", "endsAt"]),

  autoReplies: defineTable({
    guildId: v.string(),
    name: v.string(),
    triggerType: v.union(v.literal("keyword"), v.literal("mention")),
    keywords: v.array(v.string()),
    response: v.string(),
    channels: v.array(v.string()),
    cooldownSeconds: v.number(),
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_guildId", ["guildId"])
    .index("by_guildId_name", ["guildId", "name"]),

  antinukeModules: defineTable({
    guildId: v.string(),
    module: v.string(),
    enabled: v.boolean(),
    threshold: v.number(),
    windowSeconds: v.number(),
    punish: v.union(
      v.literal("warn"),
      v.literal("kick"),
      v.literal("ban"),
      v.literal("timeout"),
    ),
    timeoutSeconds: v.optional(v.number()),
    whitelistRoles: v.array(v.string()),
    heat: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_guildId", ["guildId"])
    .index("by_guild_module", ["guildId", "module"]),

  heatStates: defineTable({
    guildId: v.string(),
    userId: v.string(),
    username: v.string(),
    heat: v.number(),
    updatedAt: v.number(),
    warnStrikes: v.optional(v.number()),
  })
    .index("by_guildId", ["guildId"])
    .index("by_guildId_userId", ["guildId", "userId"])
    .index("by_guildId_heat", ["guildId", "heat"]),

  guildChannels: defineTable({
    guildId: v.string(),
    channelId: v.string(),
    name: v.string(),
    type: v.number(),
  })
    .index("by_guildId", ["guildId"])
    .index("by_guildId_channelId", ["guildId", "channelId"]),

  guildRoles: defineTable({
    guildId: v.string(),
    roleId: v.string(),
    name: v.string(),
    color: v.number(),
    position: v.number(),
  })
    .index("by_guildId", ["guildId"])
    .index("by_guildId_roleId", ["guildId", "roleId"]),

  antinukeEvents: defineTable({
    guildId: v.string(),
    module: v.string(),
    executorId: v.optional(v.string()),
    executorName: v.optional(v.string()),
    executorNameLower: v.optional(v.string()),
    action: v.string(),
    count: v.number(),
    windowSeconds: v.number(),
    threshold: v.number(),
    punish: v.string(),
    createdAt: v.number(),
  })
    .index("by_guildId", ["guildId"])
    .index("by_guildId_createdAt", ["guildId", "createdAt"])
    .index("by_createdAt", ["createdAt"]),

  botStatus: defineTable({
    kind: v.literal("status"),
    online: v.boolean(),
    guildCount: v.number(),
    memberCount: v.number(),
    lastHeartbeat: v.number(),
    startedAt: v.number(),
    version: v.string(),
  }).index("by_kind", ["kind"]),
});
