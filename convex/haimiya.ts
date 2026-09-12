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

/**
 * Chọn provider AI theo thứ tự ưu tiên (tất cả tương thích OpenAI chat completions):
 *   1. Gateway OpenAI-compatible (Groq, kiosapi, ...): AI_BASE_URL + AI_API_KEY + AI_MODEL
 *   2. SambaNova: SAMBANOVA_API_KEY (mặc định Meta-Llama-3.3-70B-Instruct)
 *   3. OpenAI: OPENAI_API_KEY (+ OPENAI_MODEL, mặc định gpt-4o-mini)
 */
/**
 * Chọn provider AI theo thứ tự ưu tiên (tất cả tương thích OpenAI chat completions):
 *   1. Gateway OpenAI-compatible (Groq, kiosapi, ...): AI_BASE_URL + AI_API_KEY + AI_MODEL
 *   2. Groq free (không cần credit card, 30 RPM, 14.4K RPD): GROQ_API_KEY
 *   3. NVIDIA NIM free (40 RPM / 4M TPM, không cần thẻ): NVIDIA_API_KEY
 *      hoặc key riêng cho DeepSeek: DEEPSEEK_NIM_KEY (deepseek-v4-pro-0813)
 *   4. SambaNova: SAMBANOVA_API_KEY (mặc định Meta-Llama-3.3-70B-Instruct)
 *   5. OpenAI: OPENAI_API_KEY (+ OPENAI_MODEL, mặc định gpt-4o-mini)
 *
 * Free tier từ awesome-freellm-apis:
 * - Groq: 30 RPM, 14,400 RPD, model llama-3.3-70b-versatile — MIỄN PHÍ, không cần thẻ
 * - SambaNova: 20 RPM, 20 RPD, model deepseek-v3-1 — MIỄN PHÍ, cần đăng ký
 */
function aiProvider(): { key: string; baseUrl: string; model: string } | null {
  // 1. Gateway tùy chỉnh (Groq/kiosapi qua env)
  const groqKey = process.env.AI_API_KEY;
  if (groqKey && process.env.AI_BASE_URL) {
    return {
      key: groqKey,
      baseUrl: process.env.AI_BASE_URL,
      model: process.env.AI_MODEL ?? "qwen/qwen3.8-27b",
    };
  }
  // 2. Groq free trực tiếp (không qua gateway)
  const groqDirectKey = process.env.GROQ_API_KEY;
  if (groqDirectKey) {
    return {
      key: groqDirectKey,
      baseUrl: "https://api.groq.com/openai/v1",
      model: process.env.AI_MODEL ?? "qwen/qwen3.8-27b",
    };
  }
  // 3. NVIDIA NIM free (https://build.nvidia.com — 40 RPM, 4M TPM)
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  if (nvidiaKey) {
    return {
      key: nvidiaKey,
      baseUrl: "https://integrate.api.nvidia.com/v1",
      model: process.env.NVIDIA_MODEL ?? "mistralai/mistral-nemotron",
    };
  }
  // 3b. NVIDIA NIM với model DeepSeek V4 Pro (key NIM riêng, mạnh hơn)
  const deepseekNimKey = process.env.DEEPSEEK_NIM_KEY;
  if (deepseekNimKey) {
    return {
      key: deepseekNimKey,
      baseUrl: "https://integrate.api.nvidia.com/v1",
      model: process.env.DEEPSEEK_NIM_MODEL ?? "deepseek-ai/deepseek-v4-pro-0813",
    };
  }
  // 4. SambaNova free
  const sambanovaKey = process.env.SAMBANOVA_API_KEY;
  if (sambanovaKey) {
    return {
      key: sambanovaKey,
      baseUrl: "https://api.sambanova.ai/v1",
      model: "Meta-Llama-3.3-70B-Instruct",
    };
  }
  // 5. OpenAI (trả phí)
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return {
      key: openaiKey,
      baseUrl: "https://api.openai.com/v1",
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    };
  }
  return null;
}

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
    const p = aiProvider();
    if (!p) return { reply: "", offline: true };
    const last = messages[messages.length - 1];
    if (!last?.content?.trim()) return { reply: "", offline: true };
    const history = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }));
    try {
      const res = await fetch(`${p.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${p.key}`,
        },
        body: JSON.stringify({
          model: p.model,
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
    const p = aiProvider();
    if (!p) return { classification: "individual", confidence: 0.5, reason: "AI chưa cấu hình", suggestPunish: undefined, offline: true };
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
      const res = await fetch(`${p.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${p.key}`,
        },
        body: JSON.stringify({
          model: p.model,
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
    const p = aiProvider();
    if (!p) {
      return { coordinated: null, confidence: 0, reasoning: "AI chưa cấu hình", sourceHint: null, offline: true };
    }
    const system = `Bạn là chuyên gia an ninh Discord chuyên điều tra RAID/NUKE.
Phân tích dữ liệu một vụ tấn công server vừa xảy ra và trả lời:
- "coordinated": vụ này có phải tấn công PHỐI HỢP (raid/nuke) hay chỉ là cá nhân vi phạm.
- "sourceHint": ai là nghi phạm NGUỒN CƠN đứng sau (tài khoản chủ mưu)? Gợi ý: acc cũ nhất trong cụm, người có avatar/username giống các tài khoản khác, người tạo invite, kẻ thực hiện hành vi phá hoại trong audit log. Trả null nếu chưa đủ tín hiệu.
- Chỉ trả lời JSON thuần (không markdown): {"coordinated": true|false|null, "confidence": 0-1, "reasoning": "ngắn gọn tiếng Việt", "sourceHint": "username hoặc null"}`;
    const user = `Vụ: module \"${args.module}\" — ${args.count} lần trong ${args.windowSeconds}s (ngưỡng ${args.threshold}). Server: ${args.guildName ?? "?"}.
Hồ sơ cụm tài khoản:\n${args.clusterProfile || "(không có)"}
Chuỗi hành vi gần đây:\n${args.recentActions || "(không có)"}`;
    try {
      const res = await fetch(`${p.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${p.key}`,
        },
        body: JSON.stringify({
          model: p.model,
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
    const p = aiProvider();
    if (!p) {
      return { isRaid: null, confidence: 0, reason: "AI chưa cấu hình", offline: true };
    }
    const system = `Bạn là chuyên gia an ninh Discord chuyên điều tra RAID bằng ỨNG DỤNG NGOÀI (external app / integration).

"External app raid" là kỹ thuật tấn công server dùng ứng dụng Discord thay vì bot thành viên:
- Kẻ tấn công tạo hàng loạt tài khoản mới (sockpuppet), mỗi acc CÀI/KẾT NỐI cùng một app vào server trong khoảng thời gian ngắn (thường < 1 phút).
- App sau khi kết nối thường spam @everyone/@here, gửi link lừa đảo hoặc link mời, tạo webhook để tràn tin, tự cấp role hoặc ban thành viên, đổi cấu hình server, rồi xóa dấu vết.
- App thường được đặt tên giả mạo app quen thuộc (MEE6, Dyno, Carl-bot, ProBot, Wumpus...) kèm từ phụ (pro/premium/verify/free/hack/beta) hoặc tên mời gọi scam (Free Nitro, Giveaway, Boost, Verify, Crypto, Airdrop, Claim) để lừa chủ server cài.

PHÂN TÍCH hồ sơ kết nối app / tin nhắn app vừa xảy ra và xác định NGUỜI DÙNG app có đang RAID không:
- isRaid=true (tấn công phối hợp):
  1) Nhiều tài khoản (đặc biệt mới tạo, nghi sockpuppet) cùng lúc kết nối app — cùng app hoặc loạt app giống nhau.
  2) App lạ xuất hiện ồ ạt; tên app giả mạo app nổi tiếng hoặc chứa từ khóa scam (nitro, giveaway, boost, free, claim, reward, crypto, airdrop, verify).
  3) Làn sóng thành viên mới vào server ngay trước/trong lúc kết nối app (raid chuẩn bị hoặc đang diễn ra).
  4) App gửi tin spam: lặp nội dung giống hệt hoặc gần giống (đổi số/emoji/URL mỗi tin để né filter), @everyone/@here, link mời Discord, link rút gọn (bit.ly, t.me, tinyurl, rb.gy...), từ khóa quà tặng/lừa đảo, hoặc tràn nhiều URL khác nhau.
  5) App tạo webhook để spam rồi xóa webhook ngay (xóa dấu vết).
- isRaid=false: chỉ một vài người dùng/ứng dụng bình thường kết nối (vd mod thử app mới, app quen thuộc) hoặc app gửi tin hoạt động hợp lệ (nhạc, leveling, thông báo — không có tín hiệu spam ở trên).
- Trả null nếu chưa đủ thông tin để kết luận.
Chỉ trả lời JSON thuần (không markdown): {"isRaid": true|false|null, "confidence": 0-1, "reason": "ngắn gọn tiếng Việt"}`;
    const user = `Vụ: ${args.count} kết nối app ngoài trong ${args.windowSeconds}s (ngưỡng ${args.threshold}). Server: ${args.guildName ?? "?"} (${args.memberCount ?? "?"} thành viên). Thành viên mới gần đây: ${args.recentJoins ?? 0}.
Hồ sơ kết nối / tin nhắn app:\n${args.appProfile || "(không có)"}`;
    try {
      const res = await fetch(`${p.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${p.key}`,
        },
        body: JSON.stringify({
          model: p.model,
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
