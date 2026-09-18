import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { BellRing, Hash, Megaphone } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "../ui/card";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  DEFAULT_PUNISH_NOTICE,
  PUNISH_NOTICE_ACTION_LABEL,
  PUNISH_NOTICE_ACTIONS,
  PUNISH_NOTICE_LEVELS,
} from "../../lib/constants";
import type { GuildData, PunishNoticeLevel } from "../../lib/types";
import { getSessionToken } from "../../lib/discord";
import { cn } from "../../lib/utils";

const TOKEN = () => getSessionToken();

const LEVEL_BADGE: Record<string, string> = {
  none: "bg-secondary text-muted-foreground",
  action: "bg-foreground/10 text-foreground border border-foreground/20",
  reason: "bg-foreground/20 text-foreground border border-foreground/30",
  full: "bg-foreground text-primary-foreground",
};

/** Xem trước embed moderation kiểu Carl-bot bot sẽ gửi theo mức đã chọn. */
function previewFor(action: string, level: PunishNoticeLevel): string {
  const label = PUNISH_NOTICE_ACTION_LABEL[action] ?? action;
  switch (level) {
    case "none":
      return "Bot không gửi embed nào sau khi trừng phạt (dashboard vẫn ghi nhận case).";
    case "action":
      return `${label} | case N — Offender: @thànhviên`;
    case "reason":
      return `${label} | case N — Offender: @thànhviên · Reason: <lý do vi phạm>`;
    case "full":
      return `${label} | case N — Offender: @thànhviên · Reason: <lý do> · Responsible moderator: @người áp dụng`;
  }
}

export default function ModerationPanel({ data }: { data: GuildData }) {
  const updateSettings = useMutation(api.guilds.updateSettings);
  const [channelId, setChannelId] = useState<string>(data.guild.punishNoticeChannelId ?? "none");
  const [saving, setSaving] = useState(false);

  const notice = {
    ...DEFAULT_PUNISH_NOTICE,
    ...(data.guild.punishNotice ?? {}),
  };
  const textChannels = data.channels.filter((c) => c.type === 0 || c.type === 5);

  async function save(patch: {
    punishNoticeChannelId?: string;
    punishNotice?: { ban: string; timeout: string; kick: string; warn: string };
  }) {
    setSaving(true);
    try {
      await updateSettings({ token: TOKEN(), guildId: data.guild.discordId, ...patch });
      toast.success("Đã lưu — bot áp dụng trong vòng ~3 phút");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Megaphone className="h-5 w-5 text-primary" /> Moderation — thông báo sau khi phạt
          </h2>
          <p className="text-sm text-muted-foreground">
            Tùy chỉnh <b className="text-foreground">embed moderation kiểu Carl-bot</b> bot gửi sau
            khi đã trừng phạt thành viên vi phạm — đồng bộ cả kênh lẫn mức chi tiết, theo từng hành
            động ban · timeout · warn · kick (cả tự động lẫn lệnh thủ công).
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
          <BellRing className="h-3.5 w-3.5" />
          {Object.values(notice).filter((l) => l !== "none").length}/4 đang bật thông báo
        </Badge>
      </div>

      {/* Chọn kênh thông báo */}
      <Card className="border-primary/25">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-[1fr_auto]">
          <div className="grid gap-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Hash className="h-3.5 w-3.5" /> Kênh gửi thông báo hình phạt
            </Label>
            <Select value={channelId} onValueChange={(v) => setChannelId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn kênh" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Tự động dùng kênh log mod / log chung —</SelectItem>
                {textChannels.map((c) => (
                  <SelectItem key={c.channelId} value={c.channelId}>
                    #{c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Nếu chọn “tự động”, bot ưu tiên kênh log hành động mod, rồi tới kênh log chung (Cài
              đặt → Kênh log). Chưa có kênh log nào → không gửi được thông báo.
            </p>
          </div>
          <div className="flex items-end">
            <Button
              disabled={saving}
              onClick={() =>
                save({
                  // "" (chuỗi rỗng) = xóa kênh riêng → bot tự dùng log mod / log chung.
                  punishNoticeChannelId: channelId === "none" ? "" : channelId,
                })
              }
            >
              {saving ? "Đang lưu…" : "Lưu kênh"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 4 hành động: ban / timeout / warn / kick */}
      <div className="grid gap-4 lg:grid-cols-2">
        {PUNISH_NOTICE_ACTIONS.map((action) => {
          const level = notice[action] ?? "none";
          return (
            <Card key={action}>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-display font-semibold">{PUNISH_NOTICE_ACTION_LABEL[action]}</p>
                  <Badge className={cn("gap-1 px-2.5 py-1", LEVEL_BADGE[level])}>
                    {PUNISH_NOTICE_LEVELS.find((l) => l.value === level)?.label}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Nội dung thông báo sau khi bot {action === "warn" ? "warn" : action}
                  </Label>
                  <Select
                    value={level}
                    onValueChange={(v) =>
                      save({
                        punishNotice: {
                          ban:
                            action === "ban"
                              ? (v as PunishNoticeLevel)
                              : (notice.ban as PunishNoticeLevel),
                          timeout:
                            action === "timeout"
                              ? (v as PunishNoticeLevel)
                              : (notice.timeout as PunishNoticeLevel),
                          kick:
                            action === "kick"
                              ? (v as PunishNoticeLevel)
                              : (notice.kick as PunishNoticeLevel),
                          warn:
                            action === "warn"
                              ? (v as PunishNoticeLevel)
                              : (notice.warn as PunishNoticeLevel),
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PUNISH_NOTICE_LEVELS.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="mt-3 rounded-lg bg-secondary/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                  {PUNISH_NOTICE_LEVELS.find((l) => l.value === level)?.hint}
                  <span className="mt-1 block font-mono text-[10px] text-foreground/80">
                    {previewFor(action, level)}
                  </span>
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        💡 Đây chính là embed <b className="text-foreground">duy nhất</b> bot gửi sau khi phạt — kể
        cả <b className="text-foreground">tự động</b> (chống nuke / auto-mod — Responsible moderator
        hiển thị là “Bot tự động”) lẫn <b className="text-foreground">thủ công</b> từ lệnh{" "}
        <code className="font-mono">/mod</code> (hiển thị tên người thực hiện). Lý do để trống → ghi
        “không có lý do”. Chọn <b>Không gửi tin nhắn</b> → bot không gửi embed nhưng dashboard vẫn
        ghi nhận case. Embed xóa tin / purge luôn đầy đủ.
      </p>
    </div>
  );
}
