import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  Bot,
  ExternalLink,
  Flame,
  Hash,
  History,
  MessageSquareReply,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { buildBotInviteUrl } from "../../lib/discord";
import { usePublicConfig } from "../../lib/usePublicConfig";
import { timeAgo } from "../../lib/utils";
import { ANTINUKE_MODULE_META } from "../../lib/constants";
import { SafetyBar, TopOffenders } from "./HeatBar";
import type { AntiNukeEvent, GuildData } from "../../lib/types";

function RecentEvents({ data }: { data: GuildData }) {
  const token = localStorage.getItem("wio_session_token") ?? "";
  const recent = useQuery(api.reports.recentForGuild, {
    token,
    guildId: data.guild.discordId,
    limit: 8,
  }) as AntiNukeEvent[] | null | undefined;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-display font-semibold">
            <ShieldAlert className="h-4 w-4 text-primary" /> Hoạt động chống nuke gần đây
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              Báo cáo hàng ngày: {data.guild.dailyReportEnabled ? "Bật" : "Tắt"}
              {data.guild.lastReportAt ? ` · lần cuối ${timeAgo(data.guild.lastReportAt)}` : ""}
            </Badge>
            <Link to={`/dashboard/${data.guild.discordId}/history`}>
              <Button variant="outline" size="sm">
                <History className="h-3.5 w-3.5" /> Xem lịch sử
              </Button>
            </Link>
          </div>
        </div>
        {recent === undefined ? (
          <div className="mt-4 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-secondary/50" />
            ))}
          </div>
        ) : !recent || recent.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Chưa có sự kiện nào — bot chưa xử lý vi phạm chống nuke nào tại server này.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {recent.map((e) => (
              <li key={`${e.createdAt}-${e.module}`} className="flex items-center gap-3 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger/10 text-danger">
                  <ShieldAlert className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {ANTINUKE_MODULE_META[e.module]?.label ?? e.module}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {e.count} lượt · {e.windowSeconds}s
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.action}
                    {e.executorName
                      ? ` · thủ phạm ${e.executorName}`
                      : e.executorId
                        ? ` · thủ phạm <@${e.executorId}>`
                        : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function OverviewPanel({ data }: { data: GuildData }) {
  const { clientId } = usePublicConfig();
  const enabledModules = data.modules.filter((m) => m.enabled).length;
  const logChannel = data.channels.find((c) => c.channelId === data.guild.logChannelId);

  const stats = [
    {
      icon: MessageSquareReply,
      label: "Rule auto reply",
      value: data.autoReplies.length,
      sub: `${data.autoReplies.filter((r) => r.enabled).length} đang bật`,
      tone: "text-primary bg-primary/15",
    },
    {
      icon: ShieldCheck,
      label: "Module chống nuke",
      value: `${enabledModules}/${data.modules.length}`,
      sub: data.guild.antinukeEnabled ? "Đang bảo vệ" : "Đã tắt toàn bộ",
      tone: "text-emerald-400 bg-emerald-500/15",
    },
    {
      icon: Users,
      label: "Thành viên",
      value: data.guild.memberCount?.toLocaleString("vi-VN") ?? "?",
      sub: "đồng bộ qua bot",
      tone: "text-violet-400 bg-violet-500/15",
    },
    {
      icon: Hash,
      label: "Kênh log",
      value: logChannel ? `#${logChannel.name}` : "Chưa đặt",
      sub: logChannel ? "cảnh báo & sự kiện" : "đặt trong Cài đặt",
      tone: "text-amber-400 bg-amber-500/15",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="card-hover">
            <CardContent className="p-5">
              <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${s.tone}`}>
                <s.icon className="h-5 w-5" />
              </span>
              <p className="font-display text-2xl font-bold">{s.value}</p>
              <p className="mt-0.5 text-xs font-medium text-foreground/80">{s.label}</p>
              <p className="text-xs text-muted-foreground">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-orange-500/25 bg-gradient-to-br from-orange-500/10 via-transparent to-rose-500/5">
        <CardContent className="grid gap-6 p-5 lg:grid-cols-2">
          <div className="flex flex-col justify-center gap-3">
            <h3 className="flex items-center gap-2 font-display font-semibold">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/15 text-orange-400">
                <Flame className="h-4 w-4" />
              </span>
              Mức an toàn của server
            </h3>
            <p className="text-sm text-muted-foreground">
              Dựa trên tổng nhiệt độ & warn tích lũy của các thành viên. Vi phạm càng
              nhiều, nhiệt càng cao và mức an toàn càng giảm — khi chạm ngưỡng, hình phạt
              tự tăng cấp (cảnh báo → tạm khóa → kick → ban) và tái phạm sẽ bị nhân đôi nhiệt.
            </p>
            <SafetyBar data={data} />
          </div>
          <div>
            <h4 className="mb-3 text-sm font-medium text-muted-foreground">
              🔥 Thành viên có nhiệt độ cao nhất
            </h4>
            <TopOffenders data={data} limit={6} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`relative flex h-10 w-10 items-center justify-center rounded-lg ${
                data.guild.botInGuild
                  ? "bg-primary/15 text-primary"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              <Bot className="h-5 w-5" />
              {data.guild.botInGuild && (
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-400" />
              )}
            </span>
            <div>
              <p className="font-display font-semibold">
                Trạng thái bot
                <Badge variant={data.guild.botInGuild ? "success" : "danger"} className="ml-2">
                  {data.guild.botInGuild ? "Trực tuyến" : "Không hoạt động"}
                </Badge>
              </p>
              <p className="text-xs text-muted-foreground">
                Lần cuối đồng bộ: {timeAgo(data.guild.lastHeartbeat)} · prefix{" "}
                <code className="font-mono text-primary">{data.guild.prefix}</code>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {clientId && (
              <a href={buildBotInviteUrl(clientId)} target="_blank" rel="noreferrer">
                <Button variant="secondary" size="sm">
                  <ExternalLink className="h-4 w-4" /> Mời bot
                </Button>
              </a>
            )}
            <a
              href={`https://discord.com/channels/${data.guild.discordId}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="secondary" size="sm">
                <ArrowLeft className="h-4 w-4 rotate-180" /> Mở Discord
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      <RecentEvents data={data} />

      <Card>
        <CardContent className="p-5">
          <h3 className="font-display font-semibold">Ghi chú nhanh 🌸</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              Rule auto reply dùng placeholder <code className="font-mono text-xs">{"{user}"}</code> để
              tag người nhắn, <code className="font-mono text-xs">{"{username}"}</code> để lấy tên họ.
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              Bảng nhiệt & warn bên Moderation có nút xóa nhiệt từng người hoặc toàn bộ.
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              Join Gate (sidebar) chặn selfbot: tài khoản quá mới, thiếu avatar/huy hiệu.
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              Module "Chống link độc hại & file nguy hiểm" quét domain scam + file đuôi .exe/.scr…
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              Thay đổi cấu hình được bot đồng bộ tự động trong vòng ~30 giây.
            </li>
            <li className="flex gap-2">
              <span className="text-primary">•</span>
              Mod/Admin trong danh sách Cài đặt sẽ được miễn trừ khỏi chống nuke.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
