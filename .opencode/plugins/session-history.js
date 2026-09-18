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

const DEFAULT_TTL_DAYS = 14;

export const SessionHistoryPlugin = async ({ $ }) => {
  const dir = join(homedir(), ".config", "opencode", "history");
  const file = join(dir, "sessions.jsonl");

  async function ensureDir() {
    await $`mkdir -p ${dir}`.quiet().catch(() => {});
  }

  // Trả về số mục đã dọn (0 = không có gì quá hạn).
  async function pruneExpired() {
    const ttlDays = Number(process.env.AGENT_HISTORY_TTL_DAYS ?? DEFAULT_TTL_DAYS);
    if (!Number.isFinite(ttlDays) || ttlDays <= 0) return 0; // 0 = tắt dọn, giữ vô hạn
    try {
      const raw = await $`cat ${file}`.quiet().text().catch(() => "");
      if (!raw.trim()) return 0;
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
        await $`printf %s ${kept.join("\n") + (kept.length ? "\n" : "")}`.redirection("> " + file);
      }
      return pruned;
    } catch {
      return 0; // lỗi dọn không được phép ảnh hưởng phiên làm việc
    }
  }

  async function append(entry) {
    try {
      await ensureDir();
      await pruneExpired();
      await $`printf %s\n ${JSON.stringify(entry)}`.redirection(">> " + file);
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
