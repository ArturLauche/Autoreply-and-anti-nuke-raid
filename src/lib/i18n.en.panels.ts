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
  "Protogon Bot · Tự trả lời thông minh, nhiệt độ vi phạm, Join Gate & phòng thủ chống raid cho Discord":
    "Protogon Bot · Smart auto-reply, violation heat, Join Gate & raid defence for Discord",
  "bị chặn: tài khoản": "blocked: the account is",
  "Bảo vệ toàn diện & giao tiếp cho server của bạn":
    "Full protection & conversation for your server",
  "(24 module) canh cấu trúc server (ban/kick hàng loạt, phá kênh, phá role…) và":
    "(24 modules) guards the server structure (mass bans/kicks, channel nuking, role nuking…) and",
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
  "kèm warn tích lũy": "with accumulating warns",
  "canh server 24/7.": "guarding the server 24/7.",
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
};
