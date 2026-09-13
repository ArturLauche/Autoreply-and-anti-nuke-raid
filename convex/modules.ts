/** Default anti-nuke module definitions, shared by seeding + validation. */
export const ANTI_NUKE_MODULES = [
  {
    module: "massBan",
    label: "Chống ban hàng loạt",
    threshold: 5,
    windowSeconds: 10,
    punish: "ban",
    heat: 25,
  },
  {
    module: "massKick",
    label: "Chống kick hàng loạt",
    threshold: 5,
    windowSeconds: 10,
    punish: "kick",
    heat: 20,
  },
  {
    module: "massJoin",
    label: "Chống raid thành viên",
    threshold: 8,
    windowSeconds: 10,
    punish: "kick",
    heat: 15,
  },
  {
    module: "massChannelCreate",
    label: "Chống tạo kênh hàng loạt",
    threshold: 3,
    windowSeconds: 10,
    punish: "ban",
    heat: 25,
  },
  {
    module: "massChannelDelete",
    label: "Chống xóa kênh hàng loạt",
    threshold: 3,
    windowSeconds: 10,
    punish: "ban",
    heat: 25,
  },
  {
    module: "massRoleCreate",
    label: "Chống tạo role hàng loạt",
    threshold: 3,
    windowSeconds: 10,
    punish: "ban",
    heat: 25,
  },
  {
    module: "massRoleDelete",
    label: "Chống xóa role hàng loạt",
    threshold: 3,
    windowSeconds: 10,
    punish: "ban",
    heat: 25,
  },
  {
    module: "massMessageDelete",
    label: "Chống xóa tin hàng loạt",
    threshold: 3,
    windowSeconds: 10,
    punish: "warn",
    heat: 20,
  },
  {
    module: "massWebhookCreate",
    label: "Chống tạo webhook hàng loạt",
    threshold: 3,
    windowSeconds: 10,
    punish: "ban",
    heat: 25,
  },
  {
    module: "massThreadCreate",
    label: "Chống tạo thread hàng loạt",
    threshold: 3,
    windowSeconds: 10,
    punish: "ban",
    heat: 25,
  },
  {
    module: "massThreadDelete",
    label: "Chống xóa thread hàng loạt",
    threshold: 3,
    windowSeconds: 10,
    punish: "ban",
    heat: 25,
  },
  {
    module: "massChannelRename",
    label: "Chống sửa/đổi tên kênh hàng loạt",
    threshold: 3,
    windowSeconds: 10,
    punish: "ban",
    heat: 25,
  },
  {
    module: "massChannelOverwrite",
    label: "Chống thay đổi quyền kênh hàng loạt (permission bombing)",
    threshold: 3,
    windowSeconds: 10,
    punish: "ban",
    heat: 25,
  },
  {
    module: "massRoleEdit",
    label: "Chống sửa role hàng loạt (tên/màu/quyền)",
    threshold: 3,
    windowSeconds: 10,
    punish: "ban",
    heat: 25,
  },
  {
    module: "adminSelfGrant",
    label: "Chống tự cấp quyền quản trị (leo thang đặc quyền)",
    threshold: 1,
    windowSeconds: 10,
    punish: "ban",
    heat: 30,
  },
  {
    module: "massRoleAssign",
    label: "Chống gán/gỡ role hàng loạt",
    threshold: 6,
    windowSeconds: 15,
    punish: "kick",
    heat: 20,
  },
  {
    module: "massNickname",
    label: "Chống đổi biệt danh hàng loạt",
    threshold: 6,
    windowSeconds: 15,
    punish: "kick",
    heat: 15,
  },
  {
    module: "massEmoji",
    label: "Chống tạo emoji/sticker hàng loạt",
    threshold: 3,
    windowSeconds: 10,
    punish: "ban",
    heat: 25,
  },
  {
    module: "massBotAdd",
    label: "Chống thêm bot hàng loạt",
    threshold: 3,
    windowSeconds: 10,
    punish: "kick",
    heat: 20,
  },
  {
    module: "botHitAndRun",
    label: "Chống bot vào-rồi-rời ngay (hit-and-run)",
    threshold: 1,
    windowSeconds: 10,
    punish: "ban",
    heat: 30,
  },
  {
    module: "suspiciousBotAlert",
    label: "Cảnh báo bot lạ mới vào server",
    threshold: 1,
    windowSeconds: 10,
    punish: "warn",
    heat: 0,
    // Module CHỈ CẢNH BÁO: không phạt, không cộng nhiệt — bot lạ được thêm vào
    // server là tín hiệu đáng lưu ý (đặc biệt khi kèm quyền cao) nhưng chưa chắc
    // đã có hành vi nuke. Mặc định TẮT cho tới khi chủ server bật trên dashboard.
  },
  {
    module: "externalAppRaid",
    label: "Chống raid bằng ứng dụng ngoài (external app)",
    threshold: 2,
    windowSeconds: 15,
    punish: "kick",
    heat: 20,
  },
  {
    module: "massInviteCreate",
    label: "Chống tạo link mời hàng loạt (chuẩn bị raid)",
    threshold: 5,
    windowSeconds: 10,
    punish: "ban",
    heat: 25,
  },
  {
    module: "guildTamper",
    label: "Chống đổi cấu hình server (tên/icon/MFA/verification)",
    threshold: 2,
    windowSeconds: 10,
    punish: "ban",
    heat: 25,
  },
  {
    module: "massMessage",
    label: "Chống spam tin dài / lặp nội dung",
    threshold: 4,
    windowSeconds: 15,
    punish: "timeout",
    heat: 15,
  },
  {
    module: "blankNoise",
    label: "Chống tin giả blank gây nhiễu",
    threshold: 3,
    windowSeconds: 10,
    punish: "timeout",
    heat: 15,
  },
  {
    module: "spam",
    label: "Chống spam tin nhắn",
    threshold: 6,
    windowSeconds: 10,
    punish: "timeout",
    heat: 10,
  },
  {
    module: "mention",
    label: "Chống spam mention",
    threshold: 10,
    windowSeconds: 10,
    punish: "timeout",
    heat: 15,
  },
  {
    module: "badword",
    label: "Lọc từ ngữ xấu",
    threshold: 1,
    windowSeconds: 10,
    punish: "warn",
    heat: 10,
  },
  {
    module: "attachment",
    label: "Chống spam ảnh & file",
    threshold: 5,
    windowSeconds: 10,
    punish: "timeout",
    heat: 15,
  },
  {
    module: "invite",
    label: "Chặn link mời Discord",
    threshold: 1,
    windowSeconds: 10,
    punish: "warn",
    heat: 20,
  },
  {
    module: "malware",
    label: "Chống link độc hại & file nguy hiểm",
    threshold: 1,
    windowSeconds: 10,
    punish: "warn",
    heat: 15,
  },
] as const;

/** Defaults for the automatic channel-lockdown-on-raid feature. */
export const LOCKDOWN_DEFAULTS = {
  enabled: true,
  minutes: 5,
} as const;

/** Default per-violation heat points, keyed by module name. */
export const MODULE_HEAT_DEFAULTS: Record<string, number> = Object.fromEntries(
  ANTI_NUKE_MODULES.map((m) => [m.module, m.heat]),
);

/** Defaults for the heat escalation system (per guild). */
export const HEAT_DEFAULTS = {
  enabled: true,
  decayPerMin: 3,
  warnAt: 25,
  timeoutAt: 40,
  kickAt: 70,
  banAt: 90,
  repeatMultiplier: 2,
  repeatWindowMin: 30,
} as const;

/** Defaults for the warn-strike escalation (moderation section). */
export const WARN_STRIKE_DEFAULTS = {
  limit: 3,
  windowMin: 60,
  punish: "timeout",
} as const;

export type AntiNukeModuleKey = (typeof ANTI_NUKE_MODULES)[number]["module"];

export function isAntiNukeModule(name: string): name is AntiNukeModuleKey {
  return ANTI_NUKE_MODULES.some((m) => m.module === name);
}
