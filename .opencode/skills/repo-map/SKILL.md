---
name: repo-map
description: Use at the START of a session before exploring unfamiliar parts of this repo, or when the user asks about project structure/architecture — read the hand-drawn map in docs/repo-map.md instead of spending many tool calls grepping and listing directories. Update the map ONLY when you add/remove a module, page, panel, or Convex function group, and only the affected line(s).
---

# Repo Map (bản đồ thu gọn)

## Overview

Mỗi phiên agent mất hàng chục tool calls để "làm quen" lại repo: list thư
mục, đoán file nào làm gì, grep tìm chỗ sửa. `docs/repo-map.md` là bản đồ
thu gọn vẽ sẵn — đọc 1 lần thay cho cả chuỗi khám phá đó.

Nguyên tắc: **bản đồ là điểm khởi đầu, không phải nguồn chân lý cuối.**
Chi tiết thật vẫn nằm trong code; bản đồ chỉ cần đủ chính xác để biết phải
đi tới file nào.

## Đọc

- Đầu phiên khi cần chạm vào vùng chưa quen: đọc `docs/repo-map.md` trước,
  sau đó mới search/read đúng file đã chỉ.
- Khi user hỏi "file X ở đâu", "kiến trúc thế nào" → trả lời từ bản đồ +
  xác nhận nhanh bằng 1 search nếu cần số liệu chính xác.

## Cập nhật (bắt buộc khi cấu trúc đổi)

KHI NÀO: thêm/xoá/đổi tên một trong các thứ sau → sửa đúng dòng liên quan
trong bản đồ ngay trong cùng commit:

- trang (`src/pages/`), panel (`src/components/dashboard/`), landing section
- nhóm module bot (`bot/src/`), file Convex function
- script kiểm chứng/deploy quan trọng (`scripts/`)

KHÔNG cập nhật vì: đổi logic bên trong, sửa style, đổi biến — bản đồ không
theo dõi tầng đó (đó là việc của commit message + journal).

Quy tắc giữ bản đồ gọn: mỗi dòng = 1 đơn vị + 1 câu mô tả ≤ 10 từ. Nếu một
section phình quá ~15 dòng, gộp các item cùng họ thành 1 dòng nhóm.

## Phòng lỗi

- Bản đồ nói có file mà code không có (hoặc ngược lại) → sửa bản đồ ngay lập
  tức khi phát hiện, đừng để lệch lan sang phiên sau.
- Không bao giờ ghi secret/key/token vào bản đồ — nó commit lên repo.
