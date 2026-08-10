# Wio Bot — process Discord

Bot Discord standalone (Node.js + discord.js v14) kết nối tới **cùng một Convex backend** với dashboard web, nên mọi cấu hình chỉnh trên dashboard được bot áp dụng tự động.

## Yêu cầu

- Node.js >= 18 (hoặc Bun)
- Một ứng dụng Discord (bot) đã tạo tại [Discord Developer Portal](https://discord.com/developers/applications)
- Convex backend đang chạy (bản dev local `http://127.0.0.1:3210`, hoặc deployment production)

## Cài đặt

```bash
cd bot
cp .env.example .env   # tạo file .env và điền giá trị bên dưới
bun install            # hoặc npm install
```

### Biến môi trường (file `.env`)

| Biến | Bắt buộc | Mô tả |
| --- | --- | --- |
| `DISCORD_TOKEN` | ✅ | Bot token — Developer Portal → *Bot* → *Reset Token* |
| `DISCORD_CLIENT_ID` | ✅ | Application ID (Client ID) — dùng để đăng ký slash commands |
| `CONVEX_URL` | ✅ | URL Convex. Dev local: `http://127.0.0.1:3210`. Production: URL deployment của bạn |
| `CONVEX_DEPLOY_KEY` | production | Deploy key (quyền ghi) — Convex dashboard → *Deployments → Keys*. Bản dev local không cần |
| `AUTO_REGISTER_COMMANDS` | ❌ | `true` (mặc định) để tự đăng ký slash commands khi bot khởi động |

### Bật các Privileged Intents trong Developer Portal

Vào ứng dụng → **Bot** → bật 3 mục:

- **Presence Intent**
- **Server Members Intent** (cần cho phát hiện raid thành viên)
- **Message Content Intent** (cần cho lệnh prefix và auto reply theo từ khóa)

### Chạy bot

```bash
bun run start          # hoặc npm start
```

Muốn đăng ký lại slash commands thủ công: `bun run register`.

## Lệnh có sẵn

**Prefix (`!`)** — đổi bằng `!prefix set <kí tự>`:

| Lệnh | Chức năng |
| --- | --- |
| `!help` | Danh sách lệnh |
| `!ping` | Kiểm tra độ trễ |
| `!prefix [set <prefix>]` | Xem / đổi prefix |
| `!autoreply list` | Danh sách rule |
| `!autoreply add <tên> keyword <từ khóa> \| <nội dung>` | Thêm rule theo từ khóa |
| `!autoreply add <tên> mention \| <nội dung>` | Thêm rule kích hoạt khi tag bot |
| `!autoreply remove <tên>` | Xóa rule |
| `!antinuke on \| off \| status` | Bật / tắt / xem chống nuke |
| `!antinuke module <tên> <on\|off>` | Bật tắt từng module |
| `!antinuke unlock` | Mở khóa kênh ngay lập tức |
| `!lockdown on \| off` | Bật/tắt khóa kênh tự động khi raid |
| `!setlog #kênh` | Đặt kênh log |

**Slash commands:** `/help`, `/ping`, `/prefix set`, `/autoreply add|list|remove`, `/antinuke status|on|off|module|unlock|lockdown`, `/setup log-channel|mod-role|admin-role`.

## Module chống nuke

| Module | Phát hiện | Mặc định |
| --- | --- | --- |
| `massBan` | Ban hàng loạt | 5 lượt/10s → ban |
| `massKick` | Kick hàng loạt | 5 lượt/10s → kick |
| `massJoin` | Raid thành viên | 8 người/10s → kick |
| `massChannelCreate` | Tạo kênh spam | 3 lượt/10s → ban |
| `massChannelDelete` | Xóa kênh hàng loạt | 3 lượt/10s → ban |
| `massRoleCreate` | Tạo role spam | 3 lượt/10s → ban |
| `massRoleDelete` | Xóa role hàng loạt | 3 lượt/10s → ban |
| `massMessageDelete` | Xóa tin hàng loạt | 3 lượt/10s → cảnh báo |
| `spam` | Spam tin nhắn | 6 tin/10s → tạm khóa 5 phút |

- Thủ phạm được xác định qua **Audit Log**, ngưỡng + hình thức xử lý (cảnh báo/kick/ban/tạm khóa) chỉnh được trong dashboard hoặc lệnh bot.
- **Khóa kênh khi raid**: khi vượt ngưỡng bất kỳ module nào, bot chặn thành viên gửi tin (và voice) qua overwrite của role @everyone, tự mở lại sau `lockdownMinutes` hoặc khi dùng `/antinuke unlock`. Bot cần quyền **Manage Channels**.
- Chủ server, role có quyền **Administrator**, role **Mod/Admin** đã cấu hình và role nằm trong *whitelist* của module được miễn trừ.

## Kiến trúc đồng bộ

- Bot gửi **heartbeat + danh sách server/kênh/role** lên Convex mỗi 60 giây (dashboard dùng để hiển thị).
- Dashboard ghi cấu hình xuống Convex; bot đọc lại sau **tối đa 30 giây** (cache).
- Bot ghi cấu hình qua các mutation riêng (`bot-writes:*`) — chỉ bot có deploy key mới gọi được.

## Báo cáo chống nuke hàng ngày

- Mỗi sự kiện chống nuke bị xử lý được lưu vào Convex (`antinukeEvents`).
- Bot gửi **bản tóm tắt hàng ngày** vào kênh log (~00:00 UTC): tổng sự kiện, số module kích hoạt, chi tiết theo từng module, thủ phạm thường xuyên. Ngày nào không có sự kiện, bot gửi thông báo "server bình yên".
- Bật/tắt trên dashboard (Cài đặt → Báo cáo chống nuke hàng ngày); dashboard cũng hiển thị các sự kiện gần đây ở tab Tổng quan.
