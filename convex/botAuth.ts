import { type QueryCtx, type MutationCtx, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { getBotStatus } from "./hidden";
import { sha256Hex } from "./sha256";

/**
 * Chìa khóa dùng chung cho các function chỉ bot được gọi.
 *
 * Convex không có IP allowlist, và các function "bot*" hiện không có hàng rào
 * nào — bất kỳ ai cũng có thể ghi dữ liệu giả (heartbeat giả, backup giả,
 * schedule lockdown giả, nhiệt độ giả, cướp backup JSON…). Fix: mọi function
 * bot-side phải gửi đúng `botKey`, tạo từ OWNER_SEED (env trên Convex — điền
 * qua Keys/UI hoặc `npx convex env set OWNER_SEED ...`):
 *
 *   botKey = SHA-256("protogon-bot-key::" + OWNER_SEED)
 *
 * Bot tính cùng chuỗi này từ OWNER_SEED trong .env trên VPS. Kẻ tấn công không
 * có OWNER_SEED thì không tính được botKey, dù biết đầy đủ source code.
 *
 * Back-compat: nếu OWNER_SEED chưa đặt (bot cũ chưa update), check được bỏ qua
 * (chính xác như hành vi trước đây). Đặt OWNER_SEED để kích hoạt bảo vệ.
 */

const KEY_PREFIX = "protogon-bot-key::";

/** SHA-256 (chạy được cả trong mutation/query lẫn client) — tái dùng sha256 thuần TS. */

export function computeBotKey(ownerSeed: string): string {
  return sha256Hex(`${KEY_PREFIX}${ownerSeed}`);
}

/**
 * Đọc OWNER_SEED từ env của deployment. OWNER_SEED là biến "use node"-independent:
 * query/mutation của Convex đọc được env process thông qua V8 runtime env — thực tế
 * Convex chỉ expose process.env trong actions ("use node"). Do đó seed được lưu
 * trong bảng botStatus (do chủ bot đặt 1 lần qua admin web) thay vì env.
 */
export async function requireBotKey(
  ctx: QueryCtx | MutationCtx | ActionCtx,
  botKey: string | undefined,
): Promise<void> {
  // Action không có db trực tiếp — đọc seed qua internal query.
  const status = "db" in ctx
    ? await getBotStatus(ctx)
    : await ctx.runQuery(internal.hidden.getBotStatusInternal);
  const seed = status?.botKeySeed;
  // Chưa cài seed → chưa kích hoạt (giữ back-compat với bot cũ).
  if (!seed) return;
  if (!botKey || computeBotKey(botKey) !== seed) {
    throw new Error("Chìa khóa bot không hợp lệ (botKey)");
  }
}

/** Sinh chuỗi botKey từ OWNER_SEED — dùng ở Admin web (chỉ chủ bot) + trên VPS. */
export { KEY_PREFIX };
