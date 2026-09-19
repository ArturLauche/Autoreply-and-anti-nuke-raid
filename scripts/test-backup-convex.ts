// TEST backup Convex — tầng logic thuần: botStoreBackup (xóa tồn dư >3),
// botClaimBackup (claim 10 phút), botClearBackup (reset cờ + lastBackupAt),
// backup:listGuild (map trường + sort) — với ctx.db GIẢ + getBotStatus mock.
// Chạy: bun scripts/test-backup-convex.ts
// Không mạng, không deployment thật — chặn tái diễn các bug "backup fake":
//   1. botStoreBackup phải TỪ CHỐI botKey sai (không ai ghi bản giả được).
//   2. botStoreBackup tự xóa bản cũ (chỉ giữ 3) — bản "tồn đọng" >3/server
//      không thể tồn tại qua đường chuẩn.
//   3. Claim không được 2 process cùng giữ (in_flight < 10 phút).
//   4. botClearBackup reset cờ + lastBackupAt đúng điều kiện storeOk.
import { botStoreBackup, botClaimBackup, botClearBackup } from "../convex/bot_writes";
import { listGuild, botAuditBackups } from "../convex/backup";
import { computeBotKey } from "../convex/botAuth";

// getBotStatus đọc ctx.db.query("botStatus") — ctx giả chỉ cần bảng botStatus
// với row { kind: "status", botKeySeed }. Không cần monkey-patch module.
// PROTOCOL ĐÚNG (theo botBootstrapAction): bot giữ KEY THÔ, server lưu
// botKeySeed = SHA-256("protogon-bot-key::" + key) = computeBotKey(key).
const SEED = "seed-thật-của-deployment"; // chỉ là chuỗi mô phỏng db
const BOT_KEY = "key-thô-32-bytes-của-bot"; // bot giữ trong .env BOT_KEY
const storeHandler = (botStoreBackup as any)._handler;
const claimHandler = (botClaimBackup as any)._handler;
const clearHandler = (botClearBackup as any)._handler;
const listGuildHandler = (listGuild as any)._handler;
const auditHandler = (botAuditBackups as any)._handler;

let pass = 0;
let fail = 0;
const check = (label: string, ok: boolean) => {
  console.log(ok ? `  ✅ ${label}` : `  ❌ ${label}`);
  if (ok) pass++;
  else fail++;
};

// ─── Ctx giả: bảng guildBackups + guilds + botStatus trên Map ───
type Row = Record<string, any>;
function makeCtx(opts: { now?: number; seed?: string | null } = {}) {
  const backupRows: Row[] = [];
  const guildRows: Row[] = [];
  const statusRows: Row[] =
    opts.seed === null ? [] : [{ kind: "status", botKeySeed: computeBotKey(opts.seed ?? BOT_KEY) }];
  let idCounter = 0;
  const nextId = () => `id${++idCounter}`;
  const now = opts.now ?? 1_700_000_000_000;
  const allRows = () => ({
    guildBackups: backupRows,
    guilds: guildRows,
    botStatus: statusRows,
  });
  const ctx = {
    now,
    db: {
      insert: async (table: string, doc: Row) => {
        const id = nextId();
        allRows()[table as keyof ReturnType<typeof allRows>]?.push({ _id: id, ...doc });
        return id;
      },
      get: async (id: string) => backupRows.find((r) => r._id === id) ?? null,
      delete: async (id: string) => {
        const i = backupRows.findIndex((r) => r._id === id);
        if (i >= 0) backupRows.splice(i, 1);
      },
      patch: async (id: string, patch: Row) => {
        const row =
          guildRows.find((g) => g._id === id) ??
          backupRows.find((b) => b._id === id) ??
          statusRows.find((s) => s._id === id);
        if (row) Object.assign(row, patch);
      },
      query: (table: string) => ({
        withIndex: (_name: string, bound: (q: any) => any) => {
          // Giả lập withIndex(eq) — lọc theo kind (botStatus) hoặc guildId/discordId.
          const capture: Record<string, string> = {};
          const q = { eq: (f: string, v: string) => ((capture[f] = v), q) };
          bound(q);
          if (table === "botStatus") {
            return {
              first: async () =>
                statusRows.find((s) => s.kind === (capture.kind ?? "status")) ?? null,
            };
          }
          const rows = table === "guilds" ? guildRows : backupRows;
          return {
            first: async () =>
              rows.find(
                (r) =>
                  (r.discordId ?? r.guildId) === capture.discordId ||
                  (r.discordId ?? r.guildId) === capture.guildId,
              ) ?? null,
            collect: async () =>
              rows.filter(
                (r) =>
                  (r.discordId ?? r.guildId) === capture.discordId ||
                  (r.discordId ?? r.guildId) === capture.guildId,
              ),
            order: () => ({
              take: async (n: number) =>
                [...rows]
                  .filter(
                    (r) =>
                      (r.discordId ?? r.guildId) === capture.discordId ||
                      (r.discordId ?? r.guildId) === capture.guildId,
                  )
                  .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
                  .slice(0, n),
              first: async () =>
                [...rows]
                  .filter(
                    (r) =>
                      (r.discordId ?? r.guildId) === capture.discordId ||
                      (r.discordId ?? r.guildId) === capture.guildId,
                  )
                  .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0] ?? null,
            }),
          };
        },
        collect: async () =>
          table === "guilds" ? guildRows : table === "botStatus" ? statusRows : backupRows,
      }),
    },
  };
  return { ctx, backupRows, guildRows, nextId, statusRows };
}

(async () => {
  console.log("\n── botAuth: computeBotKey ──");
  check(
    "computeBotKey xác định (cùng seed → cùng key)",
    computeBotKey("abc") === computeBotKey("abc"),
  );
  check("seed khác → key khác", computeBotKey("abc") !== computeBotKey("xyz"));

  console.log("\n── botStoreBackup: botKey + dọn tồn dư (giữ 3) ──");
  {
    const { ctx, backupRows, nextId } = makeCtx({ seed: BOT_KEY });
    for (let i = 0; i < 5; i++) {
      backupRows.push({
        _id: `old${i}`,
        guildId: "g1",
        guildName: "G1",
        backupJson: "x",
        roleCount: 0,
        channelCount: 0,
        pushedToGithub: false,
        createdAt: 1_000 + i,
      });
    }
    // 1) botKey SAI với seed đã cấp → từ chối.
    let threw = "";
    try {
      await storeHandler(ctx as any, {
        guildId: "g1",
        guildName: "G1",
        backupJson: "z:fake",
        roleCount: 1,
        channelCount: 1,
        botKey: computeBotKey("key-thô-sai"), // bot khác — hash khác
      });
    } catch (e: any) {
      threw = e?.message ?? "";
    }
    check("botKey sai → bị từ chối", threw.includes("botKey"));
    check("DB không bị ghi bản giả", backupRows.length === 5);

    // 2) botKey ĐÚNG → lưu + tự xóa 3 bản cũ nhất (giữ tối đa 3).
    const r = await storeHandler(ctx as any, {
      guildId: "g1",
      guildName: "G1",
      backupJson: "z:real",
      roleCount: 10,
      channelCount: 5,
      source: "backup",
      backupSnapshotChecksum: "cs1",
      botKey: BOT_KEY, // key thô — đúng như bot gửi
    });
    check("botKey đúng → lưu thành công", r?.ok === true && typeof r?.backupId === "string");
    check("tự xóa tồn dư — chỉ còn 3 bản mới nhất", backupRows.length === 3);
    check(
      "bản mới nhất là bản vừa lưu",
      backupRows.some((b) => b.backupJson === "z:real"),
    );
    check(
      "bản cũ nhất (old0, old1) bị xóa",
      !backupRows.some((b) => b._id === "old0" || b._id === "old1"),
    );
    void nextId;
  }

  console.log("\n── botClaimBackup: khóa 10 phút chống chạy song song ──");
  {
    const { ctx, guildRows } = makeCtx({ seed: BOT_KEY });
    guildRows.push({ _id: "gld1", discordId: "g1", backupRequested: true });
    const args = { guildId: "g1", kind: "backup" as const, botKey: BOT_KEY };
    const r1 = await claimHandler(ctx as any, args).catch((e: any) => ({ error: e.message }));
    check("lần 1 claim thành công", (r1 as any)?.ok === true);
    check("backupClaimedAt được đặt", typeof guildRows[0].backupClaimedAt === "number");
    const r2 = await claimHandler(ctx as any, args).catch((e: any) => ({ error: e.message }));
    check("lần 2 trong 10 phút → in_flight", (r2 as any)?.reason === "in_flight");
    guildRows[0].backupClaimedAt = (guildRows[0].backupClaimedAt as number) - 601_000;
    const r3 = await claimHandler(ctx as any, args).catch((e: any) => ({ error: e.message }));
    check("hết 10 phút → claim lại được", (r3 as any)?.ok === true);
    guildRows[0].backupRequested = false;
    const r4 = await claimHandler(ctx as any, args).catch((e: any) => ({ error: e.message }));
    check("không có yêu cầu → no_request", (r4 as any)?.reason === "no_request");
  }

  console.log("\n── botClearBackup: reset cờ + lastBackupAt ──");
  {
    const { ctx, guildRows } = makeCtx({ seed: BOT_KEY });
    guildRows.push({
      _id: "gld1",
      discordId: "g1",
      backupRequested: true,
      backupPushToGithub: true,
      backupClaimedAt: 1_700_000_000_000,
      backupError: "lỗi cũ",
      backupErrorAt: 1_700_000_000_000,
    });
    await clearHandler(ctx as any, {
      guildId: "g1",
      kind: "backup",
      storeOk: true,
      botKey: BOT_KEY,
    });
    check("cờ backupRequested bị xóa", guildRows[0].backupRequested === false);
    check("backupError được xóa", guildRows[0].backupError === undefined);
    check("lastBackupAt được cập nhật", typeof guildRows[0].lastBackupAt === "number");
    const before = guildRows[0].lastBackupAt;
    await clearHandler(ctx as any, {
      guildId: "g1",
      kind: "backup",
      storeOk: false,
      botKey: BOT_KEY,
    });
    check(
      "store thất bại → giữ nguyên lastBackupAt (bot thử lại)",
      guildRows[0].lastBackupAt === before,
    );
  }

  console.log("\n── backup:listGuild: map + sort mới nhất trước ──");
  {
    const { ctx, backupRows } = makeCtx({ seed: BOT_KEY });
    backupRows.push(
      {
        _id: "b1",
        guildId: "g1",
        guildName: "G1",
        createdAt: 100,
        roleCount: 1,
        channelCount: 2,
        pushedToGithub: false,
      },
      {
        _id: "b2",
        guildId: "g1",
        guildName: "G1",
        createdAt: 300,
        roleCount: 3,
        channelCount: 4,
        pushedToGithub: true,
        githubUrl: "https://gist.github.com/x",
      },
      {
        _id: "b3",
        guildId: "g1",
        guildName: "G1",
        createdAt: 200,
        roleCount: 5,
        channelCount: 6,
        pushedToGithub: false,
      },
    );
    const out = await listGuildHandler(ctx as any, { guildId: "g1", botKey: BOT_KEY });
    check("trả đủ 3 bản", out.length === 3);
    check("sắp mới nhất trước", out[0]._id === "b2" && out[1]._id === "b3" && out[2]._id === "b1");
    check(
      "map source mặc định 'backup'",
      out.every((b: any) => b.source === "backup"),
    );
  }

  console.log("\n── backup:botAuditBackups: trả backupJson + checksum cho audit ──");
  {
    // REGRESSION: listGuild CỐ TÌNH bỏ backupJson (nhẹ cho lệnh chat) → audit
    // dùng nó sẽ xếp MỌI bản là fake và --fix xóa nhầm. botAuditBackups phải
    // trả kèm nội dung + checksum để classifyBackup phân loại đúng.
    const { ctx, backupRows } = makeCtx({ seed: BOT_KEY });
    backupRows.push({
      _id: "b1",
      guildId: "g1",
      guildName: "G1",
      createdAt: 100,
      roleCount: 1,
      channelCount: 2,
      pushedToGithub: false,
      backupJson: "z:abc",
      backupChecksum: "cs-1",
    });
    const listed = await listGuildHandler(ctx as any, { guildId: "g1", botKey: BOT_KEY });
    check("listGuild (lệnh chat) KHÔNG lộ backupJson", (listed[0] as any).backupJson === undefined);
    const audited = await auditHandler(ctx as any, { guildId: "g1", botKey: BOT_KEY });
    check("botAuditBackups trả kèm backupJson", (audited[0] as any).backupJson === "z:abc");
    check("botAuditBackups trả kèm backupChecksum", (audited[0] as any).backupChecksum === "cs-1");
    let auditThrew = "";
    try {
      await auditHandler(ctx as any, { guildId: "g1", botKey: computeBotKey("sai") });
    } catch (e: any) {
      auditThrew = e?.message ?? "";
    }
    check("botAuditBackups từ chối botKey sai", auditThrew.includes("botKey"));
  }

  console.log(`\n${pass}/${pass + fail} ✅`);
  process.exit(fail > 0 ? 1 : 0);
})();
