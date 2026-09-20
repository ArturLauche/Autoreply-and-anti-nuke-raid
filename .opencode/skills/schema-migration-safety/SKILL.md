---
name: schema-migration-safety
description: Use BEFORE any change to convex/schema.ts (adding/removing/renaming a table or field, changing a validator, tightening a type) — two live clients (bot on VPS + dashboard web) sync through Convex with ~1 minute deployment skew, so a schema change that assumes "everyone updated at once" silently breaks one side. Enforces the backward-compat checklist (optional fields, never delete a field still read, expand-then-contract over two deploys).
---

# Schema Migration Safety (đổi schema khi có 2 client lệch pha)

## Overview

Schema `convex/schema.ts` có **2 consumer đang chạy thật**: bot (pm2 trên VPS, deploy tay qua `/deploy`) và dashboard web (Freebuff hosting, deploy theo push). Sau mỗi deploy Convex, hai client cập nhật **lệch pha** — bot có thể vẫn chạy code cũ đọc schema mới, hoặc ngược lại, trong cả mấy phút (lâu hơn nếu quên restart). Mọi thay đổi schema phải sống sót qua **cả 4 tổ hợp** (schema mới/cũ × code mới/cũ), không chỉ tổ hợp "mọi thứ mới".

## Checklist bắt buộc trước khi đụng schema

Đi từng dòng, đánh dấu ✅/❌ trong todo — thiếu ✅ thì KHÔNG sửa:

1. **Field mới** → khai báo `v.optional(...)` hoặc có default phía writer; bot/dashboard CŨ đọc field này sẽ thấy `undefined` — code cũ có xử lý undefined không? (grep chỗ đọc trước khi sửa).
2. **Field xoá/đổi tên** → field đang được ĐỌC ở đâu?

```sh
grep -rln "tên-field" bot/src src convex --include="*.js" --include="*.ts"
```

Còn bất kỳ chỗ đọc nào chưa sửa → KHÔNG xoá. Lộ trình đúng: (a) deploy code mới **không còn đọc** field cũ, (b) deploy sau mới xoá field trong schema (expand-then-contract, 2 commit riêng biệt).

3. **Siết validator** (thu hẹp kiểu, thêm `v.literal`, đổi optional → bắt buộc) → dữ liệu CŨ trong DB có vi phạm validator mới không? Convex đọc document cũ không hợp validator có thể ném lỗi lúc query. Nới trước, siết sau — và chỉ siết khi dữ liệu cũ đã được migrate hoặc bằng chứng sạch.
4. **Bảng mới** → an toàn (không ảnh hưởng consumer cũ), nhưng nhớ thêm vào `docs/repo-map.md` + chạy `check-repo-map.cjs`.
5. **Index đổi** → index mới thêm tự build; xoá index đang dùng bởi `withIndex` ở đâu đó sẽ ném lỗi — grep `withIndex("tên-index")` trước.

## Sau khi sửa schema

- `bun convex dev --once` (codegen) **trước** typecheck — luôn luôn.
- Test luồng 2 phía: test Convex schema-side + test bot đọc/ghi table đó (nếu có suite sẵn — bám vào, không tạo framework mới).
- **Lộ trình deploy**: schema mới qua CI là tới backend NGAY; code client mới đi theo push/restart sau đó. Với thay đổi phá tương thích (mục 2, 3) → commit tách làm 2: commit 1 tương thích 2 chiều, commit 2 (sau khi cả bot + dashboard đã chạy code mới) mới thắt chặt schema.
- Ghi quyết định phá-compat vào `docs/decision-log.md` (skill `decision-log`) — phiên sau thấy schema lạ biết đó là lộ trình có chủ đích, đừng "sửa lại cho đúng".

## Triệu chứng lệch pha thường gặp

| Lỗi runtime                                                | Nghi vấn                                       |
| ---------------------------------------------------------- | ---------------------------------------------- |
| Convex `ValidatorError` / "Invalid document" khi bot query | Schema siết nhanh hơn dữ liệu cũ (mục 3)       |
| Dashboard hiện `undefined` nơi từng có giá trị             | Bot cũ ghi thiếu field mới (mục 1)             |
| `withIndex` ném "Index not found"                          | Index bị xoá khi code cũ còn dùng (mục 5)      |
| Bot ghi thành công nhưng dashboard không thấy field        | 2 phía dùng khác tên field sau đổi tên (mục 2) |
