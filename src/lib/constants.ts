export type TriggerType = "keyword" | "mention";

export interface ModuleMeta {
  label: string;
  description: string;
  defaultThreshold: number;
  defaultWindowSeconds: number;
  defaultPunish: "warn" | "kick" | "ban" | "timeout";
}

export const ANTINUKE_MODULE_META: Record<string, ModuleMeta> = {
  massBan: {
    label: "Ban hàng loạt",
    description: "Phát hiện nhiều lượt ban trong thời gian ngắn",
    defaultThreshold: 5,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
  },
  massKick: {
    label: "Kick hàng loạt",
    description: "Phát hiện nhiều lượt kick thành viên",
    defaultThreshold: 5,
    defaultWindowSeconds: 10,
    defaultPunish: "kick",
  },
  massJoin: {
    label: "Raid thành viên",
    description: "Phát hiện làn sóng thành viên giả mạo tham gia ồ ạt",
    defaultThreshold: 8,
    defaultWindowSeconds: 10,
    defaultPunish: "kick",
  },
  massChannelCreate: {
    label: "Tạo kênh hàng loạt",
    description: "Phát hiện spam tạo kênh mới",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
  },
  massChannelDelete: {
    label: "Xóa kênh hàng loạt",
    description: "Phát hiện spam xóa kênh",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
  },
  massRoleCreate: {
    label: "Tạo role hàng loạt",
    description: "Phát hiện spam tạo role mới",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
  },
  massRoleDelete: {
    label: "Xóa role hàng loạt",
    description: "Phát hiện spam xóa role",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
  },
  massMessageDelete: {
    label: "Xóa tin nhắn hàng loạt",
    description: "Phát hiện quét sạch kênh (bulk delete / nuke channel)",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "warn",
  },
  spam: {
    label: "Chống spam tin nhắn",
    description: "Phát hiện thành viên gửi quá nhiều tin nhắn trong thời gian ngắn",
    defaultThreshold: 6,
    defaultWindowSeconds: 10,
    defaultPunish: "timeout",
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
] as const;

export const PUNISH_LABEL: Record<string, string> = {
  warn: "Cảnh báo",
  kick: "Kick",
  ban: "Ban",
  timeout: "Tạm khóa (timeout)",
};

export const CHANNEL_TYPE_LABEL: Record<number, string> = {
  0: "Văn bản",
  2: "Thoại",
  4: "Danh mục",
  5: "Thông báo",
  13: "Sân khấu",
  15: "Diễn đàn",
};
