import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Lock, ShieldAlert, Unlock } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "../ui/card";
import { Switch } from "../ui/switch";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { useEffect, useState } from "react";
import { ANTINUKE_MODULE_META, NUKE_MODULES } from "../../lib/constants";
import ModuleCard from "./ModuleCard";
import type { GuildData, ModuleConfig } from "../../lib/types";
import { getSessionToken } from "../../lib/discord";

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
