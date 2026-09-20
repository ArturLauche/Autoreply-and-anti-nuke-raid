#!/usr/bin/env node
/**
 * test-bot-contracts.cjs — lá chắn hợp đồng bot (20/09/2026).
 *
 * Chặn tái diễn 4 bug thật tìm thấy khi review bot/src/:
 *  1. messages.js gọi relayClient.reportSignatureBatch 2 LẦN trong nhánh raid —
 *     Convex dedupe tăng weight cho mỗi lần gọi → 1 server tự nâng weight
 *     signature 1→2, vượt MIN_WEIGHT_AGED=2 rồi signature "xác nhận bởi 1
 *     server" được phân phối toàn mạng (vỡ chống đầu độc relay).
 *  2. joinGate burst auto-lockdown chỉ gọi botUpdateLockdown (bật cờ tính
 *     năng) mà KHÔNG gọi botLockState { until } → lockdownUntil không bao giờ
 *     được ghi → tickUnlocks không bao giờ mở khóa → server khóa kênh vĩnh viễn.
 *  3. interactionCreate khai báo verifyAttempts (rate-limit captcha DM) nhưng
 *     KHÔNG BAO GIỜ kiểm tra → spam nút "Nhận mã xác minh" = bot DM vô hạn.
 *  4. captchaStore.verifyCode không hủy mã khi sai → brute-force 10^6 tổ hợp
 *     trong cửa sổ 5 phút đoán trúng mã 6 chữ số không cần DM.
 *
 * Hermetic: regex đọc source + require trực tiếp captchaStore (pure CommonJS).
 * Chạy: node scripts/test-bot-contracts.cjs
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
let pass = 0;
let fail = 0;
function check(label, cond) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    console.error(`  ❌ ${label}`);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

// ─── 1. Threat relay: nhánh raid massMessage chỉ đóng góp signature 1 lần ───
const messagesSrc = read("bot/src/handlers/antinuke/messages.js");
const relayCalls = [...messagesSrc.matchAll(/reportSignatureBatch\(/g)].length;
check(
  "nhánh raid chỉ gọi reportSignatureBatch 1 lần (không double-report nâng weight oan)",
  relayCalls === 2, // 1 trong handleMessagePatterns + 1 trong handleSpam
  `hiện ${relayCalls} chỗ gọi trong messages.js`,
);

// ─── 2. Burst auto-lockdown phải đặt hạn mở khóa trên Convex ─────────────────
const joinGateSrc = read("bot/src/handlers/joinGate.js");
check(
  "joinGate burst lockdown gọi botLockState (ghi lockdownUntil để tickUnlocks mở được)",
  /bot_writes:botLockState/.test(joinGateSrc),
  "thiếu botLockState — server sẽ bị khóa kênh vĩnh viễn sau burst",
);
// botUpdateLockdown không đặt lockdownUntil phía Convex — chỉ là cờ tính năng.
const botWritesSrc = read("convex/bot_writes.ts");
const updateLockdownBody = botWritesSrc.match(
  /export const botUpdateLockdown = mutation\(\{[\s\S]*?\n\}\);/,
)?.[0];
check(
  "botUpdateLockdown KHÔNG ghi lockdownUntil (đặc tính — nên luồng khóa thật phải qua botLockState)",
  !!updateLockdownBody && !updateLockdownBody.includes("lockdownUntil"),
);

// ─── 3. Rate-limit captcha DM phải được KIỂM TRA, không chỉ khai báo ─────────
const interactionSrc = read("bot/src/handlers/interactionCreate.js");
const hasMap = /const verifyAttempts = new Map\(\)/.test(interactionSrc);
// Kiểm tra thật: trong nhánh verify_request_captcha, trước khi setCode phải có
// check verifyAttempts.get + trả lời chặn khi vượt hạn mức.
const captchaBranch = interactionSrc.slice(
  interactionSrc.indexOf('customId === "verify_request_captcha"'),
  interactionSrc.indexOf("// Tạo mã captcha và gửi DM"),
);
check("verifyAttempts được khai báo", hasMap);
check(
  "nút nhận mã captcha kiểm tra rate-limit TRƯỚC khi tạo mã (chặn DM vô hạn)",
  /verifyAttempts\.get\(/.test(captchaBranch) && /attempts\.attempts >= \d+/.test(captchaBranch),
  "Map chỉ khai báo + dọn dẹp nhưng không bao giờ được check — rate-limit chết",
);

// ─── 4. Captcha chống brute-force: sai quá hạn mức phải HỦY mã ───────────────
const captchaStore = require("../bot/src/captchaStore");
check(
  "captchaStore xuất MAX_WRONG_ATTEMPTS (hợp đồng chống brute-force)",
  Number.isInteger(captchaStore.MAX_WRONG_ATTEMPTS) && captchaStore.MAX_WRONG_ATTEMPTS >= 3,
);
{
  const GUILD = "guild-test";
  const USER = "user-bruteforce";
  captchaStore.setCode(GUILD, USER, "123456");
  let canceled = false;
  let correctAfter = false;
  for (let i = 0; i < captchaStore.MAX_WRONG_ATTEMPTS; i++) {
    captchaStore.verifyCode(GUILD, USER, "000000");
    // Sau lượt sai cuối, mã phải đã bị hủy — lượt đoán ĐÚNG tiếp theo vẫn fail.
    if (i === captchaStore.MAX_WRONG_ATTEMPTS - 1) {
      const okTry = captchaStore.verifyCode(GUILD, USER, "123456");
      correctAfter = okTry.ok === true;
      canceled = okTry.reason === "no_code";
    }
  }
  check(
    `sai ${captchaStore.MAX_WRONG_ATTEMPTS} lần → mã bị hủy (đoán đúng sau đó vẫn fail)`,
    canceled && !correctAfter,
    "mã vẫn sống sau nhiều lượt sai — brute-force 10^6 tổ hợp trong 5 phút khả thi",
  );
  // Trường hợp đúng mã lần đầu vẫn hoạt động như cũ.
  captchaStore.setCode(GUILD, "u2", "654321");
  const ok = captchaStore.verifyCode(GUILD, "u2", "654321");
  check("đoán đúng lần đầu vẫn pass (không phá luồng verify thường)", ok.ok === true);
  // Một lượt sai đơn lẻ KHÔNG hủy mã (người thật gõ nhầm được tha thứ).
  captchaStore.setCode(GUILD, "u3", "111222");
  captchaStore.verifyCode(GUILD, "u3", "999999");
  const still = captchaStore.verifyCode(GUILD, "u3", "111222");
  check("1 lượt sai không hủy mã (người gõ nhầm vẫn xác minh được)", still.ok === true);
}

console.log(`\nKết quả bot contracts: ${pass} PASS, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
