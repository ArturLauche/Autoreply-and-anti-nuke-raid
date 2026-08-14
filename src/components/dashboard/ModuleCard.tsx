import { useEffect, useState } from "react";
import {
  AppWindow,
  Bot,
  ChevronDown,
  Crown,
  Edit3,
  FolderPlus,
  Gavel,
  KeyRound,
  Link2,
  ListX,
  MessageCircleOff,
  MessageSquare,
  MessageSquareX,
  Paperclip,
  Settings2,
  ShieldAlert,
  ShieldPlus,
  ShieldX,
  SlidersHorizontal,
  Smile,
  Tags,
  UserCog,
  UserX,
  Users,
  XSquare,
} from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Switch } from "../ui/switch";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { MultiSelect } from "../ui/multi-select";
import { cn } from "../../lib/utils";
import {
  ACTION_LABEL,
  ACTION_STRENGTH,
  ANTINUKE_MODULE_META,
  MEMBER_PUNISH_OPTIONS,
  MESSAGE_CLEAN_OPTIONS,
  strongestPunish,
} from "../../lib/constants";
import type { GuildData, ModuleConfig, ModuleAction } from "../../lib/types";

const MODULE_ICONS: Record<string, typeof Gavel> = {
  massBan: Gavel,
  massKick: UserX,
  massJoin: Users,
  massChannelCreate: FolderPlus,
  massChannelDelete: XSquare,
  massRoleCreate: ShieldPlus,
  massRoleDelete: ShieldX,
  massMessageDelete: MessageSquareX,
  massWebhookCreate: Bot,
  massThreadCreate: MessageSquare,
  massThreadDelete: MessageCircleOff,
  massChannelRename: Edit3,
  massChannelOverwrite: KeyRound,
  massRoleEdit: SlidersHorizontal,
  adminSelfGrant: Crown,
  massRoleAssign: Tags,
  massNickname: UserCog,
  massEmoji: Smile,
  massBotAdd: Bot,
  externalAppRaid: AppWindow,
  massInviteCreate: Link2,
  guildTamper: Settings2,
  spam: MessageSquare,
  massMessage: MessageSquare,
  blankNoise: MessageSquareX,
  mention: MessageSquareX,
  badword: ListX,
  attachment: Paperclip,
  invite: Link2,
  malware: ShieldX,
};

const ACTION_STYLE: Record<string, string> = {
  warn: "bg-amber-500/15 text-amber-400",
  kick: "bg-orange-500/15 text-orange-400",
  ban: "bg-danger/15 text-danger",
  timeout: "bg-violet-500/15 text-violet-400",
  deleteMessages: "bg-sky-500/15 text-sky-400",
  purgeMessages: "bg-rose-500/15 text-rose-400",
};

function ModuleNumber({
  value,
  min,
  max,
  onCommit,
  className,
}: {
  value: number;
  min: number;
  max?: number;
  onCommit: (n: number) => void;
  className?: string;
}) {
  const [v, setV] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setV(String(value));
  }, [value, focused]);
  return (
    <Input
      type="number"
      min={min}
      max={max}
      value={v}
      className={className}
      onFocus={() => setFocused(true)}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        setFocused(false);
        const n = Number(v);
        if (!Number.isNaN(n) && n >= min) onCommit(Math.round(n));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export default function ModuleCard({
  data,
  module,
  config,
  patchModule,
  unit,
  showHeat = true,
  compact = false,
}: {
  data: GuildData;
  module: string;
  config: ModuleConfig;
  patchModule: (
    module: string,
    patch: Partial<Omit<ModuleConfig, "module">>,
    successMsg?: string,
  ) => Promise<void>;
  unit: string;
  /** Module nuke/raid phạt trực tiếp — không hiển thị ô nhiệt. */
  showHeat?: boolean;
  /** Card nằm trong lưới 2 cột (mục Chống nuke) — config xếp gọn 2 cột, không giãn ngang. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const meta = ANTINUKE_MODULE_META[module];
  const Icon = MODULE_ICONS[module] ?? ShieldAlert;
  const roleOptions = data.roles
    .filter((r) => r.name !== "@everyone")
    .map((r) => ({ value: r.roleId, label: r.name }));

  const actions: ModuleAction[] =
    config.actions && config.actions.length > 0 ? config.actions : [config.punish];
  const hasTimeout = actions.includes("timeout");
  const hasMemberPunish = actions.some((a) => ACTION_STRENGTH[a] != null);
  /** Hình phạt thành viên hiện tại — luôn là 1 trong warn/timeout/kick/ban. */
  const memberPunish = actions.find((a) => ACTION_STRENGTH[a] != null) ?? config.punish;
  /** Các hành động dọn tin nhắn (deleteMessages / purgeMessages). */
  const messageActions = actions.filter((a) => ACTION_STRENGTH[a] == null);

  /** Đổi hình phạt thành viên — thay thế hình phạt cũ, giữ nguyên dọn tin nhắn. */
  function selectMemberPunish(action: ModuleAction) {
    const next = [...messageActions, action];
    patchModule(module, {
      actions: next,
      punish: strongestPunish(next, config.punish),
    });
  }

  /** Bật/tắt hành động dọn tin nhắn — chọn nhiều được, kết hợp với hình phạt. */
  function toggleMessageAction(action: ModuleAction) {
    const next = messageActions.includes(action)
      ? messageActions.filter((a) => a !== action)
      : [...messageActions, action];
    const final = [memberPunish, ...next];
    patchModule(module, {
      actions: final,
      punish: strongestPunish(final, config.punish),
    });
  }

  return (
    <Card className={cn("overflow-hidden", !config.enabled && "opacity-60")}>
      {/* Header — 1 dòng tóm tắt, bấm để mở cấu hình */}
      <div
        className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
        onClick={() => setOpen((o) => !o)}
        role="button"
        aria-expanded={open}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate text-sm font-semibold">
            {meta.label}
            {!config.enabled && (
              <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
                tắt
              </Badge>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">{meta.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-1.5 md:flex">
            <Badge variant="secondary" className="px-2 py-0.5 text-[10px]">
              ≥{config.threshold}/{config.windowSeconds}s
            </Badge>
            {actions.map((a) => (
              <Badge key={a} className={cn("px-2 py-0.5 text-[10px]", ACTION_STYLE[a])}>
                {ACTION_LABEL[a]}
              </Badge>
            ))}
            {!hasMemberPunish && (
              <Badge variant="secondary" className="px-2 py-0.5 text-[10px]">
                chỉ dọn tin
              </Badge>
            )}
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(v) => patchModule(module, { enabled: v })}
            onClick={(e) => e.stopPropagation()}
          />
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </div>
      </div>

      {/* Cấu hình mở rộng */}
      {open && (
        <CardContent className="grid gap-3 border-t border-border/60 px-4 py-3">
          <div className={cn("grid gap-3", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
            <div className="grid gap-1">
              <Label className="text-[11px] text-muted-foreground">
                Ngưỡng ({unit})
              </Label>
              <ModuleNumber
                value={config.threshold}
                min={1}
                onCommit={(n) => patchModule(module, { threshold: n })}
                className="h-8 text-sm"
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-[11px] text-muted-foreground">Cửa sổ (giây)</Label>
              <ModuleNumber
                value={config.windowSeconds}
                min={1}
                max={3600}
                onCommit={(n) => patchModule(module, { windowSeconds: n })}
                className="h-8 text-sm"
              />
            </div>
            {showHeat && (
              <div className="grid gap-1">
                <Label className="text-[11px] text-orange-400/80">🔥 Nhiệt/vi phạm</Label>
                <ModuleNumber
                  value={config.heat}
                  min={1}
                  max={100}
                  onCommit={(n) => patchModule(module, { heat: n })}
                  className="h-8 text-sm"
                />
              </div>
            )}
            {hasTimeout && (
              <div className="grid gap-1">
                <Label className="text-[11px] text-muted-foreground">Tạm khóa (giây)</Label>
                <ModuleNumber
                  value={config.timeoutSeconds ?? 300}
                  min={1}
                  max={86400}
                  onCommit={(n) => patchModule(module, { timeoutSeconds: n })}
                  className="h-8 text-sm"
                />
              </div>
            )}
          </div>

          {/* Hình phạt thành viên — chọn 1 */}
          <div className="grid gap-1">
            <Label className="text-[11px] text-muted-foreground">
              Hình phạt thành viên <span className="text-primary/80">· chọn 1</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {MEMBER_PUNISH_OPTIONS.map((opt) => {
                const active = memberPunish === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    title={opt.hint}
                    onClick={() => selectMemberPunish(opt.value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      active
                        ? "border-primary/70 bg-primary/15 text-primary"
                        : "border-border bg-card hover:border-primary/30 hover:bg-accent/40",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-3 w-3 items-center justify-center rounded-full border",
                        active ? "border-primary bg-primary" : "border-input",
                      )}
                    >
                      {active && <span className="h-1 w-1 rounded-full bg-primary-foreground" />}
                    </span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dọn tin nhắn — chọn nhiều */}
          <div className="grid gap-1">
            <Label className="text-[11px] text-muted-foreground">
              Dọn tin nhắn <span className="text-primary/80">· chọn nhiều, kết hợp được</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {MESSAGE_CLEAN_OPTIONS.map((opt) => {
                const active = messageActions.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    title={opt.hint}
                    onClick={() => toggleMessageAction(opt.value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      active
                        ? "border-primary/60 bg-primary/15 text-primary"
                        : "border-border bg-card hover:border-primary/30 hover:bg-accent/40",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-3 w-3 items-center justify-center rounded border",
                        active ? "border-primary bg-primary" : "border-input",
                      )}
                    >
                      {active && (
                        <svg viewBox="0 0 12 12" className="h-2 w-2" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M2.5 6.5l2.5 2.5 4.5-5.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            💡 <b className="text-foreground">Xóa tin phát hiện</b> = xóa ngay tin vi phạm ·{" "}
            <b className="text-foreground">Purge</b> = xóa hàng loạt tin liên quan vụ vi phạm.
            {showHeat ? (
              <>
                {" "}
                Nhiệt tự giảm theo phút — đủ ngưỡng sẽ tự tăng cấp hình phạt.
              </>
            ) : (
              <> ⚡ Phạt trực tiếp theo hành động đã chọn — không cộng nhiệt.</>
            )}
          </p>

          <div className="grid gap-1">
            <Label className="text-[11px] text-muted-foreground">
              Role miễn trừ <span className="text-muted-foreground/70">(chỉ server này)</span>
            </Label>
            <MultiSelect
              options={roleOptions}
              value={config.whitelistRoles}
              onChange={(v) => patchModule(module, { whitelistRoles: v })}
              placeholder="Không có — tất cả role đều bị kiểm tra"
              emptyLabel="Chưa có role được đồng bộ"
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
