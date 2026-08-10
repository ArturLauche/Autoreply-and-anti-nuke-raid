/**
 * Bộ đọc file cấu hình cực nhẹ — thay thế package `dotenv` (0 dependency).
 * Đọc file `.env` cạnh thư mục bot và nạp vào process.env (không ghi đè
 * biến môi trường đã có sẵn, vd: do panel hosting cung cấp).
 */
const fs = require("fs");
const path = require("path");

function loadEnv(file) {
  const envPath = file || path.join(__dirname, "..", ".env");
  let raw;
  try {
    raw = fs.readFileSync(envPath, "utf8");
  } catch {
    return; // không có file .env — dùng biến môi trường có sẵn
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

module.exports = { loadEnv };
