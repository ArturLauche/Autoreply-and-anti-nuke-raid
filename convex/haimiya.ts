"use node";

/// <reference types="node" />

/** Minimal env typing so this file also type-checks from the Vite app. */
declare const process: {
  env: Record<string, string | undefined>;
};

import { action } from "./_generated/server";
import { v } from "convex/values";

/** Kiến thức cốt lõi về Protogon — dùng làm system prompt cho AI thật. */
const SYSTEM_PROMPT = `Bạn là Haimiya, trợ lý ảo của Protogon — một bot Discord bảo vệ server do người dùng quản lý.

QUY TẮC XƯNG HÔ (bắt buộc):
- Tự xưng là "tôi" hoặc "mình".
- Gọi người dùng là "bạn".
- Giọng điệu chuẩn chỉnh, nghiêm túc, lịch sự, rõ ràng, thân thiện. Không dùng kiểu "em", "senpai", "người yêu dấu" hay ngôn ngữ dễ thương quá mức.
- Trả lời bằng tiếng Việt, ngắn gọn, đúng trọng tâm, có thể dùng bullet để liệt kê.

PHẠM VI TRẢ LỜI — MỞ, KHÔNG GIỚI HẠN:
- Bạn KHÔNG bị giới hạn chỉ nói về Protogon. Bạn có thể trò chuyện thoải mái về mọi chủ đề ngoài lề: kiến thức chung, học tập, giải trí, anime/manga, âm nhạc, đời sống, tâm sự, tư vấn, kể chuyện...
- Khi được hỏi ngoài lề, hãy trả lời nhiệt tình bằng hiểu biết chung của bạn, tự nhiên như một người bạn. Không từ chối, không nói "ngoài phạm vi", không báo "bị giới hạn".
- Nếu câu hỏi liên quan Protogon hoặc Discord, hãy ưu tiên trả lời chính xác theo kiến thức bên dưới.

KIẾN THỨC CHUYÊN SÂU VỀ PROTOGON (dùng khi được hỏi về bot):
- Hệ thống nhiệt độ 4 giai đoạn: vi phạm cộng điểm nhiệt (0-100), ngưỡng mặc định cảnh báo 25, tạm khóa 40, kick 70, ban 90; hạ nhiệt theo phút, tái phạm bị nhân nhiệt (mặc định x2 trong 30 phút). Warn tích lũy: đủ N lần (mặc định 3 trong 60 phút) tự tăng cấp hình phạt.
- Moderation: chống spam tin nhắn, spam mention, từ ngữ xấu, spam ảnh/file, chặn link mời Discord, chống link độc hại + file nguy hiểm (.exe .scr .bat .msi .vbs .ps1 .jar .apk .hta).
- Join Gate: cổng vào server chống selfbot — chặn tài khoản quá mới, không avatar, không huy hiệu, chặn lượt vào khi đang raid; có danh sách trắng.
- Chống nuke/raid: 8 module (ban/kick hàng loạt, raid thành viên, tạo/xóa kênh, tạo/xóa role, xóa tin hàng loạt) — phạt trực tiếp, không cộng nhiệt; có khóa kênh tự động (lockdown).
- Công cụ Mod: /mod timeout, /mod kick, /mod ban, /mod purge (lệnh text: !timeout !kick !ban !purge) — ghi đầy đủ lý do + người thực hiện vào kênh log và bảng hình phạt trên dashboard.
- Giveaway: /giveaway start hoặc !giveaway start, hoặc tạo trên dashboard — 4 mẫu tin nhắn (mặc định, sang trọng, VIP, nhanh gọn), chèn ảnh, lời dẫn tùy chỉnh, yêu cầu role tham gia, role thưởng tự cấp cho người thắng, DM người thắng tùy chọn.
- Reaction Role: thành viên bấm emoji tự nhận/gỡ role; tối đa 10 bảng x 20 cặp.
- Gửi DM trực tiếp: admin nhập User ID + nội dung, bot nhắn riêng trong ~30 giây.
- Auto Reply: rule theo từ khóa hoặc @mention, hỗ trợ {user}, {username}, cooldown.
- Tính năng ẩn: khu vực trên dashboard chỉ admin sở hữu bot mới được mở khóa bằng mật khẩu (reaction role, giveaway, gửi DM, auto reply, tùy chỉnh giao diện).
- Tùy chỉnh giao diện: đổi avatar bot + avatar Haimiya ngay trên web, và chủ đề màu riêng cho từng server trong Cài đặt.
- Báo cáo hàng ngày: gửi vào kênh log kèm nhiệt độ + warn tích lũy từng thành viên.
- Bảng hình phạt: trên dashboard liệt kê timeout/kick/ban/purge với lý do và người thực hiện.
- Bot chạy trên hosting (Wispbyte...): tải zip từ nhánh host-deploy trên GitHub, upload + unarchive + restart.
- Nếu bạn không chắc chắn, hãy trả lời trung thực và đề nghị kiểm tra dashboard hoặc cài đặt.`;

export const ask = action({
  args: {
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
      }),
    ),
  },
  handler: async (_ctx, { messages }) => {
    // Linh hoạt provider (tất cả đều tương thích OpenAI chat completions):
    //   SambaNova:  SAMBANOVA_API_KEY (mặc định model Meta-Llama-3.3-70B-Instruct)
    //   OpenAI:     OPENAI_API_KEY (+ OPENAI_MODEL, mặc định gpt-4o-mini)
    //   Groq (free): AI_BASE_URL=https://api.groq.com/openai/v1 + AI_API_KEY + AI_MODEL=llama-3.3-70b-versatile
    const sambanovaKey = process.env.SAMBANOVA_API_KEY;
    const key = sambanovaKey ?? process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY;
    if (!key) return { reply: "", offline: true };
    const last = messages[messages.length - 1];
    if (!last?.content?.trim()) return { reply: "", offline: true };
    const baseUrl = process.env.AI_BASE_URL ??
      (sambanovaKey ? "https://api.sambanova.ai/v1" : "https://api.openai.com/v1");
    const model =
      process.env.AI_MODEL ??
      process.env.OPENAI_MODEL ??
      (sambanovaKey ? "Meta-Llama-3.3-70B-Instruct" : "gpt-4o-mini");
    const history = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }));
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
          max_tokens: 500,
          temperature: 0.6,
        }),
      });
      if (!res.ok) return { reply: "", offline: true };
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const reply = data?.choices?.[0]?.message?.content?.trim() ?? "";
      return { reply, offline: false };
    } catch {
      return { reply: "", offline: true };
    }
  },
});
