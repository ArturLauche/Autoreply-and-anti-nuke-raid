---
description: Quét sức khỏe VPS (disk, RAM, service chết, docker, proxy Kiira) — read-only, báo cáo kèm đề xuất chữa
agent: build
---

Người dùng muốn kiểm tra tổng thể hạ tầng VPS. Chạy TRỌN BỘ các lệnh chẩn đoán
read-only bên dưới (vùng 🟢 theo AGENTS.md điều khoản 3 — tự làm, không cần hỏi),
tổng hợp thành báo cáo rồi ĐỀ XUẤT cách chữa. KHÔNG sửa gì trong lệnh này —
chỉ chẩn đoán và đề xuất (người dùng gật mới vào việc, theo đúng quy trình).

## Bộ lệnh chẩn đoán

1. `df -h /` — disk: dùng ≥85% → cảnh báo đỏ, gợi ý `du -x --max-depth=1 / 2>/dev/null | sort -rh | head -10` tìm thủ phạm
2. `free -h` — RAM: available < 15% → cảnh báo, gợi ý `ps aux --sort=-%mem | head -8`
3. `uptime` — load average: > số core × 2 → cảnh báo quá tải
4. `systemctl is-active kiira-retry-proxy bot Discord` 2>/dev/null — từng dịch vụ, cái nào không phải `active` → điều tra riêng
5. `systemctl status kiira-retry-proxy --no-pager -l` — trạng thái proxy + lần restart gần nhất
6. `curl -sS -m 5 http://127.0.0.1:8787/__health` — health check proxy: phải `"ok":true`; không thấy → coi proxy chết
7. `docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' 2>/dev/null || echo "docker không chạy"` — container dashboard: status có `Restarting`/`Exited` → điều tra `docker logs --tail 30 <tên>`
8. `journalctl -u kiira-retry-proxy --since "1 hour ago" --no-pager | grep -iE "error|fail|timeout" | tail -5` — lỗi gần đây của proxy
9. `journalctl -p err --since "1 hour ago" --no-pager | tail -10` — lỗi hệ thống chung (cảnh báo khối lượng lớn)

## Quy tắc khi chẩn đoán

- CẤM tuyệt đối: `systemctl cat/show`, `docker inspect/exec`, `/proc/*/environ`,
  `printenv` — chỗ này chứa secret (AGENTS.md điều khoản 3 vùng 🔴). Chẩn đoán
  bằng status/log/df/free là đủ nguyên nhân.
- Service bot hoặc docker bị lỗi → vùng 🟡: ĐỪNG tự restart — in đúng lệnh,
  giải thích nguyên nhân, người dùng tự chạy.

## Định dạng báo cáo

```
🔴/🟡/🟢 TÌNH TRẠNG CHUNG: <một câu>
| Hạng mục | Giá trị | Đánh giá |
|---|---|---|
| Disk | xx% | 🟢/🟡/🔴 |
| RAM | ... | ... |
| Load | ... | ... |
| kiira-retry-proxy | active, ok:true | ... |
| Docker | ... | ... |

Việc cần làm: <danh sách, đánh dấu [TỰ LÀM được — vùng 🟢] / [CẦN BẠN chạy — vùng 🟡]>
```

Người dùng nói "sửa đi" → xử lý các mục vùng 🟢 ngay (sửa → kiểm chứng → báo
cáo); mục 🟡 thì chờ người dùng chạy lệnh rồi xác nhận lại bằng /health.
