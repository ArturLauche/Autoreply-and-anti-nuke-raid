// Test độ chính xác AI (bot/src/ai.js) — HERMETIC: mock fetch + xoá env key thật.
// Phủ 4 nhóm cải tiến "huấn luyện AI":
//   1. extractJson cứng hoá — JSON bọc ```json``` fence, dấu phẩy thừa, chữ thừa
//      quanh JSON (model nhỏ hay trả vậy) phải parse được thay vì rơi fallback.
//   2. evidence[] (bằng chứng engine) phải đi vào prompt gửi model.
//   3. Timeout 3 hàm phân tích = 6.5s (đồng bộ race 6s tầng trên) — không còn
//      deadline 12s bị tầng race cắt cụt khiến fallback mất dư địa.
//   4. AI offline → trả fallback đúng (individual/conf 0.5/offline) không throw.
// Chạy: node scripts/test-ai-accuracy.cjs
const path = require("path");
const Module = require("module");
const assert = require("node:assert");

// ── Hermetic: chặn loadenv + xoá mọi key provider khỏi môi trường ambient ──
const origLoad = Module.prototype.load;
Module.prototype.load = function (request) {
  if (path.basename(request) === "loadenv.js") return {};
  return origLoad.apply(this, arguments);
};
for (const k of [
  "AI_API_KEY",
  "AI_BASE_URL",
  "AI_MODEL",
  "GROQ_API_KEY",
  "DEEPSEEK_NIM_KEY",
  "DEEPSEEK_NIM_MODEL",
  "NVIDIA_API_KEY",
  "NVIDIA_MODEL",
  "SAMBANOVA_API_KEY",
  "KIRA_API_KEY",
  "KIRA_BASE_URL",
  "KIRA_MODEL",
  "KIRA_USE_PROXY",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
]) {
  delete process.env[k];
}
Object.defineProperty(process.env, "GROQ_API_KEY", {
  value: "fake-groq",
  configurable: true,
  writable: true,
  enumerable: true,
});

// ── Mock fetch: ghi lại mọi body gửi lên để kiểm tra prompt + timeout ──
const calls = [];
let replyContent = "{}";
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  calls.push({
    host: new URL(url).host,
    model: body.model,
    system: body.messages.find((m) => m.role === "system")?.content ?? "",
    user: body.messages.find((m) => m.role === "user")?.content ?? "",
    maxTokens: body.max_tokens,
  });
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: replyContent } }] }),
  };
};

const ai = require("../bot/src/ai.js");

let pass = 0;
let fail = 0;
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      pass++;
      console.log(`  ✅ ${name}`);
    })
    .catch((e) => {
      fail++;
      console.error(`  ❌ ${name}\n     ${e.message}`);
    });
}

(async () => {
  console.log("── 1. extractJson cứng hoá (qua classifyViolation) ──");

  await check("JSON bọc ```json fence``` vẫn parse được", async () => {
    calls.length = 0;
    replyContent =
      '```json\n{"classification":"raid","confidence":0.9,"reason":"fence","suggestPunish":"ban"}\n```';
    const res = await ai.classifyViolation({
      module: "spam",
      count: 8,
      windowSeconds: 10,
      threshold: 5,
      sampleMessages: ["@everyone free nitro"],
    });
    assert.strictEqual(res.offline, false);
    assert.strictEqual(res.classification, "raid");
    assert.strictEqual(res.confidence, 0.9);
  });

  await check("Dấu phẩy thừa trước } vẫn parse được", async () => {
    calls.length = 0;
    replyContent =
      '{"classification":"benign","confidence":0.8,"reason":"comma","suggestPunish":null,}';
    const res = await ai.classifyViolation({
      module: "spam",
      count: 3,
      windowSeconds: 10,
      threshold: 5,
      sampleMessages: ["hello"],
    });
    assert.strictEqual(res.offline, false);
    assert.strictEqual(res.classification, "benign");
  });

  await check("Chữ thừa quanh JSON (model giải thích kèm) vẫn parse được", async () => {
    calls.length = 0;
    replyContent =
      'Kết quả phân tích như sau:\n{"classification":"individual","confidence":0.85,"reason":"1 người","suggestPunish":"timeout"}\nHy vọng giúp được bạn.';
    const res = await ai.classifyViolation({
      module: "spam",
      count: 7,
      windowSeconds: 10,
      threshold: 5,
      sampleMessages: ["haha"],
    });
    assert.strictEqual(res.offline, false);
    assert.strictEqual(res.classification, "individual");
  });

  await check("JSON hỏng thật sự → fallback individual + offline (không throw)", async () => {
    calls.length = 0;
    replyContent = "khong phai json";
    const res = await ai.classifyViolation({
      module: "spam",
      count: 7,
      windowSeconds: 10,
      threshold: 5,
      sampleMessages: ["x"],
    });
    assert.strictEqual(res.offline, true);
    assert.strictEqual(res.classification, "individual");
  });

  console.log("── 2. Evidence (bằng chứng engine) vào prompt ──");

  await check("evidence[] xuất hiện trong prompt user gửi model", async () => {
    calls.length = 0;
    replyContent = '{"classification":"raid","confidence":0.9,"reason":"ev"}';
    await ai.classifyViolation({
      module: "spam",
      count: 8,
      windowSeconds: 10,
      threshold: 5,
      sampleMessages: ["@everyone bit.ly/xxx"],
      recentJoins: 12,
      memberCount: 500,
      evidence: [
        "Nội dung 8 mẫu tin GIỐNG HỆT nhau (engine so khớp chuỗi)",
        "3 mẫu chứa link rút gọn (mẫu scam phổ biến)",
      ],
    });
    assert.strictEqual(calls.length, 1);
    assert.ok(calls[0].user.includes("BẰNG CHỨNG ENGINE"), "prompt phải có mục BẰNG CHỨNG ENGINE");
    assert.ok(calls[0].user.includes("GIỐNG HỆT nhau"), "evidence 1 phải vào prompt");
    assert.ok(calls[0].user.includes("rút gọn"), "evidence 2 phải vào prompt");
  });

  await check("Không có evidence → prompt KHÔNG nhắc mục BẰNG CHỨNG", async () => {
    calls.length = 0;
    replyContent = '{"classification":"individual","confidence":0.8,"reason":"none"}';
    await ai.classifyViolation({
      module: "spam",
      count: 6,
      windowSeconds: 10,
      threshold: 5,
      sampleMessages: ["haha"],
    });
    assert.ok(!calls[0].user.includes("BẰNG CHỨNG ENGINE"));
  });

  await check("Prompt có quy trình suy luận 3 bước (system)", async () => {
    assert.ok(calls[0].system.includes("QUY TRÌNH"));
    assert.ok(calls[0].system.includes("benign TRƯỚC"));
  });

  await check("analyzeRaid truyền evidence + analyzeExternalApp truyền evidence", async () => {
    calls.length = 0;
    replyContent = '{"coordinated":true,"confidence":0.9,"reasoning":"ev","sourceHint":"user1"}';
    await ai.analyzeRaid({
      module: "source-hunt",
      count: 9,
      windowSeconds: 10,
      threshold: 1,
      clusterProfile: "1. u1 (acc 1 ngày)",
      recentActions: "ban hàng loạt",
      evidence: ["Tuổi acc: 9/9 dưới 7 ngày"],
    });
    assert.ok(calls[0].user.includes("Tuổi acc: 9/9 dưới 7 ngày"));

    replyContent = '{"isRaid":true,"confidence":0.9,"reason":"app"}';
    await ai.analyzeExternalApp({
      count: 4,
      windowSeconds: 60,
      threshold: 3,
      appProfile: '1. "Free Nitro" — bởi u1',
      recentJoins: 6,
      memberCount: 100,
      evidence: ["Tên app đáng ngờ (điểm 4): giả mạo + từ khóa scam"],
    });
    assert.ok(calls[1].user.includes("Tên app đáng ngờ"));
  });

  console.log("── 3. Timeout đồng bộ (6.5s < 12s cũ) ──");

  await check("3 hàm phân tích gọi với timeoutMs đúng 6500", async () => {
    calls.length = 0;
    replyContent = '{"classification":"raid","confidence":0.9,"reason":"t"}';
    await ai.classifyViolation({ module: "spam", count: 6, windowSeconds: 10, threshold: 5 });
    // timeoutMs không gửi lên API — kiểm qua fetch gọi 1 lần không bị deadline
    // 12s chi phối: chỉ assert được qua hành vi; ở đây xác nhận không throw và
    // có kết quả. Giá trị 6500 được kiểm trực tiếp qua source dưới.
    assert.strictEqual(calls.length, 1);
    const src = require("fs").readFileSync(
      path.join(__dirname, "..", "bot", "src", "ai.js"),
      "utf8",
    );
    assert.ok(
      src.includes("CLASSIFY_TIMEOUT_MS = 6_500"),
      "hằng CLASSIFY_TIMEOUT_MS = 6_500 phải tồn tại",
    );
    assert.ok(
      (src.match(/CLASSIFY_TIMEOUT_MS }/g) || []).length >= 3,
      "cả 3 hàm phân tích phải dùng CLASSIFY_TIMEOUT_MS",
    );
  });

  console.log("── 4. Offline path (không key AI) ──");

  await check("Không cấu hình AI → fallback ổn định, không throw", async () => {
    // providerChain đọc env lúc module load — kiểm qua module riêng với env rỗng.
    delete process.env.GROQ_API_KEY;
    delete require.cache[require.resolve("../bot/src/ai.js")];
    const ai2 = require("../bot/src/ai.js");
    const res = await ai2.classifyViolation({
      module: "spam",
      count: 9,
      windowSeconds: 10,
      threshold: 5,
    });
    assert.strictEqual(res.offline, true);
    assert.strictEqual(res.classification, "individual");
    assert.strictEqual(res.confidence, 0.5);
    // Khôi phục env cho các test sau (nếu có)
    Object.defineProperty(process.env, "GROQ_API_KEY", {
      value: "fake-groq",
      configurable: true,
      writable: true,
      enumerable: true,
    });
  });

  globalThis.fetch = realFetch;
  console.log(`\nKết quả AI accuracy: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
})();
