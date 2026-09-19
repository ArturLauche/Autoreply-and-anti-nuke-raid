---
description: Audit bảo mật 6 pha bằng skill security-audit của Cloudflare — chạy trên bản clone, không đụng repo production
agent: build
---

Người dùng yêu cầu audit bảo mật. Nạp skill `security-audit` (Cloudflare) bằng
công cụ skill rồi thực hiện theo đúng workflow 6 pha của nó.

## Lựa chọn phạm vi — hỏi nhanh trước khi chạy (trừ khi người dùng đã nói rõ)

1. **Repo nào?** Mặc định đề xuất bản clone `/root/freebuff-lab/lab-repo`
   (pull mới nhất trước) thay vì repo production — audit đầy đủ chạy nhiều
   sub-agent song song, tốn token lớn và viết file phụ trợ.
2. **Phạm vi nào?** Đề xuất một trong:
   - `bot/src/` — engine bot (antinuke, heat, joinGate, backup…)
   - `src/` + `convex/` — dashboard web + backend (OAuth, session, botKey)
   - Toàn repo — chỉ khi người dùng chấp nhận thời gian + token

## Quy tắc bắt buộc trong lúc audit

- KHÔNG đọc `.env`, `bot/.bot-key`, `*.pem`, `*.key` — nếu nghi vấn dính secret,
  ghi `needs_validation` kèm câu hỏi cho người dùng, không tự mò (điều khoản 1
  AGENTS.md).
- Không có sandbox OS thì KHÔNG chạy code/build của mục tiêu — giữ lead là
  `needs_validation` (yêu cầu của chính skill).
- Verifier phải là agent khác hunter — không tự xác minh finding của chính mình.
- Kết quả ghi ra `findings.json` + `REPORT.md` + `FINDINGS-DETAIL.md` +
  `NEEDS-VALIDATION.md` đúng schema của skill.

## Sau khi audit xong

Báo cáo tóm tắt: số finding confirmed / needs_validation / rejected, top 3
rủi ro theo severity kèm vị trí file:dòng. KHÔNG tự vá — chỉ đề xuất. Người
dùng muốn vá finding nào sẽ giao riêng (lúc đó dùng `/fix` đúng quy trình,
kèm test chặn tái diễn).
