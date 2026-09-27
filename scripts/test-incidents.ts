// TEST: incidents — gom sự kiện thành sự cố (convex/incidents.ts).
// Chạy: bun scripts/test-incidents.ts
//
// Vì sao test hàm gom, không test UI: sai ở đây là SAI NGỮ NGHĨA — gom quá
// rộng thì 3 người khác nhau bị gộp thành "một sự cố" (chủ server bị quy
// trách oan), gom quá hẹp thì về đúng lịch sử thô như cũ (tính năng vô
// nghĩa). Ba ranh giới phải khoá: cửa sổ 15 phút, khác người, khác hành vi.
import { groupIntoIncidents, INCIDENT_WINDOW_MS, type RawIncidentEvent } from "../convex/incidents";

let pass = 0;
let fail = 0;
const check = (label: string, ok: boolean) => {
  console.log(ok ? `  ✅ ${label}` : `  ❌ ${label}`);
  if (ok) pass++;
  else fail++;
};

const T = 1_700_000_000_000;
const ev = (o: Partial<RawIncidentEvent> & { createdAt: number }): RawIncidentEvent => ({
  kind: "antinuke",
  module: "massJoin",
  action: "kick",
  executorId: "u1",
  executorName: "raider",
  count: 1,
  ...o,
});

console.log("── Gom cụm: cửa sổ 15 phút ──");

// 1. Sự kiện liên tiếp cùng người/cùng hành vi trong 15 phút → 1 sự cố.
{
  const inc = groupIntoIncidents([
    ev({ createdAt: T, count: 5 }),
    ev({ createdAt: T + 60_000, count: 3 }),
    ev({ createdAt: T + 14 * 60_000, count: 2 }),
  ]);
  check("3 sự kiện trong 15 phút → 1 sự cố", inc.length === 1);
  check("gộp đủ 3 dòng", inc[0].events === 3);
  check("cộng dồn số lần chặn (5+3+2=10)", inc[0].blocked === 10);
  check("firstAt = sự kiện đầu", inc[0].firstAt === T);
  check("lastAt = sự kiện cuối", inc[0].lastAt === T + 14 * 60_000);
}

// 2. Quá 15 phút kể từ sự kiện TRƯỚC → tách cụm. Biên: đúng bằng 15 phút vẫn
// chung (> mới tách). Cửa sổ tính từ sự kiện liền trước, không chia đều theo
// giờ — nên một đợt dài vẫn là một sự cố (xem case 3).
{
  const inc = groupIntoIncidents([
    ev({ createdAt: T }),
    ev({ createdAt: T + INCIDENT_WINDOW_MS }),
    ev({ createdAt: T + 2 * INCIDENT_WINDOW_MS + 1 }),
  ]);
  check("cách đúng 15 phút vẫn chung 1 cụm", inc[0].events === 2);
  check("cách 15 phút + 1ms từ sự kiện trước → tách", inc.length === 2);
  check("cụm 2 chỉ có 1 sự kiện", inc[1].events === 1);
}

// 3. Raid kéo 40 phút vẫn là MỘT sự cố (cửa sổ tính từ sự kiện trước, không
//    chia đều theo giờ) — nếu sai, mỗi đợt raid thành 3 "sự cố" vô nghĩa.
{
  const inc = groupIntoIncidents([
    ev({ createdAt: T, count: 50 }),
    ev({ createdAt: T + 14 * 60_000, count: 60 }),
    ev({ createdAt: T + 28 * 60_000, count: 40 }),
    ev({ createdAt: T + 40 * 60_000, count: 50 }),
  ]);
  check("raid 40 phút liên tục → vẫn 1 sự cố", inc.length === 1);
  check("tổng chặn 200", inc[0].blocked === 200);
}

console.log("── Khác người / khác hành vi → KHÔNG gom ──");

// 4. Khác người: 2 người khác nhau trong cùng 1 phút vẫn là 2 sự cố.
{
  const inc = groupIntoIncidents([
    ev({ createdAt: T, executorId: "u1", executorName: "a" }),
    ev({ createdAt: T + 1000, executorId: "u2", executorName: "b" }),
  ]);
  check("2 người khác nhau → 2 sự cố", inc.length === 2);
  check(
    "giữ đúng tên từng người",
    inc[0].executors[0].id === "u1" && inc[1].executors[0].id === "u2",
  );
}

// 5. Khác hành vi: cùng người nhưng kick và ban khác module → tách.
{
  const inc = groupIntoIncidents([
    ev({ createdAt: T, module: "massJoin", action: "kick" }),
    ev({ createdAt: T + 1000, module: "massBan", action: "ban" }),
  ]);
  check("cùng người nhưng khác module → 2 sự cố", inc.length === 2);
}

// 6. Khác loại: antinuke vs modaction cùng người → tách (khác nguồn sự kiện).
{
  const inc = groupIntoIncidents([
    ev({ createdAt: T, kind: "antinuke", module: "massJoin", action: "kick" }),
    ev({ createdAt: T + 500, kind: "modaction", module: "ban", action: "ban" }),
  ]);
  check("antinuke vs modaction → 2 sự cố", inc.length === 2);
}

// 7. Sự kiện KHÔNG có executorId → không gom. Gom mọi thứ vô danh vào một
//    cụm tạo ra "sự cố" mà không ai chịu trách nhiệm.
{
  const inc = groupIntoIncidents([
    ev({ createdAt: T, executorId: undefined }),
    ev({ createdAt: T + 1000, executorId: undefined }),
  ]);
  check("không rõ thủ phạm → KHÔNG gom (2 sự cố)", inc.length === 2);
}

console.log("── Khoá tất định + mốc đánh dấu đã xử lý ──");

// 8. Khoá phải KHÁC NHAU cho 2 sự cố khác nhau — nếu trùng thì đánh dấu "đã
//    xử lý" sự cố này lại tắt luôn sự cố kia (lỗi im lặng kiểu kinh điển).
{
  const inc = groupIntoIncidents([
    ev({ createdAt: T, executorId: "u1" }),
    ev({ createdAt: T + 60_000, executorId: "u2" }),
  ]);
  check("2 sự cố khác người → 2 khoá khác nhau", inc[0].key !== inc[1].key);
  check("khoá có loại + hành vi + mốc đầu", inc[0].key === `antinuke:massJoin:${T}`);
}

// 9. Cùng dữ liệu, cùng thứ tự → cùng khoá (bấm lại nút vẫn trỏ đúng dòng).
{
  const data = [ev({ createdAt: T }), ev({ createdAt: T + 5000 })];
  check(
    "tất định: gọi 2 lần ra cùng khoá",
    groupIntoIncidents(data)[0].key === groupIntoIncidents(data)[0].key,
  );
}

// 10. modaction có target → gom target, không trùng lặp.
{
  const inc = groupIntoIncidents([
    ev({
      createdAt: T,
      kind: "modaction",
      module: "ban",
      action: "ban",
      targetId: "t1",
      targetName: "spammer",
    }),
    ev({
      createdAt: T + 1000,
      kind: "modaction",
      module: "ban",
      action: "ban",
      targetId: "t1",
      targetName: "spammer",
    }),
  ]);
  check("cùng target 2 lần → chỉ liệt kê 1", inc[0].targets.length === 1);
  check("giữ tên target", inc[0].targets[0].name === "spammer");
}

console.log("── Biên ──");

// 11. Rỗng → rỗng (không ném).
check("mảng rỗng → mảng rỗng", groupIntoIncidents([]).length === 0);

// 12. Một sự kiện lẻ vẫn ra 1 sự cố đầy đủ (không mất trường nào).
{
  const inc = groupIntoIncidents([ev({ createdAt: T, count: 3, punish: "ban" })]);
  check("sự kiện lẻ vẫn thành 1 sự cố", inc.length === 1);
  check("giữ punish", inc[0].punish === "ban");
  check("giữ blocked", inc[0].blocked === 3);
  check("giữ kind", inc[0].kind === "antinuke");
}

// 13. Cửa sổ tuỳ biến được (để test nhanh và dùng lại sau này).
{
  const inc = groupIntoIncidents([ev({ createdAt: T }), ev({ createdAt: T + 5000 })], 1000);
  check("cửa sổ 1 giây tách 2 sự kiện cách nhau 5s", inc.length === 2);
}

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
