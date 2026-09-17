/**
 * localSnapshot.js — C1: SNAPSHOT BACKUP CỤC BỘ TRÊN VPS (đốt disk đổi an toàn).
 *
 * Vì sao cần: backup hiện chỉ sống trên Convex (+GitHub tuỳ chọn). Nếu Convex
 * sự cố / GitHub token hết hạn / Discord API trục trặc lúc cần restore thì
 * không còn nguồn nào. Module này chụp snapshot MỖI GIỜ cho từng guild,
 * NÉN zlib (giảm 60–80%), ghi vào thư mục dữ liệu trên VPS và GIỮ 48 điểm
 * gần nhất (rotate) — đủ 2 ngày lịch sử để lùi về bất kỳ mốc nào.
 *
 * Tài nguyên tiêu hao: disk ~5–50MB/guild (tuỳ cỡ server, có nén), CPU vài
 * trăm ms/giờ/guild, RAM ~0 (stream theo guild rồi giải phóng).
 *
 * Thiết kế: thuần built-in (fs/zlib/path), không đụng Convex — lỗi của 1
 * guild không ảnh hưởng guild khác, lỗi của vòng này không giết bot.
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

/** Số điểm snapshot giữ lại cho mỗi guild (48 điểm × 1 giờ = 2 ngày). */
const SNAPSHOT_KEEP = 48;

/** C2 — số ngày giữ file log (rotate). */
const LOG_KEEP_DAYS = 7;

/* ============================================================
 * C2 — FILE LOG THEO NGÀY + ROTATE 7 NGÀY
 * Điều tra sự cố sau khi xảy ra: console log mất khi process chết,
 * file log trên VPS còn đó. Ghi kèm timestamp, chặn nén gzip khi lớn.
 * ============================================================ */

/** Đường dẫn file log hôm nay: logs/bot-YYYY-MM-DD.log. */
function logFileFor(now = new Date()) {
  const dir = process.env.PROTOGON_LOG_DIR || path.join(__dirname, "..", "data", "logs");
  const day = now.toISOString().slice(0, 10);
  return path.join(dir, `bot-${day}.log`);
}

/** Ghi 1 dòng log (timestamp ISO + message). Chỉ flush/append — không giữ handle. */
function appendLog(message, now = new Date()) {
  try {
    const file = logFileFor(now);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `[${now.toISOString()}] ${String(message).replace(/\s+$/, "")}\n`);
  } catch {
    // Log ra file fail KHÔNG BAO GIỜ giết bot.
  }
}

/** Đọc n dòng cuối của file log (xem lại qua lệnh tail trên VPS). */
function tailLog(lines = 100, now = new Date()) {
  try {
    const file = logFileFor(now);
    const content = fs.readFileSync(file, "utf8");
    return content
      .split("\n")
      .slice(-lines - 1)
      .join("\n");
  } catch {
    return "";
  }
}

/** Rotate: xoá file log quá LOG_KEEP_DAYS ngày. Trả số file đã xoá. */
function rotateLogs(now = new Date()) {
  const dir = process.env.PROTOGON_LOG_DIR || path.join(__dirname, "..", "data", "logs");
  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => /^bot-\d{4}-\d{2}-\d{2}\.log$/.test(f));
  } catch {
    return 0;
  }
  const cutoff = now.getTime() - LOG_KEEP_DAYS * 24 * 3600 * 1000;
  let removed = 0;
  for (const f of files) {
    const ts = Date.parse(f.slice(4, 14));
    if (Number.isFinite(ts) && ts < cutoff) {
      try {
        fs.rmSync(path.join(dir, f), { force: true });
        removed++;
      } catch {}
    }
  }
  return removed;
}

/** Thư mục gốc lưu snapshot (ghi đè bằng env PROTOGON_SNAPSHOT_DIR). */
function snapshotDir() {
  return process.env.PROTOGON_SNAPSHOT_DIR || path.join(__dirname, "..", "data", "snapshots");
}

/** Thư mục của 1 guild (tạo sẵn nếu thiếu). */
function guildDir(guildId) {
  const dir = path.join(snapshotDir(), String(guildId).replace(/[^a-zA-Z0-9_-]/g, "_"));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Ghi 1 snapshot (object bất kỳ) nén zlib cho guild. Ghi atomic: tmp → rename.
 * Trả về { file, bytes } hoặc null nếu snapshot rỗng/không ghi được.
 */
function writeLocalSnapshot(guildId, snapshot, now = Date.now()) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const json = JSON.stringify(snapshot);
  if (!json || json.length < 10) return null;
  const dir = guildDir(guildId);
  const file = path.join(dir, `${now}.z`);
  const tmp = `${file}.tmp`;
  try {
    fs.writeFileSync(tmp, zlib.deflateSync(Buffer.from(json, "utf8")));
    fs.renameSync(tmp, file);
    rotateLocalSnapshots(guildId);
    return { file, bytes: fs.statSync(file).size };
  } catch (e) {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {}
    console.error(`[localSnapshot] ghi ${guildId} lỗi:`, e?.message || e);
    return null;
  }
}

/** Danh sách snapshot của guild: mới nhất đầu → [{ ts, file, bytes }]. */
function listLocalSnapshots(guildId) {
  const dir = path.join(snapshotDir(), String(guildId).replace(/[^a-zA-Z0-9_-]/g, "_"));
  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".z"));
  } catch {
    return [];
  }
  return files
    .map((f) => {
      const ts = Number(path.basename(f, ".z"));
      let bytes = 0;
      try {
        bytes = fs.statSync(path.join(dir, f)).size;
      } catch {}
      return { ts, file: path.join(dir, f), bytes };
    })
    .filter((s) => Number.isFinite(s.ts))
    .sort((a, b) => b.ts - a.ts);
}

/** Rotate: xoá bớt snapshot cũ, chỉ giữ SNAPSHOT_KEEP điểm mới nhất. Trả số đã xoá. */
function rotateLocalSnapshots(guildId, keep = SNAPSHOT_KEEP) {
  const list = listLocalSnapshots(guildId);
  let removed = 0;
  for (const s of list.slice(keep)) {
    try {
      fs.rmSync(s.file, { force: true });
      removed++;
    } catch {}
  }
  return removed;
}

/**
 * Đọc snapshot: mặc định MỚI NHẤT, hoặc đúng mốc ts. Trả object đã giải nén
 * hoặc null (không có / hỏng — restore phía trên tự rơi về nguồn khác).
 */
function readLocalSnapshot(guildId, ts = null) {
  const list = listLocalSnapshots(guildId);
  const pick = ts ? list.find((s) => s.ts === ts) : list[0];
  if (!pick) return null;
  try {
    return JSON.parse(zlib.inflateSync(fs.readFileSync(pick.file)).toString("utf8"));
  } catch (e) {
    console.error(`[localSnapshot] đọc ${pick.file} lỗi:`, e?.message || e);
    return null;
  }
}

/**
 * Chụp 1 guild bằng engine backup có sẵn (không kèm messages — nhẹ) rồi ghi
 * local. Trả { file, bytes } | null.
 */
async function snapshotGuildLocal(client, store, guildId, now = Date.now()) {
  try {
    const backup = require("./handlers/backup");
    const { snapshot } = await backup.snapshotWithSettings(client, store, guildId, false);
    if (!snapshot) return null;
    return writeLocalSnapshot(guildId, { snapshotAt: now, guild: snapshot }, now);
  } catch (e) {
    console.error(`[localSnapshot] chụp ${guildId} lỗi:`, e?.message || e);
    return null;
  }
}

/**
 * Vòng lặp snapshot: mỗi giờ quét toàn bộ guild, chụp lần lượt (tuần tự —
 * tránh vồ vập CPU/disk đồng loạt), lỗi 1 guild bỏ qua guild đó.
 * Trả về hàm stop() (cho test + shutdown).
 */
function startLocalSnapshotLoop(client, store, intervalMs = 60 * 60_000) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const guilds = [...client.guilds.cache.values()];
      appendLog(`[snapshot] bắt đầu vòng chụp ${guilds.length} guild`);
      for (const guild of guilds) {
        const res = await snapshotGuildLocal(client, store, guild.id);
        if (res) appendLog(`[snapshot] ${guild.id} → ${res.file} (${res.bytes}B)`);
      }
      rotateLogs();
    } catch {
      // Không bao giờ để vòng snapshot giết bot.
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => {
    tick().catch(() => {});
  }, intervalMs);
  timer.unref?.();
  // Lần đầu chạy sau 90 giây — đợi bot ổn định, tránh giành CPU lúc online.
  setTimeout(() => {
    tick().catch(() => {});
  }, 90_000).unref?.();
  return () => clearInterval(timer);
}

module.exports = {
  SNAPSHOT_KEEP,
  LOG_KEEP_DAYS,
  snapshotDir,
  writeLocalSnapshot,
  readLocalSnapshot,
  listLocalSnapshots,
  rotateLocalSnapshots,
  snapshotGuildLocal,
  startLocalSnapshotLoop,
  logFileFor,
  appendLog,
  tailLog,
  rotateLogs,
};
