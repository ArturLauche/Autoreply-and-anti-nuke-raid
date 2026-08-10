# Protogon Bot — Auto Reply & Anti Nuke Raid

Bot Discord tự động trả lời tin nhắn thành viên theo **từ khóa** hoặc khi bị **tag @mention** (nội dung do bạn tùy chỉnh), hỗ trợ đầy đủ **prefix (`!`) + slash commands**, kèm hệ thống **chống nuke/raid** bật tắt từng phần theo ý mod & owner — tất cả quản lý qua một **dashboard web** tùy chỉnh.

## Kiến trúc

```
┌─────────────────────────┐      ┌──────────────────────┐
│  Dashboard web (React)  │◄────►│  Convex (backend + DB)│
│  - OAuth Discord (PKCE) │      │  - cấu hình mỗi guild │
│  - auto reply / antinuke│      │  - autoReplies, modules│
│  - prefix, roles, log   │      │  - sessions, botStatus│
└─────────────────────────┘      └──────────▲───────────┘
                                             │ HTTP (ConvexHttpClient)
                                 ┌───────────┴───────────┐
                                 │  Bot Discord (discord.js)│
                                 │  - prefix + slash cmds  │
                                 │  - auto reply matcher    │
                                 │  - anti-nuke engine      │
                                 └─────────────────────────┘
```

- **Dashboard** (thư mục gốc): React + Vite + Tailwind + Convex. Đăng nhập bằng Discord (OAuth PKCE, không cần client secret), chọn server, cấu hình mọi thứ.
- **Bot** (`bot/`): process Node.js standalone chạy 24/7 (máy bạn hoặc hosting). Đọc/ghi cấu hình qua Convex — dashboard và bot luôn đồng bộ trong ~30 giây.
- **Backend** (`src/convex/`): schema + query/mutation. Mọi ghi dữ liệu từ dashboard được kiểm tra quyền *Manage Guild* (xác thực qua Discord OAuth); bot dùng các mutation riêng `bot-writes:*` bảo vệ bằng deploy key.

## Bắt đầu

### 1. Tạo ứng dụng Discord

1. Vào [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. Tab **Bot** → bật **Presence**, **Server Members**, **Message Content** intent → **Reset Token** để lấy `BOT_TOKEN`.
3. Lưu **Application ID** (Client ID).

### 2. Cấu hình dashboard (Freebuff)

Điền vào mục **API Keys** của dự án:

| Key | Giá trị |
| --- | --- |
| `DISCORD_CLIENT_ID` | Application ID ở bước 1 (cần cho đăng nhập + link mời bot) |
| `CONVEX_URL` (production) | URL deployment Convex khi deploy — set qua `freebuff-deploy env set` |

Chạy preview → **Đăng nhập với Discord** → dán redirect URI `https://<địa chỉ preview>/discord/callback` vào ứng dụng Discord (*OAuth2 → Redirects*; với bản local thêm `http://localhost:5173/discord/callback`).

### 3. Chạy bot

Xem hướng dẫn chi tiết tại [`bot/README.md`](bot/README.md). Tóm tắt:

```bash
cd bot
bun install
bun run start
```

**Không có máy/VPS để chạy bot?** → Dùng **Bot-Hosting.net miễn phí** (cloud chuyên host bot Discord, không cần thẻ, bot chạy 24/7 bằng hệ thống coin): `cd bot && npm run pack:host` rồi upload `protogon-bot.zip` theo hướng dẫn trong [`bot/README.md`](bot/README.md) → mục “Chạy bot MIỄN PHÍ trên Bot-Hosting.net”.

**Bot trên cloud cần Convex backend công khai?** → Hướng dẫn deploy Convex Cloud miễn phí (`npx convex login` + `npx convex deploy`, lấy URL + Deploy Key): xem [`bot/README.md`](bot/README.md) → mục “Deploy Convex backend lên cloud miễn phí”.

Bot tự đăng ký slash commands và đồng bộ server/kênh/role lên Convex mỗi 60 giây.

### 4. Mời bot & quản lý

- Nhấn **Mời bot** trong dashboard (hoặc dùng link invite tạo từ `DISCORD_CLIENT_ID`).
- Vào server → tab **Auto Reply**: tạo rule từ khóa / @mention với nội dung tùy chỉnh, cooldown, giới hạn kênh.
- Tab **Anti Nuke**: bật tắt toàn bộ hoặc từng module, chỉnh ngưỡng & hình thức xử lý, role miễn trừ.
- Tab **Cài đặt**: prefix, kênh log, role Mod/Admin.
- Hoặc quản lý trực tiếp trong Discord bằng `!autoreply`, `!antinuke`, `/setup`…

## Tính năng chính

- 🤖 **Auto reply**: kích hoạt bằng từ khóa hoặc tag bot; placeholder `{user}` (tag người nhắn), `{username}`; cooldown chống spam; giới hạn theo kênh.
- 🛡️ **Chống nuke/raid**: 9 module (ban/kick/join/channel/role/message/spam), phát hiện qua audit log, xử lý cảnh báo → tạm khóa → kick → ban, **tự động khóa kênh khi raid**, cảnh báo real-time tới kênh log, role Mod/Admin + whitelist được miễn trừ. Kèm **báo cáo hoạt động chống nuke hàng ngày** gửi vào kênh log.
- ⌨️ **Prefix + slash**: `!help !ping !prefix !autoreply !antinuke !setlog` và tương đương `/…`.
- 🖥️ **Dashboard**: server list, tổng quan, quản lý rule, chống nuke, cài đặt — áp dụng tự động sau ~30 giây.

## Phát triển

```bash
bun install
bun convex dev --once   # codegen + chạy Convex local (http://127.0.0.1:3210)
bun run dev             # Vite dev server
bun tsc -b --noEmit     # typecheck
```

> Lưu ý: bot process không chạy trong môi trường preview (hosting tĩnh). Chạy `bot/` trên máy/VPS của bạn.
