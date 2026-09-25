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
  botRenewBackupClaim,
  botStoreBackup,
  botClearBackup,
  botReportBackupError,
  botSetRestoreRequest,
  botReportRestoreError,
  botReportImportError,
  botRestoreSettings,
} from "../convex/bot_writes";
import { getPendingJobs } from "../convex/bot_tick";
import { computeBotKey } from "../convex/botAuth";

/** Bot là CommonJS — nạp module thật để lái engine backup thật của production. */
import backupMod from "../bot/src/handlers/backup.js";
/**
 * tick.js thật của production (runBackupJobs) — nạp qua createRequire vì test là
 * ESM còn bot là CommonJS. tick.js require handlers/hidden → welcomeCard →
 * @napi-rs/canvas (nạp lười, không bắt buộc) → môi trường không canvas vẫn chạy.
 */
import { createRequire } from "node:module";
const tickMod = createRequire(import.meta.url)("../bot/src/tick.js") as {
  runBackupJobs: (
    client: unknown,
    store: unknown,
    items: {
      guildId: string;
      kind: string;
      backupJson?: string;
      guildName?: string;
      fileName?: string;
      importFileUrl?: string;
    }[],
  ) => Promise<void>;
};

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
        const i = rows.findIndex((r) => r._id === id);
        if (i < 0) continue;
        // Convex: document là SNAPSHOT BẤT BIẾN — patch tạo phiên bản mới, tham
        // chiếu cũ (vd `guild` handler đã fetch) giữ nguyên giá trị trước patch.
        // Mock cũ mutate in-place → handler đọc lại `guild.importStorageId` SAU
        // patch nhận undefined và bỏ qua storage.delete (lỗi giả, 24/09/2026).
        const next: Row = { ...rows[i] };
        for (const [k, v] of Object.entries(patch)) {
          // Convex: patch với undefined = XOÁ field (dashboard dựa vào đây để đọc
          // "chưa có mốc xong" thay vì nhầm với lượt trước).
          if (v === undefined) delete next[k];
          else next[k] = v;
        }
        rows[i] = next;
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

  /** ID file storage đã xoá — luồng import phải dọn file sau khi xử lý xong. */
  const deletedStorage: string[] = [];
  return {
    ctx: {
      db,
      storage: {
        getUrl: async () => null,
        // Convex thật có storage.delete — botClearBackup / botReportImportError
        // gọi nó để dọn file .msc đã import. Thiếu ở đây thì đường xoá file
        // không từng được xác minh (đã gặp thật 24/09/2026 — mock thiếu delete).
        delete: async (id: string) => {
          deletedStorage.push(id);
        },
      },
    },
    /** Danh sách ID storage đã xoá — test dùng để khẳng định file import bị dọn. */
    deletedStorage,
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
      "bot_writes:botRenewBackupClaim": botRenewBackupClaim,
      // Hợp đồng luồng restore/import — gọi tên sai ở bot → suite đỏ ngay.
      "bot_writes:botSetRestoreRequest": botSetRestoreRequest,
      "bot_writes:botReportRestoreError": botReportRestoreError,
      "bot_writes:botReportImportError": botReportImportError,
      "bot_writes:botRestoreSettings": botRestoreSettings,
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
/**
 * Guild "thật" với 3 role, 2 kênh, 1 emoji động, 1 sticker — đủ để snapshot có
 * nội dung. Mock hỗ trợ ĐỦ API mà restore dùng (roles.create, channels.create,
 * emojis.create, stickers.create, createWebhook) để luồng khôi phục được xác
 * minh TẠO LẠI THẬT — không chỉ "không crash". Mọi đối tượng tạo ra được ghi
 * vào client.__created để test kiểm chứng.
 */
function makeDiscordClient(opts: { withMessages?: boolean; failChannel?: boolean } = {}) {
  const created = {
    roles: [] as any[],
    channels: [] as any[],
    emojis: [] as any[],
    stickers: [] as any[],
    webhookSends: [] as any[],
  };
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

  const roleCache = new Map([
    ["@everyone", role("r0", "@everyone", 0)],
    ["r1", role("r1", "Admin", 1)],
    ["r2", role("r2", "Member", 2)],
  ]);
  const channelCache = new Map([
    ["c1", channel("c1", "chung", 0)],
    ["c2", channel("c2", "thông-báo", 1)],
  ]);
  let createdRoleN = 0;
  let createdChannelN = 0;

  const guild = {
    id: GID,
    name: "Server Thật",
    available: true,
    memberCount: 128,
    premiumSubscriptionCount: 4,
    members: { me: { permissions: { bitfield: 8n } } },
    // replayMessages dùng iconURL làm avatar webhook — null là hợp lệ (bỏ avatar).
    iconURL: () => null,
    roles: {
      cache: roleCache,
      // restore: createRoles — tạo role mới + sắp vị trí + set icon (best-effort).
      create: async (o: any) => {
        const id = `nr${++createdRoleN}`;
        const r = role(id, String(o.name), createdRoleN);
        roleCache.set(id, r);
        created.roles.push({
          name: o.name,
          color: o.color,
          permissions: String(o.permissions ?? 0n),
        });
        return { id, setPosition: async () => {}, setIcon: async () => {} };
      },
    },
    channels: {
      cache: channelCache,
      // restore: createChannels — tạo danh mục rồi kênh thường.
      create: async (o: any) => {
        const id = `nc${++createdChannelN}`;
        const ch: any = {
          id,
          name: o.name,
          type: o.type,
          position: 0,
          permissionOverwrites: { cache: new Map() },
          isTextBased: () => o.type === 0 || o.type === 5,
          setPosition: async () => {},
          createWebhook: async (wo: any) => {
            const wh = {
              name: wo?.name,
              sends: created.webhookSends,
              send: async (p: any) => created.webhookSends.push(p),
              delete: async () => {},
            };
            return wh;
          },
          send: async () => {},
        };
        channelCache.set(id, ch);
        created.channels.push({ name: o.name, type: o.type, parent: o.parent });
        return ch;
      },
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
      // restore: recreateEmojis — tải ảnh từ URL/data URI rồi tạo lại thật.
      create: async (o: any) => {
        created.emojis.push({ name: o.name, bytes: o.attachment?.length ?? 0 });
        return { id: `ne${created.emojis.length}` };
      },
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
      // restore: restoreStickers — tải file rồi tạo lại thật.
      create: async (o: any) => {
        created.stickers.push({ name: o.name, tags: o.tags });
        return { id: `ns${created.stickers.length}` };
      },
    },
  };

  const client = { guilds: { cache: { get: (id: string) => (id === GID ? guild : null) } } };
  (client as any).__created = created;
  return client;
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
  h.rows("users").push({ _id: USER, discordId: USER, manageableGuildIds: [GID] });
  h.rows("sessions").push({
    _id: "s1",
    token: TOKEN,
    userId: USER,
    createdAt: Date.now(),
    authVersion: 1,
  });
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

/**
 * Chặn mạng thật: chỉ cho fetch data: URI (file import nhúng) và CDN giả
 * cdn.example (URL emoji/sticker/ảnh trong backup) — mọi URL khác là lỗi test.
 * Trả buffer PNG nhỏ hợp lệ đủ để recreateEmojis/restoreStickers tạo lại.
 * CẢ DNS phải giả lập: assertSafeRemoteUrl phân giải host trước fetch, sandbox
 * không có DNS → cdn.example bị chặn trước cả khi fetch được mock.
 */
function installFetchMock() {
  const realFetch = globalThis.fetch;
  const realLookup = require("node:dns").promises.lookup;
  require("node:dns").promises.lookup = async (host: string) => [
    { address: "93.184.216.34", family: 4 },
  ];
  globalThis.fetch = (async (url: any) => {
    const s = String(url);
    if (s.startsWith("data:")) {
      const [, b64] = s.split(",");
      return new Response(Buffer.from(b64, "base64"), { status: 200 });
    }
    if (s.startsWith("https://cdn.example/")) {
      return new Response(Buffer.from("PNGDATA"), { status: 200 });
    }
    throw new Error(`test không cho fetch thật: ${url}`);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = realFetch;
    require("node:dns").promises.lookup = realLookup;
  };
}

/**
 * Lái đúng code điều phối thật của production: tick.js runBackupJobs — nhận
 * quyền (claim) + chọn nhánh backup/restore/import + báo lỗi về dashboard.
 * Không lái qua đây thì mọi thay đổi ở tick.js (điều phối) sẽ không bị test nào
 * ở luồng này chặn.
 */
async function driveTick(
  h: ReturnType<typeof seed>,
  items: Parameters<typeof tickMod.runBackupJobs>[2],
) {
  const store = makeStore(h.ctx);
  const client = makeDiscordClient();
  await tickMod.runBackupJobs(client, store, items as any);
  return { store, client };
}

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
    check(
      "bot xoá khoá claim + lease",
      guildRow(h).backupClaimedAt === undefined && guildRow(h).backupLeaseUntil === undefined,
    );
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

  console.log("\n═══ LUỒNG 6: dashboard bấm Khôi phục → bot tạo lại role/kênh/tin nhắn ═══");
  {
    const h = seed();
    // Bước 1: tạo bản backup thật (engine thật) — dùng làm nguồn khôi phục.
    await (requestBackup as any)._handler(h.ctx, { token: TOKEN, guildId: GID });
    await runDashboardToBot(h);
    const original = await backupList(h);
    check("chuẩn bị: đã có 1 bản backup Protogon", original.length === 1);

    // Bước 2: bot lệnh /backup restore (botSetRestoreRequest — cùng 1 chữ ký mà
    // bot dùng khi chủ server gõ lệnh khôi phục).
    await (botSetRestoreRequest as any)._handler(h.ctx, {
      guildId: GID,
      backupId: original[0]._id,
      botKey: BOT_KEY,
    });
    const st0 = await dashboardStatus(h);
    check("dashboard thấy yêu cầu khôi phục đang chờ", st0.restoreRequested === true);

    // Bước 3: tick trả job restore → bot điều phối thật qua tick.js runBackupJobs.
    const jobs = await (getPendingJobs as any)._handler(h.ctx, { botKey: BOT_KEY });
    const restoreJob = jobs.backups.find((b: any) => b.kind === "restore");
    check(
      "tick trả job restore kèm JSON của bản backup",
      !!restoreJob && typeof restoreJob.backupJson === "string",
    );
    const restoreFetch = installFetchMock();
    const { client } = await driveTick(h, jobs.backups);
    restoreFetch();
    const made = (client as any).__created;

    // Bước 4: trạng thái sau khôi phục + xác minh ĐỒ ĐÃ TẠO LẠI THẬT.
    const st = await dashboardStatus(h);
    check("yêu cầu khôi phục được dọn sau khi xong", st.restoreRequested === false);
    check("cột mốc khôi phục xong được ghi", typeof st.restoreFinishedAt === "number");
    check("KHÔNG báo lỗi khôi phục", st.restoreError === null);
    // Snapshot gốc có 2 role (Admin, Member) + 2 kênh (chung, thông-báo):
    check("role đã được TẠO LẠI đúng số lượng", made.roles.length === 2);
    check(
      "tên role khớp bản backup",
      made.roles
        .map((r: any) => r.name)
        .sort()
        .join(",") === "Admin,Member",
    );
    check("kênh đã được TẠO LẠI đúng số lượng", made.channels.length === 2);
    check(
      "tên kênh khớp bản backup",
      made.channels
        .map((c: any) => c.name)
        .sort()
        .join(",") === "chung,thông-báo",
    );
    check(
      "emoji đã được tải + tạo lại (tên chuẩn hóa)",
      made.emojis.length === 1 && made.emojis[0].name === "wio",
    );
    check(
      "sticker đã được tải + tạo lại",
      made.stickers.length === 1 && made.stickers[0].name === "wave",
    );

    // Server "phục hồi" = server gốc trong test: cấu hình được ghi lại qua
    // botRestoreSettings (mảng whitelist giữ nguyên id vì roleMap rỗng trong mock).
    const row = guildRow(h);
    check(
      "botRestoreSettings được gọi (cấu hình cơ bản áp lại)",
      typeof row.updatedAt === "number",
    );
    // Kênh log vẫn nhận embed hoàn tất (webhook gửi qua store.getConfig của mock).
    check("dashboard KHÔNG còn thấy backup đang chờ", st.backupRequested === false);
  }

  console.log("\n═══ LUỒNG 7: import file .msc của bot nuke → khôi phục + lưu lại ═══");
  {
    const h = seed();
    // File .msc "chuẩn" của bot nuke: wrapper {data:{guild:{...}}} + trường đa dạng
    // (guildRoles, permission_overwrites, hex color, type chữ) — đúng các biến thể
    // normalizeBackupFile phải đọc được.
    const mscFile = JSON.stringify({
      data: {
        guild: {
          guildName: "Server Bị Nuke",
          guildRoles: [
            { name: "Admin", color: "#ff0000", permissions: "ADMINISTRATOR", position: 1 },
            { name: "Member", color: 0x00ff00, permissions: ["ViewChannel"], position: 2 },
          ],
          channels: [
            {
              name: "chung",
              type: "text",
              topic: "kênh chính",
              messages: [
                { content: "tin thứ nhất", timestamp: 1000, username: "user1" },
                { content: "tin thứ hai", timestamp: 2000, username: "user2" },
              ],
            },
          ],
          guildEmojis: [{ name: "wio", url: "https://cdn.example/e1.png" }],
        },
      },
    });
    // Tải file vào "storage" giả rồi ghi guild.importStorageId (làm bằng tay thay
    // generateUploadUrl vì fake ctx.storage chỉ getUrl về null).
    h.rows("guilds")[0].importRestoreRequested = true;
    h.rows("guilds")[0].importFileName = "backup.msc";
    h.rows("guilds")[0].importStorageId = "st_import";
    (h.ctx as any).storage.getUrl = async (id: string) =>
      id === "st_import"
        ? `data:text/plain;base64,${Buffer.from(mscFile).toString("base64")}`
        : null;
    const restoreFetch = installFetchMock();
    try {
      const jobs = await (getPendingJobs as any)._handler(h.ctx, { botKey: BOT_KEY });
      const importJob = jobs.backups.find((b: any) => b.kind === "import");
      check(
        "tick trả job import kèm URL file",
        !!importJob && typeof importJob.importFileUrl === "string",
      );
      const { client } = await driveTick(h, jobs.backups);
      const made = (client as any).__created;

      const st = await dashboardStatus(h);
      check("file import được xử lý xong (cờ dọn)", st.requested === false);
      check("KHÔNG lỗi import", st.error === null);
      // Bản chuẩn hóa được lưu lại làm bằng chứng/khôi phục lần sau.
      const list = await backupList(h);
      check(
        "file import được lưu lại làm bản backup nguồn 'import'",
        list.length === 1 && list[0].source === "import",
      );
      check(
        "bản lưu giữ đúng số role/kênh đã chuẩn hóa",
        list[0].roleCount === 2 && list[0].channelCount === 1,
      );
      check("bản lưu giữ đúng số tin nhắn", list[0].messageCount === 2);
      // Xác minh khôi phục TẠO LẠI THẬT từ file bot nuke (qua engine restoreCore).
      check("role từ file .msc được tạo lại", made.roles.length === 2);
      check(
        "kênh từ file .msc được tạo lại",
        made.channels.length === 1 && made.channels[0].name === "chung",
      );
      check(
        "emoji từ file .msc được tạo lại (tên chuẩn hóa)",
        made.emojis.length === 1 && made.emojis[0].name === "wio",
      );
      // Tin nhắn trong file .msc được phát lại QUA WEBHOOK giữ tên người gửi,
      // theo đúng thứ tự thời gian.
      check("tin nhắn phát lại qua webhook (2 tin)", made.webhookSends.length === 2);
      check(
        "thứ tự + tên người gửi được giữ đúng",
        made.webhookSends[0]?.content === "tin thứ nhất" &&
          made.webhookSends[0]?.username === "user1" &&
          made.webhookSends[1]?.content === "tin thứ hai" &&
          made.webhookSends[1]?.username === "user2",
      );
      // File import KHÔNG để rác trong storage — botClearBackup gọi
      // ctx.storage.delete(importStorageId) sau khi xử lý xong.
      check("file import bị xoá khỏi storage sau khi xong", h.deletedStorage.includes("st_import"));
    } finally {
      restoreFetch();
    }
  }

  console.log("\n═══ LUỒNG 8: file import RÁC → bot báo lỗi về dashboard ═══");
  {
    const h = seed();
    h.rows("guilds")[0].importRestoreRequested = true;
    h.rows("guilds")[0].importFileName = "rac.msc";
    h.rows("guilds")[0].importStorageId = "st_rac";
    (h.ctx as any).storage.getUrl = async (id: string) =>
      id === "st_rac"
        ? `data:text/plain;base64,${Buffer.from("nội dung rác không phải JSON").toString("base64")}`
        : null;
    const jobs = await (getPendingJobs as any)._handler(h.ctx, { botKey: BOT_KEY });
    await driveTick(h, jobs.backups);
    const st = await dashboardStatus(h);
    check("yêu cầu import được dọn (không kẹt chờ)", st.requested === false);
    check(
      "dashboard nhận được lý do lỗi cụ thể",
      typeof st.error === "string" && st.error.length > 0,
    );
    check("KHÔNG lưu bản backup rác", (await backupList(h)).length === 0);
    // Đường lỗi cũng phải dọn file (botReportImportError xóa file + cờ).
    check("file rác cũng bị xoá khỏi storage", h.deletedStorage.includes("st_rac"));
  }

  console.log("\n═══ LUỒNG 9: restore JSON hỏng → botReportRestoreError ═══");
  {
    const h = seed();
    // Mô phỏng "backup ma": cờ restoreRequested trỏ tới id không tồn tại
    // (bản backup bị xóa giữa chừng). Đặt trực tiếp field — botSetRestoreRequest
    // CHẶN id không tồn tại (đúng thiết kế), nên con đường này chỉ đến từ dữ liệu cũ.
    const g = h.rows("guilds")[0];
    g.restoreRequested = true;
    g.restoreBackupId = "bk_ghost";
    const jobs = await (getPendingJobs as any)._handler(h.ctx, { botKey: BOT_KEY });
    check(
      "backup ma → tick KHÔNG trả job restore (không restore nhầm)",
      jobs.backups.find((b: any) => b.kind === "restore") === undefined,
    );
    // JSON hỏng (file backup bị cắt cụt) → tick.js phải báo lỗi về dashboard.
    await driveTick(h, [
      { guildId: GID, kind: "restore", backupJson: "{json hỏng", guildName: "x" },
    ]);
    const row = guildRow(h);
    check("lỗi khôi phục được ghi về dashboard", typeof row.restoreError === "string");
    check("cờ yêu cầu khôi phục được dọn", row.restoreRequested === false);
    check("cột mốc xong KHÔNG được ghi khi lỗi", row.restoreFinishedAt === undefined);
  }

  console.log("\n═══ LUỒNG 10: đẩy GitHub lỗi → backup vẫn phải lưu (không mất dữ liệu) ═══");
  {
    const h = seed();
    await (requestBackup as any)._handler(h.ctx, {
      token: TOKEN,
      guildId: GID,
      pushToGithub: true,
      includeMessages: false,
    });
    const store = makeStore(h.ctx);
    // Action GitHub ném lỗi (token sai / mạng chết) — pushBackupToGithub nuốt
    // thành { ok:false } nên luồng backup không được phép vỡ theo.
    store.client.action = async () => {
      throw new Error("GitHub 401: Bad credentials");
    };
    const jobs = await (getPendingJobs as any)._handler(h.ctx, { botKey: BOT_KEY });
    const job = jobs.backups.find((b: any) => b.kind === "backup");
    await backupMod.runBackup(makeDiscordClient(), store, GID, {
      pushToGithub: !!job.pushToGithub,
      includeMessages: false,
      skipNotice: true,
    });
    const list = await backupList(h);
    check("backup VẪN được lưu khi GitHub chết", list.length === 1);
    check("bản backup KHÔNG bị đánh dấu đã đẩy GitHub", list[0].pushedToGithub === false);
    const st = await dashboardStatus(h);
    check("dashboard vẫn báo hoàn tất backup", typeof st.backupFinishedAt === "number");
  }

  console.log(`\n${pass}/${pass + fail} ✅`);
  process.exit(fail > 0 ? 1 : 0);
})();
