export interface GuildSummary {
  discordId: string;
  name: string;
  icon: string | null;
  memberCount: number | null;
  prefix: string;
  antinukeEnabled: boolean;
  botInGuild: boolean;
  lastHeartbeat: number | null;
}

export interface MeData {
  user: {
    discordId: string;
    username: string;
    globalName: string | null;
    avatar: string | null;
  };
  guilds: GuildSummary[];
  botOnline: boolean;
  botGuildCount: number;
  botMemberCount: number;
}

import type { GenericId } from "convex/values";

export interface AutoReply {
  _id: GenericId<"autoReplies">;
  name: string;
  triggerType: "keyword" | "mention";
  keywords: string[];
  response: string;
  channels: string[];
  cooldownSeconds: number;
  enabled: boolean;
  createdAt: number;
}

/** Hành động bot có thể thực thi khi một module phát hiện vi phạm (chọn nhiều). */
export type ModuleAction =
  | "warn"
  | "kick"
  | "ban"
  | "timeout"
  | "deleteMessages"
  | "purgeMessages";

/** Mức chi tiết thông báo sau khi bot trừng phạt thành viên (Moderation). */
export type PunishNoticeLevel = "none" | "action" | "reason" | "full";

export interface ModuleConfig {
  module: string;
  enabled: boolean;
  threshold: number;
  windowSeconds: number;
  /** Hình thức xử lý chính (mạnh nhất trong actions) — giữ tương thích dữ liệu cũ. */
  punish: "warn" | "kick" | "ban" | "timeout";
  /**
   * Danh sách hành động kết hợp: hình phạt thành viên (warn/kick/ban/timeout)
   * + dọn tin nhắn (deleteMessages = xóa ngay tin phát hiện, purgeMessages =
   * xóa hàng loạt mọi tin liên quan vụ vi phạm).
   */
  actions?: ModuleAction[];
  timeoutSeconds?: number;
  whitelistRoles: string[];
  /** Điểm nhiệt cộng mỗi lần vi phạm (hệ thống nhiệt độ). */
  heat: number;
}

export interface HeatState {
  userId: string;
  username: string;
  heat: number;
  updatedAt: number;
  /** Warn tích lũy hiện tại (0 nếu không có). */
  warnStrikes: number;
}

export interface ChannelInfo {
  channelId: string;
  name: string;
  type: number;
}

export interface AntiNukeEvent {
  module: string;
  executorId: string | null;
  executorName: string | null;
  action: string;
  count: number;
  threshold: number;
  windowSeconds: number;
  punish: string;
  createdAt: number;
}

export interface RoleInfo {
  roleId: string;
  name: string;
  color: number;
  position: number;
}

export interface GuildData {
  guild: {
    discordId: string;
    name: string;
    icon: string | null;
    memberCount: number | null;
    prefix: string;
    logChannelId: string | null;
    /** Kênh log moderation — GỘP CHUNG auto-mod + lệnh mod thủ công (kiểu Carl-bot: Offender / Reason / Responsible moderator). */
    modLogChannelId: string | null;
    /** Kênh gửi thông báo sau khi bot trừng phạt thành viên (Moderation). */
    punishNoticeChannelId: string | null;
    /** Mức chi tiết thông báo theo từng hành động ban/timeout/kick/warn. */
    punishNotice: Record<string, PunishNoticeLevel>;
    /** Whitelist của riêng server này — người dùng được miễn trừ moderation / anti-raid / nuke (không chia sẻ sang server khác). */
    whitelistUsers: string[];
    /** Whitelist của riêng server này — role được miễn trừ moderation / anti-raid / nuke (không chia sẻ sang server khác). */
    whitelistRoles: string[];
    modRoles: string[];
    adminRoles: string[];
    antinukeEnabled: boolean;
    botInGuild: boolean;
    lastHeartbeat: number | null;
    lockdownEnabled: boolean;
    lockdownMinutes: number;
    lockdownUntil: number | null;
    lockdownRequested: boolean;
    dailyReportEnabled: boolean;
    lastReportAt: number | null;
    badWords: string[];
    heatEnabled: boolean;
    heatDecayPerMin: number;
    heatWarnAt: number;
    heatTimeoutAt: number;
    heatKickAt: number;
    heatBanAt: number;
    joinGateEnabled: boolean;
    joinGateMinAgeDays: number;
    joinGateRequireAvatar: boolean;
    joinGateRequireFlag: boolean;
    joinGateRaidKick: boolean;
    joinGatePunish: "kick" | "ban";
    joinGateWhitelist: string[];
    heatRepeatMultiplier: number;
    heatRepeatWindowMin: number;
    warnStrikeLimit: number;
    warnStrikeWindowMin: number;
    warnStrikePunish: "timeout" | "kick" | "ban";
    safetyPercent: number;
    hiddenPasswordSet: boolean;
    /** Người đang đăng nhập có phải admin sở hữu bot không (quyền tính năng ẩn). */
    isBotOwner: boolean;
    /** Đã xác định được chủ sở hữu bot chưa. */
    botOwnerSet: boolean;
    /** Chủ đề màu riêng của server (key trong SERVER_THEMES). */
    theme: string;
    /** Tự động backup: số ngày giữa 2 lần (0 = tắt, 2-30 = bật). */
    backupAutoDays: number;
    /** Lần backup thành công gần nhất (ms epoch) hoặc null. */
    lastBackupAt: number | null;
    /** Khôi phục role khi restore backup (áp dụng cho backup Protogon lẫn file bot nuke). */
    restoreRolesEnabled: boolean;
    /** Khôi phục emoji/sticker khi restore backup (áp dụng cho backup Protogon lẫn file bot nuke). */
    restoreEmojisEnabled: boolean;
    /** Raid Intel: bật săn lùng nguồn cơn raid (phân tích cụm + audit log). */
    raidHuntEnabled: boolean;
    /** Raid Intel: tự ban tài khoản nghi là nguồn cơn raid khi đủ tín hiệu. */
    raidHuntBanSuspects: boolean;
    /** Verify system: bật xác minh thành viên khi vào server. */
    verifyEnabled: boolean;
    verifyMethod: "button" | "captcha";
    verifyChannelId: string | null;
    unverifiedRoleId: string | null;
    verifiedRoleId: string | null;
    /** Verify welcome DM: gửi embed chào mừng qua DM sau khi verify thành công. */
    verifyWelcomeEnabled: boolean;
    verifyWelcomeTitle: string | null;
    verifyWelcomeDescription: string | null;
    verifyWelcomeColor: string | null;
    verifySendPanel: boolean;
  };
  heatStates: HeatState[];
  autoReplies: AutoReply[];
  modules: ModuleConfig[];
  channels: ChannelInfo[];
  roles: RoleInfo[];
  panels: ReactionRolePanel[];
  giveaways: Giveaway[];
  modActions: ModAction[];
}

export interface ReactionRolePanel {
  _id: GenericId<"reactionRolePanels">;
  channelId: string;
  label: string;
  /** Nội dung / mô tả hiển thị trong embed (null = dùng mặc định). */
  description: string | null;
  /** Ảnh thumbnail hiển thị góc phải embed. */
  thumbnailUrl: string | null;
  entries: { emoji: string; roleId: string }[];
  messageId: string;
  enabled: boolean;
  createdAt: number;
}

export interface ModAction {
  _id: GenericId<"modActions">;
  action: string;
  targetId: string | null;
  targetName: string | null;
  executorId: string | null;
  executorName: string | null;
  reason: string | null;
  details: string | null;
  /** Số case tăng dần của server (kiểu Carl-bot, ví dụ "warn | case 30"). */
  caseNumber: number | null;
  createdAt: number;
}

export interface BackupInfo {
  _id: GenericId<"guildBackups">;
  /** Discord ID của server gốc đã được backup. */
  guildId: string;
  guildName: string;
  createdAt: number;
  roleCount: number;
  channelCount: number;
  /** Số emoji đã backup (khôi phục lại được khi restore). */
  emojiCount?: number;
  /** Số sticker đã backup (khôi phục lại được khi restore). */
  stickerCount?: number;
  /** Số tin nhắn đã backup (0 = không kèm tin). */
  messageCount?: number;
  /** Nguồn backup: "backup" (bot tự chụp) | "import" (tải file .msc/.json lên). */
  source?: string;
  githubUrl: string | null;
  pushedToGithub: boolean;
}

/** Raid Intel — dữ liệu thu thập + kết quả săn nguồn cơn raid của một server. */
export interface RaidIntel {
  huntEnabled: boolean;
  banSuspects: boolean;
  /** Tổng số mẫu raid/nuke đã thu thập (dữ liệu huấn luyện). */
  count: number;
  recent: {
    module: string;
    createdAt: number;
    count: number;
    action: string | null;
    aiClassification: string | null;
    aiConfidence: number | null;
    aiReason: string | null;
    punishedCount: number | null;
    lockdownTriggered: boolean;
    clusterMemberCount: number | null;
    suspectedSourceName: string | null;
    banned: boolean;
    reason: string | null;
  }[];
}

/** Một vụ raid bằng ứng dụng ngoài (External App Guard) đã bị bot chặn. */
export interface ExternalAppRaidIncident {
  createdAt: number;
  count: number;
  windowSeconds: number;
  threshold: number;
  action: string | null;
  punish: string | null;
  aiClassification: string | null;
  aiConfidence: number | null;
  aiReason: string | null;
  lockdownTriggered: boolean;
  /** Các app ngoài được kết nối trong vụ (app gì + ai kết nối). */
  apps: { appName: string | null; executorName: string | null; executorId: string | null }[];
  /** Người dùng đã bị xử lý trong vụ (ai + hình thức xử lý). */
  punished: { userId: string | null; username: string | null; action: string | null }[];
  suspectedSourceName: string | null;
  banned: boolean;
  reason: string | null;
}

export interface Giveaway {
  _id: GenericId<"giveaways">;
  channelId: string;
  title: string;
  prize: string;
  winnerCount: number;
  durationMinutes: number;
  endsAt: number;
  dmWinners: boolean;
  requiredRoleId: string | null;
  prizeRoleId: string | null;
  template: string;
  message: string | null;
  imageUrl: string | null;
  endMessage: string | null;
  status: "active" | "ended" | "cancelled";
  messageId: string;
  entriesCount: number;
  winners: { userId: string; username: string }[];
  createdAt: number;
}
