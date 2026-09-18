# OpenCode trên VPS + Kiira AI + T3 Code trên điện thoại

> Viết cho người mới — đi từng bước, giải thích thuật ngữ ngay tại chỗ.
> Thời gian: ~20 phút. Yêu cầu: VPS đã chạy bot Protogon (xem `bot/VPS-DEPLOY.md`).

---

## Phần 1 — Cài OpenCode trên VPS (5 phút)

OpenCode là "trợ lý AI chạy trong terminal": bạn gõ yêu cầu bằng tiếng Việt, nó
đọc code, sửa file, chạy test và commit thay đổi thay bạn — nhưng vẫn nằm trong
giới hạn an toàn do repo quy định (xem `AGENTS.md` + `opencode.json`).

### 1.1. SSH vào VPS và chạy script cài sẵn của repo

```bash
ssh root@IP-VPS-CỦA-BẠN
cd /root/Autoreply-and-anti-nuke-raid   # hoặc thư mục repo bạn đã clone
git pull                                 # lấy AGENTS.md + opencode.json mới nhất
sh ./scripts/setup-vps-agent.sh
```

Script tự làm 4 việc: kiểm tra Bun/Node, cài OpenCode, chép cấu hình permission
an toàn vào `~/.config/opencode/opencode.json` (KHÔNG đè file có sẵn), và xác
nhận `AGENTS.md` đã nằm ở root repo.

> Nếu `~/.config/opencode/opencode.json` đã tồn tại từ lần cài cũ — hãy mở ra và
> đảm bảo phần `bash` có: `"git add *": "allow"`, `"git commit *": "allow"` và
> `"git push *": "allow"` (chủ bot đã bật push tự do — agent tự đẩy sau khi
> kiểm chứng xanh; muốn siết lại thì đổi thành "deny").

### 1.2. Mở OpenCode lần đầu

```bash
cd /root/Autoreply-and-anti-nuke-raid
opencode
```

Lần đầu chạy, OpenCode hỏi chọn provider/model — bỏ qua bước này lúc đầu, mình
sẽ nạp key Kiira AI ở Phần 2. Nếu nó bắt buộc chọn, chọn **Other** rồi bấm Esc.

### 1.3. Kiểm tra agent đã hiểu luật repo

Gõ thử trong OpenCode:

```
git status
```

Agent sẽ chạy được. Thử tiếp một lệnh nguy hiểm (nó phải TỪ CHỐI):

```
git push origin main
```

Nếu agent hỏi xác nhận hoặc từ chối → cấu hình an toàn hoạt động đúng.

---

## Phần 2 — Nạp API key Kiira AI vào OpenCode (5 phút)

Kiira AI (kiraai.vn) cấp **30 triệu tokens miễn phí mỗi ngày** qua API tương
thích OpenAI. Bot Protogon đã tích hợp sẵn Kiira làm provider dự phòng (xem
`bot/src/ai.js`), giờ mình cho OpenCode dùng chung key đó.

### 2.1. Lấy key Kiira

1. Đăng nhập trang quản lý của Kiira AI (nơi bạn đã đăng ký gói free)
2. Vào mục **API Keys** → **Create key** → đặt tên (vd: `opencode-vps`)
3. Copy key (kiểu `kira-...` hoặc chuỗi dài) — **chỉ hiện 1 lần**
4. Ghi lại **Base URL** của gói: mặc định là `https://kiraai.vn/api/v1`

### 2.2. Đăng ký provider trong OpenCode

Trong giao diện OpenCode đang mở, gõ:

```
/connect
```

- Danh sách hiện ra → chọn **Other** (provider tùy chỉnh)
- Nhập **API key** vừa copy → Enter

Key được lưu an toàn tại `~/.local/share/opencode/auth.json` (không nằm trong
repo, không bao giờ được commit).

### 2.3. Khai báo model trong opencode.json

Mở file cấu hình:

```bash
nano ~/.config/opencode/opencode.json
```

Thêm khối `provider` vào **cùng cấp** với `permission` (giữ nguyên phần cũ):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "kiira": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Kiira AI",
      "options": {
        "baseURL": "https://kiraai.vn/api/v1"
      },
      "models": {
        "deepseek-v4.1-flash": {
          "name": "DeepSeek v4.1 Flash"
        }
      }
    }
  },
  "model": "kiira/deepseek-v4.1-flash",
  "small_model": "kiira/deepseek-v4.1-flash",
  "permission": { ... giữ nguyên ... }
}
```

Giải thích từng dòng:

| Dòng | Ý nghĩa |
|---|---|
| `"npm": "@ai-sdk/openai-compatible"` | Kiira nói "giọng" OpenAI — dùng bộ kết nối tương thích |
| `"baseURL"` | Địa chỉ API của Kiira (chính là giá trị `KIRA_BASE_URL` trong `bot/.env` của bot) |
| `"models"` | ID model phải đúng tên Kiira đặt. Nếu không chắc, thử query danh sách: `curl -H "Authorization: Bearer KEY" https://kiraai.vn/api/v1/models` |
| `"model"` | Model mặc định OpenCode dùng cho việc code |

Lưu file (Ctrl+O, Enter) rồi thoát (Ctrl+X). Khởi động lại OpenCode.

### 2.4. Kiểm tra

Trong OpenCode:

```
/models
```

→ chọn **Kiira AI / DeepSeek v4.1 Flash** nếu chưa là mặc định. Hỏi thử:

```
Đọc file bot/src/ai.js và tóm tắt 5 dòng đầu tiên
```

Agent trả lời được = key hoạt động.

### 2.5. (Nên làm) Nạp key Kiira cho luôn cho bot dùng chung

Key OpenCode và key bot là HAI nơi riêng biệt. Nếu muốn bot cũng dùng Kiira
(30M tokens/ngày miễn phí cho research/học hỏi), thêm vào `bot/.env` trên VPS:

```bash
echo 'KIRA_API_KEY=KEY-CỦA-BẠN' >> bot/.env
pm2 restart protogon   # hoặc lệnh restart bot bạn đang dùng
```

> ⚠️ KHÔNG paste key vào chat với agent, KHÔNG commit file .env — agent đã bị
> chặn đọc file này bởi `opencode.json`. Khi cần giá trị mới, bạn tự sửa env.

---

## Phần 3 — T3 Code trên điện thoại (10 phút)

T3 Code (t3.codes) là "bộ điều khiển agent" mã nguồn mở của Theo (t3dotgg):
chạy một server nhỏ trên VPS, rồi điều khiển từ **app điện thoại (iOS/Android),
web hoặc desktop**. Nó không thay OpenCode — nó điều khiển OpenCode (và Codex,
Claude Code…) từ xa. Bạn ra ngoài, mở điện thoại ra là bảo agent sửa code, xong
nó commit vào repo luôn.

### 3.1. Cài T3 Code trên VPS (+ sửa lỗi "không có lệnh t3")

Vẫn trong SSH:

```bash
curl -fsSL https://t3.codes/install.sh | sh
```

**Lỗi thường gặp ngay bước này:** gõ `t3` báo `command not found`. Lý do: trình
cài đặt đặt lệnh vào `~/.local/bin` — thư mục này chưa nằm trong PATH của VPS.
Sửa một dòng:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
t3 --version   # phải in ra số phiên bản
```

**Mẹo khi làm từ điện thoại:** gõ TỪNG lệnh một, Enter xong mới gõ lệnh kế —
paste cả khối hay bị dính dòng (ví dụ thành `~/.bashrc.bashrc`) làm hỏng đường
dẫn. Nếu vẫn `command not found`, kiểm tra binary có tồn tại thật không:

```bash
ls /root/.local/bin
```

- Có `t3` trong danh sách → chỉ là PATH: chạy `export PATH=/root/.local/bin:$PATH`
  rồi `t3 --version` (hiệu lực ngay trong phiên). Lưu vĩnh viễn vào `.profile`
  (SSH login đọc file này):
  `echo 'export PATH=/root/.local/bin:$PATH' >> /root/.profile`
- Không có / báo "No such file or directory" → lần cài chưa thành công: chạy lại
  `curl -fsSL https://t3.codes/install.sh | sh` và ĐỌC dòng cuối nó in ra — lỗi
  tải (mạng chặn GitHub) thì thử `wget -qO- https://t3.codes/install.sh | sh`,
  thiếu công cụ thì `apt-get install -y tar curl` rồi cài lại.

### 3.2. Nối điện thoại với VPS — chọn 1 trong 2 cách

> Lỗi hay gặp trên màn "Add Environment" của app: ô HOST phải là **địa chỉ VPS**
> (IP hoặc domain), ô Pairing code là **mã do VPS phát ra** — KHÔNG phải handle
> mạng xã hội. Nhập sai → app thử mở `https://handle-.../.well-known/t3/environment`
> và báo "Failed to fetch remote environment".

**Cách A — T3 Connect (KHUYÊN DÙNG: chạy được qua mọi mạng 4G/WiFi, không cần mở port trên router):**

```bash
# Trên VPS:
t3 connect
```

1. Nó in ra một **link đăng nhập + mã ngắn** — mở link đó trên trình duyệt
   (điện thoại hay máy tính đều được), đăng nhập tài khoản T3, xác nhận mã
   khớp rồi bấm Approve.

   **Chạy qua SSH/không có trình duyệt trên VPS: bấm `H` (headless mode).**
   Nó đổi sang "Device flow": in link dạng
   `https://accounts.t3.codes/device?user_code=XXXX-XXXX` + mã xác nhận — mở
   link trên máy có trình duyệt, đăng nhập, nhập/xác nhận mã, Approve. Rồi
   **quay lại terminal ĐỢI** — dòng "Waiting for approval" tự đổi thành
   connected trong ít phút; **đừng Ctrl+C** vội. Link `app.t3.codes/connect`
   chỉ dùng khi mở ngay trên máy chạy T3.

   Mã `XXXX-XXXX` là mã xác nhận tài khoản trên trang duyệt — KHÔNG phải
   pairing code để điền vào app
2. Mở app T3 Code trên điện thoại → đăng nhập **CÙNG tài khoản** → environment
   VPS tự xuất hiện trong danh sách, không cần điền host/code tay
3. Khi được hỏi chạy nền, chọn yes (hoặc tự chạy `t3 service install`)

> ⚠️ **Sau khi bấm Allow, trình duyệt có nhảy ra trang lỗi
> `127.0.0.1:34338 … ERR_CONNECTION_REFUSED` — đó là BÌNH THƯỜNG, đừng lo.**
> Trang đó là OAuth callback về localhost của máy MỞ LINK (điện thoại), nơi
> không có gì chạy. Docs chính thức ghi rõ: "The CLI continues on its own, so
> you do not need to forward an OAuth callback port" — VPS vẫn nhận ủy quyền
> đầy đủ. Quay lại terminal VPS xem dòng "connected" là được. Tương tự,
> **đừng** điền `127.0.0.1` vào ô HOST của app (loopback chỉ tới chính chiếc
> điện thoại → "Failed to fetch remote environment"). Cách A không bao giờ cần
> màn "Add Environment" — chỉ cần đăng nhập đúng tài khoản.

Kiểm tra trạng thái bất cứ lúc nào: `t3 connect status` (kèm đó
`t3 service status` để xác nhận server nền đang chạy). Chưa thấy environment
trên app dù đã Approve: (1) kiểm tra app đăng nhập ĐÚNG tài khoản Google vừa
duyệt; (2) `t3 connect status` trên VPS — nếu chưa login, chạy lại `t3 connect`
và làm trọn luồng headless phía trên; (3) bảo đảm server nền đang chạy
(`t3 service status` → không chạy thì `t3 service install`).

> ⚠️ **VPS đăng nhập root**: `t3 service install` có thể từ chối vì thiếu
> systemd user-session (dòng cảnh báo "do not run T3 with sudo"). Khi đó chạy
> server trong **tmux** để sống sót khi đóng SSH:
>
> ```bash
> apt-get install -y tmux
> tmux new -s t3        # vào phiên riêng
> t3 serve              # chạy server; tắt màn = Ctrl+B rồi nhấn D (detach)
> tmux attach -t t3     # quay lại phiên sau này
> ```
>
> Cảnh báo `ping_group_range`/ICMP của cloudflared khi tunnel lên là vô hại —
> chỉ mất tính năng ping qua tunnel, mọi thứ khác vẫn hoạt động. Nếu T3 Code
> báo thiếu agent (vd "Claude Agent CLI health check failed" là vì chưa cài
> Claude Code) → bật provider **OpenCode** đã cài ở Phần 1 trong
> Settings → Providers của app.

**Cách B — Pairing QR (dùng khi điện thoại và VPS trong cùng mạng LAN, hoặc cả
hai đã joined Tailscale):**

```bash
# Trên VPS — chạy server nền 24/24 rồi phát mã ghép nối:
t3 service install
t3 pair
```

- Màn hình in ra **QR code + URL + mã** dạng `xxx-yyy-zzz`
- Trên app điện thoại: **Settings → Environments → Add environment** → **quét
  QR** (nhanh nhất), hoặc điền tay:
  - HOST: địa chỉ VPS mà điện thoại với tới được (IP LAN `192.168.x.x`, IP
    Tailscale `100.x.x.x`, hoặc domain HTTPS)
  - PAIRING CODE: mã vừa in
- Qua Tailscale HTTPS (mã hóa từ đầu tới cuối): `t3 pair --tailscale` → link
  dạng `https://tên-máy.tailXXXX.ts.net/`

> Mỗi máy điện thoại mới cần một link pair mới — link một-lần, coi như mật khẩu,
> đừng chụp màn hình gửi ai.

### 3.3. Dùng thử từ điện thoại

1. Mở app → chọn environment VPS
2. Tạo task mới, gõ: `bun run test` → agent chạy test trên VPS, bạn xem kết
   quả trực tiếp trên điện thoại
3. Thử một việc thật: `Sửa lỗi X trong panel Y, chạy test rồi commit + push` —
   agent sửa, kiểm chứng xanh rồi tự commit + push (push tự do đã được bật;
   vẫn cấm reset/clean/rebase và đọc secret)

### 3.4. Ai cần gì?

| Vai | Công cụ | Địa chỉ |
|---|---|---|
| Viết code trên VPS | OpenCode (terminal) | `opencode` trong SSH |
| Điều khiển từ điện thoại | T3 Code app/web | Play Store / App Store / app.t3.codes |
| Bot Discord | Process bot (Bun) | `pm2` trên VPS |
| Dashboard | Freebuff (đang dùng) | protogon.freebuff.app |

---

## Phần 4.5 — Chống chập chờn Kiira AI (retry proxy)

Lỗi `AI service stream failed: The AI model service is temporarily unavailable`
là gateway Kiira trả 5xx/429 thoáng qua — OpenCode không có retry tích hợp nên
phiên bị ngắt. Repo có sẵn **retry proxy** (`scripts/kiira-retry-proxy.mjs`):
proxy nhỏ chạy tại `127.0.0.1:8787` trên VPS, tự thử lại lỗi tạm thời với
backoff 1s→2s→4s trước khi chịu báo lỗi; lỗi cứng (401 sai key, 400 sai request)
chuyển thẳng ngay. Proxy **không đọc API key** — chỉ chuyển tiếp header.

Chạy bền (tmux, sống khi đóng SSH):

```bash
tmux new -d -s kiira 'bun /root/Autoreply-and-anti-nuke-raid/scripts/kiira-retry-proxy.mjs'
curl http://127.0.0.1:8787/__health   # {"ok":true,...} là đang chạy
```

Rồi đổi `baseURL` trong `~/.config/opencode/opencode.json` từ
`https://kiraai.vn/api/v1` → `http://127.0.0.1:8787` — từ đó OpenCode nói
chuyện với proxy, proxy chống chập cho. Xem log proxy:
`tmux attach -t kiira` (thoát: Ctrl+B rồi chữ `d`). Tùy chỉnh qua env:
`KIRA_PROXY_PORT` (8787), `KIRA_PROXY_RETRIES` (3), `KIRA_PROXY_TIMEOUT_MS`
(120000), `KIRA_UPSTREAM` (https://kiraai.vn/api/v1).

## Phần 4 — Nâng cấp OpenCode giống Freebuff (đã có sẵn trong repo)

Repo đi kèm bộ nâng cấp giúp OpenCode làm việc kỷ luật và an toàn như Freebuff:

| Thành phần | Vị trí | Công dụng |
|---|---|---|
| `/verify` | `.opencode/commands/verify.md` | Chạy đủ bộ kiểm chứng (test + typecheck + lint), báo kết quả số — ranh giới "xong việc" |
| `/fix <mô tả>` | `.opencode/commands/fix.md` | Sửa bug theo quy trình: tái hiện → gốc rễ → vá → test chặn tái diễn |
| `/ship` | `.opencode/commands/ship.md` | Hoàn tất phiên: kiểm chứng → commit chọn lọc (không push) → báo cáo |
| `/review` | `.opencode/commands/review.md` | Review diff/code theo 5 lớp như senior reviewer (chỉ nhận xét, không sửa) |
| Guardrails | `.opencode/plugins/guardrails.js` | Chặn chủ động lệnh bash đọc secret; nhắc lại hợp đồng AGENTS.md khi session dài bị nén |
| Hộp lịch sử | `.opencode/plugins/session-history.js` + `/history` | Ghi mỗi phiên vào hộp JSONL, tự dọn sau TTL (mặc định 14 ngày) — xem bằng lệnh `/history` |

Bộ này nằm trong repo nên **ai clone repo cũng tự có** — không cần cài thêm gì.
Ngoài ra `opencode.json` đã bật `autoupdate` (tự cập nhật OpenCode) và tắt
`share` (không tạo link chia sẻ session công khai).

> Cập nhật OpenCode thủ công bất cứ lúc nào: `opencode upgrade`.
>
> **Hộp lịch sử làm việc**: mỗi phiên của agent được ghi tóm tắt vào
> `~/.config/opencode/history/sessions.jsonl` (thời gian, tên phiên, thư mục,
> trạng thái). Sau TTL ngày mục cũ tự dọn mỗi khi ghi mục mới — không cần cron.
> Đổi hạn giữ: sửa `AGENT_HISTORY_TTL_DAYS` trong `opencode.json` (số ngày;
> `0` = giữ vô hạn, tắt hẳn dọn). Xem lại lịch sử bằng lệnh `/history`
> trong OpenCode, hoặc đọc thẳng file. Lịch sử chỉ chứa metadata — không bao
> giờ ghi nội dung tin nhắn hay secret.

## Xử lý sự cố

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| OpenCode không thấy model Kiira | Sai baseURL hoặc ID model | Kiểm tra lại `opencode.json`, thử `curl .../models` với key để lấy đúng ID |
| `git commit` bị từ chối trong OpenCode | File `~/.config/opencode/opencode.json` cũ chưa có rule `git add/commit: allow` | Merge lại từ `opencode.json` trong repo |
| Gõ `t3` báo "command not found" | `~/.local/bin` chưa nằm trong PATH | `echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc` |
| Cài xong báo `libatomic.so.1: cannot open shared object file` | VPS tối giản thiếu thư viện hệ thống | `apt-get update && apt-get install -y libatomic1` rồi chạy lại trình cài |
| App điện thoại báo "Failed to fetch remote environment" | Ô HOST chứa handle/IP sai, hoặc server chưa chạy | Dùng **Cách A (t3 connect)** — đăng nhập cùng tài khoản, khỏi điền tay; hoặc `t3 pair` trên VPS rồi quét QR |
| T3 Code không kết nối được VPS | Port SSH/firewall, hoặc VPS tắt | Dùng T3 Connect (đi qua relay của T3); kiểm tra `t3 service status` trên VPS |
| Agent đọc được file .env | CẤM — phải xảy ra lỗi cấu hình | Kiểm tra rule `read: { "*.env": "deny", ... }` trong `opencode.json` đang dùng |
| Token Kiira hết nhanh | OpenCode đọc rất nhiều file mỗi task | 30M tokens/ngày thường đủ; nếu hết, chuyển model phụ sang Groq free (console.groq.com) |

---

## Checklist nhanh

- [ ] `sh ./scripts/setup-vps-agent.sh` chạy xong không lỗi
- [ ] OpenCode cho phép `git commit` + `git push` (vẫn chặn reset/rebase)
- [ ] `/models` trong OpenCode thấy DeepSeek v4.1 Flash (Kiira)
- [ ] Agent trả lời được câu hỏi về code (key hoạt động)
- [ ] `bot/.env` có `KIRA_API_KEY` nếu muốn bot dùng chung
- [ ] T3 Code cài trên VPS, app điện thoại kết nối được qua SSH
- [ ] Test từ điện thoại: chạy `bun run test` thấy kết quả PASS
