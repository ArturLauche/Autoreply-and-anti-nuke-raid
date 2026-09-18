---
description: Chạy đủ bộ kiểm chứng (test + typecheck + lint) — ranh giới "xong việc"
agent: build
---

Đây là lệnh xác minh bắt buộc trước khi coi bất kỳ đơn vị công việc nào là XONG
(theo AGENTS.md Pha 4). Thực hiện theo đúng thứ tự, không bỏ bước:

1. `bun run test` — toàn bộ 39 test suites phải xanh. Nếu đỏ: đọc kỹ lỗi,
   xác định đây là bug thật hay lỗi môi trường (thiếu node_modules → chạy
   `bun install` trước), KHÔNG vá bừa cho hết đỏ.
2. `bun tsc -b --noEmit` — typecheck phải sạch. Nếu vừa đụng file trong
   `convex/` mà chưa codegen, chạy `bun convex dev --once` rồi typecheck lại.
3. `bun run lint` — ESLint phải sạch.

Báo cáo kết quả dạng số: `X/39 suites · typecheck OK/LỖI · lint OK/LỖI`.
Có lỗi thì liệt kê từng lỗi + nguyên nhân gốc rễ + cách vá đề xuất, KHÔNG tự
vá khi chưa được yêu cầu. KHÔNG commit trong lệnh này — chỉ xác minh và báo.
