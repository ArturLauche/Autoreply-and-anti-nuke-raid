import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
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
  Users,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import type { GuildData, BackupInfo } from "../../lib/types";
import { getSessionToken } from "../../lib/discord";

const TOKEN = () => getSessionToken();

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
  const requestBackup = useMutation(api.backup.requestBackup);
  const requestRestore = useMutation(api.backup.requestRestore);
  const requestImportRestore = useMutation(api.backup.requestImportRestore);
  const setAutoBackup = useMutation(api.backup.setAutoBackup);

  const refresh = () => setRefreshAt((n) => n + 1);

  async function createBackup() {
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

  async function importFile(file: File) {
    if (!file) return;
    if (file.size > 600_000) {
      toast.error("File quá lớn (tối đa ~600 KB) — chỉ cấu trúc + tin nhắn, không kèm media");
      return;
    }
    setImportBusy(true);
    try {
      const content = await file.text();
      if (!content || content.trim().length < 8) {
        throw new Error("File rỗng hoặc không phải backup hợp lệ");
      }
      await requestImportRestore({
        token: TOKEN(),
        guildId: data.guild.discordId,
        fileName: file.name,
        fileContent: content,
      });
      toast.success(`Đã tải "${file.name}" lên — bot khôi phục trong ~30 giây`, {
        description:
          "Bot nhận diện định dạng (JSON thường / base64 / có lớp bọc), tạo lại role + kênh đúng thứ tự trong file và phục hồi tin nhắn nếu file có lưu.",
      });
      if (fileRef.current) fileRef.current.value = "";
      setImportFileName("");
      window.setTimeout(refresh, 30000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tải file thất bại");
    } finally {
      setImportBusy(false);
    }
  }

  async function restore(backup: BackupInfo) {
    if (!window.confirm(`Khôi phục backup của "${backup.guildName}" vào server hiện tại?\n\nBot sẽ tạo lại role (tên, màu, quyền) và kênh theo backup, sắp xếp lại đúng thứ tự, và phục hồi tin nhắn nếu backup có. Các role/kênh đang có của server này được giữ nguyên.`)) {
      return;
    }
    setBusy(backup._id);
    try {
      await requestRestore({
        token: TOKEN(),
        guildId: data.guild.discordId,
        backupId: backup._id,
      });
      toast.success("Đã yêu cầu khôi phục — bot thực hiện trong ~30 giây", {
        description: "Role, quyền role và kênh sẽ được tạo lại theo backup.",
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
          toàn, mời bot vào <b className="text-foreground">server phụ</b> rồi khôi phục lại từ
          backup.
        </p>
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
                  thoại…) kèm quyền truy cập từng kênh, và cấu hình cơ bản (prefix, từ ngữ xấu,
                  role mod/admin, kênh log).
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
                  Kèm tin nhắn (tối đa 50 tin/kênh)
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
                bọc), tạo lại <b className="text-foreground">role + kênh đúng thứ tự</b> như trong file và phục hồi{" "}
                <b className="text-foreground">tin nhắn</b> nếu file có lưu.
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
          <p className="text-[11px] text-muted-foreground">
            Giới hạn file ~600 KB (chỉ cấu trúc + tin nhắn, không kèm media). Bot giữ nguyên role/kênh có sẵn của server
            hiện tại — chỉ thêm mới theo file, không xóa gì.
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
                      "Bật lên là bot chụp bản đầu tiên trong vài phút, sau đó lặp lại theo chu kỳ."
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
                    {(b.messageCount ?? 0) > 0 && (
                      <Badge className="gap-1 bg-sky-500/15 px-2 py-0.5 text-[10px] text-sky-400">
                        <MessageSquare className="h-3 w-3" /> {b.messageCount} tin
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
