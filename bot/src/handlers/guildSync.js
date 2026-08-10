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
  await store.client.mutation("guilds:botHeartbeat", {
    guildCount: guilds.length,
    memberCount,
    version: "1.0.0",
  });
}

module.exports = { syncAll };
