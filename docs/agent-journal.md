# Nhật ký tiến trình agent

> Agent ghi vào đây qua skill **progress-journal**. Entry mới nhất trên cùng,
> tối đa ~30 entry. Mục "Đang dở" là danh sách việc chưa xong — đọc đầu tiên
> mỗi phiên.

## Đang dở

_(trống — mọi việc đã xong hoặc chờ yêu cầu mới)_

---

## 2026-09-20 — Thêm 2 skill tiết kiệm token

- ✅ Xong: skill `token-economy` (search-first, đọc cửa sổ) + `verification-loop`
  (gộp bộ kiểm chứng 1 lệnh, re-check tối thiểu theo bảng delta)
- 📁 File đụng: `.opencode/skills/token-economy/SKILL.md`,
  `.opencode/skills/verification-loop/SKILL.md`
- 🧪 Kiểm chứng: format OK · lint OK · 52/52 suites (audit cấu trúc hợp đồng)
- ▶️ Tiếp theo: pull về VPS để OpenCode session mới nhận 2 skill

## 2026-09-20 — Merge redesign + polish Taskbar/nav/loading

- ✅ Xong: merge `redesign/vercel-monochrome` → main (`d81ed45`), nav scroll
  mượt + scroll-margin, RouteFallback thành progress bar thương hiệu, Taskbar
  pill mới có Escape/click-outside
- 📁 File đụng: `src/components/Taskbar.tsx`, `src/App.tsx`,
  `src/components/landing/Nav.tsx`, `tailwind.config.ts`
- 🧪 Kiểm chứng: 51/51 suites · tsc OK · build 8.3s · production active
  (bundle `index-DloJ15Ak.js`)
- ▶️ Tiếp theo: không có — chờ feedback UI từ người dùng
