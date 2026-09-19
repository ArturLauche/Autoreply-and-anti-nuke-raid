// Build shim — đa nền tảng (Windows/macOS/Linux), không đụng vite.config.ts.
//
// Vì sao cần: Convex deployment KHÔNG có DISCORD_CLIENT_ID (env deployment ≠ env
// hosting) và khi bot offline thì không có botApplicationId để fallback → nút
// đăng nhập Discord chết. Hosting build luôn có DISCORD_CLIENT_ID trong env, còn
// Vite chỉ expose biến có tiền tố VITE_* vào bundle. Shim này chuyển đổi trước
// khi chạy vite build, để usePublicConfig có BAKED_CLIENT_ID dự phòng.
import { spawnSync } from "node:child_process";

// Chỉ nướng giá trị Client ID HỢP LỆ (Discord Application ID là snowflake: chỉ
// gồm chữ số, 15-21 ký tự). Bug thật 18/09: env chứa blob mã hóa dán nhầm
// (base64 "{\"v\":\"v2\",...}") → bundle mang giá trị rác → URL đăng nhập
// Discord bị từ chối “Invalid Form Body” ngay trang Discord. Giá trị sai bị bỏ
// qua để runtime fallback về Convex (botApplicationId) thay vì phá nút đăng nhập.
const rawClientId = process.env.VITE_DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID || "";
const trimmedClientId = rawClientId.trim();
if (rawClientId && !/^\d{15,21}$/.test(trimmedClientId)) {
  console.warn(
    "[build] DISCORD_CLIENT_ID không đúng dạng Application ID (chỉ chữ số, 15-21 ký tự)" +
      " — bỏ qua thay vì nướng vào bundle (tránh lỗi Invalid Form Body khi đăng nhập).",
  );
}
process.env.VITE_DISCORD_CLIENT_ID = /^\d{15,21}$/.test(trimmedClientId) ? trimmedClientId : "";

const res = spawnSync("vite", ["build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(res.status ?? 1);
