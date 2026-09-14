import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  CloudUpload,
  DatabaseBackup,
  ExternalLink,
  FileUp,
  FolderTree,
  Github,
  Loader2,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Smile,
  Sticker,
  Users,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import type { GuildData, BackupInfo } from "../../lib/types";
import { MIN_IMPORT_BOT_VERSION } from "../../lib/constants";
import { getSessionToken } from "../../lib/discord";

const TOKEN = () => getSessionToken();

/** "v47" → 47; "1.0.0"/khác → 0 (coi là bản cũ). */
function parseBotVersion(v: string | null): number {
  if (!v) return 0;
  const m = String(v).match(/^v?(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}

export default function BackupPanel({ data }: { data: GuildData }) {
  const [pushGithub, setPushGithub] = useState(true);
  const [includeMessages, setIncludeMessages] = useState(true);
  const [busy, setBusy] = useState<"backup" | string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [refreshAt, setRefreshAt] = useState(0);
  const [autoOn, setAutoOn] = useState((data.guild.backupAutoDays ?? 0) > 0);
  const [autoDays, setAutoDays] = useState(
    Math.max(2, Math.min(30, data.guild.backupAutoDays ?? 7)),
  );
  const [autoBusy, setAutoBusy] = useState(false);
  /** Tùy chỉnh khôi phục: bật/tắt tạo lại role, emoji/sticker, kênh, tin nhắn khi restore (cả 2 nguồn). */
  const [restoreRoles, setRestoreRoles] = useState(data.guild.restoreRolesEnabled ?? true);
  const [restoreEmojis, setRestoreEmojis] = useState(data.guild.restoreEmojisEnabled ?? true);
  const [restoreChannels, setRestoreChannels] = useState(data.guild.restoreChannelsEnabled ?? true);
  const [restoreMessages, setRestoreMessages] = useState(data.guild.restoreMessagesEnabled ?? true);
  const [restoreOptBusy, setRestoreOptBusy] = useState(false);
  /** Theo dõi trạng thái xử lý file import: null = không chờ, active = đang chờ bot. */
  const [importWatch, setImportWatch] = useState<null | { startedAt: number }>(null);
  const requestBackup = useMutation(api.backup.requestBackup);
  const requestRestore = useMutation(api.backup.requestRestore);
  const generateUploadUrl = useMutation(api.backup.generateImportUploadUrl);
  const requestImportRestore = useMutation(api.backup.requestImportRestore);
  const setAutoBackup = useMutation(api.backup.setAutoBackup);
  const setRestoreOptions = useMutation(api.backup.setRestoreOptions);
  // Luôn theo dõi trạng thái import (reactive): hiện lỗi lần trước + chẩn đoán bot online/bản cũ.
  const importStatus = useQuery(api.backup.importStatus, {
    token: TOKEN(),
    guildId: data.guild.discordId,
  }) as
    | {
        requested: boolean;
        fileName: string | null;
        error: string | null;
        errorAt: number | null;
        restoreRequested: boolean;
        restoreError: string | null;
        restoreErrorAt: number | null;
        restoreFinishedAt: number | null;
        botOnline: boolean;
        botVersion: string | null;
        botGuildCount: number;
        lastHeartbeat: number | null;
      }
    | null
    | undefined;
  // Theo dõi yêu cầu khôi phục (nút "Khôi phục vào server này") — bot xử lý xong
  // hoặc lỗi sẽ hiển thị ngay thay vì người dùng chờ không biết kết quả.
  const [restoreWatch, setRestoreWatch] = useState<null | { startedAt: number }>(null);

  const refresh = () => setRefreshAt((n) => n + 1);

  // Bot báo lỗi xử lý file import → hiện ngay lý do; xử lý xong → báo kết quả.
  useEffect(() => {
    if (!importWatch || importStatus === undefined || importStatus === null) return;
    if (importStatus.error) {
      toast.error(`Khôi phục từ file thất bại: ${importStatus.error}`, {
        description: "Hãy kiểm tra lại file backup hoặc tải lại file khác.",
      });
      setImportWatch(null);
    } else if (!importStatus.requested) {
      // Bot bản mới (v47+) xác nhận kết quả chính xác; bản cũ xóa cờ im lặng → chỉ nhắc kiểm tra.
      const fresh = parseBotVersion(importStatus.botVersion) >= MIN_IMPORT_BOT_VERSION;
      if (fresh) {
        toast.success("Bot đã khôi phục xong backup từ file", {
          description: "Role, kênh, tin nhắn + media và emoji/sticker đã được tạo lại trên server.",
        });
      } else {
        toast.info("Yêu cầu đã được xử lý xong", {
          description: `Bot đang chạy bản cũ (${importStatus.botVersion || "không rõ"}) nên không xác nhận được kết quả — hãy kiểm tra server trực tiếp và cập nhật bot lên bản mới nhất (v${MIN_IMPORT_BOT_VERSION}+) để nhận báo cáo chính xác.`,
        });
      }
      setImportWatch(null);
      window.setTimeout(refresh, 2500);
    }
  }, [importWatch, importStatus]);

  // Chờ quá 3 phút mà bot chưa xử lý → nhắc kiểm tra bot (không treo vô thời hạn).
  useEffect(() => {
    if (!importWatch) return;
    const timer = window.setTimeout(() => {
      if (Date.now() - importWatch.startedAt > 180_000) {
        const hint =
          importStatus?.botOnline === false
            ? "Bot đang OFFLINE (không nhận được heartbeat) — hãy khởi động bot trên host rồi tải lại file."
            : importStatus?.botOnline === true
              ? "Bot online nhưng chưa xử lý — có thể bot đang chạy bản cũ, hãy cập nhật bot lên bản mới nhất rồi thử lại."
              : "Không xác định được trạng thái bot — hãy kiểm tra bot có online không (tab Giám sát bot).";
        toast.warning("Bot vẫn chưa xử lý file backup", { description: hint });
        setImportWatch(null);
      }
    }, 180_000);
    return () => window.clearTimeout(timer);
  }, [importWatch, importStatus]);

  // Bot báo lỗi khôi phục / xử lý xong cờ restore → hiện ngay kết quả.
  // Quá 3 phút chưa xong → cảnh báo chẩn đoán (bot offline / bản cũ) thay vì treo.
  useEffect(() => {
    if (!restoreWatch || importStatus === undefined || importStatus === null) return;
    if (importStatus.restoreError) {
      toast.error(`Khôi phục thất bại: ${importStatus.restoreError}`, {
        description:
          "Bot đã dừng giữa chừng. Kiểm tra bot còn trong server + đủ quyền Administrator rồi thử khôi phục lại.",
        duration: 12000,
      });
      setRestoreWatch(null);
      refresh();
    } else if (!importStatus.restoreRequested) {
      const fresh = parseBotVersion(importStatus.botVersion) >= MIN_IMPORT_BOT_VERSION;
      if (fresh) {
        toast.success("Bot đã khôi phục xong", {
          description: "Role, kênh, tin nhắn và emoji/sticker đã được tạo lại theo backup. Kiểm tra embed xác nhận trong kênh log.",
        });
      } else {
        toast.info("Yêu cầu khôi phục đã được xử lý", {
          description: `Bot đang chạy bản cũ (${importStatus.botVersion || "không rõ"}) — hãy kiểm tra server trực tiếp và cập nhật bot lên bản mới nhất (v${MIN_IMPORT_BOT_VERSION}+).`,
        });
      }
      setRestoreWatch(null);
      window.setTimeout(refresh, 2500);
    }
  }, [restoreWatch, importStatus]);

  // Restore chờ quá 3 phút → cảnh báo thay vì treo vô thời hạn.
  useEffect(() => {
    if (!restoreWatch) return;
    const timer = window.setTimeout(() => {
      if (Date.now() - restoreWatch.startedAt > 180_000) {
        const hint =
          importStatus?.botOnline === false
            ? "Bot đang OFFLINE — khởi động bot trên host rồi bấm Khôi phục lại."
            : "Bot online nhưng chưa xử lý xong — server lớn kèm tin nhắn có thể mất vài phút; nếu quá lâu hãy cập nhật bot lên bản mới nhất.";
        toast.warning("Bot vẫn chưa xử lý xong khôi phục", { description: hint, duration: 10000 });
      }
    }, 180_000);
    return () => window.clearTimeout(timer);
  }, [restoreWatch, importStatus]);

  async function createBackup() {
    // Bot OFFLINE → yêu cầu sẽ không bao giờ được xử lý (bot quét mỗi ~20-60s);
    // cảnh báo NGAY thay vì để người dùng chờ vô ích và tưởng "backup hỏng".
    if (importStatus && importStatus.botOnline === false) {
      toast.error("Bot đang OFFLINE — không thể backup lúc này", {
        description:
          "Bot không gửi heartbeat (offline > 3 phút). Hãy khởi động bot trên host (pm2 start protogon-bot / bật lại service) rồi bấm Backup ngay sau khi bot online.",
        duration: 8000,
      });
      return;
    }
    setBusy("backup");
    try {
      await requestBackup({
        token: TOKEN(),
        guildId: data.guild.discordId,
        pushToGithub: pushGithub,
        includeMessages,
      });
      toast.success("Đã yêu cầu tạo backup — bot thực hiện trong ~20 giây", {
        description: pushGithub
          ? includeMessages
            ? "Backup (kèm tin nhắn) sẽ được lưu trên Convex và đẩy lên GitHub (token của chủ bot — dùng chung mọi server)."
            : "Backup sẽ được lưu trên Convex và đẩy lên GitHub (token của chủ bot — dùng chung mọi server)."
          : includeMessages
            ? "Backup (kèm tin nhắn) sẽ được lưu trên Convex."
            : "Backup sẽ được lưu trên Convex.",
      });
      // Tự động tải lại danh sách sau khi bot kịp xử lý.
      window.setTimeout(refresh, 25000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Thất bại");
    } finally {
      setBusy(null);
    }
  }

  async function saveAuto() {
    setAutoBusy(true);
    try {
      await setAutoBackup({
        token: TOKEN(),
        guildId: data.guild.discordId,
        days: autoOn ? autoDays : 0,
      });
      toast.success(
        autoOn
          ? `Đã bật tự động backup mỗi ${autoDays} ngày`
          : "Đã tắt tự động backup",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Thất bại");
    } finally {
      setAutoBusy(false);
    }
  }

  async function saveRestoreOptions() {
    setRestoreOptBusy(true);
    try {
      await setRestoreOptions({
        token: TOKEN(),
        guildId: data.guild.discordId,
        restoreRoles,
        restoreChannels,
        restoreMessages,
        restoreEmojis,
      });
      const parts = [
        restoreRoles ? "role" : null,
        restoreEmojis ? "emoji/sticker" : null,
        restoreChannels ? "kênh" : null,
        restoreMessages ? "tin nhắn" : null,
      ].filter(Boolean);
      const skipped = [
        !restoreRoles ? "role" : null,
        !restoreEmojis ? "emoji/sticker" : null,
        !restoreChannels ? "kênh" : null,
        !restoreMessages ? "tin nhắn" : null,
      ].filter(Boolean);
      toast.success("Đã lưu tùy chỉnh khôi phục", {
        description: `Phần khôi phục: ${parts.join(", ")} ${skipped.length ? `· BỎ QUA: ${skipped.join(", ")}` : "(tất cả)"}.`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Thất bại");
    } finally {
      setRestoreOptBusy(false);
    }
  }

  async function importFile(file: File) {
    if (!file) return;
    if (file.size > 8_000_000) {
      toast.error("File quá lớn (tối đa 8 MB) — hãy nén backup hoặc bỏ bớt media nặng rồi thử lại");
      return;
    }
    setImportBusy(true);
    try {
      // 1) Xin URL upload → 2) POST file thẳng lên Convex file storage (chấp nhận
      // file lớn hơn giới hạn document) → 3) chỉ lưu mã file + đặt yêu cầu khôi phục.
      const postUrl = await generateUploadUrl({
        token: TOKEN(),
        guildId: data.guild.discordId,
      });
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error("Không tải file lên được — thử lại");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      if (!storageId) throw new Error("Không nhận được mã file — thử lại");
      await requestImportRestore({
        token: TOKEN(),
        guildId: data.guild.discordId,
        fileName: file.name,
        storageId,
      });
      toast.success(`Đã tải "${file.name}" lên — bot đang xử lý`, {
        description: `Bot nhận diện định dạng (JSON thường / base64 / có lớp bọc), tạo lại kênh đúng thứ tự${restoreRoles ? ", role" : ""}${restoreEmojis ? " + emoji/sticker" : ""} theo tùy chỉnh khôi phục, phục hồi tin nhắn và đăng lại media (ảnh/video…). Lỗi (nếu có) sẽ hiện ngay khi bot báo lại.`,
      });
      if (fileRef.current) fileRef.current.value = "";
      setImportFileName("");
      // Bắt đầu theo dõi: bot quét mỗi ~20s, server lớn có thể mất 1-2 phút.
      setImportWatch({ startedAt: Date.now() });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tải file thất bại");
    } finally {
      setImportBusy(false);
    }
  }

  async function restore(backup: BackupInfo) {
    // Bot OFFLINE → yêu cầu khôi phục sẽ nằm chờ vô hạn — chặn sớm với lý do rõ ràng.
    if (importStatus && importStatus.botOnline === false) {
      toast.error("Bot đang OFFLINE — không thể khôi phục lúc này", {
        description:
          "Bot không gửi heartbeat. Hãy khởi động bot trên host rồi thử khôi phục lại sau khi bot online.",
        duration: 8000,
      });
      return;
    }
    const skipNote = [
      !restoreRoles ? "role (đã tắt trong Tùy chỉnh khôi phục)" : null,
      !restoreEmojis ? "emoji/sticker (đã tắt trong Tùy chỉnh khôi phục)" : null,
    ].filter(Boolean);
    if (!window.confirm(`Khôi phục backup của "${backup.guildName}" vào server hiện tại?\n\nBot sẽ tạo lại kênh theo backup, sắp xếp lại đúng thứ tự, phục hồi tin nhắn kèm media (ảnh/video…)${
      restoreRoles ? ", role (tên, màu, quyền)" : ""
    }${restoreEmojis ? " cùng emoji/sticker nếu backup có" : ""}.${skipNote.length ? `\n\n⚠️ BỎ QUA: ${skipNote.join(", ")}.` : ""}\nCác role/kênh đang có của server này được giữ nguyên.`)) {
      return;
    }
    setBusy(backup._id);
    try {
      await requestRestore({
        token: TOKEN(),
        guildId: data.guild.discordId,
        backupId: backup._id,
      });
      setRestoreWatch({ startedAt: Date.now() });
      toast.success("Đã yêu cầu khôi phục — bot thực hiện trong ~1 phút", {
        description: "Role, quyền role và kênh sẽ được tạo lại theo backup. Kết quả sẽ hiện ở đây.",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Thất bại");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <DatabaseBackup className="h-5 w-5 text-primary" /> Backup server
        </h2>
        <p className="text-sm text-muted-foreground">
          Chụp cấu trúc server (role, quyền role, kênh + quyền kênh) lên{" "}
          <b className="text-foreground">đám mây GitHub</b>. Khi server bị nuke/raid phá sập hoàn
          toàn, mời bot vào          <b className="text-foreground">server phụ</b> rồi khôi phục lại từ
          backup.
        </p>

        {/* Trạng thái khôi phục: lỗi lần trước / đang chạy — người dùng bấm
            "Khôi phục vào server này" xong PHẢI thấy kết quả, không chờ mù mờ. */}
        {importStatus && importStatus.restoreError && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Lần khôi phục trước <b>thất bại</b>: {importStatus.restoreError} — khắc phục (bot còn
              trong server, đủ quyền Administrator) rồi bấm Khôi phục lại.
            </span>
          </p>
        )}
        {importStatus && importStatus.restoreRequested && (
          <p className="mt-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            <span>
              Đang khôi phục vào server này… server lớn kèm tin nhắn có thể mất vài phút. Kết quả sẽ
              hiện ở đây và trong kênh log.
            </span>
          </p>
        )}
      </div>

      {/* Tạo backup */}
      <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-transparent to-transparent">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-[1fr_auto]">
          <div className="grid gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <CloudUpload className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display font-semibold">Tạo backup cho “{data.guild.name}”</p>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Bot chụp toàn bộ <b className="text-foreground">role</b> (tên, màu, hoist,
                  mentionable, quyền), <b className="text-foreground">kênh</b> (danh mục, văn bản,
                  thoại…) kèm quyền truy cập từng kênh, cùng <b className="text-foreground">emoji +
                  sticker</b> và cấu hình cơ bản (prefix, từ ngữ xấu, role mod/admin, kênh log).
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/70 px-3 py-2.5">
                <span className="flex items-center gap-2 text-sm">
                  <Github className="h-4 w-4" />
                  Đồng thời đẩy lên GitHub (Gist riêng tư)
                </span>
                <Switch checked={pushGithub} onCheckedChange={setPushGithub} />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/70 px-3 py-2.5">
                <span className="flex items-center gap-2 text-sm">
                  <MessageSquare className="h-4 w-4" />
                  Kèm tin nhắn + media (tối đa 50 tin/kênh)
                </span>
                <Switch checked={includeMessages} onCheckedChange={setIncludeMessages} />
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Backup luôn được lưu trong Convex; đẩy lên GitHub giúp bạn còn giữ được dữ liệu ngay
              cả khi Convex bị xóa. Mọi server đều dùng chung <code className="font-mono">GITHUB_TOKEN</code>{" "}
              của <b className="text-foreground">chủ sở hữu bot</b> (đã đặt trong Keys) — owner các server
              khác <b className="text-foreground">không cần tự dán token</b> của họ. Nếu token chưa được
              cấu hình, phần GitHub bị bỏ qua và bot chỉ lưu trong Convex.
            </p>
          </div>
          <div className="flex items-end">
            <Button size="lg" onClick={createBackup} disabled={busy !== null}>
              {busy === "backup" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang yêu cầu…
                </>
              ) : (
                <>
                  <CloudUpload className="h-4 w-4" /> Backup ngay
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Khôi phục từ file backup của bot nuke (.msc / .json) */}
      <Card className="border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent">
        <CardContent className="grid gap-4 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
              <FileUp className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display font-semibold">
                Khôi phục từ file backup của bot nuke (.msc / .json)
              </p>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Nếu server bị một con <b className="text-foreground">bot nuke</b> phá sập mà bạn giữ được file backup của
                nó (định dạng <code className="font-mono">.msc</code> hoặc <code className="font-mono">.json</code>), tải
                file lên đây — bot sẽ <b className="text-foreground">nhận diện định dạng</b> (JSON thường / base64 / có lớp
                bọc), tạo lại <b className="text-foreground">role + kênh đúng thứ tự</b> như trong file, phục hồi{" "}
                <b className="text-foreground">tin nhắn</b>, <b className="text-foreground">đăng lại media</b>{" "}
                (ảnh/video…) và <b className="text-foreground">tạo lại emoji/sticker</b> nếu file có lưu.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".msc,.json,application/json"
              onChange={(e) => setImportFileName(e.target.files?.[0]?.name ?? "")}
              className="max-w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground file:transition-colors hover:file:bg-secondary/80"
            />
            <Button
              onClick={() => {
                const f = fileRef.current?.files?.[0];
                if (f) void importFile(f);
              }}
              disabled={importBusy || !importFileName}
            >
              {importBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang tải lên…
                </>
              ) : (
                <>
                  <FileUp className="h-4 w-4" /> Tải lên & khôi phục
                </>
              )}
            </Button>
          </div>
          {importWatch && (
            <div className="space-y-1.5 text-xs">
              <p className="flex items-center gap-2 text-amber-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Đang chờ bot xử lý file — bot quét mỗi ~20 giây, server lớn có thể mất 1-2 phút.
                Lỗi (nếu có) sẽ hiện ngay tại đây.
              </p>
              {importStatus?.botOnline === false && (
                <p className="flex items-center gap-2 text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Bot đang OFFLINE — hãy khởi động bot trên host (Wispbyte…) rồi tải lại file.
                </p>
              )}
              {importStatus?.botOnline === true &&
                parseBotVersion(importStatus.botVersion) < MIN_IMPORT_BOT_VERSION && (
                  <p className="flex items-center gap-2 text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Bot đang chạy bản cũ ({importStatus.botVersion ?? "không rõ"}) — cần cập nhật bot
                    lên bản mới nhất (v{MIN_IMPORT_BOT_VERSION}+) để khôi phục và báo kết quả chính
                    xác.
                  </p>
                )}
            </div>
          )}
          {importStatus && importStatus.error && !importWatch && (
            <p className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Lần thử trước <b>thất bại</b>: {importStatus.error} — kiểm tra lại file rồi tải lên.
              </span>
            </p>
          )}

          <p className="text-[11px] text-muted-foreground">
            Giới hạn file <b className="text-foreground">8 MB</b> (gồm cả media — file được giữ trong đám mây, không
            nhét vào bộ nhớ bot). Bot giữ nguyên role/kênh có sẵn của server hiện tại — chỉ thêm mới theo file, không
            xóa gì.
          </p>
        </CardContent>
      </Card>

      {/* Tự động backup định kỳ (2-30 ngày) */}
      <Card className="border-border/70">
        <CardContent className="grid gap-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
                <CalendarClock className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display font-semibold">Tự động backup định kỳ</p>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Bot tự chụp backup + đẩy lên <b className="text-foreground">GitHub của chủ bot</b> mỗi{" "}
                  <b className="text-foreground">N ngày</b> (tối thiểu <b>2</b>, tối đa <b>30</b>). Chỉ giữ{" "}
                  <b className="text-foreground">3 bản mới nhất</b> trong bot — bản cũ hơn tự bị xóa, GitHub
                  giữ bản lưu vĩnh viễn.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {autoOn ? (
                    data.guild.lastBackupAt ? (
                      <>
                        Backup gần nhất:{" "}
                        <b className="text-foreground">
                          {new Date(data.guild.lastBackupAt).toLocaleString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </b>{" "}
                        · lần tới:{" "}
                        <b className="text-foreground">
                          {new Date(
                            data.guild.lastBackupAt + autoDays * 86_400_000,
                          ).toLocaleString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </b>
                      </>
                    ) : (
                      "Bật lên là bot chụp bản đầu tiên trong khoảng 1 phút, sau đó lặp lại theo chu kỳ bạn chọn."
                    )
                  ) : (
                    "Đang tắt — bot chỉ backup khi bạn bấm “Backup ngay” hoặc dùng lệnh."
                  )}
                </p>
              </div>
            </div>
            <Switch checked={autoOn} onCheckedChange={setAutoOn} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Mỗi
              <input
                type="number"
                min={2}
                max={30}
                value={autoDays}
                disabled={!autoOn}
                onChange={(e) =>
                  setAutoDays(
                    Math.max(2, Math.min(30, parseInt(e.target.value || "2", 10) || 2)),
                  )
                }
                className="h-9 w-20 rounded-lg border border-border bg-card px-2 text-center font-mono text-sm text-foreground outline-none focus:border-primary/60 disabled:opacity-40"
              />
              ngày
            </label>
            <Button size="sm" onClick={saveAuto} disabled={autoBusy}>
              {autoBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Lưu lịch tự động
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tùy chỉnh khôi phục: bật/tắt role + emoji/sticker (cả 2 nguồn backup) */}
      <Card className="border-border/70">
        <CardContent className="grid gap-4 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display font-semibold">Tùy chỉnh khôi phục</p>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Bật/tắt từng phần khi bot khôi phục — áp dụng cho <b className="text-foreground">cả
                backup của Protogon</b> lẫn <b className="text-foreground">file backup của bot nuke</b>{" "}
                (.msc/.json tải lên). Phần tắt sẽ được bỏ qua khi khôi phục (kênh, tin nhắn + media vẫn
                được xử lý bình thường).
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/70 px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" />
                Khôi phục role (tên, màu, quyền, thứ tự)
              </span>
              <Switch checked={restoreRoles} onCheckedChange={setRestoreRoles} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/70 px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm">
                <FolderTree className="h-4 w-4" />
                Khôi phục kênh (danh mục, văn bản, thoại…)
              </span>
              <Switch checked={restoreChannels} onCheckedChange={setRestoreChannels} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/70 px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4" />
                Khôi phục tin nhắn + media
              </span>
              <Switch checked={restoreMessages} onCheckedChange={setRestoreMessages} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/70 px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm">
                <Smile className="h-4 w-4" />
                Khôi phục emoji / sticker
              </span>
              <Switch checked={restoreEmojis} onCheckedChange={setRestoreEmojis} />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={saveRestoreOptions} disabled={restoreOptBusy}>
              {restoreOptBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Lưu tùy chỉnh khôi phục
            </Button>
            {(data.guild.restoreRolesEnabled ?? true) !== restoreRoles ||
              (data.guild.restoreEmojisEnabled ?? true) !== restoreEmojis ||
              (data.guild.restoreChannelsEnabled ?? true) !== restoreChannels ||
              (data.guild.restoreMessagesEnabled ?? true) !== restoreMessages ? (
              <span className="text-xs text-muted-foreground">Có thay đổi chưa lưu — bấm Lưu để áp dụng.</span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Danh sách backup — component con, remount theo refreshAt để ép tải lại */}
      <BackupListCard
        key={refreshAt}
        data={data}
        busy={busy}
        onRestore={restore}
        onRefresh={refresh}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground">🛡️ Khi bị nuke/raid phá sập</p>
          <p>1. Backup đã được đẩy lên GitHub từ trước → dữ liệu vẫn còn.</p>
          <p className="mt-1">2. Tạo server phụ, mời bot vào.</p>
          <p className="mt-1">3. Vào dashboard → server phụ → Backup → bấm “Khôi phục”.</p>
          <p className="mt-1">
            4. Bot tạo lại role (tên, màu, quyền), danh mục, kênh + quyền truy cập và cấu hình cơ
            bản. Các role/kênh có sẵn của server phụ được giữ nguyên (không xóa gì).
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground">☁️ Đám mây GitHub</p>
          <p>
            Mỗi backup tạo một <b>Gist riêng tư</b> chứa file JSON cấu trúc server — bạn không cần
            tạo repo, không tốn bộ nhớ GitHub. Chỉ cần <b className="text-foreground">một</b>{" "}
            <code className="font-mono">GITHUB_TOKEN</code> (quyền <code className="font-mono">gist</code>)
            của <b className="text-foreground">chủ sở hữu bot</b> đặt trong tab <b>Keys / API keys</b> —
            mọi server dùng chung, các owner server khác không phải cấu hình gì. Bot giữ tối đa 3 bản
            backup mới nhất cho mỗi server.
          </p>
          <p className="mt-2">
            💡 Ngoài dashboard, bạn cũng có thể dùng lệnh trong Discord:{" "}
            <code className="font-mono">!backup</code> · <code className="font-mono">!backup list</code> ·{" "}
            <code className="font-mono">!backup restore &lt;số&gt;</code> hoặc{" "}
            <code className="font-mono">/backup</code>.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Danh sách backup — component con để nút "Tải lại" remount (refetch) qua `key`. */
function BackupListCard({
  data,
  busy,
  onRestore,
  onRefresh,
}: {
  data: GuildData;
  busy: "backup" | string | null;
  onRestore: (backup: BackupInfo) => void;
  onRefresh: () => void;
}) {
  const backups = useQuery(api.backup.listMine, { token: TOKEN() }) as
    | BackupInfo[]
    | undefined;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FolderTree className="h-4 w-4 text-primary" />
            <p className="font-display font-semibold">Backup có sẵn</p>
            <Badge variant="secondary">{(backups ?? []).length} bản</Badge>
          </div>
          <div className="flex items-center gap-2">
            {backups === undefined && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              title="Tải lại danh sách backup"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Tải lại
            </Button>
          </div>
        </div>

        {backups && backups.length === 0 ? (
          <div className="mt-4 flex items-center gap-3 rounded-lg bg-secondary/40 px-3 py-3 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Chưa có backup nào — bấm “Backup ngay” phía trên để tạo bản đầu tiên.
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {backups?.map((b) => (
              <div
                key={b._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/60 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{b.guildName}</p>
                    {b.guildId === data.guild.discordId ? (
                      <Badge variant="default" className="px-2 py-0.5 text-[10px]">
                        Server hiện tại
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="px-2 py-0.5 text-[10px]">
                        Server khác
                      </Badge>
                    )}
                    {b.pushedToGithub && (
                      <Badge className="gap-1 bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-400">
                        <Github className="h-3 w-3" /> GitHub
                      </Badge>
                    )}
                    {b.source === "import" && (
                      <Badge className="gap-1 bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-400">
                        <FileUp className="h-3 w-3" /> Từ file
                      </Badge>
                    )}
                    {(b.emojiCount ?? 0) > 0 && (
                      <Badge className="gap-1 bg-pink-500/15 px-2 py-0.5 text-[10px] text-pink-400">
                        <Smile className="h-3 w-3" /> {b.emojiCount} emoji
                      </Badge>
                    )}
                    {(b.stickerCount ?? 0) > 0 && (
                      <Badge className="gap-1 bg-violet-500/15 px-2 py-0.5 text-[10px] text-violet-400">
                        <Sticker className="h-3 w-3" /> {b.stickerCount} sticker
                      </Badge>
                    )}
                    {(b.messageCount ?? 0) > 0 && (
                      <Badge className="gap-1 bg-sky-500/15 px-2 py-0.5 text-[10px] text-sky-400">
                        <MessageSquare className="h-3 w-3" /> {b.messageCount} tin
                      </Badge>
                    )}
                    {b.backupCompressed && (
                      <Badge className="gap-1 bg-teal-500/15 px-2 py-0.5 text-[10px] text-teal-400">
                        Nén
                      </Badge>
                    )}
                    {b.backupEncrypted && (
                      <Badge className="gap-1 bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-400">
                        🔒 Mã hóa
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>
                      {new Date(b.createdAt).toLocaleString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {b.roleCount} role
                    </span>
                    <span className="flex items-center gap-1">
                      <FolderTree className="h-3 w-3" /> {b.channelCount} kênh
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {b.githubUrl && (
                    <a href={b.githubUrl} target="_blank" rel="noreferrer">
                      <Button variant="secondary" size="sm">
                        <ExternalLink className="h-3.5 w-3.5" /> Gist
                      </Button>
                    </a>
                  )}
                  <Button
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => onRestore(b)}
                    title="Tạo lại role, quyền role và kênh của backup này trong server hiện tại"
                  >
                    {busy === b._id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Khôi phục vào server này
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
