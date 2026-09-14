/**
 * research.js — Threat Intel: hệ thống bot TỰ NGHIÊN CỨU + HỌC HỎI về raid/nuke/scam
 * từ nguồn mở trên internet. Chạy TRÊN VPS (không tốn operations Convex).
 *
 * ============================================================
 * PHÂN BỔ TOKEN / LƯỢT TRA (cập nhật: có Kira AI free 30M tokens/ngày riêng
 * cho việc học → tổng hợp AI thoải mái hơn, không đụng hạn mức Groq/NVIDIA
 * giữ cho chống raid realtime):
 * ------------------------------------------------------------
 * 1. TẢI NGUỒN MỞ (6 lần/ngày, mỗi 4 giờ):
 *    - RSS/JSON công khai MIỄN PHÍ (Reddit JSON API, CISA KEV JSON).
 *    - Heuristics cục bộ trích từ khóa scam — KHÔNG tốn token AI.
 *    - Bot tự so sánh: chỉ giữ từ khóa mới chưa có trong intel cũ.
 * 2. AI TỔNG HỢP (Mimo V2.5 qua Kira AI — free 30M tokens/ngày):
 *    - MỖI lượt nghiên cứu đều tổng hợp AI khi có dữ liệu mới (≈1-2k tokens/lượt
 *      ⇒ ~6-12k tokens/ngày — chưa tới 0.05% hạn mức). Tuần không có gì mới vẫn
 *      tổng hợp 1 lượt để có tóm tắt xu hướng.
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

/**
 * Chu kỳ research — mặc định 1 GIỜ (24 lượt/ngày, fetch + parse chạy trên VPS:
 * tận dụng CPU nhàn rỗi thay vì idle). Override bằng env RESEARCH_INTERVAL_MS
 * (ms) — vd 7200000 = 2 giờ.
 */
const RESEARCH_INTERVAL_MS = Math.max(30 * 60 * 1000, Number(process.env.RESEARCH_INTERVAL_MS) || 60 * 60 * 1000);
const AI_WEEKLY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // AI bắt buộc mỗi 7 ngày
/** Digest tuần (AI tổng hợp xu hướng đăng kênh log cho admin) — mỗi 7 ngày. */
const DIGEST_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
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
  {
    name: "urlhaus",
    url: "https://urlhaus.abuse.ch/downloads/recent/",
    kind: "urlhaus",
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
 * Tải feed URLhaus qua threatEngine (có cache 30 phút — không fetch trùng với
 * vòng engine 1h) → trích từ khóa từ hostname đáng nghi + malware-family tags.
 */
async function researchUrlhaus() {
  try {
    const engine = require("./threatEngine");
    const ok = await engine.refreshUrlhaus(null);
    if (!ok) return null;
    const hosts = engine.getUrlhausHosts();
    if (!hosts.length) return null;
    // Host đáng nghi: chứa số hoặc gạch nối hoặc dài ≥ 8 (họ domain malware hay vậy).
    const keywords = hosts
      .slice(-400)
      .filter((h) => /\d/.test(h) || /-/.test(h) || h.length >= 12)
      .slice(0, 8);
    return { keywords, phrases: [], cves: [] };
  } catch {
    return null;
  }
}

/**
 * Gọi AI tổng hợp — dùng chuỗi research riêng (Kira/Mimo V2.5 free 30M
 * tokens/ngày đứng trước; không ăn hạn mức Groq/NVIDIA của chống raid).
 * Trả về { keywords, phrases, summary } hoặc null.
 */
async function aiSynthesize(researchText, previousKeywords) {
  try {
    const aiClient = require("./ai");
    if (typeof aiClient.researchAvailable === "function"
      ? !aiClient.researchAvailable()
      : !aiClient.aiAvailable()) return null;
    const system = `Bạn là chuyên gia threat-intelligence về an ninh Discord. Bạn nhận dữ liệu thô từ nguồn mở (Reddit security subs, CISA KEV). NHIỆM VỤ: phát hiện TỪ KHÓA scam/raid/nuke MỚI, xu hướng tấn công Discord đang nổi.
Chỉ trả JSON thuần (không markdown): {"keywords": ["từ khóa scam mới", ...], "phrases": ["cụm từ scam nhiều từ", ...], "summary": "tóm tắt 2-3 câu tiếng Việt về xu hướng đe dọa mới nhất"}. Tối đa 15 keywords, 8 phrases. Bỏ từ quá phổ biến (discord, server, free...).`;
    const user = `Dữ liệu thô từ nguồn mở (trích đoạn):\n${researchText.slice(0, 6000)}\n\nTừ khóa bot đã biết (tránh trùng):\n${previousKeywords.slice(0, 40).join(", ")}`;
    const raw = await (typeof aiClient.researchChat === "function" ? aiClient.researchChat : aiClient.chatForResearch)(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      // 30M tokens/ngày ⇒ cho phép đọc dữ liệu thô nhiều hơn + trả lời dài hơn.
      { maxTokens: 1500, temperature: 0.2 },
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
async function runResearch(store, opts = {}) {
  const intel = await store.client.query("threatIntel:botGetIntel", {}).catch(() => null);
  const previousKeywords = intel?.keywords ?? [];
  const now = Date.now();
  // Client Discord (nếu có) — setupResearch gán vào; dùng cho postDigestToLog.
  const digestClient = runResearch._client ?? null;

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
      else if (source.kind === "urlhaus") res = await researchUrlhaus();
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

  // 4. AI tổng hợp — nới lỏng nhờ Kira free 30M tokens/ngày: mỗi lượt có dữ
  // liệu mới đều tổng hợp; tuần trống vẫn chạy 1 lượt để có tóm tắt xu hướng.
  let aiUsed = false;
  let summary = null;
  if (intel?.aiWeeklyEnabled !== false) {
    const lastRun = intel?.lastRunAt ?? 0;
    const weekElapsed = now - lastRun >= AI_WEEKLY_INTERVAL_MS;
    const richFindings = newKeywords.length >= NEW_KEYWORD_AI_THRESHOLD;
    if ((newKeywords.length > 0 || cveList.length > 0 || weekElapsed || richFindings)) {
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

  // 5. AI REVIEW TỪ KHÓA (khi web Admin yêu cầu cờ): nhờ AI rà lại danh sách
  // từ khóa đang nhớ, chỉ ra từ KHÔNG NÊN dùng (quá phổ biến → ban nhầm).
  // Kết quả chỉ là ĐỀ XUẤT (suspects) — chủ bot xem trên Admin rồi tự xóa.
  try {
    const engine = require("./threatEngine");
    const reviewFlag = await store.client
      .mutation("threatIntel:botClaimAiReview", {})
      .catch(() => null);
    if (reviewFlag) {
      const suspects = await aiReviewKeywords(previousKeywords);
      if (suspects.length > 0) {
        await store.client
          .mutation("threatIntel:botSetKeywordReview", { suspects })
          .catch(() => null);
      }
    }
  } catch {
    // review là tính năng phụ — không làm fail lượt research
  }

  // 6. Digest tuần: AI tổng hợp xu hướng nguy cơ (từ khóa + cụm từ + nguồn)
  // và đăng 1 embed vào kênh log chung — admin nắm tình hình không cần mở web.
  try {
    // Thời điểm digest lưu trong botStatus qua botSetResearchMeta — đọc bằng
    // botGetIntel? Không có trường đó trong botGetIntel → dùng mốc process-wide.
    const digestDue = now - (globalThis.__protogonLastDigest ?? 0) >= DIGEST_INTERVAL_MS;
    if (digestDue && (previousKeywords.length > 0 || newKeywords.length > 0)) {
      const digest = await buildWeeklyDigest([...previousKeywords, ...newKeywords].slice(0, 40), newPhrases.slice(0, 8));
      if (digest) {
        globalThis.__protogonLastDigest = now;
        await store.client
          .mutation("threatIntel:botSetResearchMeta", { digest })
          .catch(() => null);
        // Digest cũng tôn trọng cờ thông báo học tập (mặc định TẮT).
        if (intel?.notifyEnabled === true) {
          await postDigestToLog(digestClient, digest).catch(() => {});
        }
      }
    }
  } catch {
    // digest là tính năng phụ — không làm fail lượt research
  }

  // 7. Lưu Convex (chỉ khi có gì đó mới)
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
        trigger: opts.trigger === "manual" ? "manual" : "auto",
        requestedBy: opts.requestedBy,
      })
      .catch(() => null);
  }

  return {
    sources: sourcesUsed,
    newKeywords: newKeywords.length,
    newPhrases: newPhrases.length,
    aiUsed,
    summary,
    totalKeywords: previousKeywords.length + newKeywords.length,
    // Cờ GỬI THÔNG BÁO học tập (đọc từ intel — chủ bot bật trên Admin).
    notifyEnabled: intel?.notifyEnabled === true,
  };
}

/**
 * Vòng lặp nghiên cứu — mỗi 4 giờ, chỉ khi research bật (threatIntel settings).
 * setupResearch được gọi TỪ trong handler clientReady (bot đã online rồi) nên
 * KHÔNG đợi thêm event nào nữa — đợi thêm sẽ khiến vòng lặp không bao giờ chạy.
 * Chạy 1 lượt đầu sau 5 phút (đợi Convex ổn định), sau đó lặp mỗi 4 giờ.
 */
function setupResearch(client, store) {
  // Lưu client cho postDigestToLog (digest tuần) — runResearch chạy trong tick.
  runResearch._client = client;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    let trigger = null; // "manual" | "auto" — để báo lỗi về đúng ngữ cảnh
    try {
      // HỌC THỦ CÔNG: cờ từ web Admin / lệnh /research learn — nhận + xóa cờ
      // rồi chạy NGAY (không đợi đến hạn 4h). Mutation trả null khi không có cờ
      // → 1 mutation rẻ mỗi 4h, không thêm polling.
      const manual = await store.client
        .mutation("threatIntel:botClaimManualLearn", {})
        .catch(() => null);
      if (manual) {
        trigger = "manual";
        const res = await runResearch(store, { trigger: "manual", requestedBy: manual.requestedBy });
        console.log(
          `[research:manual] by=${manual.requestedBy} sources=${res.sources.length} newKw=${res.newKeywords} newPhrases=${res.newPhrases} ai=${res.aiUsed}`,
        );
        // Báo kết quả vào kênh log chung — CHỈ khi chủ bot bật "thông báo học tập"
        // trên Admin (mặc định TẮT để không làm spam kênh log).
        if (res.notifyEnabled) {
          await notifyManualResult(client, store, res, manual.requestedBy).catch(() => {});
        }
        return;
      }

      const intel = await store.client.query("threatIntel:botGetIntel", {}).catch(() => null);
      if (!intel?.researchEnabled) {
        // Bị tắt trên web → không tốn bất kỳ chi phí nào.
        return;
      }
      const now = Date.now();
      const nextRun = intel?.nextRunAt ?? 0;
      if (nextRun > now) return; // chưa đến hạn
      trigger = "auto";
      const res = await runResearch(store);
      console.log(
        `[research] sources=${res.sources.length} newKw=${res.newKeywords} newPhrases=${res.newPhrases} ai=${res.aiUsed}`,
      );
    } catch (e) {
      console.error("[research]", e?.message || e);
      // Báo lỗi về Convex — Admin hiển thị lý do thay vì "Bot đang học…" treo vĩnh viễn.
      if (trigger) {
        await store.client
          .mutation("threatIntel:botReportResearchError", {
            error: String(e?.message || "Lỗi không xác định").slice(0, 260),
            trigger,
          })
          .catch(() => {});
      }
    } finally {
      running = false;
    }
  };

  setTimeout(() => tick().catch(() => {}), 5 * 60 * 1000).unref?.();
  // Vòng 10 phút: đủ nhanh cho học thủ công (≤10 phút chờ) mà vẫn rẻ (1 mutation/lượt).
  setTimeout(() => tick().catch(() => {}), 60_000).unref?.();
  const interval = setInterval(() => tick().catch(() => {}), 10 * 60_000);
  interval.unref?.();
  // Vòng 4h định kỳ giữ nguyên cho lượt tự động.
  const slowInterval = setInterval(() => tick().catch(() => {}), RESEARCH_INTERVAL_MS);
  slowInterval.unref?.();
}

/**
 * Chạy 1 lượt học THỦ CÔNG ngay lập tức (cho lệnh /research learn).
 * Trả kết quả để command hiển thị — KHÔNG đợi vòng tick 10 phút.
 * Đặt sẵn cờ request trước khi chạy để cooldown web 2 phút nhất quán; nếu cờ
 * đã có (web vừa bấm) thì giữ nguyên, bot đang chạy sẽ bỏ qua cờ này vì
 * learnNow đã tự xử lý xong trước đó.
 */
async function learnNow(store, requestedBy) {
  // Đặt cờ (nếu chưa có) để đồng bộ cooldown — lỗi im lặng nếu đã có.
  await store.client
    .mutation("threatIntel:requestManualLearn", { requestedBy })
    .catch(() => null);
  // Xóa cờ ngay — learnNow chạy trực tiếp, không cần tick nhận lại.
  await store.client
    .mutation("threatIntel:botClaimManualLearn", {})
    .catch(() => null);
  return runResearch(store, { trigger: "manual", requestedBy });
}

/** Thông báo kết quả học thủ công vào kênh log chung (tối đa 3 server). */
async function notifyManualResult(client, store, res, requestedBy) {
  const { logEmbed, sendLog, Colors } = require("./util");
  const guilds = [...client.guilds.cache.values()].slice(0, 3);
  for (const guild of guilds) {
    try {
      const config = await store.getConfig(guild.id);
      if (!config) continue;
      const embed = logEmbed({
        title: "🧠 Bot đã hoàn thành lượt học thủ công",
        description: requestedBy ? `Người yêu cầu: **${requestedBy}**` : undefined,
        color: Colors.Blurple,
        fields: [
          { name: "Nguồn đã tải", value: String(res.sources.length || 0), inline: true },
          { name: "Từ khóa mới", value: String(res.newKeywords), inline: true },
          { name: "Cụm từ mới", value: String(res.newPhrases), inline: true },
          { name: "Tổng đang nhớ", value: `${res.totalKeywords} từ khóa`, inline: true },
          { name: "AI tổng hợp", value: res.aiUsed ? "✅ Có (Mimo V2.5)" : "⚙️ Không (heuristics)", inline: true },
        ],
        footer: "Protogon · Threat Intel",
      });
      await sendLog(guild, config, embed, "general");
    } catch {
      // guild chưa set log — bỏ qua
    }
  }
}

/**
 * AI review từ khóa: nhờ Mimo rà danh sách, trả từ khóa có nguy cơ ban nhầm.
 * Trả [{ keyword, benignHits }] — benignHits ước lượng độ "phổ biến" 0-100.
 */
async function aiReviewKeywords(keywords) {
  if (!Array.isArray(keywords) || keywords.length === 0) return [];
  try {
    const aiClient = require("./ai");
    if (!aiClient.researchAvailable()) return [];
    const raw = await aiClient.researchChat(
      [
        {
          role: "system",
          content:
            'Bạn là chuyên gia an ninh Discord. Nhận danh sách từ khóa scam bot đang dùng để bắt tin nhắn xấu. Trả về CHỈ các từ khóa CẦN LOẠI vì quá phổ biến trong hội thoại thường xuyên (vd "password", "account", "steam") — có nguy cơ bot phạt oan thành viên vô tội. Chỉ trả JSON thuần: {"suspects":[{"keyword":"...","benignHits":<số 0-100 ước lượng độ phổ biến>}]}. Không có gì cần loại → {"suspects":[]}.',
        },
        { role: "user", content: keywords.join(", ") },
      ],
      { maxTokens: 500, temperature: 0.1 },
    );
    const m = raw?.match(/\{[\s\S]*\}/);
    if (!m) return [];
    const parsed = JSON.parse(m[0]);
    const list = Array.isArray(parsed?.suspects) ? parsed.suspects : [];
    return list
      .filter((s) => s && typeof s.keyword === "string")
      .slice(0, 15)
      .map((s) => ({ keyword: String(s.keyword).slice(0, 80), benignHits: Math.max(0, Math.min(100, Number(s.benignHits) || 0)) }));
  } catch {
    return [];
  }
}

/**
 * Weekly digest: AI tổng hợp xu hướng nguy cơ 2-3 câu — đăng kênh log cho admin.
 */
async function buildWeeklyDigest(keywords, phrases) {
  try {
    const aiClient = require("./ai");
    if (!aiClient.researchAvailable()) return null;
    const raw = await aiClient.researchChat(
      [
        {
          role: "system",
          content:
            'Bạn là chuyên gia an ninh Discord. Dựa trên từ khóa/cụm từ scam bot đã học tuần này, viết DIGEST 2-3 câu tiếng Việt về xu hướng đe dọa nổi bật (kiểu tấn công, mục tiêu, lời khuyên ngắn cho admin server). Không liệt kê máy móc — tổng hợp ý nghĩa.',
        },
        {
          role: "user",
          content: `Từ khóa: ${keywords.join(", ")}\nCụm từ: ${phrases.join(" | ") || "(không có)"}`,
        },
      ],
      { maxTokens: 400, temperature: 0.3 },
    );
    return raw ? String(raw).trim().slice(0, 700) : null;
  } catch {
    return null;
  }
}

/** Đăng digest vào kênh log chung của tối đa 3 server. */
async function postDigestToLog(client, digest) {
  if (!client?.guilds?.cache) return;
  const { logEmbed, sendLog, Colors } = require("./util");
  const embed = logEmbed({
    title: "🧠 Threat Digest tuần — xu hướng đe dọa",
    description: String(digest).slice(0, 700),
    color: Colors.Blurple,
    footer: "Protogon · Threat Intel",
  });
  let sent = 0;
  for (const guild of client.guilds.cache.values()) {
    if (sent >= 3) break;
    try {
      const config = await store.getConfig(guild.id);
      if (!config) continue;
      await sendLog(guild, config, embed, "general");
      sent++;
    } catch {
      // guild chưa set log — bỏ qua
    }
  }
}

/** Trích từ khóa heuristic từ 1 đoạn text (dùng bởi threatEngine backfill). */
function extractKeywordsFromText(text, max = 10) {
  return extractKeywords(text, max);
}

module.exports = { setupResearch, runResearch, learnNow, extractKeywordsFromText };
