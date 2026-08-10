import { Flame } from "lucide-react";
import { Badge } from "../ui/badge";
import { HEAT_DEFAULTS, HEAT_TIER_LABEL } from "../../lib/constants";
import type { GuildData, HeatState } from "../../lib/types";

/** Nhiệt độ hiệu dụng sau khi trừ decay theo thời gian. */
export function effectiveHeat(
  heat: number,
  updatedAt: number,
  decayPerMin: number,
): number {
  const elapsedMin = (Date.now() - updatedAt) / 60000;
  return Math.max(0, Math.round(heat - elapsedMin * decayPerMin));
}

export function tierOf(
  heat: number,
  timeoutAt: number,
  kickAt: number,
  banAt: number,
): string {
  if (heat >= banAt) return "ban";
  if (heat >= kickAt) return "kick";
  if (heat >= timeoutAt) return "timeout";
  return "warn";
}

const TIER_STYLE: Record<string, string> = {
  warn: "bg-amber-500/15 text-amber-400",
  timeout: "bg-violet-500/15 text-violet-400",
  kick: "bg-orange-500/15 text-orange-400",
  ban: "bg-danger/15 text-danger",
};

function decayedStates(data: GuildData): HeatState[] {
  const decay = data.guild.heatDecayPerMin ?? HEAT_DEFAULTS.decayPerMin;
  return (data.heatStates || [])
    .map((h) => ({ ...h, heat: effectiveHeat(h.heat, h.updatedAt, decay) }))
    .filter((h) => h.heat > 0)
    .sort((a, b) => b.heat - a.heat);
}

/** Thanh phần trăm thể hiện mức an toàn của server. */
export function SafetyBar({ data }: { data: GuildData }) {
  const states = decayedStates(data);
  const maxHeat = states[0]?.heat ?? 0;
  const safety = Math.max(0, Math.min(100, 100 - maxHeat));
  const barColor =
    safety >= 70
      ? "from-emerald-500 to-teal-400"
      : safety >= 40
        ? "from-amber-500 to-orange-400"
        : "from-red-500 to-rose-400";
  const barText =
    safety >= 70
      ? "text-emerald-400"
      : safety >= 40
        ? "text-amber-400"
        : "text-red-400";

  return (
    <div className="grid gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-3xl font-bold tabular-nums">{safety}%</p>
          <p className="text-xs text-muted-foreground">mức an toàn của server</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>
            Nhiệt cao nhất: <span className={`font-semibold ${barText}`}>{maxHeat}/100</span>
          </p>
          <p>Nhiệt giảm {data.guild.heatDecayPerMin ?? HEAT_DEFAULTS.decayPerMin} điểm/phút</p>
        </div>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${barColor}`}
          style={{ width: `${safety}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>🔴 {data.guild.heatBanAt ?? HEAT_DEFAULTS.banAt} = ban</span>
        <span>🟠 {data.guild.heatKickAt ?? HEAT_DEFAULTS.kickAt} = kick</span>
        <span>🟣 {data.guild.heatTimeoutAt ?? HEAT_DEFAULTS.timeoutAt} = tạm khóa</span>
        <span>🟢 0 = an toàn</span>
      </div>
    </div>
  );
}

/** Danh sách thành viên đang có nhiệt độ cao nhất. */
export function TopOffenders({ data, limit = 5 }: { data: GuildData; limit?: number }) {
  const states = decayedStates(data).slice(0, limit);
  if (states.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-secondary/40 px-3 py-3 text-sm text-muted-foreground">
        <Flame className="h-4 w-4 text-emerald-400" />
        Chưa có ai vi phạm — server rất an toàn 🎉
      </div>
    );
  }
  const g = data.guild;
  return (
    <ul className="space-y-2">
      {states.map((h) => {
        const tier = tierOf(h.heat, g.heatTimeoutAt ?? 40, g.heatKickAt ?? 70, g.heatBanAt ?? 90);
        return (
          <li key={h.userId} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/40 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {h.username || `<@${h.userId}>`}
              </p>
              <p className="font-mono text-[11px] text-muted-foreground">{h.userId}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-sm font-semibold tabular-nums">{h.heat}/100</span>
              <Badge className={TIER_STYLE[tier]}>{HEAT_TIER_LABEL[tier]}</Badge>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
