// TEST Rate-guard chống đốt usage — tầng guard cho action public không auth.
// Chạy: bun scripts/test-rate-guard.ts
// Gọi trực tiếp hàm guard + handler thật của publicConfig/aiStatus (mock ctx)
// để xác minh: vượt trần → fallback NHẸ (không chạm DB) + hợp đồng no-throw.
import { rateLimitPublicAction, __resetRateGuardForTest } from "../convex/rateGuard";
import { publicConfig } from "../convex/public";
import { aiStatus } from "../convex/haimiya";

let pass = 0;
let fail = 0;
const check = (label: string, ok: boolean) => {
  console.log(ok ? `  ✅ ${label}` : `  ❌ ${label}`);
  if (ok) pass++;
  else fail++;
};

const publicConfigHandler = (publicConfig as any)._handler;
const aiStatusHandler = (aiStatus as any)._handler;
if (typeof publicConfigHandler !== "function" || typeof aiStatusHandler !== "function") {
  console.error("Không lấy được handler từ Convex action — cấu trúc convex thay đổi?");
  process.exit(1);
}

console.log("── rateGuard: sliding window per-identity ──");

// 1. Trong trần → ok.
__resetRateGuardForTest();
let ctx: any = { auth: { getIdentity: () => "user-A" } };
let allOk = true;
for (let i = 0; i < 30; i++) {
  if (!rateLimitPublicAction(ctx, { name: "publicConfig", maxPerMin: 30, globalMaxPerMin: 600 }).ok)
    allOk = false;
}
check("30 lần trong trần → tất cả ok", allOk);

// 2. Vượt trần per-identity → chặn.
check(
  "lần thứ 31 trong 1 phút → bị chặn",
  !rateLimitPublicAction(ctx, { name: "publicConfig", maxPerMin: 30, globalMaxPerMin: 600 }).ok,
);

// 3. Identity khác không bị ảnh hưởng (bucket tách riêng).
__resetRateGuardForTest();
ctx = { auth: { getIdentity: () => "user-B" } };
allOk = true;
for (let i = 0; i < 40; i++) {
  if (!rateLimitPublicAction(ctx, { name: "aiStatus", maxPerMin: 30, globalMaxPerMin: 600 }).ok)
    allOk = false;
}
check("user-B gọi 40 lần chỉ bị chặn từ lần 31", allOk === false); // 31..40 bị chặn
__resetRateGuardForTest();
const userC = { auth: { getIdentity: () => "user-C" } };
allOk = true;
for (let i = 0; i < 30; i++) {
  if (
    !rateLimitPublicAction(userC, { name: "publicConfig", maxPerMin: 30, globalMaxPerMin: 600 }).ok
  )
    allOk = false;
}
check("user-C (identity khác) vẫn đủ 30 lượt đầu", allOk);

// 3b. Convex thực tế trả identity object; guard phải dùng subject, không bỏ qua bucket.
__resetRateGuardForTest();
const objectCtx: any = { auth: { getIdentity: () => ({ subject: "user-object" }) } };
const objectFirst = rateLimitPublicAction(objectCtx, {
  name: "publicConfig",
  maxPerMin: 1,
  globalMaxPerMin: 10,
}).ok;
const objectSecond = rateLimitPublicAction(objectCtx, {
  name: "publicConfig",
  maxPerMin: 1,
  globalMaxPerMin: 10,
}).ok;
check("identity object dùng subject và vẫn bị giới hạn", objectFirst && !objectSecond);

__resetRateGuardForTest();
const tokenCtx: any = {
  auth: { getIdentity: () => ({ tokenIdentifier: "token-identity" }) },
};
const tokenFirst = rateLimitPublicAction(tokenCtx, {
  name: "publicConfig",
  maxPerMin: 1,
  globalMaxPerMin: 10,
}).ok;
const tokenSecond = rateLimitPublicAction(tokenCtx, {
  name: "publicConfig",
  maxPerMin: 1,
  globalMaxPerMin: 10,
}).ok;
check("identity object fallback tokenIdentifier vẫn bị giới hạn", tokenFirst && !tokenSecond);

__resetRateGuardForTest();
const anonymousObjectCtx: any = { auth: { getIdentity: () => ({ opaque: true }) } };
check(
  "identity object không có subject/tokenIdentifier vẫn dùng anonymous/global",
  rateLimitPublicAction(anonymousObjectCtx, {
    name: "publicConfig",
    maxPerMin: 1,
    globalMaxPerMin: 10,
  }).ok &&
    rateLimitPublicAction(anonymousObjectCtx, {
      name: "publicConfig",
      maxPerMin: 1,
      globalMaxPerMin: 10,
    }).ok,
);

// 4. Trần toàn cục chặn cả identity mới (botnet).
__resetRateGuardForTest();
allOk = true;
const users: string[] = [];
for (let i = 0; i < 700; i++) users.push(`botnet-${i}`);
for (const u of users) {
  const r = rateLimitPublicAction(
    { auth: { getIdentity: () => u } },
    { name: "publicConfig", maxPerMin: 30, globalMaxPerMin: 600 },
  );
  if (!r.ok) {
    allOk = false;
    break;
  }
}
check("botnet 600 identity → chặn trước khi hết (trần toàn cục)", !allOk);

// 5. Bucket tách theo endpoint (không trộn lẫn).
__resetRateGuardForTest();
allOk = true;
for (let i = 0; i < 30; i++) {
  if (
    !rateLimitPublicAction(userC, { name: "publicConfig", maxPerMin: 30, globalMaxPerMin: 600 }).ok
  )
    allOk = false;
}
check(
  "hết trần publicConfig nhưng aiStatus vẫn ok",
  allOk &&
    rateLimitPublicAction(userC, { name: "aiStatus", maxPerMin: 60, globalMaxPerMin: 1200 }).ok,
);

console.log("── handler thật: hợp đồng no-throw khi bị rate-limit ──");

// 6. publicConfig handler khi guard chặn: phải TRẢ object (không throw) + cờ rateLimited.
__resetRateGuardForTest();
const anonCtx: any = { auth: { getIdentity: async () => null } };
allOk = true;
let last: any = null;
for (let i = 0; i < 700; i++) {
  try {
    last = await publicConfigHandler(anonCtx, {});
    if (last?.rateLimited === true) break;
  } catch {
    allOk = false;
    break;
  }
}
check(
  "publicConfig: 700 call ẩn danh → không throw, trả rateLimited=true",
  allOk && last?.rateLimited === true,
);
check(
  "publicConfig fallback vẫn đủ clientId/invite/facebook",
  typeof last?.clientId === "string" &&
    typeof last?.discordInvite === "string" &&
    typeof last?.facebookUrl === "string",
);

// 7. aiStatus handler khi guard chặn: trả configured=false, không throw.
__resetRateGuardForTest();
allOk = true;
last = null;
for (let i = 0; i < 1300; i++) {
  try {
    last = await aiStatusHandler(anonCtx, {});
    if (last?.rateLimited === true) break;
  } catch {
    allOk = false;
    break;
  }
}
check(
  "aiStatus: 1300 call ẩn danh → không throw, trả rateLimited=true",
  allOk && last?.rateLimited === true,
);
check(
  "aiStatus fallback configured=false + model null",
  last?.configured === false && last?.model === null,
);

console.log(`\nKết quả: ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
