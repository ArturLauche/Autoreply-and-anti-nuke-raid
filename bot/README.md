# Protogon Bot — process Discord

Bot Discord standalone (Node.js + discord.js v14) kết nối tới **cùng một Convex backend** với dashboard web, nên mọi cấu hình chỉnh trên dashboard được bot áp dụng tự động.

## 🆓 Chạy bot MIỄN PHÍ trên Bot-Hosting.net (không cần tiền, không cần thiết bị)

> Dành cho ai không có máy/VPS riêng: bot chạy 24/7 trên cloud của **Bot-Hosting.net** — dịch vụ chuyên host bot Discord, gói miễn phí **không cần thẻ ngân hàng**, đăng nhập bằng tài khoản Discord.

### Bước 1 — Đăng ký & nhận coin

1. Vào **[bot-hosting.net](https://bot-hosting.net)** → **Login** → đăng nhập bằng tài khoản Discord (không cần thẻ).
2. Vào mục **Earn coins** trên dashboard → làm captcha để nhận coin miễn phí mỗi ngày (gói free vận hành bằng hệ thống coin — cần coin để giữ server chạy).

### Bước 2 — Tạo server & cài biến môi trường

1. **Create Server** → chọn **Node.js** → chọn gói miễn phí (RAM thường 256–512 MB, đủ cho bot này ở server nhỏ) → chọn chu kỳ thanh toán (weekly).
2. Vào panel server → tab **Startup** → phần **Environment Variables** → thêm:

```env
DISCORD_TOKEN=<bot token của bạn>
DISCORD_CLIENT_ID=1536232784660795402
CONVEX_URL=https://accomplished-chipmunk-74.convex.cloud
CONVEX_DEPLOY_KEY=<deploy key — hỏi quản trị / lấy ở mục Deploy Keys bên dưới>
```

> ✅ **Deployment production của Protogon đã sẵn sàng** (tạo ngày 10/08/2026):
> project `wiothemilo:protogon`, deployment `accomplished-chipmunk-74`, biến `DISCORD_CLIENT_ID` đã được set trên deployment. Bot chỉ cần token + deploy key.

> ⚠️ **Quan trọng**: `CONVEX_URL` phải là URL **truy cập được từ internet** (bản `http://127.0.0.1:3210` chỉ chạy được khi bot nằm chung máy với Convex dev). Xem mục **“Deploy Convex backend lên cloud miễn phí”** bên dưới.

### Bước 3 — Nén & upload

```bash
cd bot
npm install
npm run pack:host    # tạo ra protogon-bot.zip (không gồm node_modules/.env)
```

Rồi:

1. Vào panel server → tab **Files** → upload file `protogon-bot.zip`.
2. Bấm **Unarchive** (giải nén) file zip → mở thư mục vừa tạo → chọn tất cả file bên trong → **Move** lên thư mục gốc `/home/container` (nếu để lồng trong thư mục con, bot sẽ báo lỗi không tìm thấy module).
3. Vào tab **Startup**: đảm bảo lệnh khởi động chạy đúng entry point — với bot này dùng **`npm start`** (tương đương `node src/index.js`).
4. Bấm **Start** ở tab Console — Bot-Hosting tự chạy `npm install` rồi khởi động bot.

> Lưu ý: gói miễn phí cần **đủ coin** khi tới chu kỳ thanh toán, nếu hết coin bot sẽ bị tạm ngừng — vào trang Earn coins nhận coin định kỳ là duy trì được 24/7.

## ☁️ Deploy Convex backend lên cloud miễn phí (bắt buộc cho bot trên Bot-Hosting.net)

Dashboard web (Freebuff) và bot (Bot-Hosting.net) phải trỏ về **cùng một Convex backend**. Backend dev local (`http://127.0.0.1:3210`) chỉ chạy trong workspace, bot trên cloud **không truy cập được** — nên bạn cần đưa backend lên **Convex Cloud** (gói free, không cần thẻ).

> **Gói free Convex**: 1 triệu function calls/tháng, 0.5 GB database, 1 GB file storage — thoải mái cho bot này.

### Bước 1 — Tạo tài khoản Convex

1. Vào **[convex.dev](https://www.convex.dev)** → **Get Started / Sign up** → đăng ký bằng tài khoản GitHub hoặc email (không cần thẻ ngân hàng).
2. Sau khi vào dashboard, tạo project mới (hoặc để CLI tự tạo — xem bước 2).

### Bước 2 — Đăng nhập CLI & deploy từ thư mục dự án

Mở terminal **tại thư mục gốc dự án** (nơi có `convex.json`) rồi chạy:

```bash
npx convex login          # mở trình duyệt đăng nhập tài khoản Convex
npx convex deploy         # đưa toàn bộ hàm + schema trong convex/ lên Convex Cloud
```

- `login` mở trình duyệt để xác thực (1 lần duy nhất).
- `deploy` tự đọc `convex.json` (hàm ở thư mục `convex/`), kiểm tra type, bundle và đưa lên **production deployment** — chạy được ngay, 24/7 miễn phí.

### Bước 3 — Lấy URL deployment & Deploy Key

1. Vào **[dashboard.convex.dev](https://dashboard.convex.dev)** → chọn project của bạn.
2. **URL deployment**: trang **Settings → URL and Deploy Key** hiển thị URL dạng `https://<tên>.convex.cloud` — đây là `CONVEX_URL` dùng cho client (chú ý: dùng **`.convex.cloud`**, không phải `.convex.site` — `.convex.site` chỉ dành cho HTTP routes tùy chỉnh, client gọi API ở `.convex.cloud`).
3. **Deploy Key**: vào **Settings → Deploy Keys** (hoặc *Keys*) → **Generate a deploy key** → đặt tên (VD `bot`) → copy chuỗi key — đây là `CONVEX_DEPLOY_KEY` (cho bot quyền ghi dữ liệu).

### Bước 4 — Điền vào Bot-Hosting.net

Vào panel bot trên Bot-Hosting.net → tab **Startup → Environment Variables** → thêm:

```env
DISCORD_TOKEN=<bot token của bạn>
DISCORD_CLIENT_ID=1536232784660795402
CONVEX_URL=https://<tên-dự-án>.convex.site
CONVEX_DEPLOY_KEY=<deploy key ở bước 3>
```

Rồi bấm **Start** — bot sẽ kết nối Convex Cloud và đồng bộ với dashboard.

### Bước 5 — Trỏ dashboard về cùng backend (nếu cần dùng chung dữ liệu)

Để dashboard web hiển thị đúng dữ liệu bot ghi (server, kênh, sự kiện…), dashboard cũng phải dùng **cùng URL Convex** này (biến `VITE_CONVEX_URL` cho bản production của Freebuff). Nếu không, dashboard và bot dùng 2 database riêng biệt.

## Lưu ý khi deploy lại code

- Sửa hàm Convex trong `convex/` xong → chạy lại `npx convex deploy` từ máy bạn để cập nhật lên cloud.
- Bot gọi các mutation `bot-writes:*` qua `CONVEX_DEPLOY_KEY` — key chỉ nằm trong panel Bot-Hosting, không commit lên git.
- Khi chạy thử ở local, vẫn dùng `http://127.0.0.1:3210` như cũ — không ảnh hưởng.

## Tối ưu RAM & dung lượng

- Bot **không cache tin nhắn** (giới hạn 0), giới hạn cache thành viên/người dùng (tối đa 200), và tự sweep cache cũ — phù hợp gói 256–512 MB RAM của Bot-Hosting.net.
- `npm run pack:host` loại bỏ `node_modules`, `.env`, `.md` khỏi zip → file chỉ ~20 KB.

## Yêu cầu

- Node.js >= 18 (hoặc Bun)
- Một ứng dụng Discord (bot) đã tạo tại [Discord Developer Portal](https://discord.com/developers/applications)
- Convex backend đang chạy (bản dev local `http://127.0.0.1:3210`, hoặc deployment production)

## Cài đặt

```bash
cd bot
# tạo file .env và điền giá trị (xem bảng biến môi trường bên dưới)
bun install            # hoặc npm install
```

### Biến môi trường (file `.env`)

| Biến | Bắt buộc | Mô tả |
| --- | --- | --- |
| `DISCORD_TOKEN` | ✅ | Bot token — Developer Portal → *Bot* → *Reset Token* |
| `DISCORD_CLIENT_ID` | ✅ | Application ID (Client ID) — dùng để đăng ký slash commands |
| `CONVEX_URL` | ✅ | URL Convex. Dev local: `http://127.0.0.1:3210`. Production: `https://<tên-deployment>.convex.cloud` |
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

**Slash commands:** `/help`, `/ping`, `/prefix set`, `/autoreply add|edit|list|remove`, `/antinuke status|on|off|module|unlock|lockdown`, `/setup log-channel|mod-role|admin-role`.

> **Ai được tạo/sửa auto reply?** — Mod (quyền Manage Guild), Administrator, **hoặc** người có role **Mod/Admin** được cấu hình qua `/setup mod-role` / `/setup admin-role`. Chạy `/autoreply add` với tên rule đã tồn tại = cập nhật lại rule đó.

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
