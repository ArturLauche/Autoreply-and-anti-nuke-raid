# Spec — Tính năng Khiếu nại (ticket) cho bot Protogon

> Trạng thái: **spec, chưa code** (27/09/2026). Mọi đường dẫn file/function trong
> đây là dự kiến, đã đối chiếu với code hiện tại. Trước khi code phải chốt
> mục 17 (Câu hỏi cần user quyết).

## 1. Vấn đề

Protogon phạt **tự động**. Đếm số nơi gọi `member.ban()` ngay trong repo:

| Nơi ban                                      | Nguồn phạt                     |
| -------------------------------------------- | ------------------------------ |
| `bot/src/handlers/modTools.js:133`           | mod gõ tay `/mod ban`          |
| `bot/src/heat.js:140`                        | nhiệt độ vượt ngưỡng ban       |
| `bot/src/altDetection.js:536`                | Alt / VPN detection            |
| `bot/src/handlers/joinGate.js:115`           | Join Gate không đạt            |
| `bot/src/handlers/antinuke/audit.js`         | audit log phá hoại (2 chỗ)     |
| `bot/src/handlers/antinuke/externalApp.js`   | raid bằng external app (3 chỗ) |
| `bot/src/handlers/antinuke/raidIntel.js:222` | săn raid từ intel              |

7 lớp phạt tự động. Nhưng **không có đường thoát nào cho người bị phạt**:

- Bot **không hề gửi DM** khi phạt. `punishNotice` trong `convex/schema.ts` chỉ
  quyết định _mức chi tiết_ của embed gửi vào kênh log (`bot/src/caseLog.js:74`),
  không liên quan tới việc báo cho chính người bị phạt.
- Lệnh `/mod unban` có sẵn (`modTools.unbanMember`) nhưng người bị ban không biết
  nó tồn tại, và cũng không có cách nào tiếp cận mod.

Hệ quả đã được dự đoán và **repo đã chuẩn bị sẵn cơ chế đo**:
`bot/src/misfire.js` đếm "phạt nhầm đã xác nhận" — mod gỡ phạt tự động trong 7
ngày. Hiện tại con số này chỉ được AI đọc để tự thận trọng hơn
(`ai.js` bias −0.05 khi ≥5 vụ). Chưa có đường nào để **thu thập** tín hiệu phạt
nhầm từ phía người bị phạt. Ticket làm đúng việc đó.

Đây là lý do nên làm. Không phải vì "tính năng ticket phổ biến".

## 2. Phạm vi

**Trong (MVP):**

- 2 điểm vào (mục 3, mục 4)
- 1 loại ticket: khiếu nại hình phạt
- Kênh văn bản riêng cho mỗi ticket, tự động thu quyền khi đóng
- 4 nút thao tác cho staff: Gỡ ban / Đóng / Ghim / Ghi chú AI
- Dashboard: bật-tắt, chọn category, chọn role staff, danh sách ticket
- Bảng dữ liệu + hợp đồng bot ⇄ Convex đầy đủ

**Ngoài (không làm lần này — ghi rõ để không ai tưởng là quên):**

- Hàng đợi nhiều ticket / phân công / SLA / thang đo CSAT
- Form ticket tuỳ biến nhiều trường, loại ticket khác (mua hàng, báo lỗi)
- Gửi email thông báo
- Tự động đóng ticket quá hạn (xem mục 15)
- Bot trả lời qua DM hai chiều cho người bị ban (xem mục 4.3 — đây là giới hạn
  kỹ thuật thật của Discord, không phải lười)

## 3. Điểm vào A — DM kèm nút sau khi bị ban

### 3.1 Vì sao phải qua DM

Người bị ban **không vào được bất kỳ kênh nào** của server. `/ticket` trong
server là vô nghĩa với họ. Đây là ràng buộc cứng của Discord, không phải
lựa chọn thiết kế.

### 3.2 Luồng

1. Sau khi ban thành công, `modTools.banMember` gọi
   `noticePunishDm(guild, guildConfig, user)` (hàm mới, mục 9.2).
2. Hàm này kiểm tra `guildConfig.ticketEnabled` và có nên DM (mục 11.2).
3. Gửi DM cho người bị ban: giải thích **lý do ban** (lấy từ tham số `reason`
   sẵn có) + 1 embed + 1 hàng nút:

   ```
   [ Mở khiếu nại ]        ← customId: ticket_open_dm
   [ Xem quy tắc server ]  ← optional, bỏ trong MVP
   ```

4. Bấm nút → bot mở **modal** (`ticket_appeal_dm`) hỏi:
   - `ly_do` — "Bạn cho rằng mình bị phạt oan vì…" (bắt buộc, ≤1000 ký tự)
   - `bang_chung` — link/tên vi phạm bị cho là có (tuỳ chọn, ≤500)
5. Bot ghi bản ghi ticket + tạo **kênh staff-only** trong category đã cấu
   hình (`ticket-staff-#N`), dán embed tóm tắt + nội dung khiếu nại, **reply
   lại trong DM**: "Đã gửi khiếu nại, ban quản trị sẽ xem."

### 3.3 Ranh giới kỹ thuật phải nói rõ

Bot **không thể** mở kênh mà người bị ban đọc được. Nên với điểm vào A, luồng là
**một chiều**: người bị ban gửi → staff đọc. Chiều ngược lại staff gửi lại
qua **panel DM đã có sẵn** (`src/components/dashboard/DmPanel.tsx`, mutation
`hidden.requestDm`) hoặc qua nút **Gỡ ban** ngay trong kênh ticket. MVP không
dựng relay hai chiều.

Lý do không dựng relay: nó cần bot nghe `messageCreate` trong DM (sự kiện DM
là `InteractionCreate`-free, phải bật thêm partial + gateway intent riêng), lưu
hàng đợi tin nhắn, và có nguy cơ bot thành kênh chat thay người dùng. Đẩy sang
đợt sau nếu thật cần.

## 4. Điểm vào B — lệnh `/ticket` trong server

### 4.1 Ai dùng được

Thành viên **đang ở trong server**: bị timeout, bị cảnh cáo, bị Alt Detection
nghi ngờ, chưa xác minh được, cần hỏi mod. Đây là nhóm dùng thật và dùng nhiều
hơn nhóm bị ban.

### 4.2 Luồng

1. `/ticket` (subcommand `mở` — tên tiếng Việt? **không**, tên lệnh phải là
   tiếng Anh lowercase theo luật Discord; dùng `/ticket` + option `type` nếu
   cần, MVP không có option).
2. Kiểm tra: ticket mở, người gọi không phải bot, không trong lockdown.
3. Tạo kênh `ticket-<username-lowercase-dashed>` trong category, **mở quyền
   cho chính người gọi + role staff**, chặn `@everyone`.
4. Trong kênh: embed giới thiệu ("Mô tả chuyện bạn cần, staff sẽ phản hồi"),
   1 hàng nút thao tác (mục 8).
5. Staff trả lời **ngay trong kênh** — hai chiều tự nhiên, không cần kỹ thuật
   gì thêm.

### 4.3 `/ticket` không dùng được cho người bị ban

Cần nói rõ trong mô tả lệnh (tiếng Việt + EN + DE): "Lệnh này dành cho thành
viên **đang trong server**. Nếu bạn bị ban, hãy dùng nút trong tin nhắn riêng
mà bot đã gửi." Tránh user bị ban gõ `/ticket` rồi nhận "❌".

## 5. Vòng đời ticket

```
   (mở)                (đóng)              (khoá)
 ─────────► open ──────────────────► closed ──────► locked
               │                                        │
               │ staff bấm "Gỡ ban"                     │ tự động sau 24h
               ▼                                        │ (mục 15)
          unbanned(ghi chú vào mod log)                ▼
                                                   transcript
                                                   (nếu bật)
```

- `open` → `closed`: staff bấm **Đóng**. Bot thu quyền người mở, đổi tên kênh
  `closed-<n>`, ghim lại lý do đóng.
- `closed` → `locked`: xoá kênh sau 24h (chưa làm ở MVP — mục 15).
- Mọi chuyển trạng thái đều ghi vào `modActions` qua
  `bot_writes:botRecordModAction` (sẵn có) để dashboard và kênh mod log thống
  nhất. **Không** phát minh embed log mới.

## 6. Dữ liệu — bảng `tickets`

Bám khuôn `giveaways` (`convex/schema.ts:286`): có `status` union, có
`.index("by_status")`.

```ts
tickets: defineTable({
  guildId: v.string(),
  /** Số thứ tự tăng dần của server, giống modCaseCounter (dùng chung bộ đếm). */
  number: v.optional(v.number()),
  channelId: v.string(),          // kênh ticket (luôn có, kể cả điểm vào A)
  openerId: v.string(),           // người mở
  openerName: v.string(),         // username tại lúc mở (hiển thị sau khi rời)
  /**
   * Loại ticket. KHÔNG phải "lý do ban" như bản spec đầu: người dùng điểm vào
   * B (lệnh `/ticket`) không bị ban cũng mở được, nên cần một trục trung tính
   * dùng được cho cả hai điểm vào.
   *   "appeal"  — khiếu nại hình phạt (bot ban/kick/timeout)
   *   "support" — hỏi đáp / báo cáo chung
   */
  kind: v.string(),               // "appeal" | "support"
  /** Nội dung người dùng viết. */
  body: v.optional(v.string()),   // ≤1000, đã escape mention
  /** Bằng chứng / tên người bị cho là có (tùy chọn, ≤500). */
  evidence: v.optional(v.string()),
  /** "dm" | "command" — điểm vào, để đo luồng nào sinh khiếu nại nhiều. */
  source: v.string(),
  status: v.union(
    v.literal("open"),
    v.literal("closed"),
    v.literal("locked"),
  ),
  claimedById: v.optional(v.string()),
  closedById: v.optional(v.string()),
  closedByName: v.optional(v.string()),
  closeReason: v.optional(v.string()),
  /** true nếu staff bấm Gỡ ban ngay trong ticket — đầu vào cho misfire. */
  unbanned: v.optional(v.boolean()),
  /** Bot không gửi được DM khi bot mở ticket từ DM (user chặn DM). */
  openError: v.optional(v.string()),
  openErrorAt: v.optional(v.number()),
  createdAt: v.number(),
  closedAt: v.optional(v.number()),
})
  .index("by_guildId", ["guildId"])
  .index("by_guildId_status", ["guildId", "status"])
  .index("by_guildId_createdAt", ["guildId", "createdAt"])
  // Index riêng cho hàng rào cooldown: đếm "lần mở gần nhất CỦA CHÍNH người
  // này". KHÔNG dựa vào `order("desc")` trên index (guildId, status) —
  // xem giải thích ở `convex/tickets.ts`.
  .index("by_guildId_openerId", ["guildId", "openerId"]),
```

**Không** lưu transcript tin nhắn trong Convex ở MVP. Transcript = 50 tin nhắn
JSON/kênh, vài trăm ticket là vài MB không cần thiết; `bot/src/backupUtils.js`
đã có kinh nghiệm xử lý khối tin nhắn lớn. Nếu sau này cần thì lưu vào storage
(`v.optional(v.id("_storage"))`) như `guildBackups.importStorageId` đang làm.

## 7. Cấu hình — field mới trong bảng `guilds`

Tất cả `v.optional`, không migration dữ liệu cũ:

| Field                 | Kiểu    | Mặc định  | Ý nghĩa                                               |
| --------------------- | ------- | --------- | ----------------------------------------------------- |
| `ticketEnabled`       | boolean | `false`   | Tắt mặc định — không đổi hành vi server nào đang chạy |
| `ticketCategoryId`    | string? | null      | Category chứa kênh ticket                             |
| `ticketStaffRoleId`   | string? | null      | Role staff (mặc định lấy `modRoles`)                  |
| `ticketMaxOpen`       | number  | 20        | Tối đa ticket `open` cùng lúc                         |
| `ticketCooldownHours` | number  | 24        | Giữa 2 lần mở của cùng 1 người                        |
| `ticketDmOnBan`       | boolean | `true`    | Gửi DM kèm nút sau ban                                |
| `ticketDefaultKind`   | string? | `support` | Loại ticket khi bấm nút trong DM (không chọn loại)    |
| `ticketCloseNote`     | string? | null      | Lời nhắc dán trong kênh ticket                        |

**Cửa bắt buộc:** 7 field này phải đi qua đủ 4 cổng (mục 14) — nếu bỏ sót,
dashboard sẽ hứa "3 phút" nhưng bot mất 30 phút mới thấy (bug 23/09).

## 8. Nút thao tác trong kênh ticket

| Nút               | customId                  | Ai bấm được | Việc                                 |
| ----------------- | ------------------------- | ----------- | ------------------------------------ |
| Đóng ticket       | `ticket_close:<ticketId>` | staff       | Thu quyền, đổi tên `closed-<n>`      |
| Gỡ ban            | `ticket_unban:<ticketId>` | staff       | `unbanMember` + ghi `unbanned: true` |
| Ghim              | `ticket_pin:<ticketId>`   | staff       | Pin embed tóm tắt                    |
| Ghi chú AI        | `ticket_ai:<ticketId>`    | staff       | Mở modal 1 ô, chạy prompt tóm tắt    |
| Đánh dấu đã xử lý | `ticket_done:<ticketId>`  | staff       | Đóng + đóng bản ghi, ẩn nút          |

Quyền staff: dùng `canManageWithConfig(interaction.member, config)` — hàm có
sẵn trong `bot/src/util.js:221`, đúng chuẩn `modRoles`/`adminRoles` mà mọi lệnh
khác đang dùng. **Không** tự chế điều kiện quyền mới.

Nút "Gỡ ban" phải báo rõ nếu người đó không còn bị ban: `unbanMember` đã trả
lỗi tiếng Việt sẵn (`modTools.js:180`) — bắt và hiện ephemeral, không nuốt.

## 9. File dự kiến thêm/sửa

### 9.1 Mới

| File                                       | Vai trò                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `convex/tickets.ts`                        | query/mutation phía web (giống `guildConfig.ts` + `guilds.ts`)                              |
| `bot/src/handlers/tickets.js`              | handler: tạo kênh, xử lý button/modal, đóng                                                 |
| `bot/src/ticketCore.js`                    | **hàm thuần**: tên kênh hợp lệ, kiểm tra cooldown, dựng embed — test được không cần Discord |
| `scripts/test-tickets.cjs`                 | test cho `ticketCore` (node:test, CJS)                                                      |
| `scripts/test-tickets-handler.cjs`         | test phần Discord của `tickets.js` (quyền kênh, hàng rào, escape bảo mật)                   |
| `scripts/test-tickets-convex.ts`           | test 5 function của `convex/tickets.ts` (quyền, thứ tự, chống đóng nhầm ticket)             |
| `src/components/dashboard/TicketPanel.tsx` | panel cấu hình + danh sách ticket                                                           |

### 9.2 Sửa

| File                                    | Sửa gì                                                                                 |
| --------------------------------------- | -------------------------------------------------------------------------------------- |
| `convex/schema.ts`                      | + bảng `tickets`, + 8 field vào `guilds`                                               |
| `convex/bot_writes.ts`                  | + `botOpenTicket`, `botCloseTicket`, `botSetTicketChannel` — cần `requireBotKeyStrict` |
| `convex/guilds.ts`                      | + 8 field trong `getBotConfig` **và** trong args/patch của `updateSettings`            |
| `bot/src/commands/slash.js`             | + lệnh `ticket` (3 subcommand `mo`/`khieunai`/`dong`)                                  |
| `bot/src/commands/localizations.js`     | + mục `ticket` (EN + DE) — thiếu là test đỏ                                            |
| `bot/src/handlers/interactionCreate.js` | nối `tickets.js` vào nhánh `isButton()` / `isModalSubmit()`                            |
| `bot/src/handlers/modTools.js`          | `banMember` gọi `noticePunishDm` sau khi ban thành công                                |
| `bot/src/convex.js`                     | `CONFIG_WRITE_MUTATIONS` + 2 mutation mới                                              |
| `src/pages/GuildPage.tsx`               | + `SectionKey`/`NAV_ITEMS`/`NAV_GROUPS` (nhóm "Vận hành")                              |
| `src/lib/i18n.en.ts` / `i18n.de*.ts`    | + key EN/DE (mục 12)                                                                   |
| `docs/repo-map.md`                      | + 1 dòng panel, + 1 dòng module bot, + 1 dòng convex                                   |

**Cố ý KHÔNG đụng `bot/src/misfire.js`**: `unbanMember` đã gọi
`misfire.noteRepealed` sẵn (`modTools.js:185`) → nút "Gỡ ban" trong ticket tự
động chạy vòng đo phạt nhầm, không cần viết lại. Đây là lý do nút Gỡ ban phải
gọi `unbanMember` chứ không gọi `guild.members.unban` trực tiếp.

## 10. Test

| Suite                                     | Loại | Cần bắt được                                                                                                                                             |
| ----------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test-tickets.cjs` (mới)                  | CJS  | tên kênh hợp lệ Discord (chữ thường, `-`, ≤100, không ký tự lạ); cooldown; `ticketMaxOpen`; reason rỗng; cắt 1000 ký tự; embed không lộ role `@everyone` |
| `test-slash-command-contract.cjs` (đã có) | CJS  | `/ticket` phải có trong `localizations.js`                                                                                                               |
| `test-convex-contract.cjs` (đã có)        | CJS  | 2 mutation mới có trong `CONFIG_WRITE_MUTATIONS`                                                                                                         |
| `test-settings-signal.cjs` (đã có)        | CJS  | 7 field có đường tín hiệu tới bot                                                                                                                        |
| `test-repo-map.cjs` (đã có)               | CJS  | panel + module + convex function có trong bản đồ                                                                                                         |
| `test-i18n.cjs` (đã có)                   | CJS  | mọi chuỗi mới có EN                                                                                                                                      |

`ticketCore.js` tách hàm thuần là để test được **không cần mock discord.js** —
cùng lý do `convex/guildConfig.ts` tách hàm thuần khỏi phần gọi db.

Sau khi thêm suite: cập nhật `CONTRACT_SUITES` trong
`.opencode/plugins/guardrails.js` **và** số liệu suite trong `AGENTS.md` trong
cùng một commit (luật của AGENTS.md mục 1).

## 11. Chống lạm dụng

Đây là phần dễ làm hỏng nhất. Không có nó, tính năng này là **vũ khí tự sát
của server**: 1 người spam 20 kênh/đêm là đủ chạm trần 500 kênh Discord.

| Vũ khí                          | Hàng rào                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------- |
| Spam mở kênh                    | `ticketCooldownHours` (24h) + `ticketMaxOpen` (20) + từ chối có lý do rõ ràng |
| Guild không còn slot kênh       | Bắt lỗi `MAX_GUILD_CHANNELS` của Discord → báo staff, **không** crash         |
| Bot thiếu quyền                 | Kiểm tra `ManageChannels` trước khi tạo → báo bằng tiếng Việt, không throw    |
| Bot thấp hơn role của người gọi | Discord từ chối ghi overwrite → bắt lỗi, báo "bot cần role cao hơn"           |
| Người gọi là bot                | Chặn ngay (`user.bot`)                                                        |
| Spam qua điểm vào A (DM)        | Cùng cooldown, tính trên `openerId` — **không** tách bộ đếm theo source       |
| Người gọi đã có ticket `open`   | Trả về kênh cũ thay vì tạo kênh mới                                           |
| Rò tin: ai đang ban ai          | Embed trong kênh staff chỉ hiện cho staff, kênh không mở `@everyone`          |
| Spam nội dung dài               | Cắt 1000 ký tự, escape mention để không ping role trong nội dung              |

**Escape mention là bắt buộc**: nội dung người dùng nhét vào embed phải bị
`@everyone` → `@‌everyone` (chèn zero-width). Không có bước này thì 1 người
gõ `@everyone` trong khiếu nại là ping cả server. Đây là lỗi kiểu đã xảy ra ở
rất nhiều bot.

## 12. i18n

Key = **chuỗi tiếng Việt** (kiểu gettext của repo), phải có EN + DE:

- "Khiếu nại", "Mở khiếu nại", "Kênh ticket", "Đóng ticket", "Gỡ ban",
  "Ghi chú AI", "Ghim", "Đánh dấu đã xử lý", "Bạn cho rằng mình bị phạt oan vì…",
  "Bằng chứng / tên người bị cho là có", "Đã gửi khiếu nại — ban quản trị sẽ xem.",
  "Bạn đã có một ticket đang mở.", "Bạn vừa mở ticket, hãy chờ …",
  "Server hiện đã đạt giới hạn ticket mở.", "Bot cần quyền Quản lý kênh để mở ticket.",
  "Bot cần role cao hơn bạn để cấp quyền trong kênh ticket.", + chuỗi panel dashboard.

Lệnh `/ticket` cần mục trong `bot/src/commands/localizations.js` (EN + DE) cho
Discord hiển thị mô tả đúng ngôn ngữ client.

## 13. Rủi ro

| Rủi ro                                     | Mức  | Xử lý                                                                          |
| ------------------------------------------ | ---- | ------------------------------------------------------------------------------ |
| Spam kênh làm sập server                   | Cao  | Mục 11 — bắt buộc, không cân nhắc bỏ                                           |
| Quyền bot không đủ                         | Cao  | Kiểm tra trước, báo rõ, không throw; panel dashboard ghi rõ quyền cần          |
| Đọc nhầm nội dung khiếu nại là lệnh bot    | TB   | Nội dung nằm trong **embed**, không phải message thật → không có hiệu lực lệnh |
| Người bị ban không nhận được DM            | TB   | Ghi `openError`/`openErrorAt`; staff thấy trên dashboard để gọi tay            |
| Embed dài làm rối mobile                   | Thấp | Cắt body 1000 ký tự, dùng `description` + `fields` giới hạn                    |
| Chạy trên server đang dùng                 | TB   | `ticketEnabled` mặc định **false** — không server nào đổi hành vi nếu chưa bật |
| Bộ đếm `number` lệch khi 2 ticket cùng lúc | TB   | Dùng chung `modCaseCounter` có sẵn (atomic `patch` trong `bot_writes`)         |
| Chưa verify được bằng mắt                  | TB   | Sandbox không có trình duyệt → cần bạn bấm tay 1 vòng sau khi deploy           |

## 14. Cổng kiểm chứng bắt buộc trước khi gọi "xong"

```bash
bun convex dev --once            # vì đụng convex/schema.ts
bun run test                    # 62 → 63 suites
bun run test:ts                 # 15 suites
bun tsc -b --noEmit
bun run lint
bun run format:check
node scripts/check-repo-map.cjs
node scripts/check-convex-contract.cjs
node scripts/check-i18n.cjs
node scripts/check-settings-signal.cjs
```

Riêng file mới: `ticketCore.js` phải nằm trong eslint/prettier scope (chỉ
loại `scripts/_*.cjs` và `src/shaders/**`).

## 15. Để ngỏ (có chủ đích, ghi để không ai nghĩ là quên)

- Tự động xoá kênh sau 24h: cần job quét. `bot_tick.ts` đã có
  `getPendingJobs` (dùng cho `verifySendPanel`, `dmRequested`) → thêm job
  `tickets` vào đó là tự nhiên. Đợt 2.
- Transcript lưu vào storage. Đợt 2, khi có nhu cầu thật.
- Relay DM hai chiều. Mục 3.3.
- `/ticket close <n>` / `/ticket list` bằng lệnh thay vì nút. Nút đủ dùng.

## 16. Chia đợt triển khai

| Đợt | Nội dung                                                                         | Cổng phải xanh                  |
| --- | -------------------------------------------------------------------------------- | ------------------------------- |
| 1   | `ticketCore.js` + `test-tickets.cjs` + `docs/repo-map.md`                        | test, lint, format              |
| 2   | `schema.ts` + `convex/tickets.ts` + 2 `bot_writes` + 7 field + 4 cổng            | tất cả 10 lệnh mục 14           |
| 3   | `bot/src/handlers/tickets.js` + `/ticket` + nối `interactionCreate` + DM sau ban | tất cả + smoke trên server thật |
| 4   | `TicketPanel.tsx` + i18n + `GuildPage`                                           | tất cả                          |

Đợt 3 **không** chạy `bun run smoke:vps` nếu bot đang ở trên VPS dự phòng —
lệnh đó login Discord thật và sẽ tranh session với node đang phục vụ. Lúc đó
chỉ chạy `bun run test` + `tsc` + `curl -s http://127.0.0.1:8787/__health` phải
ra `"ok":true`.

## 17. Câu hỏi cần bạn chốt trước khi code

1. **Có bật thật không?** `ticketEnabled` mặc định `false` nên đợt 4 mới xong
   mà chưa server nào thấy gì. Bạn muốn bật thử trên 1 server của bạn ngay sau
   khi deploy, hay để tắt tới lần sau?
2. **`ticketMaxOpen` mặc định 20** — có muốn hạ xuống (vd 5) không? Trần
   Discord là 500 kênh/server.
3. **Có cần `ticketStaffRoleId` tách riêng không?** MVP lấy `modRoles` làm
   mặc định. Chỉ cần tách khi bạn muốn "người xử lý ticket" khác "người làm
   mod" (vd: ban quản trị).
4. **DM cho người bị kick** — hiện `ticketDmOnBan` chỉ bắn cho `ban`. Kick
   cũng là phạt oan đáng kêu, nhưng bật thêm sẽ gửi DM nhiều hơn. Có bật
   không?
5. **Tên**: gọi "Khiếu nại" (đúng nghĩa, hợp tiếng Việt) hay "Ticket" (quen
   thuật hơn với cộng đồng Discord)? Mình nghiêng "Khiếu nại".

## 18. Chênh lệch giữa spec và code đã triển khai

Ghi lại để không ai đọc spec rồi tưởng code hỏng. Mỗi mục là quyết định đã
chốt khi code, không phải sơ suất bỏ sót.

1. **`reason` → `kind`.** Xem giải thích ở mục 6: lý do ban chỉ có nghĩa ở
   điểm vào A, còn `/ticket` (điểm vào B) thì ai cũng mở được.
2. **Đóng ticket KHÔNG xoá kênh.** `closeTicketChannel` thu quyền, đổi tên
   `closed-*` và chặn `@everyone`; giữ lại transcript vì đó đúng là thứ staff
   cần đọc lại khi có khiếu nại tiếp theo. Dọn kênh (status `locked`) để
   job quét ở đợt sau — cùng hạng mục với mục 15.
3. **Không có `/ticket appeal` gọi `guild.bans.fetch`.** Bản spec đầu dự đoán
   nút Gỡ ban cần tra ban list. Thực tế Discord chặn sẵn người bị ban khỏi
   gọi slash command, nên tra trước là 1 HTTP call vô ích; nút "Gỡ ban" trong
   kênh ticket vẫn là đường duy nhất và đi qua `unbanMember` (giữ được vòng
   đo phạt nhầm).
4. **`botTicketById` là query mới, không có trong spec.** Bắt buộc: kênh Discord
   không giữ id người mở ticket, tên kênh staff đổi tay được, nút có thể bị
   dán lại sang kênh khác. Bản ghi DB là nguồn tin duy nhất đáng tin — đặc biệt
   với nút Gỡ ban, nơi đọc nhầm người là hành động phạt nặng.
5. **`channelId` ghi `"pending"` trước khi tạo kênh.** Số thứ tự ticket lấy chung
   bộ đếm `modCaseCounter` nên phải ghi bản ghi trước; nếu tạo kênh hỏng thì
   giữ bản ghi kèm `openError` để staff thấy trên dashboard, thay vì xoá dấu
   vết (biến mất im lặng).
6. **Thứ tự "mới nhất trước" phải tự sắp trong JS, không tin `order("desc")`.**
   Xem `convex/tickets.ts`. Đã có test chặn hồi quy trong
   `scripts/test-tickets-convex.ts`.
