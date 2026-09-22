# Nhật ký tiến trình agent

> Agent ghi vào đây qua skill **progress-journal**. Entry mới nhất trên cùng,
> tối đa ~30 entry. Mục "Đang dở" là danh sách việc chưa xong — đọc đầu tiên
> mỗi phiên.

## Đang dở

- **Dọn nốt bản dịch chết còn lại** (di sản các đợt viết lại copy) — số đo 22/09 sau lượt này: guard
  báo **119 bản EN chết** (liệt kê đầu danh sách là các câu Haimiya + landing cũ) và **12 bản DE mồ
  côi**. In nguyên văn entry cần xoá: `node scripts/_i18n-dead-lines.cjs --file=<tên file>`
  (chia khối bằng `--from/--to`), bản DE mồ côi: `--orphan-de`. Xong thì `node scripts/check-i18n.cjs`
  không còn mục ℹ️ nào.
- 🚧 **Chặn kỹ thuật đã xác định được quy luật (đọc trước khi làm tiếp)**: công cụ patch
  (`str_replace`) chỉ sửa được **vùng ĐẦU của file lớn** — trong `src/lib/i18n.en.ts` (87 KB) sửa được
  entry ở offset ~5 KB nhưng mọi `oldString` lấy từ offset ~56 KB đều báo "not found" (dòng tồn tại
  thật, `grep` xác nhận; `i18n.de.ts` 92 KB và các file từ điển lớn tương tự). Quy tắc rút ra:
  1. **Đừng sửa key ở cuối file từ điển lớn** — muốn đổi câu hiển thị thì tạo key MỚI chèn ở vùng đầu
     (patch được) và chấp nhận entry cũ thành bản dịch chết (guard báo mềm), HOẶC ghi đè giá trị
     EN/DE cho **cùng key** bằng entry trùng tên trong `i18n.*.labels.ts`/`.panels.ts` (file nhỏ, gộp
     sau nên thắng) khi không cần đổi chính chuỗi VI.
  2. Việc cần xoá entry ở vùng cuối → ghi vào danh sách nợ này, chờ phiên có công cụ đọc đủ file.
     Nợ hiện tại từ lượt này: 2 entry `"embed moderation kiểu Carl-bot"` (EN + DE) trong
     `i18n.en.ts`/`i18n.de.ts` đã chết vì UI đổi sang key `"embed hình phạt chi tiết"`.
  3. `str_replace` cũng có lúc báo "file does not exist" hoặc dùng snapshot cũ cho file vừa ghi → luôn
     `grep`/`read_files` kiểm lại nội dung trên đĩa sau mỗi lần áp patch.

---

## 2026-09-22 — Trang pháp lý 3 route + rà soát copy AI-slop + siết cổng nội dung đa ngữ

- ✨ **Ba trang pháp lý công khai, URL riêng**: `/terms` · `/privacy` · `/data-deletion` (Discord chỉ
  xác minh bot khi ToS + Privacy có URL riêng, không cần đăng nhập — dùng luôn tên miền dashboard,
  không phải nuôi site phụ). Nội dung thật 3 thứ tiếng ở `src/lib/legalContent.ts`: **3 văn bản ×
  3 ngôn ngữ × 9 mục**, viết theo đúng dữ liệu bot thật (bảng `users/sessions/guilds/modActions/
guildBackups/antinukeEvents/memberJoins`, backup AES-256-GCM, gist GitHub, phiên dashboard).
- 🎨 `src/pages/LegalPage.tsx`: MỘT component dùng chung cho 3 route (khác tham số `slug`) — layout
  editorial (mục lục sticky, mục đánh số 01/02…, khối tóm tắt, liên kết chéo 3 văn bản, CTA liên hệ,
  nút về đầu trang), đi qua `translate()` như mọi trang khác. Đổi văn bản tự cuộn về đầu trang.
- 🔍 **Cổng i18n mới 3f — không có lỗ miễn trừ**: file đánh dấu `@i18n-content` được miễn luật "nhãn
  dữ liệu phải có bản EN", ĐỔI LẠI phải qua kiểm tra CẤU TRÚC bằng parser: cây `vi` vs `en`/`de` phải
  trùng đường dẫn, không ô rỗng, không đoạn nào giữ nguyên tiếng Việt. 3 test mới trong
  `test-i18n.cjs` (đủ 3 ngôn ngữ → xanh; thiếu nhánh DE → đỏ; BỎ marker → vẫn đỏ vì luật nhãn dữ liệu)
  chứng minh miễn trừ không phải lỗ.
- 🧹 **Rà soát copy AI-slop/sai** (đợt này): bỏ tên model/hãng khỏi câu chào hàng (`AI Mimu v2.5` →
  "hệ thống đọc lại hàng trăm tin nhắn…"), bỏ **4 chỗ gọi tên bot đối thủ** ("kiểu Carl-bot" → "embed
  hình phạt chi tiết" / "(hình phạt, lý do, người xử lý)"), sửa câu nói **sai số module** ("…cùng 12
  module chống nuke khác" sau danh sách 8 module → "Đang hiển thị 20/32 module. 12 module chống nuke
  còn lại bật/tắt trong dashboard."), và Haimiya hết bị quảng cáo là "chỉ tiếng Việt" (nay đúng: trả
  lời theo ngôn ngữ đang chọn) — kèm bản EN/DE cho mọi câu mới.
- 🐛 **Bug tương phản thật ở trang chủ**: khối "Khóa kênh khi raid" hardcode `text-white` + `bg-white/5`
  → ở theme SÁNG là chữ trắng trên nền trắng, không đọc được. Chuyển sang token theme
  (`border-border`/`bg-secondary`/`text-foreground`) + test chặn tái diễn trong `test-web-contracts.cjs`
  (bỏ qua dòng comment).
- 🧪 `test-web-contracts.cjs` +21 case: 3 route pháp lý tồn tại, KHÔNG bọc `RequireAuth`, đứng trước
  catch-all; footer trỏ đủ 3; `legalContent.ts` có marker + đủ 3 bộ ngôn ngữ + mỗi slug đủ 3 bản;
  sitemap có 3 URL; chuỗi `translate("…")` không còn tên bot khác.
- 📄 `docs/repo-map.md` (+2 dòng), `public/sitemap.xml` (+3 URL), `public/llms.txt` (danh sách trang
  công khai + sửa câu "Haimiya tiếng Việt").
- 🐛 Sửa **regression tiềm ẩn từ lượt trước**: `scripts/test-haimiya-web.ts` bắt cứng cụm "riêng tư"
  trong câu trả lời OWNER_ONLY_ANSWER (đã đổi giọng ở đợt siết rò rỉ tính năng ẩn) → 5/5 suite TS
  đang đỏ. Nay khớp theo NGỮ NGHĨA (`/riêng tư|riêng của chủ sở hữu bot|không chia sẻ công khai/`).
- ✅ Kiểm chứng: `59/59 suites` · `test:ts 5/5` · `tsc` · `lint` · `format:check` · `check-repo-map`
  (11 trang) · `check-convex-contract` · `check-i18n` (0 FAIL) · `bun convex dev --once` OK.

---

## 2026-09-22 — Dọn bản dịch chết: xong 12 entry rồi bị CHẶN bởi công cụ patch với chuỗi tiếng Việt

- ✅ Xoá **12 entry chết** trong `src/lib/i18n.en.ts` (bản cũ của các câu đã viết lại: "Tắt nếu không
  muốn cảnh báo…", "Từ ngữ tối đa 40 ký tự", "Xem thêm..."…). Mỗi key đều đối chiếu bằng
  `scripts/_i18n-dead-lines.cjs` (không xuất hiện ở `src/` + `convex/`) trước khi xoá.
- 🚧 **Không dọn hết trong phiên này — chặn ở công cụ, không phải ở code.** `str_replace` trả "old
  string not found" cho MỌI entry chứa tiếng Việt của `i18n.en.ts`, dù đã loại trừ từng giả thuyết:
  - `grep` + script đọc file khẳng định dòng tồn tại và **đúng NFC** (kiểm codepoint: ả = 1EA3,
    ệ = 1EC7);
  - gửi lại ở dạng **NFD** (`a + U+0302 + U+0301`) vẫn "not found" → không phải lệch chuẩn hoá phía
    mình;
  - `oldString` **ASCII** trong CÙNG file (`"Backup server": "Server backup",`) áp bình thường;
  - `write_file` ghi tiếng Việt xuống đĩa **đúng NFC** (kiểm bằng codepoint) → loại trừ "transport
    làm hỏng tiếng Việt".
    ⇒ Chỉ nhánh _so khớp khi thay thế_ lỗi, và chỉ với ký tự có dấu. Đã báo người dùng; **không lách
    bằng shell** vì luật môi trường cấm sửa file bằng sed/script.
- ⚠️ Nợ phát sinh cần dọn cùng lượt sau: 12 bản DE của 12 entry vừa xoá giờ là **DE mồ côi** (guard báo
  MỀM, không làm đỏ CI).
- 🧪 Kiểm chứng (xanh hết): **59/59 suites** · `tsc` · `lint` · `format:check` · `check-i18n` (0 FAIL).
- 📁 File đụng: `src/lib/i18n.en.ts`, `docs/agent-journal.md`

---

## 2026-09-22 — Trang chủ: 2 danh sách module chưa dịch + cổng i18n bắt được đúng kiểu lỗi này

- 🐛 Người dùng báo (ảnh chụp panel "Schutzmodule aktiv"): người dùng DE đọc nguyên tiếng Việt 20
  nhãn module. **Không phải thiếu bản dịch** — cả 20 nhãn đã có EN + DE trong `i18n.en|de.labels.ts`
  và `i18n.en|de.ts`; gốc rễ là `AntiNuke` (`src/components/landing/sections.tsx`) render `{m}`
  thẳng trong `.map()`. Mảng khai báo NGOÀI JSX nên không phải JsxText (cổng 3) cũng không phải
  `{x.label}` (cổng 3d) → **cả hai cổng mù**, chuỗi VI không bao giờ bị đòi bản dịch.
- ✅ Vá: `{translate(m)}` cho cả `nukeModules` lẫn `modModules`, kèm ghi chú `// i18n-ok` nêu rõ
  "nhãn dịch lúc render" để không ai tưởng chuỗi VI còn sót là bug.
- 🛡️ Thêm cổng CỨNG **3e** vào `scripts/check-i18n.cjs`: parser TS tìm `ARR.map((p) => …)` với ARR
  là mảng chuỗi VI khai báo trong CÙNG file rồi bắt `>{p}` chưa bọc `translate()`. Bỏ qua `key={p}`
  (thuộc tính, không phải chữ hiển thị) và mảng nhập từ file khác (không đủ dữ liệu để phán —
  tránh báo nhầm). Miễn trừ: `// i18n-ok` trong 2 dòng trên lời gọi `.map()`.
- 🧪 Đo TRƯỚC khi vá bằng script thăm dò AST tạm (`scripts/_i18n-raw-render-probe.cjs`, đã xoá):
  đúng 2 điểm (dòng 405/421); sau khi vá về **0**, và guard mới bắt lại được khi tạm khôi phục code cũ
  (đã kiểm bằng `git stash` file đó rồi pop lại).
- 🧪 `scripts/test-i18n.cjs` +**2 case**: fixture mảng VI render `{m}` ⇒ cổng phải đổ; bọc
  `translate(m)` ⇒ phải xanh (đối chứng, chứng minh test không xanh vô nghĩa).
- ℹ️ Quét thêm toàn `src/`: không còn chỗ nào dùng mảng VI + `.map()` inline khác.
- 🧪 Kiểm chứng: **59/59 suites** · `tsc` · `lint` · `format:check` · repo-map · convex-contract ·
  `check-i18n` (0 FAIL) — tất cả xanh.
- 📁 File đụng: `src/components/landing/sections.tsx`, `scripts/check-i18n.cjs`,
  `scripts/test-i18n.cjs`, `docs/{agent-journal,decision-log}.md`

---

## 2026-09-22 — Cổng i18n: vá 2 lỗi cổng tự-báo-nhầm, thêm mục "DE mồ côi", dọn 251 entry chết

- 🐛 2 lỗi của `scripts/check-i18n.cjs`, đều kiểu "cổng tự lừa mình":
  1. Đọc key từ điển ở nhánh NHÁY ĐƠN lấy nguyên văn ⇒ key chứa escape (`\n`, dấu `"`) không bao giờ
     khớp key trong code — bản dịch ĐÃ CÓ mà vẫn báo "THIẾU EN" (lộ ra đúng lúc bọc `translate()` cho
     câu xác nhận khôi phục nhiều đoạn).
  2. `codeFiles` chỉ loại base dict (`i18n.en.ts`/`i18n.de.ts`) ⇒ key sống sót nhờ entry của CHÍNH NÓ
     trong `i18n.*.panels.ts`/`.labels.ts` không bao giờ bị báo là chết (từ điển tự quét chính mình),
     che mất 223 bản dịch chết.
- ✅ Thêm mục báo **mềm** "bản DE mồ côi" (key DE không có bản EN): rác không bao giờ hiển thị vì
  tra cứu theo chuỗi VI + thiếu EN thì rơi về VI. Cố ý để mềm — nợ vệ sinh từ điển không nên làm đỏ CI.
- ✅ Dọn **251 entry chết** (bản cũ của các câu đã viết lại: tiền tố trùng, hậu tố khác):
  `i18n.en.panels.ts` 41 · `i18n.de.panels.ts` 41 · `i18n.en.ts` 85 · `i18n.de.ts` 84. Mỗi key đều
  được grep toàn `src/` (trừ từ điển) + `convex/` trước khi xoá.
- 🧪 `scripts/test-i18n.cjs` +1 case (fixture DE mồ côi ⇒ cổng báo nhưng vẫn xanh) và ghim `stdio` cho
  tiến trình con — trước đây case ĐỐI CHỨNG in ❌ của guard ra màn hình, dễ tưởng suite đỏ.
- ⚠️ Còn tồn (đo được, không giấu): 97 bản EN chết + 60/38 bản DE + 5 bản DE mồ côi → xem "Đang dở".
- 🧪 Kiểm chứng: 59/59 suites · tsc · lint · format · repo-map · contract · check-i18n xanh.
- 📁 File đụng: `scripts/check-i18n.cjs`, `scripts/test-i18n.cjs`,
  `src/lib/{i18n.en.ts,i18n.en.panels.ts,i18n.de.ts,i18n.de.panels.ts}`,
  `docs/{agent-journal,decision-log}.md` + script audit tạm `scripts/_i18n-dead-lines.cjs`

---

## 2026-09-20 — Kiểm tra sức khỏe AI bot + huấn luyện nhận diện raid/nuke

- 🔍 Chẩn đoán: chain fallback + offline an toàn vẫn tốt (test xanh); Kira gateway live (44 model) NHƯNG 2 default đã chết — Groq `llama-3.3-70b-versatile` (retire 08/2026) và Kira `mimo-v2.5-free` (không còn trong danh sách live). Bot không có self-heal như `haimiya.ts` → call model chết đốt cả chain.
- ✅ Vá `bot/src/ai.js`: default Groq → `openai/gpt-oss-120b`, Kira → `mimo-v2.5`, tự vá 400/404 thử lại 1 lần cùng provider, `KIRA_USE_PROXY=1` opt-in qua proxy retry local.
- ✅ "Huấn luyện": few-shot raid/benign + checklist dương tính giả + hiệu chuẩn confidence (≥0.8 chỉ khi ≥2 tín hiệu) cho cả 3 prompt; `classifyViolation` nhận `knownThreats` — mẫu scam bot tự học từ raid thật (filters → messages → AI, 0 token).
- 🧪 Test: ai-fallback +2 case (self-heal, prompt markers) · antinuke-ai +1 (knownThreats passthrough) · misfire-guard +2 (getter) · chat-flow-classify sửa mock (chỉ đọc user msg, ví dụ system không tính là tín hiệu) · eval live tay `scripts/test-ai-raid-eval.mjs` (6 case, SKIP khi không key). 55/55 suites · tsc · lint · format · repo-map · contract · i18n xanh.
- 📁 File đụng: `bot/src/{ai.js,handlers/filters.js,handlers/antinuke/{ai,messages}.js}`, `bot/README.md`, `AGENTS.md`, `scripts/{test-ai-fallback,test-antinuke-ai,test-misfire-guard,test-chat-flow-classify}.cjs` + mới `test-ai-raid-eval.mjs`, `docs/{decision-log,agent-journal}.md`
- ▶️ Tiếp theo: chạy `node scripts/test-ai-raid-eval.mjs` trên VPS (có key) để đo chính xác/trễ thực tế sau đợt huấn luyện này.

---

## 2026-09-20 — Nâng cấp nhận diện raid + vá log sai kênh/trùng (massJoin, routing, raidIntel)

- 🐛 3 gốc rễ tìm bằng test RED trên code cũ:
  1. `handleRaidJoin` multi-fire: mỗi join vượt ngưỡng chạy lại toàn pipeline → N-T+1 log "Raid thành viên!" + phạt lặp + recordEvent/sample trùng (test cũ còn ghi nhận hành vi bug).
  2. `deliverViaWebhooks` gửi case ban/kick qua webhook mặc định ở kênh log chung thay vì kênh hình phạt đã cấu hình (sai kênh); `inferEventType` gắn nhãn "raid" cho mọi log antinuke.
  3. Gate cụm ratio≥0.5 với điểm≥2 coi acc mới đơn lẻ là raid → báo raid oan sóng bạn bè acc mới.
- ✅ Vá: wave dedupe 1 sóng=1 xử lý (markHandled + reset joiners) · `raidLikely` yêu cầu ≥1 tín hiệu phối hợp cứng/≥2 mềm + `joinWaveVerdict` 3 mức raid/watch/calm (calm im lặng, watch vàng, raid đỏ) · gate cá nhân 3→4 · AI `aiAnalyzeRaid` phủ quyết trước phạt · `huntRaidSource` audit hủy diệt +5 / lành tính +2 · routing webhook đúng kênh + `inferEventType` export để test.
- 🧪 Test: false-positive +3 case (27), member-layers +4 (22, gồm dedupe/AI veto/gate 4), webhook-hub +10 routing (29), antinuke-ai +1 (40). 55/55 suites · tsc · lint · format · repo-map · convex-contract xanh.
- 📁 File đụng: `bot/src/handlers/antinuke/{shared,members,raidIntel,index}.js`, `bot/src/{util,webhookHub}.js`, 4 suite test, `docs/{decision-log,agent-journal}.md`
- ▶️ Tiếp theo: theo dõi production xem còn báo raid oan/kênh sai không; cân nhắc ngưỡng `raidLikely` nếu raid tool né (đổi tên/avt).

> Lưu ý phiên 20/09/2026: local từng đi sau `origin/main` 3 commit (đợt i18n).
> Nếu thấy cây thiếu `src/lib/i18n.tsx`/`LangSwitch.tsx` → pull trước khi làm.

---

## 2026-09-20 — Vá bot tự xoay botKey khi bị Convex từ chối + deploy production

- 🐛 Sự cố deploy thật: sau `pm2 restart`, Convex từ chối mọi call (`Chìa khóa
bot không hợp lệ (botKey)`) — file cache `/protogon/bot/.bot-key` lệch seed
  phía server, và `ensureBotKey()` chỉ bootstrap khi CHƯA có key → bot kẹt
  vĩnh viễn, phải nhờ người xóa tay cache. Chữa tức thời: xoay key thủ công
  (xóa cache → restart → bot bootstrap, prewarm 0/8 → 8/8).
- ✅ Vá gốc rễ `bot/src/convex.js`: `isBotKeyRejection()` nhận diện lỗi từ chối
  key (so khớp thông điệp đặc thù của botAuth.ts — không nhầm lỗi mạng); proxy
  `query/mutation/action` bắt lỗi này → `rotateBotKey()` (bỏ key + xóa cache
  file + bootstrap lại qua Discord token) → **retry đúng call đó 1 lần**. Lỗi
  mạng/validator khác KHÔNG xoay oan; xoay dồn dập bị chặn (flag `_rotating`).
- 🧪 TDD: thêm 4 case vào `scripts/test-convex-client.cjs` (red trên code cũ:
  call bị từ chối → chết, 0 lượt xoay; xanh sau vá: 1 lượt xoay + retry thành
  công + cache file ghi lại key mới + lỗi mạng không xoay). 28 pass.
- 🧪 Deploy: pull up-to-date · 4 lớp xanh · Convex bỏ qua (không đổi convex/) ·
  pm2 online ổn định, sync nhịp đều, prewarm 8/8, guild mới join được bắt.
- ▶️ Tiếp theo: không có — chờ yêu cầu mới

---

## 2026-09-20 — Review toàn bộ bot/src: vá 4 bug bảo mật/hành vi

- 🐛 4 bug thật khi review ~15k dòng `bot/src/`:
  1. `antinuke/messages.js` gọi `reportSignatureBatch` 2 lần liên tiếp trong
     nhánh raid → Convex dedupe tăng weight mỗi lần → 1 server tự nâng weight
     signature 1→2, vượt `MIN_WEIGHT_AGED=2` → signature "xác nhận bởi 1
     server" được phân phối toàn mạng (vỡ chống đầu độc relay).
  2. `joinGate.js` burst auto-lockdown chỉ gọi `botUpdateLockdown` (cờ tính
     năng) — không gọi `botLockState { until }` → `lockdownUntil` không bao
     giờ được ghi → `tickUnlocks` không mở → server khóa kênh VĨNH VIỄN.
  3. `interactionCreate.js` khai báo Map `verifyAttempts` (rate-limit captcha
     DM) + vòng dọn, nhưng KHÔNG BAO GIỜ check → spam nút "Nhận mã" = bot DM
     vô hạn. Vá: check 3 lần/10 phút trước khi tạo mã.
  4. `captchaStore.verifyCode` không hủy mã khi sai → brute-force 10^6 tổ hợp
     trong cửa sổ 5 phút đoán trúng captcha 6 chữ số. Vá: sai 5 lần hủy mã.
- ✅ Thêm suite `scripts/test-bot-contracts.cjs` (hermetic: regex + require
  captchaStore) chặn cả 4; suite 54 → **55**.
- 📁 File đụng: `bot/src/handlers/antinuke/messages.js`, `bot/src/handlers/joinGate.js`,
  `bot/src/handlers/interactionCreate.js`, `bot/src/captchaStore.js`,
  `scripts/test-bot-contracts.cjs`, `AGENTS.md`, `docs/repo-map.md`,
  `.opencode/plugins/guardrails.js`
- 🧪 Kiểm chứng: 55/55 suites · tsc · lint · format · repo-map · convex-contract xanh

## 2026-09-20 — Lá chắn hợp đồng web (test-web-contracts) + vá 3 bug dashboard/landing

- 🐛 3 bug thật khi scan `src/`:
  1. `OverviewPanel.RecentEvents` đọc `localStorage.getItem("wio_session_token")`
     thô → chế độ "Lưu đăng nhập" gửi blob JSON `{"t","e"}` làm token (backend
     từ chối), chế độ session gửi `""` → khối "hoạt động gần đây" luôn trắng.
     Vá bằng `getSessionToken()`.
  2. `Landing` dispatch event `"haimiya-open"` (hero + `HaimiyaSection`) nhưng
     KHÔNG mount `<HaimiyaChat/>` → bấm "Hỏi Haimiya" chết lặng. Vá: mount chat.
  3. `AnalyticsPanel` + `AuditLogPanel` chết (không ai import) vẫn nằm repo →
     hiểu nhầm còn dùng. Đã xoá (lịch sử thật do `GuildHistory` phục vụ).
- ✅ Thêm suite hermetic `scripts/test-web-contracts.cjs` chặn tái diễn cả 3:
  kỷ luật token (chỉ `lib/discord.ts` chạm storage thô), trang dispatch
  `haimiya-open` phải mount chat, không panel chết. Suite 53 → **54**.
- 📁 File đụng: `src/components/dashboard/OverviewPanel.tsx`,
  `src/pages/Landing.tsx`, `src/components/landing/shared.tsx`,
  `scripts/test-web-contracts.cjs`, `AGENTS.md`, `docs/{repo-map,agent-journal}.md`,
  `.opencode/plugins/guardrails.js`
- 🧪 Kiểm chứng: 54/54 suites · tsc · lint · format · repo-map · convex-contract ·
  i18n đều xanh

## 2026-09-20 — Đa ngôn ngữ VI/EN phủ HẾT (gồm chuỗi nội suy) + thu gọn layout mobile

- 🐛 Gốc rễ "một số nút/nội dung không đổi sang tiếng Anh": lá chắn cũ chỉ rà
  bằng **regex theo dòng** nên bỏ sót 2 nhóm — text node một từ/nhiều dòng và
  chữ Việt nằm trong `{…}` (ví dụ `{cond ? "Trực tuyến" : "Không hoạt động"}`,
  `` ` · lần cuối ${x}` ``). Ngoài ra nhãn dữ liệu cấp module render trực tiếp
  (`{ANTINUKE_MODULE_META[m].label}`, `{HEAT_TIER_LABEL[tier]}`, `{group.label}`)
  chưa qua translate() nên không bao giờ dịch.
- ✅ `scripts/check-i18n.cjs` nay phân tích bằng **parser TypeScript**
  (`ts.isJsxText` + duyệt `JsxExpression`) → phủ text node nhiều dòng, biểu thức
  `{}`, template literal, thuộc tính JSX; **FAIL cứng** thay vì cảnh báo mềm.
  Có cơ chế miễn trừ tường minh `// i18n-ok: <lý do>` cho nhãn được dịch lúc
  render (không dùng để che lỗi).
- ✅ Dịch trọn phần còn lại: **+225 key EN** (`src/lib/i18n.en.panels.ts` — đợt 2,
  gộp trong `i18n.tsx` bằng `DICT = { ...EN, ...EN_PANELS }`), sửa cả key nháy
  đơn (`translate('Chỉnh sửa "{p0}"')`) mà regex cũ bỏ sót. Hiện **1018 key
  translate() ⇄ 1080 bản EN, 0 mục chưa dịch**.
- ✅ Mobile: thu gọn padding/khoảng cách (`p-5` → `p-4 sm:p-5`, `p-6`,
  `space-y-6`, `gap-5`) trên toàn dashboard + landing; nav mục cấu hình thành
  **app tab bar dính trên đầu** (`max-lg:sticky`, `-mx-3` chạm mép, nền mờ) để
  đổi mục không phải cuộn ngược; `#root` thêm `max-width: 100%` và trên
  mobile cho phép ngắt chuỗi trong `code/.font-mono` (`overflow-wrap: anywhere`)
  — nguồn tràn phải phổ biến nhất là ID/URL/token không có khoảng trắng.
- ⚠️ Chưa kiểm chứng được bằng mắt: sandbox không có trình duyệt headless nên
  không đo được `scrollWidth` thật ở 360px. Bằng chứng hiện có: tsc/lint/format
  xanh, 53/53 suite, preview ready — nếu người dùng còn thấy tràn thì cần ảnh
  chụp đúng chỗ.

---

## 2026-09-20 — Fix "khoá kín" tràn ngang + thiết kế lại trang server cho điện thoại

- 🐛 Gốc rễ lỗi "nội dung bị khoá kín" (không xem được mép phải): `#root`
  đặt `overflow-x: clip` — cố ý để không bao giờ có thanh cuộn ngang — nhưng
  con của grid (`grid lg:grid-cols-[230px_1fr]`) thiếu `min-w-0`, nên nội
  dung rộng bên trong panel kéo cả track grid rộng hơn màn hình → phần tràn
  bị cắt vĩnh viễn thay vì cuộn tới được. Kèm theo: nav sidebar dùng `-mx-4`
  vượt quá padding 12px (`max-sm:px-3`) của container mobile.
- ✅ Sửa: thêm `min-w-0` cho con grid ở GuildPage/Admin/Monitor + bỏ `-mx-4`
  ở nav; header trang server tách 2 hàng cho mobile (hàng 1: quay lại + nhận
  diện server + hành động; hàng 2: dải badge cuộn ngang `-mx-3 px-3` khớp
  đúng padding nên chạm mép màn hình mà KHÔNG vượt), nút "Mời thêm" chỉ còn
  icon trên mobile, badge dùng chung 1 khai báo cho 2 hàng; padding header
  khớp padding nội dung (`max-sm:px-3`) để không lệch trục.
- ✅ Kèm: panel Alt Detection trước đây viết tiếng Việt KHÔNG DẤU ("Tat",
  "Canh bao", "Rui ro", "Luot join", "Yeu to"…) — trông như UI lỗi; đã thêm
  dấu + bọc translate + 22 key EN (nhãn rủi ro dùng key "Rủi ro …" vì
  "Trung bình" đã là key chỉ số thống kê khác).
- 📁 File đụng: `src/pages/{GuildPage,Admin,Monitor}.tsx`,
  `src/components/dashboard/AltDetectionPanel.tsx`, `src/lib/i18n.en.ts`,
  `docs/agent-journal.md`
- 🧪 Kiểm chứng: i18n OK · repo-map OK · contract OK · format · lint · tsc ·
  53/53 suites · preview ready (bản mới đã được serve, kiểm bằng cách tải
  module GuildPage/AltDetectionPanel qua Vite)
- ▶️ Tiếp theo: vẫn còn 144 câu nội suy trong panel chưa bọc translate
  (mục "Đang dở" của entry ngay dưới)

## 2026-09-20 — Đa ngôn ngữ VI/EN toàn web + Haimiya chat

- ✅ Xong: lõi i18n kiểu gettext (`src/lib/i18n.tsx` — LangProvider/useT,
  `translate()` toàn cục, `dateLocale()`; key = nguyên chuỗi tiếng Việt, thiếu
  bản EN thì rơi về VI nên không bao giờ vỡ UI) + từ điển `i18n.en.ts`
  (831 key); bọc `translate()` cho 769 literal trên src/ bằng codemod;
  công tắc VI/EN (`components/LangSwitch.tsx`) gắn vào nav landing, taskbar,
  header dashboard/GuildPage/Monitor/Admin/Stats/GuildHistory/auth
- ✅ Xong: phần giới thiệu Haimiya + toàn bộ 46 chuỗi kiến thức cục bộ có
  bản EN; chat dịch lúc render nên đổi ngôn ngữ là cập nhật ngay; action
  `haimiya.ask` nhận thêm arg optional `lang` để AI trả lời đúng ngôn ngữ
  (system prompt dùng placeholder `{LANG}`)
- 🐛 Bug tìm thấy khi rà: nhãn sidebar `NAV_ITEMS` là hằng số cấp module nên
  eval 1 lần lúc import — bọc translate() vẫn không dịch (đã sửa thành dịch
  lúc render) · 20 chỗ hardcode locale ngày/giờ `"vi-VN"` khiến người dùng EN
  vẫn thấy định dạng Việt · `WebhookPanel` dùng locale rác `"vi-VV"`
- 📁 File đụng: `src/lib/{i18n.tsx,i18n.en.ts,i18n.en.new.ts}`, ~45 file
  src/, `src/components/LangSwitch.tsx`, `convex/haimiya.ts`,
  `scripts/{check-i18n.cjs,test-i18n.cjs}`, CI + guardrails (52→53 suites) +
  AGENTS.md + `docs/repo-map.md`
- ⚠️ Chưa xong (đo được, không giấu): còn **144 dòng chữ Việt trong JSX**
  chưa bọc `translate()` — đều là câu bị nội suy nhiều mảnh (`{n}/{m} module
chống nuke bật`, `Đang khóa — tự mở sau ~{n} phút`…) trong 20 panel
  dashboard. Vá theo lối bọc từng mảnh sẽ ra tiếng Anh vụn (thứ tự từ lệch)
  nên cố ý KHÔNG làm: cách đúng là gộp mỗi câu thành 1 key có placeholder
  `{p0}` rồi dịch trọn câu. `node scripts/check-i18n.cjs` in ra danh sách này
  (mục ℹ️) để phiên sau đo tiến độ — bản dịch thiếu vẫn an toàn (rơi về VI,
  không vỡ UI).
- 🧪 Kiểm chứng: check-i18n OK (0 thiếu) · repo-map OK · contract OK ·
  format · lint · tsc · convex codegen · 53/53 suites · preview ready
  (HTTP 200, LangSwitch transform OK)
- ▶️ Tiếp theo: gộp 144 câu nội suy trong panel thành key có placeholder rồi
  dịch — mỗi panel một lượt, giữ check-i18n xanh sau từng lượt

## 2026-09-20 — Audit hợp đồng + 2 skill an toàn kiến trúc

- ✅ Xong: audit số suites lệch 3 nơi (49/41 → 52, CONTRACT_SUITES là nguồn
  duy nhất); thêm skill `convex-contract-guard` + script
  `check-convex-contract.cjs` (78 call bot ⇄ 191 exports, CI job lint) và
  skill `schema-migration-safety` (checklist 2 client lệch pha); AGENTS.md
  Pha 3/4 + ship.md + guardrails compaction + repo-map cập nhật đồng bộ
- 📁 File đụng: `AGENTS.md`, `scripts/check-convex-contract.cjs`,
  `.opencode/skills/{convex-contract-guard,schema-migration-safety}/SKILL.md`,
  `.github/workflows/ci.yml`, `docs/repo-map.md`, `.opencode/{commands,plugins}`
- 🧪 Kiểm chứng: format OK · lint OK · 52/52 suites · repo-map OK ·
  contract OK + self-test script bắt đúng lỗi giả lập
- 🧹 Dọn dẹp cuối phiên: sửa 2 SKILL.md vỡ code fence + dọn thư mục rác
  `.tmp-contract-test/` (dùng nhầm làm TMPDIR, đã mv ra /tmp giữ nguyên dữ liệu)
- ▶️ Tiếp theo: không có — chờ yêu cầu mới

## 2026-09-20 — Thêm 2 skill tiết kiệm token

- ✅ Xong: skill `token-economy` (search-first, đọc cửa sổ) + `verification-loop`
  (gộp bộ kiểm chứng 1 lệnh, re-check tối thiểu theo bảng delta)
- 📁 File đụng: `.opencode/skills/token-economy/SKILL.md`,
  `.opencode/skills/verification-loop/SKILL.md`
- 🧪 Kiểm chứng: format OK · lint OK · 52/52 suites (audit cấu trúc hợp đồng)
- ▶️ Tiếp theo: pull về VPS để OpenCode session mới nhận 2 skill

## 2026-09-20 — Merge redesign + polish Taskbar/nav/loading

- ✅ Xong: merge `redesign/vercel-monochrome` → main (`d81ed45`), nav scroll
  mượt + scroll-margin, RouteFallback thành progress bar thương hiệu, Taskbar
  pill mới có Escape/click-outside
- 📁 File đụng: `src/components/Taskbar.tsx`, `src/App.tsx`,
  `src/components/landing/Nav.tsx`, `tailwind.config.ts`
- 🧪 Kiểm chứng: 51/51 suites · tsc OK · build 8.3s · production active
  (bundle `index-DloJ15Ak.js`)
- ▶️ Tiếp theo: không có — chờ feedback UI từ người dùng
