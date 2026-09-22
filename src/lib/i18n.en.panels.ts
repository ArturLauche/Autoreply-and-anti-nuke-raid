/**
 * i18n.en.panels.ts — Bản dịch EN đợt 2.
 *
 * Đợt 1 (src/lib/i18n.en.ts) phủ các chuỗi t(…) một mảnh. Đợt 2 phủ nhóm còn
 * sót: câu bị JSX cắt thành nhiều mảnh quanh thẻ <b>/<code> (nên phải dịch
 * từng mảnh sao cho ghép lại đọc tự nhiên), nhãn điều kiện trong {}, và nhãn
 * dữ liệu được dịch lúc render bằng translate(item.label).
 *
 * Gộp trong src/lib/i18n.tsx: DICT = { ...EN, ...EN_PANELS }.
 */
export const EN_PANELS: Record<string, string> = {
  ": backend Convex production đang chạy bản cũ, chưa có các hàm mới. Chủ dự án cần chạy":
    ": the Convex production backend is running an older build without the new functions. The project owner needs to run",
  "chưa có dữ liệu": "no data yet",
  "Bot tự đồng bộ dữ liệu (trạng thái, số server, chủ sở hữu) lên máy chủ":
    "The bot syncs data (status, server count, owner) to the backend",
  "mỗi {p0} giây": "every {p0} seconds",
  ": 2+ tín hiệu mạnh → phạt đúng cấu hình; 1 tín hiệu → hạ cấp nhẹ hơn (ban → kick, kick → timeout); 0 tín hiệu → chỉ theo dõi. Tắt để phạt theo điểm rủi ro như cũ (dễ chặn nhầm hơn).":
    ": 2+ strong signals → punish as configured; 1 signal → downgrade one step (ban → kick, kick → timeout); 0 signals → monitor only. Turn it off to punish by risk score as before (easier to false-positive).",
  "Mỗi {p0} ngày": "Every {p0} days",
  Tắt: "Off",
  "Chưa backup": "No backup yet",
  "module chống nuke bật": "anti-nuke modules on",
  "Hiện có": "Currently",
  "signature từ": "signatures from",
  nguồn: "sources",
  "Đang khóa — tự mở sau ~{p0} phút": "Locked — reopens in ~{p0} minutes",
  "Thu thập mẫu raid + AI phân tích để tìm": "Collects raid samples + AI analysis to find",
  "{p0} mẫu": "{p0} samples",
  "đang tải…": "loading…",
  "Vụ gần đây": "Recent incidents",
  lượt: "hits",
  "đã ban nguồn cơn": "banned the source",
  nghi: "suspect",
  bật: "on",
  "vi phạm": "violations",
  "module đang bật": "modules on",
  "Mỗi vi phạm cộng điểm nhiệt theo cài đặt của module. Nhiệt độ tăng dần, tự giảm theo thời gian; khi chạm ngưỡng":
    "Each violation adds heat based on the module settings. Heat rises, then decays over time; once it reaches the",
  "thành viên nhận cảnh báo riêng, rồi tự tăng cấp hình phạt:":
    "threshold the member gets a private warning, then punishments escalate:",
  "Ngưỡng phải tăng dần: warn < tạm khóa < kick < ban (tối đa 100 điểm). Thành viên vừa bị phạt mà":
    "Thresholds must increase: warn < timeout < kick < ban (max 100 points). A member who was just punished and",
  "tái phạm trong {p0} phút": "reoffends within {p0} minutes",
  "sẽ nhận": "gets",
  "điểm nhiệt": "heat points",
  "Số warn để tăng cấp (0 = tắt)": "Warns before escalation (0 = off)",
  "Đang bật:": "Active:",
  "trong {p0} phút → tự": "within {p0} minutes → auto",
  "(mặc định: {limit} warn / {window} phút).": "(default: {limit} warns / {window} minutes).",
  "Xóa {p0}": "Remove {p0}",
  "Áp dụng mọi kênh": "Applies to all channels",
  "{p0} kênh được chọn": "{p0} channels selected",
  "Thêm rule auto reply": "Add auto reply rule",
  "tag người nhắn,": "tags the sender,",
  "Chỉ áp dụng cho kênh (bỏ trống = mọi kênh)": "Only these channels (empty = all channels)",
  "Chưa có kênh nào được đồng bộ": "No channels synced yet",
  "Gõ tên kênh để tìm nhanh…": "Type a channel name to filter…",
  "Cooldown (giây, 0 = không giới hạn)": "Cooldown (seconds, 0 = unlimited)",
  "Chụp cấu trúc server (role, quyền role, kênh + quyền kênh) lên":
    "Snapshots your server structure (roles, role permissions, channels + channel permissions) to",
  "— khắc phục rồi bấm Backup ngay lại.": "— fix it and press Backup now again.",
  "— khắc phục (bot còn trong server, đủ quyền Administrator) rồi bấm Khôi phục lại.":
    "— fix it (the bot must still be in the server with Administrator) and press Restore again.",
  "Tạo backup cho": "Create a backup for",
  "(danh mục, văn bản, thoại…) kèm quyền truy cập từng kênh, cùng":
    "(categories, text, voice…) with per-channel access, plus",
  "Backup luôn được lưu trong Convex; đẩy lên GitHub giúp bạn còn giữ được dữ liệu ngay cả khi Convex bị xóa. Mọi server đều dùng chung":
    "Backups are always kept in Convex; pushing to GitHub keeps your data even if Convex is wiped. All servers share the",
  của: "of",
  hoặc: "or",
  "), tải file lên đây — bot sẽ": "), upload it here — the bot will",
  "(ảnh/video…) và": "(images/videos…) and",
  "Bot đang chạy bản cũ ({version}) — cần cập nhật bot lên bản mới nhất (v{min}+) để khôi phục và báo kết quả chính xác.":
    "The bot is running an older build ({version}) — update it to the latest (v{min}+) to restore and report accurate results.",
  "không rõ": "unknown",
  "— kiểm tra lại file rồi tải lên.": "— check the file and upload it again.",
  mỗi: "every",
  ", tối đa": ", max",
  "Backup gần nhất:": "Latest backup:",
  "· lần tới:": "· next:",
  "Bật lên là bot chụp bản đầu tiên trong khoảng 1 phút, sau đó lặp lại theo chu kỳ bạn chọn.":
    "Once on, the bot takes the first snapshot within about 1 minute, then repeats on your chosen cycle.",
  "Đang tắt — bot chỉ backup khi bạn bấm “Backup ngay” hoặc dùng lệnh.":
    "Off — the bot only backs up when you press “Backup now” or use the command.",
  "Lưu lịch tự động": "Save schedule",
  "Bật/tắt từng phần khi bot khôi phục — áp dụng cho": "Toggle each restore part — applies to",
  lẫn: "and",
  "Lưu tùy chỉnh khôi phục": "Save restore options",
  "(quyền": "(scope",
  ") của": ") of",
  "💡 Ngoài dashboard, bạn cũng có thể dùng lệnh trong Discord:":
    "💡 Outside the dashboard you can also use Discord commands:",
  "!backup restore <số>": "!backup restore <number>",
  bản: "backups",
  "Khôi phục vào server này": "Restore into this server",
  "Đang gửi…": "Sending…",
  "— thường do người nhận tắt DM hoặc không dùng chung server với bot":
    "— usually because the recipient has DMs off or shares no server with the bot",
  "Khi bot phát hiện loạt kết nối ứng dụng ngoài vượt ngưỡng module":
    "When the bot detects a burst of external app connections over the module threshold",
  người: "people",
  "kết nối": "connections",
  bởi: "by",
  "app khác…": "more apps…",
  "Chưa xác định được người dùng — chỉ ghi nhận": "No user identified — logged only",
  "Không có": "None",
  "(ứng dụng mở rộng) được kết nối ồ ạt hoặc app spam vào server — kèm":
    "(extended apps) connecting en masse or spamming into the server — with",
  "đang tắt — bật lại trong mục": "is off — turn it back on in",
  "⚠️ Bot không gửi được bảng:": "⚠️ The bot could not post the panel:",
  "kết thúc": "ends",
  "bất cứ lúc nào": "any moment",
  "người tham gia": "entries",
  "người thắng": "winners",
  " · 🎖️ cấp role thưởng": " · 🎖️ grants a prize role",
  " · DM người thắng": " · DMs the winners",
  " · 🖼️ có ảnh": " · 🖼️ has an image",
  "Hủy thất bại": "Cancel failed",
  "lượt tham gia": "entries",
  "Lời dẫn tùy chỉnh (hiển thị đầu embed, để trống = dùng giải thưởng)":
    "Custom intro (shown at the top of the embed, empty = use the prize)",
  "Nhiệt giảm {p0} điểm/phút": "Heat drops {p0} points/minute",
  "= tạm khóa": "= timeout",
  "= cảnh báo": "= warning",
  "0 = an toàn": "0 = safe",
  "Xóa nhiệt của {p0}": "Clear heat for {p0}",
  "Đang bật · {p0} tiêu chí": "On · {p0} checks",
  "Đang tắt": "Off",
  "Tài khoản tạo ít hơn số ngày dưới đây sẽ bị chặn (0 = tắt). Selfbot thường dùng tài khoản mới tạo hàng loạt.":
    "Accounts created fewer days ago than the number below are blocked (0 = off). Selfbots often mass-create fresh accounts.",
  "Tài khoản không có ảnh đại diện riêng (đang dùng hình mặc định) sẽ bị chặn.":
    "Accounts without a custom avatar (still on the default image) are blocked.",
  "Tài khoản không có bất kỳ huy hiệu công khai nào (flag = 0) sẽ bị chặn — selfbot mới hầu như không có huy hiệu.":
    "Accounts with no public badge at all (flag = 0) are blocked — fresh selfbots have almost none.",
  "Khi server đang khóa kênh (raid), mọi thành viên mới đều bị xử lý — chặn đà tấn công thứ hai.":
    "While the server is in lockdown (raid), every new member is punished — stopping a second wave.",
  "Kick = thành viên có thể quay lại; Ban = chặn vĩnh viễn (mạnh hơn với selfbot).":
    "Kick = the member can come back; Ban = permanent block (stronger against selfbots).",
  "(kiểu Carl-bot), lý do, người thực hiện và phân biệt rõ nguồn:":
    "(Carl-bot style), the reason, the executor, and a clear source label:",
  "hành động gần nhất": "most recent actions",
  "đang bật thông báo": "notifications on",
  "Nội dung thông báo sau khi bot": "Notification content after the bot",
  từ: "of",
  "từ lệnh": "from the command",
  Ngưỡng: "Threshold",
  "= xóa ngay tin vi phạm ·": "= delete the violating message right away ·",
  "= xóa hàng loạt tin liên quan vụ vi phạm.": "= bulk-delete messages related to the incident.",
  "Chưa có role được đồng bộ": "No roles synced yet",
  "Gõ tên role để tìm nhanh…": "Type a role name to filter…",
  "Báo cáo hàng ngày:": "Daily report:",
  "lần cuối": "last",
  "thủ phạm": "offender",
  "{p0} đang bật": "{p0} enabled",
  "Đang bảo vệ": "Protected",
  "Đã tắt toàn bộ": "Fully disabled",
  "đồng bộ qua bot": "synced via the bot",
  "Chưa đặt": "Not set",
  "cảnh báo & sự kiện": "alerts & events",
  "đặt trong Cài đặt": "set in Settings",
  "Lần cuối đồng bộ:": "Last synced:",
  "để tag người nhắn,": "to tag the sender,",
  "Chọn từ gợi ý bên dưới hoặc dán emoji tùy chỉnh: emoji unicode, custom emoji":
    "Pick from the suggestions below or paste a custom emoji: unicode emoji, custom emoji",
  "chưa có": "not set",
  "🖼️ có thumbnail ·": "🖼️ has a thumbnail ·",
  "Thất bại": "Failed",
  "Xóa thất bại": "Delete failed",
  "1–3 ký tự đặc biệt — lệnh text như": "1–3 special characters — text commands like",
  "tự gửi log khi có sự kiện. Tùy chỉnh loại sự kiện, màu embed và nội dung kèm.":
    "posts logs automatically on events. Customise the event types, embed colour and extra content.",
  "Màu embed (hex, để trống = mặc định)": "Embed colour (hex, empty = default)",
  "Lỗi lưu webhook": "Failed to save the webhook",
  "Nhập mật khẩu mới để thay đổi…": "Enter a new password to change it…",
  "Nhập mật khẩu (4–64 ký tự)…": "Enter a password (4–64 characters)…",
  "Lưu thất bại": "Save failed",
  "Trạng thái:": "Status:",
  Webhook: "Webhook",
  "Đang kiểm tra…": "Checking…",
  "Đã đổi phương thức xác minh": "Verification method updated",
  "để tag,": "to tag,",
  "để tên server": "for the server name",
  "để trống = màu mặc định": "empty = default colour",
  "Đã cập nhật kênh xác minh": "Verification channel updated",
  "Đã cập nhật role chưa xác minh": "Unverified role updated",
  "Đã cập nhật role đã xác minh": "Verified role updated",
  "Đã yêu cầu bot gửi panel xác minh!": "Asked the bot to post the verification panel!",
  "Chưa chọn kênh": "No channel selected",
  "Chưa chọn role": "No role selected",
  "— thiết lập xác minh bằng lệnh Discord.": "— set verification up with a Discord command.",
  "Webhook mặc định của bot": "The bot's default webhook",
  "· kênh": "· channel",
  "kênh đã bị xóa": "channel deleted",
  "(theo Kênh log trong Cài đặt) · nhận mọi log hình phạt & anti nuke/raid.":
    "(follows the Log channel in Settings) · receives every punishment & anti nuke/raid log.",
  "Hôm nay lúc": "Today at",
  "• Dán URL vào ô trên, soạn embed với tiêu đề, mô tả, màu sắc, fields... rồi bấm":
    "• Paste the URL above, compose an embed with a title, description, colour, fields... then press",
  "moderation, anti-raid và anti-nuke xử lý —": "moderation, anti-raid and anti-nuke —",
  "chỉ áp dụng cho": "applies only to",
  "của người dùng (bật Chế độ nhà phát triển trong Discord → chuột phải tên người dùng → Sao chép ID người dùng) để họ không bị hệ thống xử lý":
    "of the user (enable Developer Mode in Discord → right-click the username → Copy User ID) so the system skips them",
  "người dùng": "users",
  "Danh sách áp dụng cho": "The list applies to",
  "toàn bộ module của server": "every module of the server",
  ": spam, từ ngữ xấu, link mời, link độc hại, file nguy hiểm, raid thành viên, ban/kick hàng loạt, tạo/xóa kênh & role hàng loạt, webhook/thread hàng loạt… Người dùng/role trong danh sách được bỏ qua hoàn toàn — không cộng nhiệt, không xóa tin, không ban. Danh sách này":
    ": spam, bad words, invite links, malicious links, dangerous files, member raids, mass bans/kicks, mass channel & role create/delete, mass webhooks/threads… Listed users/roles are skipped entirely — no heat, no message deletion, no ban. This list",
  "đang dùng bot.": "using the bot.",
  "Protogon Bot · Tự trả lời theo từ khóa, nhiệt độ vi phạm, Join Gate và phòng thủ chống raid cho cộng đồng Discord":
    "Protogon Bot · Keyword auto-reply, violation heat, Join Gate and raid defence for the Discord community",
  "bị chặn: tài khoản": "blocked: the account is",
  "Bảo vệ vững chắc, giao tiếp mượt mà cho server của bạn":
    "Solid protection and smooth conversation for your server",
  "(24 module) bám sát cấu trúc server (ban/kick hàng loạt, phá kênh, phá role…); còn":
    "(24 modules) watch the server structure (mass bans/kicks, channel and role vandalism…), while",
  "Không khớp": "No match for",
  "{p0} server · {p1} thành viên": "{p0} servers · {p1} members",
  "Lỗi kết nối": "Connection error",
  "Khi đã đặt seed, MỌI lệnh của bot yêu cầu chìa khóa khớp — kẻ ngoài không thể giả mạo heartbeat/backup/lockdown. Trên VPS dán giá trị seed VỪA NHẬP vào biến":
    "Once a seed is set, EVERY bot command needs the matching key — outsiders cannot fake heartbeat/backup/lockdown. On the VPS, paste the seed you JUST entered into the variable",
  "trong bot/.env rồi": "in bot/.env, then",
  "Đã bật bảo vệ ✅ — dán giá trị seed VỪA NHẬP vào BOT_KEY trên VPS (không hiện lại ở đây).":
    "Protection enabled ✅ — paste the seed you JUST entered into BOT_KEY on the VPS (it is not shown here again).",
  "Lỗi khi đặt seed — thử lại.": "Failed to set the seed — try again.",
  "Cửa sổ Admin chỉ hiển thị trong taskbar với":
    "The Admin window only appears in the taskbar for the",
  "Cho phép AI tổng hợp (Mimo V2.5 qua Kira AI — free 30M tokens/ngày riêng cho việc học; tổng hợp mỗi lượt khi có dữ liệu mới, không đụng hạn mức Groq/NVIDIA)":
    "Allow AI synthesis (Mimo V2.5 via Kira AI — 30M free tokens/day dedicated to learning; synthesises each run when there is new data, without touching the Groq/NVIDIA quota)",
  "Nguồn lượt trước": "Sources last run",
  "Kích hoạt bot học NGAY từ nguồn mở + AI tổng hợp. Lần cuối:":
    "Make the bot learn NOW from open sources + AI synthesis. Last time:",
  "Lịch sử học": "Learning history",
  "lượt gần nhất": "latest runs",
  "· nhớ": "· remembers",
  "Từ khóa đã học": "Learned keywords",
  "Máy chủ backend của Protogon hiện không truy cập được từ trang web này (lỗi kết nối Convex). Nếu bạn là quản trị viên, hãy kiểm tra cấu hình":
    "Protogon's backend is currently unreachable from this site (Convex connection error). If you are an administrator, check the",
  "và thử lại sau ít phút.": "and try again in a few minutes.",
  "Để đăng nhập, bạn cần tạo ứng dụng Discord và điền":
    "To sign in you need to create a Discord application and fill in",
  "vào mục API Keys. Cách làm:": "in API Keys. How to:",
  "Thêm redirect URI": "Add the redirect URI",
  vào: "to",
  và: "and",
  "Mời Protogon vào server của bạn rồi quay lại đây. Cần quyền":
    "Invite Protogon to your server, then come back here. You need the",
  "thành viên · prefix": "members · prefix",
  "Mời bot vào server trước khi quản lý": "Invite the bot to the server before managing it",
  "Bạn sẽ được chuyển tới trang mời bot.": "You will be taken to the bot invite page.",
  ngưỡng: "threshold",
  trong: "in",
  "Tải thêm sự kiện": "Load more events",
  "— Đã hiển thị toàn bộ": "— Showing all",
  "sự kiện": "events",
  "• Auto-mod = spam tin, mention, từ xấu, ảnh/file, link mời + link độc hại.":
    "• Auto-mod = message spam, mentions, bad words, images/files, invite + malicious links.",
  "• Moderation = thông báo sau khi bot phạt (ban · timeout · warn · kick) — chọn mức chi tiết riêng cho từng hành động.":
    "• Moderation = notifications after the bot punishes (ban · timeout · warn · kick) — pick the detail level per action.",
  "• Join Gate = chặn selfbot khi vào server.": "• Join Gate = blocks selfbots on join.",
  "• ⭐ Whitelist = chọn người dùng/role miễn trừ moderation, anti-raid và nuke.":
    "• ⭐ Whitelist = pick users/roles exempt from moderation, anti-raid and nuke.",
  "• 💾 Backup server = chụp role + kênh lên đám mây riêng; khôi phục lại khi server bị nuke phá sập.":
    "• 💾 Server backup = snapshots roles + channels to your own cloud; restore after a nuke wipes the server.",
  "• 🔗 Webhook & Log = bot tự tạo webhook tên/avatar/màu tùy chỉnh để nhận log.":
    "• 🔗 Webhook & Log = the bot creates a custom-named/avatar/colour webhook to receive logs.",
  "tự trả lời & chống raid": "auto-reply & anti-raid",
  "cùng warn tích lũy": "plus accumulated warns",
  "giám sát server 24/7.": "monitoring your server 24/7.",
  "Trung bình:": "Average:",
  "Tối đa:": "Peak:",
  "đang đo": "measuring",
  "Đánh giá:": "Rating:",
  Nhanh: "Fast",
  "Nhiệt giảm {decay} điểm/phút — thành viên ngoan tự rời bảng sau một lúc im giọng. ▪ {warn} cảnh báo · ▪ {timeout} tạm khóa · ▪ {kick} kick · ■ {ban} ban":
    "Heat drops {decay} points/minute — well-behaved members leave the board after staying quiet. ▪ {warn} warning · ▪ {timeout} timeout · ▪ {kick} kick · ■ {ban} ban",
  "lần cảnh báo": "warnings",
  'Chỉnh sửa "{p0}"': 'Edit "{p0}"',
  'Hủy giveaway "{p0}"?': 'Cancel the giveaway "{p0}"?',
  'Xóa bảng "{p0}"?': 'Delete the panel "{p0}"?',
  '— bấm "Học ngay" để thử lại': '— press "Learn now" to try again',
  '— hãy sửa lỗi rồi bấm "Gửi panel xác minh vào kênh" lại':
    '— fix the error, then press "Post the verification panel into the channel" again',
  "—": "—",
  "Bật rồi phải chọn kênh gửi — hoặc tắt tính năng":
    "Enabled but no channel selected — pick one or turn the feature off",
  "Chào thành viên mới": "Greet new members",
  "Tạm biệt thành viên rời server": "Farewell to leaving members",
  "Gửi tin chào vào kênh bạn chọn khi có thành viên tham gia":
    "Sends a greeting to the channel you choose when a member joins",
  "Gửi tin tạm biệt khi có thành viên rời server":
    "Sends a farewell when a member leaves the server",
  "Kênh gửi": "Send channel",
  "Nội dung": "Message body",
  "Xem trước:": "Preview:",
  "Gửi dạng embed": "Send as embed",
  "Tắt = gửi tin nhắn thường (không khung)": "Off = send as a plain message (no frame)",
  "Welcome & Goodbye": "Welcome & Goodbye",
  "đang bật": "active",
  "Đã bật": "Enabled",
  "Đã tắt": "Disabled",
  "Đã lưu": "Saved",
  "Đã lưu — bot áp dụng trong vòng ~3 phút": "Saved — the bot applies it within ~3 minutes",
  "Chào thành viên mới và tạm biệt thành viên rời server — kênh riêng, nội dung tùy chỉnh. Bot không chào bot, không ping @everyone từ nội dung tùy chỉnh (an toàn chống ping sập server).":
    "Greet new members and farewell to leaving ones — separate channels, custom message body. The bot ignores bots and never pings @everyone from custom content (safe against mention spam).",
  "Chào mừng {user} đã đến {server}! Bạn là thành viên thứ {count} 🎉":
    "Welcome {user} to {server}! You are member #{count} 🎉",
  "{user} đã rời {server}. Hẹn gặp lại!": "{user} left {server}. See you again!",
  "Bot Discord · Nhiệt độ · Join Gate · Chào thành viên · Trợ lý AI":
    "Discord bot · Heat · Join Gate · Greetings · AI assistant",
  "Chào thành viên mới và tạm biệt người rời đi bằng kênh riêng, nội dung tùy chỉnh với placeholder ({user}, {server}, {count}…), gửi dạng embed hoặc tin nhắn thường.":
    "Greet new members and farewell to those leaving — separate channels, custom text with placeholders ({user}, {server}, {count}…), sent as an embed or a plain message.",
  /* ==== Welcome & Goodbye v2 — template ngẫu nhiên, embed tùy chỉnh, DM, autorole ==== */
  "Template ngẫu nhiên": "Random templates",
  "{n} câu": "{n} lines",
  "Mỗi dòng là 1 câu — bot chọn ngẫu nhiên mỗi lượt join/leave, đỡ nhàm chán. Bật sẽ thắng nội dung ở trên.":
    "Each line is one greeting — the bot picks one at random on every join/leave so it never gets stale. Takes priority over the body above.",
  "Chào mừng {user} đến {server}!\nÊ kèo {username}, vào chơi đi!\nNgười thứ {count} vừa xuất hiện 🎉":
    "Welcome {user} to {server}!\nNice to see you, {username}!\nMember #{count} just showed up 🎉",
  "🎉 Thành viên mới!": "🎉 New member!",
  "👋 Tạm biệt": "👋 Farewell",
  "Màu (#hex)": "Color (#hex)",
  "Màu phải dạng #hex (VD: #57f287)": "Color must be #hex (e.g. #57f287)",
  "Ảnh banner (URL)": "Banner image (URL)",
  "Thumbnail (URL)": "Thumbnail (URL)",
  ThànhViênMới: "NewMember",
  "Chào qua DM": "Welcome via DM",
  "Gửi tin chào riêng qua tin nhắn riêng của thành viên mới":
    "Send a private greeting to the new member's direct messages",
  "Nội dung DM": "DM body",
  "Cảm ơn {username} đã tham gia {server}! Đọc #quy-tắc trước khi chat nhé.":
    "Thanks for joining {server}, {username}! Check the #rules before chatting.",
  "Autorole — tự cấp role": "Autorole — assign role automatically",
  "Tự cấp role cho thành viên mới ngay khi họ vào server":
    "Automatically assign a role to new members the moment they join",
  "Role cấp tự động": "Auto-assigned role",
  "Chọn role": "Pick a role",
  "Trễ trước khi cấp (giây, 0-120)": "Delay before assigning (seconds, 0-120)",
  "Cấp role cho bot": "Assign role to bots",
  "Mặc định tắt — bot vào server không nhận autorole":
    "Off by default — bots joining the server do not get the autorole",
  "Bảo vệ raid: server đang khóa (lockdown) → autorole tạm dừng, không cấp role cho tài khoản raid dồn dập.":
    "Raid protection: while the server is locked down, autorole pauses so raid accounts don't get the role.",
  "Chào thành viên mới và tạm biệt thành viên rời server — template ngẫu nhiên, embed tùy chỉnh, DM chào riêng, autorole. Bot không chào bot, không ping @everyone từ nội dung tùy chỉnh, và tự im lặng khi server đang khóa chống raid.":
    "Greet new members and farewell to leaving ones — random templates, custom embeds, private DM greeting, autorole. The bot ignores bots, never pings @everyone from custom content, and goes silent while the server is locked down against raids.",

  /* ==== Landing — đợt viết lại copy (Lô 1). Các key này còn bản cũ nằm ở
     section theo alphabet trong i18n.en.ts (entry trùng, không còn dùng) —
     gom về đây để một chỗ dễ rà soát. */
  "bảo vệ server toàn diện": "all-round server protection",
  "hoặc gọi từ khóa để bot phản hồi tức thì. Đi kèm":
    "or call a keyword and the bot answers instantly. Alongside",
  "· hoạt động 24/7": "· running 24/7",
  "Tái phạm trong 30 phút, nhiệt sẽ nhân": "Repeat within 30 minutes and the heat multiplies",
  "Protogon gom hệ thống tự trả lời và 32 module bảo vệ (24 chống nuke + 8 auto-mod) vào một chỗ: cấu hình trực quan trên dashboard, giám sát server 24/7, có trợ lý Haimiya đồng hành khi bạn cần.":
    "Protogon brings auto-reply and 32 protection modules (24 anti-nuke + 8 auto-mod) together in one place: configure everything from a clear dashboard, keep your server watched 24/7, with the Haimiya assistant on hand when you need it.",
  "Nhiệt tăng dần, hình phạt leo thang theo ngưỡng":
    "Heat climbs, punishments escalate by threshold",
  "Vừa bị phạt mà tái phạm, nhiệt sẽ nhân":
    "Repeat right after a punishment and the heat multiplies",
  "trong 30 phút. Warn tích lũy chạy song song: đủ 3 lần là tự tăng cấp.":
    "within 30 minutes. Accumulated warns run in parallel: 3 warns trigger automatic escalation.",
  "khi bất kỳ module nào vượt ngưỡng, bot sẽ chặn toàn bộ thành viên gửi tin trong server, tự mở lại sau vài phút hoặc khi mod dùng":
    "when any module crosses its threshold the bot blocks everyone from sending server-wide, reopening after a few minutes or when a mod runs",
  "Đăng nhập bằng Discord, mời Protogon vào server để bật nhiệt độ, Join Gate, lọc nội dung và 32 module chống nuke ngay trên dashboard — cùng trợ lý ảo Haimiya đồng hành. Miễn phí cho mọi server.":
    "Sign in with Discord and invite Protogon to switch on heat, Join Gate, content filtering and 32 anti-nuke modules right from the dashboard — with the Haimiya assistant along the way. Free for every server.",
  "…cùng 12 module chống nuke khác, xem đầy đủ trong dashboard.":
    "…plus 12 more anti-nuke modules, all listed in the dashboard.",

  /* ==== Lô 2 — viết lại copy panel Overview / Settings / Branding / ModuleCard. */
  "Chưa ghi nhận sự kiện nào — bot chưa xử lý vi phạm chống nuke ở server này.":
    "No events recorded yet — the bot hasn't handled any anti-nuke violation on this server.",
  "Tính từ tổng nhiệt độ và warn tích lũy của thành viên. Vi phạm càng nhiều thì nhiệt càng cao và mức an toàn càng giảm; khi chạm ngưỡng, hình phạt tự tăng cấp (cảnh báo → tạm khóa → kick → ban) và tái phạm bị nhân đôi nhiệt.":
    "Calculated from your members' total heat and accumulated warns. The more violations, the higher the heat and the lower the safety score; once a threshold is reached the punishment escalates automatically (warning → timeout → kick → ban) and repeat offences double the heat.",
  "Rule auto reply hỗ trợ placeholder:": "Auto-reply rules support placeholders:",
  "để tag người nhắn và": "to mention the sender, and",
  "để lấy tên hiển thị.": "for their display name.",
  "Mọi thay đổi cấu hình được bot đồng bộ tự động trong khoảng 3 phút.":
    "Every configuration change syncs to the bot automatically within about 3 minutes.",
  "Bảng nhiệt & warn trong Moderation có nút xóa nhiệt cho từng người hoặc toàn bộ.":
    "The heat & warn table in Moderation can clear heat for one member or for everyone.",
  "Join Gate chặn selfbot ngay khi vào server: tài khoản quá mới, thiếu avatar hoặc huy hiệu.":
    "Join Gate blocks selfbots the moment they join: accounts that are too new or missing an avatar or badge.",
  "Module “Chống link độc hại & file nguy hiểm” quét domain lừa đảo và tệp đuôi .exe/.scr…":
    "The “malicious links & dangerous files” module scans scam domains and files ending in .exe/.scr…",
  "Mod/Admin có tên trong Cài đặt được miễn trừ khỏi toàn bộ hệ thống chống nuke.":
    "Mods/Admins listed in Settings are exempt from the entire anti-nuke system.",
  "Nhiệt tự giảm dần theo phút; đủ ngưỡng là hình phạt tự tăng cấp.":
    "Heat decays by the minute; once the threshold is reached the punishment escalates automatically.",
  "⚡ Phạt thẳng theo hành động đã chọn, không cộng nhiệt.":
    "⚡ Punishes directly with the chosen action and adds no heat.",
  "Không có — mọi role đều bị kiểm tra": "None — every role is checked",
  "Chưa có role nào được đồng bộ": "No roles synced yet",
  "= xóa toàn bộ tin liên quan đến vụ vi phạm.":
    "= deletes every message related to the violation.",
  "🔥 Nhiệt mỗi vi phạm": "🔥 Heat per violation",
  "Logo bot xuất hiện trên trang chủ, trang quản lý và toàn bộ website.":
    "The bot logo appears on the landing page, the management pages and the whole website.",
  "Ảnh đại diện của Haimiya trong cửa sổ trò chuyện trợ giúp.":
    "Haimiya's avatar inside the help chat window.",
  "Đổi avatar bot và trợ lý AI ngay trên web — chỉ admin sở hữu bot được phép.":
    "Change the bot and AI-assistant avatars right from the web — bot-owning admin only.",
  "Ảnh tải lên được lưu trên bộ nhớ đám mây của bot và áp dụng ngay toàn web (trang chủ, đăng nhập, dashboard, chat AI).":
    "Uploaded images are stored in the bot's cloud storage and applied across the site instantly (landing page, sign-in, dashboard, AI chat).",
  "Ảnh tối đa 2MB, vui lòng chọn ảnh nhỏ hơn.":
    "Images are capped at 2MB — please choose a smaller one.",
  "Tải ảnh lên máy chủ thất bại (HTTP {p0})": "Image upload to the server failed (HTTP {p0})",
  "Máy chủ không trả về ID ảnh — hãy thử dán đường dẫn ảnh thay thế":
    "The server returned no image ID — try pasting an image URL instead",
  "Đã đổi avatar bot, áp dụng ngay toàn web":
    "Bot avatar updated — applied across the site instantly",
  "Đã đổi avatar Haimiya, áp dụng ngay toàn web 🎀":
    "Haimiya's avatar updated — applied across the site instantly 🎀",
  "Tải ảnh thất bại": "Image upload failed",
  "Đã lưu ảnh mới, áp dụng ngay toàn web": "New image saved — applied across the site instantly",
  "Đã xóa ảnh tùy chỉnh, trở về mặc định": "Custom image removed — back to the default",
  "Nhận sự kiện chống nuke/raid, báo cáo hàng ngày và các thông báo quan trọng.":
    "Receives anti-nuke/raid events, the daily report and other important notices.",
  "Kênh log hành động mod — auto-mod và lệnh thủ công, theo phong cách Carl-bot":
    "Mod action log channel — auto-mod and manual commands, Carl-bot style",
  "Tóm tắt sự kiện chống nuke gửi vào kênh log vào khoảng 00:00 UTC mỗi ngày":
    "Posts an anti-nuke summary to the log channel around 00:00 UTC every day",
  "Khi bot xác nhận raid/nuke: gửi DM khẩn cho chủ server (kẻ nuke không xóa được), AI quét chat và báo cáo vào kênh log, kèm lệnh":
    "When the bot confirms a raid/nuke: an urgent DM to the server owner (a nuker can't delete it), the AI scans the chat and reports to the log channel, plus the command",
  "Tắt nếu không muốn cảnh báo làm phiền cả server — mod vẫn thấy log":
    "Turn off if you don't want the alert to bother the whole server — mods still see the log",
  "tự gửi log khi có sự kiện; tùy chỉnh loại sự kiện, màu embed và nội dung kèm.":
    "posts logs automatically when events happen; customise event types, embed colour and included content.",
  "Được miễn trừ chống nuke và có quyền quản lý rule auto reply trong Discord.":
    "Exempt from anti-nuke and allowed to manage auto-reply rules inside Discord.",
  "Dùng để mở khóa khu vực riêng tư dành cho chủ sở hữu bot; nội dung bên trong không tiết lộ công khai. Chỉ":
    "Used to unlock the private area reserved for the bot owner; its contents are never disclosed publicly. Only",
  "🔒 Bạn không phải admin sở hữu bot — chỉ chủ sở hữu bot mới được đặt, đổi hoặc xóa mật khẩu này.":
    "🔒 You are not the bot-owning admin — only the bot owner can set, change or delete this password.",
  "Chọn sắc độ xám áp dụng cho toàn bộ trang quản lý của server (nút, thẻ, sidebar).":
    "Pick the grey shade applied to this server's whole management area (buttons, cards, sidebar).",
  "Đã lưu cài đặt, bot áp dụng trong khoảng 3 phút":
    "Settings saved — the bot applies them within about 3 minutes",
  "Prefix gồm 1–3 ký tự đặc biệt, ví dụ: !, ^, !!":
    "The prefix is 1–3 special characters, e.g. !, ^, !!",
  "1–3 ký tự đặc biệt, dùng cho lệnh text như":
    "1–3 special characters, used for text commands such as",
  ", kể cả người có quyền phá server.": ", including anyone with permission to wreck the server.",

  /* ==== Lô 3a — viết lại copy panel AntiNuke / AutoMod / AltDetection. */
  "Bảo vệ cấu trúc server khỏi các đợt tấn công hàng loạt: ban, kick, tạo/xóa kênh và role…":
    "Protects the server structure from mass attacks: bans, kicks, channel and role create/delete…",
  "⚠️ Chống nuke đang tắt toàn bộ — server chưa được bảo vệ khỏi raid.":
    "⚠️ Anti-nuke is fully off — your server is not protected against raids.",
  "Áp cấu hình tối ưu theo quy mô server; danh sách trắng của bạn giữ nguyên.":
    "Applies an optimal config for your server size; your whitelist stays untouched.",
  "Chia sẻ chữ ký raid ẩn danh với các server khác dùng Protogon — server của bạn được bảo vệ bằng kinh nghiệm toàn mạng.":
    "Shares anonymised raid signatures with other servers running Protogon — your server benefits from network-wide experience.",
  "Tự chặn gửi tin nhắn và voice khi phát hiện raid; mở lại khi hết giờ hoặc bằng":
    "Automatically blocks messages and voice when a raid is detected; reopens when the timer ends or with",
  "(tài khoản trùng avatar/username, người tạo invite, audit log) rồi tự ban.":
    "(accounts sharing an avatar/username, the invite creator, the audit log) and bans them automatically.",
  "Đã lưu cài đặt Raid Intel — bot áp dụng trong khoảng 3 phút":
    "Raid Intel settings saved — the bot applies them within about 3 minutes",
  "Thu thập mẫu raid và dùng AI phân tích để tìm": "Collects raid samples and uses AI to trace",
  "Phân tích cụm tài khoản và audit log sau mỗi vụ.":
    "Analyses the account cluster and the audit log after every case.",
  "Đang khóa — tự mở sau khoảng {p0} phút": "Locked — reopens in about {p0} minutes",
  "Hiện không có kênh nào bị khóa": "No channel is locked right now",
  "Tự động kiểm duyệt nội dung: chống spam tin nhắn, mention, từ ngữ thô tục, ảnh/file và link mời Discord":
    "Automatic content moderation: message spam, mentions, profanity, image/file spam and Discord invites",
  "Mỗi vi phạm cộng điểm nhiệt theo cài đặt của module. Nhiệt tăng dần rồi tự giảm theo thời gian; khi chạm ngưỡng":
    "Every violation adds heat based on the module settings. Heat rises and then decays over time; once it reaches a threshold",
  "Ngưỡng phải tăng dần: cảnh báo < tạm khóa < kick < ban (tối đa 100 điểm). Thành viên vừa bị phạt mà":
    "Thresholds must increase: warning < timeout < kick < ban (max 100 points). A member who is punished and",
  "bật, mọi tin nhắn chứa từ trong danh sách dưới đây sẽ bị xóa và xử lý tự động. Xóa hết từ để tắt bộ lọc từ ngữ xấu.":
    "on, every message containing a word from the list below is deleted and handled automatically. Remove all words to turn the bad-word filter off.",
  "Chưa có từ nào — bộ lọc từ ngữ xấu chỉ hoạt động sau khi bạn thêm từ.":
    "No words yet — the bad-word filter only works once you add some.",
  "mỗi lần vi phạm, thanh nhiệt đầy nhanh hơn.": "per violation, so the heat bar fills faster.",
  "🔥 Bảng nhiệt và warn tích lũy của từng thành viên":
    "🔥 Heat and accumulated warns for every member",
  "⚠️ Discord không cung cấp địa chỉ IP của thành viên cho bot, nên phát hiện VPN/Proxy trực tiếp là không khả thi với dữ liệu hiện có. Hệ thống tập trung vào phát hiện tài khoản phụ bằng bằng chứng hành vi (tuổi tài khoản, tên/avatar trùng, lịch sử bị phạt, cụm join) — cách chặn tài khoản lạm dụng VPN hiệu quả nhất mà Discord cho phép.":
    "⚠️ Discord does not expose members' IP addresses to bots, so detecting VPNs/proxies directly is not feasible with the available data. The system focuses on spotting alt accounts through behavioural evidence (account age, matching names/avatars, punishment history, join clusters) — the most effective way Discord allows to stop accounts abusing a VPN.",
  ": từ 2 tín hiệu mạnh trở lên → phạt đúng cấu hình; 1 tín hiệu → hạ cấp nhẹ hơn (ban → kick, kick → timeout); không có tín hiệu → chỉ theo dõi. Tắt để phạt theo điểm rủi ro như trước (dễ chặn nhầm hơn).":
    ": two or more strong signals → punish per your config; one signal → a milder punishment (ban → kick, kick → timeout); no signals → monitor only. Turn it off to punish by risk score as before (more prone to false positives).",

  /* ==== Lô 3b — viết lại copy panel JoinGate / Verify / Webhook / Backup. */
  "Đã thêm {p0} vào danh sách trắng": "Added {p0} to the whitelist",
  "Đã xóa {p0} khỏi danh sách trắng": "Removed {p0} from the whitelist",
  "Kiểm tra mọi thành viên mới ngay khi vào server và tự động chặn tài khoản nghi selfbot":
    "Checks every new member on join and automatically blocks suspected selfbot accounts",
  "Khi bật, mọi thành viên mới đều phải vượt qua các tiêu chí bên dưới mới được ở lại server. Ai không đạt sẽ bị":
    "When on, every new member must pass the checks below to stay in the server. Anyone who fails is",
  "⚠️ Join Gate đang tắt — mọi tài khoản đều vào được, kể cả selfbot.":
    "⚠️ Join Gate is off — every account can join, selfbots included.",
  "Tài khoản mới hơn số ngày dưới đây sẽ bị chặn (0 = tắt). Selfbot thường đăng ký tài khoản mới hàng loạt.":
    "Accounts younger than the number of days below are blocked (0 = off). Selfbots usually register fresh accounts in bulk.",
  "Khuyến nghị 7–14 ngày để chặn tài khoản dùng một lần.":
    "7–14 days is recommended to block throwaway accounts.",
  "Tài khoản còn dùng ảnh đại diện mặc định sẽ bị chặn.":
    "Accounts still on the default avatar are blocked.",
  "Tài khoản không có huy hiệu công khai nào (flag = 0) sẽ bị chặn — selfbot mới gần như không bao giờ có huy hiệu.":
    "Accounts with no public badge at all (flag = 0) are blocked — fresh selfbots almost never have one.",
  "Chặn người vào khi server đang bị raid": "Block joins while the server is being raided",
  "Khi server đang khóa kênh vì raid, mọi thành viên mới đều bị xử lý — cắt đợt tấn công thứ hai.":
    "While the server is channel-locked for a raid, every new member is punished — cutting off the second wave.",
  "— bật tiêu chí trên thì mọi thành viên mới sẽ bị xử lý ngay lúc này.":
    "— with the check above on, every new member is punished right now.",
  "Kick = có thể quay lại; Ban = chặn vĩnh viễn (hiệu quả hơn với selfbot).":
    "Kick = they can come back; Ban = blocked for good (more effective against selfbots).",
  "— tài khoản vi phạm bị chặn vĩnh viễn. Chọn Kick nếu bạn muốn nhẹ tay hơn.":
    "— offending accounts are blocked permanently. Pick Kick if you want to be gentler.",
  ", bỏ qua mọi tiêu chí — dành cho tài khoản phụ hoặc người bạn tin tưởng.":
    ", skipping every check — for alt accounts or people you trust.",
  "trạng thái email/số điện thoại đã xác thực, nên Join Gate chỉ dựa vào tín hiệu công khai (tuổi tài khoản, avatar, huy hiệu, trạng thái raid) để nhận diện selfbot.":
    "whether an email address or phone number is verified, so Join Gate relies on public signals only (account age, avatar, badges, raid status) to spot selfbots.",
  "để xử lý. Muốn một người luôn được vào, hãy thêm ID của họ vào danh sách trắng phía trên.":
    "to act. To let someone in every time, add their ID to the whitelist above.",
  "Thành viên mới nhận role Unverified và phải xác minh trước khi vào server.":
    "New members get the Unverified role and must verify before they can see the server.",
  "Khi bật, thành viên mới nhận role chưa xác minh và phải verify mới vào được server.":
    "When on, new members get the unverified role and must verify before they can enter the server.",
  "— thành viên bấm nút là xác minh xong ngay.":
    "— members click a button and are verified instantly.",
  "— bot gửi mã qua DM, thành viên nhập lại mã trong kênh.":
    "— the bot DMs a code and the member types it back in the channel.",
  "Bot gửi embed chào mừng qua DM ngay khi thành viên xác minh thành công.":
    "The bot DMs the welcome embed the moment a member verifies successfully.",
  "Role tự gán cho thành viên mới ngay khi vừa vào server.":
    "Role assigned automatically the moment a new member joins.",
  "Role gán sau khi xác minh thành công; role chưa xác minh được gỡ ra.":
    "Role granted after a successful verification; the unverified role is removed.",
  "— thiết lập xác minh ngay trong Discord.": "— set up verification right inside Discord.",
  "Chưa có nội dung embed — hãy soạn ở khung bên trái.":
    "No embed content yet — write something in the panel on the left.",
  "Đã gửi thành công! Kiểm tra kênh Discord.": "Sent successfully! Check the Discord channel.",
  "(theo Kênh log trong Cài đặt) · nhận mọi log hình phạt và anti nuke/raid.":
    "(follows the Log channel in Settings) · receives every punishment and anti-nuke/raid log.",
  "tự tạo trong khoảng 1 phút": "creates it within about 1 minute",
  "chọn Kênh log": "set the Log channel",
  "Dán webhook URL từ Discord (Kênh → Tích hợp → Webhook → Tạo webhook), soạn nội dung và embed rồi bấm gửi.":
    "Paste a webhook URL from Discord (Channel → Integrations → Webhooks → New webhook), write the message and embed, then hit send.",
  "Tên người gửi ghi đè (tùy chọn)": "Override display name (optional)",
  "Hiển thị thời gian hiện tại": "Show the current time",
  "• Dán URL vào ô trên, soạn embed với tiêu đề, mô tả, màu sắc, field… rồi bấm":
    "• Paste the URL above, build an embed with a title, description, colour and fields… then press",
  "• Webhook mặc định (Protogon Log) ở trên chỉ dùng để nhận log hình phạt và anti nuke từ bot — không liên quan tới trình gửi embed.":
    "• The default webhook (Protogon Log) above only receives punishment and anti-nuke logs from the bot — it has nothing to do with the embed sender.",
  "Hãy kiểm tra lại file backup hoặc tải lại file khác.":
    "Check the backup file again or upload a different one.",
  "Bot đã dừng giữa chừng. Kiểm tra bot còn trong server và đủ quyền Administrator rồi thử khôi phục lại.":
    "The bot stopped part-way. Make sure it is still in the server with Administrator permission, then try restoring again.",
  "Bot đã dừng giữa chừng. Kiểm tra bot còn trong server và đủ quyền Administrator rồi bấm Backup ngay lại.":
    "The bot stopped part-way. Make sure it is still in the server with Administrator permission, then hit Back up now again.",
  "Bot không gửi heartbeat (offline hơn 3 phút). Hãy khởi động bot trên host (pm2 start protogon-bot / bật lại service) rồi bấm Backup ngay sau khi bot online.":
    "The bot is not sending heartbeats (offline for more than 3 minutes). Start it on your host (pm2 start protogon-bot / restart the service), then hit Back up now once it is online.",
  "Bot không gửi heartbeat. Hãy khởi động bot trên host rồi thử khôi phục lại sau khi bot online.":
    "The bot is not sending heartbeats. Start it on your host, then try restoring again once it is online.",
  "Role, quyền role và kênh sẽ được tạo lại theo backup. Kết quả sẽ hiện ở đây.":
    "Roles, role permissions and channels are recreated from the backup. The result appears here.",
  "Sao lưu cấu trúc server (role, quyền role, kênh và quyền kênh) lên":
    "Backs up your server structure (roles, role permissions, channels and channel permissions) to",
  ". Khi server bị nuke/raid phá sập hoàn toàn, hãy mời bot vào":
    ". If your server is ever wiped out by a nuke or raid, invite the bot to a",
  "Đang khôi phục vào server này… server lớn kèm tin nhắn có thể mất vài phút. Kết quả hiện ở đây và trong kênh log.":
    "Restoring into this server… a large server with messages can take a few minutes. The result shows up here and in the log channel.",
  "Bot sao lưu toàn bộ": "The bot backs up every",
  "Kèm tin nhắn và media (tối đa 50 tin/kênh)": "Include messages and media (up to 50 per channel)",
  "Nếu server bị": "If your server was",
  "phá sập mà bạn còn giữ được file backup của nó (định dạng":
    "wrecked and you still have its backup file (in",
  "(gồm cả media — file lưu trên đám mây, không nhét vào bộ nhớ bot). Bot giữ nguyên role/kênh có sẵn của server hiện tại, chỉ thêm mới theo file chứ không xóa gì.":
    "(media included — the file stays in the cloud instead of being loaded into the bot's memory). The bot keeps the current server's existing roles and channels, only adding what the file contains and deleting nothing.",
  "Bot tự sao lưu và đẩy lên": "The bot backs up and pushes to",
  "). Bot chỉ giữ": "). The bot keeps only",
  "trong bot — bản cũ hơn tự bị xóa, còn GitHub giữ bản lưu vĩnh viễn.":
    "inside the bot — older ones are deleted automatically, while GitHub keeps them permanently.",
  "Bật lên là bot sao lưu bản đầu tiên trong khoảng 1 phút, sau đó lặp lại theo chu kỳ bạn chọn.":
    "Switch it on and the bot takes its first backup within about a minute, then repeats on the cycle you chose.",
  "(.msc/.json tải lên). Phần tắt sẽ được bỏ qua khi khôi phục (kênh, tin nhắn và media vẫn xử lý bình thường).":
    "(.msc/.json uploads). Anything switched off is skipped during a restore (channels, messages and media are still processed as usual).",
  "Đã yêu cầu tạo backup — bot thực hiện trong khoảng 20 giây":
    "Backup requested — the bot runs it within about 20 seconds",
  "Đã yêu cầu khôi phục — bot thực hiện trong khoảng 1 phút":
    "Restore requested — the bot runs it within about 1 minute",
};
