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
    /** Kênh log moderation: auto-mod + lệnh mod thủ công (ban/timeout/kick/warn + ngược lại, purge) kiểu Carl-bot. */
    modLogChannelId: v.optional(v.string()),
    /** Số case moderation đã tăng dần của server (hiển thị "case N" trong log kiểu Carl-bot). */
    modCaseCounter: v.optional(v.number()),
    /** Kênh gửi thông báo sau khi bot trừng phạt thành viên (Moderation). */
    punishNoticeChannelId: v.optional(v.string()),
    /** Mức chi tiết thông báo theo từng hành động ban/timeout/kick/warn. */
    punishNotice: v.optional(
      v.object({
        ban: v.string(),
        timeout: v.string(),
        kick: v.string(),
        warn: v.string(),
      }),
    ),
    /** Backup server: cờ bot cần tạo backup. */
    backupRequested: v.optional(v.boolean()),
    backupPushToGithub: v.optional(v.boolean()),
    /** Khóa chống lặp: bot nào claim được thì mới được chạy (2 phút). */
    backupClaimedAt: v.optional(v.number()),
    /** Backup server: cờ bot cần khôi phục + id backup dùng để khôi phục. */
    restoreRequested: v.optional(v.boolean()),
    restoreBackupId: v.optional(v.id("guildBackups")),
    restoreClaimedAt: v.optional(v.number()),
    /** Tự động backup: số ngày giữa 2 lần (2-30, 0 = tắt). */
    backupAutoDays: v.optional(v.number()),
    /** Lần backup thành công gần nhất (dùng cho lịch tự động). */
    lastBackupAt: v.optional(v.number()),
    /** Whitelist toàn cục: user/role được miễn trừ khỏi moderation, anti-raid và nuke. */
    whitelistUsers: v.optional(v.array(v.string())),
    whitelistRoles: v.optional(v.array(v.string())),
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
    /** Chủ đề màu riêng cho web của server (key trong SERVER_THEMES). */
    theme: v.optional(v.string()),
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
    /** Nội dung / mô tả hiển thị trong embed (mặc định nếu bỏ trống). */
    description: v.optional(v.string()),
    /** Ảnh thumbnail hiển thị góc phải embed. */
    thumbnailUrl: v.optional(v.string()),
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
    /** Role tự cấp cho người thắng khi giveaway kết thúc. */
    prizeRoleId: v.optional(v.string()),
    /** Mẫu tin nhắn: default | luxury | vip | simple. */
    template: v.optional(v.string()),
    /** Lời dẫn / nội dung tùy chỉnh thay cho mẫu. */
    message: v.optional(v.string()),
    /** Ảnh nền chèn vào embed. */
    imageUrl: v.optional(v.string()),
    /** Lời chúc mừng tùy chỉnh khi kết thúc. */
    endMessage: v.optional(v.string()),
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
    /** Hành động kết hợp: warn/kick/ban/timeout + deleteMessages/purgeMessages. */
    actions: v.optional(v.array(v.string())),
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

  modActions: defineTable({
    guildId: v.string(),
    action: v.string(),
    targetId: v.optional(v.string()),
    targetName: v.optional(v.string()),
    executorId: v.optional(v.string()),
    executorName: v.optional(v.string()),
    reason: v.optional(v.string()),
    details: v.optional(v.string()),
    /** Số case tăng dần của server (kiểu Carl-bot). */
    caseNumber: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_guildId", ["guildId"])
    .index("by_guildId_createdAt", ["guildId", "createdAt"]),

  guildBackups: defineTable({
    guildId: v.string(),
    guildName: v.string(),
    /** JSON cấu trúc server: roles (tên/màu/quyền) + channels (kênh/quyền kênh). */
    backupJson: v.string(),
    roleCount: v.number(),
    channelCount: v.number(),
    /** URL gist GitHub nếu backup đã được đẩy lên đám mây. */
    githubUrl: v.optional(v.string()),
    pushedToGithub: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_guildId", ["guildId"])
    .index("by_guildId_createdAt", ["guildId", "createdAt"]),

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
    /** Discord ID của admin sở hữu bot (người duy nhất được phép mở khóa tính năng ẩn). */
    ownerDiscordId: v.optional(v.string()),
    /** Avatar bot hiển thị trên web (logo, quản lý…). */
    botAvatarUrl: v.optional(v.string()),
    /** Avatar trợ lý AI Haimiya-senpai hiển thị trên web. */
    haimiyaAvatarUrl: v.optional(v.string()),
    /** Tên chủ bot (bot tự lấy từ Discord mỗi lần sync — cập nhật 24/7). */
    ownerName: v.optional(v.string()),
    /** Avatar chủ bot (bot tự lấy từ Discord mỗi lần sync — cập nhật 24/7). */
    ownerAvatarUrl: v.optional(v.string()),
  }).index("by_kind", ["kind"]),
});
