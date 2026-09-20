---
name: decision-log
description: Use when making a non-obvious technical choice (choosing a provider/model/library, disabling something on purpose, accepting a tradeoff, rejecting an alternative that seems better on the surface) — append one row to docs/decision-log.md so future sessions don't relitigate the same choice or accidentally reverse it. Pairs with doubt-driven-development (which stress-tests the decision) — this records the verdict.
---

# Decision Log (nhật ký quyết định)

## Overview

Mỗi quyết định bất ngờ hôm nay sẽ là "tại sao lại làm vậy?" của phiên sau.
Không có log, agent mới sẽ: đảo ngược quyết định có chủ đích, hoặc tốn nhiều
tool calls để suy lại từ đầu cùng một lựa chọn. Log 1 dòng quyết định rẻ hơn
nhiều lần một cuộc tái thẩm.

Phân biệt với journal: journal ghi **việc đã làm** (dòng thời gian), decision
log ghi **vì sao chọn đường này** (kiến thức trừu tượng, không theo ngày).

## Ghi

Thêm 1 dòng vào bảng trong `docs/decision-log.md` (mới nhất trên cùng):

| Trường            | Quy tắc                                                   |
| ----------------- | --------------------------------------------------------- |
| Quyết định        | 1 câu, thì hiện tại: "Dùng X cho Y"                       |
| Vì sao            | Gốc rễ/lợi ích thật — không phải "nó tốt hơn" chung chung |
| Phương án bị loại | Tên + 1 lý do loại — chống relitigate                     |
| Phạm vi           | file/nhóm file bị ràng buộc bởi quyết định                |

- Chỉ ghi quyết định **không hiển nhiên**: mọi thứ tra docs ra được ngay
  (version, cú pháp) không cần ghi.
- Quyết định được đảo ngược → **không xoá dòng cũ**; thêm dòng mới ghi
  "Đảo ngược <mã cũ>: ..." — lịch sử quyết định là tài sản.
- Ghi ngay trong cùng commit với thay đổi thể hiện quyết định, không gom
  cuối session cho dài dòng.

## Đọc

- Trước khi "sửa lại cho đúng" một chỗ có vẻ sai: check log trước — có thể
  đó là quyết định có chủ đích (vd: tường lửa đóng, `hmr: false`, model
  fallback theo thứ tự).
- Khi user hỏi "tại sao hôm trước không dùng X?" → trả từ log, đừng đoán.

## Chống mục đích

- Không biến log thành changelog — "thêm nút A" không phải quyết định.
- Không ghi secret, không ghi giả định chưa kiểm chứng (cái chưa chắc chắn
  thuộc về doubt-driven-development, ghi log khi đã chốt).
