# Protogon Bot — process Discord

Bot Discord standalone (Node.js + discord.js v14) kết nối tới **cùng một Convex backend** với dashboard web, nên mọi cấu hình chỉnh trên dashboard được bot áp dụng tự động.

## 🆓 Chạy bot MIỄN PHÍ trên Wispbyte (wispbyte.com)

> Dành cho ai không có máy/VPS riêng: bot chạy 24/7 trên cloud của **Wispbyte** — host bot Discord miễn phí: **512 MB RAM, chạy 24/7 không ngủ, không cần thẻ ngân hàng, không có hệ thống coin**. Chỉ cần đăng nhập panel (`wispbyte.com/client`) **1 lần mỗi 2 tuần** để giữ server hoạt động.

### Bước 1 — Đăng ký & tạo server

1. Vào **[wispbyte.com](https://wispbyte.com/)** → **Register / Login** → tạo tài khoản (không cần thẻ).
2. Vào panel **client** tại `wispbyte.com/client` → **Create Server** → chọn loại **Node.js** (gói miễn phí 512 MB RAM) → tạo.

### Bước 2 — Tạo file `.env` trên máy bạn

Trong thư mục `bot/`, tạo file `.env` (nếu chưa có) với nội dung:

```env
DISCORD_TOKEN=<bot token của bạn>
DISCORD_CLIENT_ID=1536232784660795402
CONVEX_URL=https://accomplished-chipmunk-74.convex.cloud
CONVEX_DEPLOY_KEY=<deploy key — xem mục Deploy Keys bên dưới>
```

> ✅ **Deployment production của Protogon đã sẵn sàng**: project `wiothemilo:protogon`, deployment `accomplished-chipmunk-74`, biến `DISCORD_CLIENT_ID` đã được set trên Convex. Bot chỉ cần token + deploy key.

> ⚠️ **Quan trọng**: `CONVEX_URL` phải là URL **truy cập được từ internet** (bản `http://127.0.0.1:3210` chỉ chạy được khi bot nằm chung máy với Convex dev). Xem mục **“Deploy Convex backend lên cloud miễn phí”** bên dưới.

### Bước 3 — Nén & upload

```bash
cd bot
npm install
npm run pack:host    # tạo protogon-bot.zip (gồm cả .env, không gồm node_modules)
```

Rồi trên panel Wispbyte:

1. Tab **Files** → **Upload** file `protogon-bot.zip`.
2. Bấm **Unarchive** (giải nén) — các file tự vào thư mục gốc `/home/container`.
3. Tab **Startup**: đảm bảo lệnh khởi động là **`npm start`** (tương đương `node src/index.js`); nếu panel có mục **Environment**, kiểm tra 4 biến được đọc từ `.env` (file `.env` đã nằm trong zip).
4. Bấm **Start** ở tab **Console** — Wispbyte tự chạy `npm install` rồi khởi động bot. Xem log:
   ```
   ✅ Protogon đã online: Protogon#1234 — 1 server
   ✅ Đã đăng ký 6 slash commands
   ```

> Lưu ý: **đăng nhập `wispbyte.com/client` ít nhất 1 lần mỗi 2 tuần** — nếu không, server free sẽ bị tạm ngừng. Ngoài ra bot chạy 24/7 không ngủ.

## ☁️ Deploy Convex backend lên cloud miễn phí (bắt buộc cho bot trên Wispbyte)

Dashboard web (Freebuff) và bot (Wispbyte) phải trỏ về **cùng một Convex backend**. Backend dev local (`http://127.0.0.1:3210`) chỉ chạy trong workspace, bot trên cloud **không truy cập được** — nên bạn cần đưa backend lên **Convex Cloud** (gói free, không cần thẻ).

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

### Bước 4 — Điền vào Wispbyte

Vào panel bot trên Wispbyte → tab **Files** (biến đã nằm trong `.env` của zip) hoặc **Startup → Environment** (nếu panel có) — đảm bảo 4 biến:

```env
DISCORD_TOKEN=<bot token của bạn>
DISCORD_CLIENT_ID=1536232784660795402
CONVEX_URL=https://accomplished-chipmunk-74.convex.cloud
CONVEX_DEPLOY_KEY=<deploy key ở bước 3>
```

Rồi bấm **Start** — bot sẽ kết nối Convex Cloud và đồng bộ với dashboard.

### Bước 5 — Trỏ dashboard về cùng backend (nếu cần dùng chung dữ liệu)

Để dashboard web hiển thị đúng dữ liệu bot ghi (server, kênh, sự kiện…), dashboard cũng phải dùng **cùng URL Convex** này (biến `VITE_CONVEX_URL` cho bản production của Freebuff). Nếu không, dashboard và bot dùng 2 database riêng biệt.

### Tự động deploy qua GitHub Actions (không cần gõ lệnh) 🔄

Repository đã có sẵn workflow **`.github/workflows/deploy-convex.yml`**: mỗi lần code trong `convex/` được push lên nhánh `main`, GitHub tự chạy `npx convex deploy` — bạn không cần mở terminal.

Chỉ cần làm 1 lần (tổng ~3 phút):

1. **Convex dashboard** → chọn deployment `accomplished-chipmunk-74` → **Settings → Deploy Keys → Generate a deploy key** → đặt tên (VD `github-ci`) → bật quyền **`deployment:deploy`** → Generate → copy chuỗi key (dạng `prod:...|eyJ...`).
2. **GitHub repo** → **Settings → Secrets and variables → Actions → New repository secret** → tên `CONVEX_DEPLOY_KEY` → dán key → Add secret.

Xong! Từ đó push code lên `main` là backend tự cập nhật. Muốn deploy ngay không cần đổi code: vào tab **Actions** của repo → chọn workflow *Deploy Convex backend* → **Run workflow**.

> Cách thủ công (máy có tài khoản Convex): `npx convex login` rồi `npx convex deploy` tại thư mục gốc dự án.

## Lưu ý khi deploy lại code

- Sửa hàm Convex trong `convex/` xong → chạy lại `npx convex deploy` từ máy bạn để cập nhật lên cloud.
- Bot gọi các mutation `bot-writes:*` qua `CONVEX_DEPLOY_KEY` — key nằm trong file `bot/.env` (đã thêm vào `.gitignore`) hoặc trên panel Wispbyte, không commit lên git.
- Khi chạy thử ở local, vẫn dùng `http://127.0.0.1:3210` như cũ — không ảnh hưởng.

## Tối ưu RAM & dung lượng

- Bot **không cache tin nhắn** (giới hạn 0), giới hạn cache thành viên/người dùng (tối đa 200), và tự sweep cache cũ — phù hợp gói 512 MB RAM của Wispbyte.
- `npm run pack:host` loại bỏ `node_modules`, `.git`, `.md` khỏi zip (gồm cả `.env` nếu có) → file chỉ ~20 KB.

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
| `!setlog #kênh` | Đặt kênh log chung (anti nuke/raid) |
| `!backup` \| `!backup now` | Tạo backup server (đẩy lên GitHub của chủ bot) |
| `!backup local` | Tạo backup chỉ lưu trên Convex (không đẩy GitHub) |
| `!backup list` \| `!backuplist` | Danh sách backup của server |
| `!backup restore <số>` \| `!restore <số>` | Khôi phục cấu trúc server từ backup |
| `!backup auto <2-30> \| off` | Bật/tắt tự động backup mỗi N ngày (tối thiểu 2, tối đa 30) |

**Slash commands:** `/help`, `/ping`, `/prefix set`, `/autoreply add|edit|list|remove`, `/antinuke status|on|off|module|unlock|lockdown`, `/backup now|list|restore|auto`, `/setup log-channel|mod-role|admin-role`.

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
- **Hành động đa lựa chọn (dashboard → mỗi module)**: chọn cùng lúc hình phạt thành viên (warn/kick/ban/timeout — bot dùng hình phạt **mạnh nhất**) và hành động dọn tin nhắn:
  - `deleteMessages` — xóa **ngay tin nhắn vi phạm tại thời điểm** bot nhận ra.
  - `purgeMessages` — xóa **hàng loạt mọi tin nhắn liên quan** đến vụ vi phạm (ví dụ: toàn bộ tin spam trong cửa sổ phát hiện, hoặc tin của người bị ban trên các kênh văn bản).
  - Ví dụ: chọn `ban + purgeMessages` = ban người vi phạm và quét sạch tin của họ; chọn `timeout + deleteMessages` = tạm khóa và xóa ngay tin vừa gửi.
- **Khóa kênh khi raid**: khi vượt ngưỡng bất kỳ module nào, bot chặn thành viên gửi tin (và voice) qua overwrite của role @everyone, tự mở lại sau `lockdownMinutes` hoặc khi dùng `/antinuke unlock`. Bot cần quyền **Manage Channels**.
- Chủ server, role có quyền **Administrator**, role **Mod/Admin** đã cấu hình và role nằm trong *whitelist* của module được miễn trừ.

## Backup server → đám mây GitHub

- Dashboard → **Backup server** → bấm **Backup ngay** (tùy chọn đẩy lên GitHub), hoặc dùng lệnh trong Discord: `!backup` / `/backup now`, `!backup list` / `/backup list`, `!backup restore <số>` / `/backup restore <số>`.
- Bot chụp toàn bộ **role** (tên, màu, hoist, mentionable, quyền), **kênh** (danh mục, văn bản, thoại… kèm quyền truy cập từng kênh) và cấu hình cơ bản (prefix, từ ngữ xấu, role mod/admin, kênh log).
- Backup lưu vào Convex (giữ 3 bản mới nhất/server — bản cũ hơn tự bị xóa) và đẩy thành **Gist riêng tư** trên GitHub qua action `backup_github:githubPush` — cần biến `GITHUB_TOKEN` (quyền `gist`) của **chủ sở hữu bot** trong **Keys** của Convex. **Token này dùng chung cho MỌI server** — các owner server khác không cần dán token riêng.
- **Tự động backup định kỳ** (mặc định mỗi 7 ngày khi server mới thêm bot): bật/tắt + chỉnh số ngày (2–30) trong dashboard **Backup server**, hoặc lệnh `!backup auto <2-30|off>` / `/backup auto <số ngày>`. Bot quét mỗi giờ, đã đến hạn thì tự chụp + đẩy lên GitHub của chủ bot.
- Khi server bị nuke/raid phá sập: mời bot vào **server phụ** → dashboard → **Backup** → bấm **Khôi phục vào server này** (hoặc `!backup restore <số>` trong server phụ). Bot tạo lại role (quyền đã được giới hạn theo quyền hiện có của bot), danh mục, kênh + overwrite, rồi áp lại cấu hình với id mới. Các role/kênh có sẵn của server phụ được giữ nguyên.
- Bot quét yêu cầu backup/khôi phục mỗi ~20 giây.

## Hệ thống log — gộp chung kiểu Carl-bot

Log trong Discord chia **2 kênh** (chọn ở dashboard → **Cài đặt → Kênh log**):

| Luồng | Kênh nhận | Định dạng |
| --- | --- | --- |
| 🛡️ **Anti nuke/raid** (ban/kick/join hàng loạt, tạo/xóa kênh/role hàng loạt, webhook/thread, xóa tin hàng loạt) | Kênh log chung (`logChannelId`) | Embed cảnh báo `Protogon · Anti Nuke/Raid` |
| ⚙️ **Auto-mod + lệnh mod thủ công** (từ ngữ xấu, link mời, link độc hại/file nguy hiểm, spam mention, spam ảnh/file, spam tin nhắn, tin dài/blank · ban · timeout · kick · warn · gỡ hình phạt · purge · bot xóa tin) | **Gộp chung 1 kênh** — kênh log hành động mod (`modLogChannelId`; chưa đặt → kênh log chung) | Embed kiểu **Carl-bot**: tiêu đề `⏱️ Timeout | case 30`, dòng `Offender` / `Reason` / `Responsible moderator` + footer `ID: … • 00:49 2/8/26` |

Quy tắc hiển thị trên mỗi embed moderation:
- **Responsible moderator**: bot tự động (auto-mod/anti nuke phạt) → tên bot; mod/owner dùng lệnh thủ công → **tên người dùng lệnh**.
- **Reason**: auto-mod ghi lý do vi phạm cụ thể (vd “sử dụng từ ngữ xấu (giết)”); lệnh thủ công bỏ trống lý do → ghi **“không có lý do”** (không từ chối lệnh).
- **case N**: số case tăng dần của server, hiển thị cả trên embed log lẫn dashboard (Bảng hình phạt).

> Chưa chọn kênh log hành động mod thì toàn bộ log moderation vẫn gửi vào kênh log chung (không mất log). Bot backup gửi thông báo vào kênh hệ thống của server.

## Moderation — thông báo sau khi phạt

- Dashboard → **Moderation** (sidebar) để chỉnh **mức chi tiết embed kiểu Carl-bot** bot gửi sau khi trừng phạt thành viên, riêng cho từng hành động **ban · timeout · warn · kick** — phần xem trước trên web chính là đúng embed bot gửi:
  - `none` — không gửi embed (dashboard vẫn ghi nhận case)
  - `action` — embed chỉ hiển thị `Offender`
  - `reason` — thêm dòng `Reason` (trống → ghi “không có lý do”)
  - `full` — thêm dòng `Responsible moderator` (lệnh mod thủ công hiển thị tên mod; phạt tự động hiển thị tên bot)
- Kênh nhận: `punishNoticeChannelId` → kênh log mod → kênh log chung.
- **Đây là embed duy nhất bot gửi sau khi phạt** — áp dụng cho cả **tự động** (chống nuke / auto-mod) lẫn **thủ công** từ lệnh mod. Purge / xóa tin / gỡ hình phạt luôn hiển thị đầy đủ.
- **Liên kết với lệnh thủ công**: lệnh thủ công (`/mod timeout|kick|ban` và `!timeout|!kick|!ban`) luôn cho phép ghi lý do — **bỏ trống thì log ghi “không có lý do”**, không bị từ chối. Cả log Discord lẫn dashboard (Bảng hình phạt) hiển thị rõ **🛠️ Lệnh mod** (tên mod) hay **⚡ Bot tự động** (auto-mod / anti nuke) kèm **case N**.

## Kiến trúc đồng bộ

- Bot gửi **heartbeat + danh sách server/kênh/role** lên Convex mỗi 60 giây (dashboard dùng để hiển thị).
- Dashboard ghi cấu hình xuống Convex; bot đọc lại sau **tối đa 30 giây** (cache).
- Bot ghi cấu hình qua các mutation riêng (`bot-writes:*`) — chỉ bot có deploy key mới gọi được.

## Báo cáo chống nuke hàng ngày

- Mỗi sự kiện chống nuke bị xử lý được lưu vào Convex (`antinukeEvents`).
- Bot gửi **bản tóm tắt hàng ngày** vào kênh log (~00:00 UTC): tổng sự kiện, số module kích hoạt, chi tiết theo từng module, thủ phạm thường xuyên. Ngày nào không có sự kiện, bot gửi thông báo "server bình yên".
- Bật/tắt trên dashboard (Cài đặt → Báo cáo chống nuke hàng ngày); dashboard cũng hiển thị các sự kiện gần đây ở tab Tổng quan.
