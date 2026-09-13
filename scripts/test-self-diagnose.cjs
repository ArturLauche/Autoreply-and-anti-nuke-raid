// Test selfDiagnose.js — fingerprint, cooldown, code context, store GIẢ.
// Chạy: node scripts/test-self-diagnose.cjs
// Mock discord.js bằng đường dẫn trỏ sang module giả (giống test-research-commands).
const Module = require("module");
const path = require("path");
const fs = require("fs");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === "discord.js") {
    return path.join(__dirname, "..", "bot", "test-djs-mock.cjs");
  }
  return origResolve.call(this, request, ...args);
};
fs.writeFileSync(
  path.join(__dirname, "..", "bot", "test-djs-mock.cjs"),
  `class EmbedBuilder {
  constructor(data = {}) { this.d = data; }
  setColor(c) { this.d.color = c; return this; }
  setTitle(t) { this.d.title = t; return this; }
  setDescription(t) { this.d.description = t; return this; }
  addFields(f) { this.d.fields = [...(this.d.fields ?? []), ...f]; return this; }
  setTimestamp() { return this; }
  setFooter(f) { this.d.footer = f; return this; }
}
module.exports = { Colors: new Proxy({}, { get: () => 0x000000 }), EmbedBuilder, PermissionFlagsBits: { ManageGuild: 1n << 5n, Administrator: 1n << 3n } };
`,
);

const sd = require("../bot/src/handlers/selfDiagnose.js");

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL: ${msg}`);
  }
}

async function main() {
// ---- 1. Fingerprint: cùng lỗi cùng vị trí → cùng fp; khác lỗi → khác fp ----
const e1 = new Error("Cannot read properties of undefined (reading 'id')");
// Gắn stack giả với frame trong bot/src
e1.stack = `Error: Cannot read properties of undefined (reading 'id')
    at handleSpam (${path.resolve(__dirname, "..", "bot", "src", "handlers", "antinuke.js")}:1234:56)
    at Object.attach (...:0:0)`;
const e2 = new Error(e1.message);
e2.stack = e1.stack;
const e3 = new Error("Khác hoàn toàn");
e3.stack = `Error: Khác hoàn toàn
    at handleSpam (${path.resolve(__dirname, "..", "bot", "src", "handlers", "antinuke.js")}:999:1)`;

// fingerprintOf không export — test qua hành vi cooldown: set enabled + store giả.
const mutations = [];
const store = {
  client: {
    mutation: async (name, args) => {
      mutations.push({ name, args });
      return { ok: true };
    },
    query: async () => null,
  },
  getConfig: async () => null,
};
const client = {
  guilds: { cache: new Map() },
};

// Vô hiệu hóa AI thật: researchChat trả JSON hợp lệ (không gọi mạng).
const aiMod = require("../bot/src/ai.js");
const origResearchChat = aiMod.researchChat;
aiMod.researchChat = async () =>
  JSON.stringify({
    severity: "medium",
    cause: "Biến undefined khi member rời server giữa chừng.",
    fix: "Thêm optional chaining member?.id.",
    diff: "- x.id\n+ x?.id",
  });
aiMod.researchAvailable = () => true;

sd.attach(client, store);
sd.setEnabledFromJobs({ enabled: true });

// Lần 1: chạy được (state.inFlight giải phóng sau await)
await sd.diagnoseError("unhandledRejection", e1);
assert(mutations.length === 1, `lượt 1 ghi 1 mutation (thực tế ${mutations.length})`);
assert(mutations[0]?.name === "selfDiagnose:botRecordDiagnose", "mutation đúng tên");
assert(mutations[0]?.args.severity === "medium", "severity đúng");
assert(typeof mutations[0]?.args.fingerprint === "string", "fingerprint là string");

// Lần 2: cùng lỗi → cooldown, KHÔNG mutation mới
await sd.diagnoseError("unhandledRejection", e2);
assert(mutations.length === 1, `cùng lỗi bị chặn cooldown (thực tế ${mutations.length})`);

// Lần 3: lỗi khác → chạy được
await sd.diagnoseError("unhandledRejection", e3);
assert(mutations.length === 2, `lỗi khác vẫn chạy (thực tế ${mutations.length})`);

// ---- 2. Bật/tắt: tắt → KHÔNG chạy ----
sd.setEnabledFromJobs({ enabled: false });
await sd.diagnoseError("unhandledRejection", new Error("Lỗi khi tắt"));
assert(mutations.length === 2, "tắt → không chẩn đoán");

// Bật lại, lỗi mới (fingerprint chưa từng) → chạy
sd.setEnabledFromJobs({ enabled: true });
const e4 = new Error("Lỗi thứ tư");
e4.stack = `Error: Lỗi thứ tư
    at (${path.resolve(__dirname, "..", "bot", "src", "util.js")}:10:5)`;
await sd.diagnoseError("uncaughtException", e4);
assert(mutations.length === 3, "bật lại + lỗi mới → chạy");

// ---- 3. Lỗi không phải Error (string reason) → không vỡ ----
await sd.diagnoseError("unhandledRejection", "chuỗi lỗi thường");
assert(mutations.length >= 3, "reason dạng string không vỡ");

// ---- 4. setEnabledFromJobs với input rác → không vỡ, giữ trạng thái cũ ----
sd.setEnabledFromJobs(undefined);
sd.setEnabledFromJobs(null);
sd.setEnabledFromJobs("rác");
assert(true, "input rác không vỡ");
}

main()
  .then(() => {
    console.log(`Kết quả self-diagnose: ${pass} PASS, ${fail} FAIL`);
    process.exit(fail > 0 ? 1 : 0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
