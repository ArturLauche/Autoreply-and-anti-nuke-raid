import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Crosshair, Database, Lock, ShieldAlert, Unlock } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "../ui/card";
import { Switch } from "../ui/switch";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { useEffect, useState } from "react";
import { ANTINUKE_MODULE_META, DEFAULT_MODULE_ACTIONS, NUKE_MODULES } from "../../lib/constants";
import ModuleCard from "./ModuleCard";
import type { GuildData, ModuleConfig, RaidIntel } from "../../lib/types";
import { getSessionToken } from "../../lib/discord";
import { timeAgo } from "../../lib/utils";

const TOKEN = () => getSessionToken();

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
        actions: DEFAULT_MODULE_ACTIONS[module] ?? [meta.defaultPunish],
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

  async function setRaidHunt(patch: { raidHuntEnabled?: boolean; raidHuntBanSuspects?: boolean }) {
    try {
      await updateSettings({ token: TOKEN(), guildId: data.guild.discordId, ...patch });
      toast.success("Đã lưu cài đặt Raid Intel — bot áp dụng trong ~30 giây");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lưu thất bại");
    }
  }

  const raidIntel = useQuery(api.antinuke.raidIntel, {
    token: TOKEN(),
    guildId: data.guild.discordId,
  }) as RaidIntel | null | undefined;

  const enabledCount = NUKE_MODULES.filter((m) => configFor(m).enabled).length;
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
            Bảo vệ cấu trúc server khỏi các cuộc tấn công hàng loạt (ban, kick, tạo/xóa kênh & role…)
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
                {enabledCount}/{NUKE_MODULES.length} module chống nuke bật
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

      {/* Raid Intel — thu thập dữ liệu + săn nguồn cơn raid */}
      <Card className="border-violet-500/30 bg-violet-500/5">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
                <Crosshair className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display font-semibold">Raid Intel — săn lùng nguồn cơn raid 🎯</p>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Mỗi vụ raid/nuke bot xử lý đều được <b className="text-foreground">thu thập thành mẫu
                  dữ liệu huấn luyện</b> (module, cụm tài khoản, AI verdict). Bot + AI phân tích để
                  tìm <b className="text-foreground">kẻ đứng sau raid</b> — acc chủ mưu, avatar/username
                  trùng nhau, người tạo invite, kẻ phá hoại trong audit log — rồi tự ban.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
                <Database className="h-3.5 w-3.5" />
                {raidIntel ? `${raidIntel.count} mẫu dữ liệu đã thu thập` : "đang tải…"}
              </Badge>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex items-start justify-between gap-3 rounded-lg bg-secondary/40 p-3">
              <div>
                <p className="text-sm font-semibold">Săn lùng nguồn cơn raid</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Phân tích cụm tài khoản + audit log để tìm kẻ chủ mưu sau mỗi vụ.
                </p>
              </div>
              <Switch
                checked={g.raidHuntEnabled}
                onCheckedChange={(v) => setRaidHunt({ raidHuntEnabled: v })}
              />
            </div>
            <div className="flex items-start justify-between gap-3 rounded-lg bg-secondary/40 p-3">
              <div>
                <p className="text-sm font-semibold">Tự ban nghi phạm nguồn cơn</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Tự ban tài khoản đủ điểm nghi vấn (chủ mưu, acc trùng avatar…).
                </p>
              </div>
              <Switch
                checked={g.raidHuntBanSuspects}
                onCheckedChange={(v) => setRaidHunt({ raidHuntBanSuspects: v })}
              />
            </div>
          </div>

          {raidIntel && raidIntel.recent.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Vụ gần đây ({raidIntel.recent.length})
              </p>
              <ul className="space-y-1.5">
                {raidIntel.recent.map((s, i) => (
                  <li
                    key={`${s.createdAt}-${i}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-secondary/30 px-3 py-2 text-xs"
                  >
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                      {s.module}
                    </code>
                    <span className="text-muted-foreground">
                      {s.count} lượt{s.clusterMemberCount ? ` · ${s.clusterMemberCount} acc` : ""} ·{" "}
                      {timeAgo(s.createdAt)}
                    </span>
                    {s.aiClassification && (
                      <Badge
                        variant="secondary"
                        className={
                          s.aiClassification === "raid"
                            ? "bg-red-500/15 text-red-400"
                            : s.aiClassification === "benign"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-sky-500/15 text-sky-400"
                        }
                      >
                        AI: {s.aiClassification}
                        {s.aiConfidence != null ? ` ${Math.round(s.aiConfidence * 100)}%` : ""}
                      </Badge>
                    )}
                    {s.suspectedSourceName && (
                      <span className={s.banned ? "text-red-400" : "text-amber-400"}>
                        {s.banned ? `🎯 đã ban nguồn cơn: ${s.suspectedSourceName}` : `nghi: ${s.suspectedSourceName}`}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {NUKE_MODULES.map((key) => (
          <ModuleCard
            key={key}
            data={data}
            module={key}
            config={configFor(key)}
            patchModule={patchModule}
            unit="vi phạm"
            showHeat={false}
          />
        ))}
      </div>
    </div>
  );
}
