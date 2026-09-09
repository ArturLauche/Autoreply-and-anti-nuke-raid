const { WebhookClient, EmbedBuilder } = require("discord.js");

/**
 * Webhook Hub — bot tạo / đồng bộ / xóa webhook tùy chỉnh theo yêu cầu từ web,
 * và gửi log qua webhook (tên, avatar, màu, nội dung kèm do người dùng đặt).
 *
 * Luồng:
 *   - Web tạo/sửa/xóa → Convex (status pending_*) → pollWebhookJobs (60s) thực
 *     hiện trên Discord → botWebhookReady / botWebhookDeleted / botWebhookFailed.
 *   - Log (case mod, anti nuke…) → util.js gọi matchFor() + send() → gửi qua
 *     webhook; không có webhook khớp thì fallback kênh thường như cũ.
 */

const WEBHOOK_CACHE_TTL_MS = 5 * 60_000; // cache webhooks của 1 guild 5 phút
const webhookCache = new Map(); // guildId -> { webhooks, fetchedAt }
const inflight = new Map(); // guildId -> Promise (chống query chồng lấp)

let client = null;
let store = null;

function init(c, s) {
  client = c;
  store = s;
}

/** Xử lý 1 việc webhook (test/delete/update/create) — dùng chung cho cả batch hidden. */
async function processJob(job) {
  try {
    if (job.testRequested) {
      await sendTest(job);
    } else if (job.status === "pending_delete") {
      await deleteOne(job);
    } else if (job.status === "pending_update") {
      await updateOne(job);
    } else if (job.status === "pending_create") {
      await createOne(job);
    }
  } catch (e) {
    console.error(`[webhook:${job.status}] ${job.guildId}:`, e.message);
  }
}

/**
 * Bot xử lý tất cả việc cần làm (create/update/delete/test) — vòng quét cũ,
 * giữ lại cho bot zip cũ vẫn còn gọi; bot mới dùng batch hidden (pollHidden).
 */
async function pollWebhookJobs() {
  if (!client || !store) return;
  let jobs;
  try {
    jobs = await store.client.query("webhooks:botGetWebhookJobs", {});
  } catch (e) {
    console.error("[webhook:poll]", e.message);
    return;
  }
  if (!jobs || jobs.length === 0) return;
  for (const job of jobs) {
    await processJob(job);
  }
}

function fail(job, message) {
  return store.client
    .mutation("webhooks:botWebhookFailed", {
      webhookId: job._id,
      error: String(message || "Lỗi không xác định").slice(0, 300),
    })
    .catch(() => {});
}

function invalidateCache(guildId) {
  webhookCache.delete(guildId);
  inflight.delete(guildId);
}

/** Tạo webhook mới trên Discord (kèm avatar nếu có; thử lại không avatar nếu ảnh hỏng). */
async function createOne(job) {
  const channel = await client.channels.fetch(job.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    await fail(job, "Không tìm thấy kênh hoặc bot thiếu quyền xem kênh");
    return;
  }
  let created = null;
  try {
    created = await channel.createWebhook({ name: job.name, avatar: job.avatarUrl || undefined });
  } catch (e) {
    if (job.avatarUrl && e) {
      // Ảnh đại diện lỗi (URL hỏng/quá chậm) — thử lại không avatar để webhook vẫn tạo được.
      try {
        created = await channel.createWebhook({ name: job.name });
      } catch (e2) {
        await fail(job, e2.message || "Không tạo được webhook");
        return;
      }
    } else {
      await fail(job, e.message || "Không tạo được webhook");
      return;
    }
  }
  if (!created) {
    await fail(job, "Không tạo được webhook");
    return;
  }
  try {
    await store.client.mutation("webhooks:botWebhookReady", {
      webhookId: job._id,
      discordWebhookId: created.id,
      token: created.token,
    });
    invalidateCache(job.guildId);
    if (store) store.invalidate(job.guildId);
    console.log(`[webhook] ${job.guildId}: đã tạo "${created.name}" (#${channel.name})`);
  } catch (e) {
    console.error("[webhook:ready]", e.message);
  }
}

/** Đồng bộ tên/avatar webhook đã có trên Discord. */
async function updateOne(job) {
  if (!job.webhookId || !job.token) {
    await fail(job, "Thiếu ID/token webhook để đồng bộ");
    return;
  }
  const wh = new WebhookClient({ id: job.webhookId, token: job.token });
  try {
    const updated = await wh.edit({ name: job.name, avatar: job.avatarUrl || undefined });
    await store.client.mutation("webhooks:botWebhookReady", {
      webhookId: job._id,
      discordWebhookId: updated.id,
      token: updated.token,
    });
    invalidateCache(job.guildId);
    console.log(`[webhook] ${job.guildId}: đã đồng bộ "${updated.name}"`);
  } catch (e) {
    await fail(job, e.message || "Không đồng bộ được webhook");
  }
}

/** Xóa webhook trên Discord rồi xóa bản ghi. */
async function deleteOne(job) {
  if (job.webhookId && job.token) {
    try {
      const wh = new WebhookClient({ id: job.webhookId, token: job.token });
      await wh.delete();
    } catch (e) {
      // Webhook đã bị xóa từ trước (lỗi 10015 Unknown Webhook) cũng coi là xong.
      console.warn(`[webhook:delete] ${job.guildId}:`, e.message);
    }
  }
  try {
    await store.client.mutation("webhooks:botWebhookDeleted", { webhookId: job._id });
    invalidateCache(job.guildId);
  } catch (e) {
    console.error("[webhook:deleted]", e.message);
  }
}

/** Gửi embed test qua webhook rồi xóa cờ. */
async function sendTest(job) {
  const wh = new WebhookClient({ id: job.webhookId, token: job.token });
  const embed = new EmbedBuilder()
    .setColor(job.color ?? 0xf48fb1)
    .setTitle("🧪 Kiểm tra webhook")
    .setDescription("Webhook hoạt động tốt — log của Protogon sẽ gửi qua đây.")
    .addFields(
      { name: "Loại log", value: job.eventTypes.map((t) => `\`${t}\``).join(", ") || "—", inline: true },
      { name: "Tên webhook", value: job.name.slice(0, 100), inline: true },
    )
    .setTimestamp();
  const payload = buildPayload(job, embed, { action: "kiểm tra" });
  try {
    await wh.send(payload);
    await store.client.mutation("webhooks:botWebhookTestDone", { webhookId: job._id });
    console.log(`[webhook:test] ${job.guildId}: đã gửi embed test`);
  } catch (e) {
    await fail(job, e.message || "Không gửi được embed test");
  }
}

/** Thay placeholder trong nội dung kèm: {server} {time} {action}. */
function fillTemplate(tpl, { guildName, action }) {
  if (!tpl) return "";
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return tpl
    .replaceAll("{server}", guildName ?? "server")
    .replaceAll("{time}", time)
    .replaceAll("{action}", action ?? "log");
}

/** Tạo payload gửi qua webhook: nội dung kèm + embed (màu ghi đè nếu có). */
function buildPayload(whInfo, embed, { guildName, action }) {
  const payload = { embeds: [embed] };
  const content = fillTemplate(whInfo.contentTemplate, { guildName, action });
  if (content) payload.content = content.slice(0, 1900);
  if (whInfo.color !== null && whInfo.color !== undefined) {
    // Clone embed với màu ghi đè của webhook (không sửa embed gốc của caller).
    payload.embeds = [new EmbedBuilder(embed.data).setColor(whInfo.color)];
  }
  return payload;
}

/**
 * Lấy danh sách webhook sẵn sàng của guild (cache 5 phút, 1 query/guild/lần).
 * Trả về [] nếu guild không có webhook hoặc bot chưa từng fetch.
 */
async function getForGuild(guildId) {
  const hit = webhookCache.get(guildId);
  if (hit && Date.now() - hit.fetchedAt < WEBHOOK_CACHE_TTL_MS) return hit.webhooks;
  if (inflight.has(guildId)) return inflight.get(guildId);
  const p = (async () => {
    try {
      const webhooks = await store.client.query("webhooks:botGetWebhooks", { guildId });
      webhookCache.set(guildId, { webhooks, fetchedAt: Date.now() });
      return webhooks;
    } catch (e) {
      console.error(`[webhook:list] ${guildId}:`, e.message);
      const old = webhookCache.get(guildId);
      return old ? old.webhooks : [];
    } finally {
      inflight.delete(guildId);
    }
  })();
  inflight.set(guildId, p);
  return p;
}

/** Webhooks khớp loại sự kiện (mod/general) — dùng trong sendLog/sendModLog. */
async function matchFor(guildId, eventType) {
  if (!store) return [];
  const webhooks = await getForGuild(guildId);
  return webhooks.filter((w) => w.eventTypes.includes(eventType));
}

/** Gửi embed qua 1 webhook. Trả về true nếu Discord nhận. */
async function send(whInfo, embed, { guildName, action } = {}) {
  const wh = new WebhookClient({ id: whInfo.webhookId, token: whInfo.token });
  const payload = buildPayload(whInfo, embed, { guildName, action });
  await wh.send(payload);
  return true;
}

module.exports = { init, pollWebhookJobs, processJob, matchFor, send, getForGuild, invalidateCache };