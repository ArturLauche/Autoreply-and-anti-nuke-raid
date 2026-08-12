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
  massWebhookCreate: {
    label: "Tạo webhook hàng loạt",
    description: "Phát hiện spam tạo webhook (kênh đăng webhook giả để phá server)",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
    defaultHeat: 25,
  },
  massThreadCreate: {
    label: "Tạo thread hàng loạt",
    description: "Phát hiện spam tạo thread (forum/thread nhiễu loạn)",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
    defaultHeat: 25,
  },
  massMessage: {
    label: "Spam tin dài / lặp nội dung",
    description: "Phát hiện spam tin nhắn cực dài hoặc lặp lại nội dung giống hệt — AI phân biệt raid hay cá nhân",
    defaultThreshold: 4,
    defaultWindowSeconds: 15,
    defaultPunish: "timeout",
    defaultHeat: 15,
  },
  blankNoise: {
    label: "Tin giả blank gây nhiễu",
    description: "Phát hiện tin nhắn chỉ gồm khoảng trắng / ký tự ẩn (zero-width) gây nhiễu kênh",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "timeout",
    defaultHeat: 15,
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
  malware: {
    label: "Chống link độc hại & file nguy hiểm",
    description:
      "Chặn domain lừa đảo (nitro giả, gift giả…), link IP và file đuôi nguy hiểm (.exe, .scr, .bat…)",
    defaultThreshold: 1,
    defaultWindowSeconds: 10,
    defaultPunish: "warn",
    defaultHeat: 15,
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
  "massWebhookCreate",
  "massThreadCreate",
  "spam",
  "massMessage",
  "blankNoise",
  "mention",
  "badword",
  "attachment",
  "invite",
  "malware",
] as const;

/** Nhóm module chống nuke / raid (sự kiện cấu trúc server) — phạt trực tiếp, không nhiệt. */
export const NUKE_MODULES = [
  "massBan",
  "massKick",
  "massJoin",
  "massChannelCreate",
  "massChannelDelete",
  "massRoleCreate",
  "massRoleDelete",
  "massMessageDelete",
  "massWebhookCreate",
  "massThreadCreate",
] as const;

/** Nhóm module moderation nội dung (tin nhắn & đính kèm) — có hệ thống nhiệt. */
export const MODERATION_MODULES = [
  "spam",
  "massMessage",
  "blankNoise",
  "mention",
  "badword",
  "attachment",
  "invite",
  "malware",
] as const;

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
  repeatMultiplier: 2,
  repeatWindowMin: 30,
} as const;

/** Giá trị mặc định cho warn tích lũy (tăng cấp sau N lần cảnh báo). */
export const WARN_STRIKE_DEFAULTS = {
  limit: 3,
  windowMin: 60,
  punish: "timeout" as const,
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

/** Chủ đề màu riêng cho web của từng server (chọn trong Cài đặt). */
export interface ServerTheme {
  label: string;
  desc: string;
  /** HSL triplet cho CSS var --primary */
  primary: string;
  /** HSL triplet cho --ring */
  ring: string;
  /** Màu hiển thị cho ô chọn */
  swatch: string;
  swatch2: string;
}

export const SERVER_THEMES: Record<string, ServerTheme> = {
  pink: {
    label: "Hồng anh đào",
    desc: "Mặc định — hồng sakura ấm áp",
    primary: "342 92% 60%",
    ring: "342 92% 62%",
    swatch: "#f2629e",
    swatch2: "#ff9dbd",
  },
  rose: {
    label: "Hồng đỏ",
    desc: "Nổi bật, quyết đoán",
    primary: "336 85% 56%",
    ring: "336 90% 58%",
    swatch: "#e5487d",
    swatch2: "#ff7aa8",
  },
  orange: {
    label: "Cam hoàng hôn",
    desc: "Ấm áp, năng động",
    primary: "24 95% 56%",
    ring: "24 95% 58%",
    swatch: "#f97316",
    swatch2: "#ffb27a",
  },
  amber: {
    label: "Vàng hổ phách",
    desc: "Rực rỡ, may mắn",
    primary: "42 96% 52%",
    ring: "42 96% 54%",
    swatch: "#f5a623",
    swatch2: "#ffd166",
  },
  green: {
    label: "Xanh lá cây",
    desc: "Tươi mát, yên bình",
    primary: "152 72% 42%",
    ring: "152 80% 44%",
    swatch: "#1f9d63",
    swatch2: "#7bd6a8",
  },
  teal: {
    label: "Xanh ngọc",
    desc: "Dịu mát, hiện đại",
    primary: "174 84% 36%",
    ring: "174 90% 38%",
    swatch: "#0e9f9f",
    swatch2: "#6fd8d8",
  },
  sky: {
    label: "Xanh trời",
    desc: "Trong trẻo, thoáng đãng",
    primary: "207 96% 56%",
    ring: "207 96% 58%",
    swatch: "#2f9ff5",
    swatch2: "#8ccbff",
  },
  violet: {
    label: "Tím oải hương",
    desc: "Huyền bí, thanh lịch",
    primary: "262 86% 62%",
    ring: "262 90% 64%",
    swatch: "#8b5cf6",
    swatch2: "#c4b0ff",
  },
};

export const DEFAULT_THEME = "pink";
