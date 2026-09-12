import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bug,
  Gauge,
  GraduationCap,
  Loader2,
  Server,
  ShieldCheck,
  X,
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
  const threat = useQuery(api.threatIntel.getSettings);
  const setThreat = useMutation(api.threatIntel.setResearchSettings);
  const removeThreatKw = useMutation(api.threatIntel.removeKeyword);
  const setSecrets = useMutation(api.hidden.setBotSecrets);
  const [ownerSeedInput, setOwnerSeedInput] = useState("");
  const [secretMsg, setSecretMsg] = useState<string | null>(null);

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
              <ThreatIntelCard
                threat={threat}
                onToggle={(enabled) =>
                  setThreat({ token, enabled }).catch(() => {})
                }
                onToggleAi={(aiWeeklyEnabled) =>
                  setThreat({ token, aiWeeklyEnabled }).catch(() => {})
                }
                onRemove={(keyword, kind) =>
                  removeThreatKw({ token, keyword, kind }).catch(() => {})
                }
              />
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="flex items-center gap-1.5 font-display text-sm font-bold">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" /> Chìa khóa bảo mật API
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Đặt seed bí mật → server lưu bản băm. Khi đã đặt, MỌI lệnh của bot
                  yêu cầu chìa khóa khớp — kẻ ngoài không thể giả mạo
                  heartbeat/backup/lockdown. Trên VPS dán <b>CÙNG seed này</b> vào biến
                  <code className="mx-1 rounded bg-muted px-1 py-0.5 text-[11px]">BOT_KEY</code>
                  trong bot/.env rồi <code className="rounded bg-muted px-1 py-0.5 text-[11px]">pm2 restart protogon-bot</code>.
                </p>
                <div className="mt-3 flex gap-2">
                  <input
                    type="password"
                    value={ownerSeedInput}
                    onChange={(e) => setOwnerSeedInput(e.target.value)}
                    placeholder="Seed bí mật (dòng bất kỳ, ví dụ: chuỗi ngẫu nhiên)"
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button
                    type="button"
                    disabled={ownerSeedInput.trim().length < 8}
                    onClick={async () => {
                      setSecretMsg(null);
                      try {
                        // Server tự băm seed và lưu bản băm — client không tính gì cả,
                        // và chính seed vừa nhập chính là giá trị BOT_KEY cần dán ở VPS.
                        await setSecrets({ token, guildId: "__admin__", ownerSeed: ownerSeedInput.trim() });
                        setSecretMsg(
                          `Đã bật bảo vệ ✅ — dán giá trị seed VỪA NHẬP vào BOT_KEY trên VPS (không hiện lại ở đây).`,
                        );
                        setOwnerSeedInput("");
                      } catch {
                        setSecretMsg("Lỗi khi đặt seed — thử lại.");
                      }
                    }}
                    className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    Bật bảo vệ
                  </button>
                </div>
                {secretMsg && (
                  <pre className="mt-2 whitespace-pre-wrap break-all rounded-lg bg-muted/60 p-2 text-[11px] text-foreground">
                    {secretMsg}
                  </pre>
                )}
              </div>
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

/**
 * Threat Intel — hệ thống bot TỰ NGHIÊN CỨU raid/nuke/scam từ nguồn mở
 * (Reddit security subs + CISA KEV, 0 token) + AI tổng hợp ≤ 1 lần/tuần.
 * Từ khóa học được hợp nhất vào bộ lọc malware trên VPS — miễn phí vĩnh viễn.
 */
function ThreatIntelCard({
  threat,
  onToggle,
  onToggleAi,
  onRemove,
}: {
  threat:
    | {
        researchEnabled: boolean;
        aiWeeklyEnabled: boolean;
        lastRunAt: number | null;
        keywords: string[];
        scamPhrases: string[];
        lastSources: string[];
        totalRuns: number;
        lastSummary?: string | null;
      }
    | undefined
    | null;
  onToggle: (enabled: boolean) => void;
  onToggleAi: (aiWeeklyEnabled: boolean) => void;
  onRemove: (keyword: string, kind: "keyword" | "phrase") => void;
}) {
  const lastRun = threat?.lastRunAt
    ? new Date(threat.lastRunAt).toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      })
    : null;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <GraduationCap className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-display text-sm font-bold">Threat Intel — bot tự học</h3>
            <p className="text-[11px] text-muted-foreground">
              Tải nguồn mở mỗi 4h (0 token) · AI ≤ 1 lần/tuần
            </p>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[hsl(var(--primary))]"
            checked={!!threat?.researchEnabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <span className="text-xs font-semibold">
            {threat?.researchEnabled ? "Đang bật" : "Đang tắt"}
          </span>
        </label>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Khi bật, bot tải tin an ninh công khai (Reddit security, CISA KEV) mỗi 4 giờ,
        học từ khóa scam mới và dùng MIỄN PHÍ vĩnh viễn trong bộ lọc link độc hại.
        Từ khóa sai có thể bấm xóa bên dưới. Chi phí: gần như 0 — không cần key thêm.
      </p>

      <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
          checked={threat?.aiWeeklyEnabled ?? true}
          onChange={(e) => onToggleAi(e.target.checked)}
        />
        Cho phép AI tổng hợp tối đa 1 lần/tuần (~15k tokens/tháng, dùng Groq/NVIDIA free)
      </label>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg bg-secondary/40 px-2.5 py-1.5">
          <span className="text-muted-foreground">Lượt chạy gần nhất:</span>{" "}
          <b>{lastRun ?? "chưa có"}</b>
        </div>
        <div className="rounded-lg bg-secondary/40 px-2.5 py-1.5">
          <span className="text-muted-foreground">Tổng lượt:</span> <b>{threat?.totalRuns ?? 0}</b>
        </div>
        <div className="col-span-2 rounded-lg bg-secondary/40 px-2.5 py-1.5">
          <span className="text-muted-foreground">Nguồn lượt trước:</span>{" "}
          <b>{threat?.lastSources?.length ? threat.lastSources.join(", ") : "—"}</b>
        </div>
        {threat?.lastSummary && (
          <div className="col-span-2 rounded-lg bg-primary/5 px-2.5 py-1.5 text-foreground">
            🧠 <b>AI:</b> {threat.lastSummary}
          </div>
        )}
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-[11px] font-semibold text-foreground">
          Từ khóa đã học ({(threat?.keywords?.length ?? 0) + (threat?.scamPhrases?.length ?? 0)})
        </p>
        <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
          {threat &&
            (threat.keywords?.length ?? 0) + (threat.scamPhrases?.length ?? 0) === 0 && (
              <span className="text-[11px] text-muted-foreground">
                Chưa học được từ khóa nào — bật research và chờ lượt chạy đầu tiên (5 phút sau khi bot online).
              </span>
            )}
          {(threat?.keywords ?? []).map((k) => (
            <span
              key={`kw-${k}`}
              className="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-2 py-0.5 text-[10px] font-medium"
            >
              {k}
              <button
                type="button"
                onClick={() => onRemove(k, "keyword")}
                className="text-muted-foreground transition-colors hover:text-danger"
                title="Xóa từ khóa học sai"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          {(threat?.scamPhrases ?? []).map((p) => (
            <span
              key={`ph-${p}`}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
            >
              {p}
              <button
                type="button"
                onClick={() => onRemove(p, "phrase")}
                className="opacity-60 transition-opacity hover:opacity-100"
                title="Xóa cụm từ học sai"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
