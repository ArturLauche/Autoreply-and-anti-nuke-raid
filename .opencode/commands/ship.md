---
description: Hoàn tất phiên — kiểm chứng, báo cáo, commit đúng chuẩn AGENTS.md
agent: build
---

Phiên làm việc sắp kết thúc. Hoàn tất theo đúng Pha 4 + Pha 5 của AGENTS.md:

1. **Kiểm tra working tree**: `git status` + `git diff --stat`. Có thay đổi
   chưa commit từ trước (không thuộc phiên này) → liệt kê rõ, KHÔNG đụng vào,
   chỉ làm việc với file thuộc công việc hiện tại.
2. **Chạy đủ bộ kiểm chứng**: `bun run test` (phải 39/39) +
   `bun tsc -b --noEmit` + `bun run lint`. Có lỗi → sửa lại trước khi commit.
   Vừa đụng `convex/` mà chưa codegen → chạy `bun convex dev --once` trước.
3. **Commit chọn lọc**: `git add` đúng file thuộc phiên này (kể cả file test
   chặn tái diễn), KHÔNG add file không liên quan hay file tạm sinh.
   - Message **tiếng Việt**, dòng đầu ≤72 ký tự, nói rõ *vì sao*
   - Footer bắt buộc: `🤖 Generated with OpenCode`
4. **Push** (kiểm chứng ở bước 2 đã XANH): `git push origin main`. Lỗi xác thực
   → in lệnh cho người dùng tự chạy. Chưa kiểm chứng xong thì KHÔNG push.
5. **Báo cáo cuối** cấu trúc: đã làm gì → kiểm chứng gì, kết quả số →
   việc còn lại (nếu có). Ngắn gọn, có bảng khi so sánh nhiều mục.
