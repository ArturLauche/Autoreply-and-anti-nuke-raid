/**
 * research.js — Threat Intel: hệ thống bot TỰ NGHIÊN CỨU + HỌC HỎI về raid/nuke/scam
 * từ nguồn mở trên internet. Chạy TRÊN VPS (không tốn operations Convex) và chỉ
 * dùng AI CỰC KỲ TIẾT KIỆM (mục tiêu < 20k tokens/tháng ≈ gần như 0 với Groq free).
 *
 * ============================================================
 * PHÂN BỔ TOKEN / LƯỢT TRA (thiết kế "tốn vừa đủ"):
 * ------------------------------------------------------------
 * 1. TẢI NGUỒN MỞ (6 lần/ngày, mỗi 4 giờ):
 *    - RSS/JSON công khai MIỄN PHÍ (Reddit JSON API, CISA KEV JSON).
 *    - Heuristics cục bộ trích từ khóa scam — KHÔNG tốn token AI.
 *    - Bot tự so sánh: chỉ giữ từ khóa mới chưa có trong intel cũ.
 * 2. AI TỔNG HỢP (CHỈ khi cần, giới hạn cứng):
 *    - Mỗi TUẦN tối đa 1 lượt AI bắt buộc (4.096 tokens max_tokens).
 *    - Lượt còn lại trong tuần: CHỈ dùng AI nếu lượt trước phát hiện ≥ 8 từ
 *      khóa mới (tín hiệu có chuyện lớn, đáng "tốn" 1 lần gọi).
 *    - AI không cấu hình / gọi lỗi → vẫn lưu từ khóa heuristic (không mất dữ liệu).
 * 3. AMBIENT LEARNING (0 token):
 *    - Mỗi vụ raid thật đã có AI phân loại (classifyViolation đã chạy sẵn khi
 *      sự kiện xảy ra) → từ khóa scam được khai thác từ raidSamples không tốn
 *      thêm token nào.
 * 4. SỬ DỤNG INTEL (0 token vĩnh viễn):
 *    - Từ khóa học được hợp nhất thành wildcard → anti-nuke + filters dùng
 *      trực tiếp trên VPS, không gọi AI, không tốn Convex operations.
 * ============================================================
 */

const RESEARCH_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 giờ — 6 lần/ngày
const AI_WEEKLY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // AI bắt buộc mỗi 7 ngày
const FETCH_TIMEOUT_MS = 15_000;
const MAX_KEYWORDS_PER_RUN = 20;
const NEW_KEYWORD_AI_THRESHOLD = 8; // chỉ AI nếu heuristic tìm được ≥ 8 từ mới

/** Từ khóa nhiễu: xuất hiện mọi nơi, không phải tín hiệu scam → loại bỏ. */
const NOISE_WORDS = new Set([
  "free", "gift", "giveaway", "discord", "server", "community", "game", "games",
  "gaming", "nitro", "bot", "bots", "help", "support", "new", "best", "top",
  "online", "join", "chat", "voice", "music", "fun", "cool", "update", "official",
  "premium", "boost", "boosting", "member", "members", "channel", "channels",
  "crypto", "bitcoin", "btc", "nft", "airdrop", "claim", "reward", "rewards",
  "winner", "prize", "earn", "money", "cash", "click", "link", "website", "com",
]);

/** Câu hỏi/tiêu đề Reddit không phải threat → bỏ qua. */
const NOISE_PATTERNS = [
  /how (do|to|can) i/i, /what (is|are|does)/i, /why (is|does|do)/i,
  /best (bot|server)/i, /\?$/, /^help/i, /suggestion/i, /idea/i,
];

/** Nguồn mở MIỄN PHÍ (không cần key, không tốn token). */
const OPEN_SOURCES = [
  {
    name: "reddit-modsupport",
    url: "https://www.reddit.com/r/ModSupport/top.json?t=week&limit=25",
    kind: "reddit",
  },
  {
    name: "reddit-discordbots",
    url: "https://www.reddit.com/r/Discord_Bots/top.json?t=week&limit=25",
    kind: "reddit",
  },
  {
    name: "reddit-cyber",
    url: "https://www.reddit.com/r/cybersecurity/top.json?t=week&limit=25",
    kind: "reddit",
  },
  {
    name: "reddit-scams",
    url: "https://www.reddit.com/r/Scams/top.json?t=week&limit=25",
    kind: "reddit",
  },
  {
    name: "cisa-kev",
    url: "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
    kind: "cisa",
  },
];

async function fetchText(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "ProtogonBot/1.0 (threat-research; discord bot)",
        Accept: "application/json,text/*;q=0.9",
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Trích từ khóa scam tiềm năng từ một đoạn text (deterministic, không AI). */
function extractKeywords(text, maxPerSource = 10) {
  if (!text) return [];
  const words = String(text)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const found = [];
  const seen = new Set();
  for (const w of words) {
    const clean = w.replace(/^['-]+|['-]+$/g, "");
    if (clean.length < 5 || clean.length > 20) continue;
    if (NOISE_WORDS.has(clean)) continue;
    if (seen.has(clean)) continue;
    if (NOISE_PATTERNS.some((re) => re.test(clean))) continue;
    // Từ đáng chú ý: chứa số + chữ (vd "v0lt", "gen2"), hoặc hyphen (compound), hoặc không có trong từ điển tiếng Anh thông thường.
    const suspicious =
      /\d/.test(clean) ||
      /-/.test(clean) ||
      clean.length >= 8;
    if (!suspicious) continue;
    seen.add(clean);
    found.push(clean);
    if (found.length >= maxPerSource) break;
  }
  return found;
}

/** Tải + trích từ khóa từ 1 nguồn Reddit (JSON công khai). */
async function researchReddit(source) {
  const raw = await fetchText(source.url);
  if (!raw) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const posts = data?.data?.children ?? [];
  const keywords = [];
  const phrases = [];
  for (const c of posts) {
    const post = c?.data ?? {};
    const title = String(post.title || "");
    if (NOISE_PATTERNS.some((re) => re.test(title))) continue;
    // Tiêu đề chứa tín hiệu scam/raid → trích từ khóa + cụm từ nguyên khối.
    if (/(scam|raid|nuke|hack|compromis|phish|malware|token|webhook|bot.?net|spam|fake|imperson)/i.test(title)) {
      phrases.push(title.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80));
      keywords.push(...extractKeywords(title, 6));
      const body = String(post.selftext || "").slice(0, 1500);
      keywords.push(...extractKeywords(body, 4));
    }
  }
  return { keywords, phrases };
}

/** Tải CISA KEV — các lỗ hổng đang bị khai thác thực tế (10 CVE mới nhất). */
async function researchCisa(source) {
  const raw = await fetchText(source.url, 20_000);
  if (!raw) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const vulns = (data?.vulnerabilities ?? [])
    .slice(-20)
    .map((v) => ({
      cve: v?.cveID ?? "",
      kw: extractKeywords(`${v?.vendorProject ?? ""} ${v?.product ?? ""} ${v?.shortDescription ?? ""}`, 5),
    }))
    .filter((v) => v.cve);
  return {
    keywords: vulns.flatMap((v) => v.kw),
    phrases: vulns.slice(0, 10).map((v) => v.cve.toLowerCase()),
    cves: vulns.map((v) => v.cve),
  };
}

/**
 * Gọi AI tổng hợp — chỉ khi đáng "tốn". Trả về { keywords, phrases, summary } hoặc null.
 * Dùng bot/src/ai.js provider chain (Groq trước — free 30 RPM).
 */
async function aiSynthesize(researchText, previousKeywords) {
  try {
    const aiClient = require("./ai");
    if (!aiClient.aiAvailable()) return null;
    const system = `Bạn là chuyên gia threat-intelligence về an ninh Discord. Bạn nhận dữ liệu thô từ nguồn mở (Reddit security subs, CISA KEV). NHIỆM VỤ: phát hiện TỪ KHÓA scam/raid/nuke MỚI, xu hướng tấn công Discord đang nổi.
Chỉ trả JSON thuần (không markdown): {"keywords": ["từ khóa scam mới", ...], "phrases": ["cụm từ scam nhiều từ", ...], "summary": "tóm tắt 2-3 câu tiếng Việt về xu hướng đe dọa mới nhất"}. Tối đa 15 keywords, 8 phrases. Bỏ từ quá phổ biến (discord, server, free...).`;
    const user = `Dữ liệu thô từ nguồn mở (trích đoạn):\n${researchText.slice(0, 3500)}\n\nTừ khóa bot đã biết (tránh trùng):\n${previousKeywords.slice(0, 40).join(", ")}`;
    const raw = await aiClient.chatForResearch(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { maxTokens: 700, temperature: 0.2 },
    );
    if (!raw) return null;
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]);
    return {
      keywords: (parsed.keywords ?? []).slice(0, 15).map((s) => String(s).slice(0, 60)),
      phrases: (parsed.phrases ?? []).slice(0, 8).map((s) => String(s).slice(0, 80)),
      summary: String(parsed.summary ?? "").slice(0, 700),
    };
  } catch {
    return null;
  }
}

/**
 * AMBIENT LEARNING — khai thác từ khóa từ các vụ raid THẬT bot đã xử lý (0 token:
 * AI classify đã chạy sẵn khi có sự kiện, giờ chỉ đọc kết quả từ Convex).
 */
async function learnFromIncidents(store) {
  try {
    const samples = await store.client.query("antinuke:recentRaidSamples", { limit: 60 });
    const keywords = [];
    const seen = new Set();
    for (const s of samples ?? []) {
      const reason = String(s.aiReason || s.action || "").toLowerCase();
      for (const kw of extractKeywords(reason, 5)) {
        if (!seen.has(kw)) {
          seen.add(kw);
          keywords.push(kw);
        }
      }
    }
    return keywords.slice(0, 15);
  } catch {
    return [];
  }
}

/**
 * Một lượt nghiên cứu: tải nguồn mở → trích từ khóa heuristic → (đôi khi) AI tổng hợp
 * → hợp nhất với intel cũ → lưu Convex + trả kết quả.
 */
async function runResearch(store) {
  const intel = await store.client.query("threatIntel:botGetIntel", {}).catch(() => null);
  const previousKeywords = intel?.keywords ?? [];
  const now = Date.now();

  const sourcesUsed = [];
  let allKeywords = [];
  let allPhrases = [];
  let cveList = [];

  // 1. Tải + trích heuristic (0 token)
  for (const source of OPEN_SOURCES) {
    try {
      let res = null;
      if (source.kind === "reddit") res = await researchReddit(source);
      else if (source.kind === "cisa") res = await researchCisa(source);
      if (!res) continue;
      sourcesUsed.push(source.name);
      allKeywords.push(...(res.keywords ?? []));
      allPhrases.push(...(res.phrases ?? []));
      if (res.cves) cveList.push(...res.cves);
    } catch {
      // nguồn lỗi — bỏ qua, không làm fail toàn bộ lượt
    }
  }

  // 2. Ambient learning từ raid thật (0 token)
  const incidentKeywords = await learnFromIncidents(store);
  if (incidentKeywords.length) {
    allKeywords.push(...incidentKeywords);
    if (!sourcesUsed.includes("raid-incidents")) sourcesUsed.push("raid-incidents");
  }

  // 3. Lọc trùng với intel cũ + loại noise → chỉ giữ từ MỚI
  const oldSet = new Set(previousKeywords.map((k) => k.toLowerCase()));
  const newKeywords = [];
  const seen = new Set();
  for (const kw of allKeywords) {
    const k = kw.toLowerCase();
    if (oldSet.has(k) || seen.has(k)) continue;
    seen.add(k);
    newKeywords.push(kw);
  }
  const newPhrases = [];
  const seenPh = new Set();
  for (const ph of allPhrases) {
    const k = ph.toLowerCase();
    if (seenPh.has(k)) continue;
    seenPh.add(k);
    newPhrases.push(ph);
  }

  // 4. AI tổng hợp — GIỚI HẠN NGHIÊM NGẶT (tiết kiệm token)
  let aiUsed = false;
  let summary = null;
  if (intel?.aiWeeklyEnabled !== false) {
    const lastRun = intel?.lastRunAt ?? 0;
    const weekElapsed = now - lastRun >= AI_WEEKLY_INTERVAL_MS;
    const richFindings = newKeywords.length >= NEW_KEYWORD_AI_THRESHOLD;
    if ((weekElapsed || richFindings) && (newKeywords.length > 0 || cveList.length > 0)) {
      const researchText = [
        `CVE đang bị khai thác: ${cveList.slice(0, 10).join(", ")}`,
        `Cụm từ từ cộng đồng: ${newPhrases.slice(0, 15).join(" | ")}`,
        `Từ khóa nghi vấn: ${newKeywords.slice(0, 30).join(", ")}`,
      ].join("\n");
      const ai = await aiSynthesize(researchText, previousKeywords);
      if (ai) {
        aiUsed = true;
        summary = ai.summary;
        // Hợp nhất từ khóa AI (chưa có) vào danh sách mới
        const aiNew = ai.keywords.filter((k) => !oldSet.has(k.toLowerCase()) && !seen.has(k.toLowerCase()));
        newKeywords.push(...aiNew.slice(0, 10));
        const phSet = new Set(newPhrases.map((p) => p.toLowerCase()));
        newPhrases.push(...ai.phrases.filter((p) => !phSet.has(p.toLowerCase())).slice(0, 5));
      }
    }
  }

  // 5. Lưu Convex (chỉ khi có gì đó mới)
  const hasNew = newKeywords.length > 0 || newPhrases.length > 0 || aiUsed;
  if (hasNew || sourcesUsed.length > 0) {
    await store.client
      .mutation("threatIntel:botSetResearchRun", {
        sources: sourcesUsed,
        keywords: newKeywords.slice(0, MAX_KEYWORDS_PER_RUN),
        scamPhrases: newPhrases.slice(0, 10),
        summary: summary ?? undefined,
        aiUsed,
        nextRunAt: now + RESEARCH_INTERVAL_MS,
        learnedFromIncidents: incidentKeywords.length,
      })
      .catch(() => null);
  }

  return {
    sources: sourcesUsed,
    newKeywords: newKeywords.length,
    newPhrases: newPhrases.length,
    aiUsed,
    summary,
  };
}

/**
 * Vòng lặp nghiên cứu — mỗi 4 giờ, chỉ khi research bật (threatIntel settings).
 * setupResearch được gọi TỪ trong handler clientReady (bot đã online rồi) nên
 * KHÔNG đợi thêm event nào nữa — đợi thêm sẽ khiến vòng lặp không bao giờ chạy.
 * Chạy 1 lượt đầu sau 5 phút (đợi Convex ổn định), sau đó lặp mỗi 4 giờ.
 */
function setupResearch(client, store) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const intel = await store.client.query("threatIntel:botGetIntel", {}).catch(() => null);
      if (!intel?.researchEnabled) {
        // Bị tắt trên web → không tốn bất kỳ chi phí nào.
        return;
      }
      const now = Date.now();
      const nextRun = intel?.nextRunAt ?? 0;
      if (nextRun > now) return; // chưa đến hạn
      const res = await runResearch(store);
      console.log(
        `[research] sources=${res.sources.length} newKw=${res.newKeywords} newPhrases=${res.newPhrases} ai=${res.aiUsed}`,
      );
    } catch (e) {
      console.error("[research]", e?.message || e);
    } finally {
      running = false;
    }
  };

  setTimeout(() => tick().catch(() => {}), 5 * 60 * 1000).unref?.();
  const interval = setInterval(() => tick().catch(() => {}), RESEARCH_INTERVAL_MS);
  interval.unref?.();
}

module.exports = { setupResearch, runResearch };
