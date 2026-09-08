import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Check,
  Eye,
  Link2,
  Palette,
  Pencil,
  Plus,
  Send,
  Trash2,
  Webhook as WebhookIcon,
  X,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import type { GuildData } from "../../lib/types";
import { getSessionToken } from "../../lib/discord";

const TOKEN = () => getSessionToken();

interface WebhookRow {
  _id: Id<"guildWebhooks">;
  name: string;
  channelId: string;
  avatarUrl: string | null;
  color: number | null;
  contentTemplate: string | null;
  eventTypes: string[];
  enabled: boolean;
  status: "pending_create" | "ready" | "pending_update" | "pending_delete" | "error";
  testRequested: boolean;
  webhookId: string | null;
  lastError: string | null;
  createdAt: number;
}

const EVENT_LABELS: Record<string, string> = {
  mod: "⚖️ Log hình phạt (ban/kick/timeout/warn…)",
  general: "🛡️ Cảnh báo anti nuke/raid + log chung",
};

function hexToNumber(hex: string): number | undefined {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  return m ? parseInt(m[1], 16) : undefined;
}

function numberToHex(n: number | null | undefined): string {
  if (n === null || n === undefined) return "#f2629e";
  return "#" + n.toString(16).padStart(6, "0");
}

const STATUS_BADGE: Record<WebhookRow["status"], { label: string; cls: string }> = {
  pending_create: { label: "⏳ Đang tạo…", cls: "secondary" },
  pending_update: { label: "⏳ Đang đồng bộ…", cls: "secondary" },
  pending_delete: { label: "🗑️ Chờ xóa…", cls: "secondary" },
  ready: { label: "✅ Sẵn sàng", cls: "success" },
  error: { label: "⚠️ Lỗi", cls: "danger" },
};

export default function WebhookPanel({ data }: { data: GuildData }) {
  const g = data.guild;
  const token = TOKEN();
  const webhooks = useQuery(api.webhooks.getGuildWebhooks, {
    token,
    guildId: g.discordId,
  }) as WebhookRow[] | null | undefined;

  const createWebhook = useMutation(api.webhooks.createWebhook);
  const updateWebhook = useMutation(api.webhooks.updateWebhook);
  const toggleWebhook = useMutation(api.webhooks.toggleWebhook);
  const deleteWebhook = useMutation(api.webhooks.deleteWebhook);
  const requestTest = useMutation(api.webhooks.requestWebhookTest);

  const channels = data.channels.filter((c) => c.type === 0 || c.type === 5);

  // Form tạo webhook
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [color, setColor] = useState("#f2629e");
  const [contentTemplate, setContentTemplate] = useState("");
  const [eventTypes, setEventTypes] = useState<string[]>(["mod"]);

  // Form sửa (mở rộng từng dòng)
  const [editing, setEditing] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) return toast.error("Cần đặt tên cho webhook");
    if (!channelId) return toast.error("Chọn kênh nhận log");
    try {
      await createWebhook({
        token,
        guildId: g.discordId,
        name: name.trim(),
        channelId,
        avatarUrl: avatarUrl.trim() || undefined,
        color: hexToNumber(color),
        contentTemplate: contentTemplate.trim() || undefined,
        eventTypes,
      });
      toast.success("Đã gửi yêu cầu — bot sẽ tạo webhook trong ~1 phút");
      setShowForm(false);
      setName("");
      setChannelId("");
      setAvatarUrl("");
      setContentTemplate("");
      setEventTypes(["mod"]);
    } catch (e: unknown) {
      toast.error(String(e));
    }
  }

  async function handleSave(id: Id<"guildWebhooks">, patch: Record<string, unknown>) {
    try {
      await updateWebhook({ token, guildId: g.discordId, webhookId: id, ...patch });
      toast.success("Đã lưu — bot đồng bộ trong ~1 phút");
      setEditing(null);
    } catch (e: unknown) {
      toast.error(String(e));
    }
  }

  async function handleDelete(id: Id<"guildWebhooks">) {
    if (!window.confirm("Xóa webhook này? Bot sẽ xóa nó khỏi Discord.")) return;
    try {
      await deleteWebhook({ token, guildId: g.discordId, webhookId: id });
      toast.success("Đã yêu cầu xóa webhook");
    } catch (e: unknown) {
      toast.error(String(e));
    }
  }

  async function handleTest(id: Id<"guildWebhooks">) {
    try {
      await requestTest({ token, guildId: g.discordId, webhookId: id });
      toast.success("Đã yêu cầu gửi embed test — kiểm tra kênh trong ~1 phút");
    } catch (e: unknown) {
      toast.error(String(e));
    }
  }

  function toggleEvent(type: string) {
    setEventTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  const loading = webhooks === undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <WebhookIcon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold">Webhook tùy chỉnh</h2>
          <p className="text-xs text-muted-foreground">
            Bot tự tạo webhook theo ý bạn — tên, emoji, avatar, màu embed, nội dung kèm — rồi gửi log
            vào kênh đã chọn.
          </p>
        </div>
      </div>

      {/* Hướng dẫn nhanh */}
      <div className="rounded-xl bg-muted/50 p-4 text-xs leading-relaxed text-muted-foreground">
        <p className="mb-1 font-semibold text-foreground">💡 Cách hoạt động:</p>
        <p>
          • <b className="text-foreground">Tên webhook</b> hỗ trợ emoji: dán emoji tĩnh{" "}
          <code className="rounded bg-muted px-1 font-mono">🔔</code> hoặc emoji custom{" "}
          <code className="rounded bg-muted px-1 font-mono">&lt;:ten:123…&gt;</code> /{" "}
          <code className="rounded bg-muted px-1 font-mono">&lt;a:ten:123…&gt;</code> (emoji động{" "}
          <b className="text-foreground">&lt;a:…&gt;</b> hiển thị động cho người có Nitro, người khác
          thấy bản tĩnh).
        </p>
        <p className="mt-1">
          • Webhook nhận log theo loại đã chọn: log hình phạt (mod) và/hoặc cảnh báo anti nuke/raid
          (general). Có webhook khớp → log gửi qua webhook, kênh thường chỉ dùng khi chưa có webhook.
        </p>
        <p className="mt-1">
          • Sau khi tạo, bot tạo webhook trên Discord trong khoảng 1 phút — bấm{" "}
          <b className="text-foreground">Gửi thử</b> để kiểm tra ngay.
        </p>
      </div>

      {/* Nút tạo mới */}
      {!showForm && (
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Tạo webhook mới
        </Button>
      )}

      {/* Form tạo */}
      {showForm && (
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <p className="font-display text-sm font-bold">Tạo webhook mới</p>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Đóng form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Tên webhook (kèm emoji nếu muốn)</Label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder='🔔 Protogon Logs'
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  maxLength={80}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Kênh nhận log</Label>
                <select
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">— Chọn kênh —</option>
                  {channels.map((ch) => (
                    <option key={ch.channelId} value={ch.channelId}>
                      # {ch.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Avatar (URL ảnh https)</Label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://…/avatar.png"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <p className="text-[10px] text-muted-foreground">Để trống = avatar mặc định của bot.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Màu embed</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#f2629e"}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="#f2629e"
                    className="w-28 rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-sm"
                    maxLength={7}
                  />
                  <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nội dung gửi kèm (trước embed)</Label>
              <input
                type="text"
                value={contentTemplate}
                onChange={(e) => setContentTemplate(e.target.value)}
                placeholder='📋 Log mới — {server} lúc {time}'
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                maxLength={500}
              />
              <p className="text-[10px] text-muted-foreground">
                Chèn: <code className="font-mono">{'{server}'}</code> tên server ·{" "}
                <code className="font-mono">{'{time}'}</code> giờ hiện tại ·{" "}
                <code className="font-mono">{'{action}'}</code> hành động.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nhận loại log nào?</Label>
              <div className="flex flex-col gap-2">
                {Object.entries(EVENT_LABELS).map(([type, label]) => (
                  <label
                    key={type}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-background/50 px-3 py-2 text-sm transition-colors hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={eventTypes.includes(type)}
                      onChange={() => toggleEvent(type)}
                      className="h-4 w-4 accent-[hsl(var(--primary))]"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Tạo webhook
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Danh sách webhook */}
      <div className="space-y-3">
        {loading && (
          <p className="text-sm text-muted-foreground">Đang tải danh sách webhook…</p>
        )}
        {!loading && (webhooks ?? []).length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Chưa có webhook nào. Tạo webhook đầu tiên để log gửi qua webhook tùy chỉnh.
          </p>
        )}
        {(webhooks ?? []).map((w) => {
          const badge = STATUS_BADGE[w.status] ?? STATUS_BADGE.ready;
          const isEditing = editing === w._id;
          return (
            <Card key={w._id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg">
                    <WebhookIcon className="h-5 w-5 text-primary" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{w.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      # {channels.find((c) => c.channelId === w.channelId)?.name ?? "kênh đã bị xóa"}
                    </p>
                  </div>
                  <Badge variant={badge.cls as "secondary" | "success" | "danger"}>{badge.label}</Badge>
                  <Switch
                    checked={w.enabled}
                    onCheckedChange={async (v) => {
                      try {
                        await toggleWebhook({ token, guildId: g.discordId, webhookId: w._id });
                        toast.success(v ? "Đã bật webhook" : "Đã tắt webhook");
                      } catch (e: unknown) {
                        toast.error(String(e));
                      }
                    }}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {w.eventTypes.map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">
                      {EVENT_LABELS[t] ?? t}
                    </Badge>
                  ))}
                  {w.color !== null && (
                    <Badge variant="outline" className="text-[10px]">
                      <Palette className="mr-1 h-2.5 w-2.5" style={{ color: numberToHex(w.color) }} />
                      {numberToHex(w.color)}
                    </Badge>
                  )}
                </div>

                {w.lastError && (
                  <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-red-500">
                    ⚠️ {w.lastError}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleTest(w._id)} className="gap-1.5">
                    <Send className="h-3.5 w-3.5" /> Gửi thử
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(isEditing ? null : w._id)}
                    className="gap-1.5"
                  >
                    <Pencil className="h-3.5 w-3.5" /> {isEditing ? "Đóng" : "Chỉnh sửa"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(w._id)}
                    className="gap-1.5 text-red-500 hover:bg-danger/10 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Xóa
                  </Button>
                </div>

                {isEditing && (
                  <div className="space-y-3 rounded-xl border border-border bg-background/50 p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Tên webhook</Label>
                        <input
                          type="text"
                          defaultValue={w.name}
                          id={`wh-name-${w._id}`}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                          maxLength={80}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Kênh nhận log</Label>
                        <select
                          defaultValue={w.channelId}
                          id={`wh-channel-${w._id}`}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        >
                          {channels.map((ch) => (
                            <option key={ch.channelId} value={ch.channelId}>
                              # {ch.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Avatar (URL https)</Label>
                        <input
                          type="url"
                          defaultValue={w.avatarUrl ?? ""}
                          id={`wh-avatar-${w._id}`}
                          placeholder="https://…"
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Màu embed</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            defaultValue={numberToHex(w.color)}
                            id={`wh-color-${w._id}`}
                            className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent"
                          />
                          <input
                            type="text"
                            defaultValue={numberToHex(w.color)}
                            id={`wh-color-text-${w._id}`}
                            className="w-28 rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-sm"
                            maxLength={7}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Nội dung gửi kèm</Label>
                      <input
                        type="text"
                        defaultValue={w.contentTemplate ?? ""}
                        id={`wh-template-${w._id}`}
                        placeholder="📋 {server} lúc {time}"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        maxLength={500}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Nhận loại log</Label>
                      <div className="flex flex-wrap gap-2">
                        {Object.keys(EVENT_LABELS).map((type) => (
                          <label
                            key={type}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background/50 px-2.5 py-1.5 text-xs transition-colors hover:bg-accent"
                          >
                            <input
                              type="checkbox"
                              defaultChecked={w.eventTypes.includes(type)}
                              id={`wh-type-${w._id}-${type}`}
                              className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                            />
                            {EVENT_LABELS[type]}
                          </label>
                        ))}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        const val = (id: string) =>
                          (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null)
                            ?.value ?? "";
                        const nameEl = val(`wh-name-${w._id}`);
                        const channelEl = val(`wh-channel-${w._id}`);
                        const avatarEl = val(`wh-avatar-${w._id}`);
                        const colorEl = val(`wh-color-${w._id}`);
                        const templateEl = val(`wh-template-${w._id}`);
                        const types = Object.keys(EVENT_LABELS).filter(
                          (t) =>
                            (document.getElementById(`wh-type-${w._id}-${t}`) as HTMLInputElement | null)
                              ?.checked,
                        );
                        handleSave(w._id, {
                          name: nameEl.trim() || w.name,
                          channelId: channelEl || w.channelId,
                          avatarUrl: avatarEl.trim() || null,
                          color: hexToNumber(colorEl) ?? null,
                          contentTemplate: templateEl.trim() || null,
                          eventTypes: types.length > 0 ? types : w.eventTypes,
                        });
                      }}
                      className="gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" /> Lưu thay đổi
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Lưu ý */}
      <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
        <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          Webhook do bot tạo bằng quyền <b className="text-foreground">Manage Webhooks</b> — hãy chắc
          chắn bot có quyền này ở kênh bạn chọn. Thay đổi áp dụng trong ~1 phút.
          <span className="ml-1 inline-flex items-center gap-1">
            <Eye className="h-3 w-3" /> Emoji động trong tên webhook chỉ hiển thị động cho người dùng
            có Nitro.
          </span>
        </p>
      </div>
    </div>
  );
}