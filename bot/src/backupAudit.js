/**
 * backupAudit.js — PHÂN LOẠI BACKUP THẬT/FAKE + CHẤM SỨC KHỎE TỪNG CÔNG ĐOẠN.
 *
 * "Backup fake" là bản trong bảng guildBackups KHÔNG THỂ KHÔI PHỤC được:
 *   - JSON hỏng (không parse được, kể cả sau giải nén "z:" / giải mã "e:")
 *   - Thiếu cấu trúc bắt buộc (version, roles, channels, guildId)
 *   - Nén "z:" nhưng base64/zlib bung lỗi → dữ liệu đã hỏng từ lúc lưu
 *   - Checksum (SHA-256) không khớp nội dung → bị sửa/sao chép sai
 *   - Nguồn lạ (source không thuộc backup/import/clone)
 *
 * Module này thuần hàm, không gọi mạng/DB — bot (VPS) và script audit dùng chung.
 * Script audit trên VPS gọi cùng ConvexHttpClient của bot (có BOT_KEY) → quét
 * mọi guild, bung + kiểm tra từng bản, xóa bản fake khi chạy với cờ --fix.
 */

const zlib = require("zlib");
const crypto = require("crypto");

/** Nguồn backup hợp lệ mà bot ghi qua đường chuẩn. */
const VALID_SOURCES = new Set(["backup", "import", "clone"]);

/** Giải nén/giải mã chuỗi backupJson → JSON thô. Trả { json, error }. */
function unpackBackupJson(backupJson) {
  if (typeof backupJson !== "string" || backupJson.length === 0) {
    return { json: null, error: "backupJson rỗng" };
  }
  let data = backupJson;
  // Lớp 1: nén zlib ("z:" + base64) — tiêu chuẩn mọi bản mới.
  if (data.startsWith("z:")) {
    try {
      data = zlib.inflateSync(Buffer.from(data.slice(2), "base64")).toString("utf8");
    } catch {
      return { json: null, error: "zlib bung lỗi (bản nén hỏng)" };
    }
  }
  // Lớp 2: mã hóa AES-256-GCM ("e:" + base64) — chỉ khi VPS có BACKUP_ENCRYPT_KEY.
  if (data.startsWith("e:")) {
    const key = process.env.BACKUP_ENCRYPT_KEY || null;
    if (!key) return { json: null, error: "bản mã hóa nhưng VPS thiếu BACKUP_ENCRYPT_KEY" };
    try {
      const raw = Buffer.from(data.slice(2), "base64");
      const iv = raw.subarray(0, 12);
      const tag = raw.subarray(12, 28);
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        crypto.createHash("sha256").update(key).digest(),
        iv,
      );
      decipher.setAuthTag(tag);
      data = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    } catch {
      return { json: null, error: "giải mã AES thất bại (key khác hoặc dữ liệu hỏng)" };
    }
  }
  try {
    return { json: JSON.parse(data), error: null };
  } catch {
    return { json: null, error: "JSON không parse được" };
  }
}

/**
 * Phân loại 1 dòng backup (row từ bảng guildBackups).
 * Trả { verdict: "real" | "fake" | "suspect", reasons: string[] }.
 *   - real   : bung được, đủ cấu trúc, checksum khớp (hoặc không có checksum để so).
 *   - fake   : chắc chắn không khôi phục được (hỏng JSON/nén/thiếu cấu trúc).
 *   - suspect: cấu trúc có nhưng checksum không khớp hoặc metadata lệch —
 *              cần xem thêm (không xóa tự động).
 */
function classifyBackup(row) {
  const reasons = [];
  if (!row?.backupJson) return { verdict: "fake", reasons: ["thiếu backupJson"] };
  if (row.source && !VALID_SOURCES.has(row.source)) {
    reasons.push(`nguồn lạ: "${row.source}"`);
  }

  const { json, error } = unpackBackupJson(row.backupJson);
  if (!json) {
    reasons.push(error ?? "không bung được");
    return { verdict: "fake", reasons };
  }
  if (typeof json !== "object") {
    return { verdict: "fake", reasons: ["nội dung không phải object"] };
  }

  // Cấu trúc tối thiểu của snapshot engine (version 3+): guildId + roles + channels.
  if (!json.guildId) reasons.push("thiếu guildId trong snapshot");
  if (!Array.isArray(json.roles)) reasons.push("thiếu mảng roles");
  if (!Array.isArray(json.channels)) reasons.push("thiếu mảng channels");
  if (reasons.length > 0 && reasons.some((r) => r.startsWith("thiếu"))) {
    return { verdict: "fake", reasons };
  }

  // Checksum: SHA-256 của JSON THÔ (trước nén/mã hóa — bot ghi checksum của
  // JSON.stringify(snapshot)). Có checksum mà lệch → dữ liệu bị thay đổi.
  if (row.backupChecksum) {
    const recomputed = computeChecksumFromUnpacked(unpackBackupJson(row.backupJson).json);
    if (recomputed && recomputed !== row.backupChecksum) {
      reasons.push("checksum không khớp nội dung");
      return { verdict: "suspect", reasons };
    }
  }

  // Metadata lệch (đếm role/kênh không khớp nội dung) — nghi vấn, không xóa.
  if (Array.isArray(json.roles) && row.roleCount !== json.roles.length) {
    reasons.push(`roleCount lệch (${row.roleCount} ≠ ${json.roles.length})`);
  }
  if (Array.isArray(json.channels) && row.channelCount !== json.channels.length) {
    reasons.push(`channelCount lệch (${row.channelCount} ≠ ${json.channels.length})`);
  }
  if (reasons.length > 0) return { verdict: "suspect", reasons };
  return { verdict: "real", reasons: [] };
}

/** SHA-256 hex của chuỗi (khớp backupUtils.computeChecksum). */
function computeChecksum(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

/** Checksum của snapshot đã bung: băm lại JSON.stringify với key ổn định. */
function computeChecksumFromUnpacked(json) {
  try {
    return computeChecksum(JSON.stringify(json));
  } catch {
    return null;
  }
}

/**
 * Chấm sức khỏe 1 guild: { real, fake, suspect, total }.
 */
function summarize(rows) {
  const out = { real: 0, fake: 0, suspect: 0, total: rows.length };
  for (const row of rows) {
    const { verdict } = classifyBackup(row);
    out[verdict]++;
  }
  return out;
}

module.exports = {
  VALID_SOURCES,
  unpackBackupJson,
  classifyBackup,
  computeChecksum,
  summarize,
};
