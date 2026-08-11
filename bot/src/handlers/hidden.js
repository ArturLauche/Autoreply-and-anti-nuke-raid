const { EmbedBuilder } = require("discord.js");

const GIVEAWAY_EMOJI = "🎉";
const HIDDEN_COLOR = 0xf48fb1;

function emojiMatches(entryEmoji, emoji) {
  if (/^\d{15,20}$/.test(entryEmoji)) return emoji.id === entryEmoji;
  return emoji.name === entryEmoji;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function resolveEmoji(client, emojiStr) {
  if (/^\d{15,20}$/.test(emojiStr)) {
    return client.emojis.cache.get(emojiStr) ?? null;
  }
  return emojiStr;
}

/** Xử lý reaction: cấp/gỡ role theo bảng reaction role + ghi nhận tham gia giveaway. */
async function onReaction(client, store, reaction, user, removed) {
  if (user.bot) return;
  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();
    const guild = reaction.message.guild;
    if (!guild) return;
    const hidden = await store.client.query("hidden:getBotHidden", {
      guildId: guild.id,
    });
    if (!hidden) return;

    // Reaction role panel
    const panel = hidden.panels.find(
      (p) =>
        p.enabled &&
        p.messageId &&
        p.messageId === reaction.message.id &&
        p.channelId === reaction.message.channelId,
    );
    if (panel) {
      const entry = panel.entries.find((e) => emojiMatches(e.emoji, reaction.emoji));
      if (entry) {
        try {
          const member = await guild.members.fetch(user.id);
          if (!removed) {
            if (!member.roles.cache.has(entry.roleId)) await member.roles.add(entry.roleId);
          } else if (member.roles.cache.has(entry.roleId)) {
            await member.roles.remove(entry.roleId);
          }
        } catch (e) {
          console.error(`[hidden:panel] ${guild.id}:`, e.message);
        }
      }
    }

    // Giveaway entry (chỉ khi reaction 🎉 và đang active)
    if (!removed && reaction.emoji.name === GIVEAWAY_EMOJI) {
      const giveaway = hidden.giveaways.find(
        (g) =>
          g.status === "active" &&
          g.messageId &&
          g.messageId === reaction.message.id,
      );
      if (giveaway && Date.now() < giveaway.endsAt) {
        let allowed = true;
        if (giveaway.requiredRoleId) {
          try {
            const member = await guild.members.fetch(user.id);
            allowed = member.roles.cache.has(giveaway.requiredRoleId);
          } catch {
            allowed = false;
          }
        }
        if (allowed) {
          await store.client.mutation("hidden:giveawayEnter", {
            giveawayId: giveaway._id,
            userId: user.id,
            username: user.username,
          });
        }
      }
    }
  } catch (e) {
    console.error("[hidden:reaction]", e?.message || e);
  }
}

/** Gửi bảng reaction role ra kênh. */
async function postPanel(client, store, panel) {
  const channel = await client.channels.fetch(panel.channelId);
  if (!channel?.isTextBased()) return;
  const embed = new EmbedBuilder()
    .setColor(HIDDEN_COLOR)
    .setTitle(panel.label)
    .setDescription("Chọn emoji bên dưới để nhận role 🌸\nBấm lại lần nữa để gỡ role.")
    .setFooter({ text: "Protogon · Reaction Role" });
  for (const e of panel.entries) {
    const emoji = await resolveEmoji(client, e.emoji);
    if (emoji) embed.addFields({ name: emoji, value: `<@&${e.roleId}>`, inline: true });
  }
  const msg = await channel.send({ embeds: [embed] });
  for (const e of panel.entries) {
    const emoji = await resolveEmoji(client, e.emoji);
    if (emoji) await msg.react(emoji).catch(() => {});
  }
  await store.client.mutation("hidden:panelPosted", {
    panelId: panel._id,
    messageId: msg.id,
  });
}

/** Mẫu tin nhắn giveaway — đổi lời chào, màu, footer theo lựa chọn. */
const GIVEAWAY_TEMPLATES = {
  default: {
    color: 0xf48fb1,
    emoji: "🎉",
    header: "GIVEAWAY",
    footer: "Bấm 🎉 để tham gia!",
    endFooter: "Protogon · Giveaway",
  },
  luxury: {
    color: 0xf1c40f,
    emoji: "✨",
    header: "GIVEAWAY SANG TRỌNG",
    footer: "✨ Chỉ dành cho người may mắn ✨",
    endFooter: "✨ Protogon · Giveaway cao cấp",
  },
  vip: {
    color: 0x9b59b6,
    emoji: "💎",
    header: "GIVEAWAY VIP",
    footer: "💎 Vận may đang chờ bạn 💎",
    endFooter: "💎 Protogon · Giveaway VIP",
  },
  simple: {
    color: 0x2ecc71,
    emoji: "🎁",
    header: "QUÀ TẶNG",
    footer: "🎁 Tham gia ngay nhé!",
    endFooter: "🎁 Protogon · Giveaway",
  },
};

function templateOf(giveaway) {
  return GIVEAWAY_TEMPLATES[giveaway.template] || GIVEAWAY_TEMPLATES.default;
}

/** Gửi giveaway ra kênh. */
async function postGiveaway(client, store, giveaway) {
  const channel = await client.channels.fetch(giveaway.channelId);
  if (!channel?.isTextBased()) return;
  const t = templateOf(giveaway);
  const embed = new EmbedBuilder()
    .setColor(t.color)
    .setTitle(`${t.emoji} ${t.header} — ${giveaway.title}`)
    .setDescription(giveaway.message || giveaway.prize)
    .addFields(
      { name: "🏆 Giải thưởng", value: giveaway.prize, inline: false },
      { name: "👥 Người thắng", value: `${giveaway.winnerCount}`, inline: true },
      {
        name: "⏰ Kết thúc",
        value: `<t:${Math.floor(giveaway.endsAt / 1000)}:R>`,
        inline: true,
      },
    )
    .setFooter({ text: t.footer });
  if (giveaway.imageUrl) embed.setImage(giveaway.imageUrl);
  if (giveaway.requiredRoleId) {
    embed.addFields({
      name: "Điều kiện",
      value: `Chỉ dành cho <@&${giveaway.requiredRoleId}>`,
      inline: true,
    });
  }
  if (giveaway.prizeRoleId) {
    embed.addFields({
      name: "🎖️ Giải thưởng đặc biệt",
      value: `Người thắng được cấp role <@&${giveaway.prizeRoleId}>`,
      inline: true,
    });
  }
  const msg = await channel.send({ embeds: [embed] });
  await msg.react(GIVEAWAY_EMOJI).catch(() => {});
  await store.client.mutation("hidden:giveawayPosted", {
    giveawayId: giveaway._id,
    messageId: msg.id,
  });
}

/** Kết thúc giveaway hết hạn: chọn người thắng, thông báo, cấp role, DM nếu bật. */
async function endGiveaway(client, store, giveaway) {
  const winners = shuffle(giveaway.entries)
    .slice(0, giveaway.winnerCount)
    .map((e) => ({ userId: e.userId, username: e.username }));
  const t = templateOf(giveaway);
  try {
    const channel = await client.channels.fetch(giveaway.channelId);
    if (channel?.isTextBased() && giveaway.messageId) {
      const msg = await channel.messages.fetch(giveaway.messageId).catch(() => null);
      if (msg) {
        const embed = new EmbedBuilder()
          .setColor(0x23a55a)
          .setTitle(`🏁 ${t.emoji} KẾT THÚC — ${giveaway.title}`)
          .setDescription(giveaway.message || giveaway.prize)
          .addFields(
            { name: "🏆 Giải thưởng", value: giveaway.prize, inline: false },
            {
              name: "🎉 Người thắng",
              value:
                winners.length > 0
                  ? winners.map((w) => `<@${w.userId}>`).join("\n")
                  : "Không có ai tham gia 😢",
              inline: false,
            },
          )
          .setFooter({ text: t.endFooter });
        if (giveaway.prizeRoleId) {
          embed.addFields({
            name: "🎖️ Role đã cấp",
            value: `<@&${giveaway.prizeRoleId}>`,
            inline: false,
          });
        }
        await msg.edit({ embeds: [embed] });
      }
    }
  } catch (e) {
    console.error(`[hidden:giveaway end ${giveaway._id}]`, e.message);
  }

  // Tự cấp role thưởng cho người thắng (best-effort).
  if (giveaway.prizeRoleId) {
    for (const w of winners) {
      try {
        const member = await channel?.guild?.members.fetch(w.userId).catch(() => null);
        if (member && !member.roles.cache.has(giveaway.prizeRoleId)) {
          await member.roles.add(giveaway.prizeRoleId);
        }
      } catch (e) {
        console.error(`[hidden:giveaway role ${w.userId}]`, e.message);
      }
    }
  }

  if (giveaway.dmWinners) {
    const roleLine = giveaway.prizeRoleId ? `\n🎖️ Bạn đã được cấp role **<@&${giveaway.prizeRoleId}>** trên server!` : "";
    for (const w of winners) {
      try {
        const user = await client.users.fetch(w.userId);
        await user.send(
          `${giveaway.endMessage || "🎉 Chúc mừng! Bạn đã thắng giveaway!"}\n\n🏆 **${giveaway.title}** — ${giveaway.prize}${roleLine}\n\nHãy liên hệ admin để nhận thưởng nhé 🌸`,
        );
      } catch (e) {
        console.error(`[hidden:giveaway dm ${w.userId}]`, e.message);
      }
    }
  }
  await store.client.mutation("hidden:giveawayEnd", {
    giveawayId: giveaway._id,
    winners,
  });
}

/** Gửi DM trực tiếp theo yêu cầu của admin. */
async function sendDirectDm(client, store, guildId) {
  try {
    const hidden = await store.client.query("hidden:getBotHidden", { guildId });
    if (!hidden || !hidden.dmRequested || !hidden.dmTargetUserId || !hidden.dmMessage) return;
    const user = await client.users.fetch(hidden.dmTargetUserId);
    await user.send(hidden.dmMessage);
    console.log(`✅ Đã gửi DM tới ${user.tag}`);
  } catch (e) {
    console.error(`[hidden:dm ${guildId}]`, e.message);
  } finally {
    try {
      await store.client.mutation("hidden:botClearDm", { guildId });
    } catch {}
  }
}

/** Vòng quét: đăng bảng/giveaway mới, kết thúc giveaway hết hạn, gửi DM chờ. */
async function pollHidden(client, store) {
  for (const guild of client.guilds.cache.values()) {
    try {
      const hidden = await store.client.query("hidden:getBotHidden", { guildId: guild.id });
      if (!hidden) continue;

      for (const panel of hidden.panels) {
        if (panel.enabled && !panel.messageId) {
          await postPanel(client, store, panel).catch((e) =>
            console.error(`[hidden:panel ${guild.id}]`, e.message),
          );
        }
      }

      for (const giveaway of hidden.giveaways) {
        if (giveaway.status !== "active") continue;
        if (!giveaway.messageId) {
          await postGiveaway(client, store, giveaway).catch((e) =>
            console.error(`[hidden:giveaway ${guild.id}]`, e.message),
          );
        } else if (Date.now() >= giveaway.endsAt) {
          await endGiveaway(client, store, giveaway).catch((e) =>
            console.error(`[hidden:giveaway end ${guild.id}]`, e.message),
          );
        }
      }

      if (hidden.dmRequested) {
        await sendDirectDm(client, store, guild.id);
      }
    } catch (e) {
      console.error(`[hidden:poll ${guild.id}]`, e?.message || e);
    }
  }
}

/** Gắn listener reaction + lịch quét. */
function setupHidden(client, store) {
  client.on("messageReactionAdd", (reaction, user) =>
    onReaction(client, store, reaction, user, false).catch((e) =>
      console.error("[hidden:reactionAdd]", e.message),
    ),
  );
  client.on("messageReactionRemove", (reaction, user) =>
    onReaction(client, store, reaction, user, true).catch((e) =>
      console.error("[hidden:reactionRemove]", e.message),
    ),
  );
  client.once("ready", () => {
    setInterval(() => pollHidden(client, store).catch(() => {}), 30_000);
  });
}

module.exports = { setupHidden, pollHidden };
