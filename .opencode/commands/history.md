---
description: Xem hộp lịch sử làm việc (phiên gần nhất, tự dọn theo TTL)
agent: build
---

Đọc hộp lịch sử phiên của agent và tóm tắt cho người dùng.

Hộp lịch sử nằm tại `~/.config/opencode/history/sessions.jsonl` (mỗi dòng một
sự kiện JSON: `at` (epoch ms), `event` (created/idle/error), `sessionId`,
`title`, `directory`). Nếu có shell, chạy:

    tail -50 ~/.config/opencode/history/sessions.jsonl

Sau đó trình bày:

1. **Bảng 10 phiên gần nhất** (gộp theo sessionId): thời gian (đổi epoch sang
   giờ địa phương dễ đọc), tên phiên, thư mục, trạng thái (hoàn thành/error —
   kèm lý do ngắn nếu error).
2. **Thống kê nhanh**: tổng số sự kiện, số phiên có lỗi, phiên hoạt động
   cuối cùng cách bao lâu.
3. **Trạng thái hộp**: dung lượng file, TTL hiện hành
   (`AGENT_HISTORY_TTL_DAYS`, mặc định 14 ngày, 0 = giữ vô hạn) — nhắc người
   dùng có thể đổi TTL qua biến môi trường này trên VPS.

Hộp trống/không tồn tại → báo "chưa có lịch sử nào được ghi" + giải thích
lịch sử chỉ bắt đầu ghi từ khi plugin session-history được nạp.
KHÔNG sửa/xóa gì trong hộp — chỉ đọc và tóm tắt.
