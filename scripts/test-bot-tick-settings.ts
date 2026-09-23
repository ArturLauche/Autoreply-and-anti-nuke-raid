// TEST bot_tick:getPendingJobs — batch query bot gọi mỗi 180s (1 query thay 3).
// Trọng tâm lượt này: `settingsChanges` — danh sách guild vừa được DASHBOARD sửa
// cấu hình. Đây là kênh duy nhất để thay đổi từ web tới bot trong ~3 phút; thiếu
// nó thì bot giữ cache getConfig 30 phút → bật welcome/goodbye, đổi module antinuke
// xong bot vẫn im lặng (bug thật 23/09/2026).
//
// Chạy: bun scripts/test-bot-tick-settings.ts
import { getPendingJobs } from "../convex/bot_tick";
import { computeBotKey } from "../convex/botAuth";

const BOT_KEY = "key-thô-32-bytes-của-bot";
const handler = (getPendingJobs as any)._handler;

type Row = Record<string, any>;

/**
 * ctx giả tối thiểu: query builder dùng được cả .withIndex().first()/collect(),
 * .collect(), .take(), .order() và .filter() (buildHiddenJobs dùng .filter()).
 */
function makeCtx(tables: Record<string, Row[]>) {
  const db = {
    query: (table: string) => {
      const rows = tables[table] ?? [];
      const builder: any = {
        withIndex: (_name: string, bound: (q: any) => any) => {
          const capture: Record<string, any> = {};
          const q = {
            eq: (f: string, v: any) => {
              capture[f] = v;
              return q;
            },
            field: (f: string) => f,
          };
          bound(q);
          return makeView(
            rows.filter((r) => Object.entries(capture).every(([k, v]) => r[k] === v)),
          );
        },
        ...makeView(rows),
      };
      return builder;
    },
    get: async (id: string) =>
      Object.values(tables)
        .flat()
        .find((r) => r._id === id) ?? null,
  };
  return { db } as any;
}

function makeView(rows: Row[]) {
  const view: any = {
    collect: async () => rows,
    take: async (n: number) => rows.slice(0, n),
    first: async () => rows[0] ?? null,
    order: () => view,
    filter: () => view,
  };
  return view;
}

let pass = 0;
let fail = 0;
const check = (label: string, ok: boolean) => {
  console.log(ok ? `  ✅ ${label}` : `  ❌ ${label}`);
  if (ok) pass++;
  else fail++;
};

const NOW = Date.now();
const status = { _id: "st", kind: "status", botKeySeed: computeBotKey(BOT_KEY), online: true };

(async () => {
  console.log("\n── settingsChanges: guild vừa sửa cấu hình ──");
  {
    const ctx = makeCtx({
      botStatus: [status],
      guilds: [
        {
          _id: "g1",
          discordId: "g-fresh",
          botInGuild: true,
          name: "Mới sửa",
          settingsChangedAt: NOW - 60_000,
        },
        {
          _id: "g2",
          discordId: "g-old",
          botInGuild: true,
          name: "Sửa lâu rồi",
          settingsChangedAt: NOW - 60 * 60_000,
        },
        { _id: "g3", discordId: "g-none", botInGuild: true, name: "Chưa từng sửa" },
        {
          _id: "g4",
          discordId: "g-gone",
          botInGuild: false,
          name: "Bot đã rời",
          settingsChangedAt: NOW,
        },
      ],
    });
    const jobs = await handler(ctx, { botKey: BOT_KEY });
    check(
      "guild vừa sửa cấu hình → có trong settingsChanges kèm mốc `at`",
      jobs.settingsChanges.length === 1 &&
        jobs.settingsChanges[0].guildId === "g-fresh" &&
        typeof jobs.settingsChanges[0].at === "number",
    );
    check(
      "cấu hình sửa quá cũ (1 giờ) → không gửi lại (chống xóa cache lặp / payload phình)",
      !jobs.settingsChanges.some((c: any) => c.guildId === "g-old"),
    );
    check(
      "guild chưa từng sửa + guild bot đã rời → không có trong settingsChanges",
      jobs.settingsChanges.length === 1,
    );
  }

  console.log("\n── Hồi quy: các nhánh cũ của batch vẫn chạy ──");
  {
    const ctx = makeCtx({
      botStatus: [status],
      guilds: [
        {
          _id: "g1",
          discordId: "g-bk",
          botInGuild: true,
          name: "Cần backup",
          backupRequested: true,
          backupPushToGithub: true,
          backupIncludeMessages: true,
        },
        {
          _id: "g2",
          discordId: "g-verify",
          botInGuild: true,
          name: "Cần panel xác minh",
          verifySendPanel: true,
          verifyEnabled: true,
          verifyChannelId: "ch-1",
          unverifiedRoleId: "r1",
          verifiedRoleId: "r2",
          verifyMethod: "button",
        },
      ],
      reactionRolePanels: [],
      giveaways: [],
      guildWebhooks: [],
    });
    const jobs = await handler(ctx, { botKey: BOT_KEY });
    check(
      "yêu cầu backup đang chờ vẫn được trả (kèm cờ pushGitHub/includeMessages)",
      jobs.backups.some(
        (b: any) =>
          b.kind === "backup" &&
          b.guildId === "g-bk" &&
          b.pushToGithub === true &&
          b.includeMessages === true,
      ),
    );
    check(
      "guild cần gửi panel xác minh vẫn được trả",
      jobs.verifyPanels.some((v: any) => v.guildId === "g-verify" && v.verifyChannelId === "ch-1"),
    );
    check(
      "hidden jobs là mảng (buildHiddenJobs chạy được trên ctx giả)",
      Array.isArray(jobs.hidden),
    );
    check("không có guild sửa cấu hình → settingsChanges rỗng", jobs.settingsChanges.length === 0);
  }

  console.log("\n── botKey: batch là function bảo mật cao ──");
  {
    const ctx = makeCtx({ botStatus: [status], guilds: [] });
    let threw = "";
    try {
      await handler(ctx, { botKey: "key-sai" });
    } catch (e: any) {
      threw = String(e?.message ?? e);
    }
    check("botKey sai → bị từ chối", threw.includes("botKey") || threw.includes("Chìa khóa bot"));
  }

  console.log(`\n${pass}/${pass + fail} ✅`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error("CRASH:", e);
  process.exit(1);
});
