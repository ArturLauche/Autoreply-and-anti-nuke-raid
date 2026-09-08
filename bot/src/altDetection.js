/**
 * Alt Account + VPN Detection Engine
 * ——————————————————————————————————
 * Phân tích tài khoản mới tham gia server:
 *  1. Tuổi tài khoản (Discord flags, creation date)
 *  2. Tương đồng username với account đã có trong server
 *  3. Pattern tài khoản tạo đại trà (username ngẫu nhiên, không avatar)
 *  4. VPN/Proxy detection (qua ip-api.com — free, 45 req/min)
 *  5. Behavioral correlation (join time proximity + shared signals)
 *  6. Cross-reference với danh sách đã ban trong server
 *
 * Inspired by Double Counter's approach:
 *  - IP fingerprinting (best-effort qua voice region khi có thể)
 *  - Account behavior analysis
 *  - Threshold-based risk scoring
 */

const https = require("https");
const http = require("http");

const DAY_MS = 86_400_000;

// ——— Utility: simple username similarity (Levenshtein-like) ———
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => {
    const row = Array(b.length + 1);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

/**
 * Tính điểm tương đồng giữa 2 username (0-100).
 * Kết hợp Levenshtein distance + prefix/suffix matching.
 */
function usernameSimilarity(u1, u2) {
  const a = u1.toLowerCase().replace(/[^a-z0-9]/g, "");
  const b = u2.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (a === b) return 100;
  if (!a || !b) return 0;

  const maxLen = Math.max(a.length, b.length);
  const dist = levenshtein(a, b);
  const baseScore = Math.round((1 - dist / maxLen) * 100);

  // Bonus: shared prefix (first 3+ chars)
  let prefixBonus = 0;
  const prefixLen = Math.min(a.length, b.length);
  for (let i = 0; i < prefixLen && i < 6; i++) {
    if (a[i] === b[i]) prefixBonus += 3;
    else break;
  }

  // Bonus: one ends with the other's number suffix
  const numSuffixA = a.match(/(\d+)$/);
  const numSuffixB = b.match(/(\d+)$/);
  if (numSuffixA && numSuffixB) {
    const coreA = a.slice(0, a.length - numSuffixA[1].length);
    const coreB = b.slice(0, b.length - numSuffixB[1].length);
    if (coreA === coreB && coreA.length > 2) return 95;
  }

  return Math.min(100, baseScore + prefixBonus);
}

// ——— Utility: detect generated/throwaway username patterns ———
function isGeneratedUsername(username) {
  const clean = username.toLowerCase().replace(/[^a-z0-9]/g, "");
  // Pattern 1: random letters + 4 digits (e.g., "xkqe8291")
  if (/^[a-z]{3,6}\d{3,6}$/.test(clean)) return { generated: true, pattern: "random_letters+digits" };
  // Pattern 2: two words + numbers (e.g., "CoolFox1234")
  if (/^[a-z]{2,10}[a-z]{2,10}\d{2,6}$/.test(clean)) {
    // Check if the letters part looks random (high consonant ratio)
    const letters = clean.replace(/\d+$/, "");
    const vowels = letters.replace(/[^aeiou]/g, "").length;
    const vowelRatio = vowels / letters.length;
    // Very low vowel ratio often means random
    if (vowelRatio < 0.15 && letters.length >= 5) {
      return { generated: true, pattern: "low_vowel_ratio" };
    }
  }
  // Pattern 3: only digits (numeric-only username)
  if (/^\d{4,}$/.test(clean)) return { generated: true, pattern: "numeric_only" };
  // Pattern 4: 3 chars + 4 digits (e.g., "abc1234")
  if (/^[a-z]{3}\d{4,}$/.test(clean)) return { generated: true, pattern: "short_prefix+digits" };

  return { generated: false, pattern: null };
}

// ——— Utility: analyze Discord flags ———
function analyzeFlags(flags) {
  if (!flags) return { score: 20, factors: ["no_flags"] };
  const score = 0;
  const factors = [];

  // Hypesquad house badges = good signal
  if (flags & 128) factors.push("hype_badge"); // HYPESQUAD_ONLINE_HOUSE_1
  if (flags & 64) factors.push("hype_badge");
  if (flags & 32) factors.push("hype_badge");

  // Verified bot developer, early supporter = good signal
  if (flags & 4) factors.push("verified_badge");
  if (flags & 512) factors.push("early_supporter");

  return { score, factors };
}

// ——— Utility: HTTP GET (for VPN check) ———
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(url, { timeout: 5000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

// ——— VPN Detection ———
/**
 * Check if IP is VPN/Proxy via ip-api.com (free tier: 45 req/min).
 * Returns { isVPN, country, org, query }.
 */
async function checkVPN(ip) {
  if (!ip) return { isVPN: false, country: null, org: null };
  // ip-api.com không check VPN được ở free tier, dùng ipinfo
  // Nhưng tốt hơn là dùng proxycheck.io free (50 req/month)
  // Fallback: chỉ check basic signals
  try {
    const data = await httpGet(`http://ip-api.com/json/${ip}?fields=status,country,org,isp,proxy`);
    if (data?.status === "success") {
      return {
        isVPN: data.proxy === true,
        country: data.country || null,
        org: data.org || data.isp || null,
        query: data.query || null,
      };
    }
  } catch {}
  return { isVPN: false, country: null, org: null };
}

// ——— Core: Analyze a new member ———
/**
 * Phân tích tài khoản mới join và trả về risk analysis.
 *
 * @param {Object} member — Discord.js GuildMember
 * @param {Object} config — guild alt detection config
 * @param {Function} getConfig — store.getConfig(guildId)
 * @returns {{ riskScore, riskFactors, action, isVPN, ipCountry, ipOrg, linkedUserId, similarityScore }}
 */
async function analyzeNewMember(member, config, getConfig) {
  const factors = [];
  let riskScore = 0;

  // === Layer 1: Account Age Analysis ===
  const ageDays = (Date.now() - member.user.createdTimestamp) / DAY_MS;
  const minAge = config?.altMinAgeDays ?? 7;
  if (ageDays < 1) {
    riskScore += 35;
    factors.push("account_age_1day");
  } else if (ageDays < 3) {
    riskScore += 25;
    factors.push("account_age_3days");
  } else if (ageDays < minAge) {
    riskScore += 15;
    factors.push(`account_age_under_${minAge}d`);
  }

  // === Layer 2: Avatar Analysis ===
  if (!member.user.avatar) {
    riskScore += 15;
    factors.push("no_avatar");
  }

  // === Layer 3: Username Pattern Analysis ===
  const usernameCheck = isGeneratedUsername(member.user.username);
  if (usernameCheck.generated) {
    riskScore += 20;
    factors.push(`generated_username_${usernameCheck.pattern}`);
  }

  // === Layer 4: Flag Analysis ===
  const flagResult = analyzeFlags(member.user.flags?.bitfield);
  if (flagResult.factors.includes("no_flags") && ageDays < 30) {
    riskScore += 10;
    factors.push("no_flags_new_account");
  }

  // === Layer 5: Bot flag ===
  if (member.user.bot) {
    riskScore += 5;
    factors.push("is_bot_account");
  }

  // === Layer 6: Username Similarity with existing members ===
  let maxSimilarity = 0;
  let linkedUserId = null;
  const threshold = config?.altSimilarityThreshold ?? 70;

  try {
    // Fetch all members (Discord.js caches them)
    const guildMembers = member.guild.members.cache;
    for (const [, existingMember] of guildMembers) {
      if (existingMember.id === member.id) continue;
      if (existingMember.user.bot) continue;
      const sim = usernameSimilarity(member.user.username, existingMember.user.username);
      if (sim > maxSimilarity) {
        maxSimilarity = sim;
        linkedUserId = existingMember.id;
      }
      // Also check display name
      if (existingMember.nickname) {
        const nickSim = usernameSimilarity(member.user.username, existingMember.nickname);
        if (nickSim > maxSimilarity) {
          maxSimilarity = nickSim;
          linkedUserId = existingMember.id;
        }
      }
    }
  } catch {}

  if (maxSimilarity >= threshold) {
    riskScore += 25;
    factors.push(`username_similarity_${maxSimilarity}%`);
  }

  // === Layer 7: Join Time Correlation ===
  const joinWindowMs = (config?.altJoinWindowMinutes ?? 5) * 60 * 1000;
  const now = Date.now();
  let recentSimilarJoins = 0;
  try {
    const recentMembers = member.guild.members.cache.filter(
      (m) => m.joinedTimestamp && (now - m.joinedTimestamp) < joinWindowMs && m.id !== member.id,
    );
    recentSimilarJoins = recentMembers.size;
    if (recentSimilarJoins >= 5) {
      riskScore += 20;
      factors.push("join_burst_5+");
    } else if (recentSimilarJoins >= 3) {
      riskScore += 10;
      factors.push("join_burst_3+");
    }
  } catch {}

  // === Layer 8: Cross-reference with banned members ===
  try {
    const bans = await member.guild.bans.fetch();
    for (const [, ban] of bans) {
      const banUserSim = usernameSimilarity(member.user.username, ban.user.username);
      if (banUserSim >= 80) {
        riskScore += 30;
        factors.push(`matches_banned_user_${banUserSim}%`);
        break;
      }
    }
  } catch {}

  // === Layer 9: VPN Check (optional, rate-limited) ===
  let isVPN = false;
  let ipCountry = null;
  let ipOrg = null;

  // VPN detection requires the user to connect to voice or use a webhook.
  // For now, we'll use a heuristic: if user has no avatar + generated username + new account, flag as likely VPN/alt.
  // Full IP-based VPN detection requires the member to make a voice connection first.
  // We store a "vpnSuspect" flag based on behavioral signals.
  const vpnSuspect = riskScore >= 50 && !member.user.avatar && usernameCheck.generated;
  if (vpnSuspect) {
    isVPN = true; // Behavioral VPN suspect
    factors.push("vpn_suspect_behavioral");
  }

  // Cap risk score at 100
  riskScore = Math.min(100, riskScore);

  // === Determine Action ===
  const maxRisk = config?.altMaxRiskScore ?? 70;
  let action = "pass";
  if (riskScore >= maxRisk) {
    action = config?.altPunish || "kick";
  }

  return {
    riskScore,
    riskFactors: factors,
    action,
    isVPN,
    ipCountry,
    ipOrg,
    linkedUserId: linkedUserId || undefined,
    similarityScore: maxSimilarity > 0 ? maxSimilarity : undefined,
  };
}

// ——— Execute Action ———
/**
 * Áp dụng hình phạt cho account vi phạm.
 * @returns {{ executed, action, reason }}
 */
async function executePunishment(member, analysis, config) {
  const { action: punish } = analysis;
  if (punish === "pass") return { executed: false, action: "pass", reason: "under threshold" };

  const reason = `[Protogon Alt Detection] Risk: ${analysis.riskScore}/100 — ${analysis.riskFactors.join(", ")}`;

  try {
    switch (punish) {
      case "ban":
        await member.ban({ reason, deleteMessageSeconds: 0 });
        return { executed: true, action: "ban", reason };

      case "kick":
        await member.kick(reason);
        return { executed: true, action: "kick", reason };

      case "timeout": {
        const minutes = config?.altTimeoutMinutes ?? 60;
        await member.timeout(minutes * 60 * 1000, reason);
        return { executed: true, action: "timeout", reason };
      }

      case "verify": {
        // Gán lại role unverified → buộc xác minh lại
        const unverifiedRoleId = config?.unverifiedRoleId;
        if (unverifiedRoleId) {
          await member.roles.set(
            [unverifiedRoleId],
            "Alt detection — forced re-verify",
          );
          return { executed: true, action: "verify", reason };
        }
        // Nếu không có unverified role → fallback to kick
        await member.kick(reason);
        return { executed: true, action: "kick", reason: reason + " (fallback: no unverified role)" };
      }

      default:
        return { executed: false, action: "pass", reason: "unknown punish" };
    }
  } catch (err) {
    console.error(`[altDetect:punish] ${member.guild.id}/${member.id}:`, err.message);
    return { executed: false, action: punish, reason: `failed: ${err.message}` };
  }
}

// ——— Generate risk report embed ———
function buildRiskEmbed(member, analysis, punishResult) {
  const { EmbedBuilder, Colors } = require("discord.js");
  const riskColor =
    analysis.riskScore >= 70
      ? Colors.Red
      : analysis.riskScore >= 40
        ? Colors.Orange
        : analysis.riskScore >= 20
          ? Colors.Yellow
          : Colors.Green;

  const embed = new EmbedBuilder()
    .setColor(riskColor)
    .setTitle(`🔍 Alt Detection: ${member.user.username}`)
    .setDescription(`Phân tích rủi ro cho <@${member.id}>`)
    .addFields(
      { name: "Điểm rủi ro", value: `**${analysis.riskScore}/100**`, inline: true },
      { name: "Hành động", value: punishResult?.executed ? `✅ ${punishResult.action}` : "✅ Pass", inline: true },
      { name: "Tuổi tài khoản", value: `${Math.floor((Date.now() - member.user.createdTimestamp) / DAY_MS)} ngày`, inline: true },
    );

  if (analysis.riskFactors.length > 0) {
    embed.addFields({
      name: "Yếu tố rủi ro",
      value: analysis.riskFactors.map((f) => `• ${f}`).join("\n").slice(0, 1024),
    });
  }

  if (analysis.linkedUserId) {
    embed.addFields({
      name: "🔗 Linked Account",
      value: `Tương đồng với <@${analysis.linkedUserId}> (${analysis.similarityScore}%)`,
    });
  }

  if (analysis.isVPN) {
    embed.addFields({ name: "🌐 VPN/Proxy", value: "Được phát hiện (behavioral)" });
  }

  embed.setFooter({ text: "Protogon Alt Detection" }).setTimestamp();
  return embed;
}

module.exports = {
  analyzeNewMember,
  executePunishment,
  buildRiskEmbed,
  usernameSimilarity,
  isGeneratedUsername,
  checkVPN,
};
