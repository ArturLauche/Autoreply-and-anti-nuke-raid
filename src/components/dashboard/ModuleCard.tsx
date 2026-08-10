import { useEffect, useState } from "react";
import {
  FolderPlus,
  Gavel,
  Link2,
  ListX,
  MessageSquare,
  MessageSquareX,
  Paperclip,
  ShieldAlert,
  ShieldPlus,
  ShieldX,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ANTINUKE_MODULE_META, PUNISH_LABEL } from "../../lib/constants";
import type { GuildData, ModuleConfig } from "../../lib/types";

const MODULE_ICONS: Record<string, typeof Gavel> = {
  massBan: Gavel,
  massKick: UserX,
  massJoin: Users,
  massChannelCreate: FolderPlus,
  massChannelDelete: XSquare,
  massRoleCreate: ShieldPlus,
  massRoleDelete: ShieldX,
  massMessageDelete: MessageSquareX,
  spam: MessageSquare,
  mention: MessageSquareX,
  badword: ListX,
  attachment: Paperclip,
  invite: Link2,
};

const PUNISH_STYLE: Record<string, string> = {
  warn: "bg-amber-500/15 text-amber-400",
  kick: "bg-orange-500/15 text-orange-400",
  ban: "bg-danger/15 text-danger",
  timeout: "bg-violet-500/15 text-violet-400",
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
        <div className={showHeat ? "grid grid-cols-3 gap-3" : "grid grid-cols-2 gap-3"}>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Hình thức xử lý</Label>
            <Select
              value={config.punish}
              onValueChange={(v) => patchModule(module, { punish: v as ModuleConfig["punish"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="warn">⚠️ Cảnh báo</SelectItem>
                <SelectItem value="kick">👢 Kick</SelectItem>
                <SelectItem value="ban">🚫 Ban</SelectItem>
                <SelectItem value="timeout">⏸️ Tạm khóa (timeout)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showHeat && (
            <div className="grid gap-1.5">
              <Label className="text-xs text-orange-400/80">🔥 Nhiệt/vi phạm</Label>
              <ModuleNumber
                value={config.heat}
                min={1}
                max={100}
                onCommit={(n) => patchModule(module, { heat: n })}
              />
            </div>
          )}
          <div className="flex items-end pb-1">
            <Badge className={PUNISH_STYLE[config.punish]}>{PUNISH_LABEL[config.punish]}</Badge>
          </div>
        </div>
        {config.punish === "timeout" && (
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Thời lượng tạm khóa (giây)</Label>
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
            ⚡ Module chống nuke/raid phạt trực tiếp theo hình thức bên trên — không cộng nhiệt.
          </p>
        )}
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Role miễn trừ</Label>
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
