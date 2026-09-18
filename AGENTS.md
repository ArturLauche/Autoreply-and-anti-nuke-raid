# AGENTS.md — Bản hợp đồng làm việc cho AI agent trong repo Protogon

> Áp dụng cho **mọi** agent AI làm việc trong repo này: OpenCode trên VPS, Freebuff,
> hoặc agent khác. Mục tiêu: agent làm việc có kỷ luật — **có kế hoạch, có kiểm chứng,
> có báo cáo** — không phải gõ lệnh may rủi.
>
> Repo chứa **bot Discord production** + **dashboard web** đang chạy thật. Hãy làm việc
> như một kỹ sư cẩn trọng, không phải một người thử nghiệm.

## 0. Nhận diện công việc trước khi làm

| Thành phần | Vị trí | Công nghệ |
|---|---|---|
| Bot Discord | `bot/` | discord.js, CommonJS, chạy Bun trên VPS |
| Dashboard web | `src/` | React + Vite + Tailwind + shadcn/ui (TypeScript) |
| Backend/DB | `convex/` | Convex functions (TypeScript) |
| Test | `scripts/test-*.cjs` (CommonJS), `scripts/test-*.ts` (Convex) | node:test |

Khi nhận việc, **tự phân loại** rồi đi đúng nhánh:

- 🐛 **Bug thật** → tìm gốc rễ trước khi vá; vá xong phải kèm test chặn tái diễn
- ✨ **Feature mới** → làm nhỏ, có test, chạy đủ bộ kiểm chứng (mục 3)
- 🔧 **Refactor** → KHÔNG đổi hành vi; test cũ phải vẫn xanh; không gộp với feature khác
- 📄 **Docs/cấu hình** → không cần test nhưng phải lint sạch

## 1. Workflow chuẩn — luôn đi đủ 5 pha

### Pha 1 — HIỂU (chưa sửa file nào cả)

1. `git status` + `git log --oneline -5` — nắm trạng thái working tree và công việc gần nhất
2. Đọc code liên quan (dùng search/grep, không đọc cả file lớn khi chỉ cần một đoạn)
3. Nếu yêu cầu mơ hồ → **dừng và hỏi**, đừng đoán. Đưa phương án kèm đề xuất thay vì hỏi mở

### Pha 2 — LẬP KẾ HOẠCH (todo)

Việc cần **hơn 2 bước thao tác** thì PHẢI lập todo trước khi sửa file đầu tiên:

- OpenCode: dùng công cụ `todowrite` / `todoread`
- Freebuff: dùng `write_todos`

Mỗi mục todo = một kết quả kiểm chứng được, không phải một vùng code chung chung.
❌ `"Sửa dashboard"` → ✅ `"Thêm bảng top heat vào trang /stats + test hermetic"`

### Pha 3 — THỰC HIỆN từng bước nhỏ

- Làm đúng **một mục todo** một lúc; xong cái nào cập nhật todo cái đó (không đợi cuối)
- Việc phát sinh giữa chừng → **thêm vào todo** rồi làm, không làm lén ngoài kế hoạch
- Giữa các bước, tóm tắt ngắn (progress note) những gì vừa làm + phát hiện — người theo
  dõi phải hiểu tiến độ mà không cần đọc diff

**Khi phiên bị gián đoạn** (lỗi "AI service stream failed", người dùng gõ
`continue`/`tiếp đi`/`làm tiếp`): **TIẾP TỤC ĐÚNG CHỖ DỪNG** — đọc lại todo +
file đã sửa gần nhất để xác định đã xong đến đâu, làm nốt phần còn thiếu.
KHÔNG làm lại từ đầu, KHÔNG hỏi lại mục tiêu. Cứ đi đến khi đủ Pha 4 (kiểm
chứng xanh) + Pha 5 (báo cáo) rồi mới dừng — trừ khi người dùng chủ động bảo
thôi. Khi nghi file có thể sửa dở: xem `git diff` trước khi sửa tiếp.

### Pha 4 — XÁC MINH (ranh giới "xong việc")

Đơn vị công việc chỉ coi là XONG khi tất cả điều này thoả:

- [ ] `bun run test` — toàn bộ suites xanh (hiện tại **41 suites** — số liệu 18/09/2026; nếu runner báo ít hơn nhiều → có suite bị bỏ sót, điều tra trước khi kết luận xanh)
- [ ] `bun tsc -b --noEmit` — typecheck sạch
- [ ] `bun run lint` — sạch
- [ ] Đụng file trong `convex/` → chạy `bun convex dev --once` (codegen) **trước** typecheck
- [ ] Bug thuộc engine đã có test (antinuke, altDetection, heat, joinGate, backup,
      oauth client id…) → **đã thêm test chặn tái diễn** đúng nơi với test cũ
- [ ] Chưa từng claim "đã chạy/đã xanh" khi chưa chạy thật

Các lệnh kiểm chứng đã được allow sẵn trong `opencode.json` — chạy thẳng, không cần hỏi.

### Pha 5 — BÁO CÁO + COMMIT

1. Báo cáo ngắn gọn, cấu trúc: **đã làm gì → kiểm chứng gì, kết quả số → việc còn lại
   (nếu có)**. Không viết văn dài; bảng khi so sánh nhiều mục.
2. `git add` **chọn lọc đúng file thuộc việc này** + `git commit`:
   - Message **tiếng Việt**, dòng đầu ≤72 ký tự, nói rõ *vì sao* thay vì liệt kê máy móc
   - Footer bắt buộc: `🤖 Generated with OpenCode`
3. **Push sau khi báo cáo** — kiểm chứng xanh rồi mới đẩy: `git push origin main`.
   Lỗi xác thực/thiếu quyền → in lệnh, nhờ người dùng tự chạy (Freebuff quản
   lý credential git, agent không tự cấu hình).

## 2. Điều khoản cứng — TUYỆT ĐỐI KHÔNG

1. **Không đọc file secret**: `.env`, `bot/.env`, `bot/.bot-key`, `*.pem`, `*.key`.
   Permission trong `opencode.json` đã chặn. Nếu thấy cần nội dung env để trả lời →
   **dừng, hỏi người dùng**, không tìm lối tắt khác. Không bao giờ "giúp" bỏ qua
   `requireBotKeyStrict` hay cơ chế `botKey` (`convex/botAuth.ts`) — không có backdoor.
2. **Không `reset` / `clean` / `rebase` / sửa lịch sử.** `git add` + `git commit`
   được phép (điều khoản 5 phía trên). `git push` ĐƯỢC PHÉP **với điều kiện**:
   đã chạy đủ bộ kiểm chứng (test + typecheck + lint) XANH trong phiên và chỉ
   đẩy lên `main` sau khi đã báo cáo kết quả cho người dùng. Chưa kiểm chứng →
   chưa push. Gặp lỗi xác thực khi push → in lệnh cho người dùng tự chạy,
   không tìm lối tắt quanh credentials.
3. **Không tắt/dời process production**: `pm2 kill`, `systemctl restart` dịch vụ bot,
   `kill` PID lạ. Cần restart bot → in lệnh, nhờ người dùng tự chạy.
4. **Không cài dependency mới khi chưa hỏi.** Bot chạy Bun — ưu tiên thứ đã có trong
   `bot/package.json` / `package.json`. Lưu ý: `bun install` theo đúng lockfile trên máy
   mới **không phải** cài dependency mới — được phép, nhưng nên báo trước một dòng.
5. **Không sửa `convex/_generated/`** — sinh tự động bằng `bun convex dev --once`.
6. **Không đụng `vite.config.ts`** — `server.hmr: false` là có chủ đích (Freebuff yêu cầu).
7. **Không tạo framework test mới** — bám cấu trúc hiện có (mục 0).

## 3. Chuẩn code

- **Tiếng Việt** trong comment, log, user-facing string — sản phẩm tiếng Việt.
- Bot CommonJS trong `bot/src/`; test bot CommonJS `scripts/test-*.cjs`; test Convex TS
  `scripts/test-*.ts`.
- Sửa lỗi xong phải giải thích được **gốc rễ**, không phải chỉ "nó chạy rồi".
- Ưu tiên sửa file có sẵn, tránh sinh file mới trùng chức năng.
- Dashboard đồng bộ bot qua Convex trong ~1 phút — đừng kỳ vọng realtime khi test luồng cấu hình.

## 4. Bối cảnh dự án cần biết

- **Kiến trúc**: `bot/` (discord.js trên VPS) ⇄ Convex (DB + backend) ⇄ `src/` (dashboard web).
- **Bảo mật**: action bảo mật cao dùng `botKey = SHA-256("protogon-bot-key::" + OWNER_SEED)`
  (`convex/botAuth.ts`). Bot tự bootstrap key và cache vào `bot/.bot-key` (đã gitignore).
- **CI**: lint → test (coverage floor) → deploy Convex. Thay đổi làm CI đỏ coi như chưa xong.
- **Vấn đề đã biết**: Groq retire `llama-3.3-70b-versatile` 08/2026 — code có self-heal
  fallback `openai/gpt-oss-120b` trong `convex/haimiya.ts`; đừng hardcode lại model cũ.
  Gateway Kiira (`KIRA_API_KEY`/`KIRA_BASE_URL`/`KIRA_MODEL`) là provider AI chính của bot.
- **OAuth dashboard**: `DISCORD_CLIENT_ID` phải là snowflake số (regex `^\d{15,21}$`) —
  đã có bộ lọc `pickValidClientId` + test `scripts/test-oauth-client-id.cjs` chặn giá trị rác.

## 5. Lệnh hữu ích

```
bun run test              # toàn bộ test suites (~8s) — chạy sau MỌI thay đổi logic
bun tsc -b --noEmit       # typecheck
bun run lint              # ESLint
bun run test:coverage     # test + đo coverage (c8, có ngưỡng chặn)
bun run test:mutation     # mutation testing (phải 100% kill)
bun run smoke:vps         # smoke test môi trường VPS (env + module + Discord login)
sh ./scripts/setup-vps-agent.sh   # cài lại môi trường + OpenCode trên VPS
```

---

*Tài liệu này là hợp đồng: đổi nó phải có lý do chính đáng và ghi rõ trong commit message.*
