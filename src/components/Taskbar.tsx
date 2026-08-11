import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ChevronRight,
  ExternalLink,
  Facebook,
  LayoutDashboard,
  Lock,
  MessageCircle,
  Moon,
  PanelRightOpen,
  ShieldCheck,
  Sun,
  User,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { usePublicConfig } from "../lib/usePublicConfig";
import { useBotStatus } from "../lib/useBotStatus";
import { getSessionToken } from "../lib/discord";
import { cn } from "../lib/utils";

type ThemeMode = "light" | "dark";

/**
 * Taskbar — cửa sổ dọc bo tròn gắn sát mép trái trang web, bấm nút để bật/tắt.
 * Chứa: chế độ tương phản sáng/tối, trạng thái nhanh của bot, nút đi tới trang
 * Giám sát bot, Cửa sổ Admin (chỉ chủ sở hữu bot thấy), thông tin chủ bot và
 * link Discord / Facebook.
 */
export default function Taskbar() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light";
    const saved = window.localStorage.getItem("protogon-theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  const status = useBotStatus();
  const { discordInvite, facebookUrl } = usePublicConfig();
  const token = getSessionToken();
  const isOwner = useQuery(api.status.isOwner, { token });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("protogon-theme", theme);
  }, [theme]);

  const ownerName = status?.ownerName ?? "wiothemilo";
  const ownerAvatar = status?.ownerAvatarUrl ?? null;
  const online = status?.online ?? false;
  const onMonitorPage = window.location.pathname.startsWith("/monitor");
  const onAdminPage = window.location.pathname.startsWith("/admin");

  return (
    <>
      {/* Nút bật/tắt — tab dọc bên trái trang web */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Đóng taskbar" : "Mở taskbar"}
        className={cn(
          "fixed left-0 top-1/2 z-50 flex -translate-y-1/2 items-center rounded-r-xl",
          "border border-l-0 border-white/50 bg-gradient-to-b from-[#8fc8ff] via-[#f79fc6] to-[#ffb3d1] p-0.5 pr-1",
          "shadow-[0_8px_30px_-6px_hsl(205_90%_55%/0.5)] transition-all hover:pr-1.5",
          open ? "pointer-events-none translate-x-[-110%] opacity-0" : "",
        )}
      >
        <span className="flex h-12 w-8 items-center justify-center rounded-l-lg bg-white/95 text-[#3d2a5c] shadow-inner">
          <PanelRightOpen className="h-5 w-5" />
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-[#3d2a5c]" />
      </button>

      {/* Cửa sổ dọc bo tròn gắn mép trái */}
      {open && (
        <div
          className={cn(
            "fixed left-0 top-1/2 z-50 flex max-h-[92vh] w-[min(90vw,20rem)] -translate-y-1/2 flex-col overflow-hidden",
            "rounded-r-2xl border border-primary/30 bg-card/95 shadow-2xl backdrop-blur",
            "animate-in slide-in-from-left-4 fade-in-0 duration-200",
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 bg-gradient-to-r from-[#8fc8ff] via-[#f79fc6] to-[#ffb3d1] px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-[#3d2a5c]">
              <PanelRightOpen className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="font-display text-sm font-bold leading-tight text-[#1d2f4d]">
                Taskbar Protogon
              </p>
              <p className="text-[11px] font-medium text-[#3a4a66]">
                Cửa sổ nhanh — bấm để bật/tắt
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Đóng taskbar"
              className="rounded-lg p-1.5 text-[#1d2f4d] transition-colors hover:bg-white/25"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[70vh] space-y-3 overflow-y-auto px-4 py-4">
            {/* Chế độ tương phản */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                {theme === "dark" ? (
                  <Moon className="h-4 w-4 text-primary" />
                ) : (
                  <Sun className="h-4 w-4 text-primary" />
                )}
                Chế độ tương phản
              </div>
              <button
                onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                  theme === "dark" ? "bg-primary" : "bg-muted-foreground/30",
                )}
                aria-label="Bật/tắt chế độ tối"
              >
                <span
                  className={cn(
                    "absolute top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition-all",
                    theme === "dark" ? "left-[22px]" : "left-0.5",
                  )}
                >
                  {theme === "dark" ? (
                    <Moon className="h-3 w-3 text-[#5c3a8f]" />
                  ) : (
                    <Sun className="h-3 w-3 text-amber-500" />
                  )}
                </span>
              </button>
            </div>

            {/* Trạng thái nhanh bot */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-xs">
              <span className="flex items-center gap-1.5 font-semibold">
                {online ? (
                  <Wifi className="h-4 w-4 text-emerald-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                Bot {online ? "Online" : "Offline"}
              </span>
              <span className="text-muted-foreground">
                {status ? `${status.guildCount} server` : "đang tải…"}
              </span>
            </div>

            {/* Điều hướng */}
            <div className="space-y-2">
              <Link
                to="/monitor"
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors",
                  onMonitorPage
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border bg-secondary/40 hover:bg-primary/10",
                )}
              >
                <Activity className="h-4 w-4" />
                Giám sát bot
                <span className="ml-auto text-[10px] text-muted-foreground">
                  biểu đồ · độ trễ · server
                </span>
              </Link>

              {/* Cửa sổ Admin — chỉ chủ sở hữu bot nhìn thấy */}
              {isOwner === true && (
                <Link
                  to="/admin"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors",
                    onAdminPage
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border bg-secondary/40 hover:bg-primary/10",
                  )}
                >
                  <Lock className="h-4 w-4" />
                  Cửa sổ Admin
                  <span className="ml-auto rounded-md bg-danger/10 px-1.5 py-0.5 text-[10px] font-bold text-danger">
                    ẨN
                  </span>
                </Link>
              )}

              <Link
                to="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-primary/10"
              >
                <LayoutDashboard className="h-4 w-4" />
                Bảng điều khiển
              </Link>
            </div>

            {/* Chủ sở hữu */}
            <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-3">
              {ownerAvatar ? (
                <img
                  src={ownerAvatar}
                  alt={ownerName}
                  className="h-11 w-11 rounded-full object-cover ring-2 ring-white/70"
                  draggable={false}
                />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#8fc8ff] to-[#f79fc6] text-white">
                  <User className="h-6 w-6" />
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Chủ sở hữu bot
                </p>
                <p className="truncate text-sm font-bold">{ownerName}</p>
                <p className="text-[11px] text-muted-foreground">
                  Cập nhật tự động 24/7 từ Discord
                </p>
              </div>
            </div>

            {/* Liên kết */}
            <div className="grid grid-cols-2 gap-2">
              <a
                href={discordInvite}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-indigo-400/40 bg-indigo-500/10 px-3 py-2.5 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-500/20 dark:text-indigo-300"
              >
                <MessageCircle className="h-4 w-4" /> Discord
                <ExternalLink className="h-3 w-3 opacity-60" />
              </a>
              <a
                href={facebookUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-sky-400/40 bg-sky-500/10 px-3 py-2.5 text-xs font-semibold text-sky-600 transition-colors hover:bg-sky-500/20 dark:text-sky-300"
              >
                <Facebook className="h-4 w-4" /> Facebook
                <ExternalLink className="h-3 w-3 opacity-60" />
              </a>
            </div>
          </div>

          {/* Chân taskbar */}
          <div className="flex items-center gap-2 border-t border-border/70 px-4 py-2.5 text-[10px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Cửa sổ Admin chỉ hiển thị với chủ sở hữu bot
          </div>
        </div>
      )}
    </>
  );
}
