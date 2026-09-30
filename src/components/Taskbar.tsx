import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ExternalLink,
  Facebook,
  LayoutGrid,
  MessageCircle,
  Moon,
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
import { NAV_GROUPS, isNavItemActive } from "../lib/navItems";

import { translate } from "../lib/i18n";
type ThemeMode = "light" | "dark";

/**
 * Taskbar — bộ chọn trang + bảng điều khiển nhanh, nổi góc dưới trái.
 *
 * Vì sao đổi từ "pill dọc 40px" sang "dock có nhãn": pill cũ chỉ rộng 40px, chữ
 * "Menu" viết dọc 9px — gần như vô hình trên desktop, và panel chỉ có 3 mục
 * trong khi web có 12 route. Người dùng không thấy là không dùng.
 *
 * Dock nằm góc dưới trái vì mọi trang đều dồn nội dung lên trên (header
 * dính ở đỉnh) nên góc này không đè lên gì; `pointer-events-none` + z-40 trên
 * lớp nền để dock không chặn thao tác của trang phía dưới.
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

  // Đổi trang thì tự đóng — panel là lớp phủ, để lại che nội dung mới.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <>
      {/* Nền mờ khi mở — chỉ mobile. Desktop panel dựng đứng góc dưới, không che. */}
      {open && (
        <button
          aria-label={translate("Đóng taskbar")}
          onClick={closePanel}
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] md:hidden"
        />
      )}

      {/* ── Dock: nút mở có NHÃN, luôn thấy được ── */}
      <button
        ref={triggerRef}
        onClick={() => setOpen(true)}
        aria-label={translate("Mở bảng điều khiển nhanh")}
        aria-expanded={open}
        data-testid="taskbar-dock"
        className={cn(
          "group fixed z-50 flex items-center gap-2.5 rounded-full border border-border bg-card/95 py-2.5 pl-3 pr-4 backdrop-blur-md",
          "left-4 transition-all duration-200 md:left-6",
          "shadow-lg shadow-black/10 hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-xl",
          "max-md:bottom-[max(1rem,env(safe-area-inset-bottom))]",
          "max-md:top-auto",
          open ? "pointer-events-none scale-95 opacity-0" : "",
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-primary-foreground">
          <LayoutGrid className="h-4 w-4" />
        </span>
        <span className="flex flex-col items-start leading-none">
          <span className="text-[13px] font-semibold text-foreground">{translate("Menu")}</span>
          {/* Chấm trạng thái bot — xám/đen khi online, đỏ khi mất kết nối. */}
          <span className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              {online ? (
                <>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground opacity-50" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-foreground" />
                </>
              ) : (
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-danger" />
              )}
            </span>
            {online ? translate("đang chạy") : translate("mất kết nối")}
          </span>
        </span>
      </button>

      {/* ── Panel: bảng chọn trang + điều khiển nhanh ── */}
      {open && (
        <aside
          ref={panelRef}
          role="dialog"
          aria-label={translate("Bảng điều khiển nhanh")}
          className={cn(
            "fixed z-50 flex w-[min(90vw,21rem)] flex-col overflow-hidden border border-border bg-card shadow-2xl",
            "bottom-4 left-4 max-h-[min(85vh,44rem)] rounded-2xl md:bottom-6 md:left-6",
            "motion-safe:animate-in motion-safe:slide-in-from-bottom-4 motion-safe:fade-in motion-safe:duration-200",
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-primary-foreground">
              <LayoutGrid className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold leading-tight text-foreground">
                Protogon
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
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

          <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
            {/* ── PHẦN CHỌN TRANG: nhóm theo vai trò, trang đang mở tô đậm ── */}
            <nav aria-label={translate("Điều hướng")} className="space-y-4">
              {NAV_GROUPS.map((group) => {
                const items = group.items.filter((i) => !i.ownerOnly || isOwner === true);
                if (items.length === 0) return null;
                return (
                  <div key={group.title}>
                    <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {translate(group.title)}
                    </p>
                    <ul className="space-y-0.5">
                      {items.map((item) => (
                        <li key={item.to}>
                          <NavLink
                            to={item.to}
                            icon={item.icon}
                            label={item.label}
                            hint={item.hint}
                            accent={item.accent}
                            active={isNavItemActive(location.pathname, item.to)}
                            onClick={closePanel}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </nav>

            <div className="h-px bg-border" />

            {/* Giao diện sáng/tối — segmented control thay toggle tròn */}
            <div className="px-1">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {translate("Giao diện")}{" "}
              </p>
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-secondary/50 p-1">
                {(
                  [
                    // i18n-ok: nhãn được dịch lúc render bằng translate(label)
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
            <div className="flex items-center justify-between gap-2 px-1">
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
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{translate("Miễn phí · cập nhật tự động từ Discord")} </span>
          </div>
        </aside>
      )}
    </>
  );
}

/**
 * Một mục trang trong panel. Trang đang mở = nền đậm + thanh nhấn bên trái
 * (không chỉ dựa vào màu chữ — người mắt kém màu vẫn phân biệt được).
 */
function NavLink({
  to,
  icon: Icon,
  label,
  hint,
  active,
  accent,
  onClick,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  active?: boolean;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg py-2 pl-2.5 pr-2 text-sm font-medium transition-colors",
        active
          ? "bg-foreground text-primary-foreground"
          : accent
            ? "text-foreground hover:bg-secondary/70"
            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      {/* Thanh nhấn trang đang mở — dấu hiệu thị giác không phụ thuộc màu */}
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full transition-opacity",
          active ? "bg-primary-foreground opacity-100" : "opacity-0",
        )}
      />
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {accent && !active && (
        <span className="shrink-0 rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
          {translate("Mới")}
        </span>
      )}
      {hint && (
        <span
          className={cn(
            "ml-auto shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold",
            active
              ? "border-primary-foreground/40 text-primary-foreground"
              : "border-border bg-secondary text-foreground",
          )}
        >
          {hint}
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
