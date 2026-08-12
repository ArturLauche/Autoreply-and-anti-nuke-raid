const { EmbedBuilder, Colors, ChannelType } = require("discord.js");
const { logEmbed } = require("../util");

/**
 * Backup server → đám mây GitHub + khôi phục khi server bị nuke/raid phá sập.
 *
 * Bot quét backup:botGetPending mỗi ~20 giây:
 *  - kind "backup": chụp role (tên/màu/quyền) + kênh (kênh/quyền truy cập) + cấu hình,
 *    lưu vào bảng guildBackups, đẩy lên GitHub Gist nếu được yêu cầu.
 *  - kind "restore": đọc JSON backup, tạo lại role, danh mục, kênh + overwrite,
 *    rồi áp lại cấu hình (prefix, từ ngữ xấu, role mod/admin, kênh log) với id mới.
 */

const CHANNEL_TYPES = [
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildVoice,
  ChannelType.GuildCategory,
  ChannelType.GuildStageVoice,
  ChannelType.GuildForum,
];

/** Lấy bitfield quyền hiệu dụng của bot (dùng để không cấp quyền vượt quá bot). */
function myPermissionBits(guild) {
  return guild.members.me?.permissions?.bitfield ?? 0n;
}

/** Chụp toàn bộ cấu trúc server thành object JSON. */
function snapshotGuild(guild) {
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

  const channels = [...guild.channels.cache.values()]
    .filter((c) => CHANNEL_TYPES.includes(c.type))
    .map((c) => ({
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
    }));

  return {
    version: 2,
    guildId: guild.id,
    guildName: guild.name,
    createdAt: Date.now(),
    roles,
    channels,
  };
}

async function snapshotWithSettings(client, store, guildId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild || guild.available === false) {
    throw new Error("Bot không còn trong server hoặc server không sẵn sàng");
  }
  const snapshot = snapshotGuild(guild);
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

async function runBackup(client, store, guildId, pushToGithub) {
  const { snapshot, guild } = await snapshotWithSettings(client, store, guildId);
  const json = JSON.stringify(snapshot);
  let backupId;
  try {
    const stored = await store.client.mutation("bot_writes:botStoreBackup", {
      guildId,
      guildName: snapshot.guildName,
      backupJson: json,
      roleCount: snapshot.roles.length,
      channelCount: snapshot.channels.length,
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

  const embed = logEmbed({
    title: "💾 Đã tạo backup server",
    description: `Đã chụp **${snapshot.roles.length} role** + **${snapshot.channels.length} kênh** của **${snapshot.guildName}** và lưu lên cloud.`,
    color: Colors.Blurple,
    fields: [
      { name: "Role", value: `${snapshot.roles.length}`, inline: true },
      { name: "Kênh", value: `${snapshot.channels.length}`, inline: true },
      { name: "GitHub", value: githubLine.slice(0, 200), inline: false },
    ],
    footer: "Protogon · Backup",
  });
  await sendToLog(guild, embed);
  console.log(`[backup] ${guildId}: xong (${snapshot.roles.length} roles, ${snapshot.channels.length} channels) — ${githubLine}`);
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

/** Tạo lại role từ backup; trả về Map oldId -> newId. */
async function createRoles(guild, backup) {
  const map = new Map();
  for (const r of backup.roles || []) {
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
  return map;
}

/** Tạo lại kênh từ backup; trả về Map oldId -> newId. */
async function createChannels(guild, backup, roleMap) {
  const map = new Map();
  const channels = backup.channels || [];
  const byId = new Map(channels.map((c) => [c.id, c]));

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

  // Tạo danh mục trước (theo thứ tự vị trí), rồi kênh con.
  const sorted = [...channels].sort((a, b) => a.position - b.position);
  for (const ch of sorted) {
    if (ch.type !== ChannelType.GuildCategory) continue;
    if (map.has(ch.id)) continue;
    try {
      const c = await guild.channels.create(buildOpts(ch));
      map.set(ch.id, c.id);
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
    } catch (e) {
      console.error(`[backup:channel] ${ch.name}:`, e.message);
    }
  }
  return map;
}

async function runRestore(client, store, guildId, backupJson, backupName) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild || guild.available === false) {
    throw new Error("Bot không còn trong server cần khôi phục");
  }
  let backup;
  try {
    backup = JSON.parse(backupJson);
  } catch {
    throw new Error("Backup bị hỏng (không đọc được JSON)");
  }

  const roleMap = await createRoles(guild, backup);
  const channelMap = await createChannels(guild, backup, roleMap);

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
    .mutation("bot_writes:botClearBackup", { guildId, kind: "restore" })
    .catch((e) => console.error("[backup:clear]", e.message));

  const embed = logEmbed({
    title: "♻️ Đã khôi phục server từ backup",
    description: `Đã tạo lại cấu trúc của **${backupName || "server đã backup"}** trên **${guild.name}**.`,
    color: Colors.Green,
    fields: [
      { name: "Role đã tạo", value: `${roleMap.size}`, inline: true },
      { name: "Kênh đã tạo", value: `${channelMap.size}`, inline: true },
      {
        name: "Lưu ý",
        value:
          "Các role/kênh có sẵn của server này được giữ nguyên. Hãy kiểm tra lại vị trí role (kéo role của bot lên cao nhất) và quyền theo ý muốn.",
        inline: false,
      },
    ],
    footer: "Protogon · Backup",
  });
  await sendToLog(guild, embed);
  console.log(`[backup:restore] ${guildId}: ${roleMap.size} roles, ${channelMap.size} channels`);
}

/** Vòng quét định kỳ: nhận yêu cầu backup / khôi phục từ dashboard. */
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
    try {
      if (item.kind === "backup") {
        await runBackup(client, store, item.guildId, !!item.pushToGithub);
      } else if (item.kind === "restore") {
        await runRestore(client, store, item.guildId, item.backupJson, item.guildName);
      }
    } catch (e) {
      console.error(`[backup:${item.kind}] ${item.guildId}:`, e.message);
      // Xóa cờ để không kẹt lặp lại mãi.
      await store.client
        .mutation("bot_writes:botClearBackup", {
          guildId: item.guildId,
          kind: item.kind,
        })
        .catch(() => {});
    }
  }
}

module.exports = pollBackups;
module.exports.runBackup = runBackup;
module.exports.runRestore = runRestore;
