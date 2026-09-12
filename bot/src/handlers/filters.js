const { PermissionFlagsBits } = require("discord.js");
const { sendCaseLog } = require("../caseLog");
const { heatSettings, punishMember, choosePunish } = require("../heat");
const { actionsOf, cleanupMessages } = require("../moduleActions");

const MODULE_LABELS = {
  badword: "Từ ngữ xấu",
  invite: "Link mời Discord",
  attachment: "Spam ảnh/file đính kèm",
  mention: "Spam mention",
  malware: "Link độc hại & file nguy hiểm",
};

const INVITE_RE = /(?:discord\.(?:gg|me)\/|discord(?:app)?\.com\/invite\/)[a-zA-Z0-9_-]+/gi;

// Danh sách domain scam/lừa đảo phổ biến (nitro giả, gift giả, crypto scam…)
const MALICIOUS_DOMAINS = [
  "discord-nitro.ru", "discordnitro.ru", "discord-gift.ru", "discordnitro.gift",
  "nitro-gift.ru", "nitrogift.ru", "discordgift.site", "discord-giveaway.com",
  "steam-gift.net", "steamgift.ru", "steam-gifts.com", "steam-giveaways.com",
  "steam-keys.ru", "free-steam-keys.com", "csgo-gifts.ru", "csgofast.com",
  "metamask-verify.com", "metamask-auth.com", "binance-airdrop.top",
  "binance-claim.com", "coinbase-verify.com", "paypal-verify.cc",
  "wallet-connect.verify", "uniswap-airdrop.site", "opensea-verify.com",
  "discord-airdrop.com", "discord-verification.com", "discord-verify.com",
  "discord-login.com", "discord-verify.net", "discordbot.help", "discord-hub.com",
  "nitro-win.ru", "nitrowin.ru", "boost-gift.ru", "nitro-gift.site",
  "get-nitro.com", "freе-nitro.com", "free-nitro.ru", "nitro.quest",
  "discord.gift-claim.com", "claim-gift.ru", "gift-nitro.ru", "nitro-gift.ru",
  "airdrop-token.top", "claim-airdrop.com", "crypto-claim.site",
  "hypesquad-event.com", "xbox-gift.net", "psn-gift.net", "roblox-gift.net",
].map((d) => d.toLowerCase());

const DANGEROUS_EXTENSIONS = [
  ".exe", ".scr", ".bat", ".cmd", ".com", ".msi", ".msp",
  ".vbs", ".vbe", ".js", ".jse", ".hta", ".ps1", ".psm1",
  ".jar", ".apk", ".cpl", ".reg",
];

// Chữ ký nội dung lừa đảo phổ biến
const SCAM_KEYWORD_RE =
  /(free\s?nitro|steam\s?gift|discord\s?nitro\s?(gift|code)|giveaway|airdrop|claim\s?(reward|prize|gift)|you\s?(won|are\s?(the\s?)?winner))/i;

// ============================================================
// THREAT INTEL (học hỏi từ research.js) — dùng MIỄN PHÍ vĩnh viễn:
// từ khóa/cụm từ scam học được từ nguồn mở + các vụ raid thật được hợp nhất
// vào bộ lọc malware. Chi phí: 1 query Convex mỗi 10 phút (~4.3k/tháng, nằm
// trong gói free) — 0 token AI, 0 network thêm khi so khớp (đều là regex cục bộ).
// ============================================================
let threatKeywords = [];
let threatPhrases = [];
let threatLoadedAt = 0;
let threatLoading = false;
const THREAT_REFRESH_MS = 10 * 60 * 1000;

/** Tải intel từ Convex (fire-and-forget, không bao giờ làm fail quét tin nhắn). */
function refreshThreatIntel(store) {
  if (threatLoading || Date.now() - threatLoadedAt < THREAT_REFRESH_MS) return;
  threatLoading = true;
  store.client
    .query("threatIntel:botGetIntel", {})
    .then((intel) => {
      if (intel) {
        threatKeywords = (intel.keywords || []).slice(0, 60).map((k) => String(k).toLowerCase()).filter(Boolean);
        threatPhrases = (intel.scamPhrases || []).slice(0, 40).map((p) => String(p).toLowerCase()).filter(Boolean);
        threatLoadedAt = Date.now();
      }
    })
    .catch(() => {})
    .finally(() => {
      threatLoading = false;
    });
}

/** So khớp nội dung với từ khóa/cụm từ scam đã học (0 token, regex cục bộ). */
function findLearnedThreat(content) {
  if (threatKeywords.length === 0 && threatPhrases.length === 0) return null;
  const lower = content.toLowerCase();
  // Cụm từ nhiều từ (vd "free gift redeem") — khớp nguyên cụm, ưu tiên trước.
  for (const p of threatPhrases) {
    if (p.length >= 6 && lower.includes(p)) return { kind: "intel-phrase", value: p };
  }
  // Từ khóa đơn — ranh giới từ để tránh khớp nhầm trong từ dài hơn.
  for (const k of threatKeywords) {
    if (k.length >= 5 && wordBoundaryRegex(k).test(lower)) return { kind: "intel-keyword", value: k };
  }
  return null;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** So khớp từ với ranh giới từ (không khớp "ass" trong "assassin"). */
function wordBoundaryRegex(word) {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(word)}([^\\p{L}\\p{N}]|$)`, "iu");
}

function isExempt(member, config) {
  if (!member) return false;
  if (member.id === member.guild.ownerId) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if ((config?.adminRoles || []).some((id) => member.roles.cache.has(id))) return true;
  if ((config?.modRoles || []).some((id) => member.roles.cache.has(id))) return true;
  // Whitelist của RIÊNG server này: role/người dùng được miễn trừ khỏi moderation
  // (và nuke/raid) — không chia sẻ sang server khác dùng chung bot.
  if ((config?.whitelistRoles || []).some((id) => member.roles.cache.has(id))) return true;
  if ((config?.whitelistUsers || []).includes(member.id)) return true;
  return false;
}

/** Tìm link độc hại trong nội dung tin nhắn. */
function findMaliciousLink(content) {
  const urls = content.match(/https?:\/\/[^\s<>"]+|www\.[^\s<>"]+/gi) || [];
  for (const raw of urls) {
    const host = raw
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split(/[/?#]/)[0]
      .toLowerCase();
    if (MALICIOUS_DOMAINS.includes(host)) return { kind: "domain", value: host };
    if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(host)) {
      return { kind: "ip", value: host }; // link IP trực tiếp — nghi ngờ
    }
  }
  if (SCAM_KEYWORD_RE.test(content)) return { kind: "scam-keyword", value: "nội dung lừa đảo" };
  return null;
}

/** Tìm file đính kèm có phần mở rộng nguy hiểm. */
function findDangerousAttachment(attachments) {
  for (const att of attachments.values()) {
    const ext = (att.name.match(/\.[a-z0-9]+$/i) || [""])[0].toLowerCase();
    if (DANGEROUS_EXTENSIONS.includes(ext)) return { name: att.name, ext };
  }
  return null;
}

/**
 * Luồng xử lý chung cho mọi vi phạm moderation: cộng nhiệt → chọn hình phạt
 * (tăng cấp theo nhiệt hoặc warn tích lũy) → thực thi → xóa tin → ghi log.
 */
async function punishFlow(client, message, moduleCfg, config, heat, reason, detail, count) {
  const member = message.member;
  if (!member) return;

  const s = heatSettings(config);
  const heatRes = await heat.add(
    message.guild.id,
    message.author.id,
    message.author.username,
    moduleCfg.heat ?? 10,
    s,
  );
  let chosen = choosePunish(moduleCfg.punish || "warn", heatRes);
  let strikeTag = "";
  if (chosen === "warn") {
    const st = heat.strike(message.guild.id, message.author.id, s, message.author.username);
    if (st.escalated) {
      chosen = st.punish;
      strikeTag = ` — đủ ${st.count} warn, tăng cấp ${st.punish}`;
    } else if (st.count > 0 && s.warnStrikeLimit) {
      strikeTag = ` — warn ${st.count}/${s.warnStrikeLimit}`;
    }
  }
  if (chosen !== "warn") heat.markPunished(message.guild.id, message.author.id);
  const res = await punishMember(
    message.guild,
    member,
    chosen,
    reason + strikeTag,
    moduleCfg.timeoutSeconds,
    heat.store, // ghi hình phạt + gửi thông báo Moderation theo cấu hình
  );
  const action = res.action;
  const caseNumber = res.caseNumber;

  // Dọn tin nhắn theo hành động đã chọn: deleteMessages (xóa ngay tin phát hiện)
  // / purgeMessages (xóa hàng loạt mọi tin liên quan). Không chọn → không xóa.
  const actions = actionsOf(moduleCfg);
  const cleanup = await cleanupMessages({
    guild: message.guild,
    channel: message.channel,
    userId: message.author.id,
    actions,
    triggerMessage: message,
  });

  const offender = { id: message.author.id, username: message.author.username };

  // Log xóa tin nhắn kiểu Carl-bot ("Message deleted") vào kênh log moderation.
  if (cleanup) {
    try {
      await sendCaseLog({
        guild: message.guild,
        guildConfig: config,
        action: "delete",
        offender,
        reason: `Bot tự động xóa tin nhắn vì ${MODULE_LABELS[moduleCfg.module]}: ${(message.content || "[ảnh/file]").slice(0, 300)}`,
        executor: null,
      });
    } catch (e) {
      console.error("[filters:delLog]", e.message);
    }
  }

  try {
    await heat.store.client.mutation("bot_writes:botRecordAntinukeEvent", {
      guildId: message.guild.id,
      module: moduleCfg.module,
      executorId: message.author.id,
      executorName: message.author.username,
      action: action + (heatRes ? ` (nhiệt ${Math.round(heatRes.heat)})` : ""),
      count: count || 1,
      windowSeconds: moduleCfg.windowSeconds || 10,
      threshold: moduleCfg.threshold || 1,
      punish: chosen,
    });
  } catch (e) {
    console.error("[filters:record]", e.message);
  }

  // Embed case kiểu Carl-bot cho phạt tự động (responsible moderator = tên bot).
  try {
    await sendCaseLog({
      guild: message.guild,
      guildConfig: config,
      action: chosen,
      caseNumber,
      offender,
      reason: `Tự động xử lý vì ${MODULE_LABELS[moduleCfg.module]}: ${detail}${strikeTag ? ` (${strikeTag.trim()})` : ""}${cleanup ? ` · đã ${cleanup}` : ""} · ${action}`.slice(0, 1000),
      executor: null,
    });
  } catch (e) {
    console.error("[filters:case]", e.message);
  }
}

/**
 * Quét từng tin nhắn: link mời Discord, từ ngữ xấu, link độc hại, file nguy hiểm,
 * spam mention, spam ảnh/file. Được gọi từ index.js trên sự kiện messageCreate.
 */
async function scanMessage(client, message, store, heat) {
  if (!message.guild || message.author.bot || message.channel.isDMBased?.()) return;
  const config = await store.getConfig(message.guild.id);
  if (!config || config.antinukeEnabled === false) return;
  const member = message.member;
  if (!member || isExempt(member, config)) return;

  const modules = config.modules || [];
  const inviteCfg = modules.find((m) => m.module === "invite");
  const badwordCfg = modules.find((m) => m.module === "badword");
  const malwareCfg = modules.find((m) => m.module === "malware");
  const mentionCfg = modules.find((m) => m.module === "mention");
  const attachmentCfg = modules.find((m) => m.module === "attachment");

  // 1) Link mời Discord
  if (inviteCfg?.enabled && message.content) {
    const match = message.content.match(INVITE_RE);
    if (match) {
      return punishFlow(
        client, message, inviteCfg, config, heat,
        `[Protogon] Chặn link mời Discord: ${match[0]}`,
        `Chứa link mời \`${match[0]}\``,
        1,
      );
    }
  }

  // 2) Từ ngữ xấu
  if (badwordCfg?.enabled && message.content && (config.badWords || []).length > 0) {
    const lower = message.content.toLowerCase();
    const bad = (config.badWords || []).find((w) => w && wordBoundaryRegex(w).test(lower));
    if (bad) {
      return punishFlow(
        client, message, badwordCfg, config, heat,
        `[Protogon] Từ ngữ xấu: "${bad}"`,
        `Chứa từ ngữ xấu \`${bad}\``,
        1,
      );
    }
  }

  // 3) Link độc hại (domain lừa đảo / IP / chữ ký scam + từ khóa THREAT INTEL đã học)
  if (malwareCfg?.enabled && message.content) {
    refreshThreatIntel(store); // fire-and-forget — tải lại intel khi đến hạn (0 token)
    // 3a) Từ khóa/cụm từ scam HỌC ĐƯỢC từ research (ưu tiên — luôn mới nhất)
    const learned = findLearnedThreat(message.content);
    if (learned) {
      return punishFlow(
        client, message, malwareCfg, config, heat,
        `[Protogon] Nội dung lừa đảo (threat intel): "${learned.value}"`,
        `Khớp từ khóa scam bot tự học (\`${learned.kind}: ${learned.value}\`)`,
        1,
      );
    }
    const hit = findMaliciousLink(message.content);
    if (hit) {
      return punishFlow(
        client, message, malwareCfg, config, heat,
        `[Protogon] Link độc hại: ${hit.value || hit.kind}`,
        `Chứa link/nội dung độc hại (\`${hit.kind}: ${hit.value || ""}\`)`,
        1,
      );
    }
  }

  // 4) File nguy hiểm (đuôi .exe .scr .bat …)
  if (malwareCfg?.enabled && message.attachments.size > 0) {
    const bad = findDangerousAttachment(message.attachments);
    if (bad) {
      return punishFlow(
        client, message, malwareCfg, config, heat,
        `[Protogon] File nguy hiểm: ${bad.name} (${bad.ext})`,
        `Đính kèm file nguy hiểm \`${bad.name}\` (\`${bad.ext}\`)`,
        1,
      );
    }
  }

  // 5) Spam mention
  if (mentionCfg?.enabled && message.content) {
    const mentions =
      message.mentions.users.size +
      (message.mentions.roles?.size ?? 0) +
      (message.mentions.channels?.size ?? 0) +
      (message.mentions.everyone ? 1 : 0);
    if (mentions > 0) {
      const key = `${message.guild.id}:${message.author.id}`;
      const now = Date.now();
      const arr = mentionBuckets.get(key) ?? [];
      arr.push(now);
      const cutoff = now - (mentionCfg.windowSeconds || 10) * 1000;
      const fresh = arr.filter((t) => t >= cutoff);
      if (fresh.length < (mentionCfg.threshold || 10)) {
        mentionBuckets.set(key, fresh);
        return;
      }
      mentionBuckets.delete(key);
      return punishFlow(
        client, message, mentionCfg, config, heat,
        `[Protogon] Spam mention: ${fresh.length} tin mention trong ${mentionCfg.windowSeconds || 10}s`,
        `<@${message.author.id}> đã gửi **${fresh.length} tin có mention** trong **${mentionCfg.windowSeconds || 10} giây** (ngưỡng ${mentionCfg.threshold || 10})`,
        fresh.length,
      );
    }
  }

  // 6) Spam ảnh / file đính kèm
  if (attachmentCfg?.enabled && message.attachments.size > 0) {
    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const arr = attachmentBuckets.get(key) ?? [];
    arr.push(now);
    const cutoff = now - (attachmentCfg.windowSeconds || 10) * 1000;
    const fresh = arr.filter((t) => t >= cutoff);
    if (fresh.length < (attachmentCfg.threshold || 5)) {
      attachmentBuckets.set(key, fresh);
      return;
    }
    attachmentBuckets.delete(key);
    return punishFlow(
      client, message, attachmentCfg, config, heat,
      `[Protogon] Spam ảnh/file: ${fresh.length} tin đính kèm trong ${attachmentCfg.windowSeconds || 10}s`,
      `<@${message.author.id}> đã gửi **${fresh.length} tin có đính kèm** trong **${attachmentCfg.windowSeconds || 10} giây** (ngưỡng ${attachmentCfg.threshold || 5})`,
      fresh.length,
    );
  }
}

// `${guildId}:${userId}` -> [timestamps của tin có đính kèm]
const attachmentBuckets = new Map();
// `${guildId}:${userId}` -> [timestamps của tin có mention]
const mentionBuckets = new Map();

/** Dọn bucket cũ định kỳ để RAM không tăng mãi (chạy mỗi 5 phút). */
setInterval(() => {
  const now = Date.now();
  const cutoff = now - 600_000; // giữ tối đa 10 phút
  for (const [k, arr] of attachmentBuckets) {
    const fresh = arr.filter((t) => t >= cutoff);
    if (fresh.length === 0) attachmentBuckets.delete(k);
    else attachmentBuckets.set(k, fresh);
  }
  for (const [k, arr] of mentionBuckets) {
    const fresh = arr.filter((t) => t >= cutoff);
    if (fresh.length === 0) mentionBuckets.delete(k);
    else mentionBuckets.set(k, fresh);
  }
}, 300_000);

module.exports = scanMessage;
module.exports.MODULE_LABELS = MODULE_LABELS;
module.exports.findMaliciousLink = findMaliciousLink;
module.exports.findDangerousAttachment = findDangerousAttachment;
