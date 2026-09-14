/**
 * researchCommands.js — lệnh /research + !research: theo dõi tiến độ học tập
 * của bot (Threat Intel), kích hoạt học thủ công, xem lịch sử học.
 *
 * Bảo mật lượt học thủ công: chỉ Manage Guild (mod/admin) được chạy `learn` —
 * mỗi lượt học có thể tốn token AI (Kira/Mimo free) nên không mở cho mọi người.
 * Cooldown 2 phút đặt ở server (threatIntel:requestManualLearn).
 */

const { Colors } = require("discord.js");
const { logEmbed, canManageWithConfig, canManageGuild, isAdmin } = require("../util");

/** Định dạng thời gian ngắn "09:30 12/9/26". */
function fmtTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm} ${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
}

/** Nhận dạng người dùng từ slash interaction hoặc prefix message. */
function actorOf(source) {
  return source.user ?? source.author ?? null;
}

/** Member cho kiểm tra quyền (slash có interaction.member sẵn). */
function memberOf(source) {
  return source.member ?? null;
}

/**
 * Xem tiến độ học: đọc intel từ Convex (botKey tự đính kèm qua store proxy).
 * Ai cũng xem được — chỉ là thông tin học tập, không tốn gì khi đọc.
 */
async function showStatus(client, store, source) {
  const intel = await store.client.query("threatIntel:botGetIntel", {}).catch(() => null);

  const embed = logEmbed({
    title: "🧠 Tiến độ học tập của bot",
    color: intel?.researchEnabled ? Colors.Green : Colors.Orange,
    description: intel?.researchEnabled
      ? "Threat Intel đang bật — bot tự tải nguồn mở định kỳ và học từ khóa scam mới."
      : "Threat Intel đang TẮT — chủ server bật trong Dashboard → Admin để bot tự học.",
    fields: [
      {
        name: "📚 Từ khóa đang nhớ",
        value: `${intel?.keywords?.length ?? 0} từ khóa · ${intel?.scamPhrases?.length ?? 0} cụm từ`,
        inline: true,
      },
      { name: "🔄 Tổng lượt học", value: String(intel?.runs ?? 0), inline: true },
      {
        name: "⏰ Lượt học gần nhất",
        value: fmtTime(intel?.lastRunAt),
        inline: true,
      },
      {
        name: "🌐 Nguồn lượt trước",
        value: intel?.sources?.length ? intel.sources.join(", ") : "—",
      },
      ...(intel?.summary
        ? [{ name: "🧠 AI tổng hợp", value: String(intel.summary).slice(0, 1000) }]
        : []),
    ],
    footer: "Protogon · Threat Intel — dùng /research learn để kích hoạt học ngay",
  });
  return source.reply({ embeds: [embed] });
}

/**
 * Kích hoạt học thủ công NGAY. Chỉ mod/admin (Manage Guild hoặc role Mod/Admin
 * đã cấu hình). AI chain dùng Kira/Mimo (free 30M tokens/ngày) — không ăn hạn
 * mức Groq giữ cho chống raid.
 */
async function learnNowCommand(client, store, source) {
  const guild = source.guild;
  const config = await store.getConfig(guild.id);
  const member = memberOf(source);
  const isManager =
    member && (canManageGuild(member) || isAdmin(member) || canManageWithConfig(member, config));
  if (!isManager) {
    return source.reply?.({
      content:
        "🔒 Chỉ **mod/admin** mới được kích hoạt lượt học thủ công (mỗi lượt có thể tốn token AI).",
      ephemeral: true,
    });
  }

  const actor = actorOf(source);
  const isSlash = typeof source.deferReply === "function";
  if (isSlash) await source.deferReply().catch(() => {});
  else
    await source
      .reply?.("🧠 **Đang kích hoạt lượt học** — tải nguồn mở + AI tổng hợp, chờ 10-40 giây…")
      .catch(() => {});

  try {
    const { learnNow } = require("../research");
    const res = await learnNow(store, actor?.username ?? "mod");

    const embed = logEmbed({
      title: "✅ Lượt học thủ công hoàn tất",
      color: Colors.Blurple,
      description: `Người yêu cầu: **${actor?.username ?? "mod"}**`,
      fields: [
        {
          name: "Nguồn đã tải",
          value: res.sources?.length ? res.sources.join(", ") : "—",
          inline: false,
        },
        { name: "Từ khóa mới", value: String(res.newKeywords), inline: true },
        { name: "Cụm từ mới", value: String(res.newPhrases), inline: true },
        { name: "Tổng đang nhớ", value: `${res.totalKeywords} từ khóa`, inline: true },
        {
          name: "AI tổng hợp",
          value: res.aiUsed ? "✅ Mimo V2.5 (Kira)" : "⚙️ Heuristics (0 token)",
          inline: true,
        },
        ...(res.summary
          ? [{ name: "🧠 AI nhận định", value: String(res.summary).slice(0, 1000) }]
          : []),
      ],
      footer: "Protogon · Threat Intel — từ khóa mới được dùng ngay trong bộ lọc malware",
    });
    if (isSlash) await source.editReply({ embeds: [embed] }).catch(() => {});
    else await source.channel?.send({ embeds: [embed] }).catch(() => {});
  } catch (e) {
    console.error("[research:learn]", e.message);
    const msg = "❌ Lượt học thất bại — kiểm tra log bot hoặc thử lại sau ít phút.";
    if (isSlash) await source.editReply({ content: msg, embeds: [] }).catch(() => {});
    else await source.reply?.(msg).catch(() => {});
  }
}

/**
 * Xem lịch sử 10 lượt học gần nhất (từ bảng researchRuns — đọc bằng query
 * getResearchHistory, cần token web; bot dùng botGetIntel thay thế khi thiếu).
 */
async function showHistory(client, store, source) {
  // Bot gọi bằng botKey (store proxy tự đính kèm) — query cho phép token hoặc botKey.
  const history = await store.client.query("threatIntel:getResearchHistory", {}).catch(() => null);

  if (!history) {
    const intel = await store.client.query("threatIntel:botGetIntel", {}).catch(() => null);
    return source.reply?.({
      content: `📋 Lượt học gần nhất: **${fmtTime(intel?.lastRunAt)}** · tổng **${intel?.runs ?? 0}** lượt · đang nhớ **${intel?.keywords?.length ?? 0}** từ khóa, **${intel?.scamPhrases?.length ?? 0}** cụm từ.\n(Người dùng \`/research history\` đầy đủ hơn trên Dashboard → Admin)`,
    });
  }

  if (!Array.isArray(history) || history.length === 0) {
    return source.reply?.({
      content: "📋 Chưa có lượt học nào được ghi nhận — dùng `/research learn` để bắt đầu.",
    });
  }

  const lines = history
    .slice(0, 10)
    .map(
      (r) =>
        `• \`${fmtTime(r.createdAt)}\` ${r.trigger === "manual" ? "🖐️ thủ công" : "⏱️ tự động"} — +${r.newKeywords} từ khóa, +${r.newPhrases} cụm từ${r.aiUsed ? " · 🧠 AI" : ""} · nhớ ${r.totalKeywords} từ${r.requestedBy ? ` · bởi ${r.requestedBy}` : ""}`,
    )
    .join("\n");

  const embed = logEmbed({
    title: "📋 Lịch sử học tập (10 lượt gần nhất)",
    color: Colors.Blurple,
    description: lines.slice(0, 3900),
    footer: "Protogon · Threat Intel",
  });
  return source.reply({ embeds: [embed] });
}

/**
 * Dispatch chính — nhận cả slash interaction lẫn prefix message source
 * (cả hai đều có .reply/.guild; slash có deferReply/editReply).
 */
async function handleResearch(client, store, source) {
  const sub =
    typeof source.options?.getSubcommand === "function"
      ? source.options.getSubcommand()
      : (source.args?.[0] || "status").toLowerCase();

  if (sub === "learn") return learnNowCommand(client, store, source);
  if (sub === "history") return showHistory(client, store, source);
  return showStatus(client, store, source);
}

module.exports = { handleResearch };
