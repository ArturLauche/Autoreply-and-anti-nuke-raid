// TEST: hợp đồng đăng ký slash command ↔ handler.
// Lệnh phải được khai báo trong bot/src/commands/slash.js (gửi lên Discord) thì
// người dùng mới gõ được; nếu handler xử lý `case "x"` mà không đăng ký, cả lệnh
// chết lặng (không bao giờ chạy). Đã từng xảy ra với `/alt` — handler đầy đủ
// nhưng chưa từng đăng ký, khiến toàn bộ tính năng alt detection không dùng được.
//
// Chạy: node scripts/test-slash-command-contract.cjs

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
let pass = 0;
let fail = 0;
const check = (name, cond, detail) => {
  if (cond) {
    pass++;
    console.log(`PASS ${name}`);
  } else {
    fail++;
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

const { commands } = require(path.join(root, "bot", "src", "commands", "slash.js"));
const registered = new Set(commands.map((c) => c.name));

const src = fs.readFileSync(
  path.join(root, "bot", "src", "handlers", "interactionCreate.js"),
  "utf8",
);
const handled = new Set([...src.matchAll(/case\s+"([a-z0-9_-]+)"\s*:/g)].map((m) => m[1]));

// 1) Mọi lệnh handler xử lý phải được đăng ký.
const unregistered = [...handled].filter((n) => !registered.has(n)).sort();
check(
  "mọi slash command handler xử lý đều được đăng ký trong slash.js",
  unregistered.length === 0,
  unregistered.map((n) => `/${n}`).join(", "),
);

// 2) Chốt trực tiếp hồi quy /alt (handler đầy đủ nhưng từng thiếu đăng ký).
check('"/alt" có trong danh sách đăng ký', registered.has("alt"));

// 3) Lệnh /alt phải có đủ subcommand handler đọc: status/on/off/punish/threshold/vpn.
{
  const alt = commands.find((c) => c.name === "alt");
  const subs = new Set((alt?.options || []).filter((o) => o.type === 1).map((o) => o.name));
  for (const s of ["status", "on", "off", "punish", "threshold", "vpn"]) {
    check(`/alt có subcommand "${s}"`, subs.has(s));
  }
}

// 4) Mọi lệnh đã đăng ký đều phải có handler (nếu không, Discord hiện lệnh nhưng
//    bot trả "Lệnh chưa được hỗ trợ." — UX hỏng).
const unhandled = [...registered].filter((n) => !handled.has(n)).sort();
check(
  "mọi slash command đã đăng ký đều có handler",
  unhandled.length === 0,
  unhandled.map((n) => `/${n}`).join(", "),
);

console.log(`\nKết quả: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
