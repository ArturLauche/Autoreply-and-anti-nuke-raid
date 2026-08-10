import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import {
  Flame,
  FolderPlus,
  Gavel,
  Link2,
  ListX,
  Lock,
  MessageSquare,
  MessageSquareX,
  Paperclip,
  Plus,
  ShieldAlert,
  ShieldPlus,
  ShieldX,
  Unlock,
  UserX,
  Users,
  X,
  XSquare,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Switch } from "../ui/switch";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { MultiSelect } from "../ui/multi-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ANTINUKE_MODULE_META, ANTINUKE_ORDER, PUNISH_LABEL } from "../../lib/constants";
import { SafetyBar, TopOffenders } from "./HeatBar";
import type { GuildData, ModuleConfig } from "../../lib/types";

const TOKEN = () => localStorage.getItem("wio_session_token") ?? "";

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

export default function AntiNukePanel({ data }: { data: GuildData }) {
  const updateModule = useMutation(api.antinuke.updateModule);
  const setGlobal = useMutation(api.guilds.setAntinukeGlobal);
  const updateLockdown = useMutation(api.guilds.updateLockdown);
  const requestUnlock = useMutation(api.guilds.requestUnlock);
  const updateSettings = useMutation(api.guilds.updateSettings);

  const [tiers, setTiers] = useState({
    timeoutAt: data.guild.heatTimeoutAt,
    kickAt: data.guild.heatKickAt,
    banAt: data.guild.heatBanAt,
  });
  const [badWordInput, setBadWordInput] = useState("");

  const roleOptions = data.roles
    .filter((r) => r.name !== "@everyone")
    .map((r) => ({ value: r.roleId, label: r.name }));

  function configFor(module: string): ModuleConfig {
    const found = data.modules.find((m) => m.module === module);
    const meta = ANTINUKE_MODULE_META[module];
    return (
      found ?? {
        module,
        enabled: true,
        threshold: meta.defaultThreshold,
        windowSeconds: meta.defaultWindowSeconds,
        punish: meta.defaultPunish,
        timeoutSeconds: 300,
        whitelistRoles: [],
        heat: meta.defaultHeat,
      }
    );
  }

  async function patchModule(
    module: string,
    patch: Partial<Omit<ModuleConfig, "module">>,
    successMsg?: string,
  ) {
    try {
      await updateModule({ token: TOKEN(), guildId: data.guild.discordId, module, ...patch });
      if (successMsg) toast.success(successMsg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lưu thất bại");
    }
  }

  async function toggleGlobal(enabled: boolean) {
    try {
      await setGlobal({ token: TOKEN(), guildId: data.guild.discordId, enabled });
      toast.success(enabled ? "Đã bật toàn bộ chống nuke" : "Đã tắt toàn bộ chống nuke");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Thất bại");
    }
  }

  async function setLockdown(patch: { enabled?: boolean; minutes?: number }) {
    try {
      await updateLockdown({ token: TOKEN(), guildId: data.guild.discordId, ...patch });
      toast.success("Đã lưu cài đặt khóa kênh");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lưu thất bại");
    }
  }

  async function unlockNow() {
    try {
      await requestUnlock({ token: TOKEN(), guildId: data.guild.discordId });
      toast.success("Đã yêu cầu mở khóa — bot thực hiện trong vài giây");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Thất bại");
    }
  }

  async function patchHeatSettings(patch: {
    heatEnabled?: boolean;
    heatDecayPerMin?: number;
    heatTimeoutAt?: number;
    heatKickAt?: number;
    heatBanAt?: number;
  }) {
    try {
      await updateSettings({ token: TOKEN(), guildId: data.guild.discordId, ...patch });
      toast.success("Đã lưu cài đặt hệ thống nhiệt độ");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lưu thất bại");
    }
  }

  /** Cập nhật 3 ngưỡng cùng lúc để luôn tăng dần (tạm khóa < kick < ban). */
  async function commitTier(field: "heatTimeoutAt" | "heatKickAt" | "heatBanAt", n: number) {
    const next = {
      heatTimeoutAt: field === "heatTimeoutAt" ? n : tiers.timeoutAt,
      heatKickAt: field === "heatKickAt" ? n : tiers.kickAt,
      heatBanAt: field === "heatBanAt" ? n : tiers.banAt,
    };
    setTiers({ timeoutAt: next.heatTimeoutAt, kickAt: next.heatKickAt, banAt: next.heatBanAt });
    await patchHeatSettings(next);
  }

  async function addBadWord() {
    const word = badWordInput.trim().toLowerCase();
    if (!word) return;
    if (word.length > 40) return toast.error("Từ ngữ tối đa 40 ký tự");
    const current = data.guild.badWords || [];
    if (current.includes(word)) {
      setBadWordInput("");
      return toast.info(`"${word}" đã có trong danh sách`);
    }
    if (current.length >= 100) return toast.error("Danh sách tối đa 100 từ");
    try {
      await updateSettings({
        token: TOKEN(),
        guildId: data.guild.discordId,
        badWords: [...current, word],
      });
      setBadWordInput("");
      toast.success(`Đã thêm "${word}"`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Thất bại");
    }
  }

  async function removeBadWord(word: string) {
    try {
      await updateSettings({
        token: TOKEN(),
        guildId: data.guild.discordId,
        badWords: (data.guild.badWords || []).filter((w) => w !== word),
      });
      toast.success(`Đã xóa "${word}"`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Thất bại");
    }
  }

  const enabledCount = ANTINUKE_ORDER.filter((m) => configFor(m).enabled).length;
  const g = data.guild;
  const locked = g.lockdownUntil !== null && g.lockdownUntil > Date.now();
  const minutesLeft = locked && g.lockdownUntil
    ? Math.max(1, Math.ceil((g.lockdownUntil - Date.now()) / 60_000))
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Chống nuke / raid</h2>
          <p className="text-sm text-muted-foreground">
            Bật tắt từng module, chỉnh ngưỡng phát hiện, nhiệt độ và hình thức xử lý
          </p>
        </div>
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-4 p-4">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">
                {data.guild.antinukeEnabled ? "Đang bảo vệ server" : "Đã tắt toàn bộ"}
              </p>
              <p className="text-xs text-muted-foreground">
                {enabledCount}/{ANTINUKE_ORDER.length} module bật
              </p>
            </div>
            <Switch checked={data.guild.antinukeEnabled} onCheckedChange={toggleGlobal} />
          </CardContent>
        </Card>
      </div>

      {!data.guild.antinukeEnabled && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          ⚠️ Chống nuke đang tắt toàn bộ. Server của bạn không được bảo vệ khỏi raid.
        </div>
      )}

      {/* Hệ thống nhiệt độ */}
      <Card className="border-orange-500/25 bg-gradient-to-br from-orange-500/10 via-transparent to-rose-500/5">
        <CardContent className="grid gap-5 p-5 lg:grid-cols-2">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-orange-400">
                  <Flame className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-display font-semibold">Hệ thống nhiệt độ vi phạm</p>
                  <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                    Mỗi vi phạm cộng điểm nhiệt theo cài đặt của module (xem bên dưới). Nhiệt
                    độ tăng dần, tự giảm theo thời gian và khi chạm ngưỡng sẽ tự tăng cấp hình
                    phạt: <b className="text-violet-400">tạm khóa</b> →{" "}
                    <b className="text-orange-400">kick</b> → <b className="text-danger">ban</b>.
                  </p>
                </div>
              </div>
              <Switch
                checked={data.guild.heatEnabled}
                onCheckedChange={(v) => patchHeatSettings({ heatEnabled: v })}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Giảm nhiệt (điểm/phút)</Label>
                <ModuleNumber
                  value={data.guild.heatDecayPerMin}
                  min={0}
                  max={60}
                  onCommit={(n) => patchHeatSettings({ heatDecayPerMin: n })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-violet-400">Ngưỡng tạm khóa</Label>
                <ModuleNumber
                  value={tiers.timeoutAt}
                  min={1}
                  max={100}
                  onCommit={(n) => commitTier("heatTimeoutAt", n)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-orange-400">Ngưỡng kick</Label>
                <ModuleNumber
                  value={tiers.kickAt}
                  min={1}
                  max={100}
                  onCommit={(n) => commitTier("heatKickAt", n)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-danger">Ngưỡng ban</Label>
                <ModuleNumber
                  value={tiers.banAt}
                  min={1}
                  max={100}
                  onCommit={(n) => commitTier("heatBanAt", n)}
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Ngưỡng phải tăng dần: tạm khóa &lt; kick &lt; ban (tối đa 100 điểm).
            </p>
          </div>
          <div className="flex flex-col justify-center gap-4 rounded-xl border border-border bg-card/60 p-4">
            <SafetyBar data={data} />
            <TopOffenders data={data} limit={4} />
          </div>
        </CardContent>
      </Card>

      {/* Danh sách từ ngữ xấu */}
      <Card className="border-danger/25">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-danger/15 text-danger">
                <ListX className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display font-semibold">Danh sách từ ngữ xấu (bad word)</p>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Khi module <b className="text-foreground">Lọc từ ngữ xấu</b> bật, tin nhắn chứa
                  một trong các từ dưới đây sẽ bị xóa và xử lý tự động. Thêm từ bỏ trống để tắt
                  lọc từ ngữ xấu.
                </p>
              </div>
            </div>
            <Badge variant="secondary">{data.guild.badWords?.length ?? 0}/100 từ</Badge>
          </div>

          <div className="mt-4 flex gap-2">
            <Input
              placeholder="Nhập từ ngữ cần chặn…"
              value={badWordInput}
              onChange={(e) => setBadWordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void addBadWord();
              }}
            />
            <Button onClick={addBadWord}>
              <Plus className="h-4 w-4" /> Thêm
            </Button>
          </div>

          {(data.guild.badWords ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Chưa có từ nào — bộ lọc từ ngữ xấu sẽ không hoạt động cho tới khi bạn thêm từ.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {data.guild.badWords.map((w) => (
                <span
                  key={w}
                  className="group flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 px-2.5 py-1 font-mono text-xs text-danger transition-colors hover:bg-danger/20"
                >
                  {w}
                  <button
                    onClick={() => removeBadWord(w)}
                    className="text-danger/60 transition-colors hover:text-danger"
                    aria-label={`Xóa ${w}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                <Lock className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display font-semibold">Khóa kênh khi bị raid</p>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Khi bất kỳ module chống nuke nào phát hiện tấn công, bot tự chặn thành viên
                  gửi tin nhắn trong kênh văn bản (và kết nối voice) cho tới khi hết thời gian
                  hoặc mod mở khóa bằng lệnh <code className="font-mono text-xs">/antinuke unlock</code>.
                </p>
              </div>
            </div>
            <Switch
              checked={g.lockdownEnabled}
              onCheckedChange={(v) => setLockdown({ enabled: v })}
            />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Thời gian khóa (phút)</Label>
              <ModuleNumber
                value={g.lockdownMinutes}
                min={1}
                max={120}
                onCommit={(n) => setLockdown({ minutes: n })}
              />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              {locked ? (
                <>
                  <Badge variant="danger" className="gap-1.5 px-3 py-1">
                    <Lock className="h-3 w-3" /> Đang khóa — tự mở sau ~{minutesLeft} phút
                  </Badge>
                  <Button variant="secondary" size="sm" onClick={unlockNow}>
                    <Unlock className="h-3.5 w-3.5" /> Mở khóa ngay
                  </Button>
                </>
              ) : g.lockdownRequested ? (
                <Badge variant="secondary" className="px-3 py-1">
                  Đang chờ bot mở khóa…
                </Badge>
              ) : (
                <Badge variant="secondary" className="px-3 py-1">
                  Không có khóa kênh nào đang hoạt động
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {ANTINUKE_ORDER.map((key) => {
          const cfg = configFor(key);
          const meta = ANTINUKE_MODULE_META[key];
          const Icon = MODULE_ICONS[key] ?? ShieldAlert;
          const unit =
            key === "spam"
              ? "tin nhắn"
              : key === "attachment"
                ? "tin có ảnh/file"
                : "vi phạm";
          return (
            <Card key={key} className={cfg.enabled ? "" : "opacity-60"}>
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
                    checked={cfg.enabled}
                    onCheckedChange={(v) => patchModule(key, { enabled: v })}
                  />
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Ngưỡng ({unit} trong {cfg.windowSeconds}s)
                    </Label>
                    <ModuleNumber
                      value={cfg.threshold}
                      min={1}
                      onCommit={(n) => patchModule(key, { threshold: n })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Cửa sổ (giây)</Label>
                    <ModuleNumber
                      value={cfg.windowSeconds}
                      min={1}
                      max={3600}
                      onCommit={(n) => patchModule(key, { windowSeconds: n })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Hình thức xử lý</Label>
                    <Select
                      value={cfg.punish}
                      onValueChange={(v) => patchModule(key, { punish: v as ModuleConfig["punish"] })}
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
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-orange-400/80">🔥 Nhiệt/vi phạm</Label>
                    <ModuleNumber
                      value={cfg.heat}
                      min={1}
                      max={100}
                      onCommit={(n) => patchModule(key, { heat: n })}
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <Badge className={PUNISH_STYLE[cfg.punish]}>{PUNISH_LABEL[cfg.punish]}</Badge>
                  </div>
                </div>
                {cfg.punish === "timeout" && (
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Thời lượng tạm khóa (giây)</Label>
                    <ModuleNumber
                      value={cfg.timeoutSeconds ?? 300}
                      min={1}
                      max={86400}
                      onCommit={(n) => patchModule(key, { timeoutSeconds: n })}
                    />
                  </div>
                )}
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Role miễn trừ</Label>
                  <MultiSelect
                    options={roleOptions}
                    value={cfg.whitelistRoles}
                    onChange={(v) => patchModule(key, { whitelistRoles: v })}
                    placeholder="Không có — tất cả role đều bị kiểm tra"
                    emptyLabel="Chưa có role được đồng bộ"
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
