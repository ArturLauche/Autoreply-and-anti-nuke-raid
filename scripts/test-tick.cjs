// Test vòng tick TỔNG HỢP (bot/src/tick.js):
//   - runTickOnce: batch bot_tick:getPendingJobs thành công → xử lý hidden/verify/backup;
//     batch lỗi/không phải object → fallback 3 query riêng; sau lỗi tạm bỏ batch.
//   - runBackupJobs: claim chống trùng, dispatch backup/restore/import,
//     tải file import (fileContent hoặc URL), báo lỗi đúng loại lên dashboard.
//   - readImportContent: URL lỗi/timeout/thiếu dữ liệu.
//   - setupTick: gắn 1 lần khi ready.
// Mock discord.js + handlers/{hidden,backup,selfDiagnose} (không mạng thật, không Convex thật).
// Chạy: node scripts/test-tick.cjs
const path = require("path");

const Module = require("module");
const fs = require("fs");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === "discord.js") return path.join(__dirname, "..", "bot", "test-djs-mock.cjs");
  return origResolve.call(this, request, ...args);
};
fs.writeFileSync(path.join(__dirname, "..", "bot", "test-djs-mock.cjs"), "module.exports = {};\n");

// ── Mocks cho các module mà tick.js require ──
const calls = {
  hidden: [],
  verify: [],
  backup: [],
  restore: [],
  import: [],
  selfDiagnose: [],
  mutations: [],
  queries: [],
};
let batchResponse = null;
let batchShouldThrow = false;
let fallbackQueries = {};
let claimOk = true;
let claimShouldThrow = false;
let backupShouldThrow = false;
let restoreShouldThrow = false;
let importShouldThrow = false;
let importFileUrlResponse = null;

const hiddenMock = {
  async processHiddenJobsData(client, store, data) {
    calls.hidden.push(data);
  },
  async processVerifyPanelItems(client, store, items) {
    calls.verify.push(items);
  },
};
const backupMock = {
  async runBackup(client, store, guildId, opts) {
    calls.backup.push({ guildId, opts });
    if (backupShouldThrow) throw new Error("backup lỗi");
  },
  async runRestore(client, store, guildId, backupJson, guildName) {
    calls.restore.push({ guildId, backupJson, guildName });
    if (restoreShouldThrow) throw new Error("restore lỗi");
  },
  async runImportRestore(client, store, guildId, content, fileName) {
    calls.import.push({ guildId, content, fileName });
    if (importShouldThrow) throw new Error("import lỗi");
  },
};
const selfDiagnoseMock = {
  setEnabledFromJobs(v) {
    calls.selfDiagnose.push(v);
  },
};

const origLoad = Module._load;
Module._load = function (request, parent) {
  const fromTick = parent && /bot[\\/]src[\\/]tick\.js$/.test(parent.filename);
  if (fromTick) {
    if (request === "./handlers/hidden") return hiddenMock;
    if (request === "./handlers/backup") return backupMock;
    if (request === "./handlers/selfDiagnose") return selfDiagnoseMock;
  }
  return origLoad.apply(this, arguments);
};

globalThis.fetch = async () => {
  if (importFileUrlResponse === "ok")
    return { ok: true, status: 200, text: async () => "nội-dung-file" };
  if (importFileUrlResponse === "http-error")
    return { ok: false, status: 500, text: async () => "" };
  throw new Error("mạng lỗi");
};

(async () => {
  const { runTickOnce, runBackupJobs, setupTick } = require("../bot/src/tick");

  let pass = 0;
  let fail = 0;
  function check(label, cond) {
    if (cond) {
      pass++;
      console.log("PASS", label);
    } else {
      fail++;
      console.log("FAIL", label);
    }
  }
  const clear = () => {
    for (const k of Object.keys(calls)) calls[k].length = 0;
  };

  const client = {};
  const store = {
    client: {
      query: async (name) => {
        calls.queries.push(name);
        if (name === "bot_tick:getPendingJobs") {
          if (batchShouldThrow) throw new Error("batch chưa deploy");
          return batchResponse;
        }
        return fallbackQueries[name] ?? [];
      },
      mutation: async (name, args) => {
        calls.mutations.push({ name, args });
        if (name === "bot_writes:botClaimBackup") {
          if (claimShouldThrow) throw new Error("claim lỗi");
          return { ok: claimOk };
        }
        return { ok: true };
      },
    },
  };

  // ── 1. Batch thành công → xử lý hidden/verify/backup + selfDiagnose ──
  {
    clear();
    batchShouldThrow = false;
    batchResponse = {
      selfDiagnose: { enabled: true },
      hidden: [{ id: "h1" }],
      verifyPanels: [{ id: "v1" }],
      backups: [],
    };
    await runTickOnce(client, store);
    check("batch thành công → gọi batch query", calls.queries.includes("bot_tick:getPendingJobs"));
    check(
      "batch thành công → xử lý hidden jobs",
      calls.hidden.length === 1 && calls.hidden[0][0].id === "h1",
    );
    check(
      "batch thành công → xử lý verify panels",
      calls.verify.length === 1 && calls.verify[0][0].id === "v1",
    );
    check("batch thành công → đồng bộ selfDiagnose", calls.selfDiagnose.length === 1);
    check(
      "batch thành công → KHÔNG dùng fallback",
      !calls.queries.includes("hidden:getBotHiddenJobs"),
    );
  }

  // ── 2. Batch trả null → fallback 3 query ──
  {
    clear();
    batchResponse = null;
    fallbackQueries = {
      "hidden:getBotHiddenJobs": [{ id: "fh" }],
      "guilds:getVerifySendPanelGuilds": [{ id: "fv" }],
      "backup:botGetPending": [],
    };
    await runTickOnce(client, store);
    check(
      "batch null → fallback hidden",
      calls.queries.includes("hidden:getBotHiddenJobs") && calls.hidden.length === 1,
    );
    check(
      "batch null → fallback verify",
      calls.queries.includes("guilds:getVerifySendPanelGuilds"),
    );
    check("batch null → fallback backup", calls.queries.includes("backup:botGetPending"));
  }

  // ── 3. Batch lỗi → fallback + tạm bỏ batch lượt sau (10 phút) ──
  {
    clear();
    batchShouldThrow = true;
    fallbackQueries = {};
    await runTickOnce(client, store);
    check("batch lỗi → vẫn chạy fallback", calls.queries.includes("hidden:getBotHiddenJobs"));

    clear();
    await runTickOnce(client, store);
    check(
      "sau lỗi batch → lượt kế tiếp KHÔNG gọi batch (dùng fallback)",
      !calls.queries.includes("bot_tick:getPendingJobs"),
    );
  }

  // ── 4. runBackupJobs: claim bị từ chối → bỏ qua ──
  {
    clear();
    claimOk = false;
    await runBackupJobs(client, store, [{ guildId: "g1", kind: "backup" }]);
    check(
      "claim thất bại → không chạy backup",
      calls.backup.length === 0 &&
        calls.mutations.some((m) => m.name === "bot_writes:botClaimBackup"),
    );
    claimOk = true;
  }

  // ── 5. runBackupJobs: dispatch đúng loại ──
  {
    clear();
    await runBackupJobs(client, store, [
      { guildId: "g1", kind: "backup", pushToGithub: true, includeMessages: true },
      { guildId: "g2", kind: "restore", backupJson: "{}", guildName: "G2" },
      { guildId: "g3", kind: "import", fileContent: "z:abc", fileName: "b.json" },
    ]);
    check(
      "kind backup → runBackup kèm cờ",
      calls.backup.length === 1 && calls.backup[0].opts.pushToGithub === true,
    );
    check(
      "kind restore → runRestore",
      calls.restore.length === 1 && calls.restore[0].guildName === "G2",
    );
    check(
      "kind import (fileContent) → runImportRestore",
      calls.import.length === 1 && calls.import[0].content === "z:abc",
    );
  }

  // ── 6. runBackupJobs: import qua URL tải được ──
  {
    clear();
    importFileUrlResponse = "ok";
    await runBackupJobs(client, store, [
      {
        guildId: "g4",
        kind: "import",
        importFileUrl: "https://files.example/x",
        fileName: "x.json",
      },
    ]);
    check(
      "import qua URL → tải nội dung rồi restore",
      calls.import.length === 1 && calls.import[0].content === "nội-dung-file",
    );
  }

  // ── 7. runBackupJobs: lỗi từng loại → báo dashboard đúng mutation ──
  {
    clear();
    backupShouldThrow = true;
    await runBackupJobs(client, store, [{ guildId: "g1", kind: "backup" }]);
    check(
      "backup lỗi → botReportBackupError",
      calls.mutations.some((m) => m.name === "bot_writes:botReportBackupError"),
    );
    backupShouldThrow = false;

    clear();
    restoreShouldThrow = true;
    await runBackupJobs(client, store, [{ guildId: "g2", kind: "restore" }]);
    check(
      "restore lỗi → botReportRestoreError",
      calls.mutations.some((m) => m.name === "bot_writes:botReportRestoreError"),
    );
    restoreShouldThrow = false;

    clear();
    importShouldThrow = true;
    await runBackupJobs(client, store, [{ guildId: "g3", kind: "import", fileContent: "x" }]);
    check(
      "import lỗi → botReportImportError",
      calls.mutations.some((m) => m.name === "bot_writes:botReportImportError"),
    );
    importShouldThrow = false;
  }

  // ── 8. runBackupJobs: claim lỗi mạng → bỏ qua an toàn ──
  {
    clear();
    claimShouldThrow = true;
    await runBackupJobs(client, store, [{ guildId: "g9", kind: "backup" }]);
    check("claim lỗi → không chạy backup (không crash)", calls.backup.length === 0);
    claimShouldThrow = false;
  }

  // ── 9. runBackupJobs: danh sách rỗng → không làm gì ──
  {
    clear();
    await runBackupJobs(client, store, []);
    await runBackupJobs(client, store, null);
    check("danh sách rỗng/null → không mutation", calls.mutations.length === 0);
  }

  // ── 10. readImportContent: URL lỗi HTTP / thiếu dữ liệu ──
  {
    clear();
    importFileUrlResponse = "http-error";
    await runBackupJobs(client, store, [
      { guildId: "g5", kind: "import", importFileUrl: "https://files.example/y" },
    ]);
    check(
      "URL lỗi HTTP → botReportImportError (không crash)",
      calls.mutations.some((m) => m.name === "bot_writes:botReportImportError") &&
        calls.import.length === 0,
    );

    clear();
    await runBackupJobs(client, store, [{ guildId: "g6", kind: "import" }]);
    check(
      "import thiếu URL lẫn fileContent → báo lỗi",
      calls.mutations.some((m) => m.name === "bot_writes:botReportImportError"),
    );
  }

  // ── 11. setupTick: bot ĐÃ ready (index.js gọi từ trong clientReady) phải chạy
  // NGAY, không phụ thuộc listener — discord.js v14.27 emit clientReady SAU ready
  // nên `client.once("ready")` đăng ký muộn sẽ không bao giờ chạy (bug auto-backup
  // đứng im 12→19/09). Test cũ khóa hành vi sai (events.includes("ready")). ──
  {
    const realSetTimeout = global.setTimeout;
    const realSetInterval = global.setInterval;
    let started = 0;
    global.setTimeout = () => {
      started++;
      return { unref: () => {} };
    };
    global.setInterval = () => ({ unref: () => {} });
    try {
      const readyEvents = [];
      const readyClient = {
        isReady: () => true,
        once(evt) {
          readyEvents.push(evt);
        },
      };
      setupTick(readyClient, store);
      check("setupTick: bot đã ready → chạy ngay (không chờ event)", started === 1);
      check("setupTick: bot đã ready → KHÔNG đăng ký listener chết", readyEvents.length === 0);

      started = 0;
      const events = [];
      const notReadyClient = {
        isReady: () => false,
        once(evt, fn) {
          events.push(evt);
          fn();
        },
      };
      setupTick(notReadyClient, store);
      check("setupTick: chưa ready → đăng ký clientReady", events.includes("clientReady"));
      check("setupTick: KHÔNG dùng event 'ready' đã deprecated", !events.includes("ready"));
      check("setupTick: chưa ready → chờ event rồi mới chạy", started === 1);
    } finally {
      global.setTimeout = realSetTimeout;
      global.setInterval = realSetInterval;
    }
  }

  fs.unlinkSync(path.join(__dirname, "..", "bot", "test-djs-mock.cjs"));
  console.log(`\nKết quả tick: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error("CRASH:", e);
  process.exit(1);
});
