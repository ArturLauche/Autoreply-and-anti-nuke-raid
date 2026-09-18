#!/usr/bin/env node
/**
 * test-agent-history.cjs — kiểm tra plugin "hộp lịch sử làm việc" (18/09/2026).
 *
 * Plugin .opencode/plugins/session-history.js ghi mỗi sự kiện phiên vào
 * ~/.config/opencode/history/sessions.jsonl và TỰ DỌN mục quá hạn TTL
 * (AGENT_HISTORY_TTL_DAYS, mặc định 14 ngày, 0 = giữ vô hạn).
 *
 * Suite này KHÔNG nạp plugin (plugin cần runtime OpenCode) — thay vào đó
 * khóa chắc 3 thứ mà nếu hỏng là hộp lịch sử thành vô dụng hoặc trở thành
 * rò rỉ secret:
 *   1. Plugin tồn tại đúng vị trí auto-load + khai báo đủ hook `event`
 *   2. Logic TTL/dọn tái tạo độc lập phải khớp hành vi mong đợi:
 *      quá hạn → bị dọn, còn hạn → giữ, 0/ttl sai → không dọn, JSON hỏng → giữ
 *   3. Plugin KHÔNG bao giờ ghi nội dung nhạy cảm vào hộp lịch sử
 *      (không giá trị env, không token) — chỉ metadata phiên
 *
 * Chạy: node scripts/test-agent-history.cjs
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PLUGIN = path.join(ROOT, ".opencode", "plugins", "session-history.js");
const COMMAND = path.join(ROOT, ".opencode", "commands", "history.md");

let pass = 0;
let fail = 0;
function check(label, cond) {
  if (cond) {
    pass++;
    console.log(`PASS ${label}`);
  } else {
    fail++;
    console.error(`FAIL ${label}`);
  }
}

// ─── 1. Plugin tồn tại + khai báo đúng hook ─────────────────────────────────
const pluginSrc = fs.readFileSync(PLUGIN, "utf8");

check("plugin tồn tại đúng thư mục auto-load (.opencode/plugins)",
  fs.existsSync(PLUGIN));
check("plugin đăng ký hook `event` (nghe session.created/idle/error)",
  /event:\s*async\s*\(\{\s*event\s*\}\)/.test(pluginSrc));
check("plugin nghe đủ 3 sự kiện created/idle/error",
  pluginSrc.includes('"session.created"') &&
  pluginSrc.includes('"session.idle"') &&
  pluginSrc.includes('"session.error"'));
check("lỗi ghi/dọn bị nuốt (không được làm rớt phiên)",
  /catch/.test(pluginSrc) && pluginSrc.includes("best-effort"));
check("lệnh /history tồn tại kèm mô tả",
  fs.existsSync(COMMAND) && fs.readFileSync(COMMAND, "utf8").includes("description:"));

// ─── 2. Logic TTL/dọn — tái tạo độc lập và đối chiếu hành vi ────────────────
function pruneLikePlugin(raw, ttlDays, now) {
  if (!Number.isFinite(ttlDays) || ttlDays <= 0) return { kept: raw.split("\n").filter(Boolean), pruned: 0 };
  const cutoff = now - ttlDays * 24 * 60 * 60 * 1000;
  const kept = [];
  let pruned = 0;
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if ((entry.at ?? 0) >= cutoff) kept.push(line);
      else pruned++;
    } catch {
      kept.push(line);
    }
  }
  return { kept, pruned };
}

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;
const mk = (at, i) => JSON.stringify({ at, event: "created", sessionId: `ses_${i}`, title: `phiên ${i}` });
const FRESH = [mk(NOW, 1), mk(NOW - 3 * DAY, 2)];
const OLD = [mk(NOW - 20 * DAY, 3), mk(NOW - 30 * DAY, 4)];

const r1 = pruneLikePlugin(FRESH.concat(OLD).join("\n"), 14, NOW);
check("TTL 14 ngày: giữ mục còn hạn", r1.kept.length === 2);
check("TTL 14 ngày: dọn đúng 2 mục quá hạn", r1.pruned === 2);

const r2 = pruneLikePlugin(FRESH.concat(OLD).join("\n"), 0, NOW);
check("TTL 0 = tắt dọn, giữ vô hạn", r2.pruned === 0 && r2.kept.length === 4);

const r3 = pruneLikePlugin(FRESH.concat(OLD).join("\n"), -5, NOW);
check("TTL âm (giá trị sai) không dọn gì — an toàn mặc định", r3.pruned === 0);

const r4 = pruneLikePlugin('{"at":"hỏng",\n' + FRESH[0], 14, NOW);
check("dòng JSON hỏng được giữ lại, không mất dữ liệu", r4.kept.length === 2 && r4.pruned === 0);

const r5 = pruneLikePlugin("", 14, NOW);
check("hộp trống → không lỗi, không dọn", r5.pruned === 0 && r5.kept.length === 0);

// ─── 3. An toàn: hộp lịch sử chỉ chứa metadata, không chứa secret ───────────
check("plugin không ghi giá trị env/biến môi trường vào lịch sử",
  !/process\.env\.[A-Z_]*(KEY|TOKEN|SECRET|PASSWORD)/.test(pluginSrc.replace(/AGENT_HISTORY_TTL_DAYS/g, "")));
// .env/.bot-key chỉ bị cấm với tư cách TÊN FILE (đứng sau quote/slash/khoảng
// trắng) — `process.env.TÊN_BIẾN` là truy cập biến môi trường bình thường,
// plugin cần nó để đọc TTL và không phải vi phạm.
check("plugin không đọc/ghi file .env/.bot-key",
  !/(["'\s/])\.env(["'\s]|$)/.test(pluginSrc) &&
  !pluginSrc.includes(".bot-key"));
check("plugin chỉ ghi trường metadata cho phép (at/event/sessionId/title/directory/error)",
  !/"(?:content|message|prompt|diff|output)"/.test(pluginSrc.replace(/"error"/g, "")));
check("nội dung error bị cắt ngắn (300 ký tự) — tránh nhét cả stack/log dài",
  /slice\(0,\s*300\)/.test(pluginSrc));

// ─── 4. Config TTL mặc định được khai báo trong opencode.json ───────────────
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "opencode.json"), "utf8"));
check("opencode.json đặt AGENT_HISTORY_TTL_DAYS mặc định 14",
  cfg.env && cfg.env.AGENT_HISTORY_TTL_DAYS === "14");

// ─── Tổng kết ────────────────────────────────────────────────────────────────
console.log(`\nKết quả agent-history: ${pass} PASS, ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
