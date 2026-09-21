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
 *   NVIDIA_API_KEY    — NVIDIA NIM (free 40 RPM / 4M TPM): build.nvidia.com
 *   DEEPSEEK_NIM_KEY  — key NIM riêng cho model DeepSeek (nếu muốn dùng model khác)
 *   KIRA_API_KEY      — Kira AI (kiraai.vn) free 30M tokens/ngày trên model Mimo V2.5
 *                       → ƯU TIÊN CHO RESEARCH/HỌC HỎI (chatForResearch dùng trước,
 *                       không ăn hạn mức Groq/NVIDIA giữ cho chống raid realtime).
 *   KIRA_BASE_URL     — (tùy chọn) mặc định https://kiraai.vn/api/v1
 *   KIRA_MODEL        — (tùy chọn) mặc định "mimo-v2.5" (bản "-free" đã biến mất
 *                       khỏi danh sách model live của Kira — kiểm 20/09/2026)
 *   KIRA_USE_PROXY    — (tùy chọn) "1" = đi qua proxy retry local 127.0.0.1:8787
 *                       (scripts/kiira-retry-proxy.mjs) để hưởng retry/backoff/
 *                       breaker thay vì gọi thẳng kiraai.vn. Mặc định tắt.
 *   KIRA_PROXY_PORT   — (tùy chọn) cổng proxy khi KIRA_USE_PROXY=1 (mặc định 8787)
 *   AI_BASE_URL       — (tùy chọn) gateway tương thích OpenAI khác
 *   AI_API_KEY        — (tùy chọn) key cho gateway trên
 *   AI_MODEL          — (tùy chọn) mặc định "openai/gpt-oss-120b" (Groq khuyến nghị
 *                       thay llama-3.3-70b-versatile đã bị retire 08/2026)
 *   OPENAI_API_KEY    — (tùy chọn) fallback trả phí
 *
 * KHÔNG có key nào → mọi hàm trả { offline: true } và bot chạy theo điểm nghi
 * vấn deterministic (đúng hành vi cũ khi AI chưa cấu hình).
 *
 * FALLBACK: provider đầu tiên lỗi (4xx/5xx, timeout, mạng) → thử provider kế
 * tiếp trong cùng một lượt gọi, với timeout riêng ngắn hơn. Key NIM nào xuất
 * hiện trước trong env sẽ được xếp trước.
 * TỰ VÁ MODEL: gateway trả 400/404 (model chết/bị retire — đã xảy ra với
 * llama-3.3-70b-versatile 08/2026) → thử lại ĐÚNG 1 lần với FALLBACK_MODEL
 * trước khi chuyển provider (giống self-heal của convex/haimiya.ts).
 */

/** Model thay thế Groq khuyến nghị — còn được phục vụ (xác minh 20/09/2026). */
const DEFAULT_MODEL = "openai/gpt-oss-120b";
/** Model dự phòng khi model cấu hình chết (400/404) — thử lại đúng 1 lần. */
const FALLBACK_MODEL = "openai/gpt-oss-120b";
const DEEPSEEK_NIM_MODEL = "deepseek-ai/deepseek-v4-pro-0813";
const NIM_BASE_URL = "https://integrate.api.nvidia.com/v1";
/** Kira AI (kiraai.vn) — free 30M tokens/ngày, dùng riêng cho research/học hỏi. */
const KIRA_BASE_URL = "https://kiraai.vn/api/v1";
const KIRA_DEFAULT_MODEL = "mimo-v2.5";
const TIMEOUT_MS = 12_000;
/** Thời gian trừ đi mỗi lần chuyển provider (provider sau có ít thời gian hơn). */
const FALLBACK_BUDGET_MS = 2_000;
/**
 * Deadline cho 3 hàm phân tích chống raid. Tầng gọi (antinuke/ai.js) race với
 * setTimeout 6s — trước đây deadline chain 12s > 6s nên timeout thật bị cắt
 * ở 6s nhưng provider đầu vẫn có thể chiếm trọn 6s rồi fallback không bao giờ
 * kịp chạy → sát suất mất kết quả. Đồng bộ 6.5s (hơi trên race) để provider
 * đầu fail nhanh thì fallback vẫn có dư địa trong cùng lượt gọi.
 */
const CLASSIFY_TIMEOUT_MS = 6_500;

/**
 * Danh sách provider theo thứ tự ưu tiên. Được tính 1 lần khi module load —
 * key không đổi trong lúc chạy. Provider vẫn trả model theo env override nếu có.
 */
function providerChain() {
  const chain = [];
  const add = (p) => {
    if (p && p.key && p.baseUrl) chain.push(p);
  };

  // 1. Gateway tùy chỉnh (AI_API_KEY + AI_BASE_URL — kiosapi hoặc gateway khác)
  const customKey = process.env.AI_API_KEY;
  const customBase = process.env.AI_BASE_URL;
  if (customKey && customBase) {
    add({
      key: customKey,
      baseUrl: customBase.replace(/\/+$/, ""),
      model: process.env.AI_MODEL || DEFAULT_MODEL,
      label: "custom-gateway",
    });
  }

  // 2. Groq free trực tiếp
  const groq = process.env.GROQ_API_KEY;
  if (groq) {
    add({
      key: groq,
      baseUrl: "https://api.groq.com/openai/v1",
      model: process.env.AI_MODEL || DEFAULT_MODEL,
      label: "groq",
    });
  }

  // 3. NVIDIA NIM — DeepSeek V4 Pro (model mạnh, key NIM riêng)
  const deepseekNim = process.env.DEEPSEEK_NIM_KEY;
  if (deepseekNim) {
    add({
      key: deepseekNim,
      baseUrl: NIM_BASE_URL,
      model: process.env.DEEPSEEK_NIM_MODEL || DEEPSEEK_NIM_MODEL,
      label: "nvidia-nim-deepseek",
      /** Model DeepSeek có thể "suy nghĩ" lâu hơn — cho phép timeout rộng hơn. */
      extraBody: { chat_template_kwargs: { thinking: false } },
    });
  }

  // 4. NVIDIA NIM — model khác (mistral-nemotron mặc định, key NIM chung)
  const nvidia = process.env.NVIDIA_API_KEY;
  if (nvidia) {
    add({
      key: nvidia,
      baseUrl: NIM_BASE_URL,
      model: process.env.NVIDIA_MODEL || "mistralai/mistral-nemotron",
      label: "nvidia-nim",
    });
  }

  // 5. SambaNova free
  const samba = process.env.SAMBANOVA_API_KEY;
  if (samba) {
    add({
      key: samba,
      baseUrl: "https://api.sambanova.ai/v1",
      model: "Meta-Llama-3.3-70B-Instruct",
      label: "sambanova",
    });
  }

  // 6. Kira AI free (kiraai.vn) — 30M tokens/ngày trên Mimo V2.5. Không dùng
  // cho chat chống raid (giữ hạn mức cho research) nhưng vẫn là fallback hợp lệ
  // nếu mọi provider phía trên chết.
  const kira = process.env.KIRA_API_KEY;
  if (kira) {
    add({
      key: kira,
      baseUrl: kiraBaseUrl(),
      model: process.env.KIRA_MODEL || KIRA_DEFAULT_MODEL,
      label: "kira-mimo",
    });
  }

  // 7. OpenAI (trả phí)
  const openai = process.env.OPENAI_API_KEY;
  if (openai) {
    add({
      key: openai,
      baseUrl: "https://api.openai.com/v1",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      label: "openai",
    });
  }

  return chain;
}

/** Báo AI online hay không (để UI/log hiển thị đúng nguồn phát hiện). */
function aiAvailable() {
  return providerChain().length > 0;
}

/**
 * Gọi chat completions QUA CẢ CHUỖI provider: provider đầu lỗi → thử kế tiếp.
 * Dùng deadline tổng (12s): provider trước để dành FALLBACK_BUDGET_MS cho lần
 * thử kế tiếp; nếu provider đầu fail nhanh (429/mạng) thì provider sau nhận
 * gần như toàn bộ thời gian. Trả về chuỗi nội dung hoặc null. Không throw.
 */
async function chat(messages, { maxTokens = 250, temperature = 0.2, timeoutMs = TIMEOUT_MS } = {}) {
  const chain = providerChain();
  if (chain.length === 0) return null;

  const deadline = Date.now() + timeoutMs;
  for (let i = 0; i < chain.length; i++) {
    const isLast = i === chain.length - 1;
    const left = deadline - Date.now();
    if (left <= 0) break;
    const reserve = isLast ? 0 : FALLBACK_BUDGET_MS;
    const slice = Math.max(3_000, left - reserve);
    const res = await chatOne(chain[i], messages, { maxTokens, temperature, timeoutMs: slice });
    if (res !== null) return res;
  }
  return null;
}

/** Một lần gọi tới 1 provider — trả content hoặc null, không throw.
 * TỰ VÁ MODEL: gateway trả 400/404 (model chết/bị retire) → thử lại đúng 1 lần
 * với FALLBACK_MODEL trong cùng lượt (không tốn lượt provider kế tiếp). */
async function chatOne(p, messages, { maxTokens, temperature, timeoutMs }) {
  const models = p.model === FALLBACK_MODEL ? [p.model] : [p.model, FALLBACK_MODEL];
  for (const model of models) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const body = {
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        ...(p.extraBody || {}),
      };
      const res = await fetch(`${p.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        // Model chết (400/404) mà còn model dự phòng chưa thử → thử tiếp vòng sau.
        // Lỗi khác (401/429/5xx/mạng) → bỏ provider này ngay, sang provider kế.
        if ((res.status === 400 || res.status === 404) && model !== FALLBACK_MODEL) continue;
        return null;
      }
      const data = await res.json();
      return data?.choices?.[0]?.message?.content?.trim() ?? null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/** Trích JSON object đầu tiên trong chuỗi trả lời của model.
 * CỨNG HOÁ: model hay trả JSON bọc ```json ... ``` (dù prompt cấm) hoặc để dấu
 * phẩy thừa trước `}` / `]` — cả hai từng khiến parse vỡ → "AI trả về không
 * hợp lệ" → rơi về fallback individual/conf 0.5 dù model đã phân tích đúng.
 * Lần lượt: parse thẳng → gỡ code fence → sửa phẩy thừa → chọn khối {...}
 * ngoại vi đầu tiên (raw chứa nhiều khối, ví dụ JSON + giải thích).
 */
function extractJson(raw) {
  if (!raw) return null;
  const candidates = [];
  const trimmed = String(raw).trim();
  candidates.push(trimmed);
  // 1. Gỡ code fence ```json ... ``` / ``` ... ```
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidates.push(fence[1].trim());
  // 2. Khối {...} ngoại vi đầu tiên (thay vì regex tham lam bắt cả lời bình)
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(trimmed.slice(first, last + 1));
  for (let c of candidates) {
    // 3. Dấu phẩy thừa trước } hoặc ] — lỗi parse phổ biến nhất của model nhỏ
    const fixed = c.replace(/,\s*([}\]])/g, "$1");
    for (const attempt of new Set([fixed, c])) {
      try {
        const parsed = JSON.parse(attempt);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
      } catch {
        // thử phương án kế
      }
    }
  }
  return null;
}

/** Ghép bằng chứng deterministic (tín hiệu engine) thành phần prompt.
 * Nhận mảng chuỗi đã chuẩn hoá; trả về rỗng khi không có gì — prompt khi đó
 * không nhắc tới mục "BẰNG CHỨNG" để model không trông đợi dữ liệu không tồn tại.
 */
function evidenceBlock(evidence) {
  const list = (evidence || [])
    .filter(Boolean)
    .map((e) => String(e).slice(0, 220))
    .slice(0, 8);
  if (list.length === 0) return "";
  return `BẰNG CHỨNG ENGINE (tính bằng code deterministic — TIN CẬY CAO, ưu tiên đối chiếu):
${list.map((e, i) => `${i + 1}. ${e}`).join("\n")}
`;
}

/**
 * Phân loại sự kiện vi phạm: raid / individual / benign.
 * Trả { classification, confidence, reason, suggestPunish, offline }.
 * knownThreats (tùy chọn): { keywords: [], phrases: [] } — mẫu scam mạng đã
 * được xác nhận, bot tự học từ các vụ raid thật (raidSamples → threat intel).
 * Truyền vào để AI đối chiếu, thay vì đoán chay.
 * evidence (tùy chọn): mảng tín hiệu engine đã tính bằng code — trùng lặp nội
 * dung, link rút gọn/@everyone trong mẫu, tuổi acc trung bình… Model suy luận
 * trên dữ liệu thật thay vì đoán chay → chính xác + nhất quán hơn.
 */
async function classifyViolation({
  module,
  count,
  windowSeconds,
  threshold,
  sampleMessages = [],
  recentJoins,
  memberCount,
  knownThreats = null,
  evidence = [],
}) {
  if (!aiAvailable())
    return {
      classification: "individual",
      confidence: 0.5,
      reason: "AI chưa cấu hình",
      offline: true,
    };
  const samples = (sampleMessages || []).slice(0, 6).map((s) => String(s).slice(0, 200));
  const learned = [];
  for (const k of (knownThreats?.keywords || []).slice(0, 12)) {
    if (k) learned.push(`từ khóa: ${String(k).slice(0, 40)}`);
  }
  for (const p of (knownThreats?.phrases || []).slice(0, 8)) {
    if (p) learned.push(`cụm: "${String(p).slice(0, 60)}"`);
  }
  const system = `Bạn là chuyên gia an ninh Discord. Phân loại một sự kiện vi phạm vừa xảy ra.
QUY TRÌNH suy luận (làm theo thứ tự, KHÔNG nhảy cóc tới kết luận):
1. Đọc BẰNG CHỨNG ENGINE (nếu có) — đây là tín hiệu tính bằng code, không phải phán đoán: đối chiếu từng mục với 3 lớp phân loại dưới đây.
2. Xét 3 lớp: raid cần ≥2 tín hiệu độc lập; individual chỉ 1 người; benign là dương tính giả — phải loại trừ benign TRƯỚC khi tính điểm raid (checklist benign bên dưới).
3. Chấm độ tin cậy đúng thang: ≥0.8 khi ≥2 tín hiệu độc lập; 0.5-0.7 khi 1 tín hiệu; <0.5 khi phải đoán.
QUY TẮC PHÂN LOẠI (đọc kỹ trước khi kết luận):
- "raid": tấn công CÓ TỔ CHỨC — cần ÍT NHẤT 2 tín hiệu độc lập: (a) nhiều tài khoản cùng lúc (đặc biệt acc mới/default avatar/tên dạng máy), (b) nội dung lặp lại giống hệt hoặc gần giống, (c) tin cực dài/giả blank gây nhiễu, (d) @everyone/@here + link lạ, (e) kết hợp làn sóng thành viên mới vào.
- "individual": CHỈ 1 người vi phạm (spam nhanh vài tin, nói tục, caps) — không có tín hiệu (a)-(e) đi kèm.
- "benign": DƯƠNG TÍNH GIẢ — kiểm tra checklist này TRƯỚC khi phạt: chat giveaway/event bình thường của server; bạn bè rủ nhau spam sticker/emoji; bot hợp pháp (nhạc, log, leveling) nhắn tin hệ thống; người dùng trích dẫn/lặp tin để thảo luận. Không có link lạ + không có làn sóng acc mới = benign.
VÍ DỤ:
- 8 tin "@everyone FREE NITRO discord-gift.ru" giống hệt từ 3 acc mới → {"classification":"raid","confidence":0.9}
- 1 người gửi 7 tin "haha" liên tiếp, acc 2 năm → {"classification":"individual","confidence":0.85}
- 5 người cùng spam sticker chào mừng tân binh → {"classification":"benign","confidence":0.8}
Chỉ trả lời JSON thuần (không markdown, không code fence, đúng key): {"classification": "raid|individual|benign", "confidence": 0-1, "reason": "ngắn gọn tiếng Việt", "suggestPunish": "warn|timeout|kick|ban|null"}`;
  const user = `Sự kiện: module "${module}" — ${count} lần trong ${windowSeconds}s (ngưỡng ${threshold}).
Thành viên mới gần đây: ${recentJoins ?? 0}. Thành viên server: ${memberCount ?? "?"}.
${evidenceBlock(evidence)}${
    learned.length
      ? `\nMẫu scam mạng ĐÃ XÁC NHẬN (bot tự học từ các vụ raid thật — khớp mẫu này là tín hiệu raid mạnh):\n- ${learned.join("\n- ")}`
      : ""
  }
Mẫu tin nhắn:
${samples.length ? samples.map((s, i) => `${i + 1}. ${s}`).join("\n") : "(không có)"}`;
  const raw = await chat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { maxTokens: 280, timeoutMs: CLASSIFY_TIMEOUT_MS },
  );
  const parsed = extractJson(raw);
  if (!parsed || !["raid", "individual", "benign"].includes(parsed.classification)) {
    return {
      classification: "individual",
      confidence: 0.5,
      reason: "AI trả về không hợp lệ",
      offline: true,
    };
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
 * evidence: bằng chứng engine (tuổi acc, nhịp vào, điểm nghi phạm…) — model
 * đối chiếu dữ liệu thật thay vì đoán chay từ mô tả trừu tượng.
 */
async function analyzeRaid({
  module,
  count,
  windowSeconds,
  threshold,
  clusterProfile,
  recentActions,
  evidence = [],
}) {
  if (!aiAvailable())
    return {
      coordinated: null,
      confidence: 0,
      reasoning: "AI chưa cấu hình",
      sourceHint: null,
      offline: true,
    };
  const system = `Bạn là chuyên gia an ninh Discord chuyên điều tra RAID/NUKE.
QUY TẮC KẾT LUẬN (đọc kỹ — sai ở đây là ban oan cả server):
- "coordinated": true — CHỈ khi có ÍT NHẤT 2 bằng chứng PHỐI HỢP độc lập trong dữ liệu: (a) nhiều acc mới lập (<7 ngày) cùng lúc, (b) avatar mặc định/trùng nhau hàng loạt, (c) username dạng máy (chữ + đuôi số) hoặc giống nhau, (d) vào server cùng nhịp vài giây, (e) có kẻ tạo invite + thực hiện phá hoại (ban/kick/xóa kênh) trong audit log, (f) tin nhắn spam @everyone/link lạ đi kèm.
- "coordinated": false — khi dữ liệu GIẢI THÍCH ĐƯỢC bằng hoạt động thường: bạn bè rủ nhau vào (tên người, có avatar, tuổi acc rải rác), server viral/được quảng bá (làn sóng vào nhưng hồ sơ bình thường), mod đang dọn kênh (audit log là người có quyền), event/giveaway của server.
- Chưa đủ dữ liệu → "coordinated": null (không đoán mò).
- "sourceHint": username kẻ chủ mưu khả dĩ nhất (người tạo invite + có hành vi phá hoại + hồ sơ trùng cụm raid). Trả null nếu chưa đủ tín hiệu — THÀ null còn hơn chỉ bừa.
ĐỘ TIN CẬY: ≥0.8 chỉ khi có ≥2 bằng chứng (a)-(f); 0.5-0.7 khi 1 bằng chứng mạnh; <0.5 khi suy luận gián tiếp.
VÍ DỤ:
- 8 acc 1 ngày tuổi + default avatar + tên user1001..user1008 + cùng vào trong 5s → {"coordinated":true,"confidence":0.9}
- 6 bạn acc 2-3 ngày + có avatar + tên người + vào rải rác + không ai phá hoại → {"coordinated":false,"confidence":0.85}
- Chỉ 2 acc mới, không thêm tín hiệu → {"coordinated":null,"confidence":0.3}
- Chỉ trả lời JSON thuần (không markdown): {"coordinated": true|false|null, "confidence": 0-1, "reasoning": "ngắn gọn tiếng Việt, nêu rõ bằng chứng (a)-(f)", "sourceHint": "username hoặc null"}`;
  const user = `Vụ: module "${module}" — ${count} lần trong ${windowSeconds}s (ngưỡng ${threshold}).
${evidenceBlock(evidence)}Hồ sơ cụm tài khoản:
${clusterProfile || "(không có)"}
Chuỗi hành vi gần đây:
${recentActions || "(không có)"}`;
  const raw = await chat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { maxTokens: 250, timeoutMs: CLASSIFY_TIMEOUT_MS },
  );
  const parsed = extractJson(raw);
  if (!parsed || typeof parsed.coordinated !== "boolean") {
    return {
      coordinated: null,
      confidence: 0,
      reasoning: "AI trả về không hợp lệ",
      sourceHint: null,
      offline: true,
    };
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
 * evidence: bằng chứng engine (tuổi acc, tên app giả mạo, nhịp kết nối…).
 */
async function analyzeExternalApp({
  count,
  windowSeconds,
  threshold,
  appProfile,
  recentJoins,
  memberCount,
  evidence = [],
}) {
  if (!aiAvailable())
    return { isRaid: null, confidence: 0, reason: "AI chưa cấu hình", offline: true };
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
ĐỘ TIN CẬY: ≥0.8 chỉ khi có ≥2 tín hiệu (1)-(5); 0.5-0.7 khi 1 tín hiệu mạnh.
VÍ DỤ:
- 4 acc mới cùng kết nối app "Free Nitro Premium" + spam @everyone link lạ → {"isRaid":true,"confidence":0.9}
- 1 mod kết nối app nhạc quen thuộc, không spam → {"isRaid":false,"confidence":0.85}
Chỉ trả lời JSON thuần (không markdown): {"isRaid": true|false|null, "confidence": 0-1, "reason": "ngắn gọn tiếng Việt"}`;
  const user = `Vụ: ${count} kết nối app ngoài trong ${windowSeconds}s (ngưỡng ${threshold}). Thành viên server: ${memberCount ?? "?"}. Thành viên mới gần đây: ${recentJoins ?? 0}.
${evidenceBlock(evidence)}Hồ sơ kết nối / tin nhắn app:
${appProfile || "(không có)"}`;
  const raw = await chat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { maxTokens: 250, timeoutMs: CLASSIFY_TIMEOUT_MS },
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

module.exports = {
  aiAvailable,
  classifyViolation,
  analyzeRaid,
  analyzeExternalApp,
  chatForResearch,
  researchChat,
  researchAvailable,
};

/**
 * Chat completions công khai — dành cho research.js (threat intel). Trả content
 * hoặc null, dùng chung provider chain + fallback + giới hạn timeout.
 */
async function chatForResearch(messages, opts = {}) {
  return researchChat(messages, opts);
}

/**
 * Base URL cho provider Kira: mặc định gọi thẳng gateway; KIRA_USE_PROXY=1 thì
 * đi qua proxy retry local (127.0.0.1:8787) để hưởng retry/backoff/breaker.
 * Proxy chỉ forward Authorization nên key vẫn là KIRA_API_KEY của bot.
 */
function kiraBaseUrl() {
  if (String(process.env.KIRA_USE_PROXY || "").trim() === "1") {
    const port = Number(process.env.KIRA_PROXY_PORT || 8787);
    return `http://127.0.0.1:${port}`;
  }
  return (process.env.KIRA_BASE_URL || KIRA_BASE_URL).replace(/\/+$/, "");
}

/**
 * Chuỗi provider RIÊNG cho học hỏi/research: Kira AI (Mimo V2.5, free 30M
 * tokens/ngày) đứng TRƯỚC, sau đó mới tới chuỗi chung. Nhờ vậy lượt học không
 * ăn hạn mức Groq/NVIDIA — hạn mức đó dành trọn cho chống raid realtime.
 * Kira không cấu hình → rơi về chuỗi chung (hành vi cũ, không vỡ gì).
 */
function researchChain() {
  const chain = [];
  const kira = process.env.KIRA_API_KEY;
  if (kira) {
    chain.push({
      key: kira,
      baseUrl: kiraBaseUrl(),
      model: process.env.KIRA_MODEL || KIRA_DEFAULT_MODEL,
      label: "kira-mimo",
    });
  }
  chain.push(...providerChain().filter((p) => p.label !== "kira-mimo"));
  return chain;
}

/** Research có sẵn AI nào không (Kira hoặc chuỗi chung). */
function researchAvailable() {
  return researchChain().length > 0;
}

/**
 * Chat completions cho HỌC HỎI — dùng Kira/Mimo trước với hạn mức thoải mái
 * (30M tokens/ngày ⇒ giới hạn cứng cũ “< 20k tokens/tháng” không còn cần thiết).
 * Vẫn giữ timeout + fallback như chuỗi thường để lượt nghiên cứu không bao giờ
 * treo bot. Trả content hoặc null, không throw.
 */
async function researchChat(messages, opts = {}) {
  const chain = researchChain();
  if (chain.length === 0) return null;
  const maxTokens = opts.maxTokens ?? 1_500;
  const temperature = opts.temperature ?? 0.2;
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const deadline = Date.now() + timeoutMs;
  for (let i = 0; i < chain.length; i++) {
    const left = deadline - Date.now();
    if (left <= 0) break;
    const reserve = i === chain.length - 1 ? 0 : FALLBACK_BUDGET_MS;
    const slice = Math.max(3_000, left - reserve);
    const res = await chatOne(chain[i], messages, { maxTokens, temperature, timeoutMs: slice });
    if (res !== null) return res;
  }
  return null;
}
