import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  Bot,
  DoorOpen,
  ExternalLink,
  LayoutDashboard,
  Loader2,
  MessageSquareReply,
  Settings,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import CherryBlossom from "../components/CherryBlossom";
import HaimiyaChat from "../components/HaimiyaChat";
import { api } from "../../convex/_generated/api";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/utils";
import { buildBotInviteUrl, discordGuildIconUrl, SESSION_TOKEN_KEY } from "../lib/discord";
import { usePublicConfig } from "../lib/usePublicConfig";
import { timeAgo } from "../lib/utils";
import type { GuildData } from "../lib/types";
import OverviewPanel from "../components/dashboard/OverviewPanel";
import AutoReplyPanel from "../components/dashboard/AutoReplyPanel";
import AntiNukePanel from "../components/dashboard/AntiNukePanel";
import ModerationPanel from "../components/dashboard/ModerationPanel";
import JoinGatePanel from "../components/dashboard/JoinGatePanel";
import SettingsPanel from "../components/dashboard/SettingsPanel";

type SectionKey = "overview" | "moderation" | "joingate" | "antinuke" | "autoreply" | "settings";

const NAV_ITEMS: { key: SectionKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Tổng quan", icon: LayoutDashboard },
  { key: "moderation", label: "Moderation", icon: ShieldCheck },
  { key: "joingate", label: "Join Gate", icon: DoorOpen },
  { key: "antinuke", label: "Chống nuke / raid", icon: ShieldAlert },
  { key: "autoreply", label: "Auto Reply", icon: MessageSquareReply },
  { key: "settings", label: "Cài đặt", icon: Settings },
];

export default function GuildPage() {
  const { guildId = "" } = useParams();
  const [section, setSection] = useState<SectionKey>("overview");
  const token = localStorage.getItem(SESSION_TOKEN_KEY) ?? "";
  const data = useQuery(api.guilds.getGuild, { token, guildId }) as GuildData | null | undefined;
  const { clientId } = usePublicConfig();

  if (data === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="font-display text-lg font-semibold">Không thể truy cập server này</p>
        <p className="text-sm text-muted-foreground">
          Bạn không có quyền quản lý, hoặc bot chưa đồng bộ server này.
        </p>
        <Link to="/dashboard" className="text-sm text-primary hover:underline">
          ← Về danh sách server
        </Link>
      </div>
    );
  }

  const icon = discordGuildIconUrl({ id: data.guild.discordId, icon: data.guild.icon });
  const online =
    data.guild.botInGuild &&
    data.guild.lastHeartbeat !== null &&
    Date.now() - data.guild.lastHeartbeat < 180_000;

  return (
    <div className="relative min-h-screen bg-background">
      <CherryBlossom count={10} />
      <HaimiyaChat position="dashboard" />
      <div className="relative z-10">
      <header className="border-b border-border/60 bg-card/50 backdrop-blur">
        <div className="container py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                to="/dashboard"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              {icon ? (
                <img src={icon} alt="" className="h-12 w-12 rounded-2xl" />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary font-display text-lg font-bold text-muted-foreground">
                  {data.guild.name.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight">{data.guild.name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono">{data.guild.prefix} prefix</Badge>
                  <Badge variant="secondary">
                    {data.guild.memberCount?.toLocaleString("vi-VN") ?? "?"} thành viên
                  </Badge>
                  <Badge variant={data.guild.antinukeEnabled ? "default" : "secondary"}>
                    <ShieldAlert className="h-3 w-3" />
                    {data.guild.antinukeEnabled ? "Chống nuke bật" : "Chống nuke tắt"}
                  </Badge>
                  <Badge variant={online ? "success" : "secondary"}>
                    <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-muted-foreground"}`} />
                    Bot {online ? "online" : "offline"} · {timeAgo(data.guild.lastHeartbeat)}
                  </Badge>
                </div>
              </div>
            </div>
            {clientId && (
              <a href={buildBotInviteUrl(clientId)} target="_blank" rel="noreferrer">
                <Badge variant="secondary" className="cursor-pointer px-3 py-1.5">
                  <Bot className="h-3.5 w-3.5" /> Mời thêm
                </Badge>
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
          {/* Sidebar */}
          <aside className="h-fit lg:sticky lg:top-6">
            <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card/50 p-1.5 lg:flex-col lg:overflow-visible">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = section === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setSection(item.key)}
                    className={cn(
                      "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
            <div className="mt-4 hidden rounded-xl border border-primary/25 bg-gradient-to-b from-primary/10 to-transparent p-4 text-xs text-muted-foreground lg:block">
              <p className="mb-2 font-medium text-foreground">🌸 Haimiya gợi ý</p>
              <p>• Moderation = spam tin, mention, từ xấu, ảnh/file, link mời + link độc hại.</p>
              <p className="mt-1">• Join Gate = chặn selfbot khi vào server.</p>
              <p className="mt-1">• Nuke/raid phạt trực tiếp, không cộng nhiệt.</p>
              <p className="mt-1">• Bảng nhiệt & warn có nút xóa từng người.</p>
              <p className="mt-1">• Thay đổi áp dụng trong ~30 giây.</p>
            </div>
          </aside>

          {/* Content */}
          <div>
            {section === "overview" && <OverviewPanel data={data} />}
            {section === "moderation" && <ModerationPanel data={data} />}
            {section === "joingate" && <JoinGatePanel data={data} />}
            {section === "antinuke" && <AntiNukePanel data={data} />}
            {section === "autoreply" && <AutoReplyPanel data={data} />}
            {section === "settings" && <SettingsPanel data={data} />}

            <div className="mt-10 flex justify-center">
              <a
                href={`https://discord.com/channels/${data.guild.discordId}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Mở Discord server
              </a>
            </div>
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}
