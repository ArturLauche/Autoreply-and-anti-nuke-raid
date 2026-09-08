const { ChannelType } = require("discord.js");

const SYNC_CHANNEL_TYPES = [
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildVoice,
  ChannelType.GuildCategory,
  ChannelType.GuildStageVoice,
  ChannelType.GuildForum,
];

// State variables for guild sync optimization
let firstRun = true;
let lastTrustedCount = 0;
let lowCountStreak = 0;
let runCounter = 0;

// Cache for change detection — avoids redundant mutations
const prevGuildData = new Map(); // guildId -> { name, icon, memberCount, channelHash, roleHash }

/** Simple string hash for change detection (not cryptographic, just fast). */
function quickHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}

const SMALL_BOT_LIMIT = 50;

async function syncAll(client, store) {
  const guilds = [];
  let memberCount = 0;
  runCounter++;

  for (const g of client.guilds.cache.values()) {
    guilds.push({
      id: g.id,
      name: g.name,
      icon: g.icon ?? undefined,
      memberCount: g.memberCount ?? undefined,
    });
    memberCount += g.memberCount ?? 0;

    // Only sync channels/roles every 5 runs (~5 minutes) AND only if changed
    const doChannelRole = runCounter % 5 === 0;
    if (!doChannelRole) continue;

    const channels = g.channels.cache
      .filter((c) => SYNC_CHANNEL_TYPES.includes(c.type))
      .map((c) => ({ channelId: c.id, name: c.name, type: c.type }));
    const roles = g.roles.cache
      .filter((r) => r.name !== "@everyone")
      .map((r) => ({ roleId: r.id, name: r.name, color: r.color, position: r.position }));

    const channelHash = quickHash(JSON.stringify(channels));
    const roleHash = quickHash(JSON.stringify(roles));
    const prev = prevGuildData.get(g.id);

    // Skip if nothing changed
    if (prev && prev.channelHash === channelHash && prev.roleHash === roleHash) continue;

    try {
      await store.client.mutation("guilds:syncChannels", { guildId: g.id, channels });
      await store.client.mutation("guilds:syncRoles", { guildId: g.id, roles });
      prevGuildData.set(g.id, {
        name: g.name, icon: g.icon, memberCount: g.memberCount,
        channelHash, roleHash,
      });
    } catch (err) {
      console.error(`[sync] ${g.id}:`, err.message);
    }
  }

  const count = guilds.length;
  let trustedFullList;
  if (count <= SMALL_BOT_LIMIT) {
    trustedFullList = true;
    lowCountStreak = 0;
  } else {
    const droppedSharply =
      lastTrustedCount > 0 && count < lastTrustedCount - Math.max(50, Math.round(lastTrustedCount * 0.1));
    lowCountStreak = droppedSharply ? lowCountStreak + 1 : 0;
    trustedFullList = !firstRun && !(droppedSharply && lowCountStreak < 3);
  }
  firstRun = false;
  if (trustedFullList) lastTrustedCount = count;

  await store.client.mutation("guilds:botSyncGuilds", { guilds, trustedFullList });

  // Owner info — fetch once per sync cycle
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

  // Verify panel KHÔNG xử lý ở đây — đã có pollVerifyPanels riêng trong
  // hidden.js (chạy mỗi 60s, gửi + luôn clear cờ kể cả khi kênh hỏng).
  // Tránh query trùng lặp mỗi vòng sync (tiết kiệm operations).

  await store.client.mutation("guilds:botHeartbeat", {
    guildCount: count,
    memberCount,
    version: "v60",
    ownerName,
    ownerAvatarUrl,
  });
  return { count, trustedFullList };
}

/** Upsert nhanh 1 guild vừa mời bot */
async function syncOne(client, store, guildId) {
  const g = client.guilds.cache.get(guildId);
  if (!g) return;
  try {
    await store.client.mutation("guilds:botSyncGuilds", {
      guilds: [
        {
          id: g.id,
          name: g.name,
          icon: g.icon ?? undefined,
          memberCount: g.memberCount ?? undefined,
        },
      ],
      trustedFullList: false,
    });
  } catch (err) {
    console.error(`[sync:one] ${guildId}:`, err.message);
  }
}

/** Bot bị kick khỏi guild */
async function markGone(client, store, guildId) {
  try {
    await store.client.mutation("guilds:botGuildGone", { guildId });
  } catch (err) {
    console.error(`[sync:gone] ${guildId}:`, err.message);
  }
}

/** Đảm bảo mọi guild đều có đủ các module mặc định */
async function ensureModules(client, store) {
  for (const g of client.guilds.cache.values()) {
    try {
      await store.client.mutation("bot_writes:botEnsureModules", { guildId: g.id });
    } catch (err) {
      console.error(`[sync:ensure] ${g.id}:`, err.message);
    }
  }
}

module.exports = { syncAll, syncOne, markGone, ensureModules };
