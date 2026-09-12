// Test gate chống ban nhầm: joinClusterSuspicion (cụm) + memberSuspicionScore
// (cá nhân trong cụm hỗn hợp). Pure functions — chạy: node scripts/test-false-positive.cjs
const { joinClusterSuspicion, memberSuspicionScore } = require("../bot/src/handlers/antinuke.js");

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

console.log("Case 3: RAID hỗn hợp 60% acc mới → cụm được xử lý");
{
  const raid = Array.from({ length: 5 }, (_, i) => mk(i, 2, false, true));
  const real = Array.from({ length: 3 }, (_, i) => mk(100 + i, 500, true, false));
  const sus = joinClusterSuspicion([...raid, ...real], now);
  console.log("   ", JSON.stringify(sus));
  check("ratio >= 0.5 → xử lý", sus.ratio >= 0.5);
}

console.log("Case 3b: cụm hỗn hợp — gate TỪNG tài khoản bảo vệ người thật");
{
  const raid = Array.from({ length: 5 }, (_, i) => mk(i, 2, false, true));
  const real = Array.from({ length: 3 }, (_, i) => mk(100 + i, 500, true, false));
  const punished = [...raid, ...real].filter((p) => memberSuspicionScore(p, now) >= 3);
  const skipped = [...raid, ...real].filter((p) => memberSuspicionScore(p, now) < 3);
  check("chỉ phạt 5 acc raid", punished.length === 5);
  check("bỏ qua cả 3 thành viên thật", skipped.length === 3);
  check("thành viên thật nằm hết trong skipped", skipped.every((p) => p.id.startsWith("u1")));
}

console.log("Case 4: server viral — 1/8 acc mới (người quen mời bạn mới) → KHÔNG phạt");
{
  const real = Array.from({ length: 7 }, (_, i) => mk(i, 300, true, false));
  const oneNew = [mk(200, 3, true, false)]; // acc mới nhưng có avatar + tên người
  const sus = joinClusterSuspicion([...real, ...oneNew], now);
  check("ratio < 0.5 → bỏ qua", sus.ratio < 0.5);
  // và gate cá nhân (ngưỡng 3) cũng không phạt ai
  check("gate cá nhân: không ai đủ điểm 3", [...real, ...oneNew].every((p) => memberSuspicionScore(p, now) < 3));
}

console.log("Case 5: cụm rỗng / thiếu dữ liệu → bỏ qua an toàn");
{
  const sus = joinClusterSuspicion([], now);
  check("total = 0 → bỏ qua", sus.total === 0);
  check("profile null → điểm 0", memberSuspicionScore(null, now) === 0);
}

console.log("Case 6: acc mới NHƯNG có avatar + tên người (bạn bè thật) → không phạt");
{
  const p = mk(300, 2, true, false);
  check("điểm < 3 → không phạt (acc mới một mình chưa đủ)", memberSuspicionScore(p, now) < 3);
}

console.log("Case 7: acc mới + default avatar (nghi raid) → điểm >= 3 → phạt");
{
  const p = mk(301, 2, false, false); // acc mới + avatar mặc định, tên người
  check("điểm >= 3 → đáng ngờ", memberSuspicionScore(p, now) >= 3);
}

console.log("Case 8: cụm hỗn hợp thật (raid bot + bạn bè thật mới lập acc) → chỉ raid bị phạt");
{
  const raid = Array.from({ length: 5 }, (_, i) => mk(i, 1, false, true)); // acc mới + default avatar + tên máy → điểm 4
  const realNew = Array.from({ length: 2 }, (_, i) => mk(400 + i, 3, true, false)); // bạn thật, acc 3 ngày, có avatar → điểm 0
  const punished = [...raid, ...realNew].filter((p) => memberSuspicionScore(p, now) >= 3);
  check("chỉ 5 acc raid bị phạt", punished.length === 5);
  check("bạn thật acc mới không bị phạt", realNew.every((p) => memberSuspicionScore(p, now) < 3));
}

console.log(`\nKết quả: ${pass} PASS, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
