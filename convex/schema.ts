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
    /** Backup server: có kèm tin nhắn hay không (tối đa 50 tin/kênh). */
    backupIncludeMessages: v.optional(v.boolean()),
    /** Khôi phục từ file backup .msc/.json tải lên web (bot nuke khác). */
    importRestoreRequested: v.optional(v.boolean()),
    importFileName: v.optional(v.string()),
    /** File backup tải lên được giữ trong Convex file storage (tối đa 8 MB — chấp nhận cả media). */
    importStorageId: v.optional(v.id("_storage")),
    /** Lỗi xử lý file import gần nhất (bot báo lại — dashboard hiển thị thay vì im lặng). */
    importError: v.optional(v.string()),
    importErrorAt: v.optional(v.number()),
    /** Khóa chống lặp: bot nào claim được thì mới được chạy (2 phút). */
    backupClaimedAt: v.optional(v.number()),
    /** Backup server: cờ bot cần khôi phục + id backup dùng để khôi phục. */
    restoreRequested: v.optional(v.boolean()),
    restoreBackupId: v.optional(v.id("guildBackups")),
    restoreClaimedAt: v.optional(v.number()),
    /** Web bật/tắt khôi phục role khi restore (áp dụng cho backup Protogon lẫn file bot nuke). */
    restoreRolesEnabled: v.optional(v.boolean()),
    /** Web bật/tắt khôi phục emoji/sticker khi restore (áp dụng cho backup Protogon lẫn file bot nuke). */
    restoreEmojisEnabled: v.optional(v.boolean()),
    /** Web bật/tắt khôi phục kênh khi restore. */
    restoreChannelsEnabled: v.optional(v.boolean()),
    /** Web bật/tắt khôi phục tin nhắn khi restore. */
    restoreMessagesEnabled: v.optional(v.boolean()),
    /** Tự động backup: số ngày giữa 2 lần (2-30, 0 = tắt). */
    backupAutoDays: v.optional(v.number()),
    /** Lần backup thành công gần nhất (dùng cho lịch tự động). */
    lastBackupAt: v.optional(v.number()),
    /** Raid Intel: bật săn lùng nguồn cơn raid (phân tích cụm tài khoản + audit log). */
    raidHuntEnabled: v.optional(v.boolean()),
    /** Raid Intel: tự ban tài khoản nghi là nguồn cơn raid khi đủ tín hiệu. */
    raidHuntBanSuspects: v.optional(v.boolean()),
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
    /** Verify system: bật xác minh thành viên khi vào server. */
    verifyEnabled: v.optional(v.boolean()),
    /** Phương thức xác minh: "button" (bấm nút) hoặc "captcha" (nhập mã DM). */
    verifyMethod: v.optional(v.union(v.literal("button"), v.literal("captcha"))),
    verifyChannelId: v.optional(v.string()),
    unverifiedRoleId: v.optional(v.string()),
    verifiedRoleId: v.optional(v.string()),
    /** Verify welcome DM: gửi embed chào mừng qua DM sau khi verify thành công. */
    verifyWelcomeEnabled: v.optional(v.boolean()),
    verifyWelcomeTitle: v.optional(v.string()),
    verifyWelcomeDescription: v.optional(v.string()),
    verifyWelcomeColor: v.optional(v.string()),
    verifySendPanel: v.optional(v.boolean()),
    /** Alt account + VPN detection system. */
    altDetectionEnabled: v.optional(v.boolean()),
    vpnBlockEnabled: v.optional(v.boolean()),
    /** Tuổi tối thiểu (ngày) khi xét alt — tài khoản dưới ngưỡng này bị tăng riskScore. */
    altMinAgeDays: v.optional(v.number()),
    /** Ngưỡng riskScore tối đa được chấp nhận (vượt thì bị kick/ban). */
    altMaxRiskScore: v.optional(v.number()),
    /** Hình phạt cho alt account: kick | ban | timeout | verify (gán lại unverified role). */
    altPunish: v.optional(v.union(v.literal("kick"), v.literal("ban"), v.literal("timeout"), v.literal("verify"))),
    /** Timeout duration (phút) khi altPunish = timeout. */
    altTimeoutMinutes: v.optional(v.number()),
    /** Roles được miễn khỏi alt detection. */
    altWhitelistRoles: v.optional(v.array(v.string())),
    /** Users được miễn khỏi alt detection. */
    altWhitelistUsers: v.optional(v.array(v.string())),
    /** Phân tích tương đồng username: ngưỡng similarity (0-100) để link accounts. */
    altSimilarityThreshold: v.optional(v.number()),
    /** Thời gian cửa sổ (phút) — 2 account join trong khoảng này + similarity cao = alt suspects. */
    altJoinWindowMinutes: v.optional(v.number()),
    /** Chế độ kiểm tra VPN: strict (block) | warn (log only) | off. */
    altVpnMode: v.optional(v.union(v.literal("strict"), v.literal("warn"), v.literal("off"))),
    /** Chế độ an toàn: chỉ phạt khi có >= 2 bằng chứng độc lập (chống chặn nhầm). */
    altSafeMode: v.optional(v.boolean()),
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
    /** JSON cấu trúc server: roles (tên/màu/quyền) + channels (kênh/quyền kênh) + tin nhắn. */
    backupJson: v.string(),
    roleCount: v.number(),
    channelCount: v.number(),
    /** Số emoji đã backup (khôi phục lại được khi restore). */
    emojiCount: v.optional(v.number()),
    /** Số sticker đã backup (khôi phục lại được khi restore). */
    stickerCount: v.optional(v.number()),
    /** Số tin nhắn đã backup (0 = không kèm tin). */
    messageCount: v.optional(v.number()),
    /** Nguồn backup: "backup" (bot tự chụp) | "import" (tải file .msc/.json lên) | "clone" (sao chép từ server khác). */
    source: v.optional(v.string()),
    /** SHA-256 checksum của backup JSON (dùng cho incremental backup + xác minh). */
    backupChecksum: v.optional(v.string()),
    /** Có nén zlib không (true = compressed JSON). */
    backupCompressed: v.optional(v.boolean()),
    /** Có mã hóa AES-256-GCM không. */
    backupEncrypted: v.optional(v.boolean()),
    /** ID backup trước đó (dùng cho diff). */
    previousBackupId: v.optional(v.string()),
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

  /**
   * Raid Intel — dữ liệu huấn luyện bot + AI: mỗi vụ raid/nuke được xử lý
   * ghi lại một mẫu có cấu trúc (module, ngưỡng, cụm tài khoản, AI verdict,
   * kết quả săn nguồn cơn raid). Bot dùng để tự học nhận diện biến thể mới.
   */
  raidSamples: defineTable({
    guildId: v.string(),
    guildName: v.optional(v.string()),
    /** Module chính kích hoạt (massJoin, massBan, spam…). */
    module: v.string(),
    count: v.number(),
    windowSeconds: v.number(),
    threshold: v.number(),
    action: v.optional(v.string()),
    punish: v.optional(v.string()),
    /** AI Guard: classification (raid/individual/benign) + độ tin cậy + lý do. */
    aiClassification: v.optional(v.string()),
    aiConfidence: v.optional(v.number()),
    aiReason: v.optional(v.string()),
    lockdownTriggered: v.optional(v.boolean()),
    punishedCount: v.optional(v.number()),
    /** Hồ sơ cụm tài khoản trong vụ raid (dùng để huấn luyện nhận diện nguồn cơn). */
    clusterMemberCount: v.optional(v.number()),
    clusterAvgAccountAgeDays: v.optional(v.number()),
    clusterSharedAvatarCount: v.optional(v.number()),
    clusterJoinBurstSeconds: v.optional(v.number()),
    /** External App Guard: danh sách app được kết nối trong vụ (tên app + người kết nối). */
    apps: v.optional(
      v.array(
        v.object({
          appName: v.optional(v.string()),
          executorName: v.optional(v.string()),
          executorId: v.optional(v.string()),
        }),
      ),
    ),
    /** External App Guard: người dùng đã bị xử lý trong vụ (ban/kick/warn…). */
    punished: v.optional(
      v.array(
        v.object({
          userId: v.optional(v.string()),
          username: v.optional(v.string()),
          action: v.optional(v.string()),
        }),
      ),
    ),
    /** Kết quả săn lùng nguồn cơn raid. */
    sourceHunt: v.optional(
      v.object({
        suspectedSourceId: v.optional(v.string()),
        suspectedSourceName: v.optional(v.string()),
        reason: v.string(),
        banned: v.boolean(),
        confidence: v.number(),
      }),
    ),
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

  /** Audit log — ghi lại mọi thay đổi settings trên web. */
  auditLog: defineTable({
    guildId: v.string(),
    executorId: v.string(),
    executorName: v.optional(v.string()),
    action: v.string(),
    field: v.string(),
    oldValue: v.optional(v.string()),
    newValue: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_guildId", ["guildId"])
    .index("by_guildId_createdAt", ["guildId", "createdAt"]),

  /**
   * Webhook tùy chỉnh do bot tạo theo yêu cầu (log qua webhook): người dùng
   * chọn kênh, tên (kèm emoji động/tĩnh), avatar, màu embed, nội dung kèm và
   * loại sự kiện log. Bot thực hiện tạo/sửa/xóa trên Discord rồi báo lại.
   */
  guildWebhooks: defineTable({
    guildId: v.string(),
    /** Tên webhook (1-80 ký tự) — hỗ trợ emoji tĩnh lẫn động (<a:name:id>). */
    name: v.string(),
    channelId: v.string(),
    /** URL ảnh đại diện webhook (https). */
    avatarUrl: v.optional(v.string()),
    /** Màu embed ghi đè khi gửi log qua webhook (số 0-16777215). */
    color: v.optional(v.number()),
    /** Nội dung gửi kèm trước embed — placeholder {server} {time} {action}. */
    contentTemplate: v.optional(v.string()),
    /** Loại sự kiện nhận: "mod" (case log ban/kick/timeout/warn/purge…) | "general" (anti nuke/raid + log chung). */
    eventTypes: v.array(v.string()),
    enabled: v.boolean(),
    /** pending_create → ready → pending_update/pending_delete/error (bot xử lý). */
    status: v.union(
      v.literal("pending_create"),
      v.literal("ready"),
      v.literal("pending_update"),
      v.literal("pending_delete"),
      v.literal("error"),
    ),
    /** Web bấm "Gửi thử" → bot gửi 1 embed test rồi xóa cờ. */
    testRequested: v.optional(v.boolean()),
    webhookId: v.optional(v.string()),
    token: v.optional(v.string()),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_guildId", ["guildId"]),

  /** Member join records for alt detection — lưu lịch sử join + risk analysis. */
  memberJoins: defineTable({
    guildId: v.string(),
    userId: v.string(),
    username: v.string(),
    avatar: v.optional(v.string()),
    /** Discord account creation timestamp. */
    createdAt: v.number(),
    /** Discord public flags (USER_FLAGS). */
    flags: v.optional(v.number()),
    /** Thời gian bot ghi nhận join vào server. */
    joinedAt: v.number(),
    /** Điểm rủi ro tổng hợp (0-100). */
    riskScore: v.number(),
    /** Danh sách yếu tố rủi ro chi tiết. */
    riskFactors: v.array(v.string()),
    /** Số nhóm bằng chứng độc lập (0-7) — quyết định mức phạt, chống chặn nhầm. */
    strongSignals: v.optional(v.number()),
    /** IP có phải VPN/Proxy không. */
    isVPN: v.optional(v.boolean()),
    /** Quốc gia từ IP (nếu detect được). */
    ipCountry: v.optional(v.string()),
    /** Tổ chức/TISP từ IP. */
    ipOrg: v.optional(v.string()),
    /** Kết quả xử lý: kick/ban/timeout/verify/pass/warn. */
    action: v.optional(v.string()),
    /** Lý do xử lý chi tiết. */
    actionReason: v.optional(v.string()),
    /** ID account bị nghi là alt (nếu link được). */
    linkedUserId: v.optional(v.string()),
    /** Điểm tương đồng với account đã link (0-100). */
    similarityScore: v.optional(v.number()),
    /** Lần cập nhật cuối (vd: đánh dấu đã bị phạt). */
    updatedAt: v.optional(v.number()),
  })
    .index("by_guildId", ["guildId"])
    .index("by_guildId_joinedAt", ["guildId", "joinedAt"])
    .index("by_guildId_riskScore", ["guildId", "riskScore"]),
});
