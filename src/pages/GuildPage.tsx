import { useParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { ArrowLeft, Bot, ExternalLink, Loader2, ShieldAlert } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { buildBotInviteUrl, discordGuildIconUrl, SESSION_TOKEN_KEY } from "../lib/discord";
import { usePublicConfig } from "../lib/usePublicConfig";
import { timeAgo } from "../lib/utils";
import type { GuildData } from "../lib/types";
import OverviewPanel from "../components/dashboard/OverviewPanel";
import AutoReplyPanel from "../components/dashboard/AutoReplyPanel";
import AntiNukePanel from "../components/dashboard/AntiNukePanel";
import SettingsPanel from "../components/dashboard/SettingsPanel";

export default function GuildPage() {
  const { guildId = "" } = useParams();
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
    <div className="min-h-screen bg-background">
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
        <Tabs defaultValue="overview">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="overview">Tổng quan</TabsTrigger>
            <TabsTrigger value="autoreply">Auto Reply</TabsTrigger>
            <TabsTrigger value="antinuke">Anti Nuke</TabsTrigger>
            <TabsTrigger value="settings">Cài đặt</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <OverviewPanel data={data} />
          </TabsContent>
          <TabsContent value="autoreply">
            <AutoReplyPanel data={data} />
          </TabsContent>
          <TabsContent value="antinuke">
            <AntiNukePanel data={data} />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsPanel data={data} />
          </TabsContent>
        </Tabs>

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
      </main>
    </div>
  );
}
