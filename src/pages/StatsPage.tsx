import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { ArrowLeft, Flame, Loader2, ShieldAlert, Trophy } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { HEAT_DEFAULTS, HEAT_TIER_LABEL } from "../lib/constants";
import { effectiveHeat, tierOf } from "../components/dashboard/HeatBar";
import { discordGuildIconUrl, getSessionToken } from "../lib/discord";
import { timeAgo } from "../lib/utils";
import type { MeData } from "../lib/types";

/** 1 dòng bảng xếp hạng trả về từ convex/reports.ts heatLeaderboard. */
interface HeatRow {
  userId: string;
  username: string;
  heat: number;
  warnStrikes: number | null;
  updatedAt: number;
}

/* Tier nhiệt theo bảng đen trắng: mức càng nặng → nền càng đậm. */
const TIER_STYLE: Record<string, string> = {
  warn: "bg-secondary text-secondary-foreground border border-border",
  timeout: "bg-foreground/10 text-foreground border border-foreground/20",
  kick: "bg-foreground/20 text-foreground border border-foreground/30",
  ban: "bg-danger text-danger-foreground border border-danger",
};

/* Hạng hiển thị kiểu typographic (không emoji màu) — đồng bộ bảng đen trắng. */
const MEDAL = ["1", "2", "3"];

export default function StatsPage() {
  const token = getSessionToken();
  const me = useQuery(api.sessions.me, token ? ({ token } as { token: string }) : "skip") as
    | MeData
    | null
    | undefined;
  const [guildId, setGuildId] = useState("");
  const managed = me?.guilds ?? [];

  // Tự chọn server đầu tiên khi danh sách tải xong (người dùng vẫn đổi được).
  useEffect(() => {
    if (!guildId && managed.length > 0) setGuildId(managed[0].discordId);
  }, [guildId, managed]);

  const rows = useQuery(
    api.reports.heatLeaderboard,
    token && guildId ? ({ token, guildId, limit: 10 } as { token: string; guildId: string; limit: number }) : "skip",
  ) as HeatRow[] | null | undefined;

  const selected = managed.find((g) => g.discordId === guildId);

  // Áp decay theo thời gian trôi qua (giống HeatBar trong dashboard) rồi lọc > 0.
  const ranked = useMemo(() => {
    const decay = HEAT_DEFAULTS.decayPerMin;
    return (rows ?? [])
      .map((r) => ({ ...r, heat: effectiveHeat(r.heat, r.updatedAt, decay) }))
      .filter((r) => r.heat > 0)
      .sort((a, b) => b.heat - a.heat)
      .slice(0, 10);
  }, [rows]);

  if (me === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!me) return null;

  return (
    <div className="relative min-h-screen">
            <div className="relative z-10">
        <header className="border-b border-border/60 bg-white/60 backdrop-blur">
          <div className="container py-6">
            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/dashboard"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <h1 className="font-display text-xl font-bold tracking-tight">
                  Thống kê nhiệt độ 🔥
                </h1>
                <p className="text-sm text-muted-foreground">
                  Top 10 thành viên bị cảnh báo nhiệt độ vi phạm
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="container py-8">
          <div className="grid gap-1.5 sm:max-w-xs">
            <p className="text-xs text-muted-foreground">Chọn server</p>
            <Select value={guildId} onValueChange={setGuildId}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn server…" />
              </SelectTrigger>
              <SelectContent>
                {managed.map((g) => (
                  <SelectItem key={g.discordId} value={g.discordId}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {managed.length === 0 && (
            <Card className="mt-4 border-dashed">
              <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ShieldAlert className="h-6 w-6" />
                </span>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Bạn chưa quản lý server nào có bot — hãy mời bot vào server trước.
                </p>
              </CardContent>
            </Card>
          )}

          {guildId && rows === undefined && (
            <div className="mt-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}

          {guildId && rows === null && (
            <Card className="mt-4 border-dashed">
              <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10 text-danger">
                  <ShieldAlert className="h-6 w-6" />
                </span>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Không thể truy cập server này — bạn không có quyền quản lý.
                </p>
              </CardContent>
            </Card>
          )}

          {guildId && rows && (
            <Card className="mt-4">
              <CardContent className="p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-primary" />
                    <p className="font-display font-semibold">Bảng xếp hạng nhiệt độ</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selected?.icon && (
                      <img
                        src={discordGuildIconUrl({ id: selected.discordId, icon: selected.icon }) ?? ""}
                        alt=""
                        className="h-6 w-6 rounded-md"
                      />
                    )}
                    <Badge variant="secondary">{selected?.name ?? "—"}</Badge>
                  </div>
                </div>

                <p className="mb-4 text-xs text-muted-foreground">
                  Nhiệt giảm {HEAT_DEFAULTS.decayPerMin} điểm/phút — thành viên ngoan tự rời bảng
                  sau một lúc im giọng. ▪ {HEAT_DEFAULTS.warnAt} cảnh báo · ▪{" "}
                  {HEAT_DEFAULTS.timeoutAt} tạm khóa · ▪ {HEAT_DEFAULTS.kickAt} kick · ■{" "}
                  {HEAT_DEFAULTS.banAt} ban
                </p>

                {ranked.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-foreground">
                      <Trophy className="h-6 w-6" />
                    </span>
                    <p className="max-w-sm text-sm text-muted-foreground">
                      Không ai đang nóng đầu cả — server đang rất bình yên! 🌸
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {ranked.map((r, i) => {
                      const tier = tierOf(
                        r.heat,
                        HEAT_DEFAULTS.timeoutAt,
                        HEAT_DEFAULTS.kickAt,
                        HEAT_DEFAULTS.banAt,
                      );
                      return (
                        <li
                          key={r.userId}
                          className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                        >
                          <span className="w-7 shrink-0 text-center font-mono text-sm font-bold tabular-nums text-foreground">
                            {MEDAL[i] ?? i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-medium">{r.username}</p>
                              <Badge variant="outline" className={TIER_STYLE[tier]}>
                                {HEAT_TIER_LABEL[tier] ?? tier}
                              </Badge>
                              {(r.warnStrikes ?? 0) > 0 && (
                                <Badge variant="secondary" className="px-2 py-0.5 text-[10px]">
                                  {r.warnStrikes} lần cảnh báo
                                </Badge>
                              )}
                            </div>
                            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                              <div
                                className="heat-swirl h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.max(2, Math.min(100, r.heat))}%` }}
                              />
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-mono text-sm font-semibold tabular-nums">{r.heat}/100</p>
                            <p className="text-[11px] text-muted-foreground">{timeAgo(r.updatedAt)}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
