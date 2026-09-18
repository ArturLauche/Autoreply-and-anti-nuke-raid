// Plugin session-history — "hộp lưu lịch sử làm việc" cho agent trên VPS.
//
// Ý tưởng (yêu cầu của chủ bot 18/09/2026): mỗi phiên làm việc của OpenCode
// được ghi một dòng tóm tắt vào một hộp lịch sử riêng; sau khoảng thời gian
// tùy chọn (mặc định 14 ngày) mục cũ tự bị dọn — đúng tinh thần "history
// có hạn sử dụng" thay vì chất đống mãi mãi.
//
// Cách hoạt động:
//   - Hook `event` lắng nghe session.created / session.idle / session.error
//   - Ghi mỗi mục dạng JSONL vào ~/.config/opencode/history/sessions.jsonl
//     (một dòng một phiên — dễ đọc bằng tail/jq, không cần DB)
//   - Dọn mục quá hạn NGAY TRƯỚC KHI ghi mục mới: rẻ, không cần cron, không
//     chặn phiên (lỗi dọn bị nuốt, không bao giờ làm rớt phiên làm việc)
//   - TTL đọc từ biến môi trường AGENT_HISTORY_TTL_DAYS (mặc định 14, set 0
//     để tắt hẳn auto-dọn — giữ vô hạn)
//   - Công cụ /history trong .opencode/commands đọc hộp này cho người dùng
//
// Plugin chạy local qua Bun shell ($) — không phụ thuộc mạng, không token AI.

import { join } from "path";
import { homedir } from "os";
import fs from "fs";

const DEFAULT_TTL_DAYS = 14;

export const SessionHistoryPlugin = async () => {
  const dir = join(homedir(), ".config", "opencode", "history");
  const file = join(dir, "sessions.jsonl");

  // Ghi nối tiếp dùng fs API đồng bộ — Bun Shell KHÔNG có .redirection()
  // (đã xác minh: TypeError at runtime), dùng nó là lịch sử mất im lặng.
  // mkdir recursive: thư mục history chưa tồn tại cũng ghi được ngay.
  function appendLine(line) {
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(file, line);
  }

  // Trả về số mục đã dọn (0 = không có gì quá hạn). Ghi/dọn bằng fs API —
  // shell chỉ dùng cho mkdir (best-effort).
  async function pruneExpired() {
    const ttlDays = Number(process.env.AGENT_HISTORY_TTL_DAYS ?? DEFAULT_TTL_DAYS);
    if (!Number.isFinite(ttlDays) || ttlDays <= 0) return 0; // 0 = tắt dọn, giữ vô hạn
    try {
      let raw = "";
      try {
        raw = fs.readFileSync(file, "utf8");
      } catch {
        return 0; // file chưa tồn tại
      }
      const cutoff = Date.now() - ttlDays * 24 * 60 * 60 * 1000;
      const kept = [];
      let pruned = 0;
      for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          if ((entry.at ?? 0) >= cutoff) kept.push(line);
          else pruned++;
        } catch {
          kept.push(line); // dòng hỏng: giữ lại, đừng mất dữ liệu người dùng
        }
      }
      if (pruned > 0) {
        fs.writeFileSync(file, kept.length ? kept.join("\n") + "\n" : "");
      }
      return pruned;
    } catch {
      return 0; // lỗi dọn không được phép ảnh hưởng phiên làm việc
    }
  }

  async function append(entry) {
    try {
      appendLine(JSON.stringify(entry) + "\n");
      await pruneExpired();
    } catch {
      // Ghi lịch sử là best-effort — thất bại không được làm rớt phiên.
    }
  }

  return {
    event: async ({ event }) => {
      if (event.type === "session.created") {
        await append({
          at: Date.now(),
          event: "created",
          sessionId: event.properties?.info?.id ?? "",
          title: event.properties?.info?.title ?? "(chưa đặt tên)",
          directory: event.properties?.info?.directory ?? "",
        });
      } else if (event.type === "session.idle") {
        await append({
          at: Date.now(),
          event: "idle", // phiên hoàn thành một lượt làm việc
          sessionId: event.properties?.sessionID ?? "",
        });
      } else if (event.type === "session.error") {
        await append({
          at: Date.now(),
          event: "error",
          sessionId: event.properties?.sessionID ?? "",
          error: String(event.properties?.error ?? "").slice(0, 300),
        });
      }
    },
  };
};
