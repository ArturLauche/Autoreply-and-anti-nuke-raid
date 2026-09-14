import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { AtSign, KeyRound, Pencil, Plus, Timer, Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Switch } from "../ui/switch";
import { MultiSelect } from "../ui/multi-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { CHANNEL_TYPE_LABEL } from "../../lib/constants";
import type { AutoReply, GuildData } from "../../lib/types";
import { getSessionToken } from "../../lib/discord";

const TOKEN = () => getSessionToken();

interface FormState {
  name: string;
  triggerType: "keyword" | "mention";
  keywords: string;
  response: string;
  channels: string[];
  cooldownSeconds: number;
}

const emptyForm: FormState = {
  name: "",
  triggerType: "keyword",
  keywords: "",
  response: "",
  channels: [],
  cooldownSeconds: 30,
};

export default function AutoReplyPanel({ data }: { data: GuildData }) {
  const addRule = useMutation(api.autoreplies.add);
  const updateRule = useMutation(api.autoreplies.update);
  const removeRule = useMutation(api.autoreplies.remove);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AutoReply | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const textChannels = data.channels.filter((c) => c.type === 0 || c.type === 5);
  const channelOptions = textChannels.map((c) => ({
    value: c.channelId,
    label: `#${c.name}`,
    sublabel: CHANNEL_TYPE_LABEL[c.type],
  }));

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(rule: AutoReply) {
    setEditing(rule);
    setForm({
      name: rule.name,
      triggerType: rule.triggerType,
      keywords: rule.keywords.join(", "),
      response: rule.response,
      channels: rule.channels,
      cooldownSeconds: rule.cooldownSeconds,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error("Nhập tên rule");
    if (!form.response.trim()) return toast.error("Nhập nội dung trả lời");
    if (form.triggerType === "keyword" && !form.keywords.trim()) {
      return toast.error("Nhập ít nhất một từ khóa");
    }
    setSaving(true);
    try {
      const keywords = form.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      if (editing) {
        await updateRule({
          token: TOKEN(),
          id: editing._id,
          name: form.name.trim(),
          triggerType: form.triggerType,
          keywords,
          response: form.response,
          channels: form.channels,
          cooldownSeconds: Number(form.cooldownSeconds) || 0,
        });
        toast.success(`Đã cập nhật rule "${form.name}"`);
      } else {
        await addRule({
          token: TOKEN(),
          guildId: data.guild.discordId,
          name: form.name.trim(),
          triggerType: form.triggerType,
          keywords,
          response: form.response,
          channels: form.channels,
          cooldownSeconds: Number(form.cooldownSeconds) || 0,
        });
        toast.success(`Đã tạo rule "${form.name}"`);
      }
      setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(rule: AutoReply, enabled: boolean) {
    try {
      await updateRule({ token: TOKEN(), id: rule._id, enabled });
      toast.success(`Rule "${rule.name}" ${enabled ? "đã bật" : "đã tắt"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Thất bại");
    }
  }

  async function handleDelete(rule: AutoReply) {
    if (!confirm(`Xóa rule "${rule.name}"?`)) return;
    try {
      await removeRule({ token: TOKEN(), id: rule._id });
      toast.success(`Đã xóa "${rule.name}"`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Xóa thất bại");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Auto Reply</h2>
          <p className="text-sm text-muted-foreground">
            Bot tự trả lời thành viên khi nhắc từ khóa hoặc tag @bot
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Thêm rule
        </Button>
      </div>

      {data.autoReplies.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <AtSign className="h-6 w-6" />
            </span>
            <p className="max-w-sm text-sm text-muted-foreground">
              Chưa có rule nào. Tạo rule đầu tiên để bot trả lời khi ai đó nhắc từ khóa hoặc tag
              bot.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {data.autoReplies.map((rule) => (
            <Card
              key={rule._id}
              className={`transition-opacity ${rule.enabled ? "" : "opacity-60"}`}
            >
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display font-semibold">{rule.name}</p>
                      <Badge variant={rule.triggerType === "mention" ? "default" : "secondary"}>
                        {rule.triggerType === "mention" ? (
                          <>
                            <AtSign className="h-3 w-3" /> @mention
                          </>
                        ) : (
                          <>
                            <KeyRound className="h-3 w-3" /> từ khóa
                          </>
                        )}
                      </Badge>
                      <Badge variant={rule.enabled ? "success" : "secondary"}>
                        {rule.enabled ? "Đang bật" : "Đã tắt"}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Timer className="h-3 w-3" /> {rule.cooldownSeconds}s
                      </Badge>
                    </div>
                    {rule.triggerType === "keyword" && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {rule.keywords.map((k) => (
                          <span
                            key={k}
                            className="rounded-md bg-secondary px-2 py-0.5 font-mono text-xs text-primary"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-foreground/90">
                      {rule.response}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {rule.channels.length === 0
                        ? "Áp dụng mọi kênh"
                        : `${rule.channels.length} kênh được chọn`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={rule.enabled} onCheckedChange={(v) => toggleRule(rule, v)} />
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(rule)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-danger hover:text-danger"
                      onClick={() => handleDelete(rule)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Chỉnh sửa "${editing.name}"` : "Thêm rule auto reply"}
            </DialogTitle>
            <DialogDescription>
              Bot sẽ trả lời thành viên khi điều kiện kích hoạt được thỏa mãn.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="rule-name">Tên rule</Label>
              <Input
                id="rule-name"
                placeholder="vi-du: chao-hoi"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label>Loại kích hoạt</Label>
              <Select
                value={form.triggerType}
                onValueChange={(v) => setForm({ ...form, triggerType: v as "keyword" | "mention" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn loại" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keyword">Từ khóa trong tin nhắn</SelectItem>
                  <SelectItem value="mention">Tag bot (@protogon)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {form.triggerType === "mention"
                  ? "Kích hoạt khi thành viên tag bot trong tin nhắn."
                  : "Kích hoạt khi tin nhắn chứa một trong các từ khóa bên dưới."}
              </p>
            </div>

            {form.triggerType === "keyword" && (
              <div className="grid gap-2">
                <Label htmlFor="rule-keywords">Từ khóa (phân cách bằng dấu phẩy)</Label>
                <Input
                  id="rule-keywords"
                  placeholder="hello, xin chào, chào"
                  value={form.keywords}
                  onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="rule-response">Nội dung trả lời</Label>
              <Textarea
                id="rule-response"
                placeholder="Chào {user}! Cần tớ giúp gì không?"
                value={form.response}
                onChange={(e) => setForm({ ...form, response: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Placeholder: <code className="font-mono">{"{user}"}</code> tag người nhắn,{" "}
                <code className="font-mono">{"{username}"}</code> lấy tên thành viên.
              </p>
            </div>

            <div className="grid gap-2">
              <Label>Chỉ áp dụng cho kênh (bỏ trống = mọi kênh)</Label>
              <MultiSelect
                options={channelOptions}
                value={form.channels}
                onChange={(v) => setForm({ ...form, channels: v })}
                placeholder="Tất cả kênh"
                emptyLabel="Chưa có kênh nào được đồng bộ"
                searchPlaceholder="Gõ tên kênh để tìm nhanh…"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rule-cooldown">Cooldown (giây, 0 = không giới hạn)</Label>
              <Input
                id="rule-cooldown"
                type="number"
                min={0}
                max={86400}
                value={form.cooldownSeconds}
                onChange={(e) => setForm({ ...form, cooldownSeconds: Number(e.target.value) })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Tạo rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
