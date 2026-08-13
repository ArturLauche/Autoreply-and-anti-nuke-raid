import type { ModuleAction, PunishNoticeLevel } from "./types";

export type TriggerType = "keyword" | "mention";

/**
 * Hình phạt thành viên — CHỌN 1 (bot dùng đúng hình phạt đã chọn).
 * Tách riêng khỏi nhóm dọn tin nhắn để tránh nhầm lẫn chọn ban + kick cùng lúc.
 */
export const MEMBER_PUNISH_OPTIONS: {
  value: ModuleAction;
  label: string;
  hint: string;
}[] = [
  { value: "warn", label: "Warn", hint: "Gửi cảnh báo riêng (DM) cho thành viên" },
  { value: "timeout", label: "Tạm khóa (timeout)", hint: "Khóa tạm thời (đặt thời lượng bên dưới)" },
  { value: "kick", label: "Kick", hint: "Đuổi thành viên khỏi server" },
  { value: "ban", label: "Ban", hint: "Cấm thành viên vĩnh viễn" },
];

/**
 * Hành động dọn tin nhắn — CHỌN NHIỀU (kết hợp được với nhau và với hình phạt).
 */
export const MESSAGE_CLEAN_OPTIONS: {
  value: ModuleAction;
  label: string;
  hint: string;
}[] = [
  {
    value: "deleteMessages",
    label: "Xóa tin phát hiện",
    hint: "Xóa ngay tin nhắn vi phạm tại thời điểm bot nhận ra vi phạm",
  },
  {
    value: "purgeMessages",
    label: "Purge toàn bộ tin liên quan",
    hint: "Xóa hàng loạt mọi tin nhắn liên quan đến vụ vi phạm (ví dụ: toàn bộ tin spam trong cửa sổ phát hiện)",
  },
];

/** Toàn bộ lựa chọn (hình phạt + dọn tin) — dùng để vẽ badge / kiểm tra nhanh. */
export const MODULE_ACTION_OPTIONS = [...MEMBER_PUNISH_OPTIONS, ...MESSAGE_CLEAN_OPTIONS];

/** Độ mạnh của hình phạt thành viên (ban > kick > timeout > warn). */
export const ACTION_STRENGTH: Record<string, number> = {
  warn: 1,
  timeout: 2,
  kick: 3,
  ban: 4,
};

/** Nhãn ngắn cho từng hành động. */
export const ACTION_LABEL: Record<string, string> = {
  warn: "Warn",
  timeout: "Tạm khóa",
  kick: "Kick",
  ban: "Ban",
  deleteMessages: "Xóa tin phát hiện",
  purgeMessages: "Purge tin liên quan",
};

/** Lấy hình phạt thành viên mạnh nhất trong danh sách hành động. */
export function strongestPunish(
  actions: readonly string[],
  fallback: "warn" | "kick" | "ban" | "timeout" = "warn",
): "warn" | "kick" | "ban" | "timeout" {
  const member = actions
    .filter((a): a is "warn" | "kick" | "ban" | "timeout" => ACTION_STRENGTH[a] != null)
    .sort((a, b) => ACTION_STRENGTH[b] - ACTION_STRENGTH[a]);
  return member[0] ?? fallback;
}

/** Hành động mặc định cho từng module — giữ nguyên hành vi hiện tại của bot. */
export const DEFAULT_MODULE_ACTIONS: Record<string, ModuleAction[]> = {
  massBan: ["ban"],
  massKick: ["kick"],
  massJoin: ["kick"],
  massChannelCreate: ["ban"],
  massChannelDelete: ["ban"],
  massRoleCreate: ["ban"],
  massRoleDelete: ["ban"],
  massMessageDelete: ["warn"],
  massWebhookCreate: ["ban"],
  massThreadCreate: ["ban"],
  massThreadDelete: ["ban"],
  massChannelRename: ["ban"],
  massChannelOverwrite: ["ban"],
  massRoleEdit: ["ban"],
  adminSelfGrant: ["ban"],
  massRoleAssign: ["kick"],
  massNickname: ["kick"],
  massEmoji: ["ban"],
  massBotAdd: ["kick"],
  massInviteCreate: ["ban"],
  guildTamper: ["ban"],
  spam: ["timeout"],
  massMessage: ["timeout", "deleteMessages"],
  blankNoise: ["timeout", "deleteMessages"],
  mention: ["timeout", "deleteMessages"],
  badword: ["warn", "deleteMessages"],
  attachment: ["timeout", "deleteMessages"],
  invite: ["warn", "deleteMessages"],
  malware: ["warn", "deleteMessages"],
};

export interface ModuleMeta {
  label: string;
  description: string;
  /** Nhóm hiển thị trên web (Chống nuke / Auto-mod). */
  group: string;
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
    group: "Thành viên & quyền",
    defaultThreshold: 5,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
    defaultHeat: 25,
  },
  massKick: {
    label: "Kick hàng loạt",
    description: "Phát hiện nhiều lượt kick thành viên",
    group: "Thành viên & quyền",
    defaultThreshold: 5,
    defaultWindowSeconds: 10,
    defaultPunish: "kick",
    defaultHeat: 20,
  },
  massJoin: {
    label: "Raid thành viên",
    description: "Phát hiện làn sóng thành viên giả mạo tham gia ồ ạt",
    group: "Thành viên & quyền",
    defaultThreshold: 8,
    defaultWindowSeconds: 10,
    defaultPunish: "kick",
    defaultHeat: 15,
  },
  massChannelCreate: {
    label: "Tạo kênh hàng loạt",
    description: "Phát hiện spam tạo kênh mới",
    group: "Kênh & thread",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
    defaultHeat: 25,
  },
  massChannelDelete: {
    label: "Xóa kênh hàng loạt",
    description: "Phát hiện spam xóa kênh",
    group: "Kênh & thread",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
    defaultHeat: 25,
  },
  massRoleCreate: {
    label: "Tạo role hàng loạt",
    description: "Phát hiện spam tạo role mới",
    group: "Role · Emoji · Server",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
    defaultHeat: 25,
  },
  massRoleDelete: {
    label: "Xóa role hàng loạt",
    description: "Phát hiện spam xóa role",
    group: "Role · Emoji · Server",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
    defaultHeat: 25,
  },
  massMessageDelete: {
    label: "Xóa tin nhắn hàng loạt",
    description: "Phát hiện quét sạch kênh (bulk delete / nuke channel)",
    group: "Kênh & thread",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "warn",
    defaultHeat: 20,
  },
  massWebhookCreate: {
    label: "Tạo webhook hàng loạt",
    description: "Phát hiện spam tạo webhook (kênh đăng webhook giả để phá server)",
    group: "Kênh & thread",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
    defaultHeat: 25,
  },
  massThreadCreate: {
    label: "Tạo thread hàng loạt",
    description: "Phát hiện spam tạo thread (forum/thread nhiễu loạn)",
    group: "Kênh & thread",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
    defaultHeat: 25,
  },
  massThreadDelete: {
    label: "Xóa thread hàng loạt",
    description: "Phát hiện spam xóa thread (quét sạch diễn đàn/thread)",
    group: "Kênh & thread",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
    defaultHeat: 25,
  },
  massChannelRename: {
    label: "Sửa/đổi tên kênh hàng loạt",
    description: "Phát hiện spam đổi tên/chủ đề/vị trí kênh (phá hoại giao diện)",
    group: "Kênh & thread",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
    defaultHeat: 25,
  },
  massChannelOverwrite: {
    label: "Thay đổi quyền kênh hàng loạt",
    description: "Permission bombing — sửa overwrite nhiều kênh để khóa mọi người hoặc mở toang",
    group: "Kênh & thread",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
    defaultHeat: 25,
  },
  massRoleEdit: {
    label: "Sửa role hàng loạt",
    description: "Phát hiện sửa tên/màu/quyền nhiều role (role tampering)",
    group: "Role · Emoji · Server",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
    defaultHeat: 25,
  },
  adminSelfGrant: {
    label: "Tự cấp quyền quản trị",
    description: "Leo thang đặc quyền — ai đó tự gán role Admin/ManageGuild/ManageRoles",
    group: "Thành viên & quyền",
    defaultThreshold: 1,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
    defaultHeat: 30,
  },
  massRoleAssign: {
    label: "Gán/gỡ role hàng loạt",
    description: "Role bombing — gán/gỡ role cho nhiều thành viên cùng lúc",
    group: "Thành viên & quyền",
    defaultThreshold: 6,
    defaultWindowSeconds: 15,
    defaultPunish: "kick",
    defaultHeat: 20,
  },
  massNickname: {
    label: "Đổi biệt danh hàng loạt",
    description: "Rename raid — đổi nickname của nhiều thành viên",
    group: "Thành viên & quyền",
    defaultThreshold: 6,
    defaultWindowSeconds: 15,
    defaultPunish: "kick",
    defaultHeat: 15,
  },
  massEmoji: {
    label: "Tạo emoji/sticker hàng loạt",
    description: "Spam tạo emoji/sticker để lấp đầy slot hoặc chèn ảnh phá hoại",
    group: "Role · Emoji · Server",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
    defaultHeat: 25,
  },
  massBotAdd: {
    label: "Thêm bot hàng loạt",
    description: "Bot raid — mời nhiều bot vào server cùng lúc",
    group: "Thành viên & quyền",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "kick",
    defaultHeat: 20,
  },
  massInviteCreate: {
    label: "Tạo link mời hàng loạt",
    description: "Chuẩn bị raid — tạo nhiều link mời trước khi tràn vào",
    group: "Role · Emoji · Server",
    defaultThreshold: 5,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
    defaultHeat: 25,
  },
  guildTamper: {
    label: "Đổi cấu hình server",
    description: "Phá hoại cấp server — đổi tên/icon/bật MFA/giảm verification…",
    group: "Role · Emoji · Server",
    defaultThreshold: 2,
    defaultWindowSeconds: 10,
    defaultPunish: "ban",
    defaultHeat: 25,
  },
  massMessage: {
    label: "Spam tin dài / lặp nội dung",
    description: "Phát hiện spam tin nhắn cực dài hoặc lặp lại nội dung giống hệt — AI phân biệt raid hay cá nhân",
    group: "Spam & nhiễu kênh",
    defaultThreshold: 4,
    defaultWindowSeconds: 15,
    defaultPunish: "timeout",
    defaultHeat: 15,
  },
  blankNoise: {
    label: "Tin giả blank gây nhiễu",
    description: "Phát hiện tin nhắn chỉ gồm khoảng trắng / ký tự ẩn (zero-width) gây nhiễu kênh",
    group: "Spam & nhiễu kênh",
    defaultThreshold: 3,
    defaultWindowSeconds: 10,
    defaultPunish: "timeout",
    defaultHeat: 15,
  },
  spam: {
    label: "Chống spam tin nhắn",
    description: "Phát hiện thành viên gửi quá nhiều tin nhắn trong thời gian ngắn",
    group: "Spam & nhiễu kênh",
    defaultThreshold: 6,
    defaultWindowSeconds: 10,
    defaultPunish: "timeout",
    defaultHeat: 10,
  },
  mention: {
    label: "Chống spam mention",
    description: "Phát hiện spam tag người/role/kênh liên tục trong thời gian ngắn",
    group: "Spam & nhiễu kênh",
    defaultThreshold: 10,
    defaultWindowSeconds: 10,
    defaultPunish: "timeout",
    defaultHeat: 15,
  },
  badword: {
    label: "Lọc từ ngữ xấu",
    description: "Tự động xóa tin nhắn chứa từ trong danh sách từ ngữ xấu của server",
    group: "Nội dung nguy hiểm",
    defaultThreshold: 1,
    defaultWindowSeconds: 10,
    defaultPunish: "warn",
    defaultHeat: 10,
  },
  attachment: {
    label: "Chống spam ảnh & file",
    description: "Phát hiện spam ảnh, file đính kèm liên tục trong thời gian ngắn",
    group: "Spam & nhiễu kênh",
    defaultThreshold: 5,
    defaultWindowSeconds: 10,
    defaultPunish: "timeout",
    defaultHeat: 15,
  },
  invite: {
    label: "Chặn link mời Discord",
    description: "Xóa tin nhắn chứa link mời discord.gg / discord.com/invite",
    group: "Nội dung nguy hiểm",
    defaultThreshold: 1,
    defaultWindowSeconds: 10,
    defaultPunish: "warn",
    defaultHeat: 20,
  },
  malware: {
    label: "Chống link độc hại & file nguy hiểm",
    description:
      "Chặn domain lừa đảo (nitro giả, gift giả…), link IP và file đuôi nguy hiểm (.exe, .scr, .bat…)",
    group: "Nội dung nguy hiểm",
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
  "massThreadDelete",
  "massChannelRename",
  "massChannelOverwrite",
  "massRoleEdit",
  "adminSelfGrant",
  "massRoleAssign",
  "massNickname",
  "massEmoji",
  "massBotAdd",
  "massInviteCreate",
  "guildTamper",
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
  "massThreadDelete",
  "massChannelRename",
  "massChannelOverwrite",
  "massRoleEdit",
  "adminSelfGrant",
  "massRoleAssign",
  "massNickname",
  "massEmoji",
  "massBotAdd",
  "massInviteCreate",
  "guildTamper",
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

/** Nhóm hiển thị cho phần Chống nuke / raid — thứ tự nhóm + module. */
export const NUKE_GROUPS: { label: string; modules: string[] }[] = [
  {
    label: "Thành viên & quyền",
    modules: ["massBan", "massKick", "massJoin", "adminSelfGrant", "massRoleAssign", "massNickname", "massBotAdd"],
  },
  {
    label: "Kênh & thread",
    modules: [
      "massChannelCreate",
      "massChannelDelete",
      "massChannelRename",
      "massChannelOverwrite",
      "massThreadCreate",
      "massThreadDelete",
      "massWebhookCreate",
      "massMessageDelete",
    ],
  },
  {
    label: "Role · Emoji · Server",
    modules: ["massRoleCreate", "massRoleDelete", "massRoleEdit", "massEmoji", "massInviteCreate", "guildTamper"],
  },
];

/** Nhóm hiển thị cho phần Auto-mod nội dung. */
export const MODERATION_GROUPS: { label: string; modules: string[] }[] = [
  {
    label: "Spam & nhiễu kênh",
    modules: ["spam", "massMessage", "blankNoise", "mention", "attachment"],
  },
  {
    label: "Nội dung nguy hiểm",
    modules: ["badword", "invite", "malware"],
  },
];

export const PUNISH_LABEL: Record<string, string> = {
  warn: "Warn",
  kick: "Kick",
  ban: "Ban",
  timeout: "Tạm khóa (timeout)",
};

/**
 * Mức chi tiết của embed moderation kiểu Carl-bot sau khi bot trừng phạt thành viên
 * (phần Moderation — áp dụng cho cả tự động lẫn lệnh thủ công):
 *  - none:   không gửi embed (dashboard vẫn ghi nhận)
 *  - action: Offender
 *  - reason: thêm Reason (trống → "không có lý do")
 *  - full:   thêm Responsible moderator (bot tự động = tên bot, mod lệnh = tên người dùng)
 */
export const PUNISH_NOTICE_LEVELS: {
  value: PunishNoticeLevel;
  label: string;
  hint: string;
}[] = [
  { value: "none", label: "Không gửi tin nhắn", hint: "Bot im lặng sau khi trừng phạt (dashboard vẫn ghi nhận case)" },
  { value: "action", label: "Offender", hint: "Embed chỉ hiển thị Offender + hành động" },
  {
    value: "reason",
    label: "Offender + lý do",
    hint: "Thêm dòng Reason (để trống → ghi \"không có lý do\")",
  },
  {
    value: "full",
    label: "Offender + lý do + moderator",
    hint: "Thêm dòng Responsible moderator (bot tự động = tên bot · mod lệnh = tên người dùng)",
  },
];

/** Các hành động trừng phạt áp dụng cấu hình thông báo. */
export const PUNISH_NOTICE_ACTIONS = ["ban", "timeout", "kick", "warn"] as const;

export const PUNISH_NOTICE_ACTION_LABEL: Record<string, string> = {
  ban: "🚫 Ban",
  timeout: "⏱️ Timeout",
  kick: "👢 Kick",
  warn: "⚠️ Warn",
};

export const DEFAULT_PUNISH_NOTICE: Record<string, PunishNoticeLevel> = {
  ban: "full",
  timeout: "full",
  kick: "full",
  warn: "full",
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
