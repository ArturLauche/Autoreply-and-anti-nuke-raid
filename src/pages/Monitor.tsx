import { Link } from "react-router-dom";
import { Activity, AlertTriangle, ArrowLeft, Gauge, Server, Users, Wifi } from "lucide-react";
import UpdateWindow from "../components/UpdateWindow";
import { INCIDENT_SLOW, LATENCY_SLOW, latencyLabel, useBotMonitor } from "../lib/useBotMonitor";
import { cn } from "../lib/utils";

/** Biểu đồ độ trễ dạng đường (SVG thuần, không cần thư viện). */
function LatencyChart({ samples }: { samples: number[] }) {
  if (samples.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
        Đang thu thập dữ liệu… (cần ít nhất 2 mẫu)
      </div>
    );
  }
  const w = 600;
  const h = 150;
  const max = Math.max(...samples, LATENCY_SLOW * 1.5, 100);
  const min = Math.min(...samples, 0);
  const stepX = w / (samples.length - 1);
  const pts = samples.map((v, i) => {
    const x = i * stepX;
    const y = h - ((v - min) / (max - min || 1)) * (h - 12) - 6;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const area = `0,${h} ${pts.join(" ")} ${w},${h}`;
  const color = Math.max(...samples) > INCIDENT_SLOW ? "#f43f5e" : "#f2629e";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1="0"
          x2={w}
          y1={h * f}
          y2={h * f}
          stroke="currentColor"
          strokeOpacity="0.08"
          strokeDasharray="4 6"
        />
      ))}
      <polygon points={area} fill="url(#latGrad)" />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Monitor() {
  const { status, latency, history, avg, incidents, lastUpdate, nextUpdate, refresh } =
    useBotMonitor(30000);

  const lat = latency ?? avg;
  const rate = lat !== null ? latencyLabel(lat) : null;

  return (
    <div className="relative min-h-screen">
            <div className="relative z-10">
        <header className="border-b border-border/60 bg-background/70 backdrop-blur">
          <div className="container flex items-center gap-3 py-5">
            <Link
              to="/"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Activity className="h-5 w-5" />
              </span>
              <div>
                <h1 className="font-display text-xl font-bold">Giám sát bot</h1>
                <p className="text-xs text-muted-foreground">
                  Độ trễ · tốc độ phản hồi · trạng thái server — không hiển thị tên server
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="container space-y-4 py-6">
          {/* Trạng thái tổng */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                <Wifi className="h-3.5 w-3.5" /> Trạng thái bot
              </p>
              <p
                className={cn(
                  "mt-1.5 flex items-center gap-2 font-display text-lg font-bold",
                  status?.online ? "text-foreground" : "text-danger",
                )}
              >
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    status?.online ? "bg-foreground" : "bg-danger",
                  )}
                />
                {status ? (status.online ? "Online" : "Offline") : "đang tải…"}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                <Gauge className="h-3.5 w-3.5" /> Độ trễ hiện tại
              </p>
              <p className="mt-1.5 font-mono text-lg font-bold">
                {lat !== null ? `${lat} ms` : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                <Server className="h-3.5 w-3.5" /> Số server đang dùng bot
              </p>
              <p className="mt-1.5 font-display text-lg font-bold">
                {status ? status.guildCount : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Tổng thành viên
              </p>
              <p className="mt-1.5 font-display text-lg font-bold">
                {status ? status.memberCount.toLocaleString("vi-VN") : "—"}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
            <div className="space-y-4">
              {/* Biểu đồ độ trễ */}
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-base font-bold">
                      Biểu đồ độ trễ (5 giây / mẫu)
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Trung bình:{" "}
                      <b className="text-foreground">{avg !== null ? `${avg} ms` : "—"}</b> · Tối
                      đa:{" "}
                      <b className="text-foreground">
                        {history.length > 0 ? `${Math.max(...history)} ms` : "—"}
                      </b>
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-bold",
                      rate ? `${rate.cls} bg-current/10` : "bg-muted text-muted-foreground",
                    )}
                  >
                    {rate ? rate.label : "đang đo"}
                  </span>
                </div>
                <div className="mt-3">
                  <LatencyChart samples={history} />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">                  Đánh giá: <b className="text-foreground">Nhanh</b> (&lt; 300ms) ·{""}
                  <b className="text-foreground">Trung bình</b> (300–800ms) ·{""}
                  <b className="text-danger">Chậm</b> (&gt; 800ms) ·{""}
                  <b className="text-danger">Sự cố</b> (&gt; 1200ms)
                </p>
              </div>

              {/* Nhật ký sự cố */}
              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="flex items-center gap-2 font-display text-base font-bold">
                  <AlertTriangle className="h-4 w-4 text-danger" />
                  Sự cố ({incidents.length})
                </h2>
                {incidents.length === 0 ? (
                  <p className="mt-2 text-sm text-foreground">
                    Không ghi nhận sự cố trong phiên này — hệ thống ổn định ✅
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {incidents.map((inc, i) => (
                      <li
                        key={`${inc.time}-${i}`}
                        className="flex items-start gap-2 text-sm text-danger"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
                        <span>
                          {inc.text}{" "}
                          <span className="text-muted-foreground">
                            ·{" "}
                            {new Date(inc.time).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <UpdateWindow
                lastUpdate={lastUpdate}
                nextUpdate={nextUpdate}
                onRefresh={refresh}
                showRefresh
              />
              <div className="rounded-xl border border-border bg-secondary/30 p-4 text-xs leading-relaxed text-muted-foreground">
                <p className="mb-1 font-semibold text-foreground">ℹ️ Ghi chú</p>
                <p>• Không hiển thị tên server — chỉ hiện số lượng để bảo mật.</p>
                <p className="mt-1">
                  • Trang Cửa sổ Admin (chỉ chủ sở hữu bot) chia sẻ khung giờ cập nhật này và theo
                  dõi lỗi chi tiết hơn.
                </p>
                <p className="mt-1">
                  • Giờ hiển thị theo <b className="text-foreground">giờ Việt Nam</b> (UTC+7).
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
