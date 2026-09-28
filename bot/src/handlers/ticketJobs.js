const { Colors, EmbedBuilder } = require("discord.js");
const tickets = require("./tickets");
const lang = require("./lang");

/**
 * handlers/ticketJobs.js — VIỆC NỀN của ticket: tự đóng + dọn kênh.
 *
 * Vì sao tách khỏi `tickets.js`: file đó xử lý TƯƠNG TÁC (bấm nút, mở modal)
 * nên chạy trong event handler. Job chạy trong vòng tick nền — nếu để chung,
 * một lỗi ở job tự đóng sẽ kéo theo cả xử lý nút.
 *
 * ⚠️ THỨ TỰ BẮT BUỘC khi dọn kênh: LƯU TRANSCRIPT TRƯỚC, xác nhận thành công
 * rồi mới `channel.delete()`. Xoá Discord là không hoàn tác; mất transcript là
 * mất bằng chứng khiếu nại, tệ hơn nhiều so vì giữ kênh lâu hơn vài giờ.
 */

/** Số tin nhắn tối đa lưu vào transcript. */
const TRANSCRIPT_LIMIT = 200;

/**
 * Xử lý 1 job autoClose: đóng kênh vì không ai chat quá lâu.
 * Trả true nếu đóng thành công.
 */
async function runAutoClose(client, store, job, T) {
  const guild = client.guilds.cache.get(job.guildId);
  if (!guild) return false;
  const channel = guild.channels.cache.get(job.channelId);
  if (!channel) {
    // Kênh đã bị xoá tay → dọn bản ghi cho khỏi mở vĩnh viễn.
    try {
      await store.client.mutation("bot_writes:botCloseTicket", {
        guildId: job.guildId,
        ticketId: job.ticketId,
        status: "closed",
        closeReason: T.autoClosedTitle,
      });
    } catch (e) {
      console.error(`[tickets:auto] không dọn được bản ghi ${job.guildId}:`, e.message);
    }
    return true;
  }
  const embed = new EmbedBuilder()
    .setColor(Colors.Grey)
    .setTitle(T.autoClosedTitle)
    .setDescription(
      String(T.autoClosedBody)
        .replace("{h}", String(job.idleHours))
        .replace("{g}", String(job.closeGraceHours)),
    )
    .setTimestamp(Date.now());
  try {
    await channel.send({ embeds: [embed] });
  } catch {
    // Kênh không gửi được — vẫn đóng tiếp.
  }
  await tickets.closeTicketChannel({ guild, channel, openerId: job.openerId });
  try {
    await store.client.mutation("bot_writes:botCloseTicket", {
      guildId: job.guildId,
      ticketId: job.ticketId,
      status: "closed",
      closeReason: String(T.autoClosedTitle),
    });
  } catch (e) {
    console.error(`[tickets:auto] ghi trạng thái thất bại ${job.guildId}:`, e.message);
    return false;
  }
  console.log(
    `[tickets:auto] ${job.guildId}: đóng ticket #${job.number} sau ${job.idleHours}h im lặng`,
  );
  return true;
}

/**
 * Xử lý 1 job purge: đã đóng đủ hạn → lưu transcript rồi xoá kênh.
 * KHÔNG xoá khi lưu transcript thất bại.
 */
async function runPurge(client, store, job) {
  const guild = client.guilds.cache.get(job.guildId);
  if (!guild) return false;
  const channel = guild.channels.cache.get(job.channelId);
  if (!channel) {
    try {
      await store.client.mutation("bot_writes:botCloseTicket", {
        guildId: job.guildId,
        ticketId: job.ticketId,
        status: "locked",
      });
    } catch {
      // im lặng — kênh đã mất, bản ghi cũng không còn dùng
    }
    return true;
  }
  const saved = await tickets.saveTranscript({
    store,
    guild,
    channel,
    ticketId: job.ticketId,
    maxMessages: TRANSCRIPT_LIMIT,
  });
  if (!saved) {
    console.warn(
      `[tickets:purge] ${job.guildId}: lưu transcript thất bại → GIỮ kênh #${job.number} (không xoá mất bằng chứng)`,
    );
    return false;
  }
  try {
    await channel.delete("Ticket đã lưu transcript và hết hạn");
  } catch (e) {
    console.error(`[tickets:purge] xoá kênh thất bại ${job.guildId}:`, e.message);
    return false;
  }
  try {
    await store.client.mutation("bot_writes:botCloseTicket", {
      guildId: job.guildId,
      ticketId: job.ticketId,
      status: "locked",
    });
  } catch (e) {
    console.error(`[tickets:purge] ghi trạng thái thất bại ${job.guildId}:`, e.message);
  }
  console.log(`[tickets:purge] ${job.guildId}: đã lưu transcript + xoá kênh #${job.number}`);
  return true;
}

/**
 * Xử lý toàn bộ job ticket từ batch `getPendingJobs`.
 *
 * Lỗi 1 job KHÔNG được làm hỏng các job còn lại — mỗi việc bọc try riêng.
 */
async function processTicketJobs(client, store, jobs) {
  const list = Array.isArray(jobs) ? jobs : [];
  let closed = 0;
  let purged = 0;
  for (const job of list) {
    // Job rác (null / thiếu field) không được làm hỏng cả lượt — nếu
    // không sẽ phải sửa phải cốc để bắt, vòng catch là nơi phải ghi log.
    if (!job || typeof job !== "object") continue;
    try {
      const guild = client.guilds.cache.get(job.guildId);
      // Ngôn ngữ cho thông báo tự đóng: theo server (ticket do người khác mở,
      // không có interaction để đọc locale của người mở).
      const T = lang.ticketText(guild ? lang.langForGuild(guild) : "en");
      if (job.status === "autoClose") {
        if (await runAutoClose(client, store, job, T)) closed++;
      } else if (job.status === "purge") {
        if (await runPurge(client, store, job)) purged++;
      }
    } catch (e) {
      console.error(`[tickets:job] ${job.guildId}/${job.ticketId}:`, e?.message || e);
    }
  }
  if (closed || purged) {
    console.log(`[tickets:job] tự đóng ${closed}, dọn kênh ${purged}`);
  }
  return { closed, purged };
}

module.exports = { processTicketJobs, runAutoClose, runPurge, TRANSCRIPT_LIMIT };
