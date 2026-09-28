// TEST: bot/src/localSnapshot.js — snapshot cục bộ + file log theo ngày.
// Chạy: node scripts/test-local-snapshot.cjs
//
// File này chạy MỖI GIỜ trên VPS và là nguồn dữ liệu khôi phục khi Convex
// chết — nên lỗi ở đây là mất dữ liệu im lặng, không phải lỗi hiển thị.
// Trước đây coverage 80%, phần chưa phủ là rotate/dọn file cũ và vòng lặp.
//
// Mọi test ghi vào thư mục tạm qua 2 biến môi trường, KHÔNG đụng data/ thật.
const fs = require("fs");
const os = require("os");
const path = require("path");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "proton-snap-"));
process.env.PROTOGON_SNAPSHOT_DIR = path.join(TMP, "snapshots");
process.env.PROTOGON_LOG_DIR = path.join(TMP, "logs");

const snap = require("../bot/src/localSnapshot.js");

let pass = 0;
let fail = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
  ok ? pass++ : fail++;
};

const payload = { guild: { channels: [1, 2, 3], roles: ["a", "b"] } };

console.log("── ghi / đọc ──");
{
  check("snapshot rỗng → null", snap.writeLocalSnapshot("g1", null) === null);
  check("snapshot không phải object → null", snap.writeLocalSnapshot("g1", "x") === null);
  check("snapshot quá nhỏ → không ghi", snap.writeLocalSnapshot("g1", {}) === null);

  const r1 = snap.writeLocalSnapshot("g1", payload, 1_700_000_000_000);
  check("ghi trả { file, bytes }", !!r1 && r1.bytes > 0, JSON.stringify(r1));
  check("tên file theo mốc ts", String(r1.file).endsWith("1700000000000.z"), r1.file);
  check("file tồn tại trên đĩa", fs.existsSync(r1.file));
  check("không sót file .tmp", !fs.existsSync(`${r1.file}.tmp`));

  const back = snap.readLocalSnapshot("g1");
  check(
    "đọc lại ra đúng dữ liệu",
    JSON.stringify(back) === JSON.stringify(payload),
    JSON.stringify(back),
  );
  check("đọc đúng mốc ts", !!snap.readLocalSnapshot("g1", 1_700_000_000_000));
  check("đọc mốc không có → null", snap.readLocalSnapshot("g1", 123) === null);
  check("đọc guild chưa có → null", snap.readLocalSnapshot("chua-co") === null);

  // File hỏng phải trả null chứ KHÔNG ném — restore tự rơi về nguồn khác.
  fs.writeFileSync(r1.file, "không phải zlib");
  check("file hỏng → null, không ném", snap.readLocalSnapshot("g1", 1_700_000_000_000) === null);
  fs.rmSync(r1.file, { force: true });
}

console.log("── tên thư mục an toàn ──");
{
  // guildId là số trong DB nhưng hàm phải an toàn với mọi chuỗi: ký tự lạ
  // trong tên thư mục là đường đi ra ngoài snapshotDir.
  const evil = snap.writeLocalSnapshot("../../etc/passwd", payload, 1_700_000_000_001);
  const rel = path.relative(snap.snapshotDir(), evil.file);
  check("guildId độc hại không thoát khỏi thư mục", !rel.startsWith(".."), rel);
}

console.log("── danh sách + rotate ──");
{
  const g = "g-rotate";
  for (let i = 1; i <= 5; i++) snap.writeLocalSnapshot(g, payload, 1_700_000_000_000 + i * 1000);
  const list = snap.listLocalSnapshots(g);
  check(
    "danh sách mới nhất đầu",
    list.length === 5 && list[0].ts > list[4].ts,
    JSON.stringify(list.map((s) => s.ts)),
  );
  check(
    "mục có kích thước",
    list.every((s) => s.bytes > 0),
  );

  const removed = snap.rotateLocalSnapshots(g, 2);
  check("xoá đúng số dư (5 - 2 = 3)", removed === 3, String(removed));
  check("còn lại 2 bản mới nhất", snap.listLocalSnapshots(g).length === 2);
  check("giữ đúng 2 bản mới nhất", snap.readLocalSnapshot(g, 1_700_000_005_000) !== null);
  check("xoá bản cũ nhất", snap.readLocalSnapshot(g, 1_700_000_001_000) === null);
  check("rotate lần nữa không còn gì để xoá", snap.rotateLocalSnapshots(g, 2) === 0);
}

console.log("── log theo ngày ──");
{
  // PHẢI truyền CÙNG một mốc thời gian vào cả logFileFor lẫn appendLog/tailLog.
  // Gọi appendLog() trần là ghi vào file của NGÀY HÔM NAY, còn f là file của
  // 27/09 → test chỉ xanh đúng ngày 27/09 và đỏ ngay hôm sau (đã xảy ra).
  const at = new Date("2026-09-27T03:04:05Z");
  const f = snap.logFileFor(at);
  check("tên file theo ngày UTC", path.basename(f) === "bot-2026-09-27.log", path.basename(f));
  check("appendLog tạo thư mục + file", (snap.appendLog("dòng 1", at), fs.existsSync(f)));
  snap.appendLog("dòng 2", at);
  snap.appendLog("dòng 3", at);
  const tail2 = snap.tailLog(2, at);
  check(
    "tailLog lấy N dòng cuối",
    tail2.split("\n").filter(Boolean).length === 2,
    JSON.stringify(tail2),
  );
  check("tailLog có timestamp", /\d{4}-\d{2}-\d{2}T/.test(tail2), tail2.split("\n")[0]);
  check(
    "tailLog khi chưa có file → chuỗi rỗng",
    snap.tailLog(5, new Date("2000-01-01T00:00:00Z")) === "",
  );
  // Ghi log lỗi (disk hỏng, thư mục là file…) phải NUỐT: bot không được chết vì
  // ghi log thất bại. Dựng tình huống lỗi thật: thư mục log là một FILE.
  const blocker = path.join(TMP, "khong-phai-thu-muc");
  fs.writeFileSync(blocker, "x");
  const realLogDir = process.env.PROTOGON_LOG_DIR;
  process.env.PROTOGON_LOG_DIR = blocker;
  let threw = false;
  try {
    snap.appendLog("dòng gây lỗi");
  } catch {
    threw = true;
  }
  process.env.PROTOGON_LOG_DIR = realLogDir;
  check("appendLog lỗi → nuốt, không ném", threw === false);
}

console.log("── rotate file log ──");
{
  // rotateLogs phải chịu được thư mục log chưa tồn tại (bot vừa restart).
  const realLogDir = process.env.PROTOGON_LOG_DIR;
  process.env.PROTOGON_LOG_DIR = path.join(TMP, "chua-co-log");
  check("rotateLogs: thư mục chưa có → 0, không ném", snap.rotateLogs() === 0);
  process.env.PROTOGON_LOG_DIR = realLogDir;

  fs.mkdirSync(realLogDir, { recursive: true });
  const het = path.join(realLogDir, "bot-2020-01-01.log");
  const moi = path.join(realLogDir, "bot-2099-01-01.log");
  const rac = path.join(realLogDir, "khong-phai-log.txt");
  fs.writeFileSync(het, "x");
  fs.writeFileSync(moi, "x");
  fs.writeFileSync(rac, "x");
  const removed = snap.rotateLogs(new Date("2026-09-27T00:00:00Z"));
  check(
    "rotateLogs: xoá đúng file quá 7 ngày",
    removed === 1 && !fs.existsSync(het),
    String(removed),
  );
  check("rotateLogs: giữ file mới + file không phải log", fs.existsSync(moi) && fs.existsSync(rac));
  fs.rmSync(moi, { force: true });
  fs.rmSync(rac, { force: true });
}

console.log("── chụp qua engine backup + vòng lặp ──");
(async () => {
  // Thư mục snapshot bị chặn bởi một FILE → ghi phải trả null, không ném.
  const snapBlocker = path.join(TMP, "snap-blocker");
  fs.writeFileSync(snapBlocker, "x");
  const realSnapDir = process.env.PROTOGON_SNAPSHOT_DIR;
  process.env.PROTOGON_SNAPSHOT_DIR = snapBlocker;
  const r = snap.writeLocalSnapshot("g-loi", payload, 1_700_000_000_009);
  check("ghi lỗi (đĩa hỏng) → null, không ném", r === null, JSON.stringify(r));
  process.env.PROTOGON_SNAPSHOT_DIR = realSnapDir;

  const Module = require("module");
  const origLoad = Module._load;
  let engineThrows = false;
  let engineEmpty = false;
  const bigSnapshot = {
    channels: Array.from({ length: 25 }, (_, i) => ({ id: i, name: `kênh ${i}`, type: 0 })),
    roles: Array.from({ length: 15 }, (_, i) => ({ id: i, name: `role ${i}` })),
  };
  Module._load = function (request, parent) {
    if (request === "./handlers/backup" && parent && /localSnapshot\.js$/.test(parent.filename)) {
      return {
        snapshotWithSettings: async () => {
          if (engineThrows) throw new Error("Discord API lỗi");
          if (engineEmpty) return { snapshot: null };
          return { snapshot: bigSnapshot };
        },
      };
    }
    return origLoad.apply(this, arguments);
  };
  try {
    const ok = await snap.snapshotGuildLocal({}, {}, "g-snap", 1_700_000_000_010);
    check(
      "snapshotGuildLocal: engine OK → ghi file thật",
      !!ok && fs.existsSync(ok.file),
      JSON.stringify(ok),
    );

    engineThrows = true;
    const bad = await snap.snapshotGuildLocal({}, {}, "g-snap-loi", 1_700_000_000_011);
    check("snapshotGuildLocal: engine lỗi → null, không ném", bad === null, JSON.stringify(bad));
    engineThrows = false;

    engineEmpty = true;
    const rong = await snap.snapshotGuildLocal({}, {}, "g-snap-rong", 1_700_000_000_012);
    check(
      "snapshotGuildLocal: engine không trả snapshot → null",
      rong === null,
      JSON.stringify(rong),
    );
    engineEmpty = false;

    // Vòng lặp chạy MỖI GIỜ trên VPS — lỗi 1 guild không được chặn guild sau,
    // và stop() phải giải phóng timer (rò rỉ timer chặn shutdown).
    const loopClient = {
      guilds: {
        cache: new Map([
          ["g-loop-a", { id: "g-loop-a" }],
          ["g-loop-b", { id: "g-loop-b" }],
        ]),
      },
    };
    const stop = snap.startLocalSnapshotLoop(loopClient, {}, 10);
    await new Promise((r) => setTimeout(r, 80));
    stop();
    check(
      "vòng chụp: quét được CẢ 2 guild",
      snap.listLocalSnapshots("g-loop-a").length > 0 &&
        snap.listLocalSnapshots("g-loop-b").length > 0,
    );
  } finally {
    Module._load = origLoad;
  }

  console.log(`\nKết quả local-snapshot: ${pass} PASS, ${fail} FAIL`);
  // Dọn thư mục tạm — test chạy hàng chục lần, để lại sẽ đầy /tmp.
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error("CRASH:", e);
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(1);
});
