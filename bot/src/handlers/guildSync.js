const { ChannelType } = require("discord.js");

const SYNC_CHANNEL_TYPES = [
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildVoice,
  ChannelType.GuildCategory,
  ChannelType.GuildStageVoice,
  ChannelType.GuildForum,
];

// Trạng thái trong process — bảo vệ chống "server biến mất":
//  - firstRun: lần sync đầu tiên sau khi bot khởi động KHÔNG BAO GIỜ được phép
//    sweep (cache guild chưa chắc đã lấp đầy — GUILD_CREATE đến rải rác sau READY).
//  - lastTrustedCount: số guild ở lần sync tin cậy gần nhất. Nếu lần này ít hơn
//    >10% (và >50 guild) → cache đang thiếu → coi là KHÔNG tin cậy → không sweep.
//  - lowCountStreak: số lần LIÊN TIẾP count sụt thấp. Nếu ổn định ở mức thấp qua 3
//    lượt (3 phút) → sụt giảm là THẬT (bot bị kick/ban khỏi nhiều server) → chấp
//    nhận sweep — không kẹt "cache thiếu" vĩnh viễn như bản cũ.
//  - runCounter: giãn syncChannels/syncRoles xuống mỗi 5 phút (dashboard không cần
//    danh sách kênh/role tươi từng phút; ở 2k+ server, 2 mutation/guild/phút là
//    hàng nghìn mutation mỗi lần và làm chồng lấn vòng sync).
let firstRun = true;
let lastTrustedCount = 0;
let lowCountStreak = 0;
let runCounter = 0;

// Bot nhỏ (≤50 server): cache guild gần như chắc chắn đầy đủ ngay sau READY (Discord
// gửi toàn bộ guild của bot trong vài giây) → tin tưởng ngay từ lượt đầu, không cần
// chờ lượt thứ 2 như bot 2k+ server (GUILD_CREATE lấp dần mất nhiều phút).
const SMALL_BOT_LIMIT = 50;

async function syncAll(client, store) {
  const guilds = [];
  let memberCount = 0;
  const fullChannelRole = runCounter % 5 === 0; // kênh/role: mỗi 5 lượt (~5 phút)
  runCounter++;

  for (const g of client.guilds.cache.values()) {
    guilds.push({
      id: g.id,
      name: g.name,
      icon: g.icon ?? undefined,
      memberCount: g.memberCount ?? undefined,
    });
    memberCount += g.memberCount ?? 0;
    if (!fullChannelRole) continue;
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

  const count = guilds.length;
  let trustedFullList;
  if (count <= SMALL_BOT_LIMIT) {
    // Bot nhỏ: cache chắc chắn đầy đủ → sweep ngay (kể cả lượt đầu sau restart).
    // Đồng thời tự dọn nhầm cũ: guild còn trong bot thì hiện lại, guild mất thật thì ẩn.
    trustedFullList = true;
    lowCountStreak = 0;
  } else {
    const droppedSharply =
      lastTrustedCount > 0 && count < lastTrustedCount - Math.max(50, Math.round(lastTrustedCount * 0.1));
    lowCountStreak = droppedSharply ? lowCountStreak + 1 : 0;
    // Lần đầu tiên của process: không bao giờ sweep (cache đang lấp dần qua GUILD_CREATE).
    // Sụt giảm chỉ chấp nhận sau khi ỔN ĐỊNH 3 lượt liên tiếp (~3 phút) → sụt THẬT
    // (kick/ban hàng loạt), không phải cache thiếu thoáng qua — tránh kẹt "cache thiếu" mãi.
    trustedFullList = !firstRun && !(droppedSharply && lowCountStreak < 3);
  }
  firstRun = false;
  if (trustedFullList) lastTrustedCount = count;

  await store.client.mutation("guilds:botSyncGuilds", { guilds, trustedFullList });

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
    guildCount: count,
    memberCount,
    // Bản bot đang chạy — web dùng để báo "bot trên host đang chạy bản cũ, cần cập nhật".
    // Nhớ nâng cùng số zip khi đóng gói bản mới (v47, v48…).
    version: "v53",
    ownerName,
    ownerAvatarUrl,
  });
  return { count, trustedFullList };
}

/** Upsert nhanh 1 guild vừa mời bot (không chạm các guild khác, không bao giờ sweep). */
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

/** Bot bị kick khỏi guild → đánh dấu đúng guild đó (không kéo theo sync toàn bộ). */
async function markGone(client, store, guildId) {
  try {
    await store.client.mutation("guilds:botGuildGone", { guildId });
  } catch (err) {
    console.error(`[sync:gone] ${guildId}:`, err.message);
  }
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

module.exports = { syncAll, syncOne, markGone, ensureModules };
