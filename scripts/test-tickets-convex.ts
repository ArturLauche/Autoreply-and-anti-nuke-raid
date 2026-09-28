// TEST: convex/tickets.ts — lớp dữ liệu phía dashboard (list/summary/close)
// + 2 query bot đọc (botTicketState, botTicketById). Chạy: bun scripts/test-tickets-convex.ts
//
// Vì sao cần: đợt trước toàn bộ 5 function này có 0% coverage, mà chúng là
// nơi quyết định ba thứ bảo mật:
//   1. THỨ TỰ. `order("desc")` trên index chỉ đảo theo field CUỐI của index.
//      Index `by_guildId_status` / `by_guildId_openerId` có field cuối CỐ ĐỊNH
//      (status / openerId) → `order("desc")` KHÔNG bảo đảm "mới nhất trước".
//      Hậu quả thật: cooldown tính nhầm (phạt oan), "bạn đã có ticket mở" bị
//      bypass, danh sách dashboard lệch thứ tự.
//   2. QUYỀN: không manage guild thì không đọc/đóng được ticket của server đó.
//   3. BOT KEY: query bot từ chối khi thiếu/sai key (requireBotKeyStrict).
import {
  listTickets,
  ticketSummary,
  closeTicket,
  botTicketState,
  botTicketById,
} from "../convex/tickets";
import {
  botOpenTicket,
  botCloseTicket,
  botSetTicketChannel,
  botClaimTicket,
} from "../convex/bot_writes";
import { updateSettings } from "../convex/guilds";
import { computeBotKey } from "../convex/botAuth";

const listH = (listTickets as any)._handler;
const summaryH = (ticketSummary as any)._handler;
const closeH = (closeTicket as any)._handler;
const stateH = (botTicketState as any)._handler;
const byIdH = (botTicketById as any)._handler;
const openH = (botOpenTicket as any)._handler;
const botCloseH = (botCloseTicket as any)._handler;
const setChannelH = (botSetTicketChannel as any)._handler;
const claimH = (botClaimTicket as any)._handler;
const updateH = (updateSettings as any)._handler;

let pass = 0;
let fail = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
  if (ok) pass++;
  else fail++;
};

const BOT_KEY = "khoa-bot-that-giu-nguyen";
type Row = Record<string, any>;

// ─── Ctx giả: 5 bảng trên Map, withIndex mô phỏng đúng range của Convex ───
function makeCtx(opts: { seed?: string | null } = {}) {
  const tickets: Row[] = [];
  const guilds: Row[] = [];
  const sessions: Row[] = [];
  const users: Row[] = [];
  const statusRows: Row[] =
    opts.seed === null
      ? []
      : [{ _id: "st1", kind: "status", botKeySeed: computeBotKey(opts.seed ?? BOT_KEY) }];
  const tables: Record<string, Row[]> = { tickets, guilds, sessions, users, botStatus: statusRows };

  let idSeq = 0;
  const ctx = {
    now: 1_700_000_000_000,
    db: {
      insert: async (table: string, doc: Row) => {
        const id = `${table}-${++idSeq}`;
        (tables[table] ?? (tables[table] = [])).push({ _id: id, ...doc });
        return id;
      },
      get: async (id: string) =>
        [...users, ...guilds, ...tickets, ...sessions].find((r) => r._id === id) ?? null,
      patch: async (id: string, patch: Row) => {
        // Phải vá CẢ `tickets` lẫn `guilds`: `botOpenTicket` bump bộ đếm
        // modCaseCounter nằm ở bảng guilds.
        for (const table of ["tickets", "guilds"]) {
          const row = (tables[table] ?? []).find((r) => r._id === id);
          if (row) Object.assign(row, patch);
        }
      },
      query: (table: string) => ({
        withIndex: (_name: string, bound: (q: any) => any) => {
          const capture: Record<string, string> = {};
          const q: any = { eq: (f: string, v: string) => ((capture[f] = v), q) };
          bound(q);
          const rows = tables[table] ?? [];
          // Chỉ lọc theo field đã eq — mô phỏng đúng index range.
          const matched = rows.filter((r) => Object.entries(capture).every(([f, v]) => r[f] === v));
          // `order(dir)` chỉ đảo theo field CUỐI trong capture (field cuối của
          // index). Field đó cố định ở mọi index dùng ở đây → thứ tự giữ nguyên
          // như scan thẳng. Đây chính là hành vi khiến "mới nhất trước" là
          // một lời hứa không có, nên code phải tự sắp lại.
          const lastField = Object.keys(capture).at(-1);
          const ordered = (dir: "asc" | "desc") => {
            if (!lastField) return [...matched];
            const f = lastField;
            return [...matched].sort((a, b) =>
              dir === "desc"
                ? String(b[f]).localeCompare(String(a[f]))
                : String(a[f]).localeCompare(String(b[f])),
            );
          };
          return {
            first: async () => matched[0] ?? null,
            collect: async () => [...matched],
            take: async (n: number) => matched.slice(0, n),
            order: (dir: "asc" | "desc") => {
              const list = ordered(dir);
              return {
                take: async (n: number) => list.slice(0, n),
                first: async () => list[0] ?? null,
                collect: async () => [...list],
              };
            },
          };
        },
      }),
    },
  };
  return { ctx, tickets, guilds, sessions, users };
}

/** Một ticket với createdAt chỉ định (để kiểm thứ tự). */
function ticket(id: string, over: Row = {}) {
  return {
    _id: id,
    guildId: "g1",
    number: 1,
    channelId: `ch-${id}`,
    kind: "support",
    openerId: "u1",
    openerName: "Minh",
    body: "nội dung",
    evidence: "",
    source: "cmd",
    status: "open",
    createdAt: 1_000,
    ...over,
  };
}

/** Môi trường có chủ server đã đăng nhập + 1 server. */
function env(opts: { seed?: string | null; manageable?: boolean } = {}) {
  const e = makeCtx({ seed: opts.seed });
  e.guilds.push({ _id: "G", discordId: "g1", name: "Server", managers: ["owner"] });
  e.users.push({
    _id: "U",
    discordId: "owner",
    username: "Chủ",
    manageableGuildIds: opts.manageable === false ? [] : ["g1"],
  });
  e.sessions.push({ _id: "S", token: "tok", userId: "U", createdAt: Date.now(), authVersion: 1 });
  return e;
}

const throws = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
};

(async () => {
  // ═══ listTickets: quyền + thứ tự ═══
  console.log("\n── listTickets ──");
  {
    const e = env();
    e.tickets.push(ticket("t1", { createdAt: 100 }), ticket("t2", { createdAt: 300 }));
    const rows = await listH(e.ctx, { token: "tok", guildId: "g1" });
    check(
      "KHÔNG lọc status → mới nhất trước",
      rows.length === 2 && rows[0].channelId === "ch-t2",
      JSON.stringify(rows.map((r: Row) => r.channelId)),
    );
  }
  {
    // ⚠️ Lỗi thứ tự: lọc status thì index cuối là `status` (cố định) →
    // order("desc") không làm gì. Danh sách phải tự sắp theo createdAt.
    const e = env();
    e.tickets.push(
      ticket("t1", { createdAt: 100, status: "open" }),
      ticket("t2", { createdAt: 300, status: "open" }),
      ticket("t3", { createdAt: 200, status: "closed" }),
    );
    const rows = await listH(e.ctx, { token: "tok", guildId: "g1", status: "open" });
    check(
      "lọc 'open' → vẫn mới nhất trước",
      rows.length === 2 && rows[0].channelId === "ch-t2",
      JSON.stringify(rows.map((r: Row) => r.channelId)),
    );
    const closed = await listH(e.ctx, { token: "tok", guildId: "g1", status: "closed" });
    check("lọc 'closed' → chỉ ticket đã đóng", closed.length === 1 && closed[0].id === "t3");
  }
  {
    // status rác → phải lùi về "tất cả" chứ không trả danh sách rỗng.
    const e = env();
    e.tickets.push(
      ticket("t1", { createdAt: 100 }),
      ticket("t2", { createdAt: 200, status: "closed" }),
    );
    const rows = await listH(e.ctx, { token: "tok", guildId: "g1", status: "banana" });
    check("status lạ → lùi về danh sách tất cả (không trả rỗng)", rows.length === 2);
  }
  {
    // Trường thiếu phải có giá trị mặc định, không để dashboard vỡ `undefined`.
    const e = env();
    e.tickets.push({ _id: "t9", guildId: "g1", status: "open", createdAt: 50, kind: "support" });
    const row = (await listH(e.ctx, { token: "tok", guildId: "g1" }))[0];
    check("number thiếu → 0", row.number === 0);
    check("body thiếu → chuỗi rỗng", row.body === "");
    check("evidence thiếu → chuỗi rỗng", row.evidence === "");
    check("closedByName thiếu → null", row.closedByName === null);
    check("unbanned thiếu → false", row.unbanned === false);
    check("openError thiếu → null", row.openError === null);
  }
  check(
    "không manage guild → từ chối",
    await throws(async () => {
      const e = env({ manageable: false });
      await listH(e.ctx, { token: "tok", guildId: "g1" });
    }),
  );
  check(
    "token sai → từ chối",
    await throws(async () => {
      const e = env();
      await listH(e.ctx, { token: "token-sai", guildId: "g1" });
    }),
  );
  check(
    "server không tồn tại → từ chối",
    await throws(async () => {
      const e = env();
      await listH(e.ctx, { token: "tok", guildId: "khong-co" });
    }),
  );

  // ═══ ticketSummary ═══
  console.log("\n── ticketSummary ──");
  {
    const e = env();
    e.tickets.push(
      ticket("t1", { status: "open" }),
      ticket("t2", { status: "open" }),
      ticket("t3", { status: "closed" }),
    );
    const s = await summaryH(e.ctx, { token: "tok", guildId: "g1" });
    check("đếm đúng số ticket đang mở", s.openCount === 2, JSON.stringify(s));
    check("chưa cấu hình gì → enabled=false", s.enabled === false);
    check("chưa chọn category → missingCategory=true", s.missingCategory === true);
    check("chưa chọn role staff → null", s.staffRoleId === null);
    check("mặc định DM khi ban = bật", s.dmOnBan === true);
    check("mặc định maxOpen=20", s.maxOpen === 20);
    check("mặc định cooldown=24h", s.cooldownHours === 24);
    check("mặc định loại ticket = support", s.defaultKind === "support");
  }
  {
    const e = env();
    e.guilds[0].ticketCategoryId = "cat1";
    e.guilds[0].ticketEnabled = true;
    const s = await summaryH(e.ctx, { token: "tok", guildId: "g1" });
    check(
      "đã cấu hình → missingCategory=false, enabled=true",
      s.missingCategory === false && s.enabled === true,
    );
  }

  // ═══ closeTicket ═══
  console.log("\n── closeTicket ──");
  {
    const e = env();
    e.tickets.push(ticket("t1", { createdAt: 100 }));
    const r = await closeH(e.ctx, {
      token: "tok",
      guildId: "g1",
      ticketId: "t1",
      reason: "đã giải quyết",
    });
    check("đóng được → ok + not alreadyClosed", r.ok === true && r.alreadyClosed === false);
    check(
      "ghi người đóng",
      e.tickets[0].closedById === "owner" && e.tickets[0].closedByName === "Chủ",
    );
    check("ghi thời điểm đóng", typeof e.tickets[0].closedAt === "number");
    check("lưu lý do", e.tickets[0].closeReason === "đã giải quyết");
  }
  {
    // Lý do dài bị cắt — không ghi tràn cột.
    const e = env();
    e.tickets.push(ticket("t1"));
    await closeH(e.ctx, { token: "tok", guildId: "g1", ticketId: "t1", reason: "x".repeat(900) });
    check(
      "lý do dài bị cắt còn 300",
      e.tickets[0].closeReason.length === 300,
      String(e.tickets[0].closeReason.length),
    );
  }
  {
    // ⚠️ Chống đóng NHẦM ticket của server khác: staff A không được đóng ticket
    // của server B chỉ vì biết id.
    const e = env();
    e.tickets.push(ticket("t1", { guildId: "server-khac" }));
    check(
      "ticket thuộc guild khác → từ chối",
      await throws(async () => closeH(e.ctx, { token: "tok", guildId: "g1", ticketId: "t1" })),
    );
  }
  check(
    "ticket không tồn tại → từ chối",
    await throws(async () => closeH(env().ctx, { token: "tok", guildId: "g1", ticketId: "nope" })),
  );
  {
    // Đóng 2 lần: lần hai không ghi đè mốc lần đầu (dashboard hiển thị sai lịch sử).
    const e = env();
    e.tickets.push(ticket("t1", { createdAt: 100 }));
    await closeH(e.ctx, { token: "tok", guildId: "g1", ticketId: "t1" });
    const first = e.tickets[0].closedAt;
    const r = await closeH(e.ctx, { token: "tok", guildId: "g1", ticketId: "t1" });
    check("đóng lại → alreadyClosed=true", r.ok === true && r.alreadyClosed === true);
    check("không ghi đè mốc đóng cũ", e.tickets[0].closedAt === first);
  }
  check(
    "không manage guild → không đóng được",
    await throws(async () => {
      const e = env({ manageable: false });
      e.tickets.push(ticket("t1"));
      await closeH(e.ctx, { token: "tok", guildId: "g1", ticketId: "t1" });
    }),
  );

  // ═══ botTicketState: hàng rào chống spam ═══
  console.log("\n── botTicketState ──");
  {
    const e = env();
    e.tickets.push(ticket("t1", { createdAt: 100 }), ticket("t2", { createdAt: 200 }));
    const s = await stateH(e.ctx, { guildId: "g1", userId: "u1", botKey: BOT_KEY });
    check("đếm số ticket đang mở của server", s.openCount === 2, JSON.stringify(s));
    check(
      "botKey sai → từ chối",
      await throws(async () => stateH(e.ctx, { guildId: "g1", userId: "u1", botKey: "key-sai" })),
    );
    check(
      "thiếu botKey → từ chối",
      await throws(async () => stateH(e.ctx, { guildId: "g1", userId: "u1" })),
    );
    check(
      "chưa cấp phát key → từ chối (không có cửa hậu)",
      await throws(async () => {
        const e2 = env({ seed: null });
        await stateH(e2.ctx, { guildId: "g1", userId: "u1", botKey: BOT_KEY });
      }),
    );
  }
  {
    // ⚠️ Lỗi thứ tự — hàng rào cooldown: `lastOpenedAt` phải là lần mở MỚI NHẤT
    // của chính người đó. Index (guildId, openerId) đã cố định openerId nên
    // `order("desc").take(1)` không bảo đảm điều đó → lấy nhầm ticket cũ thì
    // người dùng bị phạt oan cooldown hoặc né cooldown.
    const e = env();
    e.tickets.push(
      ticket("cu", { createdAt: 100, status: "closed" }),
      ticket("moi", { createdAt: 900, status: "open" }),
    );
    const s = await stateH(e.ctx, { guildId: "g1", userId: "u1", botKey: BOT_KEY });
    check(
      "lastOpenedAt = lần mở MỚI NHẤT (không phải bản ghi cũ)",
      s.lastOpenedAt === 900,
      String(s.lastOpenedAt),
    );
    check(
      "openChannelId = kênh của ticket đang mở",
      s.openChannelId === "ch-moi",
      String(s.openChannelId),
    );
    check("openTicketId = id của ticket đang mở", s.openTicketId === "moi", String(s.openTicketId));
  }
  {
    // Bản ghi MỚI NHẤT đã đóng nhưng còn ticket cũ đang mở → phải trả kênh
    // đang mở, không được trả null (nếu null thì vòng chống mở trùng bị bypass).
    const e = env();
    e.tickets.push(
      ticket("dang-mo", { createdAt: 100, status: "open" }),
      ticket("moi-nhat", { createdAt: 900, status: "closed" }),
    );
    const s = await stateH(e.ctx, { guildId: "g1", userId: "u1", botKey: BOT_KEY });
    check(
      "ticket mới đã đóng → vẫn trả kênh ĐANG MỞ",
      s.openChannelId === "ch-dang-mo",
      String(s.openChannelId),
    );
  }
  {
    const e = env();
    e.tickets.push(ticket("khac", { createdAt: 900, openerId: "nguoi-khac" }));
    const s = await stateH(e.ctx, { guildId: "g1", userId: "u1", botKey: BOT_KEY });
    check("chưa từng mở → lastOpenedAt null", s.lastOpenedAt === null);
    check("chưa từng mở → không có kênh", s.openChannelId === null && s.openTicketId === null);
    check("ticket của người khác không tính vào trạng thái của tôi", s.openCount === 1);
  }

  // ═══ botTicketById: nút trong kênh — nguồn tin quyết định gỡ ban ═══
  console.log("\n── botTicketById ──");
  {
    const e = env();
    e.tickets.push(ticket("t1", { createdAt: 100, openerId: "nguoi-bi-ban" }));
    const t = await byIdH(e.ctx, { guildId: "g1", ticketId: "t1", botKey: BOT_KEY });
    check("đọc đúng người mở ticket", t.openerId === "nguoi-bi-ban", JSON.stringify(t));
    check("trả cả trạng thái + loại", t.status === "open" && t.kind === "support");
    check("KHÔNG trả nội dung khiếu nại (không cần, dễ rò)", t.body === undefined);
    check(
      "botKey sai → từ chối",
      await throws(async () => byIdH(e.ctx, { guildId: "g1", ticketId: "t1", botKey: "sai" })),
    );
    check(
      "id không tồn tại → null",
      (await byIdH(e.ctx, { guildId: "g1", ticketId: "nope", botKey: BOT_KEY })) === null,
    );
  }
  {
    // ⚠️ Bảo mật: nút bị dán lại sang kênh của server khác → không được đọc
    // được ticket (đọc được thì nút "Gỡ ban" sẽ gỡ ban nhầm người).
    const e = env();
    e.tickets.push(ticket("t1", { guildId: "server-khac" }));
    check(
      "ticket thuộc guild khác → null",
      (await byIdH(e.ctx, { guildId: "g1", ticketId: "t1", botKey: BOT_KEY })) === null,
    );
  }

  // ═══ Mutation phía BOT — đường GHI dữ liệu ticket ═══
  // Ba mutation này chưa có test nào. Chúng là nơi dữ liệu dashboard đến từ,
  // nên ghi sai là dashboard hiện sai — và sai ở đây rất khó phát hiện thủ
  // công (vẫn "chạy được", chỉ sai âm thầm).
  console.log("\n── botOpenTicket / botCloseTicket / botSetTicketChannel ──");
  {
    const e = env();
    e.guilds[0].modCaseCounter = 11;
    const r = await openH(e.ctx, {
      guildId: "g1",
      channelId: "pending",
      kind: "appeal",
      openerId: "u1",
      openerName: "Minh",
      body: "khiếu nại",
      source: "dm",
      botKey: BOT_KEY,
    });
    check(
      "trả về id + số thứ tự",
      r.ok === true && !!r.ticketId && r.number === 12,
      JSON.stringify(r),
    );
    check(
      "bản ghi ghi đúng trạng thái mở",
      e.tickets[0].status === "open" && e.tickets[0].kind === "appeal",
    );
    // Số thứ tự dùng CHUNG bộ đếm mod case (một dãy số duy nhất trong kênh log).
    check("số thứ tự nối tiếp bộ đếm mod case", e.guilds[0].modCaseCounter === 12);
    check(
      "botKey sai → từ chối",
      await throws(async () =>
        openH(e.ctx, {
          guildId: "g1",
          channelId: "pending",
          kind: "appeal",
          openerId: "u1",
          openerName: "x",
          source: "dm",
          botKey: "sai",
        }),
      ),
    );
  }
  {
    // Độ dài phải bị kẹp ở tầng mutation: bot có thể lỗi, không được để
    // mutation làm vỡ schema (Convex từ chối field quá dài → ghi hỏng).
    const e = env();
    await openH(e.ctx, {
      guildId: "g1",
      channelId: "pending",
      kind: "support",
      openerId: "u1",
      openerName: "n".repeat(200),
      body: "b".repeat(5000),
      evidence: "c".repeat(2000),
      openError: "d".repeat(900),
      source: "cmd",
      botKey: BOT_KEY,
    });
    const t = e.tickets[0];
    check("tên người mở cắt 80", t.openerName.length === 80, String(t.openerName.length));
    check("nội dung cắt 1000", t.body.length === 1000, String(t.body.length));
    check("bằng chứng cắt 500", t.evidence.length === 500, String(t.evidence.length));
    check(
      "lỗi mở cắt 200 + có mốc thời gian",
      t.openError.length === 200 && typeof t.openErrorAt === "number",
    );
  }
  {
    const e = env();
    e.tickets.push(ticket("t1", { createdAt: 100 }));
    const r = await botCloseH(e.ctx, {
      guildId: "g1",
      ticketId: "t1",
      status: "closed",
      closedById: "M1",
      closedByName: "mod",
      closeReason: "x".repeat(900),
      unbanned: true,
      botKey: BOT_KEY,
    });
    check("đóng được", r.ok === true && r.found === true);
    check(
      "ghi người đóng + trạng thái",
      e.tickets[0].status === "closed" && e.tickets[0].closedById === "M1",
    );
    check(
      "lý do cắt 300",
      e.tickets[0].closeReason.length === 300,
      String(e.tickets[0].closeReason.length),
    );
    check("ghi cờ đã gỡ ban", e.tickets[0].unbanned === true);
    check(
      "ticket không tồn tại → ok (nút cũ không lỗi)",
      (
        await botCloseH(e.ctx, {
          guildId: "g1",
          ticketId: "khong-co",
          status: "closed",
          botKey: BOT_KEY,
        })
      ).found === false,
    );
  }
  {
    // Trạng thái rác không được đi thẳng vào DB — chỉ "closed"/"locked".
    const e = env();
    e.tickets.push(ticket("t1"));
    await botCloseH(e.ctx, { guildId: "g1", ticketId: "t1", status: "banana", botKey: BOT_KEY });
    check(
      "status lạ → đóng (không ghi giá trị rác)",
      e.tickets[0].status === "closed",
      e.tickets[0].status,
    );
  }
  {
    // Nút "Nhận việc" VẪN còn trong panel của kênh `closed-*` (bot đóng bằng
    // cách thu quyền + đổi tên, không xoá panel) → nếu không chặn status,
    // staff nhận việc cho ticket đã xong và dashboard hiện người nhận sai.
    const e = env();
    e.tickets.push(ticket("t1", { status: "closed" }));
    const r = await claimH(e.ctx, {
      guildId: "g1",
      ticketId: "t1",
      staffId: "M1",
      staffName: "mod",
      botKey: BOT_KEY,
    });
    check(
      "nhận việc ticket đã đóng → từ chối",
      r.ok === false && r.reason === "closed",
      JSON.stringify(r),
    );
    check(
      "từ chối thì KHÔNG ghi người nhận",
      e.tickets[0].claimedById === undefined,
      String(e.tickets[0].claimedById),
    );
    const e2 = env();
    e2.tickets.push(ticket("t1", { status: "open" }));
    const okRes = await claimH(e2.ctx, {
      guildId: "g1",
      ticketId: "t1",
      staffId: "M1",
      staffName: "mod",
      botKey: BOT_KEY,
    });
    check(
      "ticket đang mở → nhận được",
      okRes.ok === true && e2.tickets[0].claimedById === "M1",
      JSON.stringify(okRes),
    );
    const e3 = env();
    e3.tickets.push(ticket("t1", { status: "open", claimedById: "M1", claimedByName: "mod" }));
    const again = await claimH(e3.ctx, {
      guildId: "g1",
      ticketId: "t1",
      staffId: "M1",
      staffName: "mod",
      botKey: BOT_KEY,
    });
    check(
      "bấm lại nút của chính mình → idempotent",
      again.ok === true && again.alreadyMine === true,
      JSON.stringify(again),
    );
  }
  {
    const e = env();
    e.tickets.push(ticket("t1", { channelId: "pending" }));
    await setChannelH(e.ctx, { guildId: "g1", ticketId: "t1", channelId: "CH-1", botKey: BOT_KEY });
    check("điền channelId thật", e.tickets[0].channelId === "CH-1");
    await setChannelH(e.ctx, {
      guildId: "g1",
      ticketId: "t1",
      channelId: "pending",
      openError: "MISSING_PERM",
      botKey: BOT_KEY,
    });
    check(
      "ghi lỗi mở kênh",
      e.tickets[0].openError === "MISSING_PERM" && typeof e.tickets[0].openErrorAt === "number",
    );
    const missing = await setChannelH(e.ctx, {
      guildId: "g1",
      ticketId: "khong-co",
      channelId: "CH-x",
      botKey: BOT_KEY,
    });
    check("ticket không tồn tại → ok", missing.found === false);
  }
  {
    // ⚠️ Chống ghi nhầm ticket của server khác (nút có thể bị dán lại kênh khác).
    const e = env();
    e.tickets.push(ticket("t1", { guildId: "server-khac" }));
    const r = await setChannelH(e.ctx, {
      guildId: "g1",
      ticketId: "t1",
      channelId: "CH-x",
      botKey: BOT_KEY,
    });
    check(
      "ticket thuộc guild khác → không ghi",
      r.found === false && e.tickets[0].channelId === "ch-t1",
    );
  }

  // ═══ updateSettings: tự bật cờ dán lại panel khi sửa nội dung panel ═══
  // Lý do có test này: ô nhập đã LƯU nhưng kênh không đổi là kiểu lỗi khiến
  // phần lớn server kết luận "tính năng hỏng". Muốn chặn được thì phải test
  // cả chiều "KHÔNG bật cờ" — dán lên mọi lần lưu là spam, còn không bật
  // lúc sửa nội dung thì tuỳ chỉnh là vô hiệu.
  console.log("\n── updateSettings: tự dán lại panel khi sửa nội dung ──");

  /** Ctx giả cho updateSettings: chỉ cần sessions + users + guilds. */
  function settingsCtx(guild: Row): { ctx: any; guild: Row } {
    const guilds: Row[] = [{ _id: "g1", discordId: "server-1", ...guild }];
    const users: Row[] = [{ _id: "u1", discordId: "owner-1", manageableGuildIds: ["server-1"] }];
    const sessions: Row[] = [
      { _id: "s1", token: "tok", userId: "u1", createdAt: Date.now(), authVersion: 1 },
    ];
    const tables: Record<string, Row[]> = { guilds, users, sessions };
    const all = () => [...guilds, ...users, ...sessions];
    const ctx = {
      now: 1_700_000_000_000,
      db: {
        insert: async () => "x",
        get: async (id: string) => all().find((r) => r._id === id) ?? null,
        patch: async (id: string, patch: Row) => {
          const row = all().find((r) => r._id === id);
          if (row) Object.assign(row, patch);
        },
        query: (table: string) => ({
          withIndex: (_name: string, bound: (q: any) => any) => {
            const capture: Record<string, unknown> = {};
            const q: any = { eq: (f: string, v: unknown) => ((capture[f] = v), q) };
            bound(q);
            const rows = (tables[table] ?? []).filter((r) =>
              Object.entries(capture).every(([f, v]) => r[f] === v),
            );
            return {
              first: async () => rows[0] ?? null,
              collect: async () => [...rows],
              take: async (n: number) => rows.slice(0, n),
              order: () => ({
                take: async (n: number) => rows.slice(0, n),
                collect: async () => [...rows],
              }),
              unique: async () => rows[0] ?? null,
            };
          },
        }),
      },
    };
    return { ctx, guild: guilds[0] };
  }

  /** Chạy updateSettings rồi trả về patch đã ghi (để soi field cờ). */
  async function save(guild: Row, args: Row) {
    const { ctx, guild: row } = settingsCtx(guild);
    let written: Row = {};
    const spy = {
      ...ctx,
      db: {
        ...ctx.db,
        patch: async (id: string, p: Row) => {
          written = p;
          await ctx.db.patch(id, p);
        },
      },
    };
    await updateH(spy, { token: "tok", guildId: "server-1", ...args });
    return written;
  }

  const ON = { ticketEnabled: true, ticketPanelChannelId: "123456789012345678" };
  {
    const p = await save({ ...ON, ticketOpenPanelTitle: "Cũ" }, { ticketOpenPanelTitle: "Mới" });
    check("đổi tiêu đề panel → tự bật cờ dán lại", p.ticketSendPanel === true, JSON.stringify(p));
  }
  {
    const p = await save(
      { ...ON, ticketOpenPanelTitle: "Giữ nguyên" },
      { ticketOpenPanelTitle: "Giữ nguyên" },
    );
    check(
      "lưu lại y hệt (không đổi gì) → KHÔNG dán lại",
      p.ticketSendPanel === undefined,
      JSON.stringify(p),
    );
  }
  {
    const p = await save({ ...ON, ticketOpenPanelTitle: "Xoá đi" }, { ticketOpenPanelTitle: "  " });
    check(
      "xoá trắng tiêu đề (khác giá trị cũ) → dán lại",
      p.ticketSendPanel === true && p.ticketOpenPanelTitle === undefined,
      JSON.stringify(p),
    );
  }
  {
    const p = await save(
      { ...ON, ticketOpenPanelColor: "ff0000" },
      { ticketOpenPanelColor: "00FF00" },
    );
    check(
      "đổi màu → tự bật cờ dán lại",
      p.ticketSendPanel === true && p.ticketOpenPanelColor === "00ff00",
      JSON.stringify(p),
    );
  }
  {
    // CHỐNG HỒI QUY của chính cách so sánh: đổi màu NHƯNG màu không đổi,
    // trong khi tiêu đề đang có sẵn. So sánh kiểu "patch.X !== guild.X" mà
    // không xét "đối số có được truyền không" sẽ thấy undefined != "Tiêu đề"
    // và bật cờ oan → dán panel mới mỗi lần lưu cấu hình.
    const p = await save(
      { ...ON, ticketOpenPanelTitle: "Tiêu đề", ticketOpenPanelColor: "ff0000" },
      { ticketOpenPanelColor: "ff0000" },
    );
    check(
      "lưu màu Y HỆT (tiêu đề đang có sẵn) → KHÔNG dán lại oan",
      p.ticketSendPanel === undefined,
      JSON.stringify(p),
    );
  }
  {
    const p = await save(
      { ...ON, ticketShowAppealButton: true },
      { ticketShowAppealButton: false },
    );
    check("tắt nút Khiếu nại → tự bật cờ dán lại", p.ticketSendPanel === true, JSON.stringify(p));
  }
  {
    const p = await save(
      { ...ON, ticketShowAppealButton: false },
      { ticketShowAppealButton: false },
    );
    check(
      "lưu lại nút Khiếu nại y hệt → KHÔNG dán lại",
      p.ticketSendPanel === undefined,
      JSON.stringify(p),
    );
  }
  {
    // Chưa từng lưu (undefined = mặc định true) → đặt true là KHÔNG đổi.
    const p = await save(ON, { ticketShowAppealButton: true });
    check(
      "nút Khiếu nại chưa từng lưu, đặt true (= mặc định) → KHÔNG dán lại",
      p.ticketSendPanel === undefined,
      JSON.stringify(p),
    );
  }
  {
    // ticketOpenNote / ticketDmOnOpen KHÔNG nằm trong panel.
    const p = await save(ON, { ticketOpenNote: "Lời dặn mới" });
    check(
      "đổi lời dặn đầu kênh → KHÔNG dán lại panel",
      p.ticketSendPanel === undefined,
      JSON.stringify(p),
    );
  }
  {
    const p = await save(ON, { ticketDmOnOpen: false });
    check(
      "tắt DM khi mở → KHÔNG dán lại panel",
      p.ticketSendPanel === undefined,
      JSON.stringify(p),
    );
  }
  {
    // ⚠️ Phải bật ticket + BỎ kênh panel. Lần đầu viết case này quên bật
    // ticket nên nó "xanh" vì lý do SAI (do ticket tắt, không phải do thiếu
    // kênh) — mutation bỏ kiểm tra hasPanelChannel vẫn sống sót.
    const p = await save({ ticketEnabled: true }, { ticketOpenPanelTitle: "Mới" });
    check(
      "chưa chọn kênh panel → KHÔNG bật cờ (không có chỗ dán)",
      p.ticketSendPanel === undefined,
      JSON.stringify(p),
    );
  }
  {
    const p = await save(
      { ticketEnabled: true, ticketPanelChannelId: "" },
      { ticketOpenPanelTitle: "Mới" },
    );
    check(
      "kênh panel bị xoá trắng → KHÔNG bật cờ",
      p.ticketSendPanel === undefined,
      JSON.stringify(p),
    );
  }
  {
    const p = await save(
      { ticketEnabled: false, ticketPanelChannelId: "123456789012345678" },
      { ticketOpenPanelTitle: "Mới" },
    );
    check("ticket đang tắt → KHÔNG bật cờ", p.ticketSendPanel === undefined, JSON.stringify(p));
  }
  {
    const p = await save(
      { ...ON, ticketOpenPanelTitle: "Cũ" },
      {
        ticketOpenPanelTitle: "Mới",
        ticketSendPanel: false,
      },
    );
    check(
      "người dùng tự tắt cờ → không bật lại (ý chí họ được tôn trọng)",
      p.ticketSendPanel === false,
      JSON.stringify(p),
    );
  }
  {
    const p = await save(
      { ...ON, ticketPanelChannelId: "876543210987654321" },
      {
        ticketPanelChannelId: "111111111111111111",
      },
    );
    check(
      "đổi kênh dán panel → vẫn tự dán (hành vi có sẵn, không hồi quy)",
      p.ticketSendPanel === true && p.ticketPanelChannelId === "111111111111111111",
      JSON.stringify(p),
    );
  }

  console.log(`\nKết quả tickets-convex: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
})();
