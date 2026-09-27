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
  const f = snap.logFileFor(new Date("2026-09-27T03:04:05Z"));
  check("tên file theo ngày UTC", path.basename(f) === "bot-2026-09-27.log", path.basename(f));
  check("appendLog tạo thư mục + file", (snap.appendLog("dòng 1"), fs.existsSync(f)));
  snap.appendLog("dòng 2");
  snap.appendLog("dòng 3");
  const tail2 = snap.tailLog(2);
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

console.log(`\nKết quả local-snapshot: ${pass} PASS, ${fail} FAIL`);
// Dọn thư mục tạm — test chạy hàng chục lần, để lại sẽ đầy /tmp.
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(fail === 0 ? 0 : 1);
