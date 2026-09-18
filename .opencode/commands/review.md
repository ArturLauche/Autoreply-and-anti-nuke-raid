---
description: Review codebase/diff hiện tại như một senior reviewer
agent: plan
---

Thực hiện review như một kỹ sư senior của repo này (bối cảnh kiến trúc xem
AGENTS.md mục 4). Phạm vi review: $ARGUMENTS

- Không truyền `$ARGUMENTS` → review working tree hiện tại (`git diff` +
  `git status`); working tree sạch → review các commit mới nhất trên nhánh này.
- Đánh giá theo 5 lớp, mỗi lớp chỉ ra vấn đề CỤ THỂ kèm file:dòng:
  1. **Đúng đắn**: logic sai, edge case bỏ sót, race condition
  2. **An toàn**: lộ secret, bỏ qua `requireBotKeyStrict`/`botKey`, đầu vào
     chưa validate (đặc biệt OAuth client id, dữ liệu từ Discord raw)
  3. **Kiểm thử**: thay đổi logic mà thiếu test? Bug thuộc engine đã có test
     mà chưa có test chặn tái diễn?
  4. **Nhất quán**: đúng cấu trúc repo (bot CommonJS, test `scripts/test-*`),
     tiếng Việt trong comment/log, không sinh file trùng chức năng
  5. **Hiệu năng**: vòng lặp trong hot path của bot, call Convex không cần thiết
- Kết thúc bằng bảng: **Vấn đề → Mức độ (chặn/khuyên/để sau) → Gợi ý sửa**.
- Chỉ review — KHÔNG tự sửa file, KHÔNG commit.
