import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  ExternalLink,
  Facebook,
  LayoutDashboard,
  Lock,
  MessageCircle,
  Moon,
  PanelLeft,
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
import LangSwitch from "./LangSwitch";

import { translate } from "../lib/i18n";
type ThemeMode = "light" | "dark";

/**
 * Taskbar — widget nhanh cố định ở mép trái. Trigger là pill nhỏ gọn (icon +
 * chấm trạng thái bot), mở panel điều khiển: đổi giao diện sáng/tối, trạng
 * thái bot, điều hướng nhanh, chủ bot, link cộng đồng. Panel đóng được bằng
 * Escape, click ra ngoài, hay nút X; chuyển cảnh trượt mượt, hỗ trợ people
 * bật giảm chuyển động.
 */
export default function Taskbar() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();

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

  // Escape đóng panel; đưa focus về nút mở (accessibility).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const closePanel = useCallback(() => setOpen(false), []);

  const ownerName = status?.ownerName ?? "wiothemilo";
  const ownerAvatar = status?.ownerAvatarUrl ?? null;
  const online = status?.online ?? false;
  const onMonitorPage = location.pathname.startsWith("/monitor");
  const onAdminPage = location.pathname.startsWith("/admin");

  return (
    <>
      {/* Backdrop mờ — click ra ngoài là đóng. Không hiện trên desktop (panel
          nằm sát mép, không che nội dung lắm), chỉ mobile. */}
      {open && (
        <button
          aria-label={translate("Đóng taskbar")}
          onClick={closePanel}
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] md:hidden"
        />
      )}

      {/* ── Nút mở: pill dọc nhỏ gọn bám mép trái ── */}
      <button
        ref={triggerRef}
        onClick={() => setOpen(true)}
        aria-label={translate("Mở bảng điều khiển nhanh")}
        aria-expanded={open}
        className={cn(
          "group fixed z-50 flex flex-col items-center gap-2.5 rounded-r-xl border border-border bg-card py-3 transition-all duration-200",
          "left-0 top-24 w-10 md:top-28",
          "shadow-sm hover:border-foreground/30 hover:shadow-md",
          "max-md:[top:max(5.5rem,calc(env(safe-area-inset-top)+5rem))]",
          open ? "pointer-events-none -translate-x-full opacity-0" : "",
        )}
      >
        <PanelLeft className="h-4 w-4 text-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
        {/* Chấm trạng thái bot — xanh xám/đen, offline thì danger */}
        <span className="relative flex h-2 w-2">
          {online ? (
            <>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-foreground" />
            </>
          ) : (
            <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
          )}
        </span>
        <span className="hidden text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground [writing-mode:vertical-rl] md:block">
          Menu
        </span>
      </button>

      {/* ── Panel điều khiển ── */}
      {open && (
        <aside
          ref={panelRef}
          role="dialog"
          aria-label={translate("Bảng điều khiển nhanh")}
          className={cn(
            "fixed left-0 top-0 bottom-0 z-50 flex w-[min(88vw,19rem)] flex-col overflow-hidden border-r border-border bg-card shadow-xl",
            "motion-safe:animate-in motion-safe:slide-in-from-left motion-safe:fade-in motion-safe:duration-200",
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-primary-foreground">
              <PanelLeft className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <p className="font-display text-sm font-bold leading-tight text-foreground">
                Protogon
              </p>
              <p className="text-[11px] text-muted-foreground">
                {translate("Bảng điều khiển nhanh")}
              </p>
            </div>
            <button
              onClick={closePanel}
              aria-label={translate("Đóng")}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {/* Giao diện sáng/tối — segmented control thay toggle tròn */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {translate("Giao diện")}{" "}
              </p>
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-secondary/50 p-1">
                {(
                  [
                    ["light", "Sáng", Sun],
                    ["dark", "Tối", Moon],
                  ] as const
                ).map(([mode, label, Icon]) => (
                  <button
                    key={mode}
                    onClick={() => setTheme(mode)}
                    aria-pressed={theme === mode}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                      theme === mode
                        ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" /> {translate(label)}
                  </button>
                ))}
              </div>
            </div>

            {/* Ngôn ngữ — đổi ngay, không cần tải lại trang */}
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {translate("Ngôn ngữ")}
              </p>
              <LangSwitch showIcon />
            </div>

            {/* Trạng thái bot */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm font-medium">
                {online ? (
                  <Wifi className="h-4 w-4 text-foreground" />
                ) : (
                  <WifiOff className="h-4 w-4 text-danger" />
                )}
                Bot {online ? translate("đang chạy") : translate("mất kết nối")}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {status ? `${status.guildCount} server` : "…"}
              </span>
            </div>

            {/* Điều hướng */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {translate("Điều hướng")}{" "}
              </p>
              <div className="space-y-1">
                <TaskbarLink
                  to="/monitor"
                  icon={Activity}
                  label={translate("Giám sát bot")}
                  active={onMonitorPage}
                  onClick={closePanel}
                />
                <TaskbarLink
                  to="/dashboard"
                  icon={LayoutDashboard}
                  label={translate("Bảng điều khiển")}
                  onClick={closePanel}
                />
                {isOwner === true && (
                  <TaskbarLink
                    to="/admin"
                    icon={Lock}
                    label={translate("Cửa sổ Admin")}
                    active={onAdminPage}
                    badge={translate("ẨN")}
                    onClick={closePanel}
                  />
                )}
              </div>
            </div>

            {/* Chủ bot */}
            <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 p-3">
              {ownerAvatar ? (
                <img
                  src={ownerAvatar}
                  alt={ownerName}
                  className="h-10 w-10 rounded-full border border-border object-cover"
                  draggable={false}
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <User className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {translate("Chủ sở hữu")}{" "}
                </p>
                <p className="truncate text-sm font-semibold">{ownerName}</p>
              </div>
            </div>

            {/* Cộng đồng */}
            <div className="grid grid-cols-2 gap-2">
              <TaskbarExternalLink href={discordInvite} icon={MessageCircle} label="Discord" />
              <TaskbarExternalLink href={facebookUrl} icon={Facebook} label="Facebook" />
            </div>
          </div>

          {/* Chân panel */}
          <div className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-[10px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            {translate("Miễn phí · cập nhật tự động từ Discord")}{" "}
          </div>
        </aside>
      )}
    </>
  );
}

/** Link điều hướng trong panel — item gọn, active là đen đặc. */
function TaskbarLink({
  to,
  icon: Icon,
  label,
  active,
  badge,
  onClick,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-foreground bg-foreground text-primary-foreground"
          : "border-transparent hover:border-border hover:bg-secondary/60",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
      {badge && (
        <span className="ml-auto rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[9px] font-bold text-foreground">
          {badge}
        </span>
      )}
    </Link>
  );
}

/** Link ngoài (Discord/Facebook) trong panel. */
function TaskbarExternalLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
    >
      <Icon className="h-3.5 w-3.5" /> {label}
      <ExternalLink className="h-3 w-3 opacity-50" />
    </a>
  );
}
