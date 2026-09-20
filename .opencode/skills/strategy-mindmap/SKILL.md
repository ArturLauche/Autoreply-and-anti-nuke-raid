---
name: strategy-mindmap
description: Use when planning any multi-step task (3+ steps), when the user asks for a plan/roadmap, when choosing between approaches, or when a previous plan failed and needs restructuring — builds the plan as a small ASCII mind map (goal → branches → leaf actions) inside the todo workflow, so the strategy survives session interruption and is readable in 15 seconds instead of re-derived.
---

# Strategy Mindmap (sơ đồ tư duy chiến lược)

## Overview

Todo list ghi TỪNG BƯỚC nhưng không ghi CHIẾN LƯỢC — phiên bị cắt giữa chừng
thì các bước còn lại mất ngữ cảnh "tại sao đi đường này". Sơ đồ tư duy bổ
tuyến đúng khuyết đó: 1 cây ASCII nhỏ trong progress note, giữ nguyên chiến
lược khi phiên sau đọc lại.

Nguyên tắc: **cây sâu tối đa 3 tầng, tối đa ~12 node.** Lệch giới hạn nghĩa
là đang vẽ chi tiết thay vì chiến lược — chi tiết thuộc về todo list.

## Vẽ khi nào

- Bắt đầu việc ≥ 3 bước (cùng lúc lập todo, không thay thế todo)
- Có 2+ hướng đi phải chọn — vẽ cả 2 nhánh rồi mới chọn, lựa chọn ghi kèm
  1 dòng lý do
- Kế hoạch cũ fail → vẽ lại cây thay vì vá lẻ từng todo

## Khung vẽ

```text
MỤC TIÊU: <1 dòng>
├─ Nhánh A: <cách tiếp cận 1>  ← chọn (lý do ngắn)
│  ├─ bước A1 (todo #1)
│  └─ bước A2 (todo #2)
├─ Nhánh B: <cách bị loại> — bỏ qua (lý do)
└─ Rủi ro: <thứ có thể vỡ> → phòng: <biện pháp 1 dòng>
```

## Quy tắc

1. **Mỗi node lá = 1 mục todo.** Vẽ xong cây → đổ vào todo list, không giữ
   2 hệ song song lệch nhau. Todo xong đến đâu, tick cả trên cây khi cập
   nhật note giữa chừng.
2. **Nhánh bị loại phải ghi lý do** — đây là phần giá trị nhất khi phiên sau
   đọc lại, tránh đi lại con đường đã biết là cụt.
3. **Rủi ro + phòng ngừa bắt buộc** với mọi cây có nhánh đụng production,
   data hoặc xoá/chuyển file.
4. Cây sống trong progress note (chat), KHÔNG ghi vào journal — journal chỉ
   ghi kết quả; khi phiên kết thúc, cây đã hoàn thành chỉ còn giá trị là
   entry nhật ký.
5. Phiên tiếp nối giữa chừng: đọc lại cây trong lịch sử chat + mục "Đang dở"
   trong `docs/agent-journal.md` — nếu cây vẫn hợp thì đi tiếp nhánh đang
   dở, không vẽ lại.

## Ví dụ ngắn

```text
MỤC TIÊU: sửa build production gãy
├─ Nhánh A: nghi code/dependency sai  ← chọn (lỗi resolve rõ ràng)
│  ├─ đối chiếu lockfile + version (todo #1)
│  └─ build lại cục bộ (todo #2)
├─ Nhánh B: nghi lỗi host — bỏ qua (build fail cả local)
└─ Rủi ro: node_modules hỏng cục bộ → phòng: clean install trước khi kết luận
```
