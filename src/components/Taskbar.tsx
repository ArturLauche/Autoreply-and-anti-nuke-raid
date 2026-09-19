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
 * Taskbar — thanh dọc bo tròn chạy dọc sát mép trái trang web (chỉ hiển thị
 * trên trang giao diện ban đầu), bấm nút để bật/tắt. Chứa: chế độ tương phản
 * sáng/tối, trạng thái nhanh của bot, nút đi tới trang Giám sát bot, Cửa sổ
 * Admin (chỉ chủ sở hữu bot thấy), thông tin chủ bot và link Discord / Facebook.
 */
export default function Taskbar() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light";
    const saved = window.localStorage.getItem("protogon-theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const status = useBotStatus();
  const { discordInvite, facebookUrl } = usePublicConfig();
  const token = getSessionToken();
  // Chưa đăng nhập → skip subscription (tiết kiệm hạn mức, tránh re-subscribe vô nghĩa).
  const isOwner = useQuery(api.status.isOwner, token ? { token } : "skip");

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
      {/* Nút bật/tắt — thanh dọc dài bám sát mép trái trên desktop;
          trên điện thoại thu gọn thành nút tròn nhỏ ở góc dưới trái để không
          che nội dung trang chủ */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Đóng taskbar" : "Mở taskbar"}
        className={cn(
          "group fixed z-50 flex flex-col items-center",
          // Desktop: thanh dọc chạy dọc mép trái
          "left-0 top-3 bottom-3 w-12 rounded-r-2xl",
          // Mobile: nút nhỏ gọn ở góc dưới trái (không che nội dung)
          // + né vùng gestures/pin của máy tai thỏ (safe-area).
          "left-3 bottom-3 top-auto h-12 w-12 rounded-2xl",
          "max-md:[left:max(0.75rem,env(safe-area-inset-left))] max-md:[bottom:max(0.75rem,env(safe-area-inset-bottom))]",
          "md:left-0 md:top-3 md:bottom-3 md:h-auto md:w-12 md:rounded-r-2xl",
          "border border-border bg-card p-[2px]",
          "shadow-lg transition-all duration-300",
          "hover:shadow-md",
          open ? "pointer-events-none translate-x-[-110%] opacity-0" : "",
        )}
      >
        <span className="relative flex h-full w-full flex-col items-center overflow-hidden rounded-2xl border border-border bg-card md:rounded-r-[14px]">
          {/* Icon — phẳng, border-first, không hiệu ứng phát sáng */}
          <span className="relative mt-3 flex h-11 w-11 items-center justify-center max-md:mt-0 max-md:h-full max-md:w-full">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-primary-foreground transition-opacity duration-200 group-hover:opacity-80 max-md:h-9 max-md:w-9">
              <PanelRightOpen className="h-5 w-5" />
            </span>
          </span>

          {/* Vạch chia mảnh (chỉ desktop) */}
          <span className="mt-3 hidden h-px w-6 bg-border md:block" />

          {/* Chữ dọc hai dòng (chỉ desktop) */}
          <span className="mt-3 hidden flex-1 flex-col items-center gap-2 text-foreground md:flex">
            <span className="[writing-mode:vertical-rl] rotate-180 font-display text-[11px] font-bold tracking-[0.35em]">
              Taskbar
            </span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
            <span className="[writing-mode:vertical-rl] rotate-180 font-display text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
              Protogon
            </span>
          </span>

          {/* Mũi tên dưới cùng (chỉ desktop) */}
          <span className="mb-3 hidden h-6 w-6 items-center justify-center rounded-full bg-secondary text-foreground shadow-inner transition-transform duration-300 group-hover:translate-x-0.5 md:flex">
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </span>
      </button>

      {/* Thanh dọc bo tròn chạy dọc mép trái */}
      {open && (
        <div
          className={cn(
            "fixed left-0 top-2 bottom-2 z-50 flex w-[min(90vw,20rem)] flex-col overflow-hidden",
            "rounded-r-2xl border border-border bg-card shadow-lg backdrop-blur",
            "animate-in slide-in-from-left-4 fade-in-0 duration-200",
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-border bg-secondary px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-primary-foreground">
              <PanelRightOpen className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="font-display text-sm font-bold leading-tight text-foreground">
                Taskbar Protogon
              </p>
              <p className="text-[11px] font-medium text-muted-foreground">
                Cửa sổ nhanh — bấm để bật/tắt
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Đóng taskbar"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
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
                    "absolute top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-background shadow transition-all",
                    theme === "dark" ? "left-[22px]" : "left-0.5",
                  )}
                >
                  {theme === "dark" ? (
                    <Moon className="h-3 w-3 text-foreground" />
                  ) : (
                    <Sun className="h-3 w-3" />
                  )}
                </span>
              </button>
            </div>

            {/* Trạng thái nhanh bot */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-xs">
              <span className="flex items-center gap-1.5 font-semibold">
                {online ? (
                  <Wifi className="h-4 w-4" />
                ) : (
                  <WifiOff className="h-4 w-4 text-danger" />
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
                    ? "border-foreground bg-foreground text-primary-foreground"
                    : "border-border bg-secondary/40 hover:border-foreground/40",
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
                className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm font-semibold transition-colors hover:border-foreground/40"
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
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
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
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
              >
                <MessageCircle className="h-4 w-4" /> Discord
                <ExternalLink className="h-3 w-3 opacity-60" />
              </a>
              <a
                href={facebookUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
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
