const { ChannelType } = require("discord.js");

const SYNC_CHANNEL_TYPES = [
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildVoice,
  ChannelType.GuildCategory,
  ChannelType.GuildStageVoice,
  ChannelType.GuildForum,
];

async function syncAll(client, store) {
  const guilds = [];
  let memberCount = 0;
  for (const g of client.guilds.cache.values()) {
    guilds.push({
      id: g.id,
      name: g.name,
      icon: g.icon ?? undefined,
      memberCount: g.memberCount ?? undefined,
    });
    memberCount += g.memberCount ?? 0;
    try {
      const channels = g.channels.cache
        .filter((c) => SYNC_CHANNEL_TYPES.includes(c.type))
        .map((c) => ({ channelId: c.id, name: c.name, type: c.type }));
      await store.client.mutation("guilds:syncChannels", { guildId: g.id, channels });

      const roles = g.roles.cache
        .filter((r) => r.name !== "@everyone")
        .map((r) => ({ roleId: r.id, name: r.name, color: r.color, position: r.position }));
      await store.client.mutation("guilds:syncRoles", { guildId: g.id, roles });
    } catch (err) {
      console.error(`[sync] ${g.id}:`, err.message);
    }
  }
  await store.client.mutation("guilds:botSyncGuilds", { guilds });

  // Owner info 24/7: lấy tên + avatar mới nhất của chủ bot từ Discord mỗi lần sync.
  let ownerName;
  let ownerAvatarUrl;
  try {
    const app = await client.application.fetch();
    const owner = app?.owner;
    const ownerId = owner?.ownerId || (/^\d{15,20}$/.test(owner?.id || "") ? owner.id : null);
    if (ownerId) {
      const ownerUser = await client.users.fetch(ownerId).catch(() => null);
      if (ownerUser) {
        ownerName = ownerUser.username;
        ownerAvatarUrl = ownerUser.displayAvatarURL({ size: 256, extension: "png" });
      }
    }
  } catch (e) {
    console.error("[owner:sync]", e.message);
  }
  await store.client.mutation("guilds:botHeartbeat", {
    guildCount: guilds.length,
    memberCount,
    version: "1.0.0",
    ownerName,
    ownerAvatarUrl,
  });
}

/** Đảm bảo mọi guild đều có đủ các module mặc định (kể cả module mới thêm). */
async function ensureModules(client, store) {
  for (const g of client.guilds.cache.values()) {
    try {
      await store.client.mutation("bot_writes:botEnsureModules", { guildId: g.id });
    } catch (err) {
      console.error(`[sync:ensure] ${g.id}:`, err.message);
    }
  }
}

module.exports = { syncAll, ensureModules };
