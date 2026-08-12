const prefixCommands = require("../commands/prefix");
const { fillPlaceholders } = require("../util");

function channelAllowed(rule, message) {
  if (!rule.channels || rule.channels.length === 0) return true;
  return rule.channels.includes(message.channel.id);
}

async function handleAutoReply(client, message, config, store) {
  const mentioned = message.mentions.users.has(client.user.id);
  const content = message.content.toLowerCase();

  for (const rule of config.autoReplies || []) {
    if (!rule.enabled) continue;
    if (!channelAllowed(rule, message)) continue;

    let matched = false;
    if (rule.triggerType === "mention") {
      matched = mentioned;
    } else {
      matched = (rule.keywords || []).some((k) => k && content.includes(k.toLowerCase()));
    }
    if (!matched) continue;

    if (store.isCooledDown(message.guild.id, rule._id, rule.cooldownSeconds || 0)) continue;

    store.recordReply(message.guild.id, rule._id);
    try {
      let text = fillPlaceholders(rule.response, message.author);
      if (text.length > 1900) text = text.slice(0, 1900) + "…";
      await message.reply({ content: text, allowedMentions: { parse: ["users"] } });
    } catch (err) {
      console.error(`[autoreply] ${message.guild.id}/${rule.name}:`, err.message);
    }
    return; // reply once per message
  }
}

module.exports = async function onMessageCreate(client, message, store, heat) {
  if (message.author.bot) return;
  if (!message.guild || message.guild.available === false) return;
  if (message.channel.isDMBased?.()) return;

  const config = await store.getConfig(message.guild.id);
  if (!config) return;

  const prefix = config.prefix || "!";
  if (message.content.startsWith(prefix)) {
    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const cmd = args.shift()?.toLowerCase() ?? "";
    const handler = prefixCommands[cmd];
    if (handler) {
      try {
        await handler(client, message, args, config, store, heat);
      } catch (err) {
        console.error(`[cmd:${cmd}]`, err);
        message.reply("❌ Có lỗi khi thực hiện lệnh.").catch(() => {});
      }
      return;
    }
    // unknown prefix command — fall through to auto reply for safety? No: ignore.
    return;
  }

  await handleAutoReply(client, message, config, store);
};
