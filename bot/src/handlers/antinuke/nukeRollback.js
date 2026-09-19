"use strict";
/**
 * nukeRollback.js — S3: TỰ HỒI PHỤC KÊNH/ROLE SAU NUKE TỪ SNAPSHOT CỤC BỘ.
 *
 * Vì sao cần: anti-nuke hiện PHÁT HIỆN + BAN kẻ phá nhưng kênh/role đã bị xoá
 * thì vẫn mất — chủ server phải restore tay. Từ khi có snapshot cục bộ C1
 * (mỗi giờ, zlib, 48 điểm trên VPS), ta có nguồn khôi phục KHÔNG phụ thuộc
 * Convex/GitHub/Discord-CDN. Module này nối dây: sau khi anti-nuke xử phạt
 * một vụ nuke cấu trúc, chờ GRACE_MS (60s — Discord audit/cache kịp ổn định)
 * rồi ĐỐI CHIẾU guild hiện tại với snapshot gần nhất TRƯỚC vụ nuke:
 *   - role/kênh có trong snapshot mà guild đang thiếu → tạo lại (dùng
 *     createRoles/createChannels của backup engine — tái sử dụng 100% logic
 *     đã có, không nhân bản code).
 *   - KHÔNG xoá gì: nuke kiểu "thêm rác" (massCreate) không bị đụng tới ở đây
 *     (kẻ xấu tạo kênh rác thì chủ server xoá tay — rollback chỉ hồi phục mất mát).
 *   - Config guild bật `rollbackEnabled` (mặc định BẬT) mới chạy; kênh log nhận
 *     embed kết quả.
 *
 * An toàn: mọi thao tác Discord best-effort, thiếu snapshot → bỏ qua im lặng
 * (không spam log), KHÔNG đụng Convex (0 usage), cooldown 1 rollback/guild/10 phút.
 */

const { Colors } = require("discord.js");
const { logEmbed, sendLog } = require("../../util");
const localSnapshot = require("../../localSnapshot");

/** Chờ sau vụ nuke trước khi đối chiếu — audit log + cache Discord ổn định. */
const GRACE_MS = 60_000;
/** Tối thiểu số role/kênh bị mất mới đáng chạy rollback (tránh nhạy quá). */
const MIN_MISSING = 2;
/** Cooldown giữa 2 lần rollback cùng guild. */
const COOLDOWN_MS = 10 * 60_000;

module.exports = function createNukeRollback({ store }) {
  /** guildId -> ts lần rollback gần nhất */
  const lastRun = new Map();
  /** guildId -> Set(module) đã lên kế hoạch trong grace window hiện tại */
  const pending = new Map();

  /**
   * Gọi từ pipeline anti-nuke SAU khi xử phạt 1 vụ nuke cấu trúc. Chỉ ghi dấu
   * (fire-and-forget) — rollback thật chạy sau GRACE_MS.
   */
  function scheduleRollback(guild, module, executorId) {
    if (!guild?.id) return { scheduled: false, reason: "thiếu guild" };
    // Đã có lịch trong grace window? → chỉ gộp module, KHÔNG hẹn giờ lần hai.
    // (Kiểm tra sự tồn tại của entry thay vì set.size === 1: cùng module lặp lại
    // giữ nguyên size nên trước đây vẫn hẹn trùng → rollback chạy 2 lần.)
    const already = pending.has(guild.id);
    const set = pending.get(guild.id) ?? new Set();
    set.add(module);
    pending.set(guild.id, set);
    if (already) return { scheduled: false, reason: "đã có lịch trong grace window" };
    setTimeout(async () => {
      const modules = pending.get(guild.id) ?? new Set();
      pending.delete(guild.id);
      try {
        await runRollback(guild, [...modules], executorId);
      } catch (e) {
        console.error(`[nukeRollback] ${guild.id}:`, e?.message || e);
      }
    }, GRACE_MS).unref?.();
    return { scheduled: true, graceMs: GRACE_MS };
  }

  /**
   * Đối chiếu + khôi phục. Export cho test — chạy trực tiếp không cần đợi grace.
   * Trả { ran, restoredRoles, restoredChannels, snapshotTs, reason? }.
   */
  async function runRollback(guild, modules = [], executorId, opts = {}) {
    const out = {
      ran: false,
      restoredRoles: 0,
      restoredChannels: 0,
      snapshotTs: null,
      missingRoles: 0,
      missingChannels: 0,
    };
    if (!guild || guild.available === false) return { ...out, reason: "guild không sẵn sàng" };
    const config = await store.getConfig(guild.id).catch(() => null);
    if (!config || config.rollbackEnabled === false) return { ...out, reason: "rollback tắt" };
    const now = Date.now();
    if (!opts.force && now - (lastRun.get(guild.id) ?? 0) < COOLDOWN_MS) {
      return { ...out, reason: "trong cooldown" };
    }
    lastRun.set(guild.id, now);

    // Chọn snapshot MỚI NHẤT cũ hơn mốc "trước nuke": pending từ lúc schedule.
    // Không nhớ mốc chính xác (restart giữa chừng) → lấy snapshot mới nhất;
    // nếu guild không mất gì so với snapshot thì rollback tự kết thúc 0.
    const snap = localSnapshot.readLocalSnapshot(guild.id, opts.snapshotTs ?? null);
    if (!snap?.guild) return { ...out, reason: "không có snapshot" };
    const backup = snap.guild;
    if (!Array.isArray(backup.roles) && !Array.isArray(backup.channels)) {
      return { ...out, reason: "snapshot không có cấu trúc" };
    }

    // ── Đối chiếu: những gì snapshot có mà guild đang thiếu ──
    const backupEngine = require("../backup");
    const existingRoleNames = new Set(
      [...guild.roles.cache.values()].map((r) => `${r.name}`.toLowerCase()),
    );
    const existingChannelKeys = new Set(
      [...guild.channels.cache.values()].map((c) => `${c.type}:${c.name}`.toLowerCase()),
    );
    // Trong snapshot, role hiện có → loại trừ trước khi tạo lại.
    const missingRoles = (backup.roles || []).filter(
      (r) => r.name && !existingRoleNames.has(r.name.toLowerCase()),
    );
    const missingChannels = (backup.channels || []).filter(
      (c) => c.name && !existingChannelKeys.has(`${c.type}:${c.name}`.toLowerCase()),
    );
    out.missingRoles = missingRoles.length;
    out.missingChannels = missingChannels.length;
    const total = missingRoles.length + missingChannels.length;
    if (total < MIN_MISSING) {
      return { ...out, reason: `chỉ thiếu ${total} mục — không đáng rollback` };
    }

    // ── Khôi phục TẠO LẠI phần thiếu (dùng engine backup có sẵn) ──
    const partial = {
      roles: missingRoles,
      channels: missingChannels,
      guildId: backup.guildId,
      guildName: backup.guildName,
      settings: backup.settings,
    };
    let createdRoles = new Map();
    let createdChannels = new Map();
    const restoreRoles = config.restoreRolesEnabled !== false && missingRoles.length > 0;
    const restoreChannels = config.restoreChannelsEnabled !== false && missingChannels.length > 0;
    if (restoreRoles) {
      // createRoles tạo theo thứ tự vị trí; trả Map oldId -> newId.
      createdRoles = await backupEngine.createRoles(guild, partial).catch(() => new Map());
    }
    if (restoreChannels) {
      createdChannels = await backupEngine
        .createChannels(guild, partial, createdRoles)
        .catch(() => new Map());
    }
    out.restoredRoles = createdRoles.size;
    out.restoredChannels = createdChannels.size;
    out.snapshotTs = snap.snapshotAt ?? null;
    out.ran = true;

    // ── Báo cáo lên kênh log ──
    try {
      const embed = logEmbed({
        title: "♻️ Nuke Rollback — đã hồi phục một phần cấu trúc",
        description:
          `Sau vụ **${modules.join(", ") || "nuke"}**${executorId ? ` của <@${executorId}>` : ""}, ` +
          `đã tạo lại **${out.restoredRoles} role** + **${out.restoredChannels} kênh** ` +
          `từ snapshot cục bộ${snap.snapshotAt ? ` (${new Date(snap.snapshotAt).toISOString().slice(0, 16).replace("T", " ")} UTC)` : ""}.`,
        color: Colors.Green,
        fields: [
          { name: "Role thiếu", value: `${missingRoles.length}`, inline: true },
          { name: "Kênh thiếu", value: `${missingChannels.length}`, inline: true },
          { name: "Nguồn", value: "💾 Snapshot VPS (không phụ thuộc cloud)", inline: true },
        ],
        footer: "Protogon · Nuke Rollback",
      });
      await sendLog(guild, config, embed);
    } catch {
      // log fail không ảnh hưởng kết quả
    }
    console.log(
      `[nukeRollback] ${guild.id}: +${out.restoredRoles} roles, +${out.restoredChannels} channels (thiếu ${missingRoles.length}/${missingChannels.length})`,
    );
    return out;
  }

  /** Dọn state (test). */
  function reset() {
    lastRun.clear();
    pending.clear();
  }

  return { scheduleRollback, runRollback, reset, GRACE_MS, MIN_MISSING, COOLDOWN_MS };
};
