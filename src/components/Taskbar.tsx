import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ExternalLink,
  Facebook,
  MessageCircle,
  Moon,
  PanelRightOpen,
  Sun,
  User,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { usePublicConfig } from "../lib/usePublicConfig";
import { useBotStatus } from "../lib/useBotStatus";
import { cn } from "../lib/utils";

/** Điểm cuối Convex dùng để đo độ trễ thực (khớp URL backend production trong main.tsx). */
const PING_URL = "https://accomplished-chipmunk-74.convex.cloud/api/query";

const LATENCY_FAST = 300;
const LATENCY_SLOW = 800;
const INCIDENT_SLOW = 1200;

interface Incident {
  time: number;
  text: string;
}

type ThemeMode = "light" | "dark";

function latencyLabel(ms: number): { label: string; cls: string } {
  if (ms < LATENCY_FAST) return { label: "Nhanh", cls: "text-emerald-500" };
  if (ms < LATENCY_SLOW) return { label: "Trung bình", cls: "text-amber-500" };
  return { label: "Chậm", cls: "text-red-500" };
}

async function pingBackend(): Promise<number> {
  const t0 = performance.now();
  const res = await fetch(PING_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "status:botStatus", format: "json", args: {} }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  await res.json();
  return Math.round(performance.now() - t0);
}

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
  const [latency, setLatency] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const timerRef = useRef<number>(0);

  const status = useBotStatus();
  const { discordInvite, facebookUrl } = usePublicConfig();

  // Áp dụng chế độ tương phản (sáng/tối) toàn trang + lưu lựa chọn.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("protogon-theme", theme);
  }, [theme]);

  // Đo độ trễ backend định kỳ + ghi sự cố.
  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const ms = await pingBackend();
        if (!alive) return;
        setLatency(ms);
        setHistory((h) => [...h.slice(-4), ms]);
        if (ms > INCIDENT_SLOW) {
          setIncidents((arr) =>
            [
              { time: Date.now(), text: `Độ trễ cao: ${ms} ms` },
              ...arr,
            ].slice(0, 10),
          );
        }
      } catch {
        if (!alive) return;
        setLatency(null);
        setIncidents((arr) =>
          [{ time: Date.now(), text: "Mất kết nối tới máy chủ" }, ...arr].slice(
            0,
            10,
          ),
        );
      }
    }
    void tick();
    timerRef.current = window.setInterval(() => void tick(), 5000);
    return () => {
      alive = false;
      window.clearInterval(timerRef.current);
    };
  }, []);

  const avg =
    history.length > 0
      ? Math.round(history.reduce((a, b) => a + b, 0) / history.length)
      : null;
  const lat = latency ?? avg;
  const ownerName = status?.ownerName ?? "wiothemilo";
  const ownerAvatar = status?.ownerAvatarUrl ?? null;

  return (
    <>
      {/* Nút bật/tắt taskbar (góc trái dưới, tránh đè cửa sổ chat Haimiya) */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Mở taskbar"
        className={cn(
          "group fixed bottom-5 left-5 z-50 flex items-center gap-2 rounded-full",
          "border border-white/50 bg-gradient-to-br from-[#8fc8ff] to-[#f79fc6] p-0.5 pr-1",
          "shadow-[0_8px_30px_-6px_hsl(205_90%_55%/0.5)] transition-transform hover:scale-105",
          open && "pointer-events-none opacity-0",
        )}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-[#3d2a5c] shadow-inner ring-2 ring-white/60">
          <PanelRightOpen className="h-6 w-6" />
        </span>
        <span className="hidden pr-2 text-sm font-bold text-[#1d2f4d] sm:block">
          Taskbar
        </span>
      </button>

      {open && (
        <div
          className={cn(
            "fixed bottom-5 left-5 z-50 flex w-[min(92vw,20rem)] flex-col overflow-hidden rounded-2xl",
            "border border-primary/30 bg-card/95 shadow-2xl backdrop-blur",
            "animate-in fade-in-0 zoom-in-95 duration-200",
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
                Tương phản · Giám sát bot · Chủ sở hữu
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
            {/* Chế độ tương phản sáng/tối */}
            <div className="rounded-xl border border-border bg-secondary/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {theme === "dark" ? (
                    <Moon className="h-4 w-4 text-primary" />
                  ) : (
                    <Sun className="h-4 w-4 text-primary" />
                  )}
                  Chế độ tương phản
                </div>
                <button
                  onClick={() =>
                    setTheme((t) => (t === "dark" ? "light" : "dark"))
                  }
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
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {theme === "dark"
                  ? "Đang dùng giao diện tối — nhẹ mắt hơn khi dùng ban đêm."
                  : "Đang dùng giao diện sáng — anh đào xanh trời như mặc định."}
              </p>
            </div>

            {/* Giám sát bot */}
            <div className="rounded-xl border border-border bg-secondary/40 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Activity className="h-4 w-4 text-primary" />
                Giám sát bot
                {status ? (
                  status.online ? (
                    <Wifi className="ml-auto h-4 w-4 text-emerald-500" />
                  ) : (
                    <WifiOff className="ml-auto h-4 w-4 text-red-500" />
                  )
                ) : null}
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-background/60 p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Độ trễ
                  </p>
                  <p className="mt-0.5 font-mono text-sm font-bold text-foreground">
                    {lat !== null ? `${lat} ms` : "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-background/60 p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Tốc độ phản hồi
                  </p>
                  <p className="mt-0.5 text-sm font-bold">
                    {lat !== null ? (
                      <span className={latencyLabel(lat).cls}>
                        {latencyLabel(lat).label}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">đang đo…</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between rounded-lg bg-background/60 px-2.5 py-2 text-xs">
                <span className="text-muted-foreground">Trạng thái bot</span>
                {status ? (
                  <span
                    className={cn(
                      "flex items-center gap-1.5 font-semibold",
                      status.online ? "text-emerald-600" : "text-red-500",
                    )}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        status.online ? "bg-emerald-500" : "bg-red-500",
                      )}
                    />
                    {status.online ? "Online" : "Offline"} · {status.guildCount}{" "}
                    server
                  </span>
                ) : (
                  <span className="text-muted-foreground">đang tải…</span>
                )}
              </div>

              {/* Sự cố */}
              <div className="mt-2 rounded-lg bg-background/60 px-2.5 py-2">
                <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <AlertTriangle className="h-3 w-3" />
                  Sự cố ({incidents.length})
                </p>
                {incidents.length === 0 ? (
                  <p className="mt-1 text-xs text-emerald-600">
                    Không ghi nhận sự cố — hệ thống ổn định ✅
                  </p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {incidents.slice(0, 3).map((inc, i) => (
                      <li
                        key={`${inc.time}-${i}`}
                        className="flex items-start gap-1.5 text-[11px] text-red-500"
                      >
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                        <span>
                          {inc.text}{" "}
                          <span className="text-muted-foreground">
                            ·{" "}
                            {new Date(inc.time).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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
        </div>
      )}
    </>
  );
}
