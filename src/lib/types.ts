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

export interface ModuleConfig {
  module: string;
  enabled: boolean;
  threshold: number;
  windowSeconds: number;
  punish: "warn" | "kick" | "ban" | "timeout";
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
  createdAt: number;
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
