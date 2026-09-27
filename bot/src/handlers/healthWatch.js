/**
 * healthWatch — canh sức khoẻ MÁY CHỦ (đĩa / bộ nhớ / uptime).
 *
 * Vì sao cần: sự cố 25/09/2026 — host storage đầy làm đĩa rơi `ext4
 * emergency_ro`, bot chết cả buổi mà KHÔNG AI báo trước. Mọi cảnh báo cũ
 * (RAM cao) chỉ in ra console rồi tan vào `pm2 logs` — không ai đọc lúc 3h
 * sáng. Ở đây bot tự đo và BÁO ra nơi chủ bot thật sự nhìn thấy: dashboard +
 * (nếu nghiêm trọng) DM cho chủ bot.
 *
 * Nguyên tắc:
 *  - KHÔNG đo được thì KHÔNG báo (thiếu số liệu ≠ máy chết) — tránh cảnh báo
 *    oan khiến chủ bot mất niềm tin vào cảnh báo thật.
 *  - DM chỉ khi mức NẶNG HƠN lần trước, và tối đa 1 lần / 6 giờ cho cùng
 *    mức — đĩa đầy kéo dài cả ngày không được spam 288 tin nhắn.
 *  - Mọi phép đo lấy từ tham số tiêm vào khi có thể để test hermetic.
 */

const fs = require("fs");
const os = require("os");

/** Ngưỡng % đĩa đã dùng (bám sát 85/92 của `df -h`). */
const DISK_WARN_PCT = 85;
const DISK_CRIT_PCT = 92;
/** Ngưỡng RSS của tiến trình bot (MB). */
const RSS_WARN_MB = 700;
const RSS_CRIT_MB = 1000;
/** Nhịp đo: 5 phút (đủ sớm để kịp dọn đĩa, rẻ vì 1 mutation nhỏ). */
const DEFAULT_INTERVAL_MS = 5 * 60_000;
/** Tối đa 1 DM / 6 giờ cho cùng một mức. */
const ALERT_COOLDOWN_MS = 6 * 60 * 60_000;

const LEVEL_RANK = { ok: 0, warn: 1, critical: 2 };

/**
 * Xếp mức sức khoẻ từ 2 chỉ số. Mức nghiêm trọng nhất thắng.
 * Dùng `>=` (không phải `>`): đĩa tròn 92% là vùng nguy hiểm rồi.
 */
function classifyHealth({ diskUsedPct, rssMb }) {
  const disk = typeof diskUsedPct === "number" ? diskUsedPct : 0;
  const rss = typeof rssMb === "number" ? rssMb : 0;
  if (disk >= DISK_CRIT_PCT || rss >= RSS_CRIT_MB) return "critical";
  if (disk >= DISK_WARN_PCT || rss >= RSS_WARN_MB) return "warn";
  return "ok";
}

/**
 * Đọc số liệu thật của máy chủ. `statfsSync` có sẵn từ Node 18.15 / Bun nên
 * KHÔNG cần thêm dependency. Hỏng/thiếu quyền → trả `undefined` (bỏ trống),
 * tuyệt đối không ném — bot không được chết vì lỗi chẩn đoán.
 */
function readHostHealth() {
  let diskUsedPct;
  let diskFreeGb;
  try {
    const st = fs.statfsSync("/");
    const totalBytes = st.blocks * st.bsize;
    if (totalBytes > 0) {
      // Dùng `bavail` (khả dụng cho user thường) chứ không phải `bfree` (còn
      // trừ block dành cho root) — nếu không sẽ báo đầy muộn hơn thực tế.
      const freeBytes = st.bavail * st.bsize;
      diskUsedPct = Math.round(((totalBytes - freeBytes) / totalBytes) * 100);
      diskFreeGb = Math.round((freeBytes / 1024 ** 3) * 10) / 10;
    }
  } catch {
    /* không đo được đĩa → để trống, KHÔNG coi là 0% cũng không coi là hỏng */
  }
  const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
  const uptimeHours = Math.round((os.uptime() / 3600) * 100) / 100;
  return {
    diskUsedPct,
    diskFreeGb,
    rssMb,
    uptimeHours,
    level: classifyHealth({ diskUsedPct, rssMb }),
  };
}

/**
 * Có nên DM chủ bot cho mức này không?
 *
 * `state` = { level, lastAlertAt } của lượt trước (null = lần đầu).
 * - Mức nặng hơn lần trước → DM ngay (đây là thứ chủ bot cần biết nhất).
 * - Đang `critical` mà đã quá 6 giờ kể từ DM gần nhất → DM lại (sự cố kéo dài
 *   vẫn phải được nhắc, nhưng đều đặn chứ không dồn dập).
 * - Không đo được gì cả (không có diskUsedPct lẫn rssMb = 0) → không DM.
 */
function shouldAlert(state, health, now) {
  const prev = state?.level ?? "ok";
  const level = health?.level ?? "ok";
  if (LEVEL_RANK[level] === 0) return false;
  if (LEVEL_RANK[level] > LEVEL_RANK[prev]) return true;
  if (level === "critical" && now - (state?.lastAlertAt ?? 0) >= ALERT_COOLDOWN_MS) return true;
  return false;
}

/** Câu thông báo tiếng Việt cho DM (bot là sản phẩm tiếng Việt). */
function buildAlertText(health) {
  const lines = ["🚨 **Cảnh báo máy chủ bot**", ""];
  if (typeof health.diskUsedPct === "number") {
    lines.push(
      `• Đĩa đã dùng **${health.diskUsedPct}%** (còn ${health.diskFreeGb ?? "?"} GB)` +
        ` — ngưỡng cảnh báo ${DISK_WARN_PCT}%, nghiêm trọng ${DISK_CRIT_PCT}%`,
    );
  }
  if (health.rssMb >= RSS_WARN_MB) {
    lines.push(`• Bộ nhớ bot **${health.rssMb} MB** (RAM tiến trình)`);
  }
  lines.push("", "Nếu đĩa sắp đầy, hãy dọn Docker/log cũ hoặc chuyển sang node mới.");
  return lines.join("\n");
}

/**
 * MỘT lượt canh: đo → ghi Convex → quyết định có DM không. Trả về state mới
 * cho lượt sau.
 *
 * Vì sao tách khỏi vòng `setInterval`: logic quyết định (khi nào DM, khi nào
 * im) là phần có rủi ro nhất — phải kiểm chứng được bằng test gọi trực tiếp
 * nhiều lượt liên tiếp, không phải chờ đồng hồ thật.
 */
async function checkOnce({
  store,
  sendAlert,
  now = () => Date.now(),
  read = readHostHealth,
  state = null,
}) {
  const health = read();
  const at = now();
  try {
    await store.mutation("status:reportHealth", { ...health, reportedAt: at });
  } catch (e) {
    // Ghi lên Convex hỏng KHÔNG được làm chết vòng canh — lượt sau thử lại.
    console.error("[health] không ghi được hostHealth:", e?.message || e);
  }
  if (sendAlert && shouldAlert(state, health, at)) {
    try {
      await sendAlert(buildAlertText(health));
      console.warn(`[health] đã DM cảnh báo mức "${health.level}" cho chủ bot`);
      return { level: health.level, lastAlertAt: at };
    } catch (e) {
      console.error("[health] gửi DM cảnh báo lỗi:", e?.message || e);
    }
  }
  // Về lại bình thường → reset để lần nặng hơn sau lại báo ngay.
  if (LEVEL_RANK[health.level] === 0) return null;
  return state ?? { level: health.level, lastAlertAt: 0 };
}

/**
 * Vòng canh định kỳ. Gọi 1 lần ở lúc bot `ready`; trả về hàm dừng.
 *
 * @param {object} opts
 * @param {object} opts.store    ConvexStore (dùng `.mutation`)
 * @param {(text: string) => Promise<void>} [opts.sendAlert] gửi DM cho chủ bot
 * @param {() => number} [opts.now]  đồng hồ (tiêm để test)
 * @param {() => object} [opts.read] bộ đọc số liệu (tiêm để test)
 * @param {number} [opts.intervalMs]
 */
function startHealthWatch(opts = {}) {
  let state = null;
  const run = async () => {
    state = await checkOnce({ ...opts, state });
  };
  void run();
  const timer = setInterval(() => void run(), opts.intervalMs ?? DEFAULT_INTERVAL_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}

module.exports = {
  DISK_WARN_PCT,
  DISK_CRIT_PCT,
  RSS_WARN_MB,
  RSS_CRIT_MB,
  DEFAULT_INTERVAL_MS,
  ALERT_COOLDOWN_MS,
  classifyHealth,
  readHostHealth,
  shouldAlert,
  buildAlertText,
  checkOnce,
  startHealthWatch,
};
