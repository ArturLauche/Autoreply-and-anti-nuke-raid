require("./loadenv").loadEnv();
const { REST, Routes } = require("discord.js");
const { commands } = require("./commands/slash");

async function registerCommands(clientOrRest) {
  let rest = clientOrRest;
  if (!rest || typeof rest.put !== "function") {
    const token = process.env.DISCORD_TOKEN;
    if (!token) throw new Error("Thiếu DISCORD_TOKEN trong .env");
    rest = new REST({ version: "10" }).setToken(token);
  }
  const clientId = String(process.env.DISCORD_CLIENT_ID || "").trim();
  if (!clientId) {
    console.warn(
      "⚠️ Thiếu DISCORD_CLIENT_ID — bỏ qua đăng ký slash commands.",
      "Thêm DISCORD_CLIENT_ID vào .env để bật tính năng này.",
    );
    return 0;
  }
  // ⚠️ Snowflake 17-20 chữ số. `PUT /applications/{id}/commands` là THAY THẾ
  // TOÀN BỘ: clientId sai (dán nhầm, còn khoảng trắng, copy từ nhầm chỗ) →
  // Discord trả 400 và bot MẤT TRẦN lệnh, không có lệnh nào báo lỗi. Chặn ở
  // đây rẻ hơn nhiều so với mất toàn bộ slash command.
  if (!/^\d{17,20}$/.test(clientId)) {
    console.warn(
      `⚠️ DISCORD_CLIENT_ID không phải snowflake hợp lệ ("${clientId.slice(0, 24)}") — bỏ qua đăng ký.`,
      "Bắm vào Discord > Developer Portal > General Information để lấy Application ID.",
    );
    return 0;
  }
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
