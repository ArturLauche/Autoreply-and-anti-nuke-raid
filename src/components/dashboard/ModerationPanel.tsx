import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { AlertTriangle, Flame, ListX, Plus, ShieldCheck, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "../ui/card";
import { Switch } from "../ui/switch";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  ANTINUKE_MODULE_META,
  MODERATION_MODULES,
  WARN_STRIKE_DEFAULTS,
} from "../../lib/constants";
import ModuleCard from "./ModuleCard";
import { HeatTable, SafetyBar } from "./HeatBar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import type { GuildData, ModuleConfig } from "../../lib/types";

const TOKEN = () => localStorage.getItem("wio_session_token") ?? "";

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

export default function ModerationPanel({ data }: { data: GuildData }) {
  const updateModule = useMutation(api.antinuke.updateModule);
  const updateSettings = useMutation(api.guilds.updateSettings);

  const [tiers, setTiers] = useState({
    warnAt: data.guild.heatWarnAt,
    timeoutAt: data.guild.heatTimeoutAt,
    kickAt: data.guild.heatKickAt,
    banAt: data.guild.heatBanAt,
  });
  const [repeat, setRepeat] = useState({
    multiplier: data.guild.heatRepeatMultiplier,
    windowMin: data.guild.heatRepeatWindowMin,
  });
  const [strikes, setStrikes] = useState({
    limit: data.guild.warnStrikeLimit,
    windowMin: data.guild.warnStrikeWindowMin,
    punish: data.guild.warnStrikePunish,
  });
  const [badWordInput, setBadWordInput] = useState("");

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

  async function patchHeatSettings(patch: {
    heatEnabled?: boolean;
    heatDecayPerMin?: number;
    heatWarnAt?: number;
    heatTimeoutAt?: number;
    heatKickAt?: number;
    heatBanAt?: number;
    heatRepeatMultiplier?: number;
    heatRepeatWindowMin?: number;
  }) {
    try {
      await updateSettings({ token: TOKEN(), guildId: data.guild.discordId, ...patch });
      toast.success("Đã lưu cài đặt hệ thống nhiệt độ");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lưu thất bại");
    }
  }

  async function commitRepeat(field: "multiplier" | "windowMin", n: number) {
    const next = {
      multiplier: field === "multiplier" ? n : repeat.multiplier,
      windowMin: field === "windowMin" ? n : repeat.windowMin,
    };
    setRepeat(next);
    await patchHeatSettings({
      heatRepeatMultiplier: next.multiplier,
      heatRepeatWindowMin: next.windowMin,
    });
  }

  async function commitStrikes(patch: {
    warnStrikeLimit?: number;
    warnStrikeWindowMin?: number;
    warnStrikePunish?: "timeout" | "kick" | "ban";
  }) {
    const next = {
      limit: patch.warnStrikeLimit ?? strikes.limit,
      windowMin: patch.warnStrikeWindowMin ?? strikes.windowMin,
      punish: patch.warnStrikePunish ?? strikes.punish,
    };
    setStrikes(next);
    try {
      await updateSettings({ token: TOKEN(), guildId: data.guild.discordId, ...patch });
      toast.success("Đã lưu cài đặt warn tích lũy");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lưu thất bại");
    }
  }

  /** Cập nhật 4 ngưỡng cùng lúc để luôn tăng dần (cảnh báo < tạm khóa < kick < ban). */
  async function commitTier(
    field: "heatWarnAt" | "heatTimeoutAt" | "heatKickAt" | "heatBanAt",
    n: number,
  ) {
    const next = {
      heatWarnAt: field === "heatWarnAt" ? n : tiers.warnAt,
      heatTimeoutAt: field === "heatTimeoutAt" ? n : tiers.timeoutAt,
      heatKickAt: field === "heatKickAt" ? n : tiers.kickAt,
      heatBanAt: field === "heatBanAt" ? n : tiers.banAt,
    };
    setTiers({ warnAt: next.heatWarnAt, timeoutAt: next.heatTimeoutAt, kickAt: next.heatKickAt, banAt: next.heatBanAt });
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

  const enabledCount = MODERATION_MODULES.filter((m) => configFor(m).enabled).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Moderation nội dung</h2>
          <p className="text-sm text-muted-foreground">
            Chống spam tin nhắn, mention, từ ngữ xấu, spam ảnh/file và chặn link mời Discord
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          {enabledCount}/{MODERATION_MODULES.length} module đang bật
        </Badge>
      </div>

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
                    Mỗi vi phạm cộng điểm nhiệt theo cài đặt của module. Nhiệt độ tăng dần, tự
                    giảm theo thời gian; khi chạm ngưỡng <b className="text-amber-400">cảnh báo</b>{" "}
                    thành viên được DM, rồi tự tăng cấp hình phạt:{" "}
                    <b className="text-violet-400">tạm khóa</b> → <b className="text-orange-400">kick</b>{" "}
                    → <b className="text-danger">ban</b>.
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
                <Label className="text-xs text-rose-400">Tái phạm ×(lần)</Label>
                <ModuleNumber
                  value={repeat.multiplier}
                  min={1}
                  max={10}
                  onCommit={(n) => commitRepeat("multiplier", n)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Cửa sổ tái phạm (phút)</Label>
                <ModuleNumber
                  value={repeat.windowMin}
                  min={1}
                  max={1440}
                  onCommit={(n) => commitRepeat("windowMin", n)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-amber-400">Ngưỡng cảnh báo DM</Label>
                <ModuleNumber
                  value={tiers.warnAt}
                  min={1}
                  max={99}
                  onCommit={(n) => commitTier("heatWarnAt", n)}
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
              <p className="col-span-full text-xs text-muted-foreground">
                Ngưỡng phải tăng dần: cảnh báo &lt; tạm khóa &lt; kick &lt; ban (tối đa 100 điểm).
                Thành viên vừa bị phạt mà <b className="text-rose-400">tái phạm trong {repeat.windowMin} phút</b>{" "}
                sẽ nhận <b className="text-rose-400">×{repeat.multiplier} điểm nhiệt</b> mỗi lần vi phạm — đầy thanh nhanh hơn.
              </p>
            </div>
          </div>
          <div className="flex flex-col justify-center gap-4 rounded-xl border border-border bg-card/60 p-4">
            <SafetyBar data={data} />
            <p className="text-xs font-medium text-muted-foreground">
              🔥 Bảng nhiệt độ & warn tích lũy của từng thành viên
            </p>
            <HeatTable data={data} />
          </div>
        </CardContent>
      </Card>

      {/* Warn tích lũy */}
      <Card className="border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-transparent to-orange-500/5">
        <CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_1fr]">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display font-semibold">Warn tích lũy (tăng cấp hình phạt)</p>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Khi module dùng hình phạt <b className="text-foreground">Cảnh báo</b>, mỗi lần vi
                phạm đếm <b className="text-foreground">1 warn</b>. Đủ số warn trong cửa sổ thời
                gian, hình phạt tự <b className="text-amber-400">tăng cấp</b> lên mức nặng hơn —
                song song với hệ thống nhiệt độ.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Số warn để tăng cấp (0 = tắt)</Label>
              <ModuleNumber
                value={strikes.limit}
                min={0}
                max={20}
                onCommit={(n) => commitStrikes({ warnStrikeLimit: n })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Cửa sổ (phút)</Label>
              <ModuleNumber
                value={strikes.windowMin}
                min={1}
                max={1440}
                onCommit={(n) => commitStrikes({ warnStrikeWindowMin: n })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-amber-400">Hình phạt khi tăng cấp</Label>
              <Select
                value={strikes.punish}
                onValueChange={(v) =>
                  commitStrikes({ warnStrikePunish: v as "timeout" | "kick" | "ban" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="timeout">⏸️ Tạm khóa (timeout)</SelectItem>
                  <SelectItem value="kick">👢 Kick</SelectItem>
                  <SelectItem value="ban">🚫 Ban</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="col-span-full text-xs text-muted-foreground">
              {strikes.limit > 0 ? (
                <>
                  Đang bật: <b className="text-amber-400">{strikes.limit} warn</b> trong{" "}
                  {strikes.windowMin} phút → tự{" "}
                  <b className="text-amber-400">
                    {strikes.punish === "timeout"
                      ? "tạm khóa"
                      : strikes.punish === "kick"
                        ? "kick"
                        : "ban"}
                  </b>{" "}
                  (mặc định: {WARN_STRIKE_DEFAULTS.limit} warn / {WARN_STRIKE_DEFAULTS.windowMin} phút).
                </>
              ) : (
                <>Đang tắt — mọi module chỉ cảnh báo, không tăng cấp theo số lần warn.</>
              )}
            </p>
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

      <div className="grid gap-4 lg:grid-cols-2">
        {MODERATION_MODULES.map((key) => (
          <ModuleCard
            key={key}
            data={data}
            module={key}
            config={configFor(key)}
            patchModule={patchModule}
            unit={
              key === "spam"
                ? "tin nhắn"
                : key === "mention"
                  ? "tin có mention"
                  : key === "attachment"
                    ? "tin có ảnh/file"
                    : "vi phạm"
            }
          />
        ))}
      </div>
    </div>
  );
}
