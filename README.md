# Protogon Bot — Auto Reply & Anti Nuke Raid

[![CI — Test & Typecheck](https://github.com/wiothemilo-lang/Autoreply-and-anti-nuke-raid/actions/workflows/ci.yml/badge.svg)](https://github.com/wiothemilo-lang/Autoreply-and-anti-nuke-raid/actions/workflows/ci.yml)

Bot Discord tự động trả lời tin nhắn thành viên theo **từ khóa** hoặc khi bị **tag @mention** (nội dung do bạn tùy chỉnh), hỗ trợ đầy đủ **prefix (`!`) + slash commands**, kèm hệ thống **chống nuke/raid** bật tắt từng phần theo ý mod & owner — tất cả quản lý qua một **dashboard web** tùy chỉnh.

> **Chất lượng**: 23 test suites (~430 assertion, chạy ~10s) · coverage đo bằng c8 (56% dòng / 78% hàm / 61% nhánh — toàn bộ engine chống nuke được phủ test trực tiếp) · ESLint sạch · typecheck sạch · CI chặn merge khi fail · deploy Convex chỉ sau khi test pass (`bun run test` để chạy local).

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
- **Bot** (`bot/`): process Node.js standalone chạy 24/7 (máy bạn hoặc hosting). Đọc/ghi cấu hình qua Convex — dashboard và bot luôn đồng bộ trong ~1 phút.
- **Backend** (`src/convex/`): schema + query/mutation. Mọi ghi dữ liệu từ dashboard được kiểm tra quyền _Manage Guild_ (xác thực qua Discord OAuth); bot dùng các mutation riêng `bot-writes:*` bảo vệ bằng deploy key.

## Bắt đầu

### 1. Tạo ứng dụng Discord

1. Vào [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. Tab **Bot** → bật **Presence**, **Server Members**, **Message Content** intent → **Reset Token** để lấy `BOT_TOKEN`.
3. Lưu **Application ID** (Client ID).

### 2. Cấu hình dashboard (Freebuff)

Điền vào mục **API Keys** của dự án:

| Key                       | Giá trị                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| `DISCORD_CLIENT_ID`       | Application ID ở bước 1 (cần cho đăng nhập + link mời bot)           |
| `CONVEX_URL` (production) | URL deployment Convex khi deploy — set qua `freebuff-deploy env set` |

Chạy preview → **Đăng nhập với Discord** → dán redirect URI `https://<địa chỉ preview>/discord/callback` vào ứng dụng Discord (_OAuth2 → Redirects_; với bản local thêm `http://localhost:5173/discord/callback`).

### 3. Chạy bot

Xem hướng dẫn chi tiết tại [`bot/README.md`](bot/README.md). Tóm tắt:

```bash
cd bot
bun install
bun run start
```

**Không có máy/VPS để chạy bot?** → Dùng **Wispbyte miễn phí** (wispbyte.com — cloud chuyên host bot Discord, không cần thẻ, bot chạy 24/7 không ngủ, chỉ cần đăng nhập panel 1 lần/2 tuần): `cd bot && npm install && npm run pack:host` rồi upload `protogon-bot.zip` theo hướng dẫn trong [`bot/README.md`](bot/README.md) → mục “Chạy bot MIỄN PHÍ trên Wispbyte”.

**Bot trên cloud cần Convex backend công khai?** → Hướng dẫn deploy Convex Cloud miễn phí (`npx convex login` + `npx convex deploy`, lấy URL + Deploy Key): xem [`bot/README.md`](bot/README.md) → mục “Deploy Convex backend lên cloud miễn phí”.

Bot tự đăng ký slash commands và đồng bộ server/kênh/role lên Convex mỗi 60 giây.

### 4. Mời bot & quản lý

- Nhấn **Mời bot** trong dashboard (hoặc dùng link invite tạo từ `DISCORD_CLIENT_ID`).
- Vào server → tab **Auto Reply**: tạo rule từ khóa / @mention với nội dung tùy chỉnh, cooldown, giới hạn kênh.
- Tab **Anti Nuke**: bật tắt toàn bộ hoặc từng module, chỉnh ngưỡng & hình thức xử lý, role miễn trừ.
- Tab **Cài đặt**: prefix, kênh log, role Mod/Admin.
- Tab **Backup server**: bấm **Backup ngay** hoặc bật **tự động backup định kỳ** (2–30 ngày) — bot đẩy backup lên GitHub của chủ bot, chỉ giữ 3 bản mới nhất trong bot.
- Hoặc quản lý trực tiếp trong Discord bằng `!autoreply`, `!antinuke`, `!backup`, `/setup`…

## Tính năng chính

- 🤖 **Auto reply**: kích hoạt bằng từ khóa hoặc tag bot; placeholder `{user}` (tag người nhắn), `{username}`; cooldown chống spam; giới hạn theo kênh.
- 🛡️ **Chống nuke/raid**: **24 module** (ban/kick/join/channel/role/message/spam + biến thể: xóa thread, đổi tên/quyền kênh, sửa role, tự cấp quyền quản trị, gán role/biệt danh hàng loạt, emoji/sticker, bot add, tạo invite, đổi cấu hình server, bot hit-and-run…), phát hiện qua audit log, xử lý cảnh báo → tạm khóa → kick → ban, **tự động khóa kênh khi raid**, cảnh báo real-time tới kênh log, role Mod/Admin + whitelist được miễn trừ. Kèm **báo cáo hoạt động chống nuke hàng ngày** gửi vào kênh log.
- 🧰 **Auto-moderation — 8 module**: spam, mass message, blank noise, mention, badword, attachment, invite, malware — lọc nội dung độc hại theo nhiệt độ vi phạm (warn → timeout → kick → ban).
- 🧠 **Threat Intel — bot tự học**: tải tin an ninh công khai (Reddit security, CISA KEV) **mỗi giờ** (0 token), học từ khóa scam mới dùng miễn phí trong bộ lọc link độc hại; AI tổng hợp ≤ 1 lần/tuần. Theo dõi + học thủ công qua `/research status|learn|history` và `!research`, xem tiến độ trên dashboard → Admin.
- 🚨 **Báo cáo khẩn `/report` + `!report`**: khi có raid/nuke hoặc bot phạt nhầm thành viên, AI (Mimu v2.5) dò hàng trăm tin nhắn gần nhất + dữ liệu phạt để hiểu tình huống và công bố báo cáo rõ ràng cho cả server; mod ghi chú thêm bối cảnh; dashboard có nút bật/tắt cảnh báo khẩn + ping @everyone.
- 🎯 **Raid Intel — thu thập dữ liệu + săn nguồn cơn raid**: bot tự ghi **mẫu dữ liệu huấn luyện** cho mỗi vụ raid/nuke (module, cụm tài khoản, AI verdict); bot + AI phân tích cụm (acc chủ mưu, avatar/username trùng nhau, người tạo invite, kẻ phá hoại trong audit log) để tìm **kẻ đứng sau raid rồi tự ban** — bật/tắt từng phần trên dashboard → Chống nuke/raid → Raid Intel.
- 📱 **Chống raid bằng ứng dụng ngoài (External App Guard)**: phát hiện tấn công bằng **external app / integration** thay vì bot thành viên — đội quân sockpuppet cài app ồ ạt, app giả mạo app nổi tiếng / tên chứa từ khóa scam (nitro/giveaway/boost/free...), app spam @everyone + link mời/link rút gọn/lừa đảo, lặp nội dung giống hệt hoặc **gần giống** (đổi số/emoji/URL để né filter), webhook spam. **AI học hỏi cách raid này và chặn cả biến thể tương tự**: raid → xóa tin/webhook + ban + khóa kênh; còn lại → kick theo cấu hình. Xem danh sách vụ bị chặn (ai, app gì, lúc nào) trên dashboard → Chống nuke/raid → Raid bằng ứng dụng ngoài.
- 📒 **Log kiểu Carl-bot, gộp 2 luồng** (Cài đặt → Kênh log): 🛡️ **Anti nuke/raid** → kênh log chung · ⚙️ **Auto-mod + lệnh thủ công của mod/owner** (ban/timeout/kick/warn/gỡ hình phạt/purge/xóa tin) → **gộp chung 1 kênh log hành động mod** (chưa đặt → kênh log chung), mỗi embed hiển thị `Offender` / `Reason` / `Responsible moderator` + `case N` tăng dần: bot tự động để tên bot, mod dùng lệnh để tên mod, lý do trống ghi **“không có lý do”**.
- ⌨️ **Prefix + slash**: `!help !ping !prefix !autoreply !antinuke !heat !badword !setlog !backup !report !research` và tương đương `/…` (kèm `/backup now|list|restore|auto` để tạo/liệt kê/khôi phục + tự động backup định kỳ server ngay trong Discord).
- ♻️ **Tùy chỉnh khôi phục (Backup server → Tùy chỉnh khôi phục)**: bật/tắt từng phần **role** và **emoji/sticker** khi bot khôi phục — đồng bộ bot ↔ web, áp dụng cho **cả backup Protogon lẫn file backup của bot nuke** (.msc/.json tải lên). Phần tắt sẽ được bỏ qua khi restore; kênh, tin nhắn + media vẫn xử lý bình thường.
- 🖥️ **Dashboard**: server list, tổng quan, quản lý rule, chống nuke, cài đặt — áp dụng tự động sau ~1 phút.

## Kiểm thử & Coverage

```bash
bun run test            # chạy toàn bộ 23 suites (~10s, thoát khác 0 nếu fail)
bun run test:coverage   # chạy test + đo coverage (báo cáo HTML tại coverage/)
```

Coverage được đo bằng [`c8`](https://github.com/bcoe/c8) (V8 native, không phải đo giả): mỗi dòng/hàm/nhánh của `bot/src` bị đánh dấu **đã chạy qua hay chưa** trong lúc test. Con số hiện tại:

| Chỉ số          | Giá trị | Ý nghĩa                                                    |
| --------------- | ------- | ---------------------------------------------------------- |
| Dòng            | 55.8%   | ~7,900/14,150 dòng bot được test chạm tới                  |
| Hàm             | 77.9%   | 78% hàm được **gọi thật** (không chỉ import)               |
| Nhánh (if/else) | 60.6%   | cả hai phía true/false của phần lớn điều kiện đã được kiểm |

**Bản đồ nhiệt theo file** (phần quan trọng nhất):

- ✅ **≥ 85%**: `antinuke/shared` (98%), `externalAppGuard` (96%), `flaggedMessages` (97%), `antinuke/messages` (93%), `filters` (92%), `antinuke/members` (90%), `antinuke/audit` (84%), `antinuke/externalApp` (88%), `threatEngine` (89%), `selfDiagnose` (89%), `caseLog` (100%) — **toàn bộ engine chống nuke (audit / members / messages / externalApp) giờ được phủ test trực tiếp**, đúng chỗ xử lý mọi vụ nuke thật.
- ⚠️ **50–76%**: `antinuke/raidIntel` (69%), `backup` (76%), `util` (75%), `research` (72%), `enforce` (73%), `heat` (67%), `backupUtils` (66%), `hidden` (59%), `tick` (58%) — luồng chính có test nhưng còn nhánh hiếm gặp chưa phủ.
- 🔴 **< 20%**: các file entry-point cần Discord runtime thật (`antinuke/index` 16%, `interactionCreate`, `messageCreate`, `altDetection`) — wiring Discord gateway, phủ qua production smoke test thay vì unit test.

**Chống regress bằng ngưỡng**: `.c8rc.json` đặt ngưỡng tối thiểu (lines 50 / functions 55 / branches 40) — nếu code mới làm rớt coverage xuống dưới ngưỡng, `bun run test:coverage` thất bại, chặn regress trước khi commit.

Coverage **không phải điểm số để đẹp**: nó chỉ ra chính xác nơi thiếu test. Ví dụ: bộ test 3 lớp `audit`/`members`/`messages` viết trong đợt này vừa chạy vừa bắt được **lỗi thật** — owner + whitelistUsers không được miễn khi fetch member thất bại (cache miss sau restart) → chủ server có thể bị ghi sự kiện nuke oan + khóa kênh. Đã vá ngay trong `audit.js` kèm assertion chặn tái diễn.

## Lint, Format & Dependencies

```bash
bun run lint            # ESLint — chặn bug tĩnh trước cả khi chạy test
bun run lint:fix        # tự sửa những gì sửa được
bun run format          # Prettier — format toàn repo
bun run format:check    # CI dùng lệnh này để chặn code chưa format
```

**ESLint là lá chắn thứ hai (sau typecheck, trước test).** Rule `no-undef` trên phần bot CommonJS chặn chính xác loại bug nguy hiểm nhất với bot runtime: **gọi biến/hàm chưa import** — crash xảy ra đúng lúc raid thật xảy ra, ngay cả khi test vẫn xanh (test không đụng nhánh đó). Bằng chứng ngay ngày cấu hình: `no-undef` bắt được **3 bug crash thật** (biến `reason`/`channel`/`store` không tồn tại trong `antinuke/audit.js`, `hidden.js`, `research.js` — tàn dư của đợt tách file) và 1 **bug biến che khuất hàm cùng tên** trong `backup.js` (`pushToGithub` boolean option đè hàm `pushToGithub` — mọi backup đẩy GitHub sẽ TypeError).

**Dependabot** (`.github/dependabot.yml`) quét weekly: root `bun`, `bot/` (discord.js, convex) và `github-actions` — tự tạo PR cập nhật, group các bump minor/patch thành 1 PR. Bot bảo mật không được để deps cũ.

**Thứ tự gate trong CI**: `lint` (ESLint + Prettier) → `test` (23 suites + coverage + typecheck) → `deploy` Convex production. Job sau chỉ chạy khi job trước pass.

## Phát triển

```bash
bun install
bun convex dev --once   # codegen + chạy Convex local (http://127.0.0.1:3210)
bun run dev             # Vite dev server
bun tsc -b --noEmit     # typecheck
```

> Lưu ý: bot process không chạy trong môi trường preview (hosting tĩnh). Chạy `bot/` trên máy/VPS của bạn.
