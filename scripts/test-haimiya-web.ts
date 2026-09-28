// TEST Haimiya web — tầng 1: bộ kiến thức cục bộ (fallback khi AI thật offline).
// Chạy: bun scripts/test-haimiya-web.ts
import { askHaimiya, buildAskHistory, GREETING, QUICK_QUESTIONS } from "../src/lib/haimiya";

let pass = 0;
let fail = 0;
const check = (label: string, ok: boolean) => {
  console.log(ok ? `  ✅ ${label}` : `  ❌ ${label}`);
  if (ok) pass++;
  else fail++;
};

console.log("Tầng fallback cục bộ (askHaimiya):");

// 1. Câu hỏi về Protogon → phải khớp đúng chủ đề
const heat = askHaimiya("Hệ thống nhiệt độ hoạt động thế nào?");
check("hỏi nhiệt độ → trả lời có nội dung", heat.text.length > 50);
check("hỏi nhiệt độ → có gợi ý tiếp theo", heat.suggestions.length > 0);
check("hỏi nhiệt độ → KHÔNG rơi vào fallback", !heat.text.includes("chưa kết nối được"));

const antinuke = askHaimiya("anti nuke là gì, bot có chống raid không?");
check("hỏi anti nuke/raid → khớp chủ đề", !antinuke.text.includes("chưa kết nối được"));
check(
  "trả lời anti nuke có nói về khóa kênh/lockdown hoặc module",
  /lockdown|khóa kênh|module|phạt/i.test(antinuke.text),
);

// 2. Có dấu/không dấu/hoa thường đều khớp
const upper = askHaimiya("CHỐNG NUKE RAID HOẠT ĐỘNG SAO?");
check("chữ hoa + có dấu → vẫn khớp chủ đề", !upper.text.includes("chưa kết nối được"));
const noDi = askHaimiya("cho hoi he thong nhiet do chay the nao");
check("không dấu → vẫn khớp chủ đề nhiệt độ", !noDi.text.includes("chưa kết nối được"));

// 3. Tính năng riêng tư → phải từ chối tiết lộ.
// Chấp nhận mọi cách diễn đạt của cùng một nguyên tắc: khu vực riêng của chủ
// sở hữu bot thì không chia sẻ công khai. Ghim cứng một cụm từ khiến câu trả
// lời đổi giọng (đợt rà soát copy) là test đỏ oan, còn luật thật vẫn nguyên.
const PRIVATE_ANSWER_RE =
  /riêng tư|riêng của chủ sở hữu bot|không chia sẻ công khai|không tiết lộ/i;
const giveaway = askHaimiya("giveaway hoạt động sao?");
check("hỏi giveaway → giữ nguyên tắc riêng tư", PRIVATE_ANSWER_RE.test(giveaway.text));

// 4. Câu ngoài phạm vi → fallback lịch sự
const fallback = askHaimiya("hôm nay thời tiết thế nào nhỉ");
check("câu vô nghĩa/ngoài phạm vi → fallback (không crash)", fallback.text.length > 0);

// 5. Chuỗi chào mừng + câu hỏi nhanh hợp lệ
check("GREETING không rỗng", GREETING.length > 20);
check("QUICK_QUESTIONS đủ 4 câu gợi ý", QUICK_QUESTIONS.length === 4);
for (const q of QUICK_QUESTIONS) {
  const ans = askHaimiya(q);
  check(`gợi ý nhanh khớp chủ đề: "${q.slice(0, 30)}..."`, ans.text.length > 20);
}

// 6. Chuỗi rỗng → fallback an toàn
check("input rỗng → fallback an toàn", askHaimiya("").text.length > 0);

console.log("\nDựng lịch sử gửi AI (buildAskHistory):");
const HINT = "Hãy mô tả ảnh này.";
// Bug 27/09/2026: gửi ảnh KHÔNG kèm chữ → lượt cuối `content` rỗng →
// haimiya.ask trả "Tin nhắn rỗng" → ảnh bị bỏ rơi, panel báo AI offline.
{
  const h = buildAskHistory(
    [
      { role: "assistant", text: "Chào bạn" },
      { role: "user", text: "" },
    ],
    HINT,
  );
  const last = h[h.length - 1];
  check(
    "lượt cuối rỗng (ảnh không kèm chữ) → thay bằng chỉ dẫn, KHÔNG gửi rỗng",
    last.role === "user" && last.content === HINT && last.content.trim().length > 0,
    last,
  );
  check("lượt trước giữ nguyên", h[0].content === "Chào bạn" && h[0].role === "assistant");
}
{
  const h = buildAskHistory([{ role: "user", text: "  Hệ thống nhiệt độ thế nào?  " }], HINT);
  check("lượt có chữ → giữ nguyên (và trim)", h[0].content === "Hệ thống nhiệt độ thế nào?");
}
{
  const many = Array.from({ length: 12 }, (_, i) => ({
    role: (i % 2 ? "assistant" : "user") as "user" | "assistant",
    text: `lượt ${i}`,
  }));
  const h = buildAskHistory(many, HINT);
  check("cap 8 lượt (khớp cap phía Convex)", h.length === 8, h.length);
  check("giữ lượt MỚI nhất, bỏ lượt cũ nhất", h[7].content === "lượt 11", h[7]);
}
{
  const h = buildAskHistory([{ role: "user", text: "   " }], HINT);
  check("lượt toàn khoảng trắng cũng không gửi rỗng", h[0].content === HINT, h[0]);
}

console.log(`\nKết quả tầng fallback: ${pass} PASS, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
