// Build shim — đa nền tảng (Windows/macOS/Linux), không đụng vite.config.ts.
//
// Vì sao cần: Convex deployment KHÔNG có DISCORD_CLIENT_ID (env deployment ≠ env
// hosting) và khi bot offline thì không có botApplicationId để fallback → nút
// đăng nhập Discord chết. Hosting build luôn có DISCORD_CLIENT_ID trong env, còn
// Vite chỉ expose biến có tiền tố VITE_* vào bundle. Shim này chuyển đổi trước
// khi chạy vite build, để usePublicConfig có BAKED_CLIENT_ID dự phòng.
import { spawnSync } from "node:child_process";

process.env.VITE_DISCORD_CLIENT_ID =
  process.env.VITE_DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID || "";

const res = spawnSync("vite", ["build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(res.status ?? 1);
