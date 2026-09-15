# AGENTS.md — Quy tắc cho AI coding agent trong repo Protogon

Repo này chứa **bot Discord production** (thư mục `bot/`) + **dashboard web** (React/Vite/Convex, thư mục `src/` + `convex/`) đang chạy thật trên Discord. Hãy làm việc như một kỹ sư cẩn trọng, không phải một người thử nghiệm.

## Tuyệt đối không

1. **Không đọc file secret**: `.env`, `bot/.env`, `bot/.bot-key`, `*.pem`, `*.key`. Cấu hình permission trong `opencode.json` đã chặn — nếu thấy mình cần nội dung env để trả lời, hãy **dừng và hỏi người dùng** thay vì tìm cách khác.
2. **Không tự commit / push / reset / clean / rebase**. Sửa code xong thì in `git diff` và **dừng lại chờ người dùng review**. Người dùng tự commit.
3. **Không chạy lệnh tắt/di dời process**: `pm2 kill`, `systemctl restart` dịch vụ bot, `kill` PID lạ. Nếu cần khởi động lại bot, in lệnh và nhờ người dùng tự chạy.
4. **Không cài dependency mới** khi chưa hỏi. Bot chạy Bun — ưu tiên dùng những gì đã có trong `bot/package.json` / `package.json`.
5. **Không sửa file trong `convex/_generated/`** — sinh tự động bằng `bun convex dev --once`.
6. **Không đụng `vite.config.ts`** (Freebuff yêu cầu HMR tắt — `server.hmr: false` là có chủ đích).

## Khi sửa code

- **Chạy kiểm tra sau mỗi thay đổi logic** (tất cả đã được allow trong permission, không cần hỏi):
  ```
  bun run test          # 30 test suites (~8s)
  bun tsc -b --noEmit   # typecheck
  bun run lint          # ESLint
  ```
  Thay đổi file trong `convex/` thì chạy `bun convex dev --once` trước typecheck (codegen).
- **Tuân theo cấu trúc hiện có**: bot CommonJS trong `bot/src/`, test CommonJS trong `scripts/test-*.cjs`, test TS cho convex đặt `scripts/test-*.ts`. Không tạo framework test mới.
- **Giữ phong cách tiếng Việt** trong comment/log/user-facing string — đây là sản phẩm tiếng Việt.
- **Mỗi lần vá bug phải kèm test chặn tái diễn** nếu bug thuộc engine đã có test (antinuke, altDetection, heat, joinGate, backup…).

## Bối cảnh dự án cần biết

- **Kiến trúc**: `bot/` (discord.js process chạy trên VPS/hosting) ⇄ Convex (DB + backend) ⇄ `src/` (dashboard web). Dashboard và bot đồng bộ qua Convex trong ~1 phút.
- **Bảo mật**: các action bảo mật cao dùng `botKey = SHA-256("protogon-bot-key::" + OWNER_SEED)` (`convex/botAuth.ts`) — không có backdoor. Đừng bao giờ "giúp" bỏ qua `requireBotKeyStrict`.
- **CI**: lint → test (coverage floor) → deploy Convex. Thay đổi nào làm CI đỏ coi như chưa xong.
- **Vấn đề đã biết**: Groq retire `llama-3.3-70b-versatile` 08/2026 — code có self-heal fallback `openai/gpt-oss-120b` trong `convex/haimiya.ts`; đừng hardcode lại model cũ.

## Lệnh hữu ích

```
bun run test:coverage      # test + đo coverage (c8, có ngưỡng chặn)
bun run test:mutation      # mutation testing (phải 100% kill)
bun run smoke:vps          # smoke test môi trường VPS (env + module + Discord login)
sh ./scripts/setup-vps-agent.sh   # cài lại môi trường + OpenCode
```
