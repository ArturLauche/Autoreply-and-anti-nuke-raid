// Test mặc định module + không reset setup server + cờ notify học tập.
// Chạy: node scripts/test-module-defaults.cjs
const path = require("path");

const Module = require("module");
const fs = require("fs");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === "discord.js") return path.join(__dirname, "..", "bot", "test-djs-mock.cjs");
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

let pass = 0;
let fail = 0;
const check = (label, ok) => {
  console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
  ok ? pass++ : fail++;
};

(async () => {
  // ---- 1. Convex source: botEnsureModules mặc định TẮT (server mới) ----
  const bw = fs.readFileSync(path.join(__dirname, "..", "convex", "bot_writes.ts"), "utf8");
  const ensureBlock = bw.slice(bw.indexOf("export const botEnsureModules"), bw.indexOf("export const botSetAntinuke"));
  check("botEnsureModules chèn module mới với enabled: false", /enabled: false/.test(ensureBlock));
  check("botEnsureModules bỏ qua module đã có (không reset setup cũ)", /if \(have\.has\(m\.module\)\) continue;/.test(ensureBlock));

  // ---- 2. setAntinukeGlobal: BẬT = bật cả module con; TẮT = giữ nguyên ----
  const gs = fs.readFileSync(path.join(__dirname, "..", "convex", "guilds.ts"), "utf8");
  const globalBlock = gs.slice(gs.indexOf("export const setAntinukeGlobal"), gs.indexOf("/* ------------------------- Bot-side sync"));
  check("setAntinukeGlobal: bật global → bật mọi module con", /if \(enabled\) \{[\s\S]*?antinukeModules[\s\S]*?enabled: true/.test(globalBlock));
  check("setAntinukeGlobal: chỉ patch module đang TẮT (giữ threshold/punish)", /if \(!m\.enabled\) await ctx\.db\.patch\(m\._id, \{ enabled: true/.test(globalBlock));

  // ---- 3. notify flag: schema + threatIntel + research ----
  const schema = fs.readFileSync(path.join(__dirname, "..", "convex", "schema.ts"), "utf8");
  check("schema có researchNotifyEnabled", schema.includes("researchNotifyEnabled"));
  const ti = fs.readFileSync(path.join(__dirname, "..", "convex", "threatIntel.ts"), "utf8");
  check("getSettings trả notifyEnabled", ti.includes("notifyEnabled: status?.researchNotifyEnabled ?? false"));
  check("setResearchSettings nhận notifyEnabled", /notifyEnabled: v\.optional\(v\.boolean\(\)\)/.test(ti));
  check("botGetIntel trả notifyEnabled cho bot", ti.includes("notifyEnabled: status?.researchNotifyEnabled ?? false,"));

  const research = fs.readFileSync(path.join(__dirname, "..", "bot", "src", "research.js"), "utf8");
  check("runResearch đọc cờ notifyEnabled", research.includes("notifyEnabled: intel?.notifyEnabled === true"));
  check("manual learn chỉ notify khi bật cờ", /if \(res\.notifyEnabled\) \{\s*\n\s*await notifyManualResult/.test(research));
  check("digest cũng tôn trọng cờ notify", /if \(intel\?\.notifyEnabled === true\) \{\s*\n\s*await postDigestToLog/.test(research));

  // ---- 4. Admin UI: toggle thông báo học tập ----
  const admin = fs.readFileSync(path.join(__dirname, "..", "src", "pages", "Admin.tsx"), "utf8");
  check("Admin có onToggleNotify", admin.includes("onToggleNotify"));
  check("Admin gọi setThreat với notifyEnabled", /setThreat\(\{ token, notifyEnabled \}\)/.test(admin));

  // ---- 5. runResearch hoạt động đúng với notifyEnabled=false (mặc định) ----
  delete process.env.GROQ_API_KEY;
  delete process.env.NVIDIA_API_KEY;
  delete process.env.DEEPSEEK_NIM_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.SAMBANOVA_API_KEY;
  delete process.env.AI_API_KEY;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("reddit.com")) {
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: {
              children: [
                { data: { title: "new tokengrabber scam spreading - fake captcha steals password" } },
              ],
            },
          }),
      };
    }
    return { ok: false, status: 404, text: async () => "" };
  };
  const researchMod = require("../bot/src/research.js");
  const mutations = [];
  const store = {
    client: {
      query: async (name) => {
        if (name === "threatIntel:botGetIntel") {
          return { keywords: [], scamPhrases: [], researchEnabled: true, notifyEnabled: false, nextRunAt: 0 };
        }
        return null;
      },
      mutation: async (name, args) => {
        mutations.push({ name, args });
        return { ok: true };
      },
    },
    getConfig: async () => null,
  };
  const res = await researchMod.runResearch(store);
  check("runResearch chạy được với intel tối thiểu", typeof res.newKeywords === "number");
  check("res.notifyEnabled = false khi intel chưa bật", res.notifyEnabled === false);
  check("đã ghi botSetResearchRun", mutations.some((m) => m.name === "threatIntel:botSetResearchRun"));

  // notifyEnabled=true → cờ true
  store.client.query = async () => ({
    keywords: [], scamPhrases: [], researchEnabled: true, notifyEnabled: true, nextRunAt: 0,
  });
  const res2 = await researchMod.runResearch(store);
  check("res.notifyEnabled = true khi intel bật", res2.notifyEnabled === true);

  console.log(`\nKết quả module-defaults: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error("CRASH:", e);
  process.exit(1);
});
