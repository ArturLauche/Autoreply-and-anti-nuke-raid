require("dotenv").config();
const { REST, Routes } = require("discord.js");
const { commands } = require("./commands/slash");

async function registerCommands(clientOrRest) {
  let rest = clientOrRest;
  if (!rest || typeof rest.put !== "function") {
    const token = process.env.DISCORD_TOKEN;
    if (!token) throw new Error("Thiếu DISCORD_TOKEN trong .env");
    rest = new REST({ version: "10" }).setToken(token);
  }
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) throw new Error("Thiếu DISCORD_CLIENT_ID trong .env");
  const data = await rest.put(Routes.applicationCommands(clientId), { body: commands });
  return data.length;
}

async function main() {
  const count = await registerCommands();
  console.log(`✅ Đã đăng ký ${count} slash commands.`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("❌", err.message);
    process.exit(1);
  });
}

module.exports = { registerCommands, commands };
