export type TriggerType = "keyword" | "mention";

export interface ModuleMeta {
  label: string;
  description: string;
  defaultThreshold: number;
  defaultWindowSeconds: number;
  defaultPunish: "warn" | "kick" | "ban" | "timeout";
  /** Điểm nhiệt mặc định mỗi lần vi phạm. */
  defaultHeat: number;
}

export const ANTINUKE_MODULE_META: Record<string, ModuleMeta> = {
  massBan: {
    label: "Ban hàng loạt",
    description: "Phát hiện nhiều lượt ban trong thời gian ngắn",
    defaultThreshold: 5,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
    defaultHeat: 25,
  },
  massKick: {
    label: "Kick hàng loạt",
    description: "Phát hiện nhiều lượt kick thành viên",
    defaultThreshold: 5,
    defaultWindowSeconds: 10,
    defaultPunish: "kick",
    defaultHeat: 20,
  },
  massJoin: {
    label: "Raid thành viên",
    description: "Phát hiện làn sóng thành viên giả mạo tham gia ồ ạt",
    defaultThreshold: 8,
    defaultWindowSeconds: 10,
    defaultPunish: "kick",
    defaultHeat: 15,
  },
  massChannelCreate: {
    label: "Tạo kênh hàng loạt",
    description: "Phát hiện spam tạo kênh mới",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
    defaultHeat: 25,
  },
  massChannelDelete: {
    label: "Xóa kênh hàng loạt",
    description: "Phát hiện spam xóa kênh",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
    defaultHeat: 25,
  },
  massRoleCreate: {
    label: "Tạo role hàng loạt",
    description: "Phát hiện spam tạo role mới",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
    defaultHeat: 25,
  },
  massRoleDelete: {
    label: "Xóa role hàng loạt",
    description: "Phát hiện spam xóa role",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
    defaultHeat: 25,
  },
  massMessageDelete: {
    label: "Xóa tin nhắn hàng loạt",
    description: "Phát hiện quét sạch kênh (bulk delete / nuke channel)",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "warn",
    defaultHeat: 20,
  },
  spam: {
    label: "Chống spam tin nhắn",
    description: "Phát hiện thành viên gửi quá nhiều tin nhắn trong thời gian ngắn",
    defaultThreshold: 6,
    defaultWindowSeconds: 10,
    defaultPunish: "timeout",
    defaultHeat: 10,
  },
  mention: {
    label: "Chống spam mention",
    description: "Phát hiện spam tag người/role/kênh liên tục trong thời gian ngắn",
    defaultThreshold: 10,
    defaultWindowSeconds: 10,
    defaultPunish: "timeout",
    defaultHeat: 15,
  },
  badword: {
    label: "Lọc từ ngữ xấu",
    description: "Tự động xóa tin nhắn chứa từ trong danh sách từ ngữ xấu của server",
    defaultThreshold: 1,
    defaultWindowSeconds: 10,
    defaultPunish: "warn",
    defaultHeat: 10,
  },
  attachment: {
    label: "Chống spam ảnh & file",
    description: "Phát hiện spam ảnh, file đính kèm liên tục trong thời gian ngắn",
    defaultThreshold: 5,
    defaultWindowSeconds: 10,
    defaultPunish: "timeout",
    defaultHeat: 15,
  },
  invite: {
    label: "Chặn link mời Discord",
    description: "Xóa tin nhắn chứa link mời discord.gg / discord.com/invite",
    defaultThreshold: 1,
    defaultWindowSeconds: 10,
    defaultPunish: "warn",
    defaultHeat: 20,
  },
};

export const ANTINUKE_ORDER = [
  "massBan",
  "massKick",
  "massJoin",
  "massChannelCreate",
  "massChannelDelete",
  "massRoleCreate",
  "massRoleDelete",
  "massMessageDelete",
  "spam",
  "mention",
  "badword",
  "attachment",
  "invite",
] as const;

/** Nhóm module chống nuke / raid (sự kiện cấu trúc server). */
export const NUKE_MODULES = [
  "massBan",
  "massKick",
  "massJoin",
  "massChannelCreate",
  "massChannelDelete",
  "massRoleCreate",
  "massRoleDelete",
  "massMessageDelete",
] as const;

/** Nhóm module moderation nội dung (tin nhắn & đính kèm). */
export const MODERATION_MODULES = ["spam", "mention", "badword", "attachment", "invite"] as const;

export const PUNISH_LABEL: Record<string, string> = {
  warn: "Cảnh báo",
  kick: "Kick",
  ban: "Ban",
  timeout: "Tạm khóa (timeout)",
};

/** Giá trị mặc định cho hệ thống nhiệt độ vi phạm. */
export const HEAT_DEFAULTS = {
  max: 100,
  enabled: true,
  decayPerMin: 3,
  warnAt: 25,
  timeoutAt: 40,
  kickAt: 70,
  banAt: 90,
} as const;

export const HEAT_TIER_LABEL: Record<string, string> = {
  warn: "Theo dõi",
  timeout: "Tạm khóa",
  kick: "Kick",
  ban: "Ban",
};

/** Tính phần trăm an toàn (100 - nhiệt cao nhất). */
export function safetyFromHeat(heat: number | undefined): number {
  return Math.max(0, Math.min(100, 100 - (heat ?? 0)));
}

export const CHANNEL_TYPE_LABEL: Record<number, string> = {
  0: "Văn bản",
  2: "Thoại",
  4: "Danh mục",
  5: "Thông báo",
  13: "Sân khấu",
  15: "Diễn đàn",
};
