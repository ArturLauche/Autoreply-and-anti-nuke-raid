/** Default anti-nuke module definitions, shared by seeding + validation. */
export const ANTI_NUKE_MODULES = [
  {
    module: "massBan",
    label: "Chống ban hàng loạt",
    threshold: 5,
    windowSeconds: 10,
    punish: "ban",
  },
  {
    module: "massKick",
    label: "Chống kick hàng loạt",
    threshold: 5,
    windowSeconds: 10,
    punish: "kick",
  },
  {
    module: "massJoin",
    label: "Chống raid thành viên",
    threshold: 8,
    windowSeconds: 10,
    punish: "kick",
  },
  {
    module: "massChannelCreate",
    label: "Chống tạo kênh hàng loạt",
    threshold: 3,
    windowSeconds: 10,
    punish: "ban",
  },
  {
    module: "massChannelDelete",
    label: "Chống xóa kênh hàng loạt",
    threshold: 3,
    windowSeconds: 10,
    punish: "ban",
  },
  {
    module: "massRoleCreate",
    label: "Chống tạo role hàng loạt",
    threshold: 3,
    windowSeconds: 10,
    punish: "ban",
  },
  {
    module: "massRoleDelete",
    label: "Chống xóa role hàng loạt",
    threshold: 3,
    windowSeconds: 10,
    punish: "ban",
  },
  {
    module: "massMessageDelete",
    label: "Chống xóa tin hàng loạt",
    threshold: 3,
    windowSeconds: 10,
    punish: "warn",
  },
  {
    module: "spam",
    label: "Chống spam tin nhắn",
    threshold: 6,
    windowSeconds: 10,
    punish: "timeout",
  },
] as const;

/** Defaults for the automatic channel-lockdown-on-raid feature. */
export const LOCKDOWN_DEFAULTS = {
  enabled: true,
  minutes: 5,
} as const;

export type AntiNukeModuleKey = (typeof ANTI_NUKE_MODULES)[number]["module"];

export function isAntiNukeModule(name: string): name is AntiNukeModuleKey {
  return ANTI_NUKE_MODULES.some((m) => m.module === name);
}
