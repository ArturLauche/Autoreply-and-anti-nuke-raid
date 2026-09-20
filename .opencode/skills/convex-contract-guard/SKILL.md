---
name: convex-contract-guard
description: Use BEFORE renaming/moving/deleting any Convex function (export const ... in convex/*.ts), whenever touching files the bot calls through string names like "bot_writes:botClaimBackup", when adding a new bot call to a Convex function, or when a runtime error like "Could not find public function" appears — the bot calls Convex by string names so TypeScript cannot catch a rename; this skill enforces the two-sided grep and the checker script.
---

# Convex Contract Guard (rào hợp đồng bot ⇄ Convex)

## Overview

Bot không gọi Convex qua typed API mà qua **tên chuỗi**: `client.mutation("bot_writes:botClaimBackup", …)`. Điều đó nghĩa là: đổi tên function trong `convex/` mà không sửa phía bot → **typecheck vẫn sạch, test có thể vẫn xanh, bot crash runtime đúng lúc luồng đó chạy** (khi raid, khi backup — chính lúc nguy hiểm nhất). Đây là lớp lỗi tsc không thấy được; chỉ có đối chiếu 2 phía bắt được.

## Luồng bắt buộc khi đổi tên / di chuyển / xoá function Convex

1. **Trước khi đổi**: tìm toàn bộ nơi gọi —

```sh
grep -rn "tên-module:tên-cũ" bot/src --include="*.js"
```

Ghi lại số chỗ gọi (có thể > 1 file — `interactionCreate.js`, `backup.js`, `tick.js`…).

2. **Đổi tên function + ĐỒNG THỜI sửa TẤT CẢ vị trí gọi** trong cùng commit. Không đổi nửa vời — kể cả "tạm để gọi cũ, sửa sau".

3. **Chạy chốt hạ:**

```sh
node scripts/check-convex-contract.cjs
```

Xanh khi in `convex-contract OK — N function bot gọi đều tồn tại`. Báo tên nào thiếu → sửa tới khi OK. CI cũng chạy bước này trong job `lint` — đỏ vì bước này thì sửa hợp đồng, không nới lỏng script.

4. Nếu function có nhiều gọi phía dashboard (`src/` qua `api.…` typed) — tsc đã phủ, nhưng vẫn double-check bằng grep `api.tên-module.tên-function` trong `src/`.

## Khi thêm call mới từ bot

- Function đích phải có thật trong `convex/*.ts` (export const, đúng module) — không "đoán tên" theo chức năng.
- Thêm call xong chạy ngay script chốt hạ; 1 giây, rẻ hơn crash lúc raid.

## Khi gặp lỗi runtime "Could not find public function / Uncaught TypeError"

Đây là triệu chứng điển hình của hợp đồng lệch: grep tên function trong lỗi, so với exports thật của file module tương ứng, ưu tiên nghi **lệch tên chuỗi trên bot** trước khi nghi bug Convex. Sửa xong thêm test luồng (hoặc chạy script) chặn tái diễn.

## Biên của skill

- Script chỉ kiểm tra TÊN function tồn tại — KHÔNG kiểm args/kiểu dữ liệu (tầng đó thuộc typecheck Convex + test luồng). Đổi signature args vẫn phải sửa cả 2 phía như thường.
- Internal functions (`internal.*`) bot gọi qua `"module:function"` chuỗi cũng được phủ — script đọc mọi export của `convex/*.ts`.
