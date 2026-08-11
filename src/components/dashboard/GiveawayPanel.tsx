import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Gift, Plus, Timer, Trash2, Trophy, Users } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Switch } from "../ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { getSessionToken } from "../../lib/discord";
import type { Giveaway, GuildData } from "../../lib/types";

const DURATION_PRESETS = [
  { label: "5 phút", minutes: 5 },
  { label: "30 phút", minutes: 30 },
  { label: "1 giờ", minutes: 60 },
  { label: "1 ngày", minutes: 1440 },
  { label: "3 ngày", minutes: 4320 },
  { label: "7 ngày", minutes: 10080 },
];

export default function GiveawayPanel({ data }: { data: GuildData }) {
  const createGiveaway = useMutation(api.hidden.createGiveaway);
  const cancelGiveaway = useMutation(api.hidden.cancelGiveaway);

  const textChannels = data.channels.filter((c) => c.type === 0 || c.type === 5);
  const roleOptions = data.roles.filter((r) => r.name !== "@everyone");
  const token = getSessionToken();
  const guildId = data.guild.discordId;

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [prize, setPrize] = useState("");
  const [winnerCount, setWinnerCount] = useState(1);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [dmWinners, setDmWinners] = useState(true);
  const [requiredRoleId, setRequiredRoleId] = useState("none");
  const [channelId, setChannelId] = useState("");
  const [saving, setSaving] = useState(false);

  const active = data.giveaways.filter((g) => g.status === "active");
  const past = data.giveaways.filter((g) => g.status !== "active").slice(0, 10);

  function channelName(id: string) {
    return textChannels.find((c) => c.channelId === id)?.name ?? "kênh đã xóa";
  }

  async function handleCreate() {
    setSaving(true);
    try {
      await createGiveaway({
        token,
        guildId,
        channelId,
        title,
        prize,
        winnerCount,
        durationMinutes,
        dmWinners,
        requiredRoleId: requiredRoleId === "none" ? undefined : requiredRoleId,
      });
      toast.success("Đã tạo giveaway — bot sẽ gửi trong vòng ~30 giây 🎉");
      setOpen(false);
      setTitle("");
      setPrize("");
      setChannelId("");
      setWinnerCount(1);
      setDurationMinutes(60);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tạo thất bại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-display font-semibold">
              <Gift className="h-4 w-4 text-primary" /> Giveaway 🎉
            </h3>
            <p className="text-sm text-muted-foreground">
              Tự động chọn người thắng, thông báo trong kênh và gửi DM giải thưởng nếu muốn.
            </p>
          </div>
          <Button onClick={() => setOpen(true)} disabled={active.length >= 5}>
            <Plus className="h-4 w-4" /> Tạo giveaway
          </Button>
        </div>

        {active.length > 0 && (
          <ul className="mt-4 space-y-2">
            {active.map((g: Giveaway) => (
              <li
                key={g._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    🎉 {g.title}
                    {!g.messageId ? (
                      <Badge variant="secondary">⏳ chờ bot gửi</Badge>
                    ) : (
                      <Badge variant="success">đang chạy</Badge>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <Timer className="mr-1 inline h-3 w-3" />
                    kết thúc{" "}
                    {g.endsAt <= Date.now()
                      ? "bất cứ lúc nào"
                      : new Date(g.endsAt).toLocaleString("vi-VN")}
                    {" · "}
                    <Users className="mr-1 inline h-3 w-3" />
                    {g.entriesCount} người tham gia · {g.winnerCount} người thắng
                    {g.dmWinners ? " · DM người thắng" : ""}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!confirm(`Hủy giveaway "${g.title}"?`)) return;
                    try {
                      await cancelGiveaway({ token, guildId, giveawayId: g._id });
                      toast.success("Đã hủy giveaway");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Hủy thất bại");
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Hủy
                </Button>
              </li>
            ))}
          </ul>
        )}

        {past.length > 0 && (
          <ul className="mt-4 space-y-2">
            {past.map((g) => (
              <li
                key={g._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {g.title}
                    <Badge variant={g.status === "ended" ? "success" : "secondary"}>
                      {g.status === "ended" ? "đã kết thúc" : "đã hủy"}
                    </Badge>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    #{channelName(g.channelId)} · {g.entriesCount} lượt tham gia
                    {g.winners.length > 0 && (
                      <>
                        {" · "}
                        <Trophy className="mr-1 inline h-3 w-3 text-amber-400" />
                        {g.winners.map((w) => w.username).join(", ")}
                      </>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {data.giveaways.length === 0 && (
          <p className="mt-4 rounded-lg bg-secondary/40 px-3 py-3 text-sm text-muted-foreground">
            Chưa có giveaway nào. Tạo giveaway đầu tiên để chúc mừng thành viên 🎀
          </p>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Tạo giveaway mới</DialogTitle>
              <DialogDescription>
                Bot gửi embed giveaway + phản ứng 🎉. Hết giờ, bot tự chọn người thắng và thông báo.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Tên giveaway</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Nitro 1 tháng"
                  maxLength={100}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Giải thưởng (hiển thị trong embed)</Label>
                <Textarea
                  value={prize}
                  onChange={(e) => setPrize(e.target.value)}
                  placeholder="VD: 1 tháng Nitro Boost 🚀"
                  maxLength={2000}
                  rows={2}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Kênh gửi giveaway</Label>
                <Select value={channelId} onValueChange={setChannelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn kênh…" />
                  </SelectTrigger>
                  <SelectContent>
                    {textChannels.map((c) => (
                      <SelectItem key={c.channelId} value={c.channelId}>
                        #{c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Số người thắng</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={winnerCount}
                    onChange={(e) => setWinnerCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Thời lượng</Label>
                  <Select
                    value={String(durationMinutes)}
                    onValueChange={(v) => setDurationMinutes(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_PRESETS.map((d) => (
                        <SelectItem key={d.minutes} value={String(d.minutes)}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Yêu cầu role để tham gia (tùy chọn)</Label>
                <Select value={requiredRoleId} onValueChange={setRequiredRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Mọi thành viên" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Mọi thành viên —</SelectItem>
                    {roleOptions.map((r) => (
                      <SelectItem key={r.roleId} value={r.roleId}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                <div className="text-sm">
                  <p className="font-medium">💌 DM người thắng</p>
                  <p className="text-xs text-muted-foreground">
                    Bot gửi tin nhắn riêng kèm giải thưởng cho từng người thắng
                  </p>
                </div>
                <Switch checked={dmWinners} onCheckedChange={setDmWinners} />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={saving || !title || !prize || !channelId}
              >
                {saving ? "Đang tạo…" : "Tạo giveaway 🎉"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
