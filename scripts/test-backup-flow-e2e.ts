/**
 * test-backup-flow-e2e.ts — LUỒNG BACKUP THẬT, chạy xuyên cả 3 tầng.
 *
 * Vì sao cần (bug 23/09/2026): "bấm Backup ngay → quay vòng vòng → không có bản
 * backup nào, cũng không báo lỗi". Nguyên nhân là lỗi IMM LẶNG ở khớp nối giữa
 * bot và Convex: bot nuốt lỗi lưu backup rồi vẫn báo thành công, và không có
 * tín hiệu nào cho dashboard biết "đã xong" (hay "không đổi").
 *
 * Các suite cũ chỉ test TỪNG TẦNG RỜI (test-backup-convex.ts: handler Convex;
 * test-backup-pipeline.cjs: helper của bot). Suite này KHÁC: nó lái đúng chuỗi
 * sự kiện production, dùng ĐÚNG code thật của cả hai phía:
 *
 *   dashboard (requestBackup)  →  bot_tick (getPendingJobs)  →  bot claim
 *   →  bot/src/handlers/backup.js runBackup()  →  botStoreBackup / botClearBackup
 *   →  dashboard đọc lại (importStatus, listGuild)
 *
 * "Convex giả" chỉ là ctx.db trên Map — nhưng mọi handler (bot_writes, backup,
 * bot_tick) và mọi dòng của runBackup() đều là code production, nên bất kỳ lệch
 * hợp đồng nào (đổi tên mutation, sai tham số, quên set mốc) đều làm suite đỏ.
 *
 * Chạy: bun scripts/test-backup-flow-e2e.ts — không mạng, không deployment thật.
 */

import { requestBackup, importStatus, listGuild, botGetLastChecksum } from "../convex/backup";
import {
  botClaimBackup,
  botStoreBackup,
  botClearBackup,
  botReportBackupError,
} from "../convex/bot_writes";
import { getPendingJobs } from "../convex/bot_tick";
import { computeBotKey } from "../convex/botAuth";

/** Bot là CommonJS — nạp module thật để lái engine backup thật của production. */
import backupMod from "../bot/src/handlers/backup.js";

// Backup mã hoá chỉ bật khi có BACKUP_ENCRYPT_KEY trên VPS; test phải tất định.
delete process.env.BACKUP_ENCRYPT_KEY;

const BOT_KEY = "key-thô-32-bytes-của-bot";
const GID = "123456789012345678";
const USER = "u1";
const TOKEN = "tok-session-thật";

type Row = Record<string, any>;

let pass = 0;
let fail = 0;
const check = (label: string, ok: boolean) => {
  console.log(ok ? `  ✅ ${label}` : `  ❌ ${label}`);
  if (ok) pass++;
  else fail++;
};

// ───────────────────────── ctx Convex giả (Map) ─────────────────────────────
/**
 * Chỉ giả phần "đọc/ghi database" — mọi handler vẫn là code thật. `failStore`
 * mô phỏng đúng lỗi production phổ biến nhất: Convex từ chối document > 1 MB khi
 * backup kèm tin nhắn (chính là lỗi đã bị bot nuốt mất).
 */
function makeCtx() {
  const tables = new Map<string, Row[]>();
  let idc = 0;
  let creation = 1_700_000_000_000;
  let failStore = false;
  const rowsOf = (t: string) => {
    if (!tables.has(t)) tables.set(t, []);
    return tables.get(t)!;
  };

  function chain(t: string, predicates: ((r: Row) => boolean)[] = []) {
    const match = (r: Row) => predicates.every((p) => p(r));
    const base = () => rowsOf(t).filter(match);
    const sorted = () =>
      [...base()].sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0));
    return {
      withIndex: (_name: string, bound?: (q: unknown) => unknown) => {
        const cap: Row = {};
        const q = { eq: (f: string, v: unknown) => ((cap[f] = v), q) };
        bound?.(q);
        return chain(
          t,
          predicates.concat([(r) => Object.entries(cap).every(([k, v]) => r[k] === v)]),
        );
      },
      filter: (fn: (r: Row) => boolean) => chain(t, predicates.concat([fn])),
      first: async () => base()[0] ?? null,
      collect: async () => base(),
      take: async (n: number) => base().slice(0, n),
      order: (_dir: "asc" | "desc") => ({
        first: async () => sorted()[0] ?? null,
        collect: async () => sorted(),
        take: async (n: number) => sorted().slice(0, n),
      }),
    };
  }

  const db = {
    insert: async (t: string, doc: Row) => {
      if (failStore && t === "guildBackups") {
        throw new Error(
          "Document is too large: 1310720 bytes exceeds the maximum size of 1048576 bytes",
        );
      }
      const id = `${t}_${++idc}`;
      rowsOf(t).push({ _id: id, _creationTime: creation++, ...doc });
      return id;
    },
    get: async (id: string) => {
      for (const rows of tables.values()) {
        const hit = rows.find((r) => r._id === id);
        if (hit) return hit;
      }
      return null;
    },
    patch: async (id: string, patch: Row) => {
      for (const rows of tables.values()) {
        const hit = rows.find((r) => r._id === id);
        if (!hit) continue;
        for (const [k, v] of Object.entries(patch)) {
          // Convex: patch với undefined = XOÁ field (dashboard dựa vào đây để đọc
          // "chưa có mốc xong" thay vì nhầm với lượt trước).
          if (v === undefined) delete hit[k];
          else hit[k] = v;
        }
        return;
      }
    },
    delete: async (id: string) => {
      for (const rows of tables.values()) {
        const i = rows.findIndex((r) => r._id === id);
        if (i >= 0) {
          rows.splice(i, 1);
          return;
        }
      }
    },
    query: (t: string) => chain(t),
  };

  return {
    ctx: { db, storage: { getUrl: async () => null } },
    rows: rowsOf,
    tables,
    setFailStore: (v: boolean) => {
      failStore = v;
    },
  };
}

// ─────────────────────── store giả của bot (bọc Convex thật) ────────────────
/**
 * Giống `ConvexStore` thật: tự chèn botKey vào mọi lời gọi `bot_*`, và chỉ cho
 * gọi những function CÓ THẬT — gọi tên sai thì suite đỏ ngay (đúng loại lỗi
 * `tsc` không phủ vì hợp đồng bot ⇄ Convex là chuỗi).
 */
function makeStore(ctx: unknown) {
  const routes: Record<string, any> = {
    query: { "backup:botGetLastChecksum": botGetLastChecksum },
    mutation: {
      "bot_writes:botStoreBackup": botStoreBackup,
      "bot_writes:botClearBackup": botClearBackup,
      "bot_writes:botReportBackupError": botReportBackupError,
      "bot_writes:botClaimBackup": botClaimBackup,
    },
  };
  const calls: { type: string; name: string }[] = [];
  // ConvexStore THẬT chèn botKey vào MỌI query/mutation/action (xem
  // bot/src/convex.js). Fake phải làm y hệt: chỉ chèn cho `bot_*` thì
  // `backup:botGetLastChecksum` bị từ chối âm thầm (nó dùng .catch(() => null))
  // → bot luôn backup đầy đủ và bỏ qua tối ưu "server không đổi".
  const withKey = (name: string, args: Row) =>
    args?.botKey === undefined ? { ...args, botKey: BOT_KEY } : args;
  void name;

  const invoke = async (type: "query" | "mutation", name: string, args: Row) => {
    calls.push({ type, name });
    const handler = routes[type][name];
    if (!handler) throw new Error(`Chưa map ${type} "${name}" — hợp đồng bot ⇄ Convex đã lệch`);
    return handler._handler(ctx, withKey(name, args ?? {}));
  };

  return {
    calls,
    // Bot luôn có config cache; snapshot chỉ thêm phần settings nếu có config.
    getConfig: async () => null,
    client: {
      query: (name: string, args: Row) => invoke("query", name, args),
      mutation: (name: string, args: Row) => invoke("mutation", name, args),
      action: async () => {
        throw new Error("action không dùng trong luồng backup này");
      },
    },
  };
}

// ─────────────────────────── Discord client giả ─────────────────────────────
/** Guild "thật" với 3 role, 2 kênh, 1 emoji động, 1 sticker — đủ để snapshot có nội dung. */
function makeDiscordClient(opts: { withMessages?: boolean; failChannel?: boolean } = {}) {
  const role = (id: string, name: string, position: number, managed = false) => ({
    id,
    name,
    position,
    managed,
    color: 0x5865f2,
    hoist: false,
    mentionable: false,
    permissions: { bitfield: 2048n },
    iconURL: () => null,
    unicodeEmoji: null,
  });
  const channel = (id: string, name: string, position: number) => ({
    id,
    name,
    type: 0, // ChannelType.GuildText
    topic: `chủ đề ${name}`,
    nsfw: false,
    bitrate: null,
    userLimit: null,
    position,
    parentId: null,
    permissionOverwrites: { cache: new Map() },
    ...(opts.withMessages && !opts.failChannel
      ? {
          messages: {
            fetch: async ({ limit }: { limit: number }) =>
              new Map(
                [
                  { id: "m3", createdTimestamp: 3000, content: "tin thứ ba" },
                  { id: "m1", createdTimestamp: 1000, content: "tin đầu" },
                  { id: "m2", createdTimestamp: 2000, content: "tin thứ hai" },
                ]
                  .slice(0, limit)
                  .map((m) => [
                    m.id,
                    {
                      ...m,
                      author: { id: USER, username: "user1" },
                      attachments: new Map(),
                    },
                  ]),
              ),
          },
        }
      : {}),
  });

  const guild = {
    id: GID,
    name: "Server Thật",
    available: true,
    memberCount: 128,
    premiumSubscriptionCount: 4,
    members: { me: { permissions: { bitfield: 8n } } },
    roles: {
      cache: new Map([
        ["@everyone", role("r0", "@everyone", 0)],
        ["r1", role("r1", "Admin", 1)],
        ["r2", role("r2", "Member", 2)],
      ]),
    },
    channels: {
      cache: new Map([
        ["c1", channel("c1", "chung", 0)],
        ["c2", channel("c2", "thông-báo", 1)],
      ]),
    },
    emojis: {
      cache: new Map([
        [
          "e1",
          {
            id: "e1",
            name: "wio",
            animated: true,
            available: true,
            imageURL: () => "https://cdn.example/e1.gif",
          },
        ],
        ["e2", { id: "e2", name: "ghost", animated: false, available: false }],
      ]),
    },
    stickers: {
      cache: new Map([
        [
          "s1",
          {
            id: "s1",
            name: "wave",
            description: "vẫy tay",
            tags: "👋",
            format: 1,
            url: "https://cdn.example/s1.png",
          },
        ],
      ]),
    },
  };

  return { guilds: { cache: { get: (id: string) => (id === GID ? guild : null) } } };
}

/** Dựng DB "vừa mời bot": guild + session đăng nhập + botStatus (botKeySeed). */
function seed() {
  const h = makeCtx();
  h.rows("botStatus").push({ _id: "st", kind: "status", botKeySeed: computeBotKey(BOT_KEY) });
  h.rows("guilds").push({
    _id: "gld",
    discordId: GID,
    name: "Server Thật",
    managers: [USER],
    botInGuild: true,
    prefix: "!",
  });
  h.rows("users").push({ _id: USER, discordId: USER, manageableGuildIds: [] });
  h.rows("sessions").push({ _id: "s1", token: TOKEN, userId: USER, createdAt: Date.now() });
  return h;
}

const guildRow = (h: ReturnType<typeof seed>) => h.rows("guilds")[0];

/** Chuỗi production: dashboard yêu cầu → tick → claim → runBackup → (bot tự clear). */
async function runDashboardToBot(
  h: ReturnType<typeof seed>,
  clientOpts: { withMessages?: boolean } = {},
) {
  const store = makeStore(h.ctx);
  const jobs = await (getPendingJobs as any)._handler(h.ctx, { botKey: BOT_KEY });
  const job = jobs.backups.find((b: any) => b.guildId === GID && b.kind === "backup");
  if (!job) throw new Error("tick không trả job backup — getPendingJobs đã lệch hợp đồng");
  const claimed = await (botClaimBackup as any)._handler(h.ctx, {
    guildId: GID,
    kind: "backup",
    botKey: BOT_KEY,
  });
  if (!claimed?.ok) throw new Error(`claim thất bại: ${claimed?.reason}`);
  // Lời gọi y hệt bot/src/tick.js:runBackupJobs
  await backupMod.runBackup(makeDiscordClient(clientOpts), store, GID, {
    pushToGithub: !!job.pushToGithub,
    includeMessages: !!job.includeMessages,
    skipNotice: true,
  });
  return { store, job };
}

const dashboardStatus = async (h: ReturnType<typeof seed>) =>
  (importStatus as any)._handler(h.ctx, { token: TOKEN, guildId: GID });
const backupList = async (h: ReturnType<typeof seed>) =>
  (listGuild as any)._handler(h.ctx, { guildId: GID, botKey: BOT_KEY });

(async () => {
  console.log("\n═══ LUỒNG 1: bấm Backup ngay → có bản backup thật ═══");
  {
    const h = seed();
    await (requestBackup as any)._handler(h.ctx, {
      token: TOKEN,
      guildId: GID,
      pushToGithub: false,
      includeMessages: false,
    });
    check("dashboard: bấm Backup ngay → đặt cờ chờ bot", guildRow(h).backupRequested === true);
    check(
      "dashboard: xoá mốc 'xong' của lượt trước (không báo nhầm kết quả cũ)",
      guildRow(h).backupFinishedAt === undefined && guildRow(h).backupUnchanged === false,
    );

    const { job } = await runDashboardToBot(h);

    check(
      "tick → job backup đúng guild, không kèm tin nhắn",
      job.kind === "backup" && job.includeMessages === false,
    );
    const list = await backupList(h);
    check("Convex đã lưu đúng 1 bản backup", list.length === 1);
    check(
      "bản backup chứa role/kênh thật của guild",
      list[0].roleCount === 2 && list[0].channelCount === 2,
    );
    check("bản backup có nguồn 'backup'", list[0].source === "backup");
    const rawRow = h.rows("guildBackups")[0];
    check(
      "bản backup có 2 checksum (nội dung nén + cấu trúc ổn định)",
      typeof rawRow.backupChecksum === "string" &&
        typeof rawRow.backupSnapshotChecksum === "string",
    );
    check(
      "listGuild KHÔNG lộ nội dung backup (nhẹ cho lệnh chat)",
      (list[0] as any).backupJson === undefined,
    );
    check("bot xoá cờ chờ sau khi lưu xong", guildRow(h).backupRequested === false);
    check("bot xoá khoá claim", guildRow(h).backupClaimedAt === undefined);
    check(
      "lastBackupAt được cập nhật (không kích hoạt backup tự động lại)",
      typeof guildRow(h).lastBackupAt === "number",
    );
    check("cờ báo lỗi không được đặt", guildRow(h).backupError === undefined);

    const st = await dashboardStatus(h);
    check(
      "dashboard thấy 'đã tạo xong một bản mới' (backupFinishedAt + unchanged=false)",
      typeof st.backupFinishedAt === "number" && st.backupUnchanged === false,
    );
    // importStatus KHÔNG trả lastBackupAt (dashboard đọc qua getGuild) — kiểm
    // ở đây rằng nó không hứa hão trường đó.
    check("importStatus không trả lastBackupAt (đúng hợp đồng hiện tại)", !("lastBackupAt" in st));
    check("dashboard KHÔNG còn thấy yêu cầu đang chờ", st.backupRequested === false);
  }

  console.log("\n═══ LUỒNG 2: bấm Backup ngay lần 2, server KHÔNG đổi ═══");
  {
    const h = seed();
    await (requestBackup as any)._handler(h.ctx, {
      token: TOKEN,
      guildId: GID,
      includeMessages: false,
    });
    await runDashboardToBot(h);
    const firstAt = guildRow(h).lastBackupAt as number;

    // Lượt 2: không đổi gì → bot phải bỏ qua nhưng VẪN báo kết quả về dashboard.
    await (requestBackup as any)._handler(h.ctx, {
      token: TOKEN,
      guildId: GID,
      includeMessages: false,
    });
    await runDashboardToBot(h);

    const list = await backupList(h);
    const st = await dashboardStatus(h);
    check("không tạo bản trùng lặp (vẫn đúng 1 bản)", list.length === 1);
    check("dashboard nhận đúng lý do 'server không đổi'", st.backupUnchanged === true);
    check("dashboard nhận mốc xong MỚI của lượt 2", st.backupFinishedAt >= firstAt);
    check("lượt bỏ qua vẫn dọn yêu cầu đang chờ", st.backupRequested === false);

    // Checksum ổn định: chạy lại so khớp vẫn ra cùng giá trị (không có timestamp lọt vào).
    const cs = await (botGetLastChecksum as any)._handler(h.ctx, { guildId: GID, botKey: BOT_KEY });
    check(
      "botGetLastChecksum trả checksum của bản gần nhất",
      typeof cs?.backupSnapshotChecksum === "string",
    );
  }

  console.log("\n═══ LUỒNG 3: Convex từ chối lưu (document > 1 MB) ═══");
  {
    const h = seed();
    h.setFailStore(true); // Convex chặn insert guildBackups — y hệt backup quá lớn
    await (requestBackup as any)._handler(h.ctx, {
      token: TOKEN,
      guildId: GID,
      includeMessages: true,
    });
    await runDashboardToBot(h, { withMessages: true });

    const list = await backupList(h);
    const st = await dashboardStatus(h);
    const row = guildRow(h);
    check("KHÔNG có bản backup giả nào được ghi", list.length === 0);
    check("bot BÁO LỖI về dashboard thay vì im lặng", typeof row.backupError === "string");
    check(
      "thông điệp lỗi chỉ đúng việc cần làm (tắt 'Kèm tin nhắn')",
      /1 MB/.test(row.backupError) && /Kèm tin nhắn/.test(row.backupError),
    );
    check("KHÔNG đánh dấu 'đã xong' khi lưu thất bại", row.backupFinishedAt === undefined);
    check(
      "KHÔNG cập nhật lastBackupAt khi lưu thất bại (để bot còn thử lại)",
      row.lastBackupAt === undefined,
    );
    check("lỗi được xoá cờ chờ (không kẹt vòng lặp vô hạn)", row.backupRequested === false);
    check("dashboard đọc được lỗi để hiển thị banner", typeof st.backupError === "string");
    check("dashboard KHÔNG đọc thành 'vừa tạo xong'", st.backupFinishedAt === null);
    check(
      "dashboard thấy yêu cầu đã kết thúc (không quay vòng vô tận)",
      st.backupRequested === false,
    );
  }

  console.log("\n═══ LUỒNG 4: backup kèm tin nhắn (đường thành công) ═══");
  {
    const h = seed();
    await (requestBackup as any)._handler(h.ctx, {
      token: TOKEN,
      guildId: GID,
      includeMessages: true,
    });
    const { job } = await runDashboardToBot(h, { withMessages: true });
    const list = await backupList(h);
    check("tick giữ đúng cờ includeMessages", job.includeMessages === true);
    check("backup kèm tin nhắn: đếm đúng 3 tin của 2 kênh", list[0].messageCount === 6);
    check(
      "backup vẫn lưu bản nén zlib ('z:…')",
      String(h.rows("guildBackups")[0].backupJson).startsWith("z:"),
    );
    const st = await dashboardStatus(h);
    check(
      "dashboard báo hoàn tất (không phải 'không đổi')",
      st.backupUnchanged === false && typeof st.backupFinishedAt === "number",
    );
  }

  console.log("\n═══ LUỒNG 5: emoji/sticker của server vào backup ═══");
  {
    const h = seed();
    await (requestBackup as any)._handler(h.ctx, { token: TOKEN, guildId: GID });
    await runDashboardToBot(h);
    const row = h.rows("guildBackups")[0];
    check("backup ghi số emoji khả dụng (bỏ emoji unavailable)", row.emojiCount === 1);
    check("backup ghi số sticker", row.stickerCount === 1);
    check("backup được nén", row.backupCompressed === true);
    check("không mã hoá khi không có BACKUP_ENCRYPT_KEY", row.backupEncrypted === undefined);
  }

  console.log(`\n${pass}/${pass + fail} ✅`);
  process.exit(fail > 0 ? 1 : 0);
})();
