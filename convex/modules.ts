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
    module: "spam",
    label: "Chống spam tin nhắn",
    threshold: 6,
    windowSeconds: 10,
    punish: "timeout",
    heat: 10,
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
  timeoutAt: 40,
  kickAt: 70,
  banAt: 90,
} as const;

export type AntiNukeModuleKey = (typeof ANTI_NUKE_MODULES)[number]["module"];

export function isAntiNukeModule(name: string): name is AntiNukeModuleKey {
  return ANTI_NUKE_MODULES.some((m) => m.module === name);
}
