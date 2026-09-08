export interface HaimiyaAnswer {
  text: string;
  suggestions: string[];
}

interface Topic {
  id: string;
  keywords: string[];
  answer: string;
  suggestions: string[];
}

/** Chuẩn hóa: bỏ dấu + lowercase để khớp từ khóa dễ dàng. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

const TOPICS: Topic[] = [
  {
    id: "hidden",
    keywords: [
      "tinh nang an",
      "mat khau",
      "mo khoa",
      "unlock",
      "khoa lai",
      "hidden",
      "quyen an",
      "cho admin",
      "danh rieng admin",
      "chu so huu bot",
      "so huu bot",
      "chu bot",
    ],
    answer:
      "Tính năng ẩn là khu vực dành riêng cho chủ sở hữu bot 🔒: Reaction Role, Giveaway, Gửi DM trực tiếp, Auto Reply và Tùy chỉnh giao diện (đổi avatar bot & Haimiya). Chỉ admin sở hữu bot mới được phép đặt mật khẩu và đăng nhập vào khu vực này — owner hay mod của một server có quyền quản lý cũng không đủ. Cách mở khóa: chủ bot đăng nhập bằng chính tài khoản Discord đã tạo bot → đặt mật khẩu trong Cài đặt → vào sidebar chọn Tính năng ẩn → nhập mật khẩu là xong.",
    suggestions: [
      "Reaction role hoạt động thế nào?",
      "Giveaway có những tùy chọn gì?",
      "Đổi avatar bot ở đâu?",
    ],
  },
  {
    id: "reactionrole",
    keywords: ["reaction role", "reaction", "emoji", "nhan role", "go role", "tu nhan role"],
    answer:
      "Reaction Role giúp thành viên tự chọn role chỉ bằng một cú bấm emoji 🎭. Trong Tính năng ẩn, bạn tạo bảng: chọn kênh, đặt tên, rồi thêm từng cặp emoji → role. Bot gửi tin nhắn kèm các emoji vào kênh — ai bấm emoji nào sẽ được gán role đó, bấm lại lần nữa là gỡ role. Ngoài dashboard, bạn dùng được cả lệnh /reactionrole create · add · remove · edit · delete (kèm !reactionrole) ngay trong Discord. Mỗi server tạo được tối đa 10 bảng, mỗi bảng tối đa 20 cặp emoji/role.",
    suggestions: [
      "Giveaway có những tùy chọn gì?",
      "Tính năng ẩn gồm những gì?",
      "Cách đặt mật khẩu tính năng ẩn",
    ],
  },
  {
    id: "giveaway",
    keywords: [
      "giveaway",
      "quay so",
      "trung thuong",
      "giai thuong",
      "nguoi thang",
      "dm giveaway",
      "cap role",
      "role thuong",
      "mau tin nhan",
      "chen anh",
      "loi dan",
    ],
    answer:
      "Giveaway của Protogon chạy hoàn toàn tự động 🎉. Bạn tạo qua dashboard, /giveaway start hoặc !giveaway start. Có 4 mẫu tin nhắn (Mặc định, Sang trọng, VIP, Nhanh gọn), lời dẫn tùy chỉnh, chèn ảnh nền embed, số người thắng (1–20) và thời lượng (5 phút → 7 ngày). Hỗ trợ Yêu cầu role để giới hạn người tham gia, và Role thưởng: hết giờ bot tự chọn người thắng ngẫu nhiên, cấp role thưởng cho họ, thông báo trong kênh và gửi DM kèm lời chúc mừng nếu bật. Tối đa 5 giveaway chạy song song.",
    suggestions: [
      "Có lệnh giveaway trong Discord không?",
      "Đổi avatar bot ở đâu?",
      "Công cụ mod gồm những gì?",
    ],
  },
  {
    id: "dm",
    keywords: ["gui dm", "dm truc tiep", "nhan tin rieng", "gui tin nhan rieng", "dm cho", "gui cho"],
    answer:
      "Tính năng gửi DM trực tiếp cho phép admin nhắn riêng bất kỳ người dùng nào qua bot 💌. Trong Tính năng ẩn, bạn nhập ID người dùng (bật Developer Mode trong Discord, chuột phải người dùng → Copy User ID), viết nội dung rồi bấm Gửi — bot sẽ nhắn riêng cho họ trong vòng ~1 phút. Lưu ý: nếu người đó đã chặn tin nhắn từ bot thì việc gửi sẽ không thành công.",
    suggestions: [
      "Giveaway có những tùy chọn gì?",
      "Cách đặt mật khẩu tính năng ẩn",
      "Tính năng ẩn gồm những gì?",
    ],
  },
  {
    id: "branding",
    keywords: [
      "doi avatar",
      "avatar bot",
      "avatar haimiya",
      "anh dai dien",
      "tuy chinh giao dien",
      "logo bot",
      "thay anh",
      "doi anh",
      "avatar",
    ],
    answer:
      "Bạn có thể đổi avatar bot và avatar của tôi ngay trên web 🎨. Vào Tính năng ẩn → mục Tùy chỉnh giao diện: tải ảnh lên (tối đa 2MB) hoặc dán đường dẫn ảnh cho từng mục — Avatar bot (Protogon, hiển thị làm logo toàn web) và Avatar trợ lý AI (Haimiya, hiển thị trong cửa sổ chat). Thay đổi áp dụng ngay toàn bộ trang chủ, đăng nhập và dashboard. Lưu ý: chỉ admin sở hữu bot mới được đổi.",
    suggestions: [
      "Tính năng ẩn gồm những gì?",
      "Chủ đề màu server là gì?",
      "Giveaway có những tùy chọn gì?",
    ],
  },
  {
    id: "theme",
    keywords: [
      "chu de mau",
      "mau sac",
      "theme",
      "doi mau",
      "mau chu de",
      "mau rieng",
      "mau server",
      "mau web",
    ],
    answer:
      "Mỗi server có thể chọn chủ đề màu riêng cho trang quản lý 🎨. Vào Cài đặt → mục Chủ đề màu của server: chọn 1 trong 8 màu (Hồng anh đào, Hồng đỏ, Cam hoàng hôn, Vàng hổ phách, Xanh lá, Xanh ngọc, Xanh trời, Tím oải hương) rồi bấm Áp dụng. Màu sẽ áp dụng ngay cho nút bấm, thẻ và sidebar của riêng server đó trên web.",
    suggestions: [
      "Đổi avatar bot ở đâu?",
      "Bảng hình phạt là gì?",
      "Công cụ mod gồm những gì?",
    ],
  },
  {
    id: "punishments",
    keywords: [
      "bang hinh phat",
      "hinh phat",
      "lich su phat",
      "mod action",
      "ai da kick",
      "ai da ban",
      "ai da timeout",
      "punish",
    ],
    answer:
      "Bảng hình phạt nằm trong mục Hình phạt trên sidebar trang quản lý server 🛠️. Nó liệt kê đầy đủ các hình phạt gần nhất: timeout, kick, ban, purge — kèm thời gian, thành viên bị phạt, người thực hiện (mod) và lý do. Các hình phạt tự động từ hệ thống chống nuke/nhiệt độ cũng được ghi vào bảng này với nhãn Tự động. Bot ghi nhận khi bạn dùng /mod hoặc !timeout !kick !ban !purge.",
    suggestions: [
      "Công cụ mod gồm những gì?",
      "Chủ đề màu server là gì?",
      "Hệ thống nhiệt độ hoạt động thế nào?",
    ],
  },
  {
    id: "modtools",
    keywords: [
      "cong cu mod",
      "mod tools",
      "timeout",
      "purge",
      "kick",
      "ban",
      "ta khoa",
      "xoa tin nhan",
      "/mod",
      "cam thanh vien",
    ],
    answer:
      "Công cụ Mod giúp xử lý thành viên nhanh chóng và có ghi chép đầy đủ 🛠️: /mod timeout @user 10m [lý do], /mod kick @user [lý do], /mod ban @user [lý do] (kèm --days để xóa tin nhắn) và /mod purge <số tin>. Lệnh text tương đương: !timeout, !kick, !ban, !purge. Mọi hành động đều được ghi vào kênh log và bảng hình phạt trên dashboard với lý do + người thực hiện. Cần quyền Quản lý server hoặc role Mod/Admin được cấu hình.",
    suggestions: [
      "Bảng hình phạt là gì?",
      "Giveaway có những tùy chọn gì?",
      "Tính năng ẩn gồm những gì?",
    ],
  },
  {
    id: "remember",
    keywords: ["luu dang nhap", "khong luu dang nhap", "nho dang nhap", "dang nhap lai", "nho mat khau"],
    answer:
      "Trang đăng nhập có tùy chọn lưu đăng nhập 🪪. Tích Lưu đăng nhập → phiên đăng nhập được giữ lại trên thiết bị, mở lại trình duyệt không cần đăng nhập lại. Chọn Không lưu đăng nhập → token chỉ sống trong tab hiện tại, đóng trình duyệt là phải đăng nhập lại — an toàn hơn khi dùng máy công cộng.",
    suggestions: [
      "Tính năng ẩn gồm những gì?",
      "Cách đặt mật khẩu tính năng ẩn",
      "Cách chạy bot trên hosting",
    ],
  },
  {
    id: "intro",
    keywords: [
      "ban la ai",
      "ban la",
      "haimiya",
      "gioi thieu",
      "ai la",
      "tro ly",
      "tro chuyen",
      "chao",
      "hello",
      "hi ",
    ],
    answer:
      "Tôi là Haimiya, trợ lý ảo của Protogon — bot Discord bảo vệ server. Tôi có thể giải đáp về hệ thống nhiệt độ, Join Gate, chống nuke/raid, auto reply, tính năng ẩn, giveaway, công cụ mod… Bạn cứ hỏi, tôi sẽ trả lời rõ ràng.",
    suggestions: [
      "Hệ thống nhiệt độ hoạt động thế nào?",
      "Join Gate là gì?",
      "Tính năng ẩn gồm những gì?",
    ],
  },
  {
    id: "heat",
    keywords: [
      "nhiet do",
      "heat",
      "diem nhiet",
      "cong nhiet",
      "hạ nhiệt",
      "ha nhiet",
      "giai doan",
      "nong",
    ],
    answer:
      "Hệ thống nhiệt độ hoạt động theo thang điểm 0–100 🌡️. Mỗi vi phạm cộng điểm nhiệt theo cài đặt; ngưỡng mặc định: cảnh báo 25, tạm khóa 40, kick 70, ban 90. Khi chạm ngưỡng, bot tự xử lý (cảnh báo DM → tạm khóa → kick → ban). Nhiệt giảm dần theo phút (mặc định 3 điểm/phút) và nếu tái phạm trong cửa sổ (mặc định 30 phút) sẽ bị nhân nhiệt (mặc định x2). Tất cả ngưỡng đều chỉnh được trong Moderation.",
    suggestions: [
      "Warn tích lũy là gì?",
      "Bảng hình phạt là gì?",
      "Cách xem nhiệt của thành viên",
    ],
  },
  {
    id: "warn",
    keywords: ["warn", "canh bao", "tich luy", "strike", "warn tich luy", "canh bao tich luy"],
    answer:
      "Warn tích lũy giúp phát hiện người tái phạm liên tục ⚠️. Mỗi lần vi phạm bị xử lý Cảnh báo sẽ được đếm; đủ N lần (mặc định 3) trong cửa sổ (mặc định 60 phút) thì tự tăng cấp hình phạt (tạm khóa / kick / ban — bạn chọn được). Số warn hiển thị dạng X/N ngay trong bảng nhiệt trên dashboard và báo cáo hàng ngày.",
    suggestions: [
      "Hệ thống nhiệt độ hoạt động thế nào?",
      "Bảng hình phạt là gì?",
      "Báo cáo hàng ngày là gì?",
    ],
  },
  {
    id: "joingate",
    keywords: ["join gate", "cong vao", "selfbot", "vào server", "vo server", "tai khoan moi", "check avatar"],
    answer:
      "Join Gate là cổng kiểm soát thành viên khi vào server 🚪. Bạn bật từng tùy chọn trong mục Join Gate: chặn tài khoản quá mới (số ngày tùy chỉnh), bắt buộc có avatar, bắt buộc có huy hiệu, và chặn toàn bộ lượt vào khi server đang bị raid. Có danh sách trắng để miễn trừ, và chọn hình phạt Kick hoặc Ban cho các trường hợp bị chặn.",
    suggestions: [
      "Chống nuke/raid là gì?",
      "Hệ thống nhiệt độ hoạt động thế nào?",
      "Join Gate chống được gì?",
    ],
  },
  {
    id: "malware",
    keywords: [
      "link doc hai",
      "file nguy hiem",
      "malware",
      "lua dao",
      "nitro gia",
      "domain xau",
      "exe",
      "virus",
      "link ip",
    ],
    answer:
      "Module chống link độc hại & file nguy hiểm bảo vệ thành viên khỏi lừa đảo 🛡️. Bot phát hiện và xóa tin chứa: domain lừa đảo phổ biến (nitro giả, gift giả, crypto scam…), link IP trực tiếp, chữ ký nội dung scam, và file đuôi nguy hiểm (.exe .scr .bat .msi .vbs .ps1 .jar .apk .hta…). Mỗi lần phát hiện đều cảnh báo trong kênh log kèm tên file hoặc link.",
    suggestions: [
      "Chống nuke/raid là gì?",
      "Moderation lọc những gì?",
      "Bảng hình phạt là gì?",
    ],
  },
  {
    id: "moderation",
    keywords: [
      "moderation",
      "spam",
      "bad word",
      "tu ngu xau",
      "mention spam",
      "anh spam",
      "file spam",
      "link moi",
      "filter",
    ],
    answer:
      "Mục Moderation tập trung lọc nội dung tin nhắn ✂️: chống spam tin nhắn, chống spam mention, lọc từ ngữ xấu (danh sách tùy chỉnh), chống spam ảnh/file đính kèm, chặn link mời Discord (discord.gg, discord.com/invite) và chống link độc hại/file nguy hiểm. Mỗi module bật/tắt riêng, chỉnh ngưỡng, hình phạt và mức nhiệt cộng cho từng vi phạm.",
    suggestions: [
      "Hệ thống nhiệt độ hoạt động thế nào?",
      "Chống nuke/raid là gì?",
      "Chủ đề màu server là gì?",
    ],
  },
  {
    id: "antinuke",
    keywords: [
      "chong nuke",
      "anti nuke",
      "raid",
      "nuke",
      "ban hang loat",
      "kick hang loat",
      "xoa kenh",
      "tao role",
      "lockdown",
      "khoa kenh",
    ],
    answer:
      "Chống nuke/raid bảo vệ cấu trúc server 🛡️ với 10 module nuke: ban hàng loạt, kick hàng loạt, raid thành viên, tạo kênh hàng loạt, xóa kênh hàng loạt, tạo role hàng loạt, xóa role hàng loạt, xóa tin hàng loạt, tạo webhook hàng loạt, tạo thread hàng loạt. Các module này phạt trực tiếp (warn/kick/ban/timeout), không cộng nhiệt. Bot có AI Guard 🧠 tự phân biệt đâu là raid/nuke thật sự (leo thang ban + khóa kênh) với vi phạm cá nhân (chỉ cộng nhiệt, moderation bình thường) — nhận diện cả spam tin dài cực dài, tin lặp nội dung và tin giả blank (toàn khoảng trắng/ký tự ẩn) gây nhiễu. Khi bị tấn công, bot tự khóa kênh (lockdown) và mở khóa bằng /antinuke unlock.",
    suggestions: [
      "Join Gate là gì?",
      "Moderation lọc những gì?",
      "Bảng hình phạt là gì?",
    ],
  },
  {
    id: "autoreply",
    keywords: ["auto reply", "tu tra loi", "tu dong tra loi", "keyword", "mention bot", "rule"],
    answer:
      "Auto Reply tự động trả lời tin nhắn theo rule 💬. Mỗi rule gồm: tên, loại kích hoạt (từ khóa xuất hiện trong tin hoặc khi thành viên tag bot), nội dung trả lời (hỗ trợ {user} và {username}), giới hạn kênh và cooldown chống spam. Quản lý rule trong Tính năng ẩn → Auto Reply, hoặc lệnh !autoreply add/list/remove.",
    suggestions: [
      "Tính năng ẩn gồm những gì?",
      "Bot có những lệnh nào?",
      "Hệ thống nhiệt độ hoạt động thế nào?",
    ],
  },
  {
    id: "report",
    keywords: ["bao cao", "daily report", "bao cao hang ngay", "tong ket", "bao cao chong nuke"],
    answer:
      "Báo cáo hàng ngày là bản tóm tắt gửi vào kênh log mỗi ngày 📊: tổng số sự kiện, chi tiết theo module, thủ phạm thường xuyên, trạng thái khóa kênh, cùng danh sách nhiệt độ và warn tích lũy của từng thành viên. Bật/tắt trong Cài đặt → Báo cáo chống nuke hàng ngày, nhớ đặt kênh log.",
    suggestions: [
      "Hệ thống nhiệt độ hoạt động thế nào?",
      "Bảng hình phạt là gì?",
      "Cách đặt kênh log",
    ],
  },
  {
    id: "dashboard",
    keywords: ["dashboard", "bang dieu khien", "trang quan ly", "web", "website", "giao dien web"],
    answer:
      "Dashboard là trang quản lý bot trên web 🖥️. Bạn đăng nhập bằng Discord, chọn server, rồi quản lý mọi thứ: Moderation (nhiệt độ, warn, lọc nội dung), Join Gate, Chống nuke/raid, Hình phạt, Tính năng ẩn và Cài đặt (prefix, kênh log, chủ đề màu). Thay đổi được bot áp dụng trong khoảng 3 phút.",
    suggestions: [
      "Cách đăng nhập dashboard",
      "Chủ đề màu server là gì?",
      "Bảng hình phạt là gì?",
    ],
  },
  {
    id: "commands",
    keywords: [
      "lenh",
      "command",
      "prefix",
      "slash",
      "/heat",
      "/antinuke",
      "/prefix",
      "dung lenh",
      "commands",
      "lệnh",
    ],
    answer:
      "Bot hỗ trợ cả prefix và slash command ⌨️. Công cụ Mod: /mod timeout, /mod kick, /mod ban, /mod purge — lệnh text tương đương !timeout !kick !ban !purge. Giveaway: /giveaway start <tên> <giải> <thời lượng> hoặc !giveaway start. Reaction role: /reactionrole create · add · remove · edit · delete (kèm !reactionrole). Ngoài ra: /heat status xem nhiệt & warn, /antinuke bật tắt bảo vệ, /prefix đổi prefix, /badword quản lý từ ngữ xấu. Gõ / trong Discord để xem toàn bộ danh sách slash command.",
    suggestions: [
      "Cách xem nhiệt của thành viên",
      "Công cụ mod gồm những gì?",
      "Giveaway có những tùy chọn gì?",
    ],
  },
  {
    id: "hosting",
    keywords: ["hosting", "wispbyte", "bot hosting", "chay bot", "host", "zip", "deploy", "24/7"],
    answer:
      "Để bot chạy 24/7, bạn cần một hosting bot (ví dụ Wispbyte) 🚀. Quy trình: tải file zip bot từ nhánh host-deploy trên GitHub → vào hosting, xóa file cũ → upload zip mới → Unarchive → Restart. Mỗi lần có bản cập nhật, lặp lại đúng quy trình đó. Nhớ cấu hình đủ token Discord và khóa Convex trong file cấu hình.",
    suggestions: [
      "Cách đăng nhập dashboard",
      "Bot có những lệnh nào?",
      "Báo cáo hàng ngày là gì?",
    ],
  },
  {
    id: "pricing",
    keywords: [
      "gia",
      "gias",
      "gía",
      "free",
      "mien phi",
      "tra phi",
      "pro",
      "premium",
      "bao nhieu tien",
      "tien",
      "phí",
    ],
    answer:
      "Protogon miễn phí cho mọi server 💰. Toàn bộ tính năng — auto reply, nhiệt độ 4 giai đoạn, warn tích lũy, Join Gate, chống nuke/raid, chặn link độc hại, giveaway, reaction role, công cụ mod, bảng hình phạt, báo cáo hàng ngày — đều dùng được không giới hạn. Bạn chỉ cần host bot và dùng dashboard, không mất phí.",
    suggestions: [
      "Cách chạy bot trên hosting",
      "Tính năng ẩn gồm những gì?",
      "Hệ thống nhiệt độ hoạt động thế nào?",
    ],
  },
  {
    id: "login",
    keywords: [
      "dang nhap",
      "login",
      "dang ky",
      "discord",
      "oauth",
      "tai khoan",
      "dang xuat",
      "vào dashboard",
      "vo dashboard",
    ],
    answer:
      "Đăng nhập rất nhanh 🪪. Bấm nút Đăng nhập với Discord ở góc phải trên cùng (hoặc nút Mở dashboard), Discord xác nhận quyền, xong là vào thẳng dashboard. Trang đăng nhập có tùy chọn Lưu đăng nhập / Không lưu đăng nhập. Chỉ server nào bạn có quyền quản lý mới hiện ra — nếu chưa thấy server, hãy mời bot vào server đó trước.",
    suggestions: [
      "Cách chạy bot trên hosting",
      "Lưu đăng nhập là gì?",
      "Bot có những lệnh nào?",
    ],
  },
];

export const GREETING =
  "Xin chào! Tôi là Haimiya, trợ lý ảo của Protogon — bot Discord bảo vệ server. Tôi có thể giúp bạn giải đáp về hệ thống nhiệt độ, Join Gate, chống nuke/raid, tính năng ẩn, giveaway, công cụ mod và nhiều hơn nữa. Bạn muốn hỏi điều gì?";

export const QUICK_QUESTIONS = [
  "Hệ thống nhiệt độ hoạt động thế nào?",
  "Join Gate là gì?",
  "Tính năng ẩn gồm những gì?",
  "Cách chạy bot trên hosting",
];

const FALLBACK: HaimiyaAnswer = {
  text: "Mình rất muốn trò chuyện về điều đó! Hiện tại AI thật chưa kết nối được nên mình chỉ trả lời được các câu hỏi về Protogon trong kiến thức sẵn có. Bạn thử hỏi về: nhiệt độ, join gate, warn, giveaway, hosting, tính năng ẩn, bảng hình phạt… Hoặc chọn một câu hỏi gợi ý bên dưới nhé.",
  suggestions: [
    "Hệ thống nhiệt độ hoạt động thế nào?",
    "Join Gate là gì?",
    "Cách chạy bot trên hosting",
  ],
};

export function askHaimiya(input: string): HaimiyaAnswer {
  const q = normalize(input.trim());
  if (!q) return FALLBACK;

  let best: Topic | null = null;
  let bestScore = 0;
  for (const topic of TOPICS) {
    let score = 0;
    for (const kw of topic.keywords) {
      const nk = normalize(kw);
      if (nk.length >= 2 && q.includes(nk)) score += nk.length >= 4 ? 2 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = topic;
    }
  }

  if (!best) return FALLBACK;
  return { text: best.answer, suggestions: best.suggestions };
}
