import { useEffect, useState } from "react";
import {
  Bot,
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
  Trash2,
  UserCog,
  UserX,
  Users,
  XSquare,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
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
}: {
  value: number;
  min: number;
  max?: number;
  onCommit: (n: number) => void;
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
}) {
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
    <Card className={config.enabled ? "" : "opacity-60"}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <CardTitle className="text-base">{meta.label}</CardTitle>
              <CardDescription>{meta.description}</CardDescription>
            </div>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(v) => patchModule(module, { enabled: v })}
          />
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">
              Ngưỡng ({unit} trong {config.windowSeconds}s)
            </Label>
            <ModuleNumber
              value={config.threshold}
              min={1}
              onCommit={(n) => patchModule(module, { threshold: n })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Cửa sổ (giây)</Label>
            <ModuleNumber
              value={config.windowSeconds}
              min={1}
              max={3600}
              onCommit={(n) => patchModule(module, { windowSeconds: n })}
            />
          </div>
        </div>

        <div className="grid gap-3">
          {/* Nhóm 1 — hình phạt thành viên (chọn 1) */}
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">
              Hình phạt thành viên{" "}
              <span className="text-primary/80">(chọn 1 — tách riêng với dọn tin nhắn)</span>
            </Label>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {MEMBER_PUNISH_OPTIONS.map((opt) => {
                const active = memberPunish === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => selectMemberPunish(opt.value)}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors",
                      active
                        ? "border-primary/70 bg-primary/10 ring-1 ring-primary/30"
                        : "border-border bg-card hover:border-primary/30 hover:bg-accent/40",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                        active ? "border-primary bg-primary text-primary-foreground" : "border-input",
                      )}
                    >
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                    </span>
                    <span>
                      <span
                        className={cn(
                          "block text-xs font-semibold",
                          active ? "text-primary" : "text-foreground",
                        )}
                      >
                        {opt.label}
                      </span>
                      <span className="block text-[11px] leading-snug text-muted-foreground">
                        {opt.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nhóm 2 — dọn tin nhắn (chọn nhiều) */}
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">
              Dọn tin nhắn <span className="text-primary/80">(chọn nhiều — kết hợp)</span>
            </Label>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {MESSAGE_CLEAN_OPTIONS.map((opt) => {
                const active = messageActions.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleMessageAction(opt.value)}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors",
                      active
                        ? "border-primary/60 bg-primary/10"
                        : "border-border bg-card hover:border-primary/30 hover:bg-accent/40",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                        active ? "border-primary bg-primary text-primary-foreground" : "border-input",
                      )}
                    >
                      {active && (
                        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2.5 6.5l2.5 2.5 4.5-5.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span>
                      <span
                        className={cn(
                          "block text-xs font-semibold",
                          active ? "text-primary" : "text-foreground",
                        )}
                      >
                        {opt.label}
                      </span>
                      <span className="block text-[11px] leading-snug text-muted-foreground">
                        {opt.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            💡 <b className="text-foreground">Xóa tin phát hiện</b> = xóa ngay tin nhắn vi phạm tại
            thời điểm bot nhận ra · <b className="text-foreground">Purge</b> = xóa hàng loạt mọi tin
            nhắn liên quan đến vụ vi phạm. Hình phạt thành viên <b className="text-foreground">chỉ
            chọn 1</b>; các hành động dọn tin nhắn chọn được <b className="text-foreground">nhiều</b>{" "}
            và kết hợp với hình phạt (ví dụ: <b className="text-foreground">Ban + Purge tin liên quan</b>).
          </p>
        </div>

        {actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {actions.map((a) => (
              <Badge key={a} className={cn("gap-1 px-2.5 py-1", ACTION_STYLE[a])}>
                {a === "deleteMessages" || a === "purgeMessages" ? (
                  <Trash2 className="h-3 w-3" />
                ) : null}
                {ACTION_LABEL[a]}
              </Badge>
            ))}
            {!hasMemberPunish && (
              <span className="text-[11px] text-muted-foreground">
                (chỉ dọn tin nhắn — không phạt thành viên)
              </span>
            )}
          </div>
        )}

        {showHeat && (
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-orange-400/80">🔥 Nhiệt/vi phạm</Label>
              <ModuleNumber
                value={config.heat}
                min={1}
                max={100}
                onCommit={(n) => patchModule(module, { heat: n })}
              />
            </div>
            <div className="flex items-end pb-1">
              <p className="text-[11px] text-muted-foreground">
                Nhiệt tự giảm theo phút; đủ ngưỡng sẽ tự tăng cấp hình phạt.
              </p>
            </div>
          </div>
        )}
        {hasTimeout && (
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">
              Thời lượng tạm khóa (giây) — dùng khi chọn "Tạm khóa (timeout)"
            </Label>
            <ModuleNumber
              value={config.timeoutSeconds ?? 300}
              min={1}
              max={86400}
              onCommit={(n) => patchModule(module, { timeoutSeconds: n })}
            />
          </div>
        )}
        {!showHeat && (
          <p className="text-[11px] text-muted-foreground">
            ⚡ Module chống nuke/raid phạt trực tiếp theo hành động đã chọn — không cộng nhiệt.
          </p>
        )}
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">
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
    </Card>
  );
}
