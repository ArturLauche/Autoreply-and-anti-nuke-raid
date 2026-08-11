import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import {
  Bot,
  Loader2,
  LogOut,
  Plus,
  Server,
  ShieldAlert,
  Users,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import CherryBlossom from "../components/CherryBlossom";
import HaimiyaChat from "../components/HaimiyaChat";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import {
  buildBotInviteUrl,
  clearSessionToken,
  discordAvatarUrl,
  discordGuildIconUrl,
  getSessionToken,
} from "../lib/discord";
import { usePublicConfig } from "../lib/usePublicConfig";
import type { MeData } from "../lib/types";
import { toast } from "sonner";

export default function Dashboard() {
  const navigate = useNavigate();
  const token = getSessionToken();
  const me = useQuery(api.sessions.me, { token }) as MeData | null | undefined;
  const logout = useMutation(api.sessions.logout);
  const { clientId } = usePublicConfig();

  if (me === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!me) return null;

  async function handleLogout() {
    await logout({ token });
    clearSessionToken();
    navigate("/");
  }

  const avatar = discordAvatarUrl({ id: me.user.discordId, avatar: me.user.avatar });
  const managed = me.guilds;
  const onlineCount = managed.filter(
    (g) => g.botInGuild && g.lastHeartbeat && Date.now() - g.lastHeartbeat < 180_000,
  ).length;
  const totalMembers = managed.reduce((a, g) => a + (g.memberCount ?? 0), 0);

  return (
    <div className="relative min-h-screen">
      <CherryBlossom count={10} />
      <HaimiyaChat position="dashboard" />
      <div className="relative z-10">
        <header className="sticky top-0 z-40 border-b border-border/60 bg-white/70 backdrop-blur-xl">
          <div className="container flex h-16 items-center justify-between">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff8fab] to-[#c84b8f] shadow-[0_0_20px_-4px_hsl(342_92%_66%/0.8)]">
                <Bot className="h-5 w-5" />
              </span>
              <span className="font-display text-lg font-bold">Protogon<span className="text-primary">.</span></span>
            </button>
            <div className="flex items-center gap-3">
              {avatar ? (
                <img src={avatar} alt={me.user.username} className="h-8 w-8 rounded-full ring-2 ring-primary/50" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                  {me.user.username.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="hidden text-sm text-muted-foreground sm:block">
                {me.user.globalName ?? me.user.username}
              </span>
              <Button variant="ghost" size="icon-sm" onClick={handleLogout} title="Đăng xuất">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="container py-10">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold tracking-tight">Bảng điều khiển 🌸</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Chọn server để cấu hình auto reply, nhiệt độ, Join Gate, chống nuke và các module bảo vệ.
            </p>
          </div>

          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <Card className="card-hover">
              <CardContent className="flex items-center gap-4 p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Server className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-2xl font-bold font-display">{managed.length}</p>
                  <p className="text-xs text-muted-foreground">Server quản lý</p>
                </div>
              </CardContent>
            </Card>
            <Card className="card-hover">
              <CardContent className="flex items-center gap-4 p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <Bot className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-2xl font-bold font-display">
                    {onlineCount}/{managed.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Bot đang trực tuyến</p>
                </div>
              </CardContent>
            </Card>
            <Card className="card-hover">
              <CardContent className="flex items-center gap-4 p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
                  <Users className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-2xl font-bold font-display">{totalMembers.toLocaleString("vi-VN")}</p>
                  <p className="text-xs text-muted-foreground">Tổng thành viên</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {managed.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Plus className="h-7 w-7" />
                </span>
                <div>
                  <h2 className="font-display text-xl font-semibold">Chưa có server nào</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                    Mời Protogon vào server của bạn rồi quay lại đây. Cần quyền{" "}
                    <b className="text-foreground">Quản lý server</b> để chỉnh cấu hình.
                  </p>
                </div>
                {clientId && (
                  <a href={buildBotInviteUrl(clientId)} target="_blank" rel="noreferrer">
                    <Button size="lg">Mời bot vào server</Button>
                  </a>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">Server của bạn</h2>
                {clientId && (
                  <a href={buildBotInviteUrl(clientId)} target="_blank" rel="noreferrer">
                    <Button variant="secondary" size="sm">
                      <Plus className="h-4 w-4" /> Thêm server
                    </Button>
                  </a>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {managed.map((guild) => {
                  const icon = discordGuildIconUrl({ id: guild.discordId, icon: guild.icon });
                  const online =
                    guild.botInGuild &&
                    guild.lastHeartbeat !== null &&
                    Date.now() - guild.lastHeartbeat < 180_000;
                  return (
                    <Card key={guild.discordId} className="card-hover overflow-hidden">
                      <div className="h-1 w-full bg-gradient-to-r from-[#ff8fab] via-[#f2629e] to-[#c48bf5]" />
                      <CardContent className="p-5">
                        <div className="flex items-start gap-3">
                          {icon ? (
                            <img src={icon} alt="" className="h-12 w-12 rounded-xl" />
                          ) : (
                            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary font-display text-lg font-bold text-muted-foreground">
                              {guild.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-display font-semibold">{guild.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {guild.memberCount?.toLocaleString("vi-VN") ?? "?"} thành viên · prefix{" "}
                              <code className="font-mono text-primary">{guild.prefix}</code>
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          {guild.botInGuild ? (
                            <Badge variant={online ? "success" : "secondary"}>
                              <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-muted-foreground"}`} />
                              Bot {online ? "online" : "offline"}
                            </Badge>
                          ) : (
                            <Badge variant="danger">Chưa thêm bot</Badge>
                          )}
                          <Badge variant={guild.antinukeEnabled ? "default" : "secondary"}>
                            <ShieldAlert className="h-3 w-3" />
                            {guild.antinukeEnabled ? "Chống nuke bật" : "Chống nuke tắt"}
                          </Badge>
                        </div>
                        <div className="mt-4">
                          <Button
                            className="w-full"
                            variant={guild.botInGuild ? "default" : "secondary"}
                            onClick={() => {
                              if (!guild.botInGuild && clientId) {
                                toast("Mời bot vào server trước khi quản lý", {
                                  description: "Bạn sẽ được chuyển tới trang mời bot.",
                                });
                                window.open(buildBotInviteUrl(clientId), "_blank");
                                return;
                              }
                              navigate(`/dashboard/${guild.discordId}`);
                            }}
                          >
                            {guild.botInGuild ? "Quản lý" : "Mời bot"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
