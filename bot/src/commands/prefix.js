const {
  EmbedBuilder,
  Colors,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { canManageGuild, isAdmin, canManageWithConfig } = require("../util");

const { isLocked, markLocked, unlockGuild } = require("../lockdown");

const MODULES = [
  "massBan",
  "massKick",
  "massJoin",
  "massChannelCreate",
  "massChannelDelete",
  "massRoleCreate",
  "massRoleDelete",
  "massMessageDelete",
  "spam",
];

function noPerm(message) {
  return message.reply(
    "❌ Bạn cần quyền **Quản lý server** (Manage Guild) để dùng lệnh này.",
  );
}

async function handleHelp(client, message) {
  const embed = new EmbedBuilder()
    .setColor(Colors.Aqua)
    .setTitle("🧭 Danh sách lệnh")
    .setDescription(
      [
        "**Prefix** `!` (đổi bằng `!prefix set <kí tự>`)",
        "",
        "```",
        "!help                  - danh sách lệnh",
        "!ping                  - kiểm tra độ trễ",
        "!prefix                - xem prefix",
        "!prefix set ^          - đổi prefix thành ^",
        "!autoreply list        - danh sách rule",
        "!autoreply add <tên> keyword <từ khóa> | <nội dung>",
        "!autoreply add <tên> mention | <nội dung>",
        "!autoreply remove <tên>",
        "!antinuke on|off       - bật/tắt chống nuke",
        "!antinuke status       - trạng thái",
        "!antinuke module <tên> on|off",
        "!antinuke unlock       - mở khóa kênh ngay",
        "!lockdown on|off       - khóa kênh tự động khi raid",
        "!setlog #kênh          - đặt kênh log",
        "```",
      ].join("\n"),
    )
    .setFooter({ text: "Slash command tương đương: /help /prefix /autoreply /antinuke /setup" });
  await message.reply({ embeds: [embed] });
}

async function handlePing(client, message) {
  const sent = await message.reply("🏓 Đang đo độ trễ…");
  const ws = Math.round(client.ws.ping);
  await sent.edit(`🏓 Pong! **${ws}ms** (WebSocket)`);
}

async function handlePrefix(client, message, args, config, store) {
  const prefix = config.prefix || "!";
  if (args[0] !== "set" || args.length < 2) {
    return message.reply(`Prefix hiện tại: \`${prefix}\``);
  }
  if (!canManageGuild(message.member)) return noPerm(message);
  const next = args[1];
  if (!/^[!^$#&%]{1,3}$/.test(next)) {
    return message.reply("Prefix phải là 1-3 ký tự đặc biệt (ví dụ: `!`, `^`, `!!`).");
  }
  await store.client.mutation("bot_writes:botUpdateSettings", {
    guildId: message.guild.id,
    prefix: next,
  });
  store.invalidate(message.guild.id);
  await message.reply(`✅ Đã đổi prefix thành \`${next}\`. Lệnh: \`${next}help\``);
}

async function handleAutoReply(client, message, args, config, store) {
  const sub = args[0]?.toLowerCase();

  if (sub === "list") {
    const rules = config.autoReplies || [];
    if (rules.length === 0) return message.reply("Chưa có rule auto reply nào.");
    const lines = rules.map(
      (r, i) =>
        `${i + 1}. **${r.name}** — ${r.triggerType === "mention" ? "@mention" : `từ khóa: ${r.keywords.join(", ")}`} — ${r.enabled ? "✅" : "⏸️"}`,
    );
    const embed = new EmbedBuilder()
      .setColor(Colors.Aqua)
      .setTitle(`📋 Auto reply (${rules.length})`)
      .setDescription(lines.join("\n").slice(0, 4000));
    return message.reply({ embeds: [embed] });
  }

  // Cho phép quyền Manage Guild/Administrator hoặc role Mod/Admin đã cấu hình.
  if (!canManageWithConfig(message.member, config)) {
    return message.reply(
      "❌ Bạn cần quyền **Quản lý server** hoặc role **Mod/Admin** của server để dùng lệnh này.",
    );
  }

  if (sub === "remove") {
    const name = args[1];
    if (!name) return message.reply("Cú pháp: `!autoreply remove <tên>`");
    await store.client.mutation("bot_writes:botAutoReplyRemove", {
      guildId: message.guild.id,
      name,
    });
    store.invalidate(message.guild.id);
    return message.reply(`✅ Đã xóa rule \`${name}\``);
  }

  if (sub === "add") {
    // !autoreply add <name> keyword <kw1,kw2> | <response>
    // !autoreply add <name> mention | <response>
    const name = args[1];
    const trigger = args[2]?.toLowerCase();
    if (!name || !trigger) {
      return message.reply(
        "Cú pháp:\n`!autoreply add <tên> keyword <từ khóa, cách nhau phẩy> | <nội dung trả lời>`\n`!autoreply add <tên> mention | <nội dung trả lời>`",
      );
    }
    const pipeIndex = args.indexOf("|");
    if (pipeIndex === -1) return message.reply("Thiếu phần `| <nội dung trả lời>`");
    const response = args.slice(pipeIndex + 1).join(" ");
    if (!response.trim()) return message.reply("Nội dung trả lời không được để trống.");
    const payload = {
      guildId: message.guild.id,
      name,
      triggerType: trigger === "mention" ? "mention" : "keyword",
      keywords:
        trigger === "mention" ? [] : args.slice(3, pipeIndex).join(" ").split(",").map((k) => k.trim()).filter(Boolean),
      response,
      channels: [],
      cooldownSeconds: 30,
      enabled: true,
    };
    if (payload.triggerType === "keyword" && payload.keywords.length === 0) {
      return message.reply("Cần ít nhất một từ khóa.");
    }
    try {
      await store.client.mutation("bot_writes:botAutoReplyUpsert", payload);
    } catch (err) {
      return message.reply(`❌ ${err.message}`);
    }
    store.invalidate(message.guild.id);
    return message.reply(`✅ Đã lưu rule \`${name}\` (thêm mới hoặc cập nhật)`);
  }

  return message.reply("Cú pháp: `!autoreply add/list/remove`");
}

async function handleAntinuke(client, message, args, config, store) {
  const sub = args[0]?.toLowerCase();

  if (sub === "status" || !sub) {
    const modules = config.modules || [];
    const lines = modules.map(
      (m) => `${m.enabled ? "✅" : "⏸️"} \`${m.module}\` — ngưỡng ${m.threshold} lần/${m.windowSeconds}s — ${m.punish}`,
    );
    const embed = new EmbedBuilder()
      .setColor(config.antinukeEnabled ? Colors.Green : Colors.Red)
      .setTitle(`🛡️ Chống nuke: ${config.antinukeEnabled ? "ĐANG BẬT" : "ĐÃ TẮT"}`)
      .setDescription(lines.join("\n") || "Chưa có module nào.");
    return message.reply({ embeds: [embed] });
  }

  if (!canManageGuild(message.member) && !isAdmin(message.member)) return noPerm(message);

  if (sub === "unlock") {
    if (!isLocked(message.guild.id)) {
      const cfg = await store.getConfig(message.guild.id);
      if (!cfg?.lockdownUntil || cfg.lockdownUntil <= Date.now()) {
        return message.reply("Server hiện không ở trạng thái khóa kênh.");
      }
      markLocked(message.guild.id);
    }
    const cfg = await store.getConfig(message.guild.id);
    await unlockGuild(client, message.guild, cfg, store);
    return message.reply("🔓 Đã mở khóa kênh.");
  }

  if (sub === "on" || sub === "off") {
    await store.client.mutation("bot_writes:botSetAntinuke", {
      guildId: message.guild.id,
      enabled: sub === "on",
    });
    store.invalidate(message.guild.id);
    return message.reply(`✅ Đã ${sub === "on" ? "bật" : "tắt"} chống nuke.`);
  }

  if (sub === "module") {
    const name = args[1];
    const value = args[2]?.toLowerCase();
    if (!MODULES.includes(name) || !["on", "off"].includes(value)) {
      return message.reply(
        `Cú pháp: \`!antinuke module <${MODULES.join("|")}> <on|off>\``,
      );
    }
    await store.client.mutation("bot_writes:botModuleUpdate", {
      guildId: message.guild.id,
      module: name,
      enabled: value === "on",
    });
    store.invalidate(message.guild.id);
    return message.reply(`✅ Module \`${name}\` đã ${value === "on" ? "bật" : "tắt"}.`);
  }

  return message.reply("Cú pháp: `!antinuke on|off|status|module <tên> <on|off>|unlock`");
}

async function handleLockdown(client, message, args, config, store) {
  if (!canManageGuild(message.member)) return noPerm(message);
  const sub = args[0]?.toLowerCase();
  if (sub !== "on" && sub !== "off") {
    return message.reply("Cú pháp: `!lockdown on|off`");
  }
  await store.client.mutation("bot_writes:botUpdateLockdown", {
    guildId: message.guild.id,
    enabled: sub === "on",
  });
  store.invalidate(message.guild.id);
  return message.reply(
    sub === "on"
      ? "✅ Khóa kênh tự động khi raid đã bật."
      : "✅ Khóa kênh tự động khi raid đã tắt.",
  );
}

async function handleSetlog(client, message, args, config, store) {
  if (!canManageGuild(message.member)) return noPerm(message);
  const channel = message.mentions.channels.first();
  if (!channel) return message.reply("Hãy tag kênh log, ví dụ: `!setlog #logs`");
  await store.client.mutation("bot_writes:botUpdateSettings", {
    guildId: message.guild.id,
    logChannelId: channel.id,
  });
  store.invalidate(message.guild.id);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel("Mở kênh log")
      .setURL(`https://discord.com/channels/${message.guild.id}/${channel.id}`),
  );
  await message.reply({
    content: `✅ Kênh log đã đặt là ${channel}. Cảnh báo chống nuke sẽ được gửi tại đây.`,
    components: [row],
  });
}

module.exports = {
  help: handleHelp,
  ping: handlePing,
  prefix: handlePrefix,
  autoreply: handleAutoReply,
  antinuke: handleAntinuke,
  lockdown: handleLockdown,
  setlog: handleSetlog,
};
