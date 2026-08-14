import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bug,
  Gauge,
  Loader2,
  Server,
  ShieldCheck,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import CherryBlossom from "../components/CherryBlossom";
import RequireAuth from "../components/RequireAuth";
import UpdateWindow from "../components/UpdateWindow";
import { getSessionToken } from "../lib/discord";
import { latencyLabel, useBotMonitor } from "../lib/useBotMonitor";
import { cn } from "../lib/utils";

function AdminContent() {
  const token = getSessionToken();
  const isOwner = useQuery(api.status.isOwner, { token });
  const { status, latency, avg, incidents, lastUpdate, nextUpdate, refresh } =
    useBotMonitor(5000);

  if (isOwner === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (isOwner === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <Bug className="h-10 w-10 text-muted-foreground" />
        <p className="font-display text-lg font-semibold">Không có quyền truy cập</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Cửa sổ Admin là khu vực riêng tư của chủ sở hữu bot — người dùng khác
          không nhìn thấy và không vào được.
        </p>
        <Link to="/" className="text-sm text-primary hover:underline">
          ← Về trang chủ
        </Link>
      </div>
    );
  }

  const lat = latency ?? avg;
  const rate = lat !== null ? latencyLabel(lat) : null;

  return (
    <div className="relative min-h-screen">
      <CherryBlossom count={10} />
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
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger/15 text-danger">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h1 className="font-display text-xl font-bold">Cửa sổ Admin</h1>
                <p className="text-xs text-muted-foreground">
                  Chỉ chủ sở hữu bot nhìn thấy · theo dõi lỗi & dữ liệu bot
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="container space-y-4 py-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-danger/25 bg-danger/5 p-4">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-danger" /> Sự cố / lỗi
              </p>
              <p className="mt-1.5 font-display text-lg font-bold">
                {incidents.length}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  trong phiên này
                </span>
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                <Gauge className="h-3.5 w-3.5" /> Độ trễ hiện tại
              </p>
              <p className="mt-1.5 font-mono text-lg font-bold">
                {lat !== null ? `${lat} ms` : "—"}
              </p>
              {rate && (
                <span className={cn("text-xs font-semibold", rate.cls)}>
                  {rate.label}
                </span>
              )}
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                <Server className="h-3.5 w-3.5" /> Bot đang phục vụ
              </p>
              <p className="mt-1.5 font-display text-lg font-bold">
                {status
                  ? `${status.guildCount} server · ${status.memberCount.toLocaleString("vi-VN")} thành viên`
                  : "đang tải…"}
              </p>
              <p
                className={cn(
                  "mt-1 text-xs font-semibold",
                  status?.online ? "text-emerald-600" : "text-red-500",
                )}
              >
                {status
                  ? status.online
                    ? "● Bot online"
                    : "● Bot offline"
                  : ""}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="flex items-center gap-2 font-display text-base font-bold">
                <Activity className="h-4 w-4 text-primary" />
                Nhật ký sự cố chi tiết
              </h2>
              {incidents.length === 0 ? (
                <p className="mt-2 text-sm text-emerald-600">
                  Không phát hiện lỗi nào — bot hoạt động bình thường ✅
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {incidents.map((inc, i) => (
                    <li
                      key={`${inc.time}-${i}`}
                      className="flex items-start gap-2 rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-500"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
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
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                Lưu ý: bản ghi sự cố được ghi nhận trong phiên xem này (mất kết nối
                máy chủ, độ trễ quá cao). Để theo dõi xuyên suốt, hãy giữ trang này mở
                hoặc kiểm tra kênh log trong Discord.
              </p>
            </div>

            <div className="space-y-4">
              <UpdateWindow
                lastUpdate={lastUpdate}
                nextUpdate={nextUpdate}
                onRefresh={refresh}
                showRefresh
              />
              <div className="rounded-xl border border-border bg-secondary/30 p-4 text-xs leading-relaxed text-muted-foreground">
                <p className="mb-1 font-semibold text-foreground">🔒 Quyền riêng tư</p>
                <p>
                  Cửa sổ Admin chỉ hiển thị trong taskbar với{" "}
                  <b className="text-foreground">chủ sở hữu bot</b> (khớp tài khoản
                  Discord đã tạo bot). Người dùng khác không thấy nút này và không
                  truy cập được trang này.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function Admin() {
  return (
    <RequireAuth>
      <AdminContent />
    </RequireAuth>
  );
}
