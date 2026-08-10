const { EmbedBuilder, Colors } = require("discord.js");
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

function needPerm(interaction) {
  return interaction.reply({
    content: "❌ Bạn không có quyền dùng lệnh này — cần quyền **Quản lý server** hoặc role **Mod/Admin** được cấu hình qua `/setup`.",
    ephemeral: true,
  });
}

module.exports = async function onInteractionCreate(client, interaction, store) {
  if (!interaction.isChatInputCommand()) return;

  const name = interaction.commandName;
  const guild = interaction.guild;
  if (!guild) {
    return interaction.reply({ content: "Lệnh này chỉ hoạt động trong server.", ephemeral: true });
  }

  switch (name) {
    case "ping": {
      const ws = Math.round(client.ws.ping);
      return interaction.reply({ content: `🏓 Pong! **${ws}ms** (WebSocket)`, ephemeral: true });
    }

    case "help": {
      const embed = new EmbedBuilder()
        .setColor(Colors.Cyan)
        .setTitle("🧭 Lệnh của Protogon")
        .setDescription(
          [
            "**Auto Reply** — `/autoreply add` tạo rule từ khóa hoặc @mention, `/autoreply list`, `/autoreply remove`",
            "**Chống nuke** — `/antinuke status`, `/antinuke on|off`, `/antinuke module`, `/antinuke unlock`, `/antinuke lockdown`",
            "**Cấu hình** — `/setup log-channel`, `/setup mod-role`, `/setup admin-role`, `/prefix set`",
            "**Khác** — `/ping`",
          ].join("\n"),
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    case "prefix": {
      const set = interaction.options.getString("set");
      const config = await store.getConfig(guild.id);
      const current = config?.prefix || "!";
      if (!set) {
        return interaction.reply({ content: `Prefix hiện tại: \`${current}\``, ephemeral: true });
      }
      if (!canManageGuild(interaction.member)) return needPerm(interaction);
      if (!/^[!^$#&%]{1,3}$/.test(set)) {
        return interaction.reply({
          content: "Prefix phải là 1-3 ký tự đặc biệt (ví dụ: `!`, `^`).",
          ephemeral: true,
        });
      }
      await store.client.mutation("bot_writes:botUpdateSettings", { guildId: guild.id, prefix: set });
      store.invalidate(guild.id);
      return interaction.reply({
        content: `✅ Đã đổi prefix thành \`${set}\`. Lệnh text: \`${set}help\``,
        ephemeral: true,
      });
    }

    case "autoreply": {
      const sub = interaction.options.getSubcommand();
      const config = await store.getConfig(guild.id);

      if (sub === "list") {
        const rules = config?.autoReplies || [];
        if (rules.length === 0) {
          return interaction.reply({ content: "Chưa có rule auto reply nào.", ephemeral: true });
        }
        const lines = rules.map(
          (r) =>
            `• **${r.name}** — ${r.triggerType === "mention" ? "@mention" : r.keywords.join(", ")} — ${r.enabled ? "✅" : "⏸️"}`,
        );
        const embed = new EmbedBuilder()
          .setColor(Colors.Cyan)
          .setTitle(`📋 Auto reply (${rules.length})`)
          .setDescription(lines.join("\n").slice(0, 4000));
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // Mod/Admin (Manage Guild) hoặc role Mod/Admin được cấu hình qua /setup.
      if (!canManageWithConfig(interaction.member, config)) return needPerm(interaction);

      if (sub === "add") {
        const name = interaction.options.getString("name", true);
        const trigger = interaction.options.getString("trigger", true);
        const response = interaction.options.getString("response", true);
        const keywordsRaw = interaction.options.getString("keywords") ?? "";
        const cooldown = interaction.options.getInteger("cooldown") ?? 30;
        const payload = {
          guildId: guild.id,
          name,
          triggerType: trigger === "mention" ? "mention" : "keyword",
          keywords: keywordsRaw.split(",").map((k) => k.trim()).filter(Boolean),
          response,
          channels: [],
          cooldownSeconds: Math.max(0, cooldown),
          enabled: true,
        };
        if (payload.triggerType === "keyword" && payload.keywords.length === 0) {
          return interaction.reply({
            content: "Với loại `keyword` bạn cần nhập từ khóa (phân cách bằng dấu phẩy).",
            ephemeral: true,
          });
        }
        try {
          await store.client.mutation("bot_writes:botAutoReplyUpsert", payload);
        } catch (err) {
          return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
        }
        store.invalidate(guild.id);
        return interaction.reply({
          content: `✅ Đã lưu rule \`${name}\` (thêm mới hoặc cập nhật) — bot trả lời: "${response.slice(0, 80)}${response.length > 80 ? "…" : ""}"`,
          ephemeral: true,
        });
      }

      if (sub === "remove") {
        const name = interaction.options.getString("name", true);
        await store.client.mutation("bot_writes:botAutoReplyRemove", {
          guildId: guild.id,
          name,
        });
        store.invalidate(guild.id);
        return interaction.reply({
          content: `✅ Đã xóa rule \`${name}\`.`,
          ephemeral: true,
        });
      }

      if (sub === "edit") {
        const name = interaction.options.getString("name", true);
        const response = interaction.options.getString("response");
        const cooldown = interaction.options.getInteger("cooldown");
        const rule = (config?.autoReplies || []).find((r) => r.name === name);
        if (!rule) {
          return interaction.reply({
            content: `Không tìm thấy rule \`${name}\`. Dùng \`/autoreply list\` để xem danh sách.`,
            ephemeral: true,
          });
        }
        await store.client.mutation("bot_writes:botAutoReplyUpsert", {
          guildId: guild.id,
          name,
          triggerType: rule.triggerType,
          keywords: rule.keywords,
          response: response ?? rule.response,
          channels: rule.channels || [],
          cooldownSeconds: cooldown !== null ? Math.max(0, cooldown) : rule.cooldownSeconds,
          enabled: rule.enabled,
        });
        store.invalidate(guild.id);
        return interaction.reply({
          content: `✅ Đã cập nhật rule \`${name}\`.`,
          ephemeral: true,
        });
      }
      return;
    }

    case "antinuke": {
      const sub = interaction.options.getSubcommand();

      if (sub === "status") {
        const config = await store.getConfig(guild.id);
        const modules = config?.modules || [];
        const lines = modules.map(
          (m) => `${m.enabled ? "✅" : "⏸️"} \`${m.module}\` — ${m.threshold} lần/${m.windowSeconds}s — ${m.punish}`,
        );
        const embed = new EmbedBuilder()
          .setColor(config?.antinukeEnabled ? Colors.Green : Colors.Red)
          .setTitle(`🛡️ Chống nuke: ${config?.antinukeEnabled ? "ĐANG BẬT" : "ĐÃ TẮT"}`)
          .setDescription(lines.join("\n") || "Chưa có module nào.");
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (!canManageGuild(interaction.member) && !isAdmin(interaction.member)) return needPerm(interaction);

      if (sub === "unlock") {
        if (!isLocked(guild.id)) {
          const config = await store.getConfig(guild.id);
          if (!config?.lockdownUntil || config.lockdownUntil <= Date.now()) {
            return interaction.reply({
              content: "Server hiện không ở trạng thái khóa kênh.",
              ephemeral: true,
            });
          }
          markLocked(guild.id);
        }
        const config = await store.getConfig(guild.id);
        await unlockGuild(client, guild, config, store);
        return interaction.reply({
          content: "🔓 Đã mở khóa kênh.",
          ephemeral: true,
        });
      }

      if (sub === "lockdown") {
        const value = interaction.options.getString("value", true);
        if (!["on", "off"].includes(value)) {
          return interaction.reply({ content: "Giá trị phải là on hoặc off.", ephemeral: true });
        }
        await store.client.mutation("bot_writes:botUpdateLockdown", {
          guildId: guild.id,
          enabled: value === "on",
        });
        store.invalidate(guild.id);
        return interaction.reply({
          content: value === "on"
            ? "✅ Khóa kênh tự động khi raid đã bật."
            : "✅ Khóa kênh tự động khi raid đã tắt.",
          ephemeral: true,
        });
      }

      if (sub === "on" || sub === "off") {
        await store.client.mutation("bot_writes:botSetAntinuke", {
          guildId: guild.id,
          enabled: sub === "on",
        });
        store.invalidate(guild.id);
        return interaction.reply({
          content: `✅ Đã ${sub === "on" ? "bật" : "tắt"} chống nuke.`,
          ephemeral: true,
        });
      }

      if (sub === "module") {
        const moduleName = interaction.options.getString("module", true);
        const value = interaction.options.getString("value", true);
        if (!MODULES.includes(moduleName) || !["on", "off"].includes(value)) {
          return interaction.reply({
            content: `Module phải thuộc: ${MODULES.join(", ")} và giá trị là on|off.`,
            ephemeral: true,
          });
        }
        await store.client.mutation("bot_writes:botModuleUpdate", {
          guildId: guild.id,
          module: moduleName,
          enabled: value === "on",
        });
        store.invalidate(guild.id);
        return interaction.reply({
          content: `✅ Module \`${moduleName}\` đã ${value === "on" ? "bật" : "tắt"}.`,
          ephemeral: true,
        });
      }
      return;
    }

    case "setup": {
      if (!canManageGuild(interaction.member)) return needPerm(interaction);
      const sub = interaction.options.getSubcommand();

      if (sub === "log-channel") {
        const channel = interaction.options.getChannel("channel", true);
        await store.client.mutation("bot_writes:botUpdateSettings", {
          guildId: guild.id,
          logChannelId: channel.id,
        });
        store.invalidate(guild.id);
        return interaction.reply({
          content: `✅ Kênh log đã đặt là ${channel}.`,
          ephemeral: true,
        });
      }

      if (sub === "mod-role") {
        const role = interaction.options.getRole("role", true);
        const config = await store.getConfig(guild.id);
        const modRoles = [...new Set([...(config?.modRoles || []), role.id])];
        await store.client.mutation("bot_writes:botUpdateSettings", {
          guildId: guild.id,
          modRoles,
        });
        store.invalidate(guild.id);
        return interaction.reply({
          content: `✅ Role Mod đã thêm ${role}.`,
          ephemeral: true,
        });
      }

      if (sub === "admin-role") {
        const role = interaction.options.getRole("role", true);
        const config = await store.getConfig(guild.id);
        const adminRoles = [...new Set([...(config?.adminRoles || []), role.id])];
        await store.client.mutation("bot_writes:botUpdateSettings", {
          guildId: guild.id,
          adminRoles,
        });
        store.invalidate(guild.id);
        return interaction.reply({
          content: `✅ Role Admin đã thêm ${role}.`,
          ephemeral: true,
        });
      }
      return;
    }

    default:
      return interaction.reply({ content: "Lệnh chưa được hỗ trợ.", ephemeral: true });
  }
};
