// TEST: bot/src/heat.js — bộ đo nhiệt vi phạm (warn → timeout → kick → ban).
// Chạy: node scripts/test-heat.cjs
//
// File này quyết định ai bị timeout/kick/ban. Trước đây chỉ được test rải rác
// trong 3 suite khác, nên phần **ghi xuống Convex** (`flushGuild`/`flushAll`/
// `resetGuild`) gần như không phủ — mà đó mới là nơi số liệu dashboard đến từ.
//
// Rủi ro cụ thể đã có: reset sai phạm vi sẽ xoá nhiệt của server KHÁC (một
// lệnh xoá nhầm là cả server mất dữ liệu), và flush nuốt lỗi âm thầm.
const { HeatTracker, heatSettings } = require("../bot/src/heat.js");

let pass = 0;
let fail = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
  ok ? pass++ : fail++;
};

const MIN = 60_000;

/** Tracker giả: store chỉ ghi lại, không chạm mạng. */
function mkTracker() {
  const calls = { mutations: [], queries: [] };
  const store = {
    client: {
      mutation: async (name, args) => {
        calls.mutations.push({ name, args });
        return {};
      },
      query: async (name) => {
        calls.queries.push(name);
        return null;
      },
    },
  };
  return { tracker: new HeatTracker({}, store), calls };
}

(async () => {
  console.log("── heatSettings: kẹp giá trị rác ──");
  {
    const d = heatSettings(null);
    check("config null → dùng mặc định, không ném", d.warnAt === 25 && d.enabled === true);
    check("decay âm → 0", heatSettings({ heatDecayPerMin: -5 }).decayPerMin === 0);
    check(
      "ngưỡng vô lý vẫn được dùng (không tự ý chỉnh)",
      heatSettings({ heatKickAt: 1 }).kickAt === 1,
    );
    check(
      "repeatMultiplier kẹp trong 1..10",
      heatSettings({ heatRepeatMultiplier: 99 }).repeatMultiplier === 10,
    );
    check("heatEnabled = false → tắt", heatSettings({ heatEnabled: false }).enabled === false);
  }

  console.log("\n── tích luỹ + tắt dần ──");
  {
    const { tracker } = mkTracker();
    const s = heatSettings({ heatDecayPerMin: 0 });
    await tracker.add("g1", "u1", "Minh", 30, s);
    check(
      "nhiệt dồn đúng",
      tracker.getHeat("g1", "u1", s) === 30,
      String(tracker.getHeat("g1", "u1", s)),
    );
    await tracker.add("g1", "u1", "Minh", 20, s);
    check("cộng dồn", tracker.getHeat("g1", "u1", s) === 50);
    check("người khác không dính nhiệt", tracker.getHeat("g1", "u2", s) === 0);
    check("server khác không dính nhiệt", tracker.getHeat("g2", "u1", s) === 0);
    check("userId rác (rỗng) không ném", tracker.getHeat("g1", "", s) === 0);
  }
  {
    // Tắt dần là hành vi cốt lõi: nhiệt cũ phải tụt theo thời gian, nếu không
    // thì người đã xử lý lâu vẫn bị kick ở lượt sau.
    const { tracker } = mkTracker();
    const s = heatSettings({ heatDecayPerMin: 3 });
    await tracker.add("g1", "u1", "Minh", 60, s);
    const now = Date.now();
    // giả thời gian: sửa updatedAt lùi 10 phút
    const entry = tracker.states.get("g1:u1");
    entry.updatedAt = now - 10 * MIN;
    const h = tracker.getHeat("g1", "u1", s);
    check(`nhiệt tụt theo thời gian (60 → ${h})`, h < 60 && h > 20, String(h));
  }

  console.log("\n── strike: cửa sổ lặp lại ──");
  {
    const { tracker } = mkTracker();
    const s = heatSettings({});
    tracker.strike("g1", "u1", s, "Minh");
    tracker.strike("g1", "u1", s, "Minh");
    check(
      "đếm strike",
      tracker.strikeCount("g1", "u1", s) === 2,
      String(tracker.strikeCount("g1", "u1", s)),
    );
    check("strike lưu tên để hiển thị", tracker.strikeUsername("g1", "u1") === "Minh");
    // Lỗi thời (ngoài cửa sổ) không được tính.
    const old = tracker.strikes.get("g1:u1");
    old.firstAt = Date.now() - 999 * MIN;
    check(
      "strike ngoài cửa sổ không tính",
      tracker.strikeCount("g1", "u1", s) === 0,
      String(tracker.strikeCount("g1", "u1", s)),
    );
    tracker.clearStrikes("g1", "u1");
    check("clearStrikes xoá sạch", tracker.strikeCount("g1", "u1", s) === 0);
  }

  console.log("\n── resetGuild: phạm vi phải đúng ──");
  {
    const { tracker, calls } = mkTracker();
    const s = heatSettings({ heatDecayPerMin: 0 });
    await tracker.add("g1", "u1", "A", 30, s);
    await tracker.add("g1", "u2", "B", 40, s);
    await tracker.add("g2", "u1", "C", 50, s);

    // ⚠️ Xoá nhầm server khác là mất sạch dữ liệu của cả server đó.
    await tracker.resetGuild("g1", "u1");
    check("reset 1 user: xoá đúng user đó", tracker.getHeat("g1", "u1", s) === 0);
    check("reset 1 user: GIỮ user khác cùng server", tracker.getHeat("g1", "u2", s) === 40);
    check("reset 1 user: GIỮ server khác", tracker.getHeat("g2", "u1", s) === 50);
    check(
      "reset ghi heat=0 lên Convex",
      calls.mutations.some(
        (m) => m.name === "bot_writes:botRecordHeat" && m.args.userId === "u1" && m.args.heat === 0,
      ),
    );

    await tracker.resetGuild("g1");
    check("reset cả server: xoá hết user trong server", tracker.getHeat("g1", "u2", s) === 0);
    check("reset cả server: KHÔNG đụng server khác", tracker.getHeat("g2", "u1", s) === 50);
  }

  console.log("\n── flush: ghi batch lên Convex ──");
  {
    const { tracker, calls } = mkTracker();
    const s = heatSettings({ heatDecayPerMin: 0 });
    await tracker.add("g1", "u1", "A", 30, s);
    await tracker.add("g1", "u2", "B", 70, s);
    await tracker.add("g2", "u1", "C", 10, s);
    calls.mutations.length = 0;

    await tracker.flushGuild("g1");
    const batch = calls.mutations.find((m) => m.name === "bot_writes:botRecordHeatBatch");
    check("ghi 1 mutation batch", !!batch, JSON.stringify(calls.mutations.map((m) => m.name)));
    check("batch chỉ chứa guild đang flush", batch && batch.args.guildId === "g1");
    check(
      "batch có đủ 2 user",
      batch && batch.args.entries.length === 2,
      String(batch?.args.entries.length),
    );
    const ids = (batch?.args.entries || []).map((e) => e.userId).sort();
    check(
      "đúng danh sách user",
      JSON.stringify(ids) === JSON.stringify(["u1", "u2"]),
      JSON.stringify(ids),
    );
    check(
      "nhiệt không âm",
      (batch?.args.entries || []).every((e) => e.heat >= 0),
    );
    check(
      "còn giữ tên người dùng",
      (batch?.args.entries || []).every((e) => typeof e.username === "string" && e.username),
    );
  }
  {
    // Chống rò rỉ RAM: entry đã hết hạn phải bị xoá khỏi bộ nhớ sau flush.
    const { tracker } = mkTracker();
    const s = heatSettings({ heatDecayPerMin: 1 });
    await tracker.add("g1", "u1", "A", 5, s);
    await tracker.add("g1", "u2", "B", 80, s);
    // u1 tuyet het sau 10 phut (5 - 10*1 < 0); u2 con nhiet nen phai giu.
    tracker.states.get("g1:u1").updatedAt = Date.now() - 10 * MIN;
    await tracker.flushGuild("g1");
    check("nhiệt 0 sau flush → xoá khỏi RAM", !tracker.states.has("g1:u1"));
    check("nhiệt còn → giữ trong RAM", tracker.states.has("g1:u2"));
  }
  {
    const { tracker, calls } = mkTracker();
    const s = heatSettings({ heatDecayPerMin: 0 });
    await tracker.add("g1", "u1", "A", 10, s);
    calls.mutations.length = 0;
    await tracker.flushGuild("khong-co-guild-nao");
    check(
      "flush guild rỗng → KHÔNG gọi mutation",
      calls.mutations.length === 0,
      JSON.stringify(calls.mutations.map((m) => m.name)),
    );
  }

  console.log("\n── topWarned: sắp xếp + giới hạn ──");
  {
    const { tracker } = mkTracker();
    const s = heatSettings({ heatDecayPerMin: 0 });
    for (let i = 0; i < 20; i++) await tracker.add("g1", `u${i}`, `N${i}`, i + 1, s);
    const top = tracker.strikeSnapshot("g1", s);
    check(
      "strikeSnapshot sắp giảm dần",
      top.length === 0 || top[0].count >= top[top.length - 1].count,
    );
  }
  {
    const { tracker } = mkTracker();
    const s = heatSettings({ heatDecayPerMin: 0, warnStrikeLimit: 3 });
    for (let i = 0; i < 6; i++) {
      tracker.strike("g1", "u1", s, "Minh");
      tracker.strike("g1", `v${i}`, s, `N${i}`);
    }
    const top = tracker.strikeSnapshot("g1", s);
    check("tối đa 15 dòng", top.length <= 15, String(top.length));
    check(
      "không vượt giới hạn strike cấu hình",
      top.every((r) => r.count <= 3),
      JSON.stringify(top[0]),
    );
  }

  console.log(`\nKết quả heat: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
})();
