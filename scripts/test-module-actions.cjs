// TEST: bot/src/moduleActions.js — chọn hình phạt + dọn tin nhắn.
// Chạy: node scripts/test-module-actions.cjs
//
// File này trước đây KHÔNG có test nào, và đang là nơi bot quyết định "xoá hàng
// loạt tin của kẻ gây rối". Rủi ro cụ thể đã có:
//   - `bulkDelete` lỗi (thiếu quyền ManageMessages) vẫn trả về số tin MONG
//     MUỐN xoá → số đó đi vào mô tả case log ("purge 100 tin liên quan") →
//     log nói dối staff, và lỗi thật (mất quyền) bị giấu.
//   - Xoá nhầm tin của người không liên quan (thiếu danh sách bỏ qua).
//   - Quét cả kênh DM / kênh không xem được.
const ma = require("../bot/src/moduleActions.js");

let pass = 0;
let fail = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
  ok ? pass++ : fail++;
};

/** Kênh text giả với `count` tin của `userId` (mỗi tin: deletable hay không). */
function makeChannel({
  userId = "u1",
  count = 0,
  deletable = true,
  bulkSize,
  bulkThrows,
  deleteThrows,
} = {}) {
  const msgs = new Map();
  for (let i = 0; i < count; i++) {
    const m = {
      id: `m${i}`,
      author: { id: userId },
      deletable: typeof deletable === "function" ? deletable(i) : deletable,
      delete: async () => {
        if (deleteThrows) throw new Error("Missing Permissions");
        msgs.delete(`m${i}`);
        return m;
      },
    };
    msgs.set(m.id, m);
  }
  return {
    isTextBased: () => true,
    isDMBased: () => false,
    // `fetch` PHẢI tôn trọng `limit` — nếu không, test "giới hạn limit" sẽ xanh
    // nhầm vì mock lấy hết tin.
    messages: { fetch: async (opts) => new Map([...msgs].slice(0, opts?.limit ?? msgs.size)) },
    // `bulkDelete` trả về collection CÁC TIN ĐÃ XOÁ THẬT (giống discord.js).
    // Code thật truyền MẢNG vào đây — discord.js nhận cả hai, mock cũng phải.
    bulkDelete: async (targets) => {
      if (bulkThrows) throw new Error("Missing Permissions");
      const arr = [...targets];
      const n = Math.min(
        typeof bulkSize === "function" ? bulkSize(arr) : (bulkSize ?? arr.length),
        arr.length,
      );
      const done = arr.slice(0, n);
      for (const t of done) msgs.delete(t.id);
      return new Map(done.map((t) => [t.id, t]));
    },
  };
}

(async () => {
  console.log("── actionsOf / memberPunishOf ──");
  check(
    "đọc được danh sách hành động mới",
    JSON.stringify(ma.actionsOf({ actions: ["ban", "warn"] })) === JSON.stringify(["ban", "warn"]),
  );
  check("bỏ hành động rác", ma.actionsOf({ actions: ["ban", 123, null] }).length === 1);
  check(
    "mảng rỗng → lùi về punish cũ",
    JSON.stringify(ma.actionsOf({ actions: [], punish: "kick" })) === JSON.stringify(["kick"]),
  );
  check("không có gì → rỗng", ma.actionsOf({}).length === 0);
  check("config null → không ném", ma.actionsOf(null).length === 0);
  check("chọn hình phạt mạnh nhất", ma.memberPunishOf(["ban", "warn", "timeout"]) === "ban");
  check("timeout mạnh hơn warn", ma.memberPunishOf(["warn", "timeout"]) === "timeout");
  check("không có gì → fallback", ma.memberPunishOf([], "warn") === "warn");

  console.log("\n── purgeChannelMessages: số phải là SỐ THẬT ──");
  check("kênh không phải text → 0", (await ma.purgeChannelMessages(null, "u1")) === 0);
  check(
    "kênh DM → 0",
    (await ma.purgeChannelMessages({ isTextBased: () => true, isDMBased: () => true }, "u1")) === 0,
  );
  check(
    "không có tin nào của user → 0",
    (await ma.purgeChannelMessages(makeChannel({ count: 0 }), "u1")) === 0,
  );
  {
    const ch = makeChannel({ count: 1 });
    check("1 tin, xoá được → 1", (await ma.purgeChannelMessages(ch, "u1")) === 1);
  }
  {
    // ⚠️ HỒI QUY: thiếu quyền xoá tin → KHÔNG được báo 1.
    const ch = makeChannel({ count: 1, deleteThrows: true });
    check(
      "1 tin, xoá LỖI → báo 0 (không nói dối)",
      (await ma.purgeChannelMessages(ch, "u1")) === 0,
    );
  }
  {
    // ⚠️ HỒI QUY: bulkDelete lỗi → KHÔNG được báo đủ số tin.
    const ch = makeChannel({ count: 5, bulkThrows: true });
    check("nhiều tin, bulkDelete LỖI → báo 0", (await ma.purgeChannelMessages(ch, "u1")) === 0);
  }
  {
    // Discord có thể chỉ xoá được một phần (tin >14 ngày bị lọc bởi filterOld).
    const ch = makeChannel({ count: 5, bulkSize: 2 });
    check("bulkDelete chỉ xoá được 2/5 → báo 2", (await ma.purgeChannelMessages(ch, "u1")) === 2);
  }
  {
    const ch = makeChannel({ count: 3, deletable: (i) => i !== 0 });
    check("bỏ qua tin không xoá được", (await ma.purgeChannelMessages(ch, "u1")) === 2);
  }
  {
    // `skipUserIds` bảo vệ chính người đó: kẻ vi phạm nằm trong danh sách bỏ
    // qua → không xoá gì (đây là điều kiện duy nhất mà tham số này có tác dụng).
    const ch = makeChannel({ count: 3 });
    check(
      "người vi phạm nằm trong danh sách bỏ qua → không xoá",
      (await ma.purgeChannelMessages(ch, "u1", 100, ["u1"])) === 0,
    );
  }
  {
    const ch = makeChannel({ count: 4 });
    check("giới hạn limit được tôn trọng", (await ma.purgeChannelMessages(ch, "u1", 2)) === 2);
  }

  console.log("\n── cleanupMessages: mô tả phải khớp sự thật ──");
  {
    const ch = makeChannel({ count: 3 });
    const parts = await ma.cleanupMessages({
      channel: ch,
      userId: "u1",
      actions: ["deleteMessages", "purgeMessages"],
      triggerMessage: { deletable: true, delete: async () => {} },
    });
    check(
      "mô tả có cả xoá 1 tin lẫn purge",
      parts.includes("xóa 1 tin phát việc") || parts.includes("xóa 1 tin phát hiện"),
      parts,
    );
    check("số purge trong mô tả khớp số thật", parts.includes("purge 3"), parts);
  }
  {
    const ch = makeChannel({ count: 3, bulkThrows: true });
    const parts = await ma.cleanupMessages({
      channel: ch,
      userId: "u1",
      actions: ["purgeMessages"],
    });
    check("purge lỗi → KHÔNG có mô tả 'purge N tin'", parts === "", parts);
  }
  {
    const parts = await ma.cleanupMessages({
      actions: ["deleteMessages"],
      triggerMessage: { deletable: false },
    });
    check("tin không xoá được → không khoe là đã xoá", parts === "", parts);
  }
  {
    const parts = await ma.cleanupMessages({ actions: [] });
    check("không chọn hành động → mô tả rỗng", parts === "", parts);
  }

  console.log(`\nKết quả module-actions: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
})();
