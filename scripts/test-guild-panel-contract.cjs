// Test HỢP ĐỒNG "panel ⇄ guilds.getGuild": mọi field panel đọc từ `data.guild`
// PHẢI có trong object `guild: {...}` mà convex/guilds.ts trả về.
//
// Vì sao cần cổng này (bug thật 23/09/2026): `getGuild` thiếu TOÀN BỘ 24 field
// welcome/goodbye/autorole. Kiểu `GuildData` trong src/lib/types.ts vẫn khai báo
// đủ, và GuildPage ép `useQuery(...) as GuildData` → tsc mù hoàn toàn. Hệ quả
// người dùng thấy: bật Welcome/Goodbye xong bot không gửi gì — công tắc luôn
// hiện TẮT (đọc undefined), kênh/nội dung đã lưu không hiện ra, và mỗi lượt bấm
// "Lưu cài đặt" ghi đè bằng chuỗi rỗng (xoá config thật trong DB).
//
// Cổng này phân tích tĩnh 3 chiều:
//   1. Field panel đọc (data.guild.X / g.X / destructuring) ⊆ field getGuild trả.
//   2. Field khai báo trong GuildData.guild ⊆ field getGuild trả (kiểu không nói dối).
//   3. Danh sách field welcome/goodbye/autorole phải còn nguyên (khoá hồi quy —
//      đúng chỗ đã vỡ, để lần sau ai xoá thì đỏ ngay).
// Kèm self-test: bơm nguồn giả có field thiếu và bắt bộ kiểm phải phát hiện
// (chống cổng "xanh giả" vì regex không khớp gì).
//
// Chạy: node scripts/test-guild-panel-contract.cjs
const fs = require("fs");
const path = require("path");

let pass = 0;
let fail = 0;
const check = (label, ok) => {
  console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
  ok ? pass++ : fail++;
};

/**
 * Key top-level của một object literal / thân interface bắt đầu ở `open`
 * (vị trí dấu `{`). Theo dõi độ sâu {} [] () nên key lồng bên trong (vd
 * punishNotice.ban) không bị tính là field của guild.
 */
function keysOfBlock(src, open) {
  const keys = [];
  let depth = 0;
  let i = open;
  let expectMember = false;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      // Xuống dòng trong thân interface = bắt đầu property mới.
      if (ch === "\n" && depth === 1) expectMember = true;
      i++;
      continue;
    }
    if (ch === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && src[i + 1] === "*") {
      i = src.indexOf("*/", i) + 2;
      continue;
    }
    if (ch === "{" || ch === "[" || ch === "(") {
      depth++;
      if (depth === 1) expectMember = true;
      i++;
      continue;
    }
    if (ch === "}" || ch === "]" || ch === ")") {
      depth--;
      if (depth === 0) return keys;
      i++;
      continue;
    }
    if ((ch === "," || ch === ";") && depth === 1) {
      expectMember = true;
      i++;
      continue;
    }
    if (depth === 1 && expectMember) {
      const m = /^([A-Za-z_$][\w$]*)/.exec(src.slice(i));
      // Chỉ coi là TÊN field khi ký tự kế tiếp (bỏ khoảng trắng) là `:`/`?`/`,`/`}`
      // — nhờ vậy token kiểu (`Record<string, PunishNoticeLevel>`, `boolean;`)
      // không bị nhận nhầm thành field.
      if (m && [":", "?", ",", "}"].includes(src.slice(i + m[1].length).replace(/^\s+/, "")[0])) {
        keys.push(m[1]);
        i += m[1].length;
        expectMember = false;
        continue;
      }
      expectMember = false;
    }
    i++;
  }
  return keys;
}

/** Key top-level của object `guild: {` nằm trong query/hàm bắt đầu ở `anchor`. */
function guildKeysFromSource(src, anchor) {
  const at = src.indexOf(anchor);
  if (at === -1) throw new Error(`Không tìm thấy anchor: ${anchor}`);
  const brace = src.indexOf("{", at + anchor.length - 1);
  if (brace === -1) throw new Error(`Không thấy dấu { sau anchor: ${anchor}`);
  return keysOfBlock(src, brace);
}

/** Field panel đọc từ data.guild: data.guild.X, biến gán = data.guild rồi g.X, destructuring. */
function readFields(src) {
  const used = new Set();
  for (const m of src.matchAll(/data\.guild\??\.([A-Za-z_$][\w$]*)/g)) used.add(m[1]);
  // Chỉ nhận alias kiểu `const g = data.guild;` — KHÔNG nhận `const x = data.guild.foo || []`
  // (nếu nhận, `x.length`/`x.includes` bị báo nhầm là field của guild).
  for (const m of src.matchAll(
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*data\.guild(?:\s+as\s+[^;\n]+)?;/g,
  )) {
    const v = m[1];
    for (const u of src.matchAll(new RegExp(`\\b${v}\\??\\.([A-Za-z_$][\\w$]*)`, "g")))
      used.add(u[1]);
  }
  for (const m of src.matchAll(/const\s*\{([^}]*)\}\s*=\s*data\.guild\b/g)) {
    for (const part of m[1].split(",")) {
      const name = part
        .split(":")[0]
        .trim()
        .replace(/\.\.\./, "");
      if (/^[A-Za-z_$][\w$]*$/.test(name)) used.add(name);
    }
  }
  return used;
}

/** Trả về { missing } — field panel đọc nhưng getGuild không trả. */
function missingFields({ getGuildKeys, panelSources }) {
  const missing = {};
  for (const [file, src] of Object.entries(panelSources)) {
    const gone = [...readFields(src)].filter((k) => !getGuildKeys.has(k));
    if (gone.length) missing[file] = gone.sort();
  }
  return missing;
}

// ─────────────────────────── Nguồn thật ───────────────────────────
const root = path.join(__dirname, "..");
const convexSrc = fs.readFileSync(path.join(root, "convex", "guilds.ts"), "utf8");
const getGuildAnchor = "export const getGuild = query({";
const getGuildBlock = convexSrc.slice(
  convexSrc.indexOf(getGuildAnchor),
  convexSrc.indexOf("/** Lightweight config bundle"),
);
const getGuildKeys = new Set(guildKeysFromSource(getGuildBlock, "guild: {"));
check("đọc được danh sách field getGuild trả về (> 60 field)", getGuildKeys.size > 60);

// Panel/page đọc data.guild
const dirs = ["src/components/dashboard", "src/pages", "src/components"];
const panelSources = {};
for (const dir of dirs) {
  for (const f of fs.readdirSync(path.join(root, dir))) {
    if (!/\.(tsx|ts)$/.test(f)) continue;
    const rel = `${dir}/${f}`;
    const src = fs.readFileSync(path.join(root, rel), "utf8");
    if (src.includes("data.guild")) panelSources[rel] = src;
  }
}
check(`quét được các file đọc data.guild (>= 10 file)`, Object.keys(panelSources).length >= 10);

const missing = missingFields({ getGuildKeys, panelSources });
const missingLines = Object.entries(missing).map(([f, ks]) => `${f}: ${ks.join(", ")}`);
check(
  "mọi field panel đọc từ data.guild đều có trong getGuild" +
    (missingLines.length ? `\n     → thiếu: ${missingLines.join(" | ")}` : ""),
  missingLines.length === 0,
);

// Kiểu GuildData.guild không được khai báo field mà getGuild không trả (kiểu nói dối
// → tsc mù, đúng cái bẫy đã xảy ra với welcome/goodbye).
const typesSrc = fs.readFileSync(path.join(root, "src", "lib", "types.ts"), "utf8");
const guildDataTypeKeys = guildKeysFromSource(
  typesSrc.slice(typesSrc.indexOf("export interface GuildData")),
  "guild: {",
);
check("đọc được danh sách field GuildData.guild (> 60 field)", guildDataTypeKeys.length > 60);
const typeOnly = guildDataTypeKeys.filter((k) => !getGuildKeys.has(k)).sort();
check(
  "mọi field khai báo trong GuildData.guild đều được getGuild trả về" +
    (typeOnly.length ? `\n     → thiếu: ${typeOnly.join(", ")}` : ""),
  typeOnly.length === 0,
);

// Khoá hồi quy đúng chỗ đã vỡ: 24 field welcome/goodbye/autorole.
const GREETING_FIELDS = [
  "welcomeEnabled",
  "welcomeChannelId",
  "welcomeMessage",
  "welcomeUseEmbed",
  "goodbyeEnabled",
  "goodbyeChannelId",
  "goodbyeMessage",
  "goodbyeUseEmbed",
  "welcomeRandom",
  "goodbyeRandom",
  "welcomeDmEnabled",
  "welcomeDmMessage",
  "welcomeEmbedTitle",
  "welcomeEmbedColor",
  "welcomeEmbedImage",
  "welcomeEmbedThumbnail",
  "goodbyeEmbedTitle",
  "goodbyeEmbedColor",
  "goodbyeEmbedImage",
  "goodbyeEmbedThumbnail",
  "autoroleEnabled",
  "autoroleRoleId",
  "autoroleDelaySec",
  "autoroleIncludeBots",
];
const absentGreeting = GREETING_FIELDS.filter((f) => !getGuildKeys.has(f));
check(
  "getGuild trả đủ 24 field welcome/goodbye/autorole (panel WelcomePanel cần)" +
    (absentGreeting.length ? ` → thiếu: ${absentGreeting.join(", ")}` : ""),
  absentGreeting.length === 0,
);

// Chính WelcomePanel phải đọc được hết field nó dùng.
const welcomePanelSrc = fs.readFileSync(
  path.join(root, "src", "components", "dashboard", "WelcomePanel.tsx"),
  "utf8",
);
const welcomeMissing = [...readFields(welcomePanelSrc)].filter((k) => !getGuildKeys.has(k));
check(
  "WelcomePanel không đọc field nào ngoài getGuild" +
    (welcomeMissing.length ? ` → thiếu: ${welcomeMissing.join(", ")}` : ""),
  welcomeMissing.length === 0,
);

// ─────────────────────── Self-test (cổng không rỗng) ───────────────────────
{
  const fakeConvex = `
export const getGuild = query({
  args: {},
  handler: async (ctx) => {
    return {
      guild: {
        discordId: guild.discordId,
        punishNotice: { ban: guild.punishNotice?.ban ?? "full" },
        safetyPercent,
      },
    };
  },
});
`;
  const fakePanel = `
function Panel({ data }) {
  const g = data.guild;
  return <p>{g.discordId}{g.welcomeEnabled}{data.guild.goodbyeEnabled}</p>;
}
`;
  const keys = new Set(guildKeysFromSource(fakeConvex, "guild: {"));
  check(
    "self-test: đọc đúng key thật + bỏ qua key lồng (punishNotice, safetyPercent)",
    keys.has("discordId") &&
      keys.has("punishNotice") &&
      keys.has("safetyPercent") &&
      !keys.has("ban"),
  );
  const found = missingFields({ getGuildKeys: keys, panelSources: { "FakePanel.tsx": fakePanel } });
  check(
    "self-test: phát hiện panel đọc field getGuild không trả (welcomeEnabled, goodbyeEnabled)",
    (found["FakePanel.tsx"] ?? []).join(",") === "goodbyeEnabled,welcomeEnabled",
  );
  const clean = missingFields({
    getGuildKeys: new Set([...keys, "welcomeEnabled", "goodbyeEnabled"]),
    panelSources: { "FakePanel.tsx": fakePanel },
  });
  check("self-test: hết field thiếu thì báo sạch", Object.keys(clean).length === 0);
}

// ─── Hồi quy đúng bug 23/09: getGuild CŨ (không có field welcome/goodbye) + WELCOME
// panel THẬT → cổng phải đỏ. Đây là bằng chứng cổng này bắt được chính lỗi đã xảy ra
// (không phải cổng trang trí).
{
  const buggyGetGuild = `
export const getGuild = query({
  args: {},
  handler: async (ctx) => {
    return {
      guild: {
        discordId: guild.discordId,
        name: guild.name,
        prefix: guild.prefix,
      },
    };
  },
});
`;
  const buggyKeys = new Set(guildKeysFromSource(buggyGetGuild, "guild: {"));
  const found = missingFields({
    getGuildKeys: buggyKeys,
    panelSources: { "WelcomePanel.tsx": welcomePanelSrc },
  });
  const gone = found["WelcomePanel.tsx"] ?? [];
  check(
    `hồi quy: getGuild thiếu field welcome → cổng báo đỏ ${gone.length} field`,
    gone.length >= 20 && gone.includes("welcomeEnabled") && gone.includes("autoroleRoleId"),
  );
}

console.log(`\nKết quả guild-panel contract: ${pass} PASS, ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
