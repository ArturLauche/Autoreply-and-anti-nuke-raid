# Bản đồ repo thu gọn

> Agent đọc file này qua skill **repo-map** thay vì khám phá từ đầu.
> Cập nhật khi thêm/xoá trang/panel/module/Convex function — không cập nhật
> vì đổi logic bên trong. Mỗi dòng: 1 đơn vị + mô tả ngắn.

## Kiến trúc tổng

```
bot/ (discord.js, Bun, pm2 trên VPS) ⇄ convex/ (DB + backend) ⇄ src/ (React+Vite dashboard)
                                                      ⇄ protogon.freebuff.app (Freebuff hosting)
```

- Cấu hìnhbot ⇄ dashboard đồng bộ qua Convex, trễ ~1 phút.
- Deploy Convex: CI tự chạy sau push main (lint+test xanh); VPS agent cũng
  deploy được qua guardrail 4 lớp (xem `docs/opencode-vps-guide.md`).

## src/ — dashboard web

| Trang                       | Vai trò                                           |
| --------------------------- | ------------------------------------------------- |
| `pages/Landing.tsx`         | Trang chủ mono + Taskbar pill trái + hero stagger |
| `pages/AuthPage.tsx`        | Đăng nhập Discord OAuth                           |
| `pages/Dashboard.tsx`       | Danh sách server của user                         |
| `pages/GuildPage.tsx`       | Trang cấu hình 1 server (tabs → các panel dưới)   |
| `pages/Monitor.tsx`         | Giám sát thời gian thực (chart, sự cố)            |
| `pages/StatsPage.tsx`       | Thống kê tổng                                     |
| `pages/Admin.tsx`           | Trang admin                                       |
| `pages/GuildHistory.tsx`    | Lịch sử sự kiện server                            |
| `pages/DiscordCallback.tsx` | Bắt callback OAuth                                |
| `pages/NotFound.tsx`        | 404                                               |

| Component nhóm               | Vai trò                                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `components/dashboard/`      | Các panel cấu hình: Overview, Analytics (heat xám), Webhook, Verify, JoinGate, Settings (theme xám), Branding… |
| `components/landing/`        | Nav, Footer, sections trang chủ                                                                                |
| `components/ui/`             | shadcn/ui nền tảng (button border-first, card mono)                                                            |
| `components/Taskbar.tsx`     | Pill dọc trái + panel điều hướng nhanh (Escape/click-outside)                                                  |
| `components/HaimiyaChat.tsx` | Chat nhân vật Haimiya (giữ màu brand illustration)                                                             |
| `lib/useBotMonitor.ts`       | Hook trạng thái bot realtime                                                                                   |
| `lib/constants.ts`           | SERVER_THEMES (đã mono xám), hằng số                                                                           |

## bot/ — Discord bot (CommonJS, chạy pm2 `protogon`)

| Nhóm                                                           | Vai trò                         |
| -------------------------------------------------------------- | ------------------------------- |
| `index.js`                                                     | Khởi động + login               |
| `threatEngine.js`, `heat.js`, `altDetection.js`, `lockdown.js` | Nhóm antinuke/raid              |
| `commands/`, `handlers/`                                       | Slash commands + event handlers |
| `convex.js`                                                    | Client Convex của bot           |
| `webhookHub.js`, `relayClient.js`                              | Relay/log sang webhook          |
| `localSnapshot.js`, `backupUtils.js`, `backupAudit.js`         | Backup                          |
| `actionBudget.js`, `rateGuard`, `memGuard.js`                  | Giới hạn hành động/bộ nhớ       |

## convex/ — backend

| Nhóm                                                              | Vai trò                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------- |
| `schema.ts`                                                       | Schema DB duy nhất                                            |
| `auth.ts`, `sessions.ts`, `sessionAuth.ts`, `sessionHardening.ts` | Auth dashboard                                                |
| `botAuth.ts`, `botBootstrap.ts`                                   | botKey SHA-256, bootstrap — KHÔNG backdoor                    |
| `antinuke.ts`, `threatIntel.ts`                                   | Logic antinuke phía backend                                   |
| `haimiya.ts`                                                      | Provider AI bot (self-heal fallback, không hardcode model cũ) |
| `audit.ts`, `reports.ts`, `status.ts`                             | Log/sự kiện/trạng thái                                        |
| `_generated/`                                                     | Sinh tự động — không sửa tay, `bun convex dev --once`         |

## Vòng lặp làm việc

- Kiểm chứng: `bun run test` (51 suites) · `bun tsc -b --noEmit` ·
  `bun run lint` · `bun run format:check` — chi tiết gộp 1 lệnh xem skill
  `verification-loop`.
- Hạ tầng VPS 3 vùng quyền 🟢🟡🔴: `docs/opencode-vps-guide.md` +
  `AGENTS.md` mục 3.
