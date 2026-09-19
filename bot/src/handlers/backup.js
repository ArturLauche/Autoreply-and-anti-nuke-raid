const { Colors, ChannelType, PermissionsBitField } = require("discord.js");
const zlib = require("zlib");
const net = require("net");
const dns = require("dns").promises;
const { logEmbed, sendLog } = require("../util");
const {
  compressAndEncryptBackup,
  decompressAndDecryptBackup,
  computeSnapshotChecksum,
  filterBackupComponents,
} = require("../backupUtils");

/**
 * Backup server → đám mây GitHub + khôi phục khi server bị nuke/raid phá sập.
 *
 * Bot quét backup:botGetPending mỗi ~20 giây:
 *  - kind "backup": chụp role (tên/màu/quyền) + kênh (kênh/quyền truy cập) + cấu hình
 *    + TIN NHẮN (tối đa 50 tin/kênh, kèm thứ tự thời gian), lưu vào bảng guildBackups,
 *    đẩy lên GitHub Gist nếu được yêu cầu.
 *  - kind "restore": đọc JSON backup, tạo lại role, danh mục, kênh + overwrite,
 *    SẮP XẾP LẠI đúng thứ tự role/kênh như trong file, phục hồi tin nhắn qua webhook
 *    (đúng thứ tự thời gian) KÈM MEDIA (ảnh/video tải về đăng lại thật), rồi áp lại
 *    cấu hình với id mới.
 *  - kind "import": file backup .msc/.json (bot nuke khác) được tải lên dashboard →
 *    giữ trong Convex file storage (tối đa 8 MB) → bot tải về, nhận diện định dạng
 *    (JSON/base64/có wrapper), chuẩn hóa, rồi khôi phục đúng thứ tự role/kênh/tin
 *    nhắn + media có trong file.
 */

/** Mỗi file media phục hồi tối đa 8 MB (an toàn dưới giới hạn upload của Discord). */
const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
/** Chờ tối đa khi tải 1 file media từ URL (ms). */
const MEDIA_FETCH_TIMEOUT_MS = 15_000;

/** Đuôi file theo MIME — dùng khi giải mã data URI trong file backup bot nuke. */
const MIME_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "text/plain": "txt",
  "text/html": "html",
  "application/json": "json",
  "application/pdf": "pdf",
  "application/zip": "zip",
};

function extFromMime(mime) {
  const key = String(mime || "")
    .toLowerCase()
    .split(";")[0]
    .trim();
  return MIME_EXT[key] || "bin";
}

/** Lấy tên file từ URL (bỏ query ?ex=... của CDN Discord), null nếu không có. */
function nameFromUrl(url) {
  try {
    const u = new URL(String(url));
    const base = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() || "");
    const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    return cleaned || null;
  } catch {
    return null;
  }
}

/** Các dải địa chỉ KHÔNG được phép chạm tới (mạng nội bộ / metadata / loopback). */
const BLOCKED_V4 = [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local + cloud metadata (169.254.169.254)
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved
];
const BLOCKED_V6 = [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
  ["::ffff:0:0", 96], // IPv4-mapped (soi tiếp phần v4 bên dưới)
  ["64:ff9b::", 96], // IPv4/IPv6 translation
];

/** IPv4-mapped IPv6 (::ffff:a.b.c.d) → trả về phần IPv4 để soi cùng luật v4. */
function unwrapMappedV6(ip) {
  const m = String(ip)
    .toLowerCase()
    .match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return m ? m[1] : null;
}

/** Địa chỉ có nằm trong dải nội bộ/đặc biệt không? (thuần, test được) */
function isPrivateAddress(ip) {
  if (!ip) return false;
  const s = String(ip).trim();
  const mapped = unwrapMappedV6(s);
  if (mapped) return isPrivateAddress(mapped);
  const family = net.isIP(s);
  if (family === 0) return false;
  const list = family === 4 ? BLOCKED_V4 : BLOCKED_V6;
  for (const [addr, bits] of list) {
    try {
      const block = new net.BlockList();
      block.addSubnet(addr, bits, family === 4 ? "ipv4" : "ipv6");
      if (block.check(s, family === 4 ? "ipv4" : "ipv6")) return true;
    } catch {
      // dải không hợp lệ với runtime — bỏ qua, không chặn nhầm
    }
  }
  return false;
}

/**
 * Kiểm tra URL tải media từ xa có an toàn không (chống SSRF).
 *
 * File backup nhập từ bot nuke khác chứa URL media do kẻ tấn công kiểm soát;
 * bot tải chúng từ VPS nên có thể bị dụ chạm cloud metadata (169.254.169.254),
 * localhost hay mạng nội bộ. Chỉ cho https/http, và phân giải DNS: nếu BẤT KỲ
 * địa chỉ nào là nội bộ → từ chối. Ném lỗi khi không an toàn, trả URL khi hợp lệ.
 *
 * Hạn chế còn lại (TOCTOU): fetch phân giải DNS lần nữa sau bước kiểm tra, nên
 * kẻ kiểm soát DNS TTL ngắn có thể tráo sang IP nội bộ giữa hai lần. Đủ cho mối
 * đe phổ biến (IP literal, redirect); chống rebinding triệt để cần pin IP khi
 * kết nối — ngoài phạm vi module này.
 */
async function assertSafeRemoteUrl(raw) {
  let u;
  try {
    u = new URL(String(raw));
  } catch {
    throw new Error("URL không hợp lệ");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error("Chỉ cho phép URL http/https");
  }
  const host = u.hostname.replace(/^\[|\]$/g, "");
  // Host là IP literal → soi trực tiếp, không cần DNS.
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new Error("URL trỏ tới địa chỉ nội bộ");
    return u;
  }
  let addrs;
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new Error("Không phân giải được host");
  }
  if (!addrs.length) throw new Error("Không phân giải được host");
  if (addrs.some((a) => isPrivateAddress(a.address))) {
    throw new Error("URL trỏ tới địa chỉ nội bộ");
  }
  return u;
}

/**
 * Tải 1 attachment (URL Discord CDN / URL bất kỳ hoặc data URI base64 nhúng
 * trong file backup của bot nuke) về buffer để đính trực tiếp vào tin khôi phục.
 * Trả { attachment: Buffer, name } hoặc null nếu không tải được / quá nặng.
 */
async function resolveAttachment(att, index) {
  const s = String(att || "").trim();
  if (!s) return null;
  try {
    if (s.startsWith("data:")) {
      const m = s.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
      if (!m) return null;
      const mime = m[1] || "";
      const isBase64 = !!m[2];
      // data URI KHÔNG có ";base64" chứa dữ liệu đã URL-encode (vd
      // "data:text/plain,Hello%20World"). Trước đây luôn giải mã base64 → ra
      // buffer rác (media phục hồi hỏng). Giải mã percent-encoding cho đúng.
      let buf;
      if (isBase64) {
        buf = Buffer.from((m[3] || "").replace(/\s+/g, ""), "base64");
      } else {
        let text = m[3] || "";
        try {
          text = decodeURIComponent(text);
        } catch {
          // % không hợp lệ — giữ nguyên thay vì ném lỗi
        }
        buf = Buffer.from(text, "utf8");
      }
      if (!buf.length || buf.length > MAX_MEDIA_BYTES) return null;
      return { attachment: buf, name: `media-${index}.${extFromMime(mime)}` };
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), MEDIA_FETCH_TIMEOUT_MS);
    try {
      // Chống SSRF: mỗi chặng (kể cả redirect) đều phải qua allowlist. Dùng
      // redirect "manual" để không bị Location header dụ sang IP nội bộ.
      let target = await assertSafeRemoteUrl(s);
      let res;
      for (let hop = 0; hop < 4; hop++) {
        res = await fetch(target, { signal: ctrl.signal, redirect: "manual" });
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get("location");
          if (!loc) return null;
          target = await assertSafeRemoteUrl(new URL(loc, target).href);
          continue;
        }
        break;
      }
      if (!res || !res.ok) return null;
      const len = Number(res.headers.get("content-length") || 0);
      if (len > MAX_MEDIA_BYTES) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length || buf.length > MAX_MEDIA_BYTES) return null;
      return { attachment: buf, name: nameFromUrl(s) || `media-${index}.bin` };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

const CHANNEL_TYPES = [
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildVoice,
  ChannelType.GuildCategory,
  ChannelType.GuildStageVoice,
  ChannelType.GuildForum,
];

/** Số tin nhắn tối đa chụp mỗi kênh văn bản khi backup kèm tin nhắn. */
const MAX_MESSAGES_PER_CHANNEL = 50;
/** Tổng tin nhắn tối đa của một backup (chống phình JSON). */
const TOTAL_MESSAGE_CAP = 3000;
/** Số tin nhắn tối đa phục hồi lại mỗi kênh khi restore (giới hạn thời gian chạy). */
const MAX_REPLAY_PER_CHANNEL = 50;
/** Chờ giữa 2 tin phục hồi (ms) — dưới giới hạn rate limit webhook (~30/phút). */
const REPLAY_DELAY_MS = 1_100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Lấy bitfield quyền hiệu dụng của bot (dùng để không cấp quyền vượt quá bot). */
function myPermissionBits(guild) {
  return guild.members.me?.permissions?.bitfield ?? 0n;
}

/** Đọc tin nhắn của một kênh văn bản (mới nhất, sắp tăng dần theo thời gian). */
async function captureChannelMessages(channel, limit) {
  const out = [];
  try {
    const fetched = await channel.messages.fetch({ limit });
    const list = [...fetched.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    for (const m of list) {
      const attachments =
        (m.attachments?.size ?? 0) > 0 ? m.attachments.map((a) => a.url).slice(0, 3) : [];
      out.push({
        id: m.id,
        authorId: m.author?.id ?? null,
        authorName: m.author?.username ?? "?",
        timestamp: m.createdTimestamp,
        content: (m.content || "").slice(0, 2000),
        attachments,
      });
    }
  } catch (e) {
    console.error(`[backup:messages] #${channel.name}:`, e.message);
  }
  return out;
}

/** Chụp toàn bộ cấu trúc server thành object JSON (kèm tin nhắn nếu được yêu cầu). */
async function snapshotGuild(guild, { includeMessages = false } = {}) {
  const myBits = myPermissionBits(guild);
  const roles = [...guild.roles.cache.values()]
    .filter((r) => r.name !== "@everyone" && !r.managed)
    .sort((a, b) => a.position - b.position)
    .map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      hoist: r.hoist,
      mentionable: r.mentionable,
      permissions: (BigInt(r.permissions.bitfield) & myBits).toString(),
      position: r.position,
      icon: r.iconURL({ size: 64 }) ?? null,
      unicodeEmoji: r.unicodeEmoji ?? null,
    }));

  const emojis = [...guild.emojis.cache.values()]
    .filter((e) => e.name && e.available !== false)
    .map((e) => ({
      id: e.id,
      name: e.name,
      animated: !!e.animated,
      url: e.imageURL({ size: 128, extension: e.animated ? "gif" : "png" }) ?? null,
    }));
  const stickers = [...guild.stickers.cache.values()]
    .map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? null,
      tags: s.tags ?? null,
      formatType: s.format ?? null,
      url: s.url ?? null,
    }))
    .filter((s) => s.name && s.url);

  const channels = [];
  let messageTotal = 0;
  for (const c of [...guild.channels.cache.values()].sort((a, b) => a.position - b.position)) {
    if (!CHANNEL_TYPES.includes(c.type)) continue;
    const entry = {
      id: c.id,
      name: c.name,
      type: c.type,
      topic: c.topic ?? null,
      nsfw: c.nsfw ?? false,
      bitrate: c.bitrate ?? null,
      userLimit: c.userLimit ?? null,
      position: c.position ?? 0,
      parentId: c.parentId ?? null,
      overwrites: [...c.permissionOverwrites.cache.values()].map((o) => ({
        id: o.id,
        type: o.type,
        allow: (BigInt(o.allow.bitfield) & myBits).toString(),
        deny: o.deny.bitfield.toString(),
      })),
    };
    if (
      includeMessages &&
      (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
      typeof c.messages?.fetch === "function"
    ) {
      const left = TOTAL_MESSAGE_CAP - messageTotal;
      if (left > 0) {
        const msgs = await captureChannelMessages(c, Math.min(MAX_MESSAGES_PER_CHANNEL, left));
        if (msgs.length > 0) {
          entry.messages = msgs;
          messageTotal += msgs.length;
        }
      }
    }
    channels.push(entry);
  }

  return {
    version: 4,
    guildId: guild.id,
    guildName: guild.name,
    createdAt: Date.now(),
    roles,
    channels,
    emojis,
    stickers,
    emojiCount: emojis.length,
    stickerCount: stickers.length,
    messageCount: messageTotal,
  };
}

async function snapshotWithSettings(client, store, guildId, includeMessages) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild || guild.available === false) {
    throw new Error("Bot không còn trong server hoặc server không sẵn sàng");
  }
  const snapshot = await snapshotGuild(guild, { includeMessages });
  const cfg = await store.getConfig(guildId).catch(() => null);
  if (cfg) {
    snapshot.settings = {
      prefix: cfg.prefix ?? "!",
      badWords: cfg.badWords ?? [],
      modRoles: cfg.modRoles ?? [],
      adminRoles: cfg.adminRoles ?? [],
      whitelistRoles: cfg.whitelistRoles ?? [],
      whitelistUsers: cfg.whitelistUsers ?? [],
      logChannelId: cfg.logChannelId ?? null,
      modLogChannelId: cfg.modLogChannelId ?? null,
    };
  }
  return { snapshot, guild };
}

/**
 * Đẩy backup lên GitHub Gist thông qua action Convex (cần GITHUB_TOKEN).
 * backupJson PHẢI là bản ĐÃ NÉN (compressAndEncryptBackup) — Gist giới hạn
 * file 900 KB, JSON backup server lớn vượt xa con số đó và bị GitHub từ chối
 * (HTTP 413) → chủ server tưởng backup xong mà trên Gist không có gì. Bản nén
 * zlib ("z:...") giảm 60-80% và được restore/import nhận diện ngược lại được.
 */
async function pushBackupToGithub(store, { guildId, backupId, backupJson, guildName }) {
  try {
    const res = await store.client.action("backup_github:githubPush", {
      guildId,
      backupId,
      backupJson,
      guildName,
    });
    return res;
  } catch (e) {
    return { ok: false, error: e?.message || "lỗi gọi action GitHub" };
  }
}

async function runBackup(client, store, guildId, opts = {}) {
  // LƯU Ý: option "pushToGithub" (boolean) TRÙNG TÊN với hàm pushBackupToGithub —
  // trước đây const { pushToGithub = false } đã che khuất hàm cùng tên khiến lệnh
  // gọi pushToGithub(store, …) ném TypeError (gọi boolean). Đã đổi tên option.
  const {
    pushToGithub: pushToGithubOpt = false,
    includeMessages = false,
    skipNotice = false,
  } = opts;
  const { snapshot, guild } = await snapshotWithSettings(client, store, guildId, includeMessages);

  // ─── Incremental backup: skip if unchanged ─────────────────────────────
  // So khớp checksum "ổn định" (không gồm timestamps/media): server không đổi
  // → bỏ qua, không gửi log spam. Lỗi (query chưa deploy, v.v.) → backup đầy đủ.
  const currentChecksum = computeSnapshotChecksum(snapshot);
  try {
    const lastBackup = await store.client
      .query("backup:botGetLastChecksum", { guildId })
      .catch(() => null);
    const lastChecksum = lastBackup?.backupSnapshotChecksum;
    if (lastChecksum && lastChecksum === currentChecksum) {
      console.log(`[backup] ${guildId}: unchanged (checksum match) — skipping`);
      await store.client
        .mutation("bot_writes:botClearBackup", { guildId, kind: "backup", storeOk: true })
        .catch(() => {});
      // Người dùng bấm "Backup ngay" chủ động → phải có thông báo, không im lặng
      // (im lặng khiến họ tưởng backup không hoạt động). Backup tự động theo lịch
      // vẫn im lặng như cũ để không spam kênh log.
      if (skipNotice) {
        try {
          const g = client.guilds.cache.get(guildId);
          if (g) {
            await sendToLog(
              g,
              logEmbed({
                title: "💾 Backup bỏ qua — server không có thay đổi",
                description:
                  "Cấu trúc server **hoàn toàn giống** bản backup gần nhất (role, kênh, emoji, sticker, cấu hình đều không đổi) nên không tạo bản trùng lặp. Bật **Kèm tin nhắn** để backup tính cả nội dung tin nhắn (nội dung tin mới được so sánh khi đã bật).",
                color: Colors.Yellow,
                footer: "Protogon · Backup",
              }),
              store,
            );
          }
        } catch {
          // không gửi được log — bỏ qua
        }
      }
      return;
    }
  } catch {
    // Query not available yet — proceed with full backup
  }

  // ─── Compress + encrypt backup ──────────────────────────────────────────
  const { backupJson, compressed, checksum, encrypted } = compressAndEncryptBackup(snapshot);

  let backupId;
  try {
    const stored = await store.client.mutation("bot_writes:botStoreBackup", {
      guildId,
      guildName: snapshot.guildName,
      backupJson,
      roleCount: snapshot.roles.length,
      channelCount: snapshot.channels.length,
      emojiCount: snapshot.emojis?.length ?? 0,
      stickerCount: snapshot.stickers?.length ?? 0,
      messageCount: snapshot.messageCount ?? 0,
      source: "backup",
      backupChecksum: checksum,
      backupSnapshotChecksum: currentChecksum,
      backupCompressed: compressed || undefined,
      backupEncrypted: encrypted || undefined,
    });
    backupId = stored?.backupId;
  } catch (e) {
    console.error(`[backup:store] ${guildId}:`, e.message);
  }

  let githubLine = "không đẩy GitHub";
  if (pushToGithubOpt && backupId) {
    const res = await pushBackupToGithub(store, {
      guildId,
      backupId,
      // Gửi bản ĐÃ NÉN — Gist giới hạn 900 KB, JSON thô của server lớn bị từ chối.
      backupJson,
      guildName: snapshot.guildName,
    });
    githubLine = res?.ok
      ? `đã đẩy GitHub${res.compressed ? " (bản nén zlib — nạp lại bằng bot Protogon)" : ""}: ${res.url || "xem dashboard"}`
      : `GitHub thất bại: ${res?.error || "lỗi"}`;
  } else if (pushToGithubOpt && !backupId) {
    githubLine = "lưu Convex thất bại → bỏ qua GitHub";
  }

  // Clear pending flag + cập nhật lastBackupAt (khi store thành công) để
  // botGetDueAuto không kích hoạt lại tức thì sau khi backup xong.
  await store.client
    .mutation("bot_writes:botClearBackup", { guildId, kind: "backup", storeOk: !!backupId })
    .catch((e) => console.error("[backup:clear]", e.message));

  const fields = [
    { name: "Role", value: `${snapshot.roles.length}`, inline: true },
    { name: "Kênh", value: `${snapshot.channels.length}`, inline: true },
  ];
  if ((snapshot.emojis?.length ?? 0) > 0) {
    fields.push({ name: "Emoji", value: `${snapshot.emojis.length}`, inline: true });
  }
  if ((snapshot.stickers?.length ?? 0) > 0) {
    fields.push({ name: "Sticker", value: `${snapshot.stickers.length}`, inline: true });
  }
  if ((snapshot.messageCount ?? 0) > 0) {
    fields.push({ name: "Tin nhắn", value: `${snapshot.messageCount}`, inline: true });
  }
  fields.push({ name: "GitHub", value: githubLine.slice(0, 200), inline: false });

  const embed = logEmbed({
    title: "💾 Đã tạo backup server",
    description: `Đã chụp **${snapshot.roles.length} role** + **${snapshot.channels.length} kênh**${(snapshot.emojis?.length ?? 0) > 0 ? ` + **${snapshot.emojis.length} emoji**` : ""}${(snapshot.stickers?.length ?? 0) > 0 ? ` + **${snapshot.stickers.length} sticker**` : ""}${(snapshot.messageCount ?? 0) > 0 ? ` + **${snapshot.messageCount} tin nhắn**` : ""} của **${snapshot.guildName}** và lưu lên cloud.`,
    color: Colors.Blurple,
    fields,
    footer: "Protogon · Backup",
  });
  await sendToLog(guild, embed, store);
  console.log(
    `[backup] ${guildId}: xong (${snapshot.roles.length} roles, ${snapshot.channels.length} channels, ${snapshot.emojis?.length ?? 0} emojis, ${snapshot.stickers?.length ?? 0} stickers, ${snapshot.messageCount ?? 0} messages) — ${githubLine}`,
  );
}

/** Gửi embed tới kênh log của guild qua webhook (giống các handler khác). */
async function sendToLog(guild, embed, store) {
  try {
    const config = store ? await store.getConfig(guild.id).catch(() => null) : null;
    await sendLog(guild, config, embed);
  } catch {
    // webhook chưa sẵn sàng hoặc chưa set kênh log — bỏ qua
  }
}

/** Role theo đúng thứ tự vị trí trong backup (ổn định với role thiếu position). */
function sortedRoles(backup) {
  return (backup.roles || [])
    .map((r, i) => ({ ...r, _i: i }))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a._i - b._i);
}

/** Kênh theo đúng thứ tự vị trí trong backup (ổn định với kênh thiếu position). */
function sortedChannels(backup) {
  return (backup.channels || [])
    .map((c, i) => ({ ...c, _i: i }))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a._i - b._i);
}

/** Tạo lại role từ backup theo đúng thứ tự; trả về Map oldId -> newId. */
async function createRoles(guild, backup) {
  const map = new Map();
  const sorted = sortedRoles(backup);
  for (const r of sorted) {
    if (!r.name) continue;
    try {
      const opts = {
        name: String(r.name).slice(0, 100),
        color: r.color ?? 0,
        hoist: !!r.hoist,
        mentionable: !!r.mentionable,
        permissions: BigInt(r.permissions || "0"),
      };
      if (r.unicodeEmoji) opts.unicodeEmoji = String(r.unicodeEmoji).slice(0, 2);
      const created = await guild.roles.create(opts);
      // Icon là URL CDN — set SAU khi tạo role để lỗi icon không làm mất cả role.
      if (r.icon) {
        try {
          await created.setIcon(String(r.icon));
        } catch (e) {
          console.error(`[backup:role:icon] ${r.name}:`, e.message);
        }
      }
      map.set(r.id, created.id);
    } catch (e) {
      console.error(`[backup:role] ${r.name}:`, e.message);
    }
  }
  // Sắp xếp lại vị trí role đúng như thứ tự trong file (best-effort — cao hơn = trên).
  try {
    const createdSorted = sorted.map((r) => map.get(r.id)).filter(Boolean);
    for (let i = 0; i < createdSorted.length; i++) {
      try {
        await createdSorted[i].setPosition(i);
      } catch {
        // thiếu quyền / giới hạn — bỏ qua role này
      }
    }
  } catch (e) {
    console.error(`[backup:role:positions] ${guild.id}:`, e.message);
  }
  return map;
}

/** Tạo lại kênh từ backup theo đúng thứ tự + vị trí; trả về Map oldId -> newId. */
async function createChannels(guild, backup, roleMap) {
  const map = new Map();
  const sorted = sortedChannels(backup);

  const buildOpts = (ch) => {
    const overwrites = (ch.overwrites || [])
      .map((o) => {
        if (o.type === 0) {
          const newId = o.id === backup.guildId ? guild.id : roleMap.get(o.id);
          if (!newId) return null;
          return { id: newId, type: 0, allow: BigInt(o.allow || "0"), deny: BigInt(o.deny || "0") };
        }
        return { id: o.id, type: 1, allow: BigInt(o.allow || "0"), deny: BigInt(o.deny || "0") };
      })
      .filter(Boolean);
    const opts = {
      name: String(ch.name || "channel").slice(0, 100),
      type: ch.type,
      topic: ch.topic ?? undefined,
      nsfw: !!ch.nsfw,
      permissionOverwrites: overwrites,
    };
    if (ch.parentId && map.has(ch.parentId)) opts.parent = map.get(ch.parentId);
    if (ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice) {
      if (ch.bitrate) opts.bitrate = Math.min(384000, Math.max(8000, ch.bitrate));
      if (ch.userLimit) opts.userLimit = Math.min(99, Math.max(0, ch.userLimit));
    }
    return opts;
  };

  const setPosition = async (ch, newId) => {
    try {
      const created =
        guild.channels.cache.get(newId) ?? (await guild.channels.fetch(newId).catch(() => null));
      if (created && Number.isFinite(ch.position)) {
        await created.setPosition(Math.max(0, Math.min(250, ch.position)));
      }
    } catch {
      // best-effort — thứ tự tạo đã gần đúng thứ tự file
    }
  };

  // Tạo danh mục trước (theo thứ tự vị trí), rồi kênh con.
  for (const ch of sorted) {
    if (ch.type !== ChannelType.GuildCategory) continue;
    if (map.has(ch.id)) continue;
    try {
      const c = await guild.channels.create(buildOpts(ch));
      map.set(ch.id, c.id);
      await setPosition(ch, c.id);
    } catch (e) {
      console.error(`[backup:category] ${ch.name}:`, e.message);
    }
  }
  for (const ch of sorted) {
    if (ch.type === ChannelType.GuildCategory) continue;
    if (map.has(ch.id)) continue;
    try {
      const c = await guild.channels.create(buildOpts(ch));
      map.set(ch.id, c.id);
      await setPosition(ch, c.id);
    } catch (e) {
      console.error(`[backup:channel] ${ch.name}:`, e.message);
    }
  }
  return map;
}

/** Chuẩn hóa tên emoji (Discord: 2-32 ký tự, chữ thường + số + gạch dưới). */
function sanitizeEmojiName(name) {
  let n = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (n.length < 2) n = `${n}emj`.slice(0, 32);
  return n.slice(0, 32) || "emoji";
}

/**
 * Tạo lại emoji từ backup (URL CDN hoặc raw base64 nhúng trong file bot nuke).
 * Tên được chuẩn hóa theo quy tắc Discord; mỗi emoji lỗi chỉ bỏ qua riêng lẻ.
 * Tên hàm là recreateEmojis (KHÔNG phải restoreEmojis) — trước đây trùng với
 * hằng boolean restoreEmojis trong restoreCore làm CRASH mọi restore mặc định
 * (TypeError: restoreEmojis is not a function) ngay sau khi phát lại tin nhắn:
 * không tạo emoji/sticker, không áp settings, không gửi embed hoàn tất.
 */
async function recreateEmojis(guild, backup) {
  let created = 0;
  const list = backup.emojis || [];
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e || !e.name) continue;
    const name = sanitizeEmojiName(e.name);
    try {
      const source = e.raw || e.url;
      const f = source ? await resolveAttachment(source, i) : null;
      if (!f) {
        console.error(`[backup:emoji] ${e.name}: không tải được ảnh`);
        continue;
      }
      await guild.emojis.create({ attachment: f.attachment, name });
      created++;
    } catch (err) {
      console.error(`[backup:emoji] ${e.name}:`, err.message);
    }
  }
  return created;
}

/** Tên sticker: 2-30 ký tự (Discord). */
function sanitizeStickerName(name) {
  const n = String(name || "")
    .trim()
    .slice(0, 30);
  if (n.length < 2) return `${n}_`.slice(0, 30);
  return n;
}

/** Sticker PNG/APNG/Lottie ≤ 512 KB — lớn hơn là Discord từ chối, bỏ qua sớm. */
const MAX_STICKER_BYTES = 512 * 1024;

/**
 * Tạo lại sticker từ backup (URL CDN hoặc raw base64 nhúng trong file bot nuke).
 * tags là emoji unicode đại diện (Discord bắt buộc với PNG/APNG) — mặc định 😀.
 */
async function restoreStickers(guild, backup) {
  let created = 0;
  const list = backup.stickers || [];
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (!s || !s.name) continue;
    const name = sanitizeStickerName(s.name);
    try {
      const source = s.raw || s.url;
      const f = source ? await resolveAttachment(source, i) : null;
      if (!f || f.attachment.length > MAX_STICKER_BYTES) {
        console.error(`[backup:sticker] ${s.name}: không tải được file (hoặc quá 512 KB)`);
        continue;
      }
      const tags = String(s.tags || "😀").slice(0, 8) || "😀";
      try {
        await guild.stickers.create({
          file: f.attachment,
          name,
          tags,
          description: s.description ? String(s.description).slice(0, 100) : undefined,
        });
      } catch (err) {
        // Lottie đôi khi không nhận tags → thử lại không tags.
        await guild.stickers.create({
          file: f.attachment,
          name,
          description: s.description ? String(s.description).slice(0, 100) : undefined,
        });
      }
      created++;
    } catch (err) {
      console.error(`[backup:sticker] ${s.name}:`, err.message);
    }
  }
  return created;
}

/**
 * Phục hồi tin nhắn đã backup vào kênh mới — qua WEBHOOK (giữ tên người gửi),
 * gửi theo đúng THỨ TỰ THỜI GIAN trong file (tăng dần), tối đa
 * MAX_REPLAY_PER_CHANNEL tin/kênh. Media (ảnh/video…) của từng tin được tải về
 * (URL hoặc data URI base64 trong file bot nuke) và đăng LẠI THẬT vào tin khôi
 * phục — chỉ những file không tải được mới hiện dạng link 📎. Trả số tin đã phục hồi.
 */
async function replayMessages(guild, backup, channelMap) {
  let sent = 0;
  for (const ch of backup.channels || []) {
    const msgs = (ch.messages || [])
      .slice()
      .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
      .slice(-MAX_REPLAY_PER_CHANNEL);
    if (msgs.length === 0) continue;
    const newId = channelMap.get(ch.id);
    if (!newId) continue;
    const channel =
      guild.channels.cache.get(newId) ?? (await guild.channels.fetch(newId).catch(() => null));
    if (!channel || !channel.isTextBased?.()) continue;

    let webhook = null;
    try {
      webhook = await channel.createWebhook({
        name: String(backup.guildName || "Protogon Restore").slice(0, 30) || "Protogon Restore",
        avatar: guild.iconURL({ size: 128 }) ?? undefined,
      });
    } catch (e) {
      console.error(`[backup:replay:webhook] #${ch.name}:`, e.message);
    }

    for (const m of msgs) {
      // Tải media (tối đa 3 file/tin, mỗi file ≤ 8 MB) — file lỗi thì hiện link.
      const files = [];
      const failedLines = [];
      const atts = (m.attachments || []).slice(0, 3);
      for (let i = 0; i < atts.length; i++) {
        const f = await resolveAttachment(atts[i], i);
        if (f) files.push(f);
        else failedLines.push(String(atts[i]));
      }
      const attachLine = failedLines.map((u) => `\n📎 ${u}`).join("");
      const content = m.content || "";
      const body = content
        ? `${content}${attachLine}`
        : attachLine || (files.length > 0 ? "" : "(tin không có nội dung)");
      try {
        if (webhook) {
          const payload = {
            username: String(m.authorName || "?").slice(0, 32) || "?",
          };
          if (body.trim()) payload.content = body.slice(0, 2000);
          if (files.length > 0) payload.files = files;
          await webhook.send(payload);
        } else {
          const payload = {};
          if (body.trim()) payload.content = `**${m.authorName || "?"}:** ${body.slice(0, 1900)}`;
          if (files.length > 0) payload.files = files;
          await channel.send(payload);
        }
        sent++;
      } catch {
        // bỏ qua tin lỗi (vd media vượt giới hạn server), tiếp tục
      }
      await sleep(REPLAY_DELAY_MS);
    }

    if (webhook) webhook.delete().catch(() => {});
  }
  return sent;
}

/** Đếm tổng tin nhắn có trong backup. */
function countMessages(backup) {
  return (backup.channels || []).reduce(
    (n, c) => n + (Array.isArray(c.messages) ? c.messages.length : 0),
    0,
  );
}

/* ------------------------- Nhập file backup .msc (bot nuke) ------------------------- */

const CHANNEL_TYPE_BY_NAME = {
  text: ChannelType.GuildText,
  voice: ChannelType.GuildVoice,
  category: ChannelType.GuildCategory,
  announcement: ChannelType.GuildAnnouncement,
  news: ChannelType.GuildAnnouncement,
  stage: ChannelType.GuildStageVoice,
  stagevoice: ChannelType.GuildStageVoice,
  forum: ChannelType.GuildForum,
};

function pickFirst(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

function parseColor(c) {
  if (c === undefined || c === null) return 0;
  if (typeof c === "number") return Math.max(0, Math.min(0xffffff, Math.floor(c)));
  const s = String(c).trim();
  const hex = s.replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return parseInt(hex, 16);
  if (/^0x[0-9a-fA-F]{1,6}$/i.test(s)) return parseInt(s.slice(2), 16);
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? Math.max(0, Math.min(0xffffff, n)) : 0;
}

function num(v, fallback = 0) {
  const n = typeof v === "number" ? v : parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function str(v, fallback = "") {
  if (v === undefined || v === null) return fallback;
  return String(v);
}

function normalizeType(v, fallback = ChannelType.GuildText) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const key = v.toLowerCase().replace(/[^a-z]/g, "");
    if (CHANNEL_TYPE_BY_NAME[key] !== undefined) return CHANNEL_TYPE_BY_NAME[key];
    const n = parseInt(v, 10);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function normalizeOverwrite(o) {
  if (!o || typeof o !== "object") return null;
  const type = o.type === 1 || o.type === "member" ? 1 : 0;
  return {
    id: str(o.id ?? o.roleId ?? o.userId ?? o.targetId, ""),
    type,
    // allow/deny có thể là số, chuỗi số, hoặc DANH SÁCH TÊN quyền (vd "manage_messages,view_channel").
    allow: parsePermissions(o.allow ?? o.allowNew ?? "0"),
    deny: parsePermissions(o.deny ?? o.denyNew ?? "0"),
  };
}

function normalizeMessage(m) {
  if (m === null || typeof m !== "object") return null;
  let ts = pickFirst(m, ["timestamp", "createdAt", "created_at", "date", "time"]);
  if (typeof ts === "string") ts = Date.parse(ts);
  ts = Number.isFinite(ts) ? ts : 0;
  const author =
    m.author && typeof m.author === "object"
      ? str(m.author.username ?? m.author.name ?? m.author.id, "?")
      : str(m.author ?? m.username ?? m.user ?? "?", "?");
  return {
    id: str(m.id ?? "", ""),
    authorId: str(m.author?.id ?? m.userId ?? "", ""),
    authorName: author.slice(0, 32) || "?",
    timestamp: ts,
    content: str(m.content ?? m.text ?? m.message ?? "", "").slice(0, 2000),
    attachments: Array.isArray(m.attachments)
      ? m.attachments
          .map((a) => (typeof a === "string" ? a : str(a?.url ?? a?.proxyUrl ?? "", "")))
          .filter(Boolean)
          .slice(0, 3)
      : [],
  };
}

function normalizeRole(r, index) {
  if (!r || typeof r !== "object") return null;
  const name = str(r.name ?? r.roleName ?? r.role_name ?? "", "");
  if (!name) return null;
  return {
    id: str(r.id ?? r.roleId ?? r.role_id ?? `role-${index}`, ""),
    name: name.slice(0, 100),
    color: parseColor(r.color ?? r.colour),
    hoist: !!r.hoist,
    mentionable: !!r.mentionable,
    // permissions có thể là số/chuỗi số, hoặc danh sách tên quyền ("manage_messages,ban_members").
    permissions: parsePermissions(r.permissions ?? r.permissionBits ?? "0"),
    position: num(r.position, index),
    icon: str(r.icon ?? r.iconUrl ?? "", null),
    unicodeEmoji: r.unicodeEmoji ?? r.emoji ?? null,
  };
}

function normalizeChannel(c, index) {
  if (!c || typeof c !== "object") return null;
  const name = str(c.name ?? c.channelName ?? c.channel_name ?? "", "");
  if (!name) return null;
  const overwrites = Array.isArray(
    c.overwrites ??
      c.permissionOverwrites ??
      c.permission_overwrites ??
      c.permissionOverwritesRaw ??
      c.rolePermissions,
  )
    ? (
        c.overwrites ??
        c.permissionOverwrites ??
        c.permission_overwrites ??
        c.permissionOverwritesRaw ??
        c.rolePermissions
      )
        .map(normalizeOverwrite)
        .filter(Boolean)
    : [];
  const messages = asArray(c.messages ?? c.messageData ?? c.msgs)
    ? asArray(c.messages ?? c.messageData ?? c.msgs)
        .map(normalizeMessage)
        .filter(Boolean)
    : [];
  return {
    id: str(c.id ?? c.channelId ?? c.channel_id ?? `ch-${index}`, ""),
    name: name.slice(0, 100),
    type: normalizeType(c.type ?? c.channelType ?? c.channel_type),
    topic: str(c.topic ?? c.topicText ?? "", null),
    nsfw: !!c.nsfw,
    bitrate: c.bitrate ? num(c.bitrate, null) : null,
    userLimit: c.userLimit ? num(c.userLimit, null) : null,
    position: num(c.position, index),
    parentId: str(
      c.parentId ??
        c.parent ??
        c.parent_id ??
        c.categoryId ??
        c.category_id ??
        c.category ??
        c.parentChannelId ??
        "",
      null,
    ),
    overwrites,
    messages,
  };
}

/**
 * Chuẩn hóa 1 emoji từ file bot nuke khác: chuỗi `<:name:id>` / `<a:name:id>` /
 * `name:id` / tên trần, hoặc object có { name, url/imageUrl, raw base64 }.
 */
function normalizeEmoji(e, index) {
  if (e === null || e === undefined) return null;
  if (typeof e === "string") {
    const s = e.trim();
    if (!s) return null;
    // URL CDN trực tiếp (file bot nuke lưu emoji dạng link, KHÔNG kèm tên):
    // lấy ID từ đường dẫn /emojis/<id>.png và tự đặt tên theo ID (Discord bắt buộc tên).
    if (s.startsWith("http")) {
      const idm = s.match(/\/emojis\/(\d+)/);
      const id = idm ? idm[1] : "";
      return {
        id: id || `emoji-${index}`,
        name: id ? `e${id}` : `emoji_${index}`,
        animated: /\.gif(?:[?#]|$)/i.test(s),
        url: s,
        raw: null,
      };
    }
    let name;
    let id;
    const m = s.match(/^<a?:([a-zA-Z0-9_]+):(\d+)>$/);
    if (m) {
      name = m[1];
      id = m[2];
    } else {
      const parts = s.split(":");
      name = parts[0];
      id = parts[1] ?? "";
    }
    if (!name) return null;
    return {
      id: id || `emoji-${index}`,
      name: name.slice(0, 32),
      animated: s.startsWith("<a:"),
      url: null,
      raw: null,
    };
  }
  if (typeof e === "object") {
    const name = str(e.name ?? e.emojiName ?? e.emoji_name ?? "", "");
    if (!name) return null;
    const urlRaw = str(e.url ?? e.imageUrl ?? e.image_url ?? e.assetUrl ?? "", null);
    // data URI nhét trong trường url → chuyển sang raw (không lưu blob vào bản gọn).
    const url = urlRaw && urlRaw.startsWith("http") ? urlRaw : null;
    const raw =
      typeof e.raw === "string" && e.raw.startsWith("data:")
        ? e.raw
        : typeof e.image === "string" && e.image.startsWith("data:")
          ? e.image
          : urlRaw && urlRaw.startsWith("data:")
            ? urlRaw
            : null;
    return {
      id: str(e.id ?? e.emojiId ?? e.emoji_id ?? `emoji-${index}`, ""),
      name: name.slice(0, 32),
      animated: !!e.animated,
      url,
      raw,
    };
  }
  return null;
}

/**
 * Chuẩn hóa 1 sticker từ file bot nuke khác: chuỗi (URL/data URI) hoặc object
 * có { name, tags, description, url/assetUrl, raw base64 }.
 */
function normalizeSticker(s, index) {
  if (s === null || s === undefined) return null;
  if (typeof s === "string") {
    const v = s.trim();
    if (!v) return null;
    return {
      id: `sticker-${index}`,
      name: `sticker_${index}`,
      description: null,
      tags: null,
      formatType: null,
      url: v.startsWith("http") ? v : null,
      raw: v.startsWith("data:") ? v : null,
    };
  }
  if (typeof s === "object") {
    const name = str(s.name ?? s.stickerName ?? s.sticker_name ?? "", "");
    if (!name) return null;
    // asset là hash của Discord chứ không phải URL — chỉ nhận khi là link đầy đủ;
    // data URI nhét trong trường url/asset → chuyển sang raw.
    const urlRaw = str(s.url ?? s.assetUrl ?? s.asset ?? "", null);
    const url = urlRaw && urlRaw.startsWith("http") ? urlRaw : null;
    const raw =
      typeof s.raw === "string" && s.raw.startsWith("data:")
        ? s.raw
        : urlRaw && urlRaw.startsWith("data:")
          ? urlRaw
          : null;
    return {
      id: str(s.id ?? s.stickerId ?? s.sticker_id ?? `sticker-${index}`, ""),
      name: name.slice(0, 30),
      description:
        s.description === null || s.description === undefined
          ? null
          : String(s.description).slice(0, 100),
      tags: s.tags ?? s.tag ?? null,
      formatType: s.formatType ?? s.format_type ?? s.format ?? null,
      url,
      raw,
    };
  }
  return null;
}

/** Quyền lưu dạng danh sách TÊN → bitfield (discord.js: tên camelCase "ManageMessages"). */
function permFlagValue(key) {
  const k = String(key || "").trim();
  if (!k) return null;
  const F = PermissionsBitField.Flags;
  // Chỉ nhận giá trị bigint. Truy cập trực tiếp F[k] với "__proto__",
  // "constructor", "toString"… trả về giá trị prototype (object/function) →
  // BigInt() ném và cả file import hỏng (test-backup-import phủ).
  const asFlag = (v) => (typeof v === "bigint" ? v : null);
  const direct = asFlag(F[k]);
  if (direct !== null) return direct;
  const camel = k
    .replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    .replace(/^([a-z])/, (c) => c.toUpperCase());
  const camelV = asFlag(F[camel]);
  if (camelV !== null) return camelV;
  const lower = k.toLowerCase();
  for (const fk of Object.keys(F)) {
    if (fk.toLowerCase() === lower) {
      const v = asFlag(F[fk]);
      if (v !== null) return v;
    }
  }
  return null;
}

/**
 * Chuẩn hóa permissions: số / chuỗi số / mảng tên / chuỗi tên cách nhau
 * ("manage_messages,ban_members") → bitfield dạng chuỗi.
 */
function parsePermissions(raw) {
  if (raw === undefined || raw === null || raw === "") return "0";
  if (typeof raw === "number") return String(Math.max(0, Math.floor(raw)));
  if (Array.isArray(raw)) raw = raw.join(",");
  const s = String(raw).trim();
  if (/^\d+$/.test(s)) return s;
  let bits = 0n;
  for (const part of s.split(/[,\s|]+/)) {
    const v = permFlagValue(part);
    if (v !== undefined && v !== null) bits |= BigInt(v);
  }
  return bits.toString();
}

/** Nhận array hoặc object keyed-by-id (biến thể "channels": {"123": {...}} → [...values]). */
function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") return Object.values(v);
  return null;
}

/** Thử đọc JSON từ chuỗi; trả null nếu không phải. */
function tryParseJson(text) {
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

/** Giải mã base64 (bỏ khoảng trắng); chỉ nhận khi kết quả trông giống JSON. */
function decodeB64Text(text) {
  try {
    const cleaned = String(text).replace(/\s+/g, "");
    if (cleaned.length < 8) return text;
    const out = Buffer.from(cleaned, "base64").toString("utf8");
    return /[{}[\]]/.test(out) ? out : text;
  } catch {
    return text;
  }
}

/** Cắt lấy phần JSON nằm giữa văn bản thừa (dòng tiêu đề "MSC BACKUP v1.0" / trailer…). */
function extractJsonFromText(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const parsed = tryParseJson(text.slice(start, end + 1));
    if (parsed) return parsed;
  }
  const startB = text.indexOf("[");
  const endB = text.lastIndexOf("]");
  if (startB >= 0 && endB > startB) {
    const parsed = tryParseJson(text.slice(startB, endB + 1));
    if (parsed) return parsed;
  }
  return null;
}

/** Các khóa chứa nội dung backup thật (array hoặc object keyed-by-id). */
const BACKUP_CONTENT_KEYS = [
  "roles",
  "guildRoles",
  "rolesData",
  "roleData",
  "channels",
  "guildChannels",
  "channelsData",
  "channelData",
  "emojis",
  "guildEmojis",
  "emojiData",
  "stickers",
  "guildStickers",
  "stickerData",
];
/** Các khóa wrapper thường gặp của file bot nuke khác. */
const WRAP_KEYS = [
  "data",
  "guild",
  "server",
  "backup",
  "snapshot",
  "result",
  "body",
  "content",
  "file",
  "json",
  "payload",
  "response",
  "message",
];

/**
 * Tìm object chứa roles/channels/emojis/stickers ở bất kỳ độ sâu nào trong file
 * backup (wrapper lồng nhau tối đa 10 lớp, kể cả wrapper chứa chuỗi JSON/base64
 * nhúng — đọc đệ quy chính nó). Trả null nếu không tìm thấy.
 */
function findBackupPayload(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 10) return null;
  if (Array.isArray(node)) return null;
  const hasContent = BACKUP_CONTENT_KEYS.some((k) => node[k] !== undefined && node[k] !== null);
  if (hasContent) return node;
  for (const k of WRAP_KEYS) {
    const v = node[k];
    if (v === undefined || v === null) continue;
    if (typeof v === "string") {
      // Chuỗi lớn (> 1MB) chắc chắn là payload blob (alphabet+key+payload của file
      // mã hóa, base64 media…) chứ không phải wrapper JSON — bỏ qua cho nhanh.
      if (v.length > 1_000_000) continue;
      // Nhận chuỗi JSON trực tiếp HOẶC chuỗi base64 giải mã ra JSON.
      const looksJsonish = /[{}[\]]/.test(v) || decodeB64Text(v) !== v;
      if (looksJsonish) {
        try {
          const nested = normalizeBackupFile(v);
          if (nested) return nested;
        } catch {
          // không phải JSON — tiếp tục
        }
      }
      continue;
    }
    const found = findBackupPayload(v, depth + 1);
    if (found) return found;
  }
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (v && typeof v === "object") {
      const found = findBackupPayload(v, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/* ----------------------------------------------------------------------------------------
 * Giải mã file .msc mã hóa theo định dạng riêng của bot nuke:
 *   {"v":1,"guild_id":…,"saved_at":…,"alphabet":"<bảng chữ cái tùy biến>","key":"…","payload":"…"}
 * Payload là dữ liệu backup được mã hóa bằng base-N (thường base85) với bảng chữ cái
 * tùy biến theo từng file, kèm khóa XOR / dịch Vigenère (key nằm ngay trong file).
 * Vì không có chuẩn chung, bot thử một loạt sơ đồ phổ biến rồi XÁC THỰC kết quả phải
 * là JSON chứa role/kênh/emoji/sticker — sơ đồ sai gần như không thể cho kết quả hợp lệ.
 * ---------------------------------------------------------------------------------------- */

/** Có phải object chứa nội dung backup (roles/channels/emojis/stickers) không. */
function hasBackupContent(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  return BACKUP_CONTENT_KEYS.some((k) => obj[k] !== undefined && obj[k] !== null);
}

/**
 * Giải mã base-N theo nhóm: group=5 → mỗi 5 ký tự → 4 byte (base85 tùy biến),
 * group=4 → mỗi 4 ký tự → 3 byte (base64 tùy biến). Nhóm lẻ k ký tự (2..4) → k-1
 * byte; file theo chuẩn "pad tới bội của nhóm" sẽ có byte 0 dẫn đầu —
 * textFromBuffer đã bỏ qua byte 0 đầu.
 */
function baseNDecode(indices, N, group = 5) {
  const bytes = [];
  const full = Math.floor(indices.length / group);
  for (let g = 0; g < full; g++) {
    let v = 0;
    const base = g * group;
    for (let j = 0; j < group; j++) v = v * N + indices[base + j];
    if (group === 5) {
      bytes.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
    } else {
      bytes.push((v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
    }
  }
  const rem = indices.length % group;
  if (rem >= 2) {
    let v = 0;
    for (let j = 0; j < rem; j++) v = v * N + indices[indices.length - rem + j];
    for (let j = rem - 2; j >= 0; j--) bytes.push((v >>> (8 * j)) & 0xff);
  }
  return Buffer.from(bytes);
}

/**
 * Sinh danh sách Buffer ứng viên từ {alphabet, key, payload}. Quét hai họ mã hóa:
 *  - base-N nhóm 5 ký tự → 4 byte (thường là base85 với bảng chữ tùy biến);
 *  - base-64 nhóm 4 ký tự → 3 byte (bảng chữ 64 ký tự — biến thể base64 tùy biến).
 * Với mỗi họ: biến đổi chỉ số theo key (Vigenère +,-,XOR theo chỉ số alphabet HOẶC mã ASCII
 * của key) trước khi giải mã, rồi biến đổi byte (XOR/trừ theo key) sau khi giải mã.
 */
function mscDecodeCandidates({ alphabet, key, payload }) {
  const alpha = [...new Set([...String(alphabet)])];
  const N = alpha.length;
  if (N < 10 || N > 128 || typeof payload !== "string" || payload.length < 8) return [];
  const idx = new Map();
  alpha.forEach((c, i) => idx.set(c, i));
  const pIdx = [...payload].map((c) => idx.get(c));
  if (pIdx.some((v) => v === undefined)) return [];
  const kIdx =
    typeof key === "string" ? [...key].map((c) => idx.get(c)).filter((v) => v !== undefined) : [];
  const kAscii = typeof key === "string" ? Buffer.from(key, "latin1") : Buffer.alloc(0);
  const huge = payload.length > 300_000; // file rất lớn → giới hạn số ứng viên để không tốn RAM

  // JS % giữ dấu của số bị chia → dùng mod Euclid để kết quả luôn trong [0, N).
  const mod = (a, n) => ((a % n) + n) % n;
  // 1) Biến đổi trên DÃY CHỈ SỐ (trước base-N).
  const indexVariants = [pIdx];
  if (!huge) {
    if (kIdx.length > 0) {
      indexVariants.push(
        pIdx.map((v, i) => mod(v - kIdx[i % kIdx.length], N)),
        pIdx.map((v, i) => mod(v + kIdx[i % kIdx.length], N)),
        pIdx.map((v, i) => mod(v ^ kIdx[i % kIdx.length], N)),
      );
    }
    if (kAscii.length > 0) {
      indexVariants.push(
        pIdx.map((v, i) => mod(v - kAscii[i % kAscii.length], N)),
        pIdx.map((v, i) => mod(v + kAscii[i % kAscii.length], N)),
        pIdx.map((v, i) => mod(v ^ kAscii[i % kAscii.length], N)),
      );
    }
    indexVariants.push(pIdx.map((v) => N - 1 - v));
  }

  const groupSize = N === 64 ? 4 : 5;
  const out = [];
  for (const iv of indexVariants) {
    const bytes = baseNDecode(iv, N, groupSize);
    if (bytes.length === 0) continue;
    // 2) Biến đổi trên BYTES (sau base-N): nguyên trạng / XOR / trừ theo key.
    const byteVariants = [bytes];
    if (kIdx.length > 0) {
      const k1 = Buffer.from(kIdx.map((v) => v & 0xff));
      byteVariants.push(
        Buffer.from(bytes.map((b, i) => b ^ k1[i % k1.length])),
        Buffer.from(bytes.map((b, i) => b ^ kAscii[i % kAscii.length])),
        Buffer.from(bytes.map((b, i) => (b - k1[i % k1.length] + 256) % 256)),
      );
    }
    for (const bv of byteVariants) out.push(bv);
  }
  return out;
}

/** Đọc Buffer thành text; nhận UTF-8 và UTF-16LE (bỏ byte 0 dẫn đầu + kết quả có NUL rác). */
function textFromBuffer(buf) {
  if (!buf || buf.length === 0) return null;
  let i = 0;
  while (i < buf.length && buf[i] === 0) i++;
  const s = buf.subarray(i).toString("utf8");
  if (!s.includes("\u0000")) return s;
  const s16 = buf.subarray(i).toString("utf16le");
  return s16.includes("\u0000") ? null : s16;
}

/** Thử nén ngược gzip/zlib/deflate — một số bot nén backup trước khi mã hóa. */
function decompressCandidates(buf) {
  const out = [];
  if (buf.length > 4 && buf[0] === 0x1f && buf[1] === 0x8b) {
    try {
      out.push(zlib.gunzipSync(buf));
    } catch {
      /* bỏ qua */
    }
  } else if (buf.length > 2 && buf[0] === 0x78) {
    try {
      out.push(zlib.inflateSync(buf));
    } catch {
      /* bỏ qua */
    }
    try {
      out.push(zlib.inflateRawSync(buf));
    } catch {
      /* bỏ qua */
    }
  }
  return out;
}

/**
 * Giải mã payload {alphabet, key, payload} → object backup thật, hoặc null nếu
 * không khớp sơ đồ nào đã biết. Chỉ chấp nhận kết quả là JSON chứa nội dung backup.
 */
/** Bảng base64 chuẩn (64 ký tự) — phần đầu của bảng chữ của file .msc mã hóa. */
const STD_B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Giải mã đúng định dạng file .msc mã hóa của bot nuke (đã xác minh trên file thật):
 *   1. Nội dung backup là chuỗi JSON → base64 chuẩn (64 ký tự).
 *   2. Mỗi ký tự base64 có chỉ số i (0-63) được dịch Vigenère theo key trên bảng
 *      chữ 89 ký tự: payload[i] = alphabet[(i + keyIdx[j]) % 89], key lặp lại 32 ký tự
 *      (keyIdx[j] = alphabet.indexOf(key[j])). Ký tự padding '=' (chỉ số 64) cũng bị
 *      dịch → khi giải mã ngược cho giá trị ≥ 64, bỏ qua (chính là padding).
 * Trả về object backup hoặc null nếu không khớp.
 */
function decodeVigenereB64({ alphabet, key, payload }) {
  const alpha = [...new Set([...String(alphabet)])];
  const N = alpha.length;
  if (N < 64 || N > 128) return null;
  const idx = new Map();
  alpha.forEach((c, i) => idx.set(c, i));
  const kIdx = [...String(key || "")].map((c) => idx.get(c)).filter((v) => v !== undefined);
  if (kIdx.length === 0 || typeof payload !== "string" || payload.length < 8) return null;
  const mod = (a, n) => ((a % n) + n) % n;
  const chunks = [];
  let b64 = "";
  const maxChunks = Math.ceil(payload.length / 131_072) + 2; // chống payload bất thường
  for (let i = 0; i < payload.length; i++) {
    const p = idx.get(payload[i]);
    if (p === undefined) continue; // ký tự lạ ngoài bảng chữ — bỏ qua
    const v = mod(p - kIdx[i % kIdx.length], N);
    if (v >= 64) continue; // padding '=' bị dịch chuyển — bỏ qua
    b64 += STD_B64_ALPHABET[v];
    if (b64.length >= 131_072) {
      chunks.push(b64);
      b64 = "";
      if (chunks.length > maxChunks) return null;
    }
  }
  if (b64) chunks.push(b64);
  const raw = Buffer.concat(chunks.map((c) => Buffer.from(c, "base64")));
  if (raw.length === 0) return null;
  const text = textFromBuffer(raw);
  if (!text) return null;
  const obj = tryParseJson(text);
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  // guild_id là số 18 chữ số bị JSON.parse làm mất chính xác → lấy lại đúng chuỗi số từ text.
  if (obj.guild_id !== undefined && typeof obj.guild_id === "number") {
    const m = text.match(/"guild_id"\s*:\s*(\d{15,})/);
    if (m) obj.guildId = m[1];
  }
  return obj;
}

function decodeEncryptedMsc(parsed) {
  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof parsed.alphabet !== "string" ||
    typeof parsed.payload !== "string"
  ) {
    return null;
  }
  // 1) Sơ đồ đã xác minh trên file thật: base64 + Vigenère theo key trên bảng chữ 89 ký tự.
  try {
    const obj = decodeVigenereB64(parsed);
    if (obj && hasBackupContent(obj)) return obj;
  } catch {
    // rơi xuống các sơ đồ dự đoán bên dưới
  }
  // 2) Fallback: quét các sơ đồ base-N phổ biến khác (chưa xác minh file thật).
  let candidates;
  try {
    candidates = mscDecodeCandidates(parsed);
  } catch {
    return null;
  }
  for (const buf of candidates) {
    const tryObj = (bytes) => {
      const text = textFromBuffer(bytes);
      if (!text) return null;
      const obj = tryParseJson(text);
      return obj && hasBackupContent(obj) ? obj : null;
    };
    const obj = tryObj(buf);
    if (obj) return obj;
    for (const dec of decompressCandidates(buf)) {
      const obj2 = tryObj(dec);
      if (obj2) return obj2;
    }
  }
  return null;
}

/**
 * Chuẩn hóa nội dung file backup từ bot nuke khác (.msc / .json) về đúng shape
 * nội bộ của Protogon để chạy restore: { version, guildId, guildName, roles,
 * channels, emojis, stickers, settings, messageCount }. Nhận diện:
 *  - JSON trực tiếp / bọc base64 (kể cả có tiền tố data:...;base64, / base64://) / URL-encode;
 *  - JSON nằm giữa văn bản thừa (dòng tiêu đề, trailer…);
 *  - có wrapper ngoài (data / guild / server / backup / snapshot / result / body…)
 *    tới 5 lớp, kể cả wrapper chứa chuỗi JSON/base64 nhúng;
 *  - roles/channels/emojis/stickers/messages dạng ARRAY hoặc OBJECT keyed-by-id;
 *  - tên trường đa dạng (guildRoles, channelData, permission_overwrites…);
 *  - màu dạng số / hex "#RRGGBB" / "0x…"; type kênh dạng số hoặc chuỗi;
 *  - quyền dạng bitfield số hoặc danh sách tên ("manage_messages,ban_members").
 * Ném Error kèm lý do nếu không đọc được.
 */
function normalizeBackupFile(content) {
  let text = String(content || "")
    .replace(/^\uFEFF/, "")
    .trim();
  // Bản backup của chính Protogon (nén zlib "z:" / nén+mã hóa "e:" — tải từ Gist
  // GitHub hoặc file tải từ nơi khác): bung nén + giải mã TRƯỚC khi parse JSON.
  // Trước đây file Gist nén import vào server phụ bị lỗi "Không đọc được file
  // backup" dù file hoàn toàn hợp lệ.
  if (/^z:/.test(text) || /^e:/.test(text)) {
    try {
      text = decompressAndDecryptBackup(text);
    } catch {
      // không bung được (key sai / file hỏng) — vẫn thử các bước parse bên dưới
    }
  }
  // Gỡ tiền tố base64 thường gặp: data:application/json;base64, / base64:// / base64: / b64:
  const prefixed = text.match(
    /^(?:data:application\/(?:json|octet-stream)[^,]*;base64,|base64:\/\/|base64:|b64:)(.+)$/is,
  );
  if (prefixed) text = prefixed[1].trim();
  // URL-encode (có %7B… mà chưa có dấu { thật)
  if (!text.includes("{") && /%7B|%7D|%5B|%5D/i.test(text)) {
    try {
      text = decodeURIComponent(text);
    } catch {
      // giữ nguyên — các bước sau vẫn thử
    }
  }

  let parsed = tryParseJson(text);
  if (!parsed) parsed = tryParseJson(decodeB64Text(text));
  if (!parsed) parsed = extractJsonFromText(text);
  if (!parsed) parsed = extractJsonFromText(decodeB64Text(text));
  if (!parsed) {
    throw new Error(
      "Không đọc được file backup (.msc/.json) — đã thử: JSON trực tiếp, cắt theo dấu {…}, base64 và URL-encode. Hãy mở file bằng Notepad xem có phải văn bản JSON không.",
    );
  }
  // File mã hóa theo định dạng riêng của bot nuke: {alphabet, key, payload}.
  // Ưu tiên nội dung plaintext nếu có; chỉ giải mã khi không tìm thấy role/kênh thật.
  const encryptedWrapper =
    typeof parsed.alphabet === "string" &&
    typeof parsed.payload === "string" &&
    !findBackupPayload(parsed);
  if (encryptedWrapper) {
    const decoded = decodeEncryptedMsc(parsed);
    if (decoded) {
      parsed = decoded;
    } else {
      throw new Error(
        "File backup được mã hóa theo định dạng riêng của bot nuke (alphabet+key+payload) và bot chưa giải mã được định dạng này — hãy gửi nội dung file (.msc) cho nhà phát triển để hỗ trợ thêm.",
      );
    }
  }
  // Tìm object chứa roles/channels/emojis/stickers ở bất kỳ độ sâu (wrapper lồng nhau).
  const payload = findBackupPayload(parsed);
  if (!payload) {
    throw new Error("File backup không có cấu trúc role/kênh (hoặc emoji/sticker) để khôi phục");
  }
  parsed = payload;

  const rolesRaw = asArray(pickFirst(parsed, ["roles", "guildRoles", "rolesData", "roleData"]));
  const roles = rolesRaw ? rolesRaw.map(normalizeRole).filter(Boolean) : [];
  const channelsRaw = asArray(
    pickFirst(parsed, [
      "channels",
      "guildChannels",
      "channelsData",
      "channelData",
      "guildChannelsData",
    ]),
  );
  const channels = channelsRaw ? channelsRaw.map(normalizeChannel).filter(Boolean) : [];
  const emojisRaw = asArray(
    pickFirst(parsed, [
      "emojis",
      "guildEmojis",
      "emojiData",
      "emojisData",
      "customEmojis",
      "emojiList",
    ]),
  );
  const emojis = emojisRaw ? emojisRaw.map(normalizeEmoji).filter(Boolean) : [];
  const stickersRaw = asArray(
    pickFirst(parsed, ["stickers", "guildStickers", "stickerData", "stickersData", "stickerList"]),
  );
  const stickers = stickersRaw ? stickersRaw.map(normalizeSticker).filter(Boolean) : [];
  if (roles.length === 0 && channels.length === 0 && emojis.length === 0 && stickers.length === 0) {
    throw new Error("File backup không chứa role, kênh, emoji hoặc sticker nào để khôi phục");
  }
  const settings = pickFirst(parsed, ["settings", "config", "guildSettings", "botSettings"]) ?? {};
  // File import (.msc/.json) thường KHÔNG có guildId → trả undefined thay vì
  // chuỗi rỗng. guildId="" gây hiểu nhầm "đã có guild gốc" và làm audit phân
  // loại sai; overwrite @everyone cần guildId thật mới map được (xem createChannels).
  const rawGuildId = pickFirst(parsed, ["guildId", "id", "serverId", "guild_id"]);
  const guildId =
    rawGuildId === undefined || rawGuildId === null || String(rawGuildId).trim() === ""
      ? undefined
      : String(rawGuildId);
  return {
    version: 4,
    guildId,
    guildName: str(
      parsed.guildName ??
        parsed.guild_name ??
        parsed.name ??
        parsed.serverName ??
        parsed.server_name ??
        "",
      "server từ file backup",
    ),
    roles,
    channels,
    emojis,
    stickers,
    emojiCount: emojis.length,
    stickerCount: stickers.length,
    settings: settings && typeof settings === "object" ? settings : {},
    messageCount: countMessages({ channels }),
    source: "import",
  };
}

/** Tạo lại role/kênh + phục hồi tin nhắn + áp cấu hình — dùng chung cho restore mọi nguồn. */
async function restoreCore(client, store, guildId, backup, { backupName, source = "restore" }) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild || guild.available === false) {
    throw new Error("Bot không còn trong server cần khôi phục");
  }
  // Tùy chỉnh khôi phục từ web (bật/tắt role + emoji/sticker) — áp dụng cho cả
  // backup Protogon lẫn file .msc/.json của bot nuke (cùng restoreCore này).
  const cfg = await store.getConfig(guildId).catch(() => null);
  const restoreRoles = cfg?.restoreRolesEnabled !== false;
  const restoreChannels = cfg?.restoreChannelsEnabled !== false;
  const restoreMessages = cfg?.restoreMessagesEnabled !== false;
  const restoreEmojis = cfg?.restoreEmojisEnabled !== false;
  if (!restoreRoles || !restoreChannels || !restoreMessages || !restoreEmojis) {
    console.log(
      `[backup:restore] ${guildId}: tùy chỉnh khôi phục — role=${restoreRoles ? "bật" : "TẮT"}, kênh=${restoreChannels ? "bật" : "TẮT"}, tin nhắn=${restoreMessages ? "bật" : "TẮT"}, emoji/sticker=${restoreEmojis ? "bật" : "TẮT"}`,
    );
  }
  const roleMap = restoreRoles ? await createRoles(guild, backup) : new Map();
  const channelMap = restoreChannels ? await createChannels(guild, backup, roleMap) : new Map();
  const replayed = restoreMessages ? await replayMessages(guild, backup, channelMap) : 0;
  // Emoji + sticker: tải ảnh/file về và tạo lại thật (best-effort, lỗi từng cái bỏ qua).
  const emojisCreated = restoreEmojis ? await recreateEmojis(guild, backup) : 0;
  const stickersCreated = restoreEmojis ? await restoreStickers(guild, backup) : 0;

  // Áp lại cấu hình cơ bản với id mới (role/kênh đã được map sang server này).
  const s = backup.settings || {};
  const mapId = (id, m) => (id ? m.get(id) || undefined : undefined);
  await store.client
    .mutation("bot_writes:botRestoreSettings", {
      guildId,
      prefix: s.prefix,
      badWords: s.badWords,
      whitelistRoles: (s.whitelistRoles || []).map((id) => roleMap.get(id)).filter(Boolean),
      whitelistUsers: s.whitelistUsers,
      modRoles: (s.modRoles || []).map((id) => roleMap.get(id)).filter(Boolean),
      adminRoles: (s.adminRoles || []).map((id) => roleMap.get(id)).filter(Boolean),
      logChannelId: mapId(s.logChannelId, channelMap) ?? null,
      modLogChannelId: mapId(s.modLogChannelId, channelMap) ?? null,
    })
    .catch((e) => console.error(`[backup:settings] ${guildId}:`, e.message));

  await store.client
    .mutation("bot_writes:botClearBackup", {
      guildId,
      kind: source === "import" ? "import" : "restore",
    })
    .catch((e) => console.error("[backup:clear]", e.message));

  const fields = [];
  if (restoreRoles) {
    fields.push({ name: "Role đã tạo", value: `${roleMap.size}`, inline: true });
  } else {
    fields.push({ name: "Role", value: "⏭️ bỏ qua (đã tắt)", inline: true });
  }
  if (restoreChannels) {
    fields.push({ name: "Kênh đã tạo", value: `${channelMap.size}`, inline: true });
  } else {
    fields.push({ name: "Kênh", value: "⏭️ bỏ qua (đã tắt)", inline: true });
  }
  if (restoreEmojis) {
    if (emojisCreated > 0) {
      fields.push({ name: "Emoji đã tạo", value: `${emojisCreated}`, inline: true });
    }
    if (stickersCreated > 0) {
      fields.push({ name: "Sticker đã tạo", value: `${stickersCreated}`, inline: true });
    }
  } else {
    fields.push({ name: "Emoji/Sticker", value: "⏭️ bỏ qua (đã tắt)", inline: true });
  }
  if (restoreMessages) {
    if (replayed > 0) {
      fields.push({ name: "Tin nhắn đã phục hồi", value: `${replayed}`, inline: true });
    }
  } else {
    fields.push({ name: "Tin nhắn", value: "⏭️ bỏ qua (đã tắt)", inline: true });
  }
  fields.push({
    name: "Lưu ý",
    value:
      "Kênh đã được sắp xếp lại đúng thứ tự trong file backup; phần role, kênh, tin nhắn và emoji/sticker đã tắt trong Tùy chỉnh khôi phục sẽ không được tạo/phục hồi. Các role/kênh có sẵn của server này được giữ nguyên. Hãy kiểm tra lại quyền theo ý muốn.",
    inline: false,
  });

  const embed = logEmbed({
    title: "♻️ Đã khôi phục server từ backup",
    description: `Đã tạo lại cấu trúc của **${backupName || "server đã backup"}** trên **${guild.name}**${restoreRoles ? ` — **${roleMap.size} role**` : " (bỏ qua role — đã tắt)"}${restoreChannels ? ` — **${channelMap.size} kênh**` : " (bỏ qua kênh — đã tắt)"}${restoreMessages ? (replayed > 0 ? ` — phục hồi **${replayed} tin nhắn** theo đúng thứ tự thời gian` : "") : " (bỏ qua tin nhắn — đã tắt)"}${restoreEmojis && emojisCreated > 0 ? ` + **${emojisCreated} emoji**` : ""}${restoreEmojis && stickersCreated > 0 ? ` + **${stickersCreated} sticker**` : ""}${restoreEmojis ? "" : " (bỏ qua emoji/sticker — đã tắt)"}.`,
    color: Colors.Green,
    fields,
    footer: "Protogon · Backup",
  });
  await sendToLog(guild, embed, store);
  console.log(
    `[backup:restore] ${guildId}: ${roleMap.size} roles, ${channelMap.size} channels, ${replayed} messages, ${emojisCreated} emojis, ${stickersCreated} stickers (${source}, restoreRoles=${restoreRoles}, restoreChannels=${restoreChannels}, restoreMessages=${restoreMessages}, restoreEmojis=${restoreEmojis})`,
  );
  return {
    roleCount: roleMap.size,
    channelCount: channelMap.size,
    messageCount: replayed,
    emojiCount: emojisCreated,
    stickerCount: stickersCreated,
  };
}

async function runRestore(client, store, guildId, backupJson, backupName, options = {}) {
  let backup;
  try {
    let json = backupJson;
    try {
      json = decompressAndDecryptBackup(backupJson);
    } catch {}
    backup = JSON.parse(json);
  } catch {
    throw new Error("Backup bi hong (khong doc duoc JSON)");
  }
  if (
    options.restoreRoles === false ||
    options.restoreChannels === false ||
    options.restoreMessages === false ||
    options.restoreEmojis === false
  ) {
    backup = filterBackupComponents(backup, {
      roles: options.restoreRoles !== false,
      channels: options.restoreChannels !== false,
      emojis: options.restoreEmojis !== false,
      stickers: options.restoreEmojis !== false,
      messages: options.restoreMessages !== false,
    });
  }
  return restoreCore(client, store, guildId, backup, { backupName, source: "restore" });
}

/** Tải nội dung file import từ Convex file storage (URL botGetPending trả về). */
async function readImportContent(item) {
  if (item.importFileUrl) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60_000);
    try {
      const res = await fetch(item.importFileUrl, { signal: ctrl.signal });
      if (res.ok) return await res.text();
      throw new Error(
        `Không tải được file backup từ đám mây (HTTP ${res.status}) — hãy thử tải lại file`,
      );
    } catch (e) {
      if (e?.name === "AbortError" || e?.code === "ABORT_ERR") {
        throw new Error("Tải file backup từ đám mây quá lâu (> 60 giây) — hãy thử lại", {
          cause: e,
        });
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  if (item.fileContent) return item.fileContent; // fallback yêu cầu cũ lưu nội dung trực tiếp
  throw new Error("Không lấy được file backup từ đám mây — hãy thử tải lại file");
}

/**
 * Làm gọn bản backup lưu lại trong guildBackups: bỏ blob base64 nặng (media
 * trong tin nhắn + raw emoji/sticker) — chỉ giữ URL/link. Bản lưu này chỉ để
 * xem lại / khôi phục lần sau, còn việc đăng lại media thật dùng bản đầy đủ
 * trong bộ nhớ. Chống vượt giới hạn 1 MB của document Convex (file import lên
 * tới 8 MB có thể nhét nhiều base64).
 */
function slimBackupForStore(backup) {
  const clone = JSON.parse(JSON.stringify(backup));
  for (const ch of clone.channels || []) {
    for (const m of ch.messages || []) {
      if (Array.isArray(m.attachments)) {
        m.attachments = m.attachments
          .map((a) => (typeof a === "string" && a.startsWith("data:") ? null : a))
          .filter(Boolean);
      }
    }
  }
  for (const e of clone.emojis || []) delete e.raw;
  for (const s of clone.stickers || []) delete s.raw;
  return clone;
}

/** Khôi phục từ file backup .msc/.json tải lên (bot nuke khác). */
async function runImportRestore(client, store, guildId, fileContent, fileName) {
  const backup = normalizeBackupFile(fileContent);
  if (!backup.guildName || backup.guildName === "server từ file backup") {
    backup.guildName =
      String(fileName || "backup.msc")
        .replace(/\.(msc|json)$/i, "")
        .slice(0, 100) || "server từ file backup";
  }
  // Lưu bản đã chuẩn hóa (đã làm gọn blob base64) vào guildBackups để xem lại /
  // không mất dữ liệu — không nhét media nặng vào document (giới hạn 1 MB).
  try {
    await store.client.mutation("bot_writes:botStoreBackup", {
      guildId,
      guildName: backup.guildName,
      backupJson: JSON.stringify(slimBackupForStore(backup)),
      roleCount: backup.roles.length,
      channelCount: backup.channels.length,
      emojiCount: backup.emojis?.length ?? 0,
      stickerCount: backup.stickers?.length ?? 0,
      messageCount: backup.messageCount ?? 0,
      source: "import",
    });
  } catch (e) {
    console.error(`[backup:import:store] ${guildId}:`, e.message);
  }
  return restoreCore(client, store, guildId, backup, {
    backupName: backup.guildName,
    source: "import",
  });
}

/**
 * Chống lặp backup ngay trong process: guild đang được xử lý sẽ bị bỏ qua ở
 * lượt quét tiếp theo (kể cả khi lượt quét 20s bị chồng lấn do GitHub chậm).
 */
const inFlight = new Set();

/** Giành quyền xử lý trên Convex — chỉ ai claim được mới được chạy (chống trùng khi chạy 2 bot). */
async function claim(client, store, guildId, kind) {
  try {
    const res = await store.client.mutation("bot_writes:botClaimBackup", {
      guildId,
      kind,
    });
    return !!res?.ok;
  } catch (e) {
    console.error(`[backup:claim] ${guildId}:`, e.message);
    return false;
  }
}

/** Vòng quét định kỳ: nhận yêu cầu backup / khôi phục / import từ dashboard. */
async function pollBackups(client, store) {
  let pending;
  try {
    pending = await store.client.query("backup:botGetPending", {});
  } catch (e) {
    console.error(`[backup:poll]`, e.message);
    return;
  }
  if (!pending || pending.length === 0) return;
  for (const item of pending) {
    const key = `${item.guildId}:${item.kind}`;
    if (inFlight.has(key)) continue; // lượt quét trước đang xử lý — bỏ qua.
    // Giành quyền: nếu bot khác/lượt quét khác đã giành thì bỏ qua (không lặp).
    const won = await claim(client, store, item.guildId, item.kind);
    if (!won) continue;
    inFlight.add(key);
    try {
      if (item.kind === "backup") {
        await runBackup(client, store, item.guildId, {
          pushToGithub: !!item.pushToGithub,
          includeMessages: !!item.includeMessages,
          skipNotice: true,
        });
      } else if (item.kind === "restore") {
        await runRestore(client, store, item.guildId, item.backupJson, item.guildName);
      } else if (item.kind === "import") {
        const content = await readImportContent(item);
        await runImportRestore(client, store, item.guildId, content, item.fileName);
      }
    } catch (e) {
      console.error(`[backup:${item.kind}] ${item.guildId}:`, e.message);
      // Import (.msc/.json): BÁO LỖI lên dashboard để người dùng thấy lý do
      // (bot xóa cờ + file, giữ lại importError — web đọc qua backup:importStatus).
      // Backup/khôi phục backup có sẵn: xóa cờ như cũ (không có màn hình chờ).
      const reportKind =
        item.kind === "import" ? "bot_writes:botReportImportError" : "bot_writes:botClearBackup";
      await store.client
        .mutation(reportKind, {
          guildId: item.guildId,
          ...(item.kind === "import"
            ? { error: String(e?.message || "Lỗi không xác định").slice(0, 300) }
            : { kind: item.kind }),
        })
        .catch(() => {});
    } finally {
      inFlight.delete(key);
    }
  }
}

/**
 * Bot quét mỗi giờ: tìm server đã bật lịch tự động backup (2-30 ngày) và đã đến
 * hạn → đặt cờ yêu cầu để vòng tick thực hiện (đẩy lên GitHub chủ bot).
 * "Kèm tin nhắn" của bản auto theo bản backup gần nhất của từng server (đọc
 * backupMessageCount từ backup:botGetLastChecksum), để incremental backup so
 * checksum cùng chế độ — không tạo bản trùng lặp khi server không đổi.
 */
async function autoBackupSweep(client, store) {
  let due;
  try {
    due = await store.client.query("backup:botGetDueAuto", {});
  } catch (e) {
    console.error(`[backup:auto]`, e.message);
    return;
  }
  if (!due || due.length === 0) return;
  for (const item of due) {
    try {
      // Đồng bộ lựa chọn "Kèm tin nhắn" theo BẢN BACKUP GẦN NHẤT của server:
      // bản gần nhất có tin nhắn (messageCount > 0) → auto backup cũng kèm tin.
      // Quan trọng cho incremental: checksum snapshot phải cùng chế độ với bản
      // trước, ngược lại server không đổi vẫn tạo bản trùng lặp (hoặc bỏ nhầm).
      const last = await store.client
        .query("backup:botGetLastChecksum", { guildId: item.guildId })
        .catch(() => null);
      const includeMessages = (last?.backupMessageCount ?? 0) > 0;
      await store.client.mutation("bot_writes:botSetBackupRequest", {
        guildId: item.guildId,
        pushToGithub: true,
        includeMessages,
      });
      console.log(
        `[backup:auto] ${item.guildId}: lịch mỗi ${item.days} ngày → đã đặt yêu cầu backup`,
      );
    } catch (e) {
      console.error(`[backup:auto] ${item.guildId}:`, e.message);
    }
  }
}

/**
 * Clone server structure to another server.
 * Takes a backup from one server and restores it on the target.
 */
async function cloneToServer(
  client,
  store,
  sourceGuildId,
  targetGuildId,
  { componentFilter } = {},
) {
  const sourceGuild = client.guilds.cache.get(sourceGuildId);
  if (!sourceGuild) throw new Error("Bot khong co trong server nguon");
  const targetGuild = client.guilds.cache.get(targetGuildId);
  if (!targetGuild) throw new Error("Bot khong co trong server dich");

  // Take a snapshot of the source server
  const { snapshot } = await snapshotWithSettings(client, store, sourceGuildId, false);

  // Apply component filter if provided
  let backupData = snapshot;
  if (componentFilter) {
    backupData = filterBackupComponents(snapshot, componentFilter);
  }

  // Restore on the target server
  const result = await restoreCore(client, store, targetGuildId, backupData, {
    backupName: sourceGuild.name + " (clone)",
    source: "clone",
  });

  return { ...result, sourceName: sourceGuild.name, targetName: targetGuild.name };
}

module.exports = pollBackups;
module.exports.runBackup = runBackup;
module.exports.runRestore = runRestore;
module.exports.runImportRestore = runImportRestore;
module.exports.autoBackupSweep = autoBackupSweep;
// C1 localSnapshot.js tái dùng engine chụp có sẵn — PHẢI export, nếu không
// snapshotGuildLocal ném "backup.snapshotWithSettings is not a function".
module.exports.snapshotWithSettings = snapshotWithSettings;
module.exports.normalizeBackupFile = normalizeBackupFile;
module.exports.sortedRoles = sortedRoles;
module.exports.sortedChannels = sortedChannels;
// NukeRollback (S3) tái dùng 2 engine tạo lại role/kênh — không nhân bản logic.
module.exports.createRoles = createRoles;
module.exports.createChannels = createChannels;
module.exports.countMessages = countMessages;
module.exports.resolveAttachment = resolveAttachment;
module.exports.nameFromUrl = nameFromUrl;
module.exports.assertSafeRemoteUrl = assertSafeRemoteUrl;
module.exports.isPrivateAddress = isPrivateAddress;
module.exports.normalizeEmoji = normalizeEmoji;
module.exports.normalizeSticker = normalizeSticker;
module.exports.sanitizeEmojiName = sanitizeEmojiName;
module.exports.slimBackupForStore = slimBackupForStore;
module.exports.MAX_REPLAY_PER_CHANNEL = MAX_REPLAY_PER_CHANNEL;
module.exports.cloneToServer = cloneToServer;
module.exports.compressAndEncryptBackup = require("../backupUtils").compressAndEncryptBackup;
module.exports.decompressAndDecryptBackup = require("../backupUtils").decompressAndDecryptBackup;
module.exports.filterBackupComponents = require("../backupUtils").filterBackupComponents;
