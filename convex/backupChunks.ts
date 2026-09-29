/**
 * Backup quá trần 1 MB mỗi document của Convex — tách nhiều document.
 *
 * Vì sao cần: server lớn kèm tin nhắm (3000 tin × 2000 ký tự) nén xong vẫn có
 * thể vượt 1 MB, Convex từ chối ghi ⇒ trước đây người dùng chỉ có cách tắt
 * "kèm tin nhắn", tức là mất dữ liệu. Nay payload được cắt thành nhiều
 * document `backupChunks`, mỗi cái nằm trong trần, và ghép lại khi khôi phục.
 *
 * An toàn khi cắt: `backupJson` luôn đã qua zlib + base64 nên THUẦN ASCII —
 * cắt theo ký tự không bao giờ cắt giữa ký tự UTF-8 (đây là điều khiến cách
 * làm này an toàn hơn việc cắt JSON thô).
 */

/** Ký hiệu trong `guildBackups.backupJson` khi payload nằm ở chunk. */
export const CHUNKED_PREFIX = "chunked:";

/** Trên ngưỡng này thì bắt đầu tách chunk (chừa chỗ cho các field còn lại). */
export const MAX_INLINE_CHARS = 700_000;

/** Kích thước 1 chunk — 1 ký tự = 1 byte vì payload là base64. */
export const CHUNK_CHARS = 600_000;

export function isChunkedBackup(json: string | undefined): boolean {
  return typeof json === "string" && json.startsWith(CHUNKED_PREFIX);
}

/** Cắt payload thành các chunk, giữ nguyên thứ tự. */
export function splitBackupJson(json: string): string[] {
  const parts: string[] = [];
  for (let i = 0; i < json.length; i += CHUNK_CHARS) parts.push(json.slice(i, i + CHUNK_CHARS));
  return parts;
}

type ChunkReader = any;

/**
 * Ghép lại payload từ chunk. Trả `null` khi thiếu/lệch thứ tự chunk — caller
 * PHẢI báo lỗi tường minh thay vì khôi phục từ dữ liệu cụt: "khôi phục thành
 * công" nhưng thiếu nửa server còn tệ hơn là thất bại.
 */
export async function reassembleBackupJson(
  ctx: ChunkReader,
  backupId: unknown,
  expected: number,
): Promise<string | null> {
  const rows = await ctx.db
    .query("backupChunks")
    .withIndex("by_backupId", (q: any) => q.eq("backupId", backupId))
    .collect();
  if (rows.length !== expected) return null;
  rows.sort((a: any, b: any) => a.index - b.index);
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].index !== i) return null;
  }
  return rows.map((r: any) => r.data).join("");
}

/**
 * Đọc backupJson đầy đủ cho người đọc (bot, script audit): bản không tách
 * chunk thì trả nguyên bản; bản tách chunk thì ghép lại, hỏng thì trả null.
 */
export async function reassembleBackupJsonForRead(
  ctx: ChunkReader,
  backupId: unknown,
  backupJson: string,
  chunkCount: number | undefined,
): Promise<string | null> {
  if (!isChunkedBackup(backupJson)) return backupJson;
  if (!chunkCount || chunkCount <= 0) return null;
  return reassembleBackupJson(ctx, backupId, chunkCount);
}

/** Xoá chunk của một bản backup (khi bản cha bị prune/xoá — rác là tốn chỗ). */
export async function deleteBackupChunks(ctx: ChunkReader, backupId: unknown): Promise<void> {
  const rows = await ctx.db
    .query("backupChunks")
    .withIndex("by_backupId", (q: any) => q.eq("backupId", backupId))
    .collect();
  for (const row of rows) await ctx.db.delete(row._id);
}
