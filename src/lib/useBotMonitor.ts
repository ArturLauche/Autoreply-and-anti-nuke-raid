import { useCallback, useEffect, useRef, useState } from "react";
import { useBotStatus, type BotStatus } from "./useBotStatus";

/** Điểm cuối Convex dùng để đo độ trễ thực (khớp URL backend production trong main.tsx). */
const PING_URL = "https://accomplished-chipmunk-74.convex.cloud/api/query";

export const LATENCY_FAST = 300;
export const LATENCY_SLOW = 800;
export const INCIDENT_SLOW = 1200;
/** Bot sync dữ liệu lên Convex mỗi 60 giây (xem bot/src/handlers/guildSync.js). */
export const SYNC_INTERVAL_MS = 60_000;

export interface MonitorIncident {
  time: number;
  text: string;
}

export function latencyLabel(ms: number): { label: string; cls: string } {
  if (ms < LATENCY_FAST) return { label: "Nhanh", cls: "text-emerald-500" };
  if (ms < LATENCY_SLOW) return { label: "Trung bình", cls: "text-amber-500" };
  return { label: "Chậm", cls: "text-red-500" };
}

/** Định dạng mốc thời gian theo giờ Việt Nam (UTC+7). */
export function fmtVietnam(ts: number): string {
  return new Date(ts).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
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

export interface BotMonitor {
  status: BotStatus | null;
  latency: number | null;
  history: number[];
  avg: number | null;
  incidents: MonitorIncident[];
  lastUpdate: number | null;
  nextUpdate: number | null;
  refresh: () => void;
}

/**
 * Giám sát bot dùng chung (trang Monitor + cửa sổ Admin): trạng thái phản ứng,
 * đo độ trễ thật mỗi 5 giây, nhật ký sự cố, và khung giờ cập nhật theo giờ VN.
 */
export function useBotMonitor(intervalMs = 5000): BotMonitor {
  const status = useBotStatus();
  const [latency, setLatency] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [incidents, setIncidents] = useState<MonitorIncident[]>([]);
  const [nonce, setNonce] = useState(0);
  const timerRef = useRef<number>(0);

  const tick = useCallback(async () => {
    try {
      const ms = await pingBackend();
      setLatency(ms);
      setHistory((h) => [...h.slice(-29), ms]);
      if (ms > INCIDENT_SLOW) {
        setIncidents((arr) =>
          [{ time: Date.now(), text: `Độ trễ cao: ${ms} ms` }, ...arr].slice(0, 10),
        );
      }
    } catch {
      setLatency(null);
      setIncidents((arr) =>
        [{ time: Date.now(), text: "Mất kết nối tới máy chủ" }, ...arr].slice(0, 10),
      );
    }
  }, []);

  useEffect(() => {
    void tick();
    timerRef.current = window.setInterval(() => void tick(), intervalMs);
    return () => window.clearInterval(timerRef.current);
  }, [tick, intervalMs, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const avg =
    history.length > 0
      ? Math.round(history.reduce((a, b) => a + b, 0) / history.length)
      : null;

  const lastUpdate = status?.lastHeartbeat ?? null;
  const nextUpdate =
    lastUpdate !== null ? lastUpdate + SYNC_INTERVAL_MS : null;

  return { status, latency, history, avg, incidents, lastUpdate, nextUpdate, refresh };
}
