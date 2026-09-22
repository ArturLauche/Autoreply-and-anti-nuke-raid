#!/usr/bin/env node
/**
 * run-all-tests.cjs — chạy toàn bộ test suites, tổng hợp kết quả, thoát khác 0
 * nếu có suite fail (dùng cho `npm test` và CI GitHub Actions).
 *
 * Suites nặng (restore e2e, security, restore pipeline) chạy SAU để fail sớm
 * ở các suite nhanh — phản hồi CI nhanh hơn.
 *
 * Cờ --ts: chạy các suite tầng Convex/Haimiya viết bằng TypeScript (bun).
 * Vì sao tách cờ: 5 suite .ts từng không nằm trong runner/CI nào — test có mà
 * không bao giờ chạy (91 assertion không bảo vệ gì). Tách khỏi luồng .cjs để
 * không đụng phép đo coverage của c8 (c8 chỉ include bot/src/**\/*.js).
 */
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const HEAVY = ["test-restore-e2e", "test-restore-pipeline", "test-security-hardening"];

const TS_MODE = process.argv.includes("--ts");

const suites = fs
  .readdirSync(__dirname)
  .filter((f) => (TS_MODE ? /^test-.*\.ts$/.test(f) : /^test-.*\.cjs$/.test(f)))
  .sort((a, b) => {
    if (TS_MODE) return a.localeCompare(b);
    const heavy = (n) => (HEAVY.some((h) => n.startsWith(h)) ? 1 : 0);
    return heavy(a) - heavy(b);
  });

// Không có suite nào = runner mất khả năng phát hiện (glob sai/đổi tên thư mục)
// → fail to, thay vì in "0/0 suites pass" rồi xanh.
if (suites.length === 0) {
  console.error(
    `❌ Không tìm thấy suite ${TS_MODE ? "test-*.ts" : "test-*.cjs"} nào trong scripts/ — kiểm tra lại glob.`,
  );
  process.exit(1);
}

const RUNNER = TS_MODE ? "bun" : "node";
console.log(`Chạy ${suites.length} test suites (${RUNNER})...\n`);

const failed = [];
const t0 = Date.now();
for (const suite of suites) {
  const s0 = Date.now();
  try {
    const out = execFileSync(RUNNER, [path.join(__dirname, suite)], {
      encoding: "utf8",
      timeout: 120_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    // Trích dòng tổng kết (pass/fail) nếu suite có in.
    const tail = out.trim().split("\n").slice(-1)[0];
    console.log(
      `✅ ${suite.replace(/\.(cjs|ts)$/, "")} (${((Date.now() - s0) / 1000).toFixed(1)}s) — ${tail}`,
    );
  } catch (e) {
    const out = `${e.stdout || ""}\n${e.stderr || ""}`;
    const fails = out
      .split("\n")
      .filter((l) => /^(FAIL|Error|ERROR)/.test(l.trim()))
      .slice(0, 5);
    console.error(`❌ ${suite.replace(/\.(cjs|ts)$/, "")} — THẤT BẠI`);
    for (const f of fails) console.error(`   ${f}`);
    failed.push(suite);
  }
}

const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(
  `\n${failed.length === 0 ? "✅" : "❌"} ${suites.length - failed.length}/${suites.length} suites pass (${secs}s)`,
);
if (failed.length > 0) {
  console.error(`Suites thất bại: ${failed.join(", ")}`);
  process.exit(1);
}
