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
- Reaction Role: thành viên bấm emoji tự nhận/gỡ role; tối đa 10 bảng x 20 cặp; tạo/chỉnh bảng bằng dashboard hoặc lệnh /reactionrole create/add/remove/edit/delete + !reactionrole.
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

/**
 * AI Guard — phân loại một sự kiện vi phạm là raid/nuke hay chỉ là vi phạm cá
 * nhân (moderation bình thường). Bot gọi action này khi vượt ngưỡng để quyết
 * định có leo thang thành phản ứng chống raid (ban + lockdown) hay không.
 * Trả về { classification: "raid" | "individual" | "benign", confidence,
 * reason, suggestPunish, offline }.
 */
export const classifyViolation = action({
  args: {
    guildId: v.string(),
    guildName: v.optional(v.string()),
    module: v.string(),
    count: v.number(),
    windowSeconds: v.number(),
    threshold: v.number(),
    sampleMessages: v.array(v.string()),
    recentJoins: v.optional(v.number()),
    memberCount: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const key =
      process.env.SAMBANOVA_API_KEY ?? process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY;
    if (!key) return { classification: "individual", confidence: 0.5, reason: "AI chưa cấu hình", suggestPunish: undefined, offline: true };
    const baseUrl = process.env.AI_BASE_URL ??
      (process.env.SAMBANOVA_API_KEY ? "https://api.sambanova.ai/v1" : "https://api.openai.com/v1");
    const model =
      process.env.AI_MODEL ??
      process.env.OPENAI_MODEL ??
      (process.env.SAMBANOVA_API_KEY ? "Meta-Llama-3.3-70B-Instruct" : "gpt-4o-mini");
    const samples = (args.sampleMessages || []).slice(0, 6).map((s) => s.slice(0, 200));
    const system = `Bạn là chuyên gia an ninh Discord. Phân loại một sự kiện vi phạm vừa xảy ra:
- "raid": tấn công có tổ chức / tự động — bot-account, hàng loạt tài khoản cùng lúc, nội dung lặp lại giống hệt nhau, tin nhắn cực dài hoặc giả blank (chỉ khoảng trắng / ký tự ẩn) gây nhiễu loạn kênh, hoặc kết hợp với làn sóng thành viên mới vào.
- "individual": chỉ một thành viên vi phạm nhẹ (spam bình thường, nói tục, gửi nhanh vài tin) — xử lý moderation thông thường.
- "benign": có thể là dương tính giả, không cần phạt.
Chỉ trả lời JSON thuần (không markdown) dạng: {"classification": "raid|individual|benign", "confidence": 0-1, "reason": "ngắn gọn tiếng Việt", "suggestPunish": "warn|timeout|kick|ban|null"}`;
    const user = `Sự kiện: module \"${args.module}\" — ${args.count} lần trong ${args.windowSeconds}s (ngưỡng ${args.threshold}).
Server: ${args.guildName ?? "?"} (${args.memberCount ?? "?"} thành viên).
Thành viên mới gần đây: ${args.recentJoins ?? 0}.
Mẫu tin nhắn:\n${samples.length ? samples.map((s, i) => `${i + 1}. ${s}`).join("\n") : "(không có)"}`;
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          max_tokens: 200,
          temperature: 0.2,
        }),
      });
      if (!res.ok) {
        return { classification: "individual", confidence: 0.5, reason: `AI lỗi (${res.status})`, suggestPunish: undefined, offline: true };
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const raw = data?.choices?.[0]?.message?.content ?? "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      if (!parsed || !["raid", "individual", "benign"].includes(parsed.classification)) {
        return { classification: "individual", confidence: 0.5, reason: "AI trả về không hợp lệ", suggestPunish: undefined, offline: true };
      }
      return {
        classification: parsed.classification,
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
        reason: String(parsed.reason || "").slice(0, 300),
        suggestPunish: ["warn", "timeout", "kick", "ban", null].includes(parsed.suggestPunish)
          ? parsed.suggestPunish
          : undefined,
        offline: false,
      };
    } catch {
      return { classification: "individual", confidence: 0.5, reason: "AI không kết nối được", suggestPunish: undefined, offline: true };
    }
  },
});

/**
 * Raid Intel — AI phân tích cụm tài khoản + chuỗi hành vi phá hoại để xác định
 * một vụ raid/nuke có phải tấn công phối hợp không và ai là nghi phạm NGUỒN CƠN
 * (tài khoản chủ mưu — acc cũ trong cụm, người tạo invite, kẻ thực hiện hành vi
 * phá hoại trong audit log). Bot gọi best-effort khi săn nguồn cơn raid; nếu AI
 * chưa cấu hình thì bot vẫn chạy theo điểm nghi vấn deterministic.
 * Trả về { coordinated, confidence, reasoning, sourceHint, offline }.
 */
export const analyzeRaid = action({
  args: {
    guildId: v.string(),
    guildName: v.optional(v.string()),
    module: v.string(),
    count: v.number(),
    windowSeconds: v.number(),
    threshold: v.number(),
    clusterProfile: v.optional(v.string()),
    recentActions: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const key =
      process.env.SAMBANOVA_API_KEY ?? process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY;
    if (!key) {
      return { coordinated: null, confidence: 0, reasoning: "AI chưa cấu hình", sourceHint: null, offline: true };
    }
    const baseUrl = process.env.AI_BASE_URL ??
      (process.env.SAMBANOVA_API_KEY ? "https://api.sambanova.ai/v1" : "https://api.openai.com/v1");
    const model =
      process.env.AI_MODEL ??
      process.env.OPENAI_MODEL ??
      (process.env.SAMBANOVA_API_KEY ? "Meta-Llama-3.3-70B-Instruct" : "gpt-4o-mini");
    const system = `Bạn là chuyên gia an ninh Discord chuyên điều tra RAID/NUKE.
Phân tích dữ liệu một vụ tấn công server vừa xảy ra và trả lời:
- "coordinated": vụ này có phải tấn công PHỐI HỢP (raid/nuke) hay chỉ là cá nhân vi phạm.
- "sourceHint": ai là nghi phạm NGUỒN CƠN đứng sau (tài khoản chủ mưu)? Gợi ý: acc cũ nhất trong cụm, người có avatar/username giống các tài khoản khác, người tạo invite, kẻ thực hiện hành vi phá hoại trong audit log. Trả null nếu chưa đủ tín hiệu.
- Chỉ trả lời JSON thuần (không markdown): {"coordinated": true|false|null, "confidence": 0-1, "reasoning": "ngắn gọn tiếng Việt", "sourceHint": "username hoặc null"}`;
    const user = `Vụ: module \"${args.module}\" — ${args.count} lần trong ${args.windowSeconds}s (ngưỡng ${args.threshold}). Server: ${args.guildName ?? "?"}.
Hồ sơ cụm tài khoản:\n${args.clusterProfile || "(không có)"}
Chuỗi hành vi gần đây:\n${args.recentActions || "(không có)"}`;
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          max_tokens: 250,
          temperature: 0.2,
        }),
      });
      if (!res.ok) {
        return { coordinated: null, confidence: 0, reasoning: `AI lỗi (${res.status})`, sourceHint: null, offline: true };
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const raw = data?.choices?.[0]?.message?.content ?? "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      if (!parsed || typeof parsed.coordinated !== "boolean") {
        return { coordinated: null, confidence: 0, reasoning: "AI trả về không hợp lệ", sourceHint: null, offline: true };
      }
      return {
        coordinated: parsed.coordinated,
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
        reasoning: String(parsed.reasoning || "").slice(0, 400),
        sourceHint: parsed.sourceHint ? String(parsed.sourceHint).slice(0, 80) : null,
        offline: false,
      };
    } catch {
      return { coordinated: null, confidence: 0, reasoning: "AI không kết nối được", sourceHint: null, offline: true };
    }
  },
});

/**
 * External App Guard — AI xác định xem chuỗi kết nối ứng dụng ngoài (external
 * app / integration) vừa xảy ra có phải RAID không, dựa trên hồ sơ app + người
 * dùng kết nối + làn sóng thành viên mới vào. Bot gọi best-effort khi vượt ngưỡng
 * module externalAppRaid; AI chưa cấu hình → bot tự xử lý theo mặc định.
 * Trả về { isRaid, confidence, reason, offline }.
 */
export const analyzeExternalApp = action({
  args: {
    guildId: v.string(),
    guildName: v.optional(v.string()),
    count: v.number(),
    windowSeconds: v.number(),
    threshold: v.number(),
    appProfile: v.optional(v.string()),
    recentJoins: v.optional(v.number()),
    memberCount: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const key =
      process.env.SAMBANOVA_API_KEY ?? process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY;
    if (!key) {
      return { isRaid: null, confidence: 0, reason: "AI chưa cấu hình", offline: true };
    }
    const baseUrl = process.env.AI_BASE_URL ??
      (process.env.SAMBANOVA_API_KEY ? "https://api.sambanova.ai/v1" : "https://api.openai.com/v1");
    const model =
      process.env.AI_MODEL ??
      process.env.OPENAI_MODEL ??
      (process.env.SAMBANOVA_API_KEY ? "Meta-Llama-3.3-70B-Instruct" : "gpt-4o-mini");
    const system = `Bạn là chuyên gia an ninh Discord. "External app" là ứng dụng ngoài (ứng dụng mở rộng / integration) được người dùng cài đặt và kết nối vào server. Phân tích chuỗi sự kiện kết nối ứng dụng ngoài vừa xảy ra và xác định NGUỜI DÙNG của các app đó có đang RAID không:
- isRaid=true: dấu hiệu tấn công phối hợp — nhiều người (đặc biệt là tài khoản mới/nghi sockpuppet) cùng lúc kết nối cùng một app để khai thác, app lạ xuất hiện ồ ạt, hoặc kết hợp làn sóng thành viên mới vào server.
- isRaid=false: chỉ một vài người dùng/ứng dụng bình thường kết nối (vd mod thử app mới, app quen thuộc).
- Trả null nếu chưa đủ thông tin để kết luận.
Chỉ trả lời JSON thuần (không markdown): {"isRaid": true|false|null, "confidence": 0-1, "reason": "ngắn gọn tiếng Việt"}`;
    const user = `Vụ: ${args.count} kết nối app ngoài trong ${args.windowSeconds}s (ngưỡng ${args.threshold}). Server: ${args.guildName ?? "?"} (${args.memberCount ?? "?"} thành viên). Thành viên mới gần đây: ${args.recentJoins ?? 0}.
Hồ sơ kết nối:\n${args.appProfile || "(không có)"}`;
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          max_tokens: 250,
          temperature: 0.2,
        }),
      });
      if (!res.ok) {
        return { isRaid: null, confidence: 0, reason: `AI lỗi (${res.status})`, offline: true };
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const raw = data?.choices?.[0]?.message?.content ?? "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      if (!parsed || (typeof parsed.isRaid !== "boolean" && parsed.isRaid !== null)) {
        return { isRaid: null, confidence: 0, reason: "AI trả về không hợp lệ", offline: true };
      }
      return {
        isRaid: parsed.isRaid,
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
        reason: String(parsed.reason || "").slice(0, 300),
        offline: false,
      };
    } catch {
      return { isRaid: null, confidence: 0, reason: "AI không kết nối được", offline: true };
    }
  },
});
