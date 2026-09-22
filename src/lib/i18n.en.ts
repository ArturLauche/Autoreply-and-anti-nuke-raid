/**
 * Từ điển EN — kiểu gettext: key là CHÍNH chuỗi tiếng Việt trong code.
 * Thiếu key → translate() rơi về nguyên chuỗi VI (không vỡ UI).
 * Giữ nguyên placeholder {p0}, {p1}… — translate() thay bằng biến lúc chạy.
 *
 * File chia 3 phần theo alphabet để dễ rà soát; KHÔNG đổi tên file
 * (src/lib/i18n.tsx import "./i18n.en").
 */
export const EN: Record<string, string> = {
  /* ==== i18n-extra-chrome ==== Đợt bổ sung: công tắc ngôn ngữ, chrome
     dashboard, trang đăng nhập. Gồm cả nhãn sidebar (hằng số cấp module —
     nay dịch lúc render) vốn nằm ngoài đợt codemod đầu. */
  "Ngôn ngữ": "Language",
  "Tiếng Việt": "Vietnamese",
  English: "English",
  "mất kết nối": "disconnected",
  "thành viên": "members",
  "Chống nuke bật": "Anti-nuke on",
  "Chống nuke tắt": "Anti-nuke off",
  /* ==== i18n-extra-altdetect ==== Panel Alt Detection (nhãn rủi ro, tuổi tài
     khoản, bảng join) — nhóm này trước đây viết tiếng Việt KHÔNG DẤU. */
  "Rủi ro trung bình": "Medium risk",
  "Rủi ro thấp": "Low risk",
  "An toàn": "Safe",
  "hôm nay": "today",
  "1 ngày": "1 day",
  "{n} ngày": "{n} days",
  "{n} tháng": "{n} months",
  "{n} năm": "{n} years",
  "Chế độ VPN/Proxy": "VPN/Proxy mode",
  "Lượt join (7 ngày)": "Joins (7 days)",
  "Rủi ro cao": "High risk",
  "Rủi ro": "Risk",
  "Bằng chứng": "Evidence",
  "Xử lý": "Action",
  Tuổi: "Age",
  "Yếu tố": "Factor",
  "Lượt join gần đây": "Recent joins",
  "Chưa có dữ liệu join nào.": "No join data yet.",
  "Yếu tố rủi ro phổ biến": "Most common risk factors",
  "Đã bật Alt Detection": "Alt Detection enabled",
  "Đã tắt Alt Detection": "Alt Detection disabled",
  ẨN: "HIDDEN",
  "trên thiết bị này": "on this device",
  "Đang chuyển tới Discord…": "Redirecting to Discord…",
  "Đăng nhập với Discord": "Sign in with Discord",
  "sự kiện đã hiển thị": "events shown",
  "Tổng quan": "Overview",
  "Auto-mod": "Auto-mod",
  "Join Gate": "Join Gate",
  "Alt Detection": "Alt Detection",
  "Raid external app": "External app raid",
  Whitelist: "Whitelist",
  "Backup server": "Server backup",
  "Tôi là Haimiya, trợ lý ảo của Protogon — bot Discord bảo vệ server. Tôi có thể giải đáp về hệ thống nhiệt độ, Join Gate, chống nuke/raid, auto reply, công cụ mod… Bạn cứ hỏi, tôi sẽ trả lời rõ ràng.":
    "I'm Haimiya, Protogon's assistant — the Discord bot that protects your server. I can walk you through violation heat, Join Gate, anti-nuke/raid, auto-replies and mod tools… Ask away and I'll answer plainly.",
  "Dashboard là trang quản lý bot trên web 🖥️. Bạn đăng nhập bằng Discord, chọn server, rồi quản lý mọi thứ: Moderation (nhiệt độ, warn, lọc nội dung), Join Gate, Chống nuke/raid, Hình phạt và Cài đặt (prefix, kênh log, chủ đề màu). Thay đổi được bot áp dụng trong khoảng 3 phút.":
    "The dashboard is the web control panel 🖥️. Sign in with Discord, pick a server, then manage everything: Moderation (heat, warns, content filtering), Join Gate, anti-nuke/raid, punishments and Settings (prefix, log channels, colour theme). The bot applies changes within about 3 minutes.",
  "Bot hỗ trợ cả prefix và slash command ⌨️. Công cụ Mod: /mod timeout, /mod kick, /mod ban, /mod purge — lệnh text tương đương !timeout !kick !ban !purge. Ngoài ra: /heat status xem nhiệt & warn, /antinuke bật tắt bảo vệ, /prefix đổi prefix, /badword quản lý từ ngữ xấu. Gõ / trong Discord để xem toàn bộ danh sách slash command.":
    "The bot supports both prefix and slash commands ⌨️. Mod tools: /mod timeout, /mod kick, /mod ban, /mod purge — the text equivalents are !timeout !kick !ban !purge. Also: /heat status for heat & warns, /antinuke to toggle protection, /prefix to change the prefix, /badword to manage banned words. Type / in Discord for the full slash command list.",
  // ── Bổ sung 22/09: bịt rò rỉ khu vực chủ bot + gộp cấu hình kênh log ──
  "Phần này nằm trong khu vực riêng của chủ sở hữu bot nên mình không chia sẻ công khai 🔒. Nếu bạn cần hỗ trợ về các tính năng dùng chung — auto reply, nhiệt độ vi phạm, chống nuke/raid, Join Gate, verify, backup — cứ hỏi mình nhé.":
    "That part belongs to the bot owner's private area, so I don't share it publicly 🔒. If you need help with the shared features — auto-replies, violation heat, anti-nuke/raid, Join Gate, verification, backups — just ask.",
  "Khóa khu vực riêng tư dành cho chủ sở hữu bot. Mật khẩu thuộc về chủ bot và áp dụng cho":
    "Locks the bot owner's private area. The password belongs to the bot owner and applies to",
  "mọi server": "every server",
  "bạn quản lý trên dashboard — không riêng server này. Chỉ":
    "you manage on the dashboard — not just this one. Only",
  "được đặt, đổi hoặc xóa.": "may set, change or clear it.",
  "Chống nuke/raid, Join Gate, verify, báo cáo hàng ngày và mọi thông báo hệ thống. Để trống = tắt toàn bộ log.":
    "Anti-nuke/raid, Join Gate, verification, the daily report and every system notice. Leave empty to turn all logging off.",
  "Kênh log hành động mod (tùy chọn)": "Mod action log channel (optional)",
  "Case ban · kick · timeout · warn và auto-mod (embed hình phạt với":
    "Ban · kick · timeout · warn cases and auto-mod (punishment embed with",
  // ── Rà soát copy 22/09/2026: bỏ tên model/vendor khỏi câu chào hàng, sửa câu
  //    nói sai số module, và Haimiya nay trả lời theo ngôn ngữ người dùng chọn.
  "embed hình phạt chi tiết": "detailed punishment embed",
  "Dùng /report hoặc !report khi server bị raid/nuke hay bot phạt nhầm: hệ thống đọc lại hàng trăm tin nhắn gần nhất để dựng đúng diễn biến và gửi báo cáo kèm bằng chứng cho bạn.":
    "Use /report or !report when a raid/nuke hits or the bot punishes the wrong member: the system re-reads hundreds of recent messages to reconstruct what happened, then sends you a report with the evidence.",
  "Đang hiển thị 20/32 module.": "Showing 20 of 32 modules.",
  "12 module chống nuke còn lại bật/tắt trong dashboard.":
    "The other 12 anti-nuke modules are toggled in the dashboard.",
  "Haimiya là trợ lý ảo của Protogon, luôn túc trực trên website và dashboard. Haimiya trả lời bằng đúng ngôn ngữ bạn đang chọn — tiếng Việt, tiếng Anh hoặc tiếng Đức — về hệ thống nhiệt độ, warn tích lũy, Join Gate, chống nuke/raid, auto reply và cách cấu hình bot.":
    "Haimiya is Protogon's virtual assistant, always available on the website and in the dashboard. Haimiya answers in whichever language you have selected — Vietnamese, English, or German — about the heat system, accumulated warnings, Join Gate, anti-nuke/raid, auto-reply, and how to configure the bot.",
  '; lý do trống → ghi "không có lý do"). Để trống = dùng kênh log chung; chọn trùng kênh log chung thì bot vẫn chỉ gửi một tin cho mỗi case — không nhân đôi log.':
    '; an empty reason is logged as "no reason"). Leave empty to use the general log channel; picking the same channel as the general log still sends only one message per case — no duplicate logs.',
  "Kênh nhận thông báo": "Notification channel",
  "Bot gửi case vào kênh log hành động mod; chưa đặt thì dùng kênh log chung. Nơi cấu hình duy nhất là":
    "The bot posts each case to the mod action log channel, or to the general log channel if that is not set. The only place to configure it is",
  "Cài đặt → Kênh log": "Settings → Log channels",
  "— không chọn kênh lại ở đây để tránh hai nơi ghi đè nhau và log bị nhân đôi.":
    "— don't pick a channel again here, so two places can't override each other and duplicate logs.",
  "Đang gửi tới:": "Currently sending to:",
  "Chưa chọn kênh log nào nên bot chưa gửi được thông báo hình phạt — vào Cài đặt → Kênh log để chọn.":
    "No log channel is set yet, so the bot cannot post punishment notices — pick one in Settings → Log channels.",
  "Xác minh (Verify)": "Verify",
  "Webhook & Log": "Webhook & Log",
  "Cài đặt": "Settings",
  "Hệ thống nhiệt độ 4 giai đoạn + warn tích lũy": "4-stage heat system + accumulated warns",
  "Join Gate chống selfbot khi vào server": "Join Gate blocks selfbots on entry",
  "Chặn link độc hại & file nguy hiểm": "Blocks malicious links & dangerous files",
  "Công cụ mod: timeout, kick, ban, purge kèm lý do":
    "Mod tools: timeout, kick, ban, purge with reasons",
  "Tùy chọn lưu / không lưu đăng nhập": "Remember / don't remember login option",
  'Lấy cảm hứng từ nhân vật "đáng sợ mà đáng yêu", Haimiya là trợ lý ảo của Protogon, luôn túc trực trên website và dashboard. Haimiya giải đáp mọi thắc mắc về bot bằng tiếng Việt: hệ thống nhiệt độ, warn tích lũy, Join Gate, chống nuke/raid, auto reply, cách host bot…':
    'Inspired by a character who is "scary yet adorable", Haimiya is Protogon\'s virtual assistant, always around on the website and dashboard. Haimiya answers every question about the bot in English: heat system, accumulated warns, Join Gate, anti-nuke/raid, auto reply, how to host the bot…',
  /* ==== i18n-extra-kb ==== Nốt phần kiến thức cục bộ còn lại của Haimiya
     (vùng riêng tư, mod tools, warn, moderation, chủ đề màu, báo cáo…). */
  "Tính năng ẩn là khu vực riêng tư dành cho chủ sở hữu bot 🔒 — nội dung bên trong không được tiết lộ công khai. Chỉ admin sở hữu bot mới được phép đặt mật khẩu và mở khu vực này; owner hay mod của một server có quyền quản lý cũng không đủ. Cách mở khóa: chủ bot đăng nhập bằng chính tài khoản Discord đã tạo bot → đặt mật khẩu trong Cài đặt → vào sidebar chọn Tính năng ẩn → nhập mật khẩu là xong.":
    "Hidden features are a private area for the bot owner 🔒 — the content inside is never revealed publicly. Only the admin who owns the bot may set the password and unlock it; a server owner or moderator with manage permissions is not enough. To unlock: the bot owner signs in with the very Discord account that created the bot → sets a password in Settings → opens Hidden features in the sidebar → enters the password.",
  "Công cụ chọn role bằng emoji nằm trong khu vực riêng tư dành cho chủ sở hữu bot 🔒 — tôi không tiết lộ chi tiết công khai. Nếu bạn là chủ sở hữu, hãy đăng nhập bằng tài khoản Discord đã tạo bot, đặt mật khẩu trong Cài đặt rồi mở khóa Tính năng ẩn trong sidebar — mọi thứ đều nằm ở đó.":
    "The emoji reaction-role tool lives in the bot owner's private area 🔒 — I don't reveal the details publicly. If you are the owner, sign in with the Discord account that created the bot, set a password in Settings and unlock Hidden features in the sidebar — everything is in there.",
  "Giveaway nằm trong khu vực riêng tư dành cho chủ sở hữu bot 🔒 — tôi không tiết lộ chi tiết công khai. Nếu bạn là chủ sở hữu, hãy đăng nhập bằng tài khoản Discord đã tạo bot, đặt mật khẩu trong Cài đặt rồi mở khóa Tính năng ẩn trong sidebar.":
    "Giveaway lives in the bot owner's private area 🔒 — I don't reveal the details publicly. If you are the owner, sign in with the Discord account that created the bot, set a password in Settings and unlock Hidden features in the sidebar.",
  "Khả năng nhắn tin trực tiếp nằm trong khu vực riêng tư dành cho chủ sở hữu bot 🔒 — tôi không tiết lộ chi tiết công khai. Nếu bạn là chủ sở hữu, hãy đăng nhập bằng tài khoản Discord đã tạo bot, đặt mật khẩu trong Cài đặt rồi mở khóa Tính năng ẩn trong sidebar.":
    "Direct messaging lives in the bot owner's private area 🔒 — I don't reveal the details publicly. If you are the owner, sign in with the Discord account that created the bot, set a password in Settings and unlock Hidden features in the sidebar.",
  "Việc tùy chỉnh giao diện nằm trong khu vực riêng tư dành cho chủ sở hữu bot 🔒 — tôi không tiết lộ chi tiết công khai. Nếu bạn là chủ sở hữu, hãy đăng nhập bằng tài khoản Discord đã tạo bot, đặt mật khẩu trong Cài đặt rồi mở khóa Tính năng ẩn trong sidebar.":
    "Interface customisation lives in the bot owner's private area 🔒 — I don't reveal the details publicly. If you are the owner, sign in with the Discord account that created the bot, set a password in Settings and unlock Hidden features in the sidebar.",
  "Mỗi server có thể chọn chủ đề màu riêng cho trang quản lý 🎨. Vào Cài đặt → mục Chủ đề màu của server: chọn 1 trong 8 màu (Hồng anh đào, Hồng đỏ, Cam hoàng hôn, Vàng hổ phách, Xanh lá, Xanh ngọc, Xanh trời, Tím oải hương) rồi bấm Áp dụng. Màu sẽ áp dụng ngay cho nút bấm, thẻ và sidebar của riêng server đó trên web.":
    "Every server can pick its own colour theme for the management pages 🎨. Go to Settings → Server colour theme: choose one of 8 colours (Cherry pink, Crimson, Sunset orange, Amber, Green, Teal, Sky blue, Lavender) then click Apply. The colour applies immediately to that server's buttons, cards and sidebar on the web.",
  "Công cụ Mod giúp xử lý thành viên nhanh chóng và có ghi chép đầy đủ 🛠️: /mod timeout @user 10m [lý do], /mod kick @user [lý do], /mod ban @user [lý do] (kèm --days để xóa tin nhắn) và /mod purge <số tin>. Lệnh text tương đương: !timeout, !kick, !ban, !purge. Mọi hành động đều được ghi vào kênh log và bảng hình phạt trên dashboard với lý do + người thực hiện. Cần quyền Quản lý server hoặc role Mod/Admin được cấu hình.":
    "Mod tools let you deal with members quickly and keep a full record 🛠️: /mod timeout @user 10m [reason], /mod kick @user [reason], /mod ban @user [reason] (add --days to delete messages) and /mod purge <count>. Text equivalents: !timeout, !kick, !ban, !purge. Every action is written to the log channel and the dashboard punishment table with the reason and the moderator. You need Manage Server or a configured Mod/Admin role.",
  "Trang đăng nhập có tùy chọn lưu đăng nhập 🪪. Tích Lưu đăng nhập → phiên đăng nhập được giữ lại trên thiết bị, mở lại trình duyệt không cần đăng nhập lại. Chọn Không lưu đăng nhập → token chỉ sống trong tab hiện tại, đóng trình duyệt là phải đăng nhập lại — an toàn hơn khi dùng máy công cộng.":
    "The login page offers a remember-login option 🪪. Tick Remember login → the session is kept on this device, so reopening the browser needs no new sign-in. Choose Don't remember login → the token lives only in the current tab and closing the browser requires signing in again — safer on shared computers.",
  "Tôi là Haimiya, trợ lý ảo của Protogon — bot Discord bảo vệ server. Tôi có thể giải đáp về hệ thống nhiệt độ, Join Gate, chống nuke/raid, auto reply, công cụ mod… Bạn cứ hỏi, tôi sẽ trả lời rõ ràng. Một số khu vực riêng tư của chủ sở hữu bot thì tôi giữ bí mật 🔒.":
    "I'm Haimiya, Protogon's virtual assistant — a Discord bot that protects your server. I can explain the heat system, Join Gate, anti-nuke/raid, auto reply, the mod tools… Just ask and I'll answer clearly. A few private areas of the bot owner I keep secret 🔒.",
  "Warn tích lũy giúp phát hiện người tái phạm liên tục ⚠️. Mỗi lần vi phạm bị xử lý Cảnh báo sẽ được đếm; đủ N lần (mặc định 3) trong cửa sổ (mặc định 60 phút) thì tự tăng cấp hình phạt (tạm khóa / kick / ban — bạn chọn được). Số warn hiển thị dạng X/N ngay trong bảng nhiệt trên dashboard và báo cáo hàng ngày.":
    "Accumulated warns catch members who keep reoffending ⚠️. Every violation punished with a warning is counted; after N warns (default 3) inside the window (default 60 minutes) the punishment escalates automatically (timeout / kick / ban — your choice). The warn count shows as X/N right in the dashboard heat table and the daily report.",
  "Module chống link độc hại & file nguy hiểm bảo vệ thành viên khỏi lừa đảo 🛡️. Bot phát hiện và xóa tin chứa: domain lừa đảo phổ biến (nitro giả, gift giả, crypto scam…), link IP trực tiếp, chữ ký nội dung scam, và file đuôi nguy hiểm (.exe .scr .bat .msi .vbs .ps1 .jar .apk .hta…). Mỗi lần phát hiện đều cảnh báo trong kênh log kèm tên file hoặc link.":
    "The malicious-link & dangerous-file module protects members from scams 🛡️. The bot detects and deletes messages containing: common scam domains (fake nitro, fake gifts, crypto scams…), raw IP links, scam content signatures, and dangerous file extensions (.exe .scr .bat .msi .vbs .ps1 .jar .apk .hta…). Every detection is reported in the log channel with the file name or link.",
  "Mục Moderation tập trung lọc nội dung tin nhắn ✂️: chống spam tin nhắn, chống spam mention, lọc từ ngữ xấu (danh sách tùy chỉnh), chống spam ảnh/file đính kèm, chặn link mời Discord (discord.gg, discord.com/invite) và chống link độc hại/file nguy hiểm. Mỗi module bật/tắt riêng, chỉnh ngưỡng, hình phạt và mức nhiệt cộng cho từng vi phạm.":
    "Moderation focuses on filtering message content ✂️: anti message spam, anti mention spam, bad-word filtering (custom list), anti attachment/image spam, Discord invite blocking (discord.gg, discord.com/invite) and malicious-link/dangerous-file blocking. Each module toggles separately, with its own thresholds, punishments and heat added per violation.",
  "Báo cáo hàng ngày là bản tóm tắt gửi vào kênh log mỗi ngày 📊: tổng số sự kiện, chi tiết theo module, thủ phạm thường xuyên, trạng thái khóa kênh, cùng danh sách nhiệt độ và warn tích lũy của từng thành viên. Bật/tắt trong Cài đặt → Báo cáo chống nuke hàng ngày, nhớ đặt kênh log.":
    "The daily report is a summary posted to the log channel every day 📊: total events, a per-module breakdown, repeat offenders, channel-lock status, plus each member's heat and accumulated warns. Toggle it in Settings → Daily anti-nuke report, and remember to set the log channel.",
  /* ==== i18n-extra-chat ==== Chrome của khung chat Haimiya. */
  "Ảnh không đọc được": "Could not read the image",
  "Video không đọc được": "Could not read the video",
  "Không trích được khung hình từ video": "Could not extract frames from the video",
  "Chỉ hỗ trợ ảnh (jpg/png/webp) hoặc video (mp4/webm)":
    "Only images (jpg/png/webp) or videos (mp4/webm) are supported",
  "Máy chủ AI đang lỗi tạm thời": "The AI server is temporarily down",
  "(xem ảnh)": "(see image)",
  "Không đọc được file": "Could not read the file",
  "Mô tả về ảnh…": "Describe the image…",
  "Hỏi tôi điều gì đó…": "Ask me anything…",
  "Haimiya sẵn sàng giải đáp — hỏi về Protogon hay bất cứ điều gì ngoài lề.":
    "Haimiya is ready — ask about Protogon or anything off-topic.",
  "Haimiya trò chuyện thoải mái — hỏi về Protogon hoặc bất cứ điều gì bạn muốn.":
    "Haimiya chats freely — ask about Protogon or anything else you like.",
  "⚠️ AI trên máy chủ chưa phản hồi — {reason}. Tạm trả lời bằng kiến thức cục bộ.":
    "⚠️ The AI server did not respond — {reason}. Answering from local knowledge for now.",
  "⚠️ AI trên máy chủ chưa phản hồi. Tạm trả lời bằng kiến thức cục bộ.":
    "⚠️ The AI server did not respond. Answering from local knowledge for now.",
  "Vui lòng đăng nhập dashboard để trò chuyện với Haimiya":
    "Please sign in to the dashboard to chat with Haimiya",
  /* ==== i18n-extra-haimiya ==== Phần giới thiệu + câu hỏi gợi ý của
     Haimiya (kiến thức cục bộ, dùng khi AI thật offline). */
  "Xin chào! Tôi là Haimiya, trợ lý ảo của Protogon — bot Discord bảo vệ server. Tôi có thể giúp bạn giải đáp về hệ thống nhiệt độ, Join Gate, chống nuke/raid, công cụ mod và nhiều hơn nữa. Bạn muốn hỏi điều gì?":
    "Hello! I'm Haimiya, Protogon's virtual assistant — a Discord bot that protects your server. I can explain the heat system, Join Gate, anti-nuke/raid, mod tools and much more. What would you like to know?",
  "Mình rất muốn trò chuyện về điều đó! Hiện tại AI thật chưa kết nối được nên mình chỉ trả lời được các câu hỏi về Protogon trong kiến thức sẵn có. Bạn thử hỏi về: nhiệt độ, join gate, warn, hosting, bảng hình phạt… Hoặc chọn một câu hỏi gợi ý bên dưới nhé.":
    "I'd love to chat about that! The live AI isn't connected right now, so I can only answer Protogon questions from my built-in knowledge. Try asking about: heat, join gate, warns, hosting, the punishment table… Or pick a suggestion below.",
  "Hệ thống nhiệt độ hoạt động thế nào?": "How does the heat system work?",
  "Join Gate là gì?": "What is Join Gate?",
  "Cách đặt mật khẩu tính năng ẩn": "How to set the hidden-features password",
  "Cách chạy bot trên hosting": "How to run the bot on hosting",
  "Chủ sở hữu bot là ai?": "Who is the bot owner?",
  "Công cụ mod gồm những gì?": "What do the mod tools include?",
  "Bảng hình phạt là gì?": "What is the punishment table?",
  "Cách xem nhiệt của thành viên": "How to view a member's heat",
  "Chống nuke/raid là gì?": "What is anti-nuke/raid?",
  "Moderation lọc những gì?": "What does Moderation filter?",
  "Join Gate chống được gì?": "What does Join Gate block?",
  "Warn tích lũy là gì?": "What are accumulated warns?",
  "Báo cáo hàng ngày là gì?": "What is the daily report?",
  "Chủ đề màu server là gì?": "What is the server colour theme?",
  "Đổi avatar bot ở đâu?": "Where do I change the bot avatar?",
  "Giveaway có những tùy chọn gì?": "What options does Giveaway have?",
  "Tính năng ẩn gồm những gì?": "What are the hidden features?",
  "Cách đặt kênh log": "How to set the log channel",
  "Cách đăng nhập dashboard": "How to sign in to the dashboard",
  "Bot có những lệnh nào?": "What commands does the bot have?",
  "Lưu đăng nhập là gì?": "What does 'remember login' mean?",
  /* ==== i18n-extra-haimiya-answers ==== Câu trả lời cục bộ, dùng khi AI
     thật không phản hồi được (xem FALLBACK trong src/lib/haimiya.ts). */
  "Hệ thống nhiệt độ hoạt động theo thang điểm 0–100 🌡️. Mỗi vi phạm cộng điểm nhiệt theo cài đặt; ngưỡng mặc định: cảnh báo 25, tạm khóa 40, kick 70, ban 90. Khi chạm ngưỡng, bot tự xử lý (cảnh báo DM → tạm khóa → kick → ban). Nhiệt giảm dần theo phút (mặc định 3 điểm/phút) và nếu tái phạm trong cửa sổ (mặc định 30 phút) sẽ bị nhân nhiệt (mặc định x2). Tất cả ngưỡng đều chỉnh được trong Moderation.":
    "The heat system runs on a 0–100 scale 🌡️. Each violation adds heat based on your settings; default thresholds: warn 25, timeout 40, kick 70, ban 90. When a threshold is reached the bot acts automatically (DM warn → timeout → kick → ban). Heat decays per minute (default 3 points/minute), and repeat offences inside a window (default 30 minutes) multiply heat (default x2). Every threshold is configurable in Moderation.",
  "Join Gate là cổng kiểm soát thành viên khi vào server 🚪. Bạn bật từng tùy chọn trong mục Join Gate: chặn tài khoản quá mới (số ngày tùy chỉnh), bắt buộc có avatar, bắt buộc có huy hiệu, và chặn toàn bộ lượt vào khi server đang bị raid. Có danh sách trắng để miễn trừ, và chọn hình phạt Kick hoặc Ban cho các trường hợp bị chặn.":
    "Join Gate screens members as they enter the server 🚪. Enable each option in the Join Gate section: block accounts that are too new (customisable days), require an avatar, require a badge, and block all joins while the server is being raided. A whitelist can exempt members, and you choose Kick or Ban for blocked cases.",
  "Chống nuke/raid bảo vệ cấu trúc server 🛡️ với 10 module nuke: ban hàng loạt, kick hàng loạt, raid thành viên, tạo kênh hàng loạt, xóa kênh hàng loạt, tạo role hàng loạt, xóa role hàng loạt, xóa tin hàng loạt, tạo webhook hàng loạt, tạo thread hàng loạt. Các module này phạt trực tiếp (warn/kick/ban/timeout), không cộng nhiệt. Bot có AI Guard 🧠 tự phân biệt đâu là raid/nuke thật sự (leo thang ban + khóa kênh) với vi phạm cá nhân (chỉ cộng nhiệt, moderation bình thường) — nhận diện cả spam tin dài cực dài, tin lặp nội dung và tin giả blank (toàn khoảng trắng/ký tự ẩn) gây nhiễu. Khi bị tấn công, bot tự khóa kênh (lockdown) và mở khóa bằng /antinuke unlock.":
    "Anti-nuke/raid protects your server's structure 🛡️ with 10 nuke modules: mass ban, mass kick, member raids, mass channel create, mass channel delete, mass role create, mass role delete, mass message delete, mass webhook create, mass thread create. These punish directly (warn/kick/ban/timeout) instead of adding heat. AI Guard 🧠 tells a real raid/nuke (escalating bans + channel lockdown) from individual offences (heat only, normal moderation) — it also spots extremely long message spam, repeated content and blank-noise messages (whitespace/invisible characters). When attacked, the bot locks channels (lockdown); unlock with /antinuke unlock.",
  "Auto Reply tự động trả lời tin nhắn theo rule 💬. Mỗi rule gồm: tên, loại kích hoạt (từ khóa xuất hiện trong tin hoặc khi thành viên tag bot), nội dung trả lời (hỗ trợ {user} và {username}), giới hạn kênh và cooldown chống spam. Quản lý rule ngay trên dashboard hoặc lệnh !autoreply add/list/remove.":
    "Auto Reply answers messages by rule 💬. Each rule has: a name, a trigger type (a keyword found in a message, or a member tagging the bot), reply content (supports {user} and {username}), channel limits and an anti-spam cooldown. Manage rules on the dashboard or with !autoreply add/list/remove.",
  "Dashboard là trang quản lý bot trên web 🖥️. Bạn đăng nhập bằng Discord, chọn server, rồi quản lý mọi thứ: Moderation (nhiệt độ, warn, lọc nội dung), Join Gate, Chống nuke/raid, Hình phạt, Tính năng ẩn và Cài đặt (prefix, kênh log, chủ đề màu). Thay đổi được bot áp dụng trong khoảng 3 phút.":
    "The dashboard is the bot's web control panel 🖥️. Sign in with Discord, pick a server, then manage everything: Moderation (heat, warns, content filtering), Join Gate, anti-nuke/raid, Punishments, Hidden features and Settings (prefix, log channel, colour theme). The bot applies changes within about 3 minutes.",
  "Bot hỗ trợ cả prefix và slash command ⌨️. Công cụ Mod: /mod timeout, /mod kick, /mod ban, /mod purge — lệnh text tương đương !timeout !kick !ban !purge. Ngoài ra: /heat status xem nhiệt & warn, /antinuke bật tắt bảo vệ, /prefix đổi prefix, /badword quản lý từ ngữ xấu. Một số lệnh khác nằm trong khu vực riêng tư của chủ sở hữu bot 🔒. Gõ / trong Discord để xem toàn bộ danh sách slash command.":
    "The bot supports both prefix and slash commands ⌨️. Mod tools: /mod timeout, /mod kick, /mod ban, /mod purge — with the text equivalents !timeout !kick !ban !purge. Also: /heat status for heat & warns, /antinuke to toggle protection, /prefix to change the prefix, /badword to manage bad words. Some commands live in the bot owner's private area 🔒. Type / in Discord for the full slash-command list.",
  "Protogon miễn phí cho mọi server 💰. Toàn bộ tính năng công khai — auto reply, nhiệt độ 4 giai đoạn, warn tích lũy, Join Gate, chống nuke/raid, chặn link độc hại, công cụ mod, bảng hình phạt, báo cáo hàng ngày — đều dùng được không giới hạn. Bạn chỉ cần host bot và dùng dashboard, không mất phí.":
    "Protogon is free for every server 💰. All public features — auto reply, 4-stage heat, accumulated warns, Join Gate, anti-nuke/raid, malicious-link blocking, mod tools, the punishment table, daily reports — are unlimited. You only host the bot and use the dashboard; no fees.",
  "Đăng nhập rất nhanh 🪪. Bấm nút Đăng nhập với Discord ở góc phải trên cùng (hoặc nút Mở dashboard), Discord xác nhận quyền, xong là vào thẳng dashboard. Trang đăng nhập có tùy chọn Lưu đăng nhập / Không lưu đăng nhập. Chỉ server nào bạn có quyền quản lý mới hiện ra — nếu chưa thấy server, hãy mời bot vào server đó trước.":
    "Signing in takes seconds 🪪. Click Sign in with Discord at the top right (or the Open dashboard button), Discord confirms access and you land straight on the dashboard. The login page offers Remember / Don't remember login. Only servers you can manage appear — if a server is missing, invite the bot to it first.",
  "Để bot chạy 24/7, bạn cần một hosting bot (ví dụ Wispbyte) 🚀. Quy trình: tải file zip bot từ nhánh host-deploy trên GitHub → vào hosting, xóa file cũ → upload zip mới → Unarchive → Restart. Mỗi lần có bản cập nhật, lặp lại đúng quy trình đó. Nhớ cấu hình đủ token Discord và khóa Convex trong file cấu hình.":
    "To keep the bot online 24/7 you need bot hosting (Wispbyte, for example) 🚀. Steps: download the bot zip from the host-deploy branch on GitHub → open your hosting, delete the old files → upload the new zip → Unarchive → Restart. Repeat the same steps for every update. Remember to configure the Discord token and the Convex key in the config file.",
  "Bảng hình phạt nằm trong mục Hình phạt trên sidebar trang quản lý server 🛠️. Nó liệt kê đầy đủ các hình phạt gần nhất: timeout, kick, ban, purge — kèm thời gian, thành viên bị phạt, người thực hiện (mod) và lý do. Các hình phạt tự động từ hệ thống chống nuke/nhiệt độ cũng được ghi vào bảng này với nhãn Tự động. Bot ghi nhận khi bạn dùng /mod hoặc !timeout !kick !ban !purge.":
    "The punishment table lives under Punishments in the server sidebar 🛠️. It lists recent punishments in full: timeout, kick, ban, purge — with time, punished member, the moderator and the reason. Automatic punishments from anti-nuke/heat are logged here too, tagged Automatic. The bot records them when you use /mod or !timeout !kick !ban !purge.",
  "! Thử một trận Valorant 5v5 không? 🎮": "! Up for a 5v5 Valorant match? 🎮",
  '"{p0}" đã có trong danh sách': '"{p0}" is already in the list',
  "(7 ngày)": "(7 days)",
  "(8 module) sàng lọc nội dung độc hại mỗi ngày. Vượt ngưỡng, bot truy ra thủ phạm qua audit log, phạt đúng cài đặt và báo real-time về kênh log.":
    "(8 modules) screen harmful content every day. Break a threshold and the bot traces the offender through the audit log, punishes per your settings and alerts the log channel in real time.",
  "(JSON thường / base64 / có lớp bọc), tạo lại": "(plain JSON / base64 / wrapped), recreate",
  "(chỉ server này)": "(this server only)",
  "(chống nuke / auto-mod — Responsible moderator hiển thị là “Bot tự động”) lẫn":
    "(anti-nuke / auto-mod — Responsible moderator shows as “Automated”) and",
  "(hiển thị tên người thực hiện). Lý do để trống → ghi “không có lý do”. Chọn":
    "(shows the moderator's name). Empty reason → recorded as “no reason”. Choose",
  "(khớp tài khoản Discord đã tạo bot). Người dùng khác không thấy nút này và không truy cập được trang này.":
    "(matching the Discord account that created the bot). Other users cannot see this button or open this page.",
  "(kể cả raid/nuke phát hiện qua AI). Role ở server khác không ảnh hưởng.":
    "(including AI-detected raids/nukes). Roles from other servers have no effect.",
  "(tên, màu, hoist, mentionable, quyền),": "(name, colour, hoist, mentionable, permissions),",
  "(tối thiểu": "(minimum",
  "(đã đặt trong Keys) — owner các server khác": "(set in Keys) — owners of other servers",
  ", không avatar, không huy hiệu → đã bị kick.": ", no avatar, no badge → kicked.",
  ", mỗi lần vi phạm đếm": ", each violation counts",
  ". Bot chưa có BOT_KEY sẽ": ". A bot without BOT_KEY will",
  '. Lý do trống → ghi "không có lý do".': '. Empty reason → recorded as "no reason".',
  ". Slash command hoạt động độc lập.": ". Slash commands work independently.",
  "1. Backup đã được đẩy lên GitHub từ trước → dữ liệu vẫn còn.":
    "1. The backup was already pushed to GitHub → data still exists.",
  "2. Tạo server phụ, mời bot vào.": "2. Create a backup server and invite the bot.",
  "3 bản mới nhất": "latest 3 versions",
  "3. Vào dashboard → server phụ → Backup → bấm “Khôi phục”.":
    "3. Open the dashboard → backup server → Backup → click “Restore”.",
  "32 module bảo vệ": "32 protection modules",
  "32/32 bật": "32/32 on",
  "4. Bot tạo lại role (tên, màu, quyền), danh mục, kênh + quyền truy cập và cấu hình cơ bản. Các role/kênh có sẵn của server phụ được giữ nguyên (không xóa gì).":
    "4. The bot recreates roles (name, colour, permissions), categories, channels + access and basic config. Existing roles/channels on the backup server are kept (nothing deleted).",
  "AI chẩn đoán lỗi runtime · đề xuất vá vào kênh log (không tự sửa)":
    "AI diagnoses runtime errors · posts a suggested patch to the log channel (no auto-fix)",
  "AI nhận diện": "AI detection",
  "AI tổng hợp (Mimo V2.5)": "AI synthesis (Mimo V2.5)",
  "App ngoài phát hiện": "External apps detected",
  "Auto-mod nội dung": "Content auto-mod",
  "Avatar URL ghi đè (tùy chọn)": "Avatar URL override (optional)",
  "Backup có sẵn": "Available backups",
  "Backup thất bại: {p0}": "Backup failed: {p0}",
  "Biểu đồ độ trễ (5 giây / mẫu)": "Latency chart (5s / sample)",
  "Bot Discord bảo vệ server, đồng hành cùng trợ lý Haimiya":
    "Discord server-protection bot, with the Haimiya assistant",
  "Bot vẫn chưa xử lý file backup": "The bot has not processed the backup file yet",
  "Bot vẫn chưa xử lý xong khôi phục": "The bot has not finished restoring yet",
  "Bot đang OFFLINE — hãy khởi động bot trên host (Wispbyte…) rồi tải lại file.":
    "The bot is OFFLINE — start it on your host (Wispbyte…) and reload the file.",
  "Bot đang OFFLINE — không thể backup lúc này": "The bot is OFFLINE — cannot back up right now",
  "Bot đang OFFLINE — không thể khôi phục lúc này": "The bot is OFFLINE — cannot restore right now",
  "Bot đang phục vụ": "Servers using the bot",
  "Bot đang trực tuyến": "Bot is online",
  "Bot đã khôi phục xong": "The bot finished restoring",
  "Bot đã khôi phục xong backup từ file": "The bot finished restoring the backup file",
  "Báo cáo chống nuke hàng ngày": "Daily anti-nuke report",
  "Bạn chưa quản lý server nào có bot — hãy mời bot vào server trước.":
    "You don't manage any server with the bot yet — invite it first.",
  "Bạn không có quyền quản lý, hoặc bot chưa đồng bộ server này.":
    "You lack manage permissions, or the bot hasn't synced this server yet.",
  "Bạn đã xác minh thành công. Chào mừng bạn đến với server!":
    "You verified successfully. Welcome to the server!",
  "Bảng hình phạt": "Punishment log",
  "Bảng xếp hạng nhiệt độ": "Heat leaderboard",
  "Bảng điều khiển": "Dashboard",
  "Bảng điều khiển nhanh": "Quick panel",
  "Bảo mật": "Security",
  "Bật Join Gate": "Enable Join Gate",
  "Bật bảo vệ": "Enable protection",
  "Bật xác minh thành viên": "Enable member verification",
  "Bắt đầu ngay": "Get started",
  "Bắt đầu nhanh": "Quick start",
  "Bỏ ảnh": "Remove image",
  Chào: "Hi",
  "Chào {user}! Cần tớ giúp gì không?": "Hi {user}! How can I help?",
  "Chèn:": "Insert:",
  "Chìa khóa bảo mật API": "API security key",
  "Chưa có ID nào — mọi thành viên mới đều bị kiểm tra.":
    "No IDs yet — every new member is checked.",
  "Chưa có backup nào — bấm “Backup ngay” phía trên để tạo bản đầu tiên.":
    "No backups yet — click “Back up now” above to create the first one.",
  'Chưa có bảng reaction role nào. Bấm "Tạo bảng mới" để bắt đầu 🌸':
    'No reaction-role panels yet. Click "New panel" to start 🌸',
  "Chưa có người dùng nào — thêm ID phía trên để miễn trừ.":
    "No users yet — add IDs above to exempt them.",
  "Chưa có server nào": "No servers yet",
  "Chưa có — bot sẽ": "None yet — the bot will",
  "Chưa học được từ khóa nào — bật research và chờ lượt chạy đầu tiên (5 phút sau khi bot online).":
    "No keywords learned yet — enable research and wait for the first run (5 minutes after the bot comes online).",
  "Chưa thêm bot": "Bot not invited",
  "Chưa xác định được tên app": "App name unknown",
  "Chưa đặt mật khẩu": "No password set",
  Chậm: "Slow",
  "Chặn tài khoản quá mới": "Block accounts that are too new",
  "Chặn đứng kẻ phá hoại": "Stop vandals in their tracks",
  "Chế độ an toàn (chống chặn nhầm)": "Safe mode (avoid false positives)",
  Chỉ: "Only",
  "Chỉ chủ sở hữu bot nhìn thấy · theo dõi lỗi & dữ liệu bot":
    "Visible to the bot owner only · monitors bot errors & data",
  "Chỉ phạt khi có": "Only punish with",
  "Chọn emoji": "Choose emoji",
  "Chọn kênh": "Choose channel",
  "Chọn kênh…": "Choose channel…",
  "Chọn loại": "Choose type",
  "Chọn role admin…": "Choose admin role…",
  "Chọn role miễn trừ…": "Choose exempt role…",
  "Chọn role mod…": "Choose mod role…",
  "Chọn role…": "Choose role…",
  "Chọn server": "Choose server",
  "Chọn server để cấu hình auto reply, nhiệt độ, Join Gate, chống nuke và các module bảo vệ.":
    "Pick a server to configure auto-reply, heat, Join Gate, anti-nuke and protection modules.",
  "Chọn server…": "Choose server…",
  "Chống nuke / raid": "Anti-nuke / raid",
  "Chống nuke / raid → Thành viên & quyền": "Anti-nuke / raid → Members & permissions",
  "Chủ bot:": "Bot owner:",
  "Chủ sở hữu": "Owner",
  "Cài đặt server": "Server settings",
  "Cài đặt → Mật khẩu tính năng ẩn": "Settings → Hidden features password",
  "Cách hoạt động:": "How it works:",
  "Có lỗi xảy ra khi kết nối với backend. Trang khác vẫn hoạt động bình thường — bạn có thể chuyển sang mục khác ở sidebar.":
    "Failed to connect to the backend. Other pages still work — you can switch to another sidebar section.",
  "Có thay đổi chưa lưu — bấm Lưu để áp dụng.": "You have unsaved changes — click Save to apply.",
  "Cơ bản": "Basic",
  "Cảnh báo khẩn khi raid/nuke": "Urgent alert on raid/nuke",
  "Cần cấu hình Client ID": "Client ID required",
  "Cập nhật gần nhất": "Last updated",
  "Cập nhật khung giờ ngay bây giờ": "Update the schedule now",
  "Cập nhật tiếp theo": "Next update",
  "Cụm từ mới:": "New phrases:",
  "Cửa sổ (giây)": "Window (seconds)",
  "Cửa sổ (phút)": "Window (minutes)",
  "Cửa sổ Admin": "Admin window",
  "Cửa sổ Admin là khu vực riêng tư của chủ sở hữu bot — người dùng khác không nhìn thấy và không vào được.":
    "The Admin window is a private area for the bot owner — other users can't see or open it.",
  "Cửa sổ tái phạm (phút)": "Repeat window (minutes)",
  "DM chào mừng": "Welcome DM",
  "DM chào mừng bật": "Welcome DM on",
  "Danh sách các vụ bot đã chặn khi loạt": "Cases the bot blocked in a burst",
  "Danh sách trắng": "Whitelist",
  "Danh sách tối đa 100 từ": "Up to 100 words",
  "Dán vào API Keys với tên": "Paste it into API Keys as",
  "Dán đường dẫn ảnh hợp lệ (bắt đầu bằng http:// hoặc https://)":
    "Paste a valid image URL (starting with http:// or https://)",
  Dùng: "Use",
  "Dọn tin nhắn": "Message cleanup",
  "Embed moderation hiển thị": "Moderation embed shows",
  "Emoji tùy chỉnh": "Custom emoji",
  "File quá lớn (tối đa 8 MB) — hãy nén backup hoặc bỏ bớt media nặng rồi thử lại":
    "File too large (max 8 MB) — compress the backup or drop heavy media and retry",
  "GIỜ VIỆT NAM": "VIETNAM TIME",
  "Ghi chú nhanh": "Quick note",
  "Giao diện": "Appearance",
  "Gist riêng tư": "Private Gist",
  "GitHub của chủ bot": "Bot owner's GitHub",
  "Giá trị": "Value",
  "Giám sát bot": "Bot monitor",
  "Giải thưởng (hiển thị trong embed)": "Prize (shown in the embed)",
  "Giảm nhiệt (điểm/phút)": "Heat decay (points/minute)",
  "Giới hạn file": "File limit",
  "Gặp gỡ trợ lý ảo": "Meet the assistant",
  Gửi: "Send",
  "Gửi DM": "Send DM",
  "Gửi DM chào mừng sau khi verify": "Send a welcome DM after verification",
  "Gửi embed": "Send embed",
  "Gửi panel xác minh vào kênh": "Post the verification panel",
  "Gửi thành công!": "Sent successfully!",
  "Gửi thông báo học tập vào kênh log các server (kết quả lượt học thủ công + digest tuần). MẶC ĐỊNH TẮT — bật khi muốn admin theo dõi bot học được gì ngay trên Discord thay vì mở web.":
    "Post learning notices to servers' log channels (manual-run results + weekly digest). OFF BY DEFAULT — enable it to follow what the bot learns right in Discord instead of opening the web.",
  "Gửi tin nhắn DM trực tiếp": "Send a direct DM",
  "Gửi ảnh (jpg/png/webp) hoặc video ≤50MB — Haimiya sẽ xem giúp bạn":
    "Send an image (jpg/png/webp) or video ≤50MB — Haimiya will take a look",
  "Gửi ảnh hoặc video": "Send image or video",
  "Hai lớp phòng thủ:": "Two layers of defence:",
  "Haimiya gợi ý": "Haimiya suggests",
  "Haimiya — trợ lý ảo đáng tin cậy": "Haimiya — your reliable assistant",
  "Hoạt động chống nuke gần đây": "Recent anti-nuke activity",
  "Hoạt động trong 3 bước": "Works in 3 steps",
  "Hoặc dán đường dẫn ảnh": "Or paste an image URL",
  "Hình phạt": "Punishments",
  "Hình phạt khi tăng cấp": "Punishment on escalation",
  "Hình phạt thành viên": "Member punishment",
  "Hình thức xử lý": "Action type",
  "Hôm nay chơi gì @protogon?": "What are we playing today @protogon?",
  "Hôm nay chơi gì?": "What are we playing today?",
  "Hôm nay lúc 00:00": "Today at 00:00",
  "Hệ thống nhiệt độ vi phạm": "Violation heat system",
  "Hỏi Haimiya": "Ask Haimiya",
  "Hỏi thử Haimiya ngay": "Ask Haimiya now",
  Hủy: "Cancel",
  "ID người dùng": "User ID",
  "ID người dùng không hợp lệ (15–20 chữ số)": "Invalid user ID (15–20 digits)",
  "ID này đã có trong danh sách trắng": "This ID is already whitelisted",
  "JOIN GATE — TỰ ĐỘNG CHẶN SELFBOT": "JOIN GATE — AUTO-BLOCK SELFBOTS",
  "Join Gate chống selfbot": "Join Gate anti-selfbot",
  "Join Gate — cổng vào server": "Join Gate — server entry gate",
  "Khi bật, bot tải tin an ninh công khai (Reddit security, CISA KEV) mỗi giờ, học từ khóa scam mới và dùng MIỄN PHÍ vĩnh viễn trong bộ lọc link độc hại. Từ khóa sai có thể bấm xóa bên dưới. Chi phí: gần như 0 — không cần key thêm.":
    "When on, the bot fetches public security feeds (Reddit security, CISA KEV) hourly, learns new scam keywords and uses them FREE forever in the malicious-link filter. Remove wrong keywords below. Cost: near zero — no extra key needed.",
  "Khi bật, mỗi khi bot gặp lỗi runtime (unhandled rejection / uncaught exception), lỗi + đoạn code liên quan được gửi cho AI (Mimo V2.5 qua Kira — free 30M tokens/ngày riêng cho việc học) để chẩn đoán nguyên nhân và đề xuất bản vá dạng diff. KẾT QUẢ CHỈ LÀ ĐỀ XUẤT đăng vào kênh log — bot không tự sửa code, không tự restart. Cùng 1 lỗi chỉ chẩn đoán 1 lần/giờ.":
    "When on, every runtime error the bot hits (unhandled rejection / uncaught exception) is sent to AI (Mimo V2.5 via Kira — 30M free tokens/day dedicated to learning) for a root-cause diagnosis and a diff-style patch suggestion. THE RESULT IS ONLY A SUGGESTION posted to the log channel — the bot never edits its own code or restarts. The same error is diagnosed at most once per hour.",
  "Khi module dùng hình phạt": "When a module uses a punishment",
  "Khi đăng nhập, Protogon cần quyền": "On sign-in, Protogon needs the",
  "Khu vực riêng tư · chỉ chủ sở hữu bot": "Private area · bot owner only",
  "Khung giờ cập nhật": "Update schedule",
  "Khóa kênh khi bị raid": "Lock channels during a raid",
  "Khóa lại": "Lock again",
  "Khôi phục emoji / sticker": "Restore emoji / stickers",
  "Khôi phục kênh (danh mục, văn bản, thoại…)": "Restore channels (categories, text, voice…)",
  "Khôi phục role (tên, màu, quyền, thứ tự)": "Restore roles (name, colour, permissions, order)",
  "Khôi phục thất bại: {p0}": "Restore failed: {p0}",
  "Khôi phục tin nhắn + media": "Restore messages + media",
  "Khôi phục từ file backup của bot nuke (.msc / .json)":
    "Restore from a nuke bot's backup file (.msc / .json)",
  "Khôi phục từ file thất bại: {p0}": "Restore from file failed: {p0}",
  "Không ai đang nóng đầu cả — server đang rất bình yên.":
    "Nobody is running hot — your server is calm.",
  "Không có quyền truy cập": "No access",
  "Không cấp role": "Grant no role",
  "Không ghi nhận sự cố trong phiên này — hệ thống ổn định ✅":
    "No incidents this session — the system is stable ✅",
  "Không gửi tin nhắn": "Send no message",
  "Không kết nối được máy chủ": "Cannot reach the server",
  "Không lưu đăng nhập": "Don't remember sign-in",
  "Không phát hiện lỗi nào — bot hoạt động bình thường ✅":
    "No errors found — the bot is running normally ✅",
  "Không thể làm mới tự động — hãy thử nút Tải lại hoặc Đăng nhập lại.":
    "Couldn't refresh automatically — try Reload or sign in again.",
  "Không thể truy cập server này": "Cannot access this server",
  "Không thể truy cập server này — bạn không có quyền quản lý.":
    "Cannot access this server — you lack manage permissions.",
  "Không thể đọc dữ liệu — bạn không có quyền quản lý server này.":
    "Cannot read data — you lack manage permissions on this server.",
  "Không tìm thấy emoji phù hợp.": "No matching emoji found.",
  "Không tìm thấy trang này": "Page not found",
  "Không tải được nội dung mục này": "Couldn't load this section",
  "Kick/Ban thành viên": "Kick/Ban members",
  "Kênh gửi giveaway": "Giveaway channel",
  "Kênh gửi thông báo hình phạt": "Punishment notice channel",
  "Kênh gửi tin nhắn": "Message channel",
  "Kênh hiển thị embed xác minh. Thành viên mới chỉ thấy kênh này.":
    "The channel showing the verification embed. New members only see this channel.",
  "Kênh log chung": "Shared log channel",
  "Kênh xác minh": "Verification channel",
  "Loại kích hoạt": "Trigger type",
  "Loại sự kiện nhận log": "Event types to log",
  "Lý do": "Reason",
  "Lưu ý: bản ghi sự cố được ghi nhận trong phiên xem này (mất kết nối máy chủ, độ trễ quá cao). Để theo dõi xuyên suốt, hãy giữ trang này mở hoặc kiểm tra kênh log trong Discord.":
    "Note: incident records cover this viewing session (server disconnects, excessive latency). To track continuously, keep this page open or check the log channel in Discord.",
  "Lưu đăng nhập": "Remember sign-in",

  // ── D–G ──
  "Lượt chạy gần nhất:": "Last run:",
  "Lượt chẩn đoán gần nhất:": "Last diagnosis:",
  "Lần backup trước": "Previous backup",
  "Lần cuối:": "Last:",
  "Lần khôi phục trước": "Previous restore",
  "Lần thử trước": "Previous attempt",
  "Lịch sử chống nuke": "Anti-nuke history",
  "Lọc từ ngữ xấu": "Bad-word filter",
  "Lời chúc mừng riêng khi gửi DM người thắng (tùy chọn)":
    "Custom congratulation in the winner DM (optional)",
  "Miễn phí · cập nhật tự động từ Discord": "Free · auto-updated from Discord",
  "Miễn trừ hoàn toàn khỏi mọi module chống nuke.": "Fully exempt from every anti-nuke module.",
  "Moderation — thông báo sau khi phạt": "Moderation — post-punishment notice",
  "Module đang bảo vệ": "Modules protecting",
  Màu: "Colour",
  "Màu embed": "Embed colour",
  "Máy chủ đang gặp sự cố 🌸": "The server is having trouble 🌸",
  "Mô tả / nội dung chính...": "Description / main content...",
  "Mẫu tin nhắn giveaway": "Giveaway message template",
  "Mật khẩu mới": "New password",
  "Mật khẩu tính năng ẩn 🔒": "Hidden features password 🔒",
  "Mật khẩu tính năng ẩn…": "Hidden features password…",
  "MẶC ĐỊNH — tự động": "DEFAULT — automatic",
  "Mọi thành viên": "Everyone",
  "Trọn bộ trong một bot": "A full toolkit in one bot",
  Mỗi: "Every",
  "Mỗi backup tạo một": "Each backup creates a",
  "Một số khả năng đặc biệt…": "Some special abilities…",
  "Mời bot": "Invite the bot",
  "Mời bot vào server": "Invite the bot to your server",
  "Mời thêm": "Invite more",
  "Mở Discord": "Open Discord",
  "Mở Discord server": "Open Discord server",
  "Mở bảng điều khiển nhanh": "Open the quick panel",
  "Mở dashboard": "Open dashboard",
  "Mở khóa": "Unlock",
  "Mở khóa ngay": "Unlock now",
  "Mức an toàn của server": "Server safety level",
  "N ngày": "N days",
  "NHIỆT ĐỘ VI PHẠM — THÀNH VIÊN “dang_spam”": "VIOLATION HEAT — MEMBER “dang_spam”",
  "Bên cạnh những gì bạn thấy, Protogon giữ riêng một khu vực quyền lực mà chỉ chủ sở hữu bot mở khóa được bằng mật khẩu bí mật — ngay trong dashboard, không cần cài thêm gì.":
    "Beyond what you see, Protogon keeps a private power area that only the bot owner can unlock with a secret password — right in the dashboard, nothing extra to install.",
  "Nguyên tắc ưu tiên": "Priority rules",
  Nguồn: "Source",
  "Người dùng bị xử lý": "Users handled",
  "Người dùng đã bị xử lý": "Users handled",
  "Người dùng được miễn trừ": "Exempt users",
  "Người thực hiện": "Moderator",
  "Ngưỡng ban": "Ban threshold",
  "Ngưỡng kick": "Kick threshold",
  "Ngưỡng tạm khóa": "Timeout threshold",
  "Ngưỡng warn": "Warn threshold",
  "Nhiệt cao nhất:": "Highest heat:",
  "Nhiệt · Warn": "Heat · Warns",
  "Nhận signature từ server khác": "Receive signatures from other servers",
  Nhập: "Enter",
  "Nhập Discord Webhook URL": "Enter a Discord Webhook URL",
  "Nhập ID người dùng Discord…": "Enter a Discord user ID…",
  "Nhập nội dung trả lời": "Enter the reply content",
  "Nhập tên rule": "Enter the rule name",
  "Nhập từ ngữ cần chặn…": "Enter words to block…",
  "Nhập ít nhất một từ khóa": "Enter at least one keyword",
  "Nhập đúng ID người dùng Discord (15-20 chữ số)": "Enter a valid Discord user ID (15–20 digits)",
  "Nhật ký sự cố chi tiết": "Detailed incident log",
  "Những ID người dùng này": "These user IDs",
  Nén: "Compressed",
  "Nếu chọn “tự động”, bot ưu tiên kênh log hành động mod, rồi tới kênh log chung (Cài đặt → Kênh log). Chưa có kênh log nào → không gửi được thông báo.":
    "With “automatic”, the bot prefers the mod-action log channel, then the shared log channel (Settings → Log channels). No log channel → notices can't be sent.",
  "Nội dung / mô tả": "Content / description",
  "Nội dung embed": "Embed content",
  "Nội dung kèm (template)": "Attached content (template)",
  "Nội dung tin nhắn": "Message content",
  "Nội dung tin nhắn (tùy chọn — gửi cùng embed)":
    "Message content (optional — sent with the embed)",
  "Nội dung tin nhắn Discord...": "Discord message content...",
  "Nội dung trả lời": "Reply content",

  // ── P–S ──
  "Phân quyền": "Permissions",
  "Phòng thủ 32 module": "32 defence modules",
  "Phương thức xác minh": "Verification method",
  "Ping @everyone khi cảnh báo khẩn": "Ping @everyone on urgent alerts",
  "Prefix lệnh": "Command prefix",
  "Prefix · kênh log · phân quyền · bảo mật · giao diện":
    "Prefix · log channels · permissions · security · appearance",
  "Preset bảo mật 1 chạm": "One-tap security preset",
  "Protogon không kết nối được với máy chủ dữ liệu (backend Convex đang trả lỗi). Trang web sẽ hoạt động lại ngay khi máy chủ khỏe — bạn có thể thử tải lại.":
    "Protogon can't reach the data server (the Convex backend is erroring). The site works again as soon as the server recovers — try reloading.",
  "Quyền quản lý server không đủ để mở khóa mục này.":
    "Manage Server permission is not enough to unlock this section.",
  "Quên mật khẩu? Vào Cài đặt để đặt lại (chỉ chủ sở hữu bot).":
    "Forgot the password? Reset it in Settings (bot owner only).",
  "Quản lý bot Discord của bạn từ một nơi": "Manage your Discord bot from one place",
  "Quản lý server": "Manage servers",
  "Raid Intel — săn nguồn cơn raid 🎯": "Raid Intel — hunt the raid's source 🎯",
  "Raid bằng ứng dụng ngoài": "External-app raid",
  "Role chưa xác minh (Unverified)": "Unverified role",
  "Role miễn trừ": "Exempt role",
  "Role đã xác minh (Verified)": "Verified role",
  "Role được miễn trừ": "Exempt roles",
  "Sao chép": "Copy",
  "Seed bí mật (dòng bất kỳ, ví dụ: chuỗi ngẫu nhiên)":
    "Secret seed (any line, e.g. a random string)",
  "Self-Diagnose — bot tự dò lỗi": "Self-Diagnose — the bot finds its own bugs",
  "Server của bạn": "Your server",
  "Server hiện tại": "Current server",
  "Server khác": "Other server",
  "Server quản lý": "Managed servers",
  "Soạn Embed": "Compose embed",
  "Săn lùng nguồn cơn raid": "Hunt the raid's source",
  "Sẵn sàng để Haimiya": "Ready for Haimiya",
  "Số người thắng": "Number of winners",
  "Số server đang dùng bot": "Servers using the bot",
  "Sử dụng tài khoản Discord để quản lý các server của bạn":
    "Use your Discord account to manage your servers",
  "Sửa bảng": "Edit panel",
  "Sự cố": "Incidents",
  "Sự cố / lỗi": "Incidents / errors",
  "Threat Intel — bot tự học": "Threat Intel — the bot learns",
  "Threat relay liên server": "Cross-server threat relay",
  "Thumbnail (ảnh nhỏ, tùy chọn)": "Thumbnail (small image, optional)",
  "Thành viên": "Members",
  "Thành viên sở hữu role này được bỏ qua toàn bộ kiểm tra moderation, anti-raid và anti-nuke của":
    "Members with this role skip all moderation, anti-raid and anti-nuke checks of",
  Thêm: "Add",
  "Thêm cặp emoji/role": "Add emoji/role pairs",
  "Thêm rule": "Add rule",
  "Thêm server": "Add server",
  "Thống kê nhiệt độ 🔥": "Heat statistics 🔥",
  "Thời gian": "Time",
  "Thời gian khóa (phút)": "Lock duration (minutes)",
  "Thời lượng": "Duration",
  "Thử lại": "Retry",
  "Timeout · kick · ban · warn · purge — ghi kèm":
    "Timeout · kick · ban · warn · purge — recorded with",
  "Tin nhắn trực tiếp từ Protogon": "Direct message from Protogon",
  "Tiêu đề embed": "Embed title",
  "Top 10 thành viên bị cảnh báo nhiệt độ vi phạm":
    "Top 10 members with the highest violation heat",
  "Trang trước": "Previous page",
  "Trung bình": "Average",
  "Trò chuyện với Haimiya": "Chat with Haimiya",
  "Trạng thái bot": "Bot status",
  "Trợ lý ảo của Protogon — giải đáp về bot, nhiệt độ, tính năng ẩn":
    "Protogon's assistant — answers about the bot, heat and hidden features",
  "Tuổi tối thiểu (ngày)": "Minimum age (days)",
  Tên: "Name",
  "Tên Discord…": "Discord name…",
  "Tên bảng": "Panel name",
  "Tên field": "Field name",
  "Tên giveaway": "Giveaway name",
  "Tên rule": "Rule name",
  "Tên tác giả": "Author name",
  "Tìm emoji hoặc chủ đề…": "Search emoji or topic…",
  "Tìm theo tên thủ phạm": "Search by offender name",
  "Tích hợp": "Integrations",
  "Tính năng ẩn — dành riêng admin sở hữu bot": "Hidden features — for the bot-owning admin only",
  "Tính năng ẩn 🔒": "Hidden features 🔒",
  "Tùy chỉnh": "Customisation",
  "Tùy chỉnh Webhook Log": "Customise log webhook",
  "Tùy chỉnh giao diện bot": "Customise the bot's appearance",
  "Tùy chỉnh giao diện chỉ dành cho": "Appearance customisation is available only to",
  "Tùy chỉnh khôi phục": "Restore options",
  "Tạm khóa (giây)": "Timeout (seconds)",
  "Tạo bot tại Discord Developer Portal": "Create a bot on the Discord Developer Portal",
  "Tạo bảng mới": "New panel",
  "Tạo giveaway": "Create giveaway",
  "Tạo giveaway mới": "Create a new giveaway",
  "Tạo lại role, quyền role và kênh của backup này trong server hiện tại":
    "Recreate this backup's roles, permissions and channels on the current server",
  "Tạo webhook": "Create webhook",
  "Tải lên & khôi phục": "Upload & restore",
  "Tải lại": "Reload",
  "Tải lại danh sách backup": "Reload backup list",
  "Tải lại danh sách server (server mới mời bot sẽ hiện ra)":
    "Reload the server list (newly invited servers appear)",
  "Tải lại trang": "Reload page",
  "Tải nguồn mở mỗi giờ (0 token) · AI ≤ 1 lần/tuần":
    "Fetches open sources hourly (0 tokens) · AI ≤ once a week",
  "Tất cả kênh": "All channels",
  "Tất cả module": "All modules",
  "Tổng lượt:": "Total runs:",
  "Tổng thành viên": "Total members",
  "Từ file": "From file",
  "Từ khóa (phân cách bằng dấu phẩy)": "Keywords (comma-separated)",
  "Từ khóa mới lượt trước:": "New keywords last run:",
  "Từ khóa trong tin nhắn": "Keywords in messages",
  "Từ ngày": "From date",
  "Tự ban nghi phạm nguồn cơn": "Auto-ban the source suspect",
  "Tự ban tài khoản đủ điểm nghi vấn (chủ mưu, trùng avatar…).":
    "Auto-bans accounts scoring high enough (mastermind, matching avatars…).",
  "Tự động backup định kỳ": "Automatic scheduled backups",
  "Tự động:": "Automatic:",
  "URL khi nhấn tên": "URL when the name is clicked",
  "VD: 1 tháng Nitro Boost 🚀": "e.g. 1 month of Nitro Boost 🚀",
  "VD: Bấm emoji bên dưới để nhận role tương ứng 🌸":
    "e.g. React below to get the matching role 🌸",
  "VD: Chào bạn, bạn đã thắng giải thưởng của server chúng mình 🎁":
    "e.g. Hi! You won our server's prize 🎁",
  "VD: Chào mừng đến với server! Tham gia ngay để có cơ hội nhận…":
    "e.g. Welcome to the server! Join now for a chance to win…",
  "VD: Chọn game của bạn 🎮": "e.g. Pick your game 🎮",
  "VD: Nitro 1 tháng": "e.g. 1 month of Nitro",
  "VD: Xin chúc mừng! Bạn là người may mắn nhất…": "e.g. Congratulations! You're the lucky winner…",
  "Vào dashboard": "Open dashboard",
  "Về trang chủ": "Back to home",
  "Vụ đã chặn": "Cases blocked",
  "Warn tích lũy (tăng cấp hình phạt)": "Accumulated warns (escalating punishment)",
  "Whitelist của server này": "This server's whitelist",
  "Xem lịch sử": "View history",
  "Xem trước": "Preview",
  "Xem trước DM chào mừng": "Preview the welcome DM",
  "Xác minh thành viên (Verify)": "Member verification (Verify)",
  "Xóa bảng": "Delete panel",
  "Xóa bộ lọc": "Clear filter",
  "Xóa cụm từ học sai": "Remove a mis-learned phrase",
  "Xóa mật khẩu": "Delete password",
  "Xóa tin phát hiện": "Delete the detected message",
  "Xóa toàn bộ nhiệt": "Clear all heat",
  "Xóa tìm kiếm": "Clear search",
  "Xóa từ khóa học sai": "Remove a mis-learned keyword",
  "Xóa ảnh": "Remove image",
  "Yêu cầu có avatar riêng": "Require a custom avatar",
  "Yêu cầu có huy hiệu tài khoản": "Require an account badge",
  "Yêu cầu khôi phục đã được xử lý": "Restore request processed",
  "Yêu cầu role để tham gia (tùy chọn)": "Required role to enter (optional)",
  "Yêu cầu đã được xử lý xong": "Request processed",
  "admin sở hữu bot": "the bot-owning admin",
  "bot gửi sau khi phạt — kể cả": "the bot posts after punishing — including",
  "bot gửi sau khi đã trừng phạt thành viên vi phạm — đồng bộ cả kênh lẫn mức chi tiết, theo từng hành động ban · timeout · warn · kick (cả tự động lẫn lệnh thủ công).":
    "the bot posts after punishing a violating member — both the channel and the detail level are configurable per action ban · timeout · warn · kick (automatic and manual commands).",
  "bảo vệ toàn diện": "all-round protection",
  "bật, tin nhắn chứa một trong các từ dưới đây sẽ bị xóa và xử lý tự động. Thêm từ bỏ trống để tắt lọc từ ngữ xấu.":
    "on, any message containing a word below is deleted and handled automatically. Add an empty word to disable the bad-word filter.",
  "chặn link độc hại & file nguy hiểm": "blocks malicious links & dangerous files",
  "chỉ dọn tin": "cleanup only",
  "chủ sở hữu bot": "the bot owner",
  "chứa file JSON cấu trúc server — bạn không cần tạo repo, không tốn bộ nhớ GitHub. Chỉ cần":
    "holds the server structure JSON — no repo to create, no GitHub storage used. Just",
  "cùng trợ lý Haimiya": "with the Haimiya assistant",
  "cả backup của Protogon": "including Protogon backups",
  "của họ. Nếu token chưa được cấu hình, phần GitHub bị bỏ qua và bot chỉ lưu trong Convex.":
    "of theirs. If no token is configured, the GitHub part is skipped and the bot stores in Convex only.",
  "của ứng dụng": "of the app",
  "duy nhất": "unique",
  "embed moderation kiểu Carl-bot": "Carl-bot style moderation embeds",
  "file backup của bot nuke": "a nuke bot's backup file",
  "giờ Việt Nam": "Vietnam time",
  "hello, xin chào, chào": "hello, hi, hey",
  "hoặc ID emoji.": "or an emoji ID.",
  "hoặc nhắc từ khóa — bot trả lời ngay. Hệ thống":
    "or mention a keyword — the bot replies instantly. The",
  "https://… (đường dẫn ảnh)": "https://… (image URL)",
  "hỗ trợ bạn quản lý server?": "help you manage your server?",
  "khi khởi động (xác minh token Discord thật) — không cần thao tác gì thêm.":
    "on startup (it verifies the real Discord token) — nothing else to do.",
  "không bị": "won't get",
  "không cho bot đọc": "does not let the bot read",
  "không cần tự dán token": "no need to paste a token",
  "không ảnh hưởng đến các server khác": "doesn't affect other servers",
  "kick hoặc ban": "kick or ban",
  kênh: "channel",
  "kênh xác minh": "verification channel",
  "kẻ chủ mưu": "the mastermind",
  "luôn được vào": "always allowed in",
  "lên mức nặng hơn — song song với hệ thống nhiệt độ.":
    "up to a harsher level — alongside the heat system.",
  "lấy tên thành viên.": "fetch the member's name.",
  "mỗi lần vi phạm — đầy thanh nhanh hơn.": "per violation — the bar fills faster.",
  một: "one",
  "mới 2 ngày": "only 2 days old",
  "mới được phép tương tác mật khẩu và đăng nhập vào tính năng ẩn — không phải owner hay mod của một server.":
    "may set the password and sign in to hidden features — not a server owner or mod.",
  "mức an toàn của server": "the server's safety level",
  "ngay lập tức.": "immediately.",
  ngày: "days",
  "người dùng app có đang raid không. AI học hỏi các dạng raid app ngoài (sockpuppet cài app, app giả mạo/tên scam, spam @everyone/link lừa đảo, webhook spam) để chặn cả biến thể tương tự: app nào được kết nối, ai đã bị xử lý.":
    "whether the app users are raiding. The AI learns external-app raid patterns (sockpuppets installing apps, impersonating/scam-named apps, @everyone/link spam, webhook spam) to block similar variants: which app connected, who was handled.",
  "nhiệt độ 4 giai đoạn": "4-stage heat",
  "như trong file, phục hồi": "as in the file, restoring",
  "nhận diện định dạng": "detect the format",
  "nếu file có lưu.": "if the file saved them.",
  "phá sập mà bạn giữ được file backup của nó (định dạng":
    "took it down and you kept its backup file (format",
  "role + kênh đúng thứ tự": "roles + channels in the right order",
  "role chưa xác minh": "the unverified role",
  "role đã xác minh": "the verified role",
  "rồi khôi phục lại từ backup.": "then restore from a backup.",
  "sau khi bạn": "after you",
  "server này": "this server",
  "server phụ": "the backup server",
  "set Kênh log": "set the log channel",
  "thất bại": "failed",
  "thủ công": "manual",
  "tin nhắn": "messages",
  "trong 30 phút. Warn tích lũy chạy song song: đủ 3 lần warn → tự tăng cấp.":
    "within 30 minutes. Accumulated warns run in parallel: 3 warns → automatic escalation.",
  "trong Cài đặt.": "in Settings.",
  "trong bot — bản cũ hơn tự bị xóa, GitHub giữ bản lưu vĩnh viễn.":
    "in the bot — older ones are deleted, GitHub keeps them forever.",
  "trong phiên này": "this session",
  "trước khi server sụp đổ": "before the server went down",
  "trạng thái email/điện thoại đã xác thực, nên Join Gate dùng các tín hiệu công khai (tuổi tài khoản, avatar, huy hiệu, trạng thái raid) để nhận diện selfbot.":
    "verified email/phone status, so Join Gate relies on public signals (account age, avatar, badge, raid state) to spot selfbots.",
  "tăng cấp": "escalates",
  "tại server này": "on this server",
  "tại thư mục gốc dự án để cập nhật backend (xem hướng dẫn trong README).":
    "at the project root to update the backend (see the README).",
  "tạm khóa": "timeout",
  "tạm khóa 40": "timeout 40",
  "tạo lại emoji/sticker": "recreate emoji/stickers",
  tắt: "off",
  "từ khóa": "keywords",
  "tự cấp phát chìa khóa an toàn": "issues a secure key itself",
  "tự tạo trong ~1 phút": "created automatically in ~1 minute",
  "tự động": "automatic",
  "và cấu hình cơ bản (prefix, từ ngữ xấu, role mod/admin, kênh log).":
    "and basic config (prefix, bad words, mod/admin roles, log channels).",
  "vượt ngưỡng bất kỳ module nào → bot chặn thành viên gửi tin trong toàn server, tự mở lại sau vài phút hoặc khi mod dùng":
    "exceeds any module's threshold → the bot blocks everyone from sending server-wide, reopening after a few minutes or when a mod uses",
  "với embed tùy chỉnh đến thành viên đã xác minh.": "with a custom embed to verified members.",
  "với nút / phản ứng để xác minh.": "with a button / reaction to verify.",
  "· chọn 1": "· choose 1",
  "· chọn nhiều, kết hợp được": "· multi-select, combinable",
  "· cập nhật 24/7": "· updated 24/7",
  "· đã gửi DM cảnh báo ⚠️": "· warning DM sent ⚠️",
  "Áp cấu hình tối ưu theo quy mô server. Whitelist của bạn được giữ nguyên.":
    "Applies an optimal config for your server size. Your whitelist is kept.",
  "Đang chọn:": "Selected:",
  "Đang chờ bot mở khóa…": "Waiting for the bot to unlock…",
  "Đang chờ bot xử lý file — bot quét mỗi ~20 giây, server lớn có thể mất 1-2 phút. Lỗi (nếu có) sẽ hiện ngay tại đây.":
    "Waiting for the bot to process the file — it polls every ~20s; large servers may take 1–2 minutes. Any error appears right here.",
  "Đang có nhiệt": "Has heat",
  "Đang khôi phục vào server này… server lớn kèm tin nhắn có thể mất vài phút. Kết quả sẽ hiện ở đây và trong kênh log.":
    "Restoring into this server… large servers with messages may take a few minutes. The result appears here and in the log channel.",
  "Đang kiểm tra phiên đăng nhập…": "Checking your session…",
  "Đang kết nối…": "Connecting…",
  "Đang lọc kết quả": "Filtering results",
  "Đang thu thập dữ liệu… (cần ít nhất 2 mẫu)": "Collecting data… (needs at least 2 samples)",
  "Đang tải lên…": "Uploading…",
  "Đang tải lịch sử…": "Loading history…",
  "Đang tải…": "Loading…",
  "Đang tắt — mọi module chỉ cảnh báo, không tăng cấp theo số lần warn.":
    "Off — every module only warns, with no escalation by warn count.",
  "Đang xác thực với Discord…": "Authenticating with Discord…",
  "Đang yêu cầu…": "Requesting…",
  "Điều hướng": "Navigation",
  "Điều hướng bảng điều khiển": "Dashboard navigation",
  "Đã cập nhật bảng — bot gửi bảng mới trong ~1 phút":
    "Panel updated — the bot posts it within ~1 minute",
  'Đã cập nhật rule "{p0}"': 'Updated rule "{p0}"',
  "Đã gửi yêu cầu — bot sẽ gửi DM trong vòng ~1 phút 💌":
    "Request sent — the bot DMs within ~1 minute 💌",
  "Đã hủy giveaway": "Giveaway cancelled",
  "Đã khóa kênh": "Channels locked",
  "Đã làm mới danh sách server": "Server list refreshed",
  "Đã lưu cài đặt Raid Intel — bot áp dụng trong ~3 phút":
    "Raid Intel settings saved — applied within ~3 minutes",
  "Đã lưu cài đặt hệ thống nhiệt độ": "Heat system settings saved",
  "Đã lưu cài đặt khóa kênh": "Channel lock settings saved",
  "Đã lưu cài đặt warn tích lũy": "Accumulated warn settings saved",
  "Đã lưu cài đặt — bot áp dụng trong vòng ~3 phút": "Settings saved — applied within ~3 minutes",
  "Đã lưu tùy chỉnh khôi phục": "Restore options saved",
  "Đã lưu webhook log": "Log webhook saved",
  "Đã lưu whitelist — bot áp dụng trong vòng ~3 phút":
    "Whitelist saved — applied within ~3 minutes",
  "Đã lưu ảnh mới — áp dụng toàn web": "New image saved — applied across the site",
  "Đã lưu — bot áp dụng trong vòng ~3 phút": "Saved — applied within ~3 minutes",
  "Đã mở khóa tính năng ẩn 🔓": "Hidden features unlocked 🔓",
  'Đã thêm "{p0}"': 'Added "{p0}"',
  "Đã thêm {p0} ID — bấm Lưu để áp dụng": "Added {p0} IDs — click Save to apply",
  "Đã tạo bảng — bot sẽ gửi tin nhắn trong vòng ~1 phút":
    "Panel created — the bot posts it within ~1 minute",
  "Đã tạo giveaway — bot sẽ gửi trong vòng ~1 phút 🎉":
    "Giveaway created — the bot posts it within ~1 minute 🎉",
  'Đã tạo rule "{p0}"': 'Created rule "{p0}"',
  'Đã tải "{p0}" lên — bot đang xử lý': 'Uploaded "{p0}" — the bot is processing',
  'Đã xóa "{p0}"': 'Deleted "{p0}"',
  "Đã xóa bảng (tin nhắn cũ trong Discord vẫn còn)":
    "Panel deleted (the old Discord message remains)",
  "Đã xóa mật khẩu tính năng ẩn": "Hidden features password deleted",
  "Đã xóa nhiệt của {p0}": "Cleared heat for {p0}",
  "Đã xóa toàn bộ nhiệt độ vi phạm": "Cleared all violation heat",
  "Đã xóa ảnh tùy chỉnh — trở về mặc định": "Custom image removed — back to default",
  "Đã yêu cầu khôi phục — bot thực hiện trong ~1 phút":
    "Restore requested — the bot runs it within ~1 minute",
  "Đã yêu cầu mở khóa — bot thực hiện trong vài giây":
    "Unlock requested — the bot does it in seconds",
  "Đã yêu cầu tạo backup — bot thực hiện trong ~20 giây":
    "Backup requested — the bot runs it within ~20 seconds",
  "Đã áp dụng sắc độ mới": "New shade applied",
  "Đã đặt mật khẩu": "Password set",
  "Đã đặt mật khẩu tính năng ẩn": "Hidden features password set",
  Đóng: "Close",
  "Đóng góp signature (khi bị raid)": "Contribute signatures (when raided)",
  "Đóng taskbar": "Close taskbar",
  "Đăng nhập": "Sign in",
  "Đăng nhập bằng Discord, mời Protogon vào server — bật nhiệt độ, Join Gate, lọc nội dung và 32 module chống nuke ngay trên dashboard, có trợ lý ảo Haimiya đồng hành. Miễn phí cho mọi server.":
    "Sign in with Discord, invite Protogon — turn on heat, Join Gate, content filtering and 32 anti-nuke modules right from the dashboard, with Haimiya alongside. Free for every server.",
  "Đăng nhập thất bại": "Sign-in failed",
  "Đăng nhập vào Protogon": "Sign in to Protogon",
  "Đăng xuất": "Sign out",
  "Đường dẫn bạn mở không tồn tại hoặc đã bị đổi. Kiểm tra lại liên kết, hoặc quay về một trong hai trang dưới đây.":
    "The link you opened doesn't exist or has changed. Check it again, or head back to one of the pages below.",
  "Đến ngày": "To date",
  "Đồng thời đẩy lên GitHub (Gist riêng tư)": "Also push to GitHub (private Gist)",
  "Đổi avatar bot & trợ lý AI ngay từ web — chỉ admin sở hữu bot được phép.":
    "Change the bot & AI assistant avatars right from the web — bot-owning admin only.",
  "Độ trễ hiện tại": "Current latency",
  "Độ trễ · tốc độ phản hồi · trạng thái server — không hiển thị tên server":
    "Latency · response speed · server status — server names are never shown",
  "Độ tương phản của server": "Server contrast",
  "đang bị khóa kênh": "is under channel lock",
  "đang chạy": "running",
  "đám mây GitHub": "the GitHub cloud",
  "đã tắt": "off",
  "đăng lại media": "re-upload media",
  "được đặt.": "is set.",
  "đặt trong tab": "set in the tab",
  "để bot tiếp tục chặn.": "so the bot keeps blocking.",
  "để chỉnh cấu hình.": "to configure it.",
  "để hiển thị server bạn quản lý. Chúng tôi không lưu mật khẩu hay tin nhắn của bạn.":
    "to show the servers you manage. We never store your password or messages.",
  "để lấy tên họ.": "to fetch their names.",
  "để xử lý. Muốn cho một người cụ thể luôn vào, thêm ID của họ vào danh sách trắng phía trên.":
    "to handle. To always let a specific person in, add their ID to the whitelist above.",
  "để đặt mật khẩu đầu tiên — người đó sẽ trở thành chủ sở hữu bot.":
    "to set the first password — that person becomes the bot owner.",
  "đủ bằng chứng độc lập": "enough independent evidence",
  "Ảnh nền embed (tùy chọn)": "Embed background image (optional)",
  "Ảnh tải lên được lưu trong bộ nhớ đám mây của bot — áp dụng ngay toàn web (trang chủ, đăng nhập, dashboard, chat AI).":
    "Uploaded images are stored in the bot's cloud memory — applied site-wide instantly (home, sign-in, dashboard, AI chat).",
  "Ảnh tối đa 2MB — vui lòng chọn ảnh nhỏ hơn":
    "Max image size is 2MB — please choose a smaller file",
  "Ứng dụng ngoài được kết nối": "External apps connected",
  "— Chọn kênh —": "— Choose channel —",
  "— Chọn role —": "— Choose role —",
  "— Dùng kênh log chung —": "— Use the shared log channel —",
  "— Không cấp role —": "— Grant no role —",
  "— Không dùng —": "— None —",
  "— Mọi thành viên —": "— Everyone —",
  "— Tự động dùng kênh log mod / log chung —": "— Automatically use mod log / shared log —",
  "— bot gửi mã qua DM, thành viên nhập mã trong kênh.":
    "— the bot DMs a code, the member enters it in the channel.",
  "— mọi server dùng chung, các owner server khác không phải cấu hình gì. Bot giữ tối đa 3 bản backup mới nhất cho mỗi server.":
    "— shared by all servers; other owners configure nothing. The bot keeps the latest 3 backups per server.",
  "— nếu bật tiêu chí trên, mọi thành viên mới sẽ bị xử lý ngay bây giờ.":
    "— if the criteria above are on, every new member is handled right now.",
  "— thành viên bấm nút để xác minh ngay lập tức.": "— members click a button to verify instantly.",
  "— tài khoản vi phạm bị cấm vĩnh viễn. Chọn Kick nếu bạn muốn nhẹ tay hơn.":
    "— offending accounts are permanently banned. Choose Kick for a lighter touch.",
  "— đóng trình duyệt sẽ phải đăng nhập lại": "— closing the browser means signing in again",
  "• Bot cần quyền": "• The bot needs the",
  "• Bot gửi": "• The bot posts",
  "• Bot gửi embed trong": "• The bot posts an embed in",
  "• Giờ hiển thị theo": "• Times shown in",
  "• Hỗ trợ: author (tên + avatar + link), title, description, color hex, fields (tên + giá trị + inline), image, thumbnail, footer + icon, timestamp.":
    "• Supports: author (name + avatar + link), title, description, colour hex, fields (name + value + inline), image, thumbnail, footer + icon, timestamp.",
  "• Không hiển thị tên server — chỉ hiện số lượng để bảo mật.":
    "• Server names are never shown — only counts, for privacy.",
  "• Mỗi server có độ tương phản riêng trong Cài đặt.":
    "• Each server has its own contrast setting in Settings.",
  "• Nuke/raid phạt trực tiếp, không cộng nhiệt.":
    "• Nuke/raid punishments are direct, no heat added.",
  "• Sau khi xác minh → gỡ role chưa xác minh, gán":
    "• After verification → remove the unverified role, grant",
  "• Thay đổi áp dụng trong ~3 phút.": "• Changes apply in ~3 minutes.",
  "• Thành viên mới vào server → tự động nhận": "• New members joining → automatically receive",
  "• Trang Cửa sổ Admin (chỉ chủ sở hữu bot) chia sẻ khung giờ cập nhật này và theo dõi lỗi chi tiết hơn.":
    "• The Admin window page (bot owner only) shares this update schedule and tracks errors in more detail.",
  "• Vào Discord → Kênh cần gửi →": "• In Discord → target channel →",
  "• Webhook mặc định (Protogon Log) ở trên chỉ dùng để nhận log hình phạt & anti nuke từ bot — không liên quan đến embed sender.":
    "• The default webhook above (Protogon Log) only receives punishment & anti-nuke logs from the bot — unrelated to the embed sender.",
  "• 🔒 Tính năng ẩn — khu vực riêng tư, chỉ chủ sở hữu bot mở khóa bằng mật khẩu.":
    "• 🔒 Hidden features — a private area only the bot owner unlocks with a password.",
  "• 🛠️ Lệnh mod: /mod timeout · kick · ban · purge + !timeout !kick !ban !purge — mọi hình phạt hiện trong mục Hình phạt.":
    "• 🛠️ Mod commands: /mod timeout · kick · ban · purge + !timeout !kick !ban !purge — every punishment appears in the Punishments section.",
  "…và 12 module chống nuke khác — xem đầy đủ trong dashboard.":
    "…and 12 more anti-nuke modules — see them all in the dashboard.",
  "ℹ️ Ghi chú": "ℹ️ Note",
  "← Về danh sách server": "← Back to server list",
  "← Về trang chủ": "← Back to home",
  "→ bot không gửi embed nhưng dashboard vẫn ghi nhận case. Embed xóa tin / purge luôn đầy đủ.":
    "→ the bot posts no embed but the dashboard still records the case. Delete/purge embeds are always complete.",
  "⏳ chờ bot gửi": "⏳ waiting for the bot",
  "⏸️ Tạm khóa (timeout)": "⏸️ Timeout",
  "☁️ Đám mây GitHub": "☁️ GitHub cloud",
  "⚠️ Bot không gửi được panel xác minh": "⚠️ The bot couldn't post the verification panel",
  "⚠️ Chống nuke đang tắt toàn bộ. Server của bạn không được bảo vệ khỏi raid.":
    "⚠️ Anti-nuke is fully off. Your server is unprotected against raids.",
  "⚠️ DM gần nhất thất bại": "⚠️ The last DM failed",
  "⚠️ Discord không cung cấp địa chỉ IP của thành viên cho bot, nên việc phát hiện VPN/Proxy trực tiếp là không khả thi với dữ liệu hiện tại. Hệ thống tập trung vào phát hiện alt account bằng bằng chứng hành vi (tuổi tài khoản, tên/avatar trùng, lịch sử bị phạt, join cluster) — đây là cách chặn account lạm dụng VPN hiệu quả nhất mà Discord cho phép.":
    "⚠️ Discord doesn't give the bot members' IP addresses, so direct VPN/Proxy detection isn't possible with the data available. The system focuses on detecting alt accounts through behavioural evidence (account age, matching names/avatars, punishment history, join clusters) — the most effective way to stop VPN-abusing accounts that Discord allows.",
  "⚠️ Join Gate đang tắt — mọi tài khoản đều được vào tự do (kể cả selfbot).":
    "⚠️ Join Gate is off — every account gets in freely (including selfbots).",
  "⚠️ Lượt học gần nhất thất bại": "⚠️ The last learning run failed",
  "⚠️ lỗi gửi": "⚠️ send error",
  "⚠️ Đang ở chế độ": "⚠️ Currently in",
  "⚡ Phạt trực tiếp theo hành động đã chọn — không cộng nhiệt.":
    "⚡ Direct punishment per the chosen action — no heat added.",
  "⚡ bot tự động": "⚡ automatic by the bot",
  "🌸 Chào mừng bạn!": "🌸 Welcome!",
  "🎖️ Role tự cấp cho người thắng (tùy chọn)": "🎖️ Role auto-granted to winners (optional)",
  "💌 DM người thắng": "💌 Winner DM",
  "💡 Hướng dẫn nhanh:": "💡 Quick guide:",
  "💡 Lệnh nhanh:": "💡 Quick commands:",
  "💡 Với mục": "💡 For the",
  "💡 Đây chính là embed": "💡 This is exactly the embed",
  "📌 Lưu ý quan trọng": "📌 Important note",
  "🔑 Captcha — nhập mã từ DM": "🔑 Captcha — enter the code from the DM",
  "🔒 Bạn không phải admin sở hữu bot — chỉ chủ sở hữu bot mới được đặt / đổi / xóa mật khẩu này.":
    "🔒 You are not the bot-owning admin — only the bot owner may set / change / delete this password.",
  "🔒 Khóa kênh khi raid:": "🔒 Channel lock during raids:",
  "🔒 Mã hóa": "🔒 Encrypted",
  "🔒 Quyền riêng tư": "🔒 Privacy",
  "🔒 Server của bạn": "🔒 Your server",
  "🔥 Bảng nhiệt độ & warn tích lũy của từng thành viên":
    "🔥 Each member's heat & accumulated warns",
  "🔥 Nhiệt/vi phạm": "🔥 Heat/violations",
  "🔥 Thành viên có nhiệt độ cao nhất": "🔥 Members with the highest heat",
  "🖐️ Học thủ công": "🖐️ Learn manually",
  "🖱️ Button — bấm nút xác minh": "🖱️ Button — click to verify",
  "🛠️ lệnh thủ công của mod": "🛠️ manual mod commands",
  "🛡️ Anti Nuke / Raid — phạt trực tiếp": "🛡️ Anti Nuke / Raid — direct punishment",
  "🛡️ Khi bị nuke/raid phá sập": "🛡️ When a nuke/raid takes it down",
  "🧹 Moderation nội dung — cộng nhiệt + warn": "🧹 Content moderation — heat + warns",

  /* ==== i18n-ai-health ==== Đợt 12: panel Sức khỏe AI trong cửa sổ Admin
     (chỉ owner). Chuỗi trạng thái + nhãn số liệu. */
  "Sức khỏe AI": "AI health",
  "Bot tổng hợp mỗi phút · chỉ chủ bot nhìn thấy":
    "Bot reports every minute · visible to the bot owner only",
  "Hoạt động": "Operational",
  "Không khả dụng": "Unavailable",
  "Bot đang offline hoặc mất kết nối Convex — số liệu AI tạm dừng cập nhật.":
    "Bot is offline or disconnected from Convex — AI metrics paused.",
  "Provider:": "Providers:",
  nghỉ: "resting",
  "Gọi AI/phút:": "AI calls/min:",
  "Verdict 1 giờ:": "Verdicts 1h:",
  "từ cache": "from cache",
  "Phạt nhầm 7 ngày:": "Wrongful punishments 7d:",
  raid: "raid",
  "cá biệt": "individual",
  "lành tính": "benign",
  offline: "offline",
  "Đang nghỉ tạm:": "Currently cooling down:",
  "≥5 phạt nhầm đã xác nhận — AI đang tự siết độ tin cậy (bias giảm nhẹ + nhắc thận trọng trong prompt).":
    "≥5 confirmed wrongful punishments — the AI is self-tightening its confidence (slight bias cut + caution reminder in the prompt).",
  "Khi bot xác nhận raid/nuke: DM khẩn cho chủ server (kẻ nuke không xoá được) + AI quét chat gửi báo cáo vào kênh log, kèm lệnh":
    "When a raid/nuke is confirmed: urgent DM to the server owner (raiders can't delete it) + AI chat scan report to the log channel, with the",
  ". Người có quyền phá server cũng được báo ngay":
    ". Privileged members attacking the server are reported too",
};
