const { EmbedBuilder, Colors, ChannelType } = require("discord.js");
const { logEmbed } = require("../util");

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
  const key = String(mime || "").toLowerCase().split(";")[0].trim();
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
      const buf = Buffer.from((m[3] || "").replace(/\s+/g, ""), "base64");
      if (!buf.length || buf.length > MAX_MEDIA_BYTES) return null;
      return { attachment: buf, name: `media-${index}.${extFromMime(mime)}` };
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), MEDIA_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(s, { signal: ctrl.signal, redirect: "follow" });
      if (!res.ok) return null;
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
      const attachments = (m.attachments?.size ?? 0) > 0 ? m.attachments.map((a) => a.url).slice(0, 3) : [];
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
  const everyoneId = guild.id;
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

/** Đẩy backup JSON lên GitHub Gist thông qua action Convex (cần GITHUB_TOKEN). */
async function pushToGithub(store, { guildId, backupId, backupJson, guildName }) {
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
  const { pushToGithub = false, includeMessages = false } = opts;
  const { snapshot, guild } = await snapshotWithSettings(client, store, guildId, includeMessages);
  const json = JSON.stringify(snapshot);
  let backupId;
  try {
    const stored = await store.client.mutation("bot_writes:botStoreBackup", {
      guildId,
      guildName: snapshot.guildName,
      backupJson: json,
      roleCount: snapshot.roles.length,
      channelCount: snapshot.channels.length,
      emojiCount: snapshot.emojis?.length ?? 0,
      stickerCount: snapshot.stickers?.length ?? 0,
      messageCount: snapshot.messageCount ?? 0,
      source: "backup",
    });
    backupId = stored?.backupId;
  } catch (e) {
    console.error(`[backup:store] ${guildId}:`, e.message);
  }

  let githubLine = "không đẩy GitHub";
  if (pushToGithub && backupId) {
    const res = await pushToGithub(store, {
      guildId,
      backupId,
      backupJson: json,
      guildName: snapshot.guildName,
    });
    githubLine = res?.ok
      ? `đã đẩy GitHub: ${res.url || "xem dashboard"}`
      : `GitHub thất bại: ${res?.error || "lỗi"}`;
  } else if (pushToGithub && !backupId) {
    githubLine = "lưu Convex thất bại → bỏ qua GitHub";
  }

  await store.client
    .mutation("bot_writes:botClearBackup", { guildId, kind: "backup" })
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
  await sendToLog(guild, embed);
  console.log(`[backup] ${guildId}: xong (${snapshot.roles.length} roles, ${snapshot.channels.length} channels, ${snapshot.emojis?.length ?? 0} emojis, ${snapshot.stickers?.length ?? 0} stickers, ${snapshot.messageCount ?? 0} messages) — ${githubLine}`);
}

/** Gửi embed tới kênh hệ thống của guild (best-effort). */
async function sendToLog(guild, embed) {
  try {
    const channel = guild.systemChannel;
    if (channel && channel.isTextBased()) await channel.send({ embeds: [embed] });
  } catch {
    // không có kênh phù hợp — bỏ qua
  }
}

/** Role theo đúng thứ tự vị trí trong backup (ổn định với role thiếu position). */
function sortedRoles(backup) {
  return (backup.roles || []).map((r, i) => ({ ...r, _i: i })).sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a._i - b._i);
}

/** Kênh theo đúng thứ tự vị trí trong backup (ổn định với kênh thiếu position). */
function sortedChannels(backup) {
  return (backup.channels || []).map((c, i) => ({ ...c, _i: i })).sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a._i - b._i);
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
  const channels = backup.channels || [];
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
      const created = guild.channels.cache.get(newId) ?? (await guild.channels.fetch(newId).catch(() => null));
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
 */
async function restoreEmojis(guild, backup) {
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
  const n = String(name || "").trim().slice(0, 30);
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
    const channel = guild.channels.cache.get(newId) ?? (await guild.channels.fetch(newId).catch(() => null));
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
      const body = content ? `${content}${attachLine}` : attachLine || (files.length > 0 ? "" : "(tin không có nội dung)");
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
  return (backup.channels || []).reduce((n, c) => n + (Array.isArray(c.messages) ? c.messages.length : 0), 0);
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
    allow: str(o.allow ?? o.allowNew ?? "0", "0"),
    deny: str(o.deny ?? o.denyNew ?? "0", "0"),
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
      ? m.attachments.map((a) => (typeof a === "string" ? a : str(a?.url ?? a?.proxyUrl ?? "", ""))).filter(Boolean).slice(0, 3)
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
    permissions: str(r.permissions ?? r.permissionBits ?? "0", "0"),
    position: num(r.position, index),
    icon: str(r.icon ?? r.iconUrl ?? "", null),
    unicodeEmoji: r.unicodeEmoji ?? r.emoji ?? null,
  };
}

function normalizeChannel(c, index) {
  if (!c || typeof c !== "object") return null;
  const name = str(c.name ?? c.channelName ?? c.channel_name ?? "", "");
  if (!name) return null;
  const overwrites = Array.isArray(c.overwrites ?? c.permissionOverwrites ?? c.permission_overwrites ?? c.permissionOverwritesRaw ?? c.rolePermissions)
    ? (c.overwrites ?? c.permissionOverwrites ?? c.permission_overwrites ?? c.permissionOverwritesRaw ?? c.rolePermissions)
        .map(normalizeOverwrite)
        .filter(Boolean)
    : [];
  const messages = Array.isArray(c.messages ?? c.messageData ?? c.msgs)
    ? (c.messages ?? c.messageData ?? c.msgs).map(normalizeMessage).filter(Boolean)
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
    parentId: str(c.parentId ?? c.parent ?? c.parent_id ?? c.categoryId ?? c.category ?? c.parentChannelId ?? "", null),
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
    let name = "";
    let id = "";
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
      description: s.description === null || s.description === undefined ? null : String(s.description).slice(0, 100),
      tags: s.tags ?? s.tag ?? null,
      formatType: s.formatType ?? s.format_type ?? s.format ?? null,
      url,
      raw,
    };
  }
  return null;
}

/**
 * Chuẩn hóa nội dung file backup từ bot nuke khác (.msc / .json) về đúng shape
 * nội bộ của Protogon để chạy restore: { version, guildId, guildName, roles,
 * channels, settings, messageCount }. Nhận diện:
 *  - JSON trực tiếp, hoặc JSON bọc base64;
 *  - có wrapper ngoài (data / guild / server / backup / snapshot / result);
 *  - tên trường đa dạng (guildRoles, channelData, permission_overwrites…);
 *  - màu dạng số / hex "#RRGGBB" / "0x…"; type kênh dạng số hoặc chuỗi.
 * Ném Error kèm lý do nếu không đọc được.
 */
function normalizeBackupFile(content) {
  let text = String(content || "").replace(/^\uFEFF/, "").trim();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    try {
      parsed = JSON.parse(Buffer.from(text, "base64").toString("utf8"));
    } catch {
      throw new Error("File không phải JSON hợp lệ (đã thử cả base64) — hãy kiểm tra lại file backup");
    }
  }
  // Gỡ wrapper ngoài (tối đa 3 lớp) nếu bên trong có dấu hiệu chứa roles/channels.
  for (let i = 0; i < 3; i++) {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) break;
    const inner = pickFirst(parsed, ["data", "guild", "server", "backup", "snapshot", "result"]);
    if (!inner || typeof inner !== "object" || Array.isArray(inner)) break;
    const looksLikeBackup = ["roles", "guildRoles", "rolesData", "channels", "guildChannels", "channelsData"].some(
      (k) => Array.isArray(inner[k]),
    );
    if (!looksLikeBackup) break;
    parsed = inner;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("File backup không có cấu trúc roles/channels để khôi phục");
  }

  const roles = Array.isArray(pickFirst(parsed, ["roles", "guildRoles", "rolesData", "roleData"]))
    ? pickFirst(parsed, ["roles", "guildRoles", "rolesData", "roleData"])
        .map(normalizeRole)
        .filter(Boolean)
    : [];
  const channels = Array.isArray(pickFirst(parsed, ["channels", "guildChannels", "channelsData", "channelData", "guildChannelsData"]))
    ? pickFirst(parsed, ["channels", "guildChannels", "channelsData", "channelData", "guildChannelsData"])
        .map(normalizeChannel)
        .filter(Boolean)
    : [];
  const emojis = Array.isArray(pickFirst(parsed, ["emojis", "guildEmojis", "emojiData", "emojisData", "customEmojis", "emojiList"]))
    ? pickFirst(parsed, ["emojis", "guildEmojis", "emojiData", "emojisData", "customEmojis", "emojiList"])
        .map(normalizeEmoji)
        .filter(Boolean)
    : [];
  const stickers = Array.isArray(pickFirst(parsed, ["stickers", "guildStickers", "stickerData", "stickersData", "stickerList"]))
    ? pickFirst(parsed, ["stickers", "guildStickers", "stickerData", "stickersData", "stickerList"])
        .map(normalizeSticker)
        .filter(Boolean)
    : [];
  if (roles.length === 0 && channels.length === 0 && emojis.length === 0 && stickers.length === 0) {
    throw new Error("File backup không chứa role, kênh, emoji hoặc sticker nào để khôi phục");
  }
  const settings = pickFirst(parsed, ["settings", "config", "guildSettings", "botSettings"]) ?? {};
  return {
    version: 4,
    guildId: str(parsed.guildId ?? parsed.id ?? parsed.serverId ?? parsed.guild_id ?? "", null),
    guildName: str(parsed.guildName ?? parsed.guild_name ?? parsed.name ?? parsed.serverName ?? parsed.server_name ?? "", "server từ file backup"),
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
  const roleMap = await createRoles(guild, backup);
  const channelMap = await createChannels(guild, backup, roleMap);
  const replayed = await replayMessages(guild, backup, channelMap);
  // Emoji + sticker: tải ảnh/file về và tạo lại thật (best-effort, lỗi từng cái bỏ qua).
  const emojisCreated = await restoreEmojis(guild, backup);
  const stickersCreated = await restoreStickers(guild, backup);

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
    .mutation("bot_writes:botClearBackup", { guildId, kind: source === "import" ? "import" : "restore" })
    .catch((e) => console.error("[backup:clear]", e.message));

  const fields = [
    { name: "Role đã tạo", value: `${roleMap.size}`, inline: true },
    { name: "Kênh đã tạo", value: `${channelMap.size}`, inline: true },
  ];
  if (emojisCreated > 0) {
    fields.push({ name: "Emoji đã tạo", value: `${emojisCreated}`, inline: true });
  }
  if (stickersCreated > 0) {
    fields.push({ name: "Sticker đã tạo", value: `${stickersCreated}`, inline: true });
  }
  if (replayed > 0) {
    fields.push({ name: "Tin nhắn đã phục hồi", value: `${replayed}`, inline: true });
  }
  fields.push({
    name: "Lưu ý",
    value:
      "Các role/kênh có sẵn của server này được giữ nguyên. Role và kênh đã được sắp xếp lại đúng thứ tự trong file backup. Hãy kiểm tra lại quyền theo ý muốn.",
    inline: false,
  });

  const embed = logEmbed({
    title: "♻️ Đã khôi phục server từ backup",
    description: `Đã tạo lại cấu trúc của **${backupName || "server đã backup"}** trên **${guild.name}**${replayed > 0 ? ` — phục hồi **${replayed} tin nhắn** theo đúng thứ tự thời gian` : ""}${emojisCreated > 0 ? ` + **${emojisCreated} emoji**` : ""}${stickersCreated > 0 ? ` + **${stickersCreated} sticker**` : ""}.`,
    color: Colors.Green,
    fields,
    footer: "Protogon · Backup",
  });
  await sendToLog(guild, embed);
  console.log(`[backup:restore] ${guildId}: ${roleMap.size} roles, ${channelMap.size} channels, ${replayed} messages, ${emojisCreated} emojis, ${stickersCreated} stickers (${source})`);
  return {
    roleCount: roleMap.size,
    channelCount: channelMap.size,
    messageCount: replayed,
    emojiCount: emojisCreated,
    stickerCount: stickersCreated,
  };
}

async function runRestore(client, store, guildId, backupJson, backupName) {
  let backup;
  try {
    backup = JSON.parse(backupJson);
  } catch {
    throw new Error("Backup bị hỏng (không đọc được JSON)");
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
        throw new Error("Tải file backup từ đám mây quá lâu (> 60 giây) — hãy thử lại");
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
    backup.guildName = String(fileName || "backup.msc").replace(/\.(msc|json)$/i, "").slice(0, 100) || "server từ file backup";
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
          ...(item.kind === "import" ? { error: String(e?.message || "Lỗi không xác định").slice(0, 300) } : { kind: item.kind }),
        })
        .catch(() => {});
    } finally {
      inFlight.delete(key);
    }
  }
}

/**
 * Quét định kỳ (mỗi giờ): tìm server đã bật lịch tự động backup (2-30 ngày)
 * và đã đến hạn → đặt cờ yêu cầu để vòng quét 20s thực hiện (đẩy lên GitHub chủ bot).
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
      await store.client.mutation("bot_writes:botSetBackupRequest", {
        guildId: item.guildId,
        pushToGithub: true,
      });
      console.log(`[backup:auto] ${item.guildId}: lịch mỗi ${item.days} ngày → đã đặt yêu cầu backup`);
    } catch (e) {
      console.error(`[backup:auto] ${item.guildId}:`, e.message);
    }
  }
}

module.exports = pollBackups;
module.exports.runBackup = runBackup;
module.exports.runRestore = runRestore;
module.exports.runImportRestore = runImportRestore;
module.exports.autoBackupSweep = autoBackupSweep;
module.exports.normalizeBackupFile = normalizeBackupFile;
module.exports.sortedRoles = sortedRoles;
module.exports.sortedChannels = sortedChannels;
module.exports.countMessages = countMessages;
module.exports.resolveAttachment = resolveAttachment;
module.exports.nameFromUrl = nameFromUrl;
module.exports.normalizeEmoji = normalizeEmoji;
module.exports.normalizeSticker = normalizeSticker;
module.exports.sanitizeEmojiName = sanitizeEmojiName;
module.exports.slimBackupForStore = slimBackupForStore;
module.exports.MAX_REPLAY_PER_CHANNEL = MAX_REPLAY_PER_CHANNEL;
