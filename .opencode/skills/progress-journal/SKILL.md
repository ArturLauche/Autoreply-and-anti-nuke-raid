---
name: progress-journal
description: Use at the START of any session to recover where the last one stopped, and at the END of every completed unit of work to record what was done in docs/agent-journal.md — one dated entry, 5 lines max, plus a persistent "Đang dở" section. Lets a fresh session (or a resumed one after stream failure) pick up exactly at the stop point without re-deriving history from git log or re-reading files.
---

# Progress Journal

## Overview

AGENTS.md đã quy định "tiếp tục đúng chỗ dừng" khi phiên bị cắt — nhưng muốn
tiếp đúng thì phải CÓ một nơi ghi chỗ dừng. `docs/agent-journal.md` là nơi đó:
nhật ký dòng thời gian ngắn nhất có thể, đọc trong 10 giây, viết trong 1 phút.

Nguyên tắc: **nhật ký là chỉ mục, không phải báo cáo.** Báo cáo đầy đủ nằm
trong chat + commit message; nhật ký chỉ cần đủ để phiên sau biết làm gì tiếp.

## Đọc (đầu mỗi phiên)

1. Đọc `docs/agent-journal.md` **trước** khi đọc bất kỳ file code nào.
2. Ưu tiên mục **"Đang dở"** — nếu có mục chưa xong, đó là việc tiếp theo,
   không cần hỏi lại mục tiêu.
3. Đối chiếu nhanh với hiện trạng: `git log --oneline -3` + `git status`.
   Nhật ký nói "đã commit X" nhưng git không thấy → nhật ký cũ hơn thực tế,
   tin git.

## Ghi (cuối mỗi đơn vị công việc — sau khi kiểm chứng xanh)

Thêm 1 entry lên **đầu** file, đúng khung:

```markdown
## 2026-09-20 — <tên việc ngắn gọn>

- ✅ Xong: <2-3 gạch đầu dòng, mỗi dòng 1 kết quả kiểm chứng được>
- 📁 File đụng: <path chính, tối đa 5 file>
- 🧪 Kiểm chứng: <vd "52/52 suites · tsc OK · build 9.5s">
- ▶️ Tiếp theo: <1 dòng — việc kế hoặc "không có, chờ yêu cầu">
```

- Entry mới nhất luôn trên cùng. Giữ tối đa ~30 entry gần nhất, entry cũ hơn
  gộp thành 1 dòng tóm tắt theo tháng (tránh file phình to).
- Cập nhật section **"Đang dở"** ở đầu file: xong việc nào thì xoá khỏi đó,
  việc phát sinh giữa chừng thì thêm vào đó.

## Cập nhật "Đang dở" (khi phiên bị cắt giữa chừng)

Trước khi kết thúc phiên dở việc (lỗi stream, hết context, user phải đi):
ghi vào mục "Đang dở" đúng 3 dòng: **việc đang làm đến đâu / file đã sửa dở /
bước kế tiếp cụ thể**. Phiên sau đọc 3 dòng đó là chạy tiếp được — đúng tinh
thần Pha 3 của AGENTS.md, không làm lại từ đầu.

## Chống mục đích

- Đừng biến nhật ký thành văn xuôi — quá 6 dòng một entry là đang viết lách,
  không phải ghi chép.
- Đừng ghi những gì commit message đã nói rõ (hash + title là đủ).
- Đừng ghi thông tin secret (key, token) — file này commit lên repo public
  workflow, luôn luôn phải sạch.
