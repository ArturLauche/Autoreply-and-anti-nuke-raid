import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getUserByToken } from "./auth";
import { getBotStatus } from "./hidden";
import { requireBotKey } from "./botAuth";

/**
 * Threat Intel — bộ não học hỏi của bot: lưu kết quả nghiên cứu định kỳ từ nguồn
 * mở (Reddit security subs, threat feed JSON công khai — KHÔNG tốn tiền) + từ
 * khóa scam mới khai thác được (bằng AI mỗi tuần 1 lần hoặc từ các vụ raid thật).
 *
 * Phân bổ tài nguyên (rẻ cho học sinh/sinh viên):
 *  - Bot tải nguồn mở mỗi 4 giờ (6 lần/ngày) — 0 token, chỉ network.
 *  - AI tổng hợp CHỈ khi có tin mới + mỗi tuần tối đa 1 lần bắt buộc (~8-15k tokens/tháng).
 *  - Từ khóa scam học được hợp nhất vào wildcard — bot dùng MIỄN PHÍ vĩnh viễn.
 *  - Ambient learning: mọi vụ raid thật AI đã phân loại → từ khóa được khai thác
 *    mà không tốn thêm token nào.
 */

/** Làm sạch text: giới hạn độ dài, bỏ ký tự điều khiển. */
const clean = (s: string | undefined, max = 200) =>
  String(s ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, max);

const cleanArray = (arr: string[] | undefined, max = 40) =>
  (arr ?? [])
    .map((s) => clean(s, 80))
    .filter(Boolean)
    .slice(0, max);

/** Row duy nhất của bảng botStatus (đọc helper từ hidden.ts). */

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const status = await getBotStatus(ctx);
    return {
      researchEnabled: status?.threatResearchEnabled ?? false,
      aiWeeklyEnabled: status?.threatResearchAiWeekly ?? true,
      lastRunAt: status?.threatResearchLastRunAt ?? null,
      lastRunAtMs: status?.threatResearchLastRunAt ?? null,
      keywords: status?.threatKeywords ?? [],
      scamPhrases: status?.threatScamPhrases ?? [],
      lastSources: status?.threatResearchLastSources ?? [],
      totalRuns: status?.threatResearchRuns ?? 0,
      nextRunHintMs: status?.threatResearchNextRunAt ?? null,
    };
  },
});

export const setResearchSettings = mutation({
  args: {
    token: v.string(),
    enabled: v.optional(v.boolean()),
    aiWeeklyEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, { token, enabled, aiWeeklyEnabled }) => {
    const user = await getUserByToken(ctx, token);
    if (!user) throw new Error("Vui lòng đăng nhập");
    const status = await getBotStatus(ctx);
    const ownerId = status?.ownerDiscordId;
    if (
      ownerId &&
      /^\d{15,20}$/.test(ownerId) &&
      (await ctx.db
        .query("users")
        .withIndex("by_discordId", (q) => q.eq("discordId", ownerId))
        .first())
    ) {
      if (ownerId !== user.discordId) {
        throw new Error("Chỉ admin sở hữu bot mới được đổi cài đặt Threat Intel 🔒");
      }
    }
    const patch: Record<string, unknown> = {};
    if (enabled !== undefined) patch.threatResearchEnabled = enabled;
    if (aiWeeklyEnabled !== undefined) patch.threatResearchAiWeekly = aiWeeklyEnabled;
    if (status) {
      await ctx.db.patch(status._id, patch);
    } else {
      const now = Date.now();
      await ctx.db.insert("botStatus", {
        kind: "status",
        online: false,
        guildCount: 0,
        memberCount: 0,
        lastHeartbeat: now,
        startedAt: now,
        version: "",
        ...patch,
      });
    }
    return { ok: true };
  },
});

/** Bot lưu 1 lượt nghiên cứu: nguồn đã tải, từ khóa/phrases mới khai thác được, tóm tắt AI. */
export const botSetResearchRun = mutation({
  args: {
    sources: v.array(v.string()),
    keywords: v.array(v.string()),
    scamPhrases: v.array(v.string()),
    summary: v.optional(v.string()),
    aiUsed: v.boolean(),
    nextRunAt: v.number(),
    /** Từ khóa từ các vụ raid thật (ambient learning) — gộp chung vào keywords. */
    learnedFromIncidents: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const status = await getBotStatus(ctx);
    const now = Date.now();
    // Hợp nhất từ khóa: giữ tối đa 60 keywords + 40 phrases, ưu tiên mới nhất.
    const oldKeywords = status?.threatKeywords ?? [];
    const oldPhrases = status?.threatScamPhrases ?? [];
    const merge = (oldArr: string[], newArr: string[], cap: number) => {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const s of [...newArr, ...oldArr]) {
        const k = s.toLowerCase().trim();
        if (!k || k.length < 3 || seen.has(k)) continue;
        seen.add(k);
        out.push(s.trim());
        if (out.length >= cap) break;
      }
      return out;
    };
    const keywords = merge(oldKeywords, cleanArray(args.keywords, 20), 60);
    const scamPhrases = merge(oldPhrases, cleanArray(args.scamPhrases, 15), 40);
    const patch: Record<string, unknown> = {
      // KHÔNG ép threatResearchEnabled = true ở đây: nếu chủ bot vừa tắt research
      // trên web trong lúc bot đang chạy 1 lượt, cờ bật sẽ bị lật lại nhầm.
      threatResearchLastRunAt: now,
      threatResearchNextRunAt: args.nextRunAt,
      threatResearchRuns: (status?.threatResearchRuns ?? 0) + 1,
      threatResearchLastSources: cleanArray(args.sources, 8),
      threatKeywords: keywords,
      threatScamPhrases: scamPhrases,
    };
    if (args.summary) patch.threatResearchLastSummary = clean(args.summary, 700);
    if (args.aiUsed !== undefined) patch.threatResearchLastAiUsed = args.aiUsed;
    if (status) {
      await ctx.db.patch(status._id, patch);
    } else {
      await ctx.db.insert("botStatus", {
        kind: "status",
        online: false,
        guildCount: 0,
        memberCount: 0,
        lastHeartbeat: now,
        startedAt: now,
        version: "",
        ...patch,
      });
    }
    return { ok: true, keywords, scamPhrases };
  },
});

/** Bot đọc intel hiện có (từ khóa + phrases) — 1 query, rẻ, cache trong tick. */
export const botGetIntel = query({
  args: {
    /** Chìa khóa bot (botAuth) — chỉ bot có OWNER_SEED mới tính được. */
    botKey: v.optional(v.string()),
  },
  handler: async (ctx, { botKey }) => {
    await requireBotKey(ctx, botKey);
    const status = await getBotStatus(ctx);
    const now = Date.now();
    return {
      keywords: status?.threatKeywords ?? [],
      scamPhrases: status?.threatScamPhrases ?? [],
      researchEnabled: status?.threatResearchEnabled ?? false,
      aiWeeklyEnabled: status?.threatResearchAiWeekly ?? true,
      nextRunAt: status?.threatResearchNextRunAt ?? null,
      lastRunAt: status?.threatResearchLastRunAt ?? null,
      lastAiUsed: status?.threatResearchLastAiUsed ?? false,
      summary: status?.threatResearchLastSummary ?? null,
      sources: status?.threatResearchLastSources ?? [],
      runs: status?.threatResearchRuns ?? 0,
      now,
    };
  },
});

/** Bot xóa từ khóa sai/hỏng (nếu AI học nhầm) — gọi từ web Admin. */
export const removeKeyword = mutation({
  args: { token: v.string(), keyword: v.string(), kind: v.union(v.literal("keyword"), v.literal("phrase")) },
  handler: async (ctx, { token, keyword, kind }) => {
    const user = await getUserByToken(ctx, token);
    if (!user) throw new Error("Vui lòng đăng nhập");
    const status = await getBotStatus(ctx);
    const ownerId = status?.ownerDiscordId;
    if (
      ownerId &&
      /^\d{15,20}$/.test(ownerId) &&
      ownerId !== user.discordId &&
      (await ctx.db
        .query("users")
        .withIndex("by_discordId", (q) => q.eq("discordId", ownerId))
        .first())
    ) {
      throw new Error("Chỉ admin sở hữu bot mới được sửa Threat Intel 🔒");
    }
    if (!status) return { ok: false };
    if (kind === "keyword") {
      const keywords = (status.threatKeywords ?? []).filter((k) => k !== keyword);
      await ctx.db.patch(status._id, { threatKeywords: keywords });
    } else {
      const scamPhrases = (status.threatScamPhrases ?? []).filter((k) => k !== keyword);
      await ctx.db.patch(status._id, { threatScamPhrases: scamPhrases });
    }
    return { ok: true };
  },
});

/** Thống kê mẫu raid đã thu thập (hiển thị trong panel Admin). */
export const sampleStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("raidSamples").collect();
    const byModule = new Map<string, number>();
    for (const s of all) byModule.set(s.module, (byModule.get(s.module) ?? 0) + 1);
    const last30 = all.filter((s) => s.createdAt > Date.now() - 30 * 24 * 3600 * 1000);
    return {
      total: all.length,
      last30d: last30.length,
      byModule: [...byModule.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([module, count]) => ({ module, count })),
    };
  },
});
