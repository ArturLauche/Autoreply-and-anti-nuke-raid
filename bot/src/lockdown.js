const { PermissionFlagsBits, Colors } = require("discord.js");
const { logEmbed, sendLog } = require("./util");

/** guildId -> true (locked by this bot process). */
const locked = new Set();

function isLocked(guildId) {
  return locked.has(guildId);
}

function markLocked(guildId) {
  locked.add(guildId);
}

/**
 * Disable @everyone from sending messages / connecting to voice for a while.
 * Returns true when the lockdown was applied.
 */
async function lockGuild(client, guild, config, store) {
  if (locked.has(guild.id)) return false;
  const me = await guild.members.fetchMe().catch(() => null);
  if (!me || !me.permissions.has(PermissionFlagsBits.ManageChannels)) {
    const embed = logEmbed({
      title: "⚠️ Không thể khóa kênh",
      description:
        "Bot thiếu quyền **Quản lý kênh** (Manage Channels) nên không thể tự động khóa kênh khi raid. Hãy cấp quyền này cho bot.",
      color: Colors.Yellow,
      footer: "Protogon Anti Nuke",
    });
    await sendLog(guild, config, embed);
    return false;
  }

  const everyone = guild.roles.everyone;
  const minutes = config.lockdownMinutes || 5;
  let count = 0;
  for (const channel of guild.channels.cache.values()) {
    try {
      if (
        channel.isTextBased &&
        channel.isTextBased() &&
        !(channel.isThread && channel.isThread())
      ) {
        await channel.permissionOverwrites.edit(everyone, { SendMessages: false });
        count++;
      } else if (channel.isVoiceBased && channel.isVoiceBased()) {
        await channel.permissionOverwrites.edit(everyone, { Connect: false });
        count++;
      }
    } catch {
      // channel without overwrite support (e.g. category edge cases) — skip
    }
  }

  locked.add(guild.id);
  const until = Date.now() + minutes * 60_000;
  await store.client.mutation("bot_writes:botLockState", { guildId: guild.id, until });

  const embed = logEmbed({
    title: "🔒 Đã khóa kênh do raid",
    description: `Server đã bị **khóa ${minutes} phút** — thành viên không gửi được tin nhắn/voice cho tới khi hết hạn hoặc mod dùng \`/antinuke unlock\`.`,
    color: Colors.Red,
    fields: [{ name: "Kênh bị khóa", value: `${count} kênh`, inline: true }],
    footer: "Protogon Anti Nuke",
  });
  await sendLog(guild, config, embed);
  return true;
}

/** Reset @everyone overwrites so members can chat again. Returns true when unlocked. */
async function unlockGuild(client, guild, config, store) {
  if (!locked.has(guild.id)) return false;
  const everyone = guild.roles.everyone;
  let count = 0;
  for (const channel of guild.channels.cache.values()) {
    try {
      if (
        (channel.isTextBased &&
          channel.isTextBased() &&
          !(channel.isThread && channel.isThread())) ||
        (channel.isVoiceBased && channel.isVoiceBased())
      ) {
        await channel.permissionOverwrites.edit(everyone, {
          SendMessages: null,
          Connect: null,
        });
        count++;
      }
    } catch {
      // ignore channels that can't be edited
    }
  }
  locked.delete(guild.id);
  await store.client.mutation("bot_writes:botLockState", {
    guildId: guild.id,
    until: null,
    requested: false,
  });
  const embed = logEmbed({
    title: "🔓 Đã mở khóa kênh",
    description: `Đã mở lại **${count} kênh** — thành viên có thể giao tiếp bình thường.`,
    color: Colors.Green,
    footer: "Protogon Anti Nuke",
  });
  await sendLog(guild, config, embed);
  return true;
}

module.exports = { isLocked, markLocked, lockGuild, unlockGuild };
