// Test fallback chain của bot/src/ai.js — không dùng biến môi trường thật.
// Mock 2 provider: Groq (đầu chain) trả 429 → DeepSeek NIM (sau) trả 200 JSON hợp lệ.
const path = require("path");
const Module = require("module");

let calls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  calls.push(new URL(url).host);
  if (String(url).includes("groq.com")) {
    return { ok: false, status: 429, json: async () => ({}) };
  }
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              classification: "raid",
              confidence: 0.9,
              reason: "test",
              suggestPunish: "ban",
            }),
          },
        },
      ],
    }),
  };
};

// Chặn loadenv để không đọc .env thật, và set fake env bằng cách ghi đè descriptor
const origLoad = Module.prototype.load;
Module.prototype.load = function (request) {
  if (path.basename(request) === "loadenv.js") {
    return {}; // không load thật
  }
  return origLoad.apply(this, arguments);
};
Object.defineProperty(process.env, "GROQ_API_KEY", {
  value: "fake-groq",
  configurable: true,
  writable: true,
  enumerable: true,
});
Object.defineProperty(process.env, "DEEPSEEK_NIM_KEY", {
  value: "fake-nim",
  configurable: true,
  writable: true,
  enumerable: true,
});

const ai = require("../bot/src/ai.js");

// Case 1: Groq 429 → fallback sang DeepSeek NIM, nhận kết quả hợp lệ
ai.classifyViolation({
  module: "massBan",
  count: 12,
  windowSeconds: 10,
  threshold: 5,
  sampleMessages: [],
})
  .then((r) => {
    console.log("[case1: fallback] providers tried:", calls.join(" -> "));
    console.log("[case1: fallback] final:", JSON.stringify(r));
    const ok = calls.length === 2 && r.classification === "raid" && !r.offline;
    console.log(ok ? "PASS case1: fallback chain hoạt động" : "FAIL case1: fallback chain lỗi");
    if (!ok) process.exit(1);

    // Case 2: Groq thành công ngay — KHÔNG được gọi provider thứ hai
    calls = [];
    globalThis.fetch = async (url) => {
      calls.push(new URL(url).host);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  classification: "benign",
                  confidence: 0.8,
                  reason: "x",
                  suggestPunish: null,
                }),
              },
            },
          ],
        }),
      };
    };
    return ai.classifyViolation({
      module: "spam",
      count: 3,
      windowSeconds: 10,
      threshold: 5,
      sampleMessages: [],
    });
  })
  .then((r) => {
    console.log("[case2: first ok] providers tried:", calls.join(" -> "));
    console.log("[case2: first ok] final:", JSON.stringify(r));
    const ok = calls.length === 1 && r.classification === "benign";
    console.log(ok ? "PASS case2: provider đầu thành công thì không fallback" : "FAIL case2");
    if (!ok) process.exit(1);

    // Case 3: cả hai provider đều fail → trả offline, không crash
    calls = [];
    globalThis.fetch = async (url) => {
      calls.push(new URL(url).host);
      return { ok: false, status: 500, json: async () => ({}) };
    };
    return ai.classifyViolation({
      module: "x",
      count: 2,
      windowSeconds: 5,
      threshold: 5,
      sampleMessages: [],
    });
  })
  .then((r) => {
    console.log("[case3: all fail] providers tried:", calls.join(" -> "));
    console.log("[case3: all fail] final:", JSON.stringify(r));
    const ok = calls.length === 2 && r.offline === true;
    console.log(ok ? "PASS case3: all fail → offline an toàn" : "FAIL case3");
    globalThis.fetch = realFetch;
    process.exit(ok ? 0 : 1);
  })
  .catch((e) => {
    console.error("ERROR:", e);
    globalThis.fetch = realFetch;
    process.exit(1);
  });
