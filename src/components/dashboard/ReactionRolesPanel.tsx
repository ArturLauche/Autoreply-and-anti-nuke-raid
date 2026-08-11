import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { MessageSquareQuote, Plus, Power, Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
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
import type { GuildData, ReactionRolePanel } from "../../lib/types";

interface EntryRow {
  emoji: string;
  roleId: string;
}

export default function ReactionRolesPanel({ data }: { data: GuildData }) {
  const createPanel = useMutation(api.hidden.createPanel);
  const deletePanel = useMutation(api.hidden.deletePanel);
  const togglePanel = useMutation(api.hidden.togglePanel);

  const textChannels = data.channels.filter((c) => c.type === 0 || c.type === 5);
  const roleOptions = data.roles.filter((r) => r.name !== "@everyone");
  const token = getSessionToken();
  const guildId = data.guild.discordId;

  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [channelId, setChannelId] = useState("");
  const [rows, setRows] = useState<EntryRow[]>([{ emoji: "✅", roleId: "" }]);
  const [saving, setSaving] = useState(false);

  function channelName(id: string) {
    return textChannels.find((c) => c.channelId === id)?.name ?? "kênh đã xóa";
  }
  function roleName(id: string) {
    return roleOptions.find((r) => r.roleId === id)?.name ?? id;
  }

  async function handleCreate() {
    if (rows.some((r) => !r.emoji || !r.roleId)) {
      return toast.error("Mỗi dòng cần có emoji và chọn role");
    }
    setSaving(true);
    try {
      await createPanel({ token, guildId, channelId, label, entries: rows });
      toast.success("Đã tạo bảng — bot sẽ gửi tin nhắn trong vòng ~30 giây");
      setOpen(false);
      setLabel("");
      setChannelId("");
      setRows([{ emoji: "✅", roleId: "" }]);
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
              <MessageSquareQuote className="h-4 w-4 text-primary" /> Reaction Role
            </h3>
            <p className="text-sm text-muted-foreground">
              Thành viên bấm emoji dưới tin nhắn để tự nhận / gỡ role.
            </p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Tạo bảng mới
          </Button>
        </div>

        {data.panels.length === 0 ? (
          <p className="mt-4 rounded-lg bg-secondary/40 px-3 py-3 text-sm text-muted-foreground">
            Chưa có bảng reaction role nào. Bấm "Tạo bảng mới" để bắt đầu 🌸
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {data.panels.map((p: ReactionRolePanel) => (
              <li
                key={p._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {p.label}
                    {!p.messageId ? (
                      <Badge variant="secondary">⏳ chờ bot gửi</Badge>
                    ) : p.enabled ? (
                      <Badge variant="success">đang chạy</Badge>
                    ) : (
                      <Badge variant="secondary">đã tắt</Badge>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    #{channelName(p.channelId)} ·{" "}
                    {p.entries.map((e) => `${e.emoji} → ${roleName(e.roleId)}`).join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title={p.enabled ? "Tắt bảng" : "Bật bảng"}
                    onClick={async () => {
                      try {
                        await togglePanel({ token, guildId, panelId: p._id });
                        toast.success(p.enabled ? "Đã tắt bảng" : "Đã bật bảng");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Thất bại");
                      }
                    }}
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Xóa bảng"
                    onClick={async () => {
                      if (!confirm(`Xóa bảng "${p.label}"?`)) return;
                      try {
                        await deletePanel({ token, guildId, panelId: p._id });
                        toast.success("Đã xóa bảng (tin nhắn cũ trong Discord vẫn còn)");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Xóa thất bại");
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tạo bảng reaction role</DialogTitle>
              <DialogDescription>
                Bot sẽ gửi một tin nhắn vào kênh đã chọn kèm các emoji. Thành viên bấm emoji để nhận role.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Tên bảng</Label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="VD: Chọn game của bạn 🎮"
                  maxLength={100}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Kênh gửi tin nhắn</Label>
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
              <div>
                <Label className="mb-1.5 block">Emoji → Role</Label>
                <div className="space-y-2">
                  {rows.map((row, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={row.emoji}
                        onChange={(e) =>
                          setRows((rs) => rs.map((r, j) => (j === i ? { ...r, emoji: e.target.value } : r)))
                        }
                        placeholder="Emoji (✅ hoặc ID)"
                        maxLength={32}
                        className="w-28"
                      />
                      <Select
                        value={row.roleId}
                        onValueChange={(v) =>
                          setRows((rs) => rs.map((r, j) => (j === i ? { ...r, roleId: v } : r)))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn role…" />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map((r) => (
                            <SelectItem key={r.roleId} value={r.roleId}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={rows.length === 1}
                        onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setRows((rs) => [...rs, { emoji: "⭐", roleId: "" }])}
                >
                  <Plus className="h-4 w-4" /> Thêm cặp emoji/role
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={saving || !label || !channelId || rows.some((r) => !r.emoji || !r.roleId)}
              >
                {saving ? "Đang tạo…" : "Tạo bảng"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
