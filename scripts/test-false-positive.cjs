// Test gate chống ban nhầm của handleRaidJoin (joinClusterSuspicion) — pure function.
// Chạy: node scripts/test-false-positive.cjs
const { joinClusterSuspicion } = require("../bot/src/handlers/antinuke.js");

let pass = 0;
let fail = 0;
function check(label, cond) {
  console.log(cond ? `  ✅ ${label}` : `  ❌ ${label}`);
  cond ? pass++ : fail++;
}

const DAY = 86_400_000;
const now = Date.now();
const mk = (i, ageDays, hasAvatar, machine) => ({
  id: `u${i}`,
  username: machine ? `user${1000 + i}` : `Nguyễn Văn ${i}`,
  avatar: hasAvatar ? `hash${i}` : undefined,
  createdAt: now - ageDays * DAY,
  joinedAt: now,
});

console.log("Case 1: làn sóng thành viên THẬT (acc cũ, có avatar) → KHÔNG phạt");
{
  const profiles = Array.from({ length: 8 }, (_, i) => mk(i, 400, true, false));
  const sus = joinClusterSuspicion(profiles, now);
  console.log("   ", JSON.stringify(sus));
  check("ratio < 0.5 → bỏ qua", sus.ratio < 0.5);
  check("suspicious = 0", sus.suspicious === 0);
}

console.log("Case 2: RAID thật (acc mới, default avatar, username máy) → phạt");
{
  const profiles = Array.from({ length: 8 }, (_, i) => mk(i, 1, false, true));
  const sus = joinClusterSuspicion(profiles, now);
  console.log("   ", JSON.stringify(sus));
  check("ratio >= 0.5 → xử lý", sus.ratio >= 0.5);
  check("suspicious = 8/8", sus.suspicious === 8);
  check("freshAccounts = 8", sus.freshAccounts === 8);
}

console.log("Case 3: RAID hỗn hợp 60% acc mới → phạt");
{
  const raid = Array.from({ length: 5 }, (_, i) => mk(i, 2, false, true));
  const real = Array.from({ length: 3 }, (_, i) => mk(100 + i, 500, true, false));
  const sus = joinClusterSuspicion([...raid, ...real], now);
  console.log("   ", JSON.stringify(sus));
  check("ratio >= 0.5 → xử lý", sus.ratio >= 0.5);
}

console.log("Case 4: server viral — 1/8 acc mới (người quen mời bạn mới) → KHÔNG phạt");
{
  const real = Array.from({ length: 7 }, (_, i) => mk(i, 300, true, false));
  const oneNew = [mk(200, 3, true, false)]; // acc mới nhưng có avatar + tên người
  const sus = joinClusterSuspicion([...real, ...oneNew], now);
  console.log("   ", JSON.stringify(sus));
  check("ratio < 0.5 → bỏ qua", sus.ratio < 0.5);
}

console.log("Case 5: cụm rỗng → bỏ qua an toàn");
{
  const sus = joinClusterSuspicion([], now);
  check("total = 0 → bỏ qua", sus.total === 0);
}

process.exit(fail === 0 ? 0 : 1);
