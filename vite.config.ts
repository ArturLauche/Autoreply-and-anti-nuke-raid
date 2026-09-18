import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
// LƯU Ý: block `server` (hmr: false) là yêu cầu của Freebuff — KHÔNG sửa.
// Block `build` bên dưới chỉ tách vendor ra khỏi app code để browser cache
// hiệu quả hơn (thay deps hiếm khi đổi → chunk riêng, app đổi → chunk nhỏ).
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT || 5173),
    hmr: false,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-convex": ["convex"],
          "vendor-motion": ["framer-motion"],
          "vendor-icons": ["lucide-react"],
        },
      },
    },
  },
});
