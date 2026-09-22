import { useQuery } from "convex/react";
import { useState } from "react";
import {
  AppWindow,
  Bot,
  Clock,
  Database,
  Lock,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UserX,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import type { ExternalAppRaidIncident, GuildData } from "../../lib/types";
import { getSessionToken } from "../../lib/discord";
import { cn, timeAgo } from "../../lib/utils";

import { dateLocale, translate } from "../../lib/i18n";
const TOKEN = () => getSessionToken();

const ACTION_STYLE: Record<string, string> = {
  ban: "bg-danger/15 text-danger",
  "ban thất bại": "bg-danger/10 text-danger/80",
  kick: "bg-foreground/20 text-foreground border border-foreground/30",
  warn: "bg-secondary text-secondary-foreground border border-border",
  timeout: "bg-foreground/10 text-foreground border border-foreground/20",
};

function actionLabel(action: string | null): string {
  // Không có hình phạt cụ thể → nhãn chung, phải dịch được theo ngôn ngữ.
  if (!action) return translate("đã xử lý");
  return action;
}

function IncidentList({ guildId }: { guildId: string }) {
  const incidents = useQuery(api.antinuke.externalAppRaids, {
    token: TOKEN(),
    guildId,
  }) as ExternalAppRaidIncident[] | null | undefined;

  if (incidents === undefined) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-10 text-sm text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" /> {translate("Đang tải lịch sử…")}{" "}
      </div>
    );
  }

  if (incidents === null) {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
        {translate("Không thể đọc dữ liệu — bạn không có quyền quản lý server này.")}{" "}
      </div>
    );
  }

  const uniqueApps = new Set(incidents.flatMap((i) => i.apps.map((a) => a.appName).filter(Boolean)))
    .size;
  const uniqueUsers = new Set(
    incidents.flatMap((i) => i.punished.map((p) => p.userId).filter(Boolean)),
  ).size;
  const totalPunished = incidents.reduce((n, i) => n + i.punished.length, 0);

  if (incidents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-secondary/30 px-6 py-10 text-center">
        <AppWindow className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm font-medium">
          {translate("Chưa có vụ raid bằng ứng dụng ngoài nào bị chặn")}
        </p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          {translate("Khi bot phát hiện loạt kết nối ứng dụng ngoài vượt ngưỡng module")}{" "}
          <code className="font-mono text-[10px]">{translate("Raid bằng ứng dụng ngoài")}</code>{" "}
          {translate(
            "(hoặc một app đáng ngờ: giả mạo app nổi tiếng, tên scam, do tài khoản mới kết nối, app spam @everyone kèm link lừa đảo), vụ đó xuất hiện ở đây kèm kết luận của AI, danh sách ứng dụng và người dùng đã bị xử lý.",
          )}{" "}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Tóm tắt */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-3.5">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5" /> {translate("Vụ đã chặn")}{" "}
          </p>
          <p className="mt-1 font-display text-lg font-bold">{incidents.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3.5">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            <UserX className="h-3.5 w-3.5" /> {translate("Người dùng bị xử lý")}{" "}
          </p>
          <p className="mt-1 font-display text-lg font-bold">
            {totalPunished}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              ({uniqueUsers} {translate("người")})
            </span>
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3.5">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            <AppWindow className="h-3.5 w-3.5" /> {translate("App ngoài phát hiện")}{" "}
          </p>
          <p className="mt-1 font-display text-lg font-bold">{uniqueApps}</p>
        </div>
      </div>

      {/* Danh sách vụ */}
      <div className="mt-4 space-y-2.5">
        {incidents.map((s, i) => (
          <div
            key={`${s.createdAt}-${i}`}
            className="rounded-xl border border-border bg-secondary/50 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">
                  {new Date(s.createdAt).toLocaleString(dateLocale(), {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-muted-foreground">({timeAgo(s.createdAt)})</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {s.lockdownTriggered && (
                  <Badge variant="danger" className="gap-1 px-2 py-0.5 text-[10px]">
                    <Lock className="h-3 w-3" /> {translate("Đã khóa kênh")}{" "}
                  </Badge>
                )}
                {s.aiClassification && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "gap-1 px-2 py-0.5 text-[10px]",
                      s.aiClassification === "raid"
                        ? "bg-danger text-danger-foreground"
                        : s.aiClassification === "benign"
                          ? "bg-secondary text-secondary-foreground border border-border"
                          : "bg-foreground/10 text-foreground border border-foreground/20",
                    )}
                  >
                    <Sparkles className="h-3 w-3" />
                    AI: {s.aiClassification}
                    {s.aiConfidence != null ? ` ${Math.round(s.aiConfidence * 100)}%` : ""}
                  </Badge>
                )}
                <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-[10px]">
                  <Database className="h-3 w-3" /> {s.count} {translate("kết nối")} /{" "}
                  {s.windowSeconds}s
                </Badge>
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {/* App gì */}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {translate("Ứng dụng ngoài được kết nối")}{" "}
                </p>
                {s.apps.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {translate("Chưa xác định được tên app")}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {s.apps.slice(0, 5).map((a, j) => (
                      <li
                        key={`${a.appName}-${j}`}
                        className="flex flex-wrap items-center gap-1.5 text-xs"
                      >
                        <span className="flex items-center gap-1.5 rounded-lg bg-secondary/50 px-2 py-1">
                          <Bot className="h-3 w-3 text-primary" />
                          <span className="font-mono text-[11px]">{a.appName ?? "?"}</span>
                        </span>
                        {a.executorName && (
                          <span className="text-muted-foreground">
                            {translate("bởi")} {a.executorName}
                          </span>
                        )}
                      </li>
                    ))}
                    {s.apps.length > 5 && (
                      <li className="text-[11px] text-muted-foreground">
                        +{s.apps.length - 5} {translate("app khác…")}
                      </li>
                    )}
                  </ul>
                )}
              </div>

              {/* Ai bị xử lý */}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {translate("Người dùng đã bị xử lý")}{" "}
                </p>
                {s.punished.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {s.action && s.action.length > 0
                      ? translate("Chưa xác định được người dùng — chỉ ghi nhận")
                      : translate("Không có")}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {s.punished.map((p, j) => (
                      <li
                        key={`${p.userId}-${j}`}
                        className="flex flex-wrap items-center gap-1.5 text-xs"
                      >
                        <span className="font-medium">{p.username ?? p.userId ?? "?"}</span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "px-2 py-0 text-[10px]",
                            ACTION_STYLE[p.action ?? ""] ?? "bg-secondary text-muted-foreground",
                          )}
                        >
                          {actionLabel(p.action)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {s.suspectedSourceName && (
              <p
                className={cn(
                  "mt-3 text-xs",
                  s.banned ? "text-danger font-semibold" : "text-foreground",
                )}
              >
                🎯 {translate(s.banned ? "Đã ban nguồn cơn:" : "Nghi phạm nguồn cơn:")}{" "}
                {s.suspectedSourceName}
                {s.reason ? ` — ${s.reason}` : ""}
              </p>
            )}
            {s.aiReason && (
              <p className="mt-1.5 text-[11px] italic text-muted-foreground">🤖 {s.aiReason}</p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

export default function ExternalAppRaidsPanel({ data }: { data: GuildData }) {
  const [refreshAt, setRefreshAt] = useState(0);
  const refresh = () => setRefreshAt((n) => n + 1);
  const moduleCfg = data.modules.find((m) => m.module === "externalAppRaid");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">
            {translate("Raid bằng ứng dụng ngoài")}
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {translate("Danh sách các vụ bot đã chặn khi loạt")}{" "}
            <b className="text-foreground">external app</b>{" "}
            {translate("(ứng dụng mở rộng) được kết nối ồ ạt hoặc app spam vào server — kèm")}{" "}
            <b className="text-foreground">{translate("AI nhận diện")}</b>{" "}
            {translate(
              "người dùng app có đang raid không. AI học các dạng raid app ngoài (tài khoản phụ cài app, app giả mạo hoặc tên scam, spam @everyone kèm link lừa đảo, webhook spam) để chặn cả biến thể tương tự: app nào được kết nối, ai đã bị xử lý.",
            )}{" "}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> {translate("Tải lại")}{" "}
        </Button>
      </div>

      {moduleCfg && !moduleCfg.enabled && (
        <div className="rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-foreground">
          ⚠️ Module <b>{translate("Raid bằng ứng dụng ngoài")}</b>{" "}
          {translate("đang tắt — bật lại trong mục")}{" "}
          <b>{translate("Chống nuke / raid → Thành viên & quyền")}</b>{" "}
          {translate("để bot tiếp tục chặn.")}{" "}
        </div>
      )}

      {/* Remount theo refreshAt để ép tải lại danh sách */}
      <IncidentList key={refreshAt} guildId={data.guild.discordId} />
    </div>
  );
}
