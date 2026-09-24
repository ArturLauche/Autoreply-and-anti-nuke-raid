# Hướng dẫn cài Dokploy + deploy dashboard Protogon lên VPS

> Viết cho học sinh cấp 3 tự học — đi từng bước, giải thích thuật ngữ ngay tại chỗ.
> Thời gian: ~45-60 phút. Yêu cầu: VPS Ubuntu 22/24 ≥2GB RAM (nếu VPS đang chạy bot thì xem mục ⚠️ đầu tiên).

---

## ⚠️ Bước 0 — Đọc kỹ trước khi làm (quan trọng!)

Dokploy **cần 2GB RAM + port 80/443/3000 rảnh**, và cài Docker Swarm lên VPS.

Kiểm tra trên VPS trước:

```bash
free -h                 # RAM: dòng "total" phải >= 2G
ss -tlnp | grep -E ':80|:443|:3000'   # 3 port này phải TRỐNG (không in gì = ok)
```

**Nếu VPS đang chạy bot Protogon:**

- Bot chạy bằng Bun, KHÔNG dùng port 80/443/3000 → không xung đột port ✅
- RAM: bot chiếm ~150-300MB. VPS 4GB → thoải mái. VPS 2GB → **ngại, nên dùng VPS thứ 2** (Hetzner/Contabo ~5$/tháng) hoặc dùng Dokploy Cloud ($4.50/tháng, không cần VPS riêng)
- Rủi ro chính: quá trình **build** app ngốn RAM đỉnh → có thể làm bot lag vài phút. Mitigation: build trên máy khác, hoặc deploy lúc bot ít người dùng (khuya)

---

## Bước 1 — Cài Dokploy lên VPS

SSH vào VPS:

```bash
ssh root@IP-CỦA-BẠN
```

Chạy lệnh cài (script tự cài Docker + Docker Swarm + Dokploy):

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

Cuối lệnh sẽ in ra **username + password mặc định** — copy lại ngay (chỉ hiện 1 lần).

Mở firewall cho port web:

```bash
ufw allow 3000/tcp && ufw allow 80/tcp && ufw allow 443/tcp
```

Bước mở `http://IP-VPS:3000` trên trình duyệt → tạo tài khoản admin.

**Bảo mật:** vào Settings → disable "IP:port access" CHỈ SAU khi đã gắn domain HTTPS (bước 2).

---

## Bước 2 — Gắn domain + HTTPS (bắt buộc trước khi xóa IP:port)

### Cách A — MIỄN PHÍ, không cần mua domain (DuckDNS, ~10 phút)

`duckdns.org` nằm trong **Public Suffix List** (đã xác minh 24/09/2026) → subdomain
`tenban.duckdns.org` được tính là domain RIÊNG, hưởng hạn mức SSL riêng
(50 chứng chỉ/tuần) — không bị người khác dùng chung hạn mức.

1. Mở https://www.duckdns.org → đăng nhập bằng GitHub/Google/Reddit
2. Tạo subdomain (ví dụ `wio-protogon`) → nhận `wio-protogon.duckdns.org`
3. Nhập IP VPS vào ô IP → bấm **update ip**
4. Trong Dokploy: **Web Server → Domains → thêm domain** `wio-protogon.duckdns.org` → **Let's Encrypt** → Save
5. Đợi 1-2 phút → mở `https://wio-protogon.duckdns.org` — khóa SSL xanh là xong
6. Sau này deploy app (Bước 3), làm tương tự với subdomain thứ 2, ví dụ `wio-protogon-web.duckdns.org`

### Cách B — Mua domain (~50-200k/năm)

Mua ở Namecheap/Porkbun (hoặc dùng `us.kg`, `eu.org` miễn phí — cũng nằm trong PSL).

1. Vào trang quản lý domain → tạo bản ghi **A** trỏ `dokploy.tên-miền.com` → IP của VPS
2. Trong Dokploy: **Web Server → Domains → thêm domain** `dokploy.tên-miền.com` → chọn **Let's Encrypt** → bấm Save
3. Đợi 1-2 phút, mở `https://dokploy.tên-miền.com` — thấy khóa SSL xanh là xong

### Tắt truy cập IP:port (SAU KHI domain + HTTPS hoạt động)

Giờ mới chạy lệnh tắt IP:port (đã in ở Bước 1):

```bash
docker service update --publish-rm "published=3000,target=3000,mode=host" dokploy
```

---

## Bước 3 — Deploy dashboard Protogon

### 3.1. Tạo project + application

1. Dokploy UI → **Projects → Create project** → đặt tên `protogon`
2. Trong project → **Create service → Application**
3. Điền:
   - **Name**: `protogon-web`
   - **Source type**: GitHub → chọn repo `Autoreply-and-anti-nuke-raid`
   - **Branch**: `main`
   - **Build type**: **Dockerfile**
   - **Dockerfile path**: `./Dockerfile.web` ← quan trọng (không phải `./Dockerfile`)

### 3.2. Điền Build Arguments (tab **Build → Build Arguments**)

| Argument            | Giá trị                                                                           | Bắt buộc?                                     |
| ------------------- | --------------------------------------------------------------------------------- | --------------------------------------------- |
| `VITE_CONVEX_URL`   | URL deployment Convex thật, ví dụ `https://accomplished-chipmunk-74.convex.cloud` | Không (mặc định trong code đã trỏ production) |
| `DISCORD_CLIENT_ID` | Application ID của bot (Discord Developer Portal → General Information)           | Có — để nút đăng nhập Discord hoạt động       |

### 3.3. Đặt port

Tab **Network → Domain**: thêm domain `protogon.tên-miền.com` (bản ghi A thứ 2 trỏ cùng IP) → port `80` → Let's Encrypt → Save.

### 3.4. Deploy

Bấm **Deploy**. Lần đầu ~3-5 phút (bun install → vite build → nginx). Xem log trực tiếp trong tab Deployments.

Sau này mỗi lần `git push` lên `main`, Dokploy **tự deploy lại** — không cần làm gì thêm.

### 3.5. Kiểm tra

- Mở `https://protogon.tên-miền.com` → landing page hiện ra
- Bấm **Đăng nhập Discord** → quay về dashboard → backup/antinuke hoạt động bình thường (dashboard nói chuyện với Convex production, đúng như đang chạy trên Freebuff)

---

## Cách hoạt động (giải thích cho người mới)

```
git push → GitHub → Dokploy tự nhận (webhook)
                        ↓
          Docker build (Dockerfile.web):
            Bước A: bun install + vite build → dist/ (file HTML/CSS/JS tĩnh)
            Bước B: nhét dist/ vào nginx (web server siêu nhẹ)
                        ↓
          Traefik (router nội bộ của Dokploy) nhận HTTPS từ trình duyệt
            → đổi chứng chỉ SSL tự động (Let's Encrypt)
            → dẫn traffic tới container nginx
                        ↓
          Trình duyệt tải dashboard → dashboard gọi thẳng Convex cloud
```

**Vì sao bot không nằm trong Docker?** Bot là process chạy 24/24, cần `git pull` + restart thủ công, không cần build. Bọc Docker chỉ thêm tầng phức tạp (volume cho `bot/data/`, mạng cho gateway Discord) mà không có lợi ích gì. Dashboard thì ngược lại: build một lần, chạy như file tĩnh — hoàn hảo cho Docker.

---

## Khắc phục lỗi thường gặp

| Triệu chứng                                                                             | Nguyên nhân                                                                                      | Cách xử lý                                                                                                                                                              |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deploy fail " bun: not found"                                                           | Sai Dockerfile path                                                                              | Đảm bảo Build type = Dockerfile, path = `./Dockerfile.web`                                                                                                              |
| Trang trắng sau deploy                                                                  | Thiếu `VITE_CONVEX_URL` / client id                                                              | Kiểm tra Build Arguments → redeploy                                                                                                                                     |
| Nút Discord login không hoạt động                                                       | Thiếu `DISCORD_CLIENT_ID` lúc build                                                              | Thêm Build Argument → redeploy (Vite "bake" giá trị lúc build, không đọc runtime)                                                                                       |
| Redirect Discord báo "Invalid redirect URI"                                             | URL mới chưa đăng ký trong Discord Developer Portal                                              | Vào Dev Portal → OAuth2 → thêm `https://protogon.tên-miền.com/discord/callback` vào Redirects                                                                           |
| Build treo / OOM                                                                        | VPS thiếu RAM lúc build                                                                          | Build lúc khuya, hoặc nâng VPS tạm 4GB, hoặc dùng Build Server riêng                                                                                                    |
| Ping thông nhưng TCP 80/443/3000 refuse từ ngoài (ufw inactive, dịch vụ listen 0.0.0.0) | Firewall/security group TẦNG NHÀ CUNG CẤP chặn inbound (nằm ngoài VPS, không sửa được bằng lệnh) | Nhờ provider mở inbound 80/443/3000; hỏi rõ VPS có IP public dedicated hay shared NAT — NAT shared thì domain trỏ kiểu này không chạy được (bài thật 24/09 với Meowlix) |
| Bot lag khi deploy                                                                      | Build ngốn CPU/RAM                                                                               | Ổn — chỉ vài phút; hoặc tách build sang VPS khác                                                                                                                        |

---

## Checklist tổng

- [ ] VPS ≥2GB RAM, port 80/443/3000 rảnh
- [ ] `curl -sSL https://dokploy.com/install.sh | sh`
- [ ] Domain A record → IP, cấu hình HTTPS trong Dokploy
- [ ] Tắt IP:port access
- [ ] Application: repo + branch main + Dockerfile `./Dockerfile.web`
- [ ] Build args: `DISCORD_CLIENT_ID`
- [ ] Domain `protogon.tên-miền.com` → port 80 → Let's Encrypt
- [ ] Deploy + đăng nhập Discord OK
- [ ] Discord Developer Portal: thêm redirect URI mới (`/discord/callback`)
