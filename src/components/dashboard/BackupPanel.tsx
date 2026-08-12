import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  CloudUpload,
  DatabaseBackup,
  ExternalLink,
  FolderTree,
  Github,
  Loader2,
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
  const [busy, setBusy] = useState<"backup" | string | null>(null);
  const requestBackup = useMutation(api.backup.requestBackup);
  const requestRestore = useMutation(api.backup.requestRestore);

  const backups = useQuery(api.backup.listMine, { token: TOKEN() }) as
    | BackupInfo[]
    | undefined;

  async function createBackup() {
    setBusy("backup");
    try {
      await requestBackup({
        token: TOKEN(),
        guildId: data.guild.discordId,
        pushToGithub: pushGithub,
      });
      toast.success("Đã yêu cầu tạo backup — bot thực hiện trong ~20 giây", {
        description: pushGithub
          ? "Backup sẽ được lưu trên Convex và đẩy lên GitHub (cần GITHUB_TOKEN)."
          : "Backup sẽ được lưu trên Convex.",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Thất bại");
    } finally {
      setBusy(null);
    }
  }

  async function restore(backup: BackupInfo) {
    if (!window.confirm(`Khôi phục backup của "${backup.guildName}" vào server hiện tại?\n\nBot sẽ tạo lại role (tên, màu, quyền) và kênh theo backup. Các role/kênh đang có của server này được giữ nguyên.`)) {
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
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/70 px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm">
                <Github className="h-4 w-4" />
                Đồng thời đẩy backup lên GitHub (Gist riêng tư)
                <Badge variant="secondary" className="px-2 py-0.5 text-[10px]">
                  cần GITHUB_TOKEN
                </Badge>
              </span>
              <Switch checked={pushGithub} onCheckedChange={setPushGithub} />
            </label>
            <p className="text-[11px] text-muted-foreground">
              Backup luôn được lưu trong Convex; đẩy lên GitHub giúp bạn còn giữ được dữ liệu ngay
              cả khi Convex bị xóa — nếu chưa cấu hình <code className="font-mono">GITHUB_TOKEN</code>{" "}
              trong Keys, phần GitHub sẽ bị bỏ qua và bot chỉ lưu trong Convex.
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

      {/* Danh sách backup */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-primary" />
              <p className="font-display font-semibold">Backup có sẵn</p>
              <Badge variant="secondary">{(backups ?? []).length} bản</Badge>
            </div>
            {backups === undefined && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
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
                      onClick={() => restore(b)}
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
            tạo repo, không tốn bộ nhớ GitHub. Chỉ cần một{" "}
            <code className="font-mono">GITHUB_TOKEN</code> (quyền <code className="font-mono">gist</code>)
            dán vào tab <b>Keys / API keys</b> của Freebuff. Bot giữ tối đa 3 bản backup mới nhất
            cho mỗi server.
          </p>
        </div>
      </div>
    </div>
  );
}
