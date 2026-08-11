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
    .replace(/[\u0300-\u036f]/g, "");
}

const TOPICS: Topic[] = [
  {
    id: "intro",
    keywords: [
      "ban la ai",
      "ban la",
      "haimiya",
      "gioi thieu",
      "ai la",
      "mau",
      "tro ly",
      "tro chuyen",
      "chao",
      "hello",
      "hi ",
    ],
    answer:
      "Em là Haimiya-senpai 🌸 — trợ lý ảo của Protogon! Em hơi nhát nhưng luôn muốn chăm sóc senpai thật tốt. Senpai cứ hỏi em về bot: hệ thống nhiệt độ, Join Gate, chống nuke/raid, auto reply, warn tích lũy… Em biết hết đó!",
    suggestions: [
      "Hệ thống nhiệt độ hoạt động thế nào?",
      "Join Gate là gì?",
      "Bot có những lệnh nào?",
    ],
  },
  {
    id: "heat",
    keywords: [
      "nhiet",
      "heat",
      "han nhiet",
      "ha nhiet",
      "giam nhiet",
      "tai pham",
      "x2",
      "nhan doi",
      "cam bao",
      "canh bao nhiet",
      "nhiet do",
      "thanh nhiet",
      "muc do",
    ],
    answer:
      "Hệ thống nhiệt độ của em hoạt động như thang nhiệt đó senpai 🔥: mỗi vi phạm (spam, từ xấu, link độc hại…) cộng điểm nhiệt theo cài đặt của từng module. Đủ mốc 25 → em DM cảnh báo, 40 → tạm khóa, 70 → kick, 90 → ban. Nhiệt tự hạ dần theo phút (cài được), và nếu senpai vừa bị phạt mà tái phạm trong cửa sổ (mặc định 30 phút) thì nhiệt sẽ tăng nhanh gấp ×2 (cài 1–10 lần). Cảnh báo qua DM và reset nhiệt từng người / toàn bộ đều làm được trên dashboard nha!",
    suggestions: [
      "Warn tích lũy là gì?",
      "Cách xem nhiệt của thành viên",
      "Hạ nhiệt nhanh như thế nào?",
    ],
  },
  {
    id: "warn",
    keywords: [
      "warn",
      "strike",
      "tich luy",
      "canh bao tich luy",
      "so lan canh bao",
      "tang cap",
      "warn bao nhieu",
    ],
    answer:
      "Warn tích lũy chạy song song với nhiệt độ đó senpai ⚠️: khi hình phạt là \"Cảnh báo\", em đếm số lần warn của thành viên trong cửa sổ (mặc định 60 phút). Đủ số warn cài trước (mặc định 3) → tự động tăng cấp thành hình phạt nặng hơn (tạm khóa / kick / ban — senpai chọn được). Trên web, bảng Moderation hiển thị huy hiệu \"warn 2/3\" cạnh từng thành viên, và báo cáo hàng ngày cũng liệt kê đầy đủ!",
    suggestions: [
      "Hệ thống nhiệt độ hoạt động thế nào?",
      "Bảng nhiệt trên web ở đâu?",
      "Báo cáo hàng ngày là gì?",
    ],
  },
  {
    id: "joingate",
    keywords: [
      "join gate",
      "cong vao",
      "cua vao",
      "selfbot",
      "tai khoan moi",
      "avatar",
      "huy hieu",
      "flag",
      "thanh vien moi",
      "chong selfbot",
      "danh sach trang",
      "whitelist",
    ],
    answer:
      "Join Gate là cổng vào server chống selfbot đó senpai 🚪! Khi có người mới vào, em quét ngay các tiêu chí senpai tick trên dashboard: chặn tài khoản quá mới (số ngày tuổi tối thiểu), chặn tài khoản dùng avatar mặc định, chặn tài khoản không có huy hiệu công khai, và chặn mọi lượt vào khi server đang bị raid. Hình phạt chọn Kick nhẹ hoặc Ban mạnh, kèm danh sách trắng để luôn cho một số ID vào. Lưu ý nhỏ: Discord không cho bot đọc email/điện thoại đã xác thực nên em dùng các tín hiệu công khai trên — rất hiệu quả với selfbot!",
    suggestions: [
      "Chống link độc hại hoạt động thế nào?",
      "Cách bật Join Gate",
      "Chống nuke/raid là gì?",
    ],
  },
  {
    id: "malware",
    keywords: [
      "malware",
      "virus",
      "link doc hai",
      "doc hai",
      "lua dao",
      "scam",
      "file nguy hiem",
      "file nguy",
      "dang nhap",
      "duoi file",
      "exe",
      "nitro gia",
      "gift gia",
      "crypto",
    ],
    answer:
      "Em canh link độc hại & file nguy hiểm rất kỹ đó senpai 🛡️! Module \"Chống link độc hại & file nguy hiểm\" chặn ~50 domain lừa đảo phổ biến (nitro giả, gift giả, crypto scam…), link dạng IP trực tiếp, và chữ ký nội dung scam như \"free nitro\", \"giveaway\". Đồng thời quét file đính kèm: đuôi nguy hiểm như .exe, .scr, .bat, .cmd, .msi, .vbs, .ps1, .jar, .apk, .hta… bị phát hiện là xóa tin ngay + cảnh báo kèm tên file vào kênh log. Bật/tắt và chỉnh nhiệt từng lần vi phạm trong mục Moderation nha!",
    suggestions: [
      "Moderation gồm những gì?",
      "Hệ thống nhiệt độ hoạt động thế nào?",
      "Cách đặt kênh log",
    ],
  },
  {
    id: "moderation",
    keywords: [
      "moderation",
      "spam",
      "badword",
      "tu xau",
      "tu ngu xau",
      "mention",
      "tag",
      "anh",
      "file dinh kem",
      "dinh kem",
      "invite",
      "link moi",
      "loc noi dung",
      "lọc nội dung",
      "anti spam",
    ],
    answer:
      "Mục Moderation của em gồm 6 module lọc nội dung senpai 🧹: chống spam tin nhắn, chống spam mention (tag người/role/kênh liên tục), lọc từ ngữ xấu (danh sách từ senpai tự thêm trong Cài đặt), chống spam ảnh & file đính kèm, chặn link mời Discord (discord.gg), và chống link độc hại & file nguy hiểm. Mỗi module có ngưỡng, cửa sổ thời gian, hình phạt và điểm nhiệt riêng — bật/tắt từng cái trên web nha!",
    suggestions: [
      "Warn tích lũy là gì?",
      "Chống link độc hại hoạt động thế nào?",
      "Thêm từ xấu ở đâu?",
    ],
  },
  {
    id: "antinuke",
    keywords: [
      "nuke",
      "raid",
      "anti nuke",
      "chong nuke",
      "chong raid",
      "ban hang loat",
      "kick hang loat",
      "tao kenh",
      "xoa kenh",
      "tao role",
      "xoa role",
      "xoa tin",
      "khoa kenh",
      "lockdown",
      "pha hoai",
      "tan cong",
    ],
    answer:
      "Chống nuke/raid là lớp phòng thủ cấu trúc server đó senpai 🛡️! Em theo dõi audit log để phát hiện: ban/kick hàng loạt, làn sóng thành viên giả vào ồ ạt, tạo/xóa kênh hay role hàng loạt, và quét sạch tin nhắn. Vượt ngưỡng → em xác định thủ phạm và phạt TRỰC TIẾP (không cộng nhiệt) theo cài đặt, đồng thời có thể khóa kênh toàn server tự động khi bị tấn công (mở lại bằng /antinuke unlock). Mod/Admin trong danh sách Cài đặt được miễn trừ. Tất cả 8 module bật/tắt riêng trong sidebar \"Chống nuke / raid\"!",
    suggestions: [
      "Khóa kênh khi raid là gì?",
      "Cách miễn trừ mod/admin",
      "Join Gate là gì?",
    ],
  },
  {
    id: "autoreply",
    keywords: [
      "auto reply",
      "tu tra loi",
      "tu dong tra loi",
      "tu khoa",
      "keyword",
      "mention",
      "cooldown",
      "placeholder",
      "tra loi tu dong",
      "rule",
      "tra loi",
    ],
    answer:
      "Auto reply là thế mạnh của Protogon đó senpai 💬! Senpai tạo rule với từ khóa hoặc @mention làm mồi — khi ai đó nhắn khớp, em trả lời ngay. Hỗ trợ placeholder {user} (tag người nhắn) và {username} (lấy tên họ), chọn kênh áp dụng và cooldown chống spam. Ví dụ rule \"chơi gì\" → \"Hôm nay thử Valorant 5v5 nhé {user} 🎮\" — trả lời tự nhiên đúng giọng server của senpai!",
    suggestions: [
      "Cách tạo rule auto reply",
      "Hệ thống nhiệt độ hoạt động thế nào?",
      "Bot có những lệnh nào?",
    ],
  },
  {
    id: "report",
    keywords: [
      "bao cao",
      "bao cao hang ngay",
      "daily",
      "report",
      "tom tat",
      "tong ket",
      "thong ke",
    ],
    answer:
      "Báo cáo hàng ngày là bản tóm tắt an ninh của server đó senpai 📊! Mỗi ngày em gửi vào kênh log: tổng số sự kiện vi phạm, chi tiết theo từng module, thủ phạm thường xuyên, trạng thái khóa kênh — và đặc biệt là bảng \"nhiệt độ & warn tích lũy\" của từng thành viên (ví dụ: Alice 30/100 ⚠️, Bob 10/100 + warn 2/3), xếp theo nhiệt giảm dần. Bật trong Cài đặt → \"Báo cáo chống nuke hàng ngày\" và nhớ đặt kênh log nha!",
    suggestions: [
      "Cách đặt kênh log",
      "Bảng nhiệt trên web ở đâu?",
      "Warn tích lũy là gì?",
    ],
  },
  {
    id: "dashboard",
    keywords: [
      "dashboard",
      "web",
      "giao dien",
      "bang dieu khien",
      "chinh",
      "cau hinh",
      "sidebar",
      "trang web",
      "bảng",
      "hien thi",
      "dieu khien",
    ],
    answer:
      "Dashboard của chúng em chia sidebar thành 6 mục rõ ràng đó senpai 🖥️: Tổng quan (mức an toàn + thành viên nóng nhất), Moderation (spam, mention, từ xấu, ảnh/file, link mời, link độc hại + cài đặt nhiệt & warn), Join Gate, Chống nuke/raid, Auto Reply và Cài đặt. Có cả bảng nhiệt độ & warn đầy đủ của từng thành viên với nút xóa nhiệt ngay trong bảng. Mọi thay đổi được bot đồng bộ trong ~30 giây — chỉnh trên web xong em lo phần còn lại!",
    suggestions: [
      "Bảng nhiệt trên web ở đâu?",
      "Cách đặt kênh log",
      "Bot có những lệnh nào?",
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
      "Bot hỗ trợ cả prefix và slash command đó senpai ⌨️! Một số lệnh chính: /heat status — xem nhiệt & warn của thành viên (hiển thị đủ 4 mốc cảnh báo/tạm khóa/kick/ban); /antinuke — bật/tắt, khóa kênh (lockdown) và mở khóa (unlock); /prefix — đổi prefix (mặc định là !). Gõ / trong Discord để xem toàn bộ danh sách slash command, hoặc hỏi em thêm nha!",
    suggestions: [
      "Cách xem nhiệt của thành viên",
      "Khóa kênh khi raid là gì?",
      "Đổi prefix ở đâu?",
    ],
  },
  {
    id: "hosting",
    keywords: [
      "hosting",
      "wispbyte",
      "zip",
      "deploy",
      "chay bot",
      "may chu",
      "upload",
      "unarchive",
      "restart",
      "github",
      "host deploy",
      "tai zip",
    ],
    answer:
      "Cách chạy bot trên hosting — em hướng dẫn senpai từng bước nha 📦! 1) Vào GitHub repo → nhánh host-deploy → tải file protogon-bot.zip (nhớ F5 trước để lấy bản mới). 2) Lên Wispbyte → xóa file zip cũ → upload zip mới → Unarchive. 3) Bấm Restart và xem log: thấy \"✅ Protogon online\" là thành công. Còn web thì bấm nút Deploy trên Freebuff rồi Ctrl+F5. Mỗi lần cập nhật mình đều push zip mới lên nhánh host-deploy đó!",
    suggestions: [
      "Bot có những lệnh nào?",
      "Báo cáo hàng ngày là gì?",
      "Đăng nhập dashboard thế nào?",
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
      "Yên tâm senpai, Protogon miễn phí cho mọi server đó 🎀! Toàn bộ tính năng — auto reply, nhiệt độ 4 giai đoạn, warn tích lũy, Join Gate, chống nuke/raid, chặn link độc hại, báo cáo hàng ngày — đều dùng được không giới hạn. Chỉ cần bot và dashboard của senpai được host là xong, không mất phí nha!",
    suggestions: [
      "Cách chạy bot trên hosting",
      "Đăng nhập dashboard thế nào?",
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
      "Đăng nhập rất nhanh đó senpai 🪪! Bấm nút \"Đăng nhập với Discord\" ở góc phải trên cùng (hoặc nút Mở dashboard), Discord sẽ xác nhận quyền, xong là vào thẳng dashboard. Nhớ là chỉ server nào senpai có quyền quản lý mới hiện ra thôi nha — nếu chưa thấy server, hãy mời bot vào server đó trước!",
    suggestions: [
      "Cách chạy bot trên hosting",
      "Mời bot vào server thế nào?",
      "Bot có những lệnh nào?",
    ],
  },
];

export const GREETING =
  "Chào senpai! Em là Haimiya-senpai 🌸 — trợ lý ảo của Protogon. Em hơi nhát, nhưng senpai cứ hỏi em bất cứ điều gì về bot nhé: nhiệt độ, Join Gate, chống nuke, auto reply… Em sẽ cố hết sức! (◕‿◕)";

export const QUICK_QUESTIONS = [
  "Hệ thống nhiệt độ hoạt động thế nào?",
  "Join Gate là gì?",
  "Chống link độc hại hoạt động ra sao?",
  "Cách chạy bot trên hosting",
];

const FALLBACK: HaimiyaAnswer = {
  text: "Hmm… em chưa hiểu rõ ý senpai lắm 😖. Nhưng đừng ngại, em luôn ở đây! Senpai thử hỏi em một trong những câu bên dưới nhé, hoặc gõ từ khóa như \"nhiệt độ\", \"join gate\", \"warn\", \"hosting\"…",
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
