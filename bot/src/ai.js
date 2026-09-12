/**
 * AI client trực tiếp từ process bot (VPS) — KHÔNG đi qua Convex action.
 *
 * Vì sao: Convex free tier tính action (~10 lần một query). Ba hàm AI chống
 * nuke/raid của bot trước đây chạy qua `haimiya:*` trên Convex — mỗi vụ raid
 * tốn hàng chục actions. Giờ bot tự gọi API tương thích OpenAI (Groq mặc định,
 * free 30 RPM / 14.4K RPD) trực tiếp từ VPS: không tốn operations Convex,
 * độ trễ thấp hơn, không bị giới hạn kép.
 *
 * Env trên VPS (file bot/.env):
 *   GROQ_API_KEY      — khuyến nghị (free, không cần thẻ): console.groq.com
 *   AI_BASE_URL       — (tùy chọn) gateway tương thích OpenAI khác
 *   AI_API_KEY        — (tùy chọn) key cho gateway trên
 *   AI_MODEL          — (tùy chọn) mặc định "llama-3.3-70b-versatile"
 *   OPENAI_API_KEY    — (tùy chọn) fallback trả phí
 *
 * Không có key nào → mọi hàm trả { offline: true } và bot chạy theo điểm
 * nghi vấn deterministic (đúng hành vi cũ khi AI chưa cấu hình).
 */

const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const TIMEOUT_MS = 12_000;

/** Chọn provider: gateway tùy chỉnh → Groq → SambaNova → OpenAI. */
function provider() {
  const key = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL;
  if (key && baseUrl) {
    return { key, baseUrl: baseUrl.replace(/\/+$/, ""), model: process.env.AI_MODEL || DEFAULT_MODEL };
  }
  const groq = process.env.GROQ_API_KEY;
  if (groq) {
    return {
      key: groq,
      baseUrl: "https://api.groq.com/openai/v1",
      model: process.env.AI_MODEL || DEFAULT_MODEL,
    };
  }
  const samba = process.env.SAMBANOVA_API_KEY;
  if (samba) {
    return {
      key: samba,
      baseUrl: "https://api.sambanova.ai/v1",
      model: "Meta-Llama-3.3-70B-Instruct",
    };
  }
  const openai = process.env.OPENAI_API_KEY;
  if (openai) {
    return { key: openai, baseUrl: "https://api.openai.com/v1", model: process.env.OPENAI_MODEL || "gpt-4o-mini" };
  }
  return null;
}

/** Báo AI online hay không (để UI/log hiển thị đúng nguồn phát hiện). */
function aiAvailable() {
  return !!provider();
}

/** Gọi chat completions, trả về chuỗi nội dung hoặc null. Không bao giờ throw. */
async function chat(messages, { maxTokens = 250, temperature = 0.2, timeoutMs = TIMEOUT_MS } = {}) {
  const p = provider();
  if (!p) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` },
      body: JSON.stringify({ model: p.model, messages, max_tokens: maxTokens, temperature }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Trích JSON object đầu tiên trong chuỗi trả lời của model. */
function extractJson(raw) {
  if (!raw) return null;
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

/**
 * Phân loại sự kiện vi phạm: raid / individual / benign.
 * Trả { classification, confidence, reason, suggestPunish, offline }.
 */
async function classifyViolation({ module, count, windowSeconds, threshold, sampleMessages = [], recentJoins, memberCount }) {
  const p = provider();
  if (!p) return { classification: "individual", confidence: 0.5, reason: "AI chưa cấu hình", offline: true };
  const samples = (sampleMessages || []).slice(0, 6).map((s) => String(s).slice(0, 200));
  const system = `Bạn là chuyên gia an ninh Discord. Phân loại một sự kiện vi phạm vừa xảy ra:
- "raid": tấn công có tổ chức / tự động — bot-account, hàng loạt tài khoản cùng lúc, nội dung lặp lại giống hệt nhau, tin nhắn cực dài hoặc giả blank (chỉ khoảng trắng / ký tự ẩn) gây nhiễu loạn kênh, hoặc kết hợp với làn sóng thành viên mới vào.
- "individual": chỉ một thành viên vi phạm nhẹ (spam bình thường, nói tục, gửi nhanh vài tin) — xử lý moderation thông thường.
- "benign": có thể là dương tính giả, không cần phạt.
Chỉ trả lời JSON thuần (không markdown) dạng: {"classification": "raid|individual|benign", "confidence": 0-1, "reason": "ngắn gọn tiếng Việt", "suggestPunish": "warn|timeout|kick|ban|null"}`;
  const user = `Sự kiện: module "${module}" — ${count} lần trong ${windowSeconds}s (ngưỡng ${threshold}).
Thành viên mới gần đây: ${recentJoins ?? 0}. Thành viên server: ${memberCount ?? "?"}.
Mẫu tin nhắn:
${samples.length ? samples.map((s, i) => `${i + 1}. ${s}`).join("\n") : "(không có)"}`;
  const raw = await chat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { maxTokens: 200 },
  );
  const parsed = extractJson(raw);
  if (!parsed || !["raid", "individual", "benign"].includes(parsed.classification)) {
    return { classification: "individual", confidence: 0.5, reason: "AI trả về không hợp lệ", offline: true };
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
}

/**
 * Phân tích vụ raid: có phối hợp không + nghi phạm nguồn cơn.
 * Trả { coordinated, confidence, reasoning, sourceHint, offline }.
 */
async function analyzeRaid({ module, count, windowSeconds, threshold, clusterProfile, recentActions }) {
  if (!provider()) return { coordinated: null, confidence: 0, reasoning: "AI chưa cấu hình", sourceHint: null, offline: true };
  const system = `Bạn là chuyên gia an ninh Discord chuyên điều tra RAID/NUKE.
Phân tích dữ liệu một vụ tấn công server vừa xảy ra và trả lời:
- "coordinated": vụ này có phải tấn công PHỐI HỢP (raid/nuke) hay chỉ là cá nhân vi phạm.
- "sourceHint": ai là nghi phạm NGUỒN CƠN đứng sau (tài khoản chủ mưu)? Gợi ý: acc cũ nhất trong cụm, người có avatar/username giống các tài khoản khác, người tạo invite, kẻ thực hiện hành vi phá hoại trong audit log. Trả null nếu chưa đủ tín hiệu.
- Chỉ trả lời JSON thuần (không markdown): {"coordinated": true|false|null, "confidence": 0-1, "reasoning": "ngắn gọn tiếng Việt", "sourceHint": "username hoặc null"}`;
  const user = `Vụ: module "${module}" — ${count} lần trong ${windowSeconds}s (ngưỡng ${threshold}).
Hồ sơ cụm tài khoản:
${clusterProfile || "(không có)"}
Chuỗi hành vi gần đây:
${recentActions || "(không có)"}`;
  const raw = await chat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { maxTokens: 250 },
  );
  const parsed = extractJson(raw);
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
}

/**
 * Xác định chuỗi kết nối external app có phải raid không.
 * Trả { isRaid, confidence, reason, offline }.
 */
async function analyzeExternalApp({ count, windowSeconds, threshold, appProfile, recentJoins, memberCount }) {
  if (!provider()) return { isRaid: null, confidence: 0, reason: "AI chưa cấu hình", offline: true };
  const system = `Bạn là chuyên gia an ninh Discord chuyên điều tra RAID bằng ỨNG DỤNG NGOÀI (external app / integration).

"External app raid" là kỹ thuật tấn công server dùng ứng dụng Discord thay vì bot thành viên:
- Kẻ tấn công tạo hàng loạt tài khoản mới (sockpuppet), mỗi acc CÀI/KẾT NỐI cùng một app vào server trong khoảng thời gian ngắn (thường < 1 phút).
- App sau khi kết nối thường spam @everyone/@here, gửi link lừa đảo hoặc link mời, tạo webhook để tràn tin, tự cấp role hoặc ban thành viên, đổi cấu hình server, rồi xóa dấu vết.
- App thường được đặt tên giả mạo app quen thuộc (MEE6, Dyno, Carl-bot, ProBot, Wumpus...) kèm từ phụ (pro/premium/verify/free/hack/beta) hoặc tên mời gọi scam (Free Nitro, Giveaway, Boost, Verify, Crypto, Airdrop, Claim) để lừa chủ server cài.

PHÂN TÍCH hồ sơ kết nối app / tin nhắn app vừa xảy ra và xác định NGƯỜI DÙNG app có đang RAID không:
- isRaid=true (tấn công phối hợp):
  1) Nhiều tài khoản (đặc biệt mới tạo, nghi sockpuppet) cùng lúc kết nối app — cùng app hoặc loạt app giống nhau.
  2) App lạ xuất hiện ồ ạt; tên app giả mạo app nổi tiếng hoặc chứa từ khóa scam (nitro, giveaway, boost, free, claim, reward, crypto, airdrop, verify).
  3) Làn sóng thành viên mới vào server ngay trước/trong lúc kết nối app (raid chuẩn bị hoặc đang diễn ra).
  4) App gửi tin spam: lặp nội dung giống hệt hoặc gần giống (đổi số/emoji/URL mỗi tin để né filter), @everyone/@here, link mời Discord, link rút gọn (bit.ly, t.me, tinyurl, rb.gy...), từ khóa quà tặng/lừa đảo, hoặc tràn nhiều URL khác nhau.
  5) App tạo webhook để spam rồi xóa webhook ngay (xóa dấu vết).
- isRaid=false: chỉ một vài người dùng/ứng dụng bình thường kết nối (vd mod thử app mới, app quen thuộc) hoặc app gửi tin hoạt động hợp lệ (nhạc, leveling, thông báo — không có tín hiệu spam ở trên).
- Trả null nếu chưa đủ thông tin để kết luận.
Chỉ trả lời JSON thuần (không markdown): {"isRaid": true|false|null, "confidence": 0-1, "reason": "ngắn gọn tiếng Việt"}`;
  const user = `Vụ: ${count} kết nối app ngoài trong ${windowSeconds}s (ngưỡng ${threshold}). Thành viên server: ${memberCount ?? "?"}. Thành viên mới gần đây: ${recentJoins ?? 0}.
Hồ sơ kết nối / tin nhắn app:
${appProfile || "(không có)"}`;
  const raw = await chat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { maxTokens: 250 },
  );
  const parsed = extractJson(raw);
  if (!parsed || (typeof parsed.isRaid !== "boolean" && parsed.isRaid !== null)) {
    return { isRaid: null, confidence: 0, reason: "AI trả về không hợp lệ", offline: true };
  }
  return {
    isRaid: parsed.isRaid,
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
    reason: String(parsed.reason || "").slice(0, 300),
    offline: false,
  };
}

module.exports = { aiAvailable, classifyViolation, analyzeRaid, analyzeExternalApp };
