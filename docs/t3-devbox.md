# T3 Code devbox trên VPS (Dokploy compose `t3-code`)

> Runbook cho môi trường dev-from-anywhere dựng 24–25/09/2026. Đọc cái này trước
> khi đụng tới T3/devbox — phần "Tài khoản" và "Sự cố 25/09" là bài học xương máu.

## 1. Bản đồ

Docker Compose service `t3-code` trong Dokploy (project `protogon`), compose
file dán qua tab **Files** (không nằm trong repo này). 5 service:

| Service                     | Vai trò                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `devbox`                    | T3 server (`t3 serve :3773`) + VS Code web/code-server (`:8000`) + kho agent CLI (claude, codex, cline, opencode…) |
| `docker`                    | Docker-in-Docker để devbox build/test không đụng daemon chính                                                      |
| `chrome` + `playwright-mcp` | Chrome thật cho agent duyệt web/test UI                                                                            |
| `repo-sync`                 | Cron 6h: dùng `GH_TOKEN` clone toàn bộ repos GitHub vào `/workspace/repos` (gồm `Autoreply-and-anti-nuke-raid`)    |

Env bắt buộc (đặt qua tab **Environment** của Dokploy, **không** sửa yml):
`GH_TOKEN` (PAT scope `repo` của GitHub **chứ repo Protogon**),
`VSCODE_PASSWORD`, `BROWSER_PASSWORD`.

Ports publish chỉ bind loopback — `127.0.0.1:8000:8000`,
`127.0.0.1:3773:3773` — không lộ Internet công cộng, chỉ cloudflared trên cùng
host với tới được.

## 2. Đường truy cập (verify 25/09/2026)

| Kênh                          | Địa chỉ                                         | Trạng thái chuẩn                           |
| ----------------------------- | ----------------------------------------------- | ------------------------------------------ |
| T3 Code web (mọi trình duyệt) | `https://t3.protogon.dpdns.org`                 | HTTP 200                                   |
| VS Code web (máy tính)        | `https://code.protogon.dpdns.org`               | HTTP 302 → trang login (`VSCODE_PASSWORD`) |
| App T3 trên điện thoại        | qua relay `relay.t3.codes` (outbound từ devbox) | chấm xanh khi account khớp                 |
| Repo Protogon trong devbox    | `/workspace/repos/Autoreply-and-anti-nuke-raid` | repo-sync tự clone                         |

Mạch DNS: record CNAME `t3` + `code` → tunnel `meowlix`
(`30583a3c-4f9b-4e37-a6ee-fd6695352e04.cfargotunnel.com`, Proxied 🟠);
`/etc/cloudflared/config.yml` ingress có 4 hostname: `panel`→`:3000`,
root→`:8080`, `t3`→`:3773`, `code`→`:8000`, cuối là `http_status:404`.

## 3. Tài khoản — quy tắc vàng

> **Environment chỉ hiện trên app khi app và devbox là CÙNG MỘT tài khoản T3**
> (cùng identity VÀ cùng provider đăng nhập). Relay chỉ là đường ống; tài khoản
> mới là chìa khoá.

- Devbox hiện authorized: `wiothemilo@gmail.com` qua **GitHub** — đúng GitHub
  chủ repo Protogon (`wiothemilo-lang/Autoreply-and-anti-nuke-raid`).
- Bài học 25/09: lần đầu login nhầm identity khác → app điện thoại (đang dùng
  account khác) nhìn không thấy environment dù relay đã provisioned. Chẩn
  đoán bằng `t3 connect status` (dòng `Authorized as …`).

### Runbook đổi account devbox

```bash
# 1. Ngắt ủy quyền cũ
docker exec $(docker ps -qf name=devbox) t3 connect logout

# 2. Login lại — OAuth device flow
docker exec -it $(docker ps -qf name=devbox) t3 connect login --headless
```

⚠️ 2 bẫy ở bước 2 (đã cắn 1 lần):

1. Mở URL trên **cửa sổ ẨN DANH** — cửa sổ thường tự đăng nhập session cũ.
2. Chọn **đúng provider mà app điện thoại đang dùng** (Google với Gmail đó,
   hoặc GitHub tạo từ Gmail đó). Khác provider = tạo tài khoản T3 riêng = app
   vẫn không thấy.

```bash
# 3. Link vào relay + restart để server nạp
docker exec -it $(docker ps -qf name=devbox) t3 connect link
docker restart $(docker ps -qf name=devbox)

# 4. Đợi 1–2 phút rồi kiểm — kỳ vọng:
#    Environment link: provisioned · Relay: https://relay.t3.codes
docker exec $(docker ps -qf name=devbox) t3 connect status
```

### Đọc `t3 connect status`

| Dòng                               | Ý nghĩa                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| `pending server startup`           | Server `t3 serve` (entrypoint container) chưa kịp provision — đợi 1–2 phút, xem log bên dưới |
| `Relay: https://relay.t3.codes`    | Đã provisioned xong — chỉ còn chuyện account phía app                                        |
| `Authorization: stored credential` | Đã login (email xem ở lúc login in ra `Signed in as …`)                                      |

```bash
# Log provision — kỳ vọng 4 dòng "Relay client tunnel connection registered"
docker logs $(docker ps -qf name=devbox) 2>&1 | grep -iE "relay|provision|tunnel" | tail -15
```

- WARN `ping_group_range` từ cloudflared: **vô hại** (cảnh báo ICMP).
- `t3 connect logout` có thể in WARN `relay-environment-unlink … HTTP 500`:
  lỗi phía relay khi xoá record cũ, nhưng **credential local vẫn được xoá**
  (`Signed out … locally`) → coi là xong; record chết phía relay vô hại.

## 4. Sự cố 25/09: đĩa VPS emergency read-only (bài học lớn)

Triệu chứng ban đầu tưởng là bug T3: lệnh `t3` trên host báo
`EROFS: read-only file system` khi đụng `~/.t3/userdata/secrets`.

| Kiểm tra              | Kết quả                    | Chẩn                                                                                                                       |
| --------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `mount \| grep " / "` | `ext4 (rw,…,emergency_ro)` | Kernel tự chuyển **toàn đĩa** sang read-only khẩn cấp khi phát hiện lỗi filesystem (`EXT4_FLAGS_EMERGENCY_RO`, kernel mới) |
| `touch /tmp/x`        | `Read-only file system`    | Xác nhận không ghi được gì — không phải lỗi T3                                                                             |
| `df -h /`             | 33% dùng                   | Không phải full đĩa                                                                                                        |

**Chữa đúng**: không cài/vá gì thêm (ghi không được thì cài gì cũng fail) →
`sudo reboot` → ext4 có cờ lỗi nên fsck **tự quét + sửa toàn đĩa lúc boot**
→ sau reboot: `FS SẠCH ✅`, toàn hệ hồi sinh không mất gì (pm2 bot online,
8 container Up, tunnel 200 dashboard/panel).

Bài học rút ra:

1. **`EROFS` rải rác trên nhiều path ≠ lỗi app.** Chạm lỗi read-only ở bất kỳ
   file nào → chạy `mount | grep " / "` + `touch /tmp/x` TRƯỚC khi chẩn đoán
   sâu. `emergency_ro` trong mount options là chìa khoá.
2. Đĩa đang read-only thì **không mất thêm dữ liệu khi đợi** — reboot là pha
   chữa đúng đắn, không phải rủi ro.
3. Sau reboot luôn chạy checklist: FS ghi được → pm2 bot online → docker ps →
   cloudflared active → curl dashboard 200 từ bên ngoài.

## 5. T3 cũ cài thẳng host (di vật pre-Dokploy) — đã dọn

Trước khi có Dokploy, T3 từng cài thẳng host: binary `/root/.local/bin/t3` +
`/usr/local/lib/node_modules/t3`, state `~/.t3` (v0.0.42). Đã xử lý:

- ✅ `t3 connect logout` trên host (25/09) — credential account cũ đã xoá.
- ❌ **KHÔNG chạy `t3 serve` trên host nữa** — devbox là nơi chính thức; T3
  host cũ từng bị nghi chiếm port 3773 nhưng thực ra bind thất bại âm thầm
  (docker-proxy giữ port) — chạy lại sẽ tái diễn rối.
- Lưu ý khi soi `ps aux` trên host: thấy process `t3 serve --host 0.0.0.0
--port 3773` là **của devbox container** (1 node wrapper + 1 native binary)
  — bình thường, không phải process host cũ.
- Tuỳ chọn chưa làm: `t3 uninstall` trên host để gỡ hẳn binary + launcher
  (state `~/.t3` giữ lại làm backup projects/threads cũ).

## 6. SSH devbox → host (agent chạm được tầng host VPS)

Lắp ngày 25/09 — cho agent trong T3 chạy được `pm2`, `journalctl`, docker chính,
cloudflared… của host. Key nằm trong `/workspace/.ssh` (volume — sống sót qua
redeploy). **Key này chỉ dùng cho devbox→host**, thu hồi bằng xoá 1 dòng trong
`/root/.ssh/authorized_keys` của host.

```bash
# 1. Tạo key trong devbox (chỉ chạy nếu chưa có)
docker exec $(docker ps -qf name=devbox) bash -c '
  mkdir -p /workspace/.ssh && chmod 700 /workspace/.ssh
  test -f /workspace/.ssh/id_ed25519 || ssh-keygen -t ed25519 -N "" -f /workspace/.ssh/id_ed25519 -C "devbox-t3"
  cat /workspace/.ssh/id_ed25519.pub'

# 2. Host nhận key: dán pubkey vào /root/.ssh/authorized_keys (chmod 600)

# 3. Bí danh trong devbox — CHÚ Ý: docker exec PHẢI có -i khi bơm heredoc
#    (thiếu -i → tee nhận stdin rỗng → file rỗng → "Could not resolve hostname vps")
#    Bẫy 2: config phải nằm ở $HOME/.ssh (=/root/.ssh) — ssh không đọc
#    /workspace/.ssh/config → cần bước 3b symlink.
docker exec -i $(docker ps -qf name=devbox) tee /workspace/.ssh/config > /dev/null <<'EOF'
Host vps
  HostName 172.19.0.1
  User root
  IdentityFile /workspace/.ssh/id_ed25519
  StrictHostKeyChecking accept-new
EOF
docker exec $(docker ps -qf name=devbox) chmod 600 /workspace/.ssh/config

# 3b. ssh đọc config từ $HOME/.ssh (= /root/.ssh), KHÔNG phải /workspace/.ssh
#     → symlink vào volume (làm lại đúng 1 dòng này sau mỗi lần redeploy container)
docker exec $(docker ps -qf name=devbox) bash -c 'mkdir -p /root/.ssh && chmod 700 /root/.ssh && ln -sf /workspace/.ssh/config /root/.ssh/config'

# 4. Kiểm chứng
docker exec $(docker ps -qf name=devbox) ssh vps 'pm2 status'
```

Bảo mật: tài khoản T3 giờ gần như = root VPS (ai vào được T3 là vào được host) →
mật khẩu T3 phải mạnh nhất hệ; ra lệnh cho agent phải cụ thể, tránh lệnh chung
chung có tính phá hoại. Sau reboot, IP gateway mạng docker (`172.19.0.1`) có thể
đổi — `ssh vps` refused thì tìm GW lại:
`docker exec $(docker ps -qf name=devbox) sh -c 'ip route | awk "/default/ {print \$3}"'`
rồi sửa `HostName` trong `/workspace/.ssh/config`. Sau redeploy container:
làm lại bước 3b (symlink config vào `/root/.ssh`) — key + config vẫn an toàn
trong volume.

## 7. Việc còn treo (người dùng tự làm)

1. **`GH_TOKEN`**: đổi trong Dokploy → service `t3-code` → Environment sang PAT
   của `wiothemilo` (scope `repo`, GitHub chứa repo Protogon) → Save →
   Redeploy → kiểm `docker exec $(docker ps -qf name=devbox) ls /workspace/repos/`
   thấy `Autoreply-and-anti-nuke-raid`.
2. Tuỳ chọn: login app bằng account Gmail cũ để xoá record environment chết
   phía relay; `t3 uninstall` trên host.
