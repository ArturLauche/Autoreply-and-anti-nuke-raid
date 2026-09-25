import { sha256Hex } from "./sha256";

/**
 * Chìa khóa cho các ACTION nguy hiểm (chỉ chạy Node runtime, có env process):
 *  - haimiya:ask — AI chat (tránh bị ăn cắp lượt gọi free tier).
 *
 * OAuth `sessionAuth:*` là public action có PKCE + allowlist redirect + rate-limit;
 * browser không có funcKey nên không thể dùng gate này cho OAuth.
 *
 * botKey = SHA-256("protogon-func-key::" + FUNC_SEED) — FUNC_SEED lưu trong env
 * của deployment (đặt qua Keys/UI hoặc `npx convex env set FUNC_SEED ...`).
 * Back-compat: chưa đặt FUNC_SEED → bỏ qua check (hành vi cũ).
 */

const FUNC_PREFIX = "protogon-func-key::";

export function computeFuncKey(funcSeed: string): string {
  return sha256Hex(`${FUNC_PREFIX}${funcSeed}`);
}

export function requireFuncKey(funcKey: string | undefined, funcSeed: string | undefined): void {
  if (!funcSeed) return; // chưa cấu hình → bỏ qua (back-compat)
  const validFuncKey = !!funcKey && funcKey === computeFuncKey(funcSeed);
  if (!validFuncKey) {
    throw new Error("Chìa khóa chức năng không hợp lệ (funcKey)");
  }
}

export { FUNC_PREFIX };
