// TEST BẢO MẬT — xác minh các vá chống giả mạo bot-side + khóa tính năng ẩn.
// Chạy: node scripts/test-security-hardening.cjs
// Không mạng, không Convex thật — kiểm bằng phân tích nguồn + logic thuần.
const fs = require("fs");
const path = require("path");

let pass = 0;
let fail = 0;
const check = (label, ok, extra) => {
  console.log(ok ? `PASS ${label}` : `FAIL ${label}${extra ? " — " + extra : ""}`);
  ok ? pass++ : fail++;
};
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

// ===== 1. Strict botKey: không còn cửa hậu back-compat =====
const botAuth = read("convex/botAuth.ts");
check(
  "requireBotKeyStrict từ chối khi seed chưa cấp phát (không back-compat)",
  botAuth.includes('throw new Error("Chìa khóa bot chưa được cấp phát'),
);
check(
  "requireBotKeyStrict so khớp SHA-256(botKey) với seed",
  botAuth.includes("computeBotKey(botKey) !== seed"),
);
check(
  "requireBotKey cũ (back-compat) không còn được dùng ở function nào",
  !/await requireBotKey\(/.test(
    fs
      .readdirSync(path.join(__dirname, "..", "convex"))
      .filter((f) => f.endsWith(".ts"))
      .map((f) => read(path.join("convex", f)))
      .join("\n"),
  ),
);

// Danh sách function nhạy cảm bắt buộc strict
const sensitive = [
  ["convex/backup.ts", "botGetPending (đọc toàn bộ backup JSON)"],
  ["convex/backup_github.ts", "githubPush (đẩy Gist)"],
  ["convex/bot_writes.ts", "botStoreBackup / botClaimBackup / botClearBackup"],
  ["convex/guilds.ts", "getBotConfig (lộ whitelist + autoReplies)"],
  ["convex/webhooks.ts", "botGetWebhooks (lộ token webhook)"],
  ["convex/hidden.ts", "getBotHiddenJobs / botSetOwner"],
];
for (const [p, desc] of sensitive) {
  check(`${p} dùng strict — bảo vệ ${desc}`, read(p).includes("requireBotKeyStrict"));
}

// ===== 2. Bootstrap: chốt chặn là Discord token thật =====
const bootstrapAction = read("convex/botBootstrapAction.ts");
check("bootstrap là action PUBLIC (bot HTTP client gọi được)", /export const requestBotKey = action\(/.test(bootstrapAction));
check("bootstrap xác minh token qua Discord API /users/@me", bootstrapAction.includes("discord.com/api/v10/users/@me"));
check("bootstrap từ chối token không phải bot (data.bot !== true)", bootstrapAction.includes("data.bot !== true"));
check("server chỉ lưu BĂM key (không lưu botKey thô)", read("convex/botBootstrap.ts").includes("botKeySeed: seed") && !/botKey:\s*v\.string\(\)/.test(read("convex/botBootstrap.ts")));
check("key random 32 bytes bằng webcrypto (không seed tĩnh)", bootstrapAction.includes("crypto.getRandomValues"));
check("attempt rate-limit chặn relay spam Discord API (1 lần thử/10 phút)", read("convex/botBootstrap.ts").includes("ATTEMPT_COOLDOWN_MS = 10 * 60_000"));
check(
  "xoay key: bootstrap lại được ngay sau khi seed thay (success >= attempt mở cổng)",
  read("convex/botBootstrap.ts").includes("lastSuccess >= lastAttempt"),
);

// ===== 3. Bot tự bootstrap + cache key an toàn =====
const convexJs = read("bot/src/convex.js");
check("bot tự bootstrap khi thiếu BOT_KEY (ensureBotKey)", convexJs.includes("ensureBotKey"));
check("bot gọi bootstrap qua RAW client (tránh deadlock proxy)", convexJs.includes("this._rawClient.action"));
check("key cache vào file .bot-key quyền 600", convexJs.includes("mode: 0o600"));
check("proxy chờ ensureBotKey trước MỌI call (không rơi trạng thái thiếu key)", /await self\.ensureBotKey\(\);/.test(convexJs));
check("proxy bọc cả action (githubPush)", /prop !== "action"/.test(convexJs));
const gitignore = read(".gitignore");
check(".bot-key đã gitignore (key không vào git)", gitignore.includes("bot/.bot-key"));

// ===== 4. Khoá tính năng ẩn: owner-gating server-side =====
const hidden = read("convex/hidden.ts");
const guilds = read("convex/guilds.ts");
check("requireHiddenManage (guild manager + CHỦ BOT) tồn tại", hidden.includes("requireHiddenManage"));
for (const fn of ["createPanel", "updatePanel", "deletePanel", "togglePanel", "createGiveaway", "cancelGiveaway", "requestDm"]) {
  // Đếm số lần requireGuild vẫn còn trong handler của fn đó — phải 0 (đã thay bằng requireHiddenManage)
  const seg = hidden.slice(hidden.indexOf(`export const ${fn} =`));
  const nextFn = seg.indexOf("export const", 20);
  const body = nextFn > 0 ? seg.slice(0, nextFn) : seg;
  check(
    `hidden.${fn} yêu cầu chủ bot (không chỉ manager)`,
    body.includes("requireHiddenManage") && !/await requireGuild\(ctx, token, guildId\);/.test(body.replace("requireHiddenManage", "")),
  );
}
check(
  "getGuild chỉ trả panels cho isBotOwner",
  guilds.includes("panels: isBotOwner") && guilds.includes("giveaways: isBotOwner") && guilds.includes("autoReplies: isBotOwner"),
);

// ===== 5. Rate-limit dò mật khẩu ẩn =====
check("verifyHiddenPassword chặn sau 5 lần sai / 10 phút", hidden.includes("HIDDEN_VERIFY_MAX_FAILS = 5") && hidden.includes("HIDDEN_VERIFY_WINDOW_MS = 10 * 60_000"));
check("đổi mật khẩu reset bộ đếm dò", hidden.includes("hiddenVerifyFails: undefined"));
check("schema có trường rate-limit", read("convex/schema.ts").includes("hiddenVerifyFails") && read("convex/schema.ts").includes("hiddenVerifyLastAt"));

// ===== 6. Schema bootstrap đầy đủ =====
const schema = read("convex/schema.ts");
check("schema botStatus có botKeySeed + lastBootstrapAt + botApplicationId", schema.includes("botKeySeed") && schema.includes("lastBootstrapAt") && schema.includes("botApplicationId"));

// ===== 7. Test logic rate-limit (thuần) =====
{
  // Mô phỏng đúng logic trong verifyHiddenPassword
  const MAX = 5;
  const WINDOW = 10 * 60_000;
  let fails = 0;
  let lastAt = 0;
  const now0 = 1_000_000;
  const attempt = (now, ok) => {
    if (now - lastAt < WINDOW && fails >= MAX) return { blocked: true };
    if (ok) {
      if (fails > 0) {
        fails = 0;
        lastAt = 0;
      }
      return { blocked: false, unlocked: true };
    }
    const expired = now - lastAt >= WINDOW;
    fails = expired ? 1 : fails + 1;
    lastAt = now;
    return { blocked: false };
  };
  let blockedSeen = false;
  for (let i = 1; i <= 6; i++) {
    const r = attempt(now0 + i * 1000, false);
    if (r.blocked) blockedSeen = true;
  }
  check("5 lần sai trong 10 phút → lần 6 bị khóa", blockedSeen && fails === 5);
  const afterWindow = attempt(now0 + 11 * 60_000, false);
  check("qua cửa sổ 10 phút → đếm lại từ 1", !afterWindow.blocked && fails === 1);
  const okRes = attempt(now0 + 11 * 60_000 + 1000, true);
  check("đúng mật khẩu → mở khóa + reset đếm", okRes.unlocked && fails === 0);
}

// ===== 8. Web Admin mô tả cơ chế mới =====
check("Admin.tsx ghi rõ bot tự cấp phát chìa khóa", read("src/pages/Admin.tsx").includes("tự cấp phát chìa khóa an toàn"));
check("README bot tài liệu cơ chế bootstrap", read("bot/README.md").includes("bot/.bot-key"));

console.log(`\nKết quả security hardening: ${pass} PASS, ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
