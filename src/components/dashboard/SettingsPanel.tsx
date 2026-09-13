import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  BarChart3,
  BellRing,
  Command,
  Hash,
  KeyRound,
  Palette,
  Save,
  Shield,
  ShieldHalf,
  Siren,
  Trash2,
  Users,
  Webhook,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { MultiSelect } from "../ui/multi-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { DEFAULT_THEME, SERVER_THEMES } from "../../lib/constants";
import type { GuildData } from "../../lib/types";
import { getSessionToken } from "../../lib/discord";

const TOKEN = () => getSessionToken();

export default function SettingsPanel({ data }: { data: GuildData }) {
  const updateSettings = useMutation(api.guilds.updateSettings);
  const setHiddenPassword = useMutation(api.hidden.setHiddenPassword);
  const [hiddenPassword, setHiddenPasswordInput] = useState("");
  const [hiddenSaving, setHiddenSaving] = useState(false);

  const [prefix, setPrefix] = useState(data.guild.prefix);
  const [logChannelId, setLogChannelId] = useState(data.guild.logChannelId ?? "none");
  const [modLogChannelId, setModLogChannelId] = useState(data.guild.modLogChannelId ?? "none");
  const [modRoles, setModRoles] = useState<string[]>(data.guild.modRoles);
  const [adminRoles, setAdminRoles] = useState<string[]>(data.guild.adminRoles);
  const [theme, setTheme] = useState(data.guild.theme || DEFAULT_THEME);
  const [themeSaving, setThemeSaving] = useState(false);
  const [saving, setSaving] = useState(false);

  // Webhook config
  const webhookData = useQuery(api.webhooks.getGuildWebhooks, {
    token: TOKEN(),
    guildId: data.guild.discordId,
  });
  const updateDefaultWebhook = useMutation(api.webhooks.updateDefaultWebhook);
  const [webhookEventTypes, setWebhookEventTypes] = useState<string[]>([
    "antinuke", "mod", "join", "leave", "general",
  ]);
  const [webhookColor, setWebhookColor] = useState<string>("");
  const [webhookTemplate, setWebhookTemplate] = useState<string>("");
  const [webhookSaving, setWebhookSaving] = useState(false);

  const textChannels = data.channels.filter((c) => c.type === 0 || c.type === 5);
  const roleOptions = data.roles
    .filter((r) => r.name !== "@everyone")
    .map((r) => ({ value: r.roleId, label: r.name }));

  async function toggleDailyReport(v: boolean) {
    try {
      await updateSettings({
        token: TOKEN(),
        guildId: data.guild.discordId,
        dailyReportEnabled: v,
      });
      toast.success(v ? "Đã bật báo cáo hàng ngày" : "Đã tắt báo cáo hàng ngày");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lưu thất bại");
    }
  }

  async function toggleEmergencyAlert(v: boolean) {
    try {
      await updateSettings({
        token: TOKEN(),
        guildId: data.guild.discordId,
        emergencyAlertEnabled: v,
      });
      toast.success(v ? "Đã bật cảnh báo khẩn" : "Đã tắt cảnh báo khẩn");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lưu thất bại");
    }
  }

  async function togglePingEveryone(v: boolean) {
    try {
      await updateSettings({
        token: TOKEN(),
        guildId: data.guild.discordId,
        logPingEveryone: v,
      });
      toast.success(v ? "Đã bật ping @everyone" : "Đã tắt ping @everyone");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lưu thất bại");
    }
  }

  async function handleSave() {
    if (!/^[!^$#&%]{1,3}$/.test(prefix)) {
      return toast.error("Prefix phải là 1-3 ký tự đặc biệt, ví dụ: !, ^, !!");
    }
    setSaving(true);
    try {
      await updateSettings({
        token: TOKEN(),
        guildId: data.guild.discordId,
        prefix,
        // "" (chuỗi rỗng) để XÓA kênh đã đặt; undefined = không đổi.
        logChannelId: logChannelId === "none" ? "" : logChannelId,
        modLogChannelId: modLogChannelId === "none" ? "" : modLogChannelId,
        modRoles,
        adminRoles,
      });
      toast.success("Đã lưu cài đặt — bot áp dụng trong vòng ~3 phút");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Cài đặt server</h2>
        <p className="text-sm text-muted-foreground">
          Prefix · kênh log · phân quyền · bảo mật · giao diện
        </p>
      </div>

      <Tabs defaultValue="basic">
        <TabsList className="w-full justify-start overflow-x-auto lg:w-auto">
          <TabsTrigger value="basic">
            <Command className="h-4 w-4" /> Cơ bản
          </TabsTrigger>
          <TabsTrigger value="roles">
            <Users className="h-4 w-4" /> Phân quyền
          </TabsTrigger>
          <TabsTrigger value="security">
            <KeyRound className="h-4 w-4" /> Bảo mật
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className="h-4 w-4" /> Giao diện
          </TabsTrigger>
        </TabsList>

        {/* ── Cơ bản: prefix + kênh log + báo cáo ─────────────────────── */}
        <TabsContent value="basic">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Prefix lệnh</Label>
                  <Input
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    maxLength={3}
                    placeholder="!"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    1–3 ký tự đặc biệt — lệnh text như{" "}
                    <code className="font-mono text-primary">{prefix}help</code>. Slash command
                    hoạt động độc lập.
                  </p>
                </div>

                <div className="grid gap-1.5">
                  <Label>Kênh log chung</Label>
                  <Select value={logChannelId} onValueChange={setLogChannelId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn kênh" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Không dùng —</SelectItem>
                      {textChannels.map((c) => (
                        <SelectItem key={c.channelId} value={c.channelId}>
                          #{c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Chống nuke/raid, báo cáo hàng ngày và sự kiện quan trọng gửi vào đây.
                  </p>
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label>
                  <Hash className="mr-1 inline h-3.5 w-3.5" />
                  Kênh log hành động mod (auto-mod + lệnh thủ công, kiểu Carl-bot)
                </Label>
                <Select value={modLogChannelId} onValueChange={setModLogChannelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn kênh" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Dùng kênh log chung —</SelectItem>
                    {textChannels.map((c) => (
                      <SelectItem key={c.channelId} value={c.channelId}>
                        #{c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Embed moderation hiển thị <b>Offender</b> / <b>Reason</b> /{" "}
                  <b>Responsible moderator</b>. Lý do trống → ghi "không có lý do".
                </p>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">
                    <BarChart3 className="mr-1.5 inline h-4 w-4 text-primary" />
                    Báo cáo chống nuke hàng ngày
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Tóm tắt sự kiện chống nuke gửi vào kênh log lúc ~00:00 UTC mỗi ngày
                  </p>
                </div>
                <Switch
                  checked={data.guild.dailyReportEnabled}
                  onCheckedChange={toggleDailyReport}
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">
                    <Siren className="mr-1.5 inline h-4 w-4 text-red-500" />
                    Cảnh báo khẩn khi raid/nuke
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Khi bot xác nhận raid/nuke: AI quét chat rồi gửi tin CẢNH BÁO KHẨN
                    (kèm báo cáo tình hình, lệnh <code className="font-mono">/report</code>) vào kênh log chung
                  </p>
                </div>
                <Switch
                  checked={data.guild.emergencyAlertEnabled}
                  onCheckedChange={toggleEmergencyAlert}
                />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">
                    <BellRing className="mr-1.5 inline h-4 w-4 text-amber-500" />
                    Ping @everyone khi cảnh báo khẩn
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Tắt nếu không muốn cảnh báo làm phiền toàn bộ thành viên (mod vẫn thấy log)
                  </p>
                </div>
                <Switch
                  checked={data.guild.logPingEveryone}
                  onCheckedChange={togglePingEveryone}
                />
              </div>

              {/* ── Webhook Log Config ─────────────────────────────── */}
              {webhookData && webhookData.length > 0 && (
                <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Webhook className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium">Tùy chỉnh Webhook Log</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Webhook "{webhookData[0]?.name}" tự gửi log khi có sự kiện. Tùy chỉnh loại sự kiện, màu embed và nội dung kèm.
                  </p>
                  <div className="grid gap-1.5">
                    <Label>Loại sự kiện nhận log</Label>
                    <div className="flex flex-wrap gap-2">
                      {["antinuke", "mod", "join", "leave", "general", "all"].map((et) => (
                        <button
                          key={et}
                          type="button"
                          onClick={() => {
                            setWebhookEventTypes((prev) =>
                              prev.includes(et) ? prev.filter((e) => e !== et) : [...prev, et]
                            );
                          }}
                          className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                            webhookEventTypes.includes(et)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground border-border hover:border-primary/50"
                          }`}
                        >
                          {et === "antinuke" ? "🛡️ Chống nuke" : et === "mod" ? "⚙️ Moderation" : et === "join" ? "📥 Vào server" : et === "leave" ? "📤 Rời server" : et === "general" ? "📋 Chung" : "🌐 Tất cả"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label>Màu embed (hex, để trống = mặc định)</Label>
                      <Input
                        type="color"
                        value={webhookColor || "#5865F2"}
                        onChange={(e) => setWebhookColor(e.target.value)}
                        className="h-9 w-16 cursor-pointer"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Nội dung kèm (template)</Label>
                      <Input
                        value={webhookTemplate}
                        onChange={(e) => setWebhookTemplate(e.target.value)}
                        placeholder="{server} · {action} · {time}"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Placeholder: {'{server}'} {'{time}'} {'{action}'} {'{reason}'} {'{user}'} {'{mod}'}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setWebhookSaving(true);
                        try {
                          const parsedColor = webhookColor ? parseInt(webhookColor.replace("#", ""), 16) : null;
                          await updateDefaultWebhook({
                            token: TOKEN(),
                            guildId: data.guild.discordId,
                            eventTypes: webhookEventTypes,
                            color: parsedColor,
                            contentTemplate: webhookTemplate || null,
                          });
                          toast.success("Đã lưu webhook log");
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Lỗi lưu webhook");
                        } finally {
                          setWebhookSaving(false);
                        }
                      }}
                      disabled={webhookSaving}
                    >
                      {webhookSaving ? "Đang lưu…" : "Lưu webhook"}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4" /> {saving ? "Đang lưu…" : "Lưu cài đặt"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Phân quyền: role mod + admin ─────────────────────────────── */}
        <TabsContent value="roles">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="flex items-center gap-1.5">
                    <ShieldHalf className="h-4 w-4 text-primary" /> Role Mod
                  </Label>
                  <MultiSelect
                    options={roleOptions}
                    value={modRoles}
                    onChange={setModRoles}
                    placeholder="Chọn role mod…"
                    emptyLabel="Chưa có role được đồng bộ"
                    searchPlaceholder="Gõ tên role để tìm nhanh…"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Miễn trừ chống nuke và quản lý rule auto reply trong Discord.
                  </p>
                </div>
                <div className="grid gap-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-primary" /> Role Admin
                  </Label>
                  <MultiSelect
                    options={roleOptions}
                    value={adminRoles}
                    onChange={setAdminRoles}
                    placeholder="Chọn role admin…"
                    emptyLabel="Chưa có role được đồng bộ"
                    searchPlaceholder="Gõ tên role để tìm nhanh…"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Miễn trừ hoàn toàn khỏi mọi module chống nuke.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4" /> {saving ? "Đang lưu…" : "Lưu phân quyền"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Bảo mật: mật khẩu tính năng ẩn ───────────────────────────── */}
        <TabsContent value="security">
          <Card>
            <CardContent className="space-y-3 p-5">
              <div>
                <p className="flex items-center gap-1.5 font-medium">
                  <KeyRound className="h-4 w-4 text-primary" /> Mật khẩu tính năng ẩn 🔒
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Dùng để mở khóa khu vực riêng tư dành cho chủ sở hữu bot — nội dung bên trong
                  không tiết lộ công khai. Chỉ <b>admin sở hữu bot</b> được đặt.
                </p>
              </div>

              {!data.guild.isBotOwner && (
                <p className="rounded-lg bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700">
                  🔒 Bạn không phải admin sở hữu bot — chỉ chủ sở hữu bot mới được đặt / đổi /
                  xóa mật khẩu này.
                </p>
              )}

              <div className={data.guild.isBotOwner ? "space-y-3" : "pointer-events-none opacity-50"}>
                <div className="grid gap-1.5">
                  <Label>Mật khẩu mới</Label>
                  <Input
                    type="password"
                    value={hiddenPassword}
                    onChange={(e) => setHiddenPasswordInput(e.target.value)}
                    placeholder={
                      data.guild.hiddenPasswordSet
                        ? "Nhập mật khẩu mới để thay đổi…"
                        : "Nhập mật khẩu (4–64 ký tự)…"
                    }
                    maxLength={64}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    disabled={hiddenSaving || hiddenPassword.length < 4}
                    onClick={async () => {
                      setHiddenSaving(true);
                      try {
                        await setHiddenPassword({
                          token: TOKEN(),
                          guildId: data.guild.discordId,
                          password: hiddenPassword,
                        });
                        toast.success("Đã đặt mật khẩu tính năng ẩn");
                        setHiddenPasswordInput("");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Lưu thất bại");
                      } finally {
                        setHiddenSaving(false);
                      }
                    }}
                  >
                    <KeyRound className="h-4 w-4" />
                    {data.guild.hiddenPasswordSet ? "Đổi mật khẩu" : "Đặt mật khẩu"}
                  </Button>
                  {data.guild.hiddenPasswordSet && (
                    <Button
                      variant="outline"
                      disabled={hiddenSaving}
                      onClick={async () => {
                        setHiddenSaving(true);
                        try {
                          await setHiddenPassword({
                            token: TOKEN(),
                            guildId: data.guild.discordId,
                            password: "",
                          });
                          toast.success("Đã xóa mật khẩu tính năng ẩn");
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Xóa thất bại");
                        } finally {
                          setHiddenSaving(false);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" /> Xóa mật khẩu
                    </Button>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Trạng thái:{" "}
                    {data.guild.hiddenPasswordSet ? (
                      <span className="font-medium text-emerald-400">Đã đặt mật khẩu</span>
                    ) : (
                      <span className="font-medium text-amber-400">Chưa đặt mật khẩu</span>
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Giao diện: chủ đề màu server ─────────────────────────────── */}
        <TabsContent value="appearance">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm font-medium">Chủ đề màu của server 🎨</p>
              <p className="mb-3 text-[11px] text-muted-foreground">
                Áp dụng cho toàn bộ trang quản lý server này (nút, thẻ, sidebar) ngay lập tức.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.entries(SERVER_THEMES).map(([key, t]) => (
                  <button
                    key={key}
                    onClick={() => setTheme(key)}
                    className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all ${
                      theme === key
                        ? "border-primary ring-2 ring-primary/40"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span
                      className="h-8 w-full rounded-lg"
                      style={{ background: `linear-gradient(135deg, ${t.swatch}, ${t.swatch2})` }}
                    />
                    <span className="text-xs font-medium">{t.label}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  Đang chọn:{" "}
                  <span className="font-medium text-foreground">
                    {SERVER_THEMES[theme]?.label ?? "—"}
                  </span>{" "}
                  — {SERVER_THEMES[theme]?.desc}
                </p>
                <Button
                  size="sm"
                  disabled={themeSaving || theme === (data.guild.theme || DEFAULT_THEME)}
                  onClick={async () => {
                    setThemeSaving(true);
                    try {
                      await updateSettings({
                        token: TOKEN(),
                        guildId: data.guild.discordId,
                        theme,
                      });
                      toast.success("Đã áp dụng chủ đề màu mới 🎨");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Lưu thất bại");
                    } finally {
                      setThemeSaving(false);
                    }
                  }}
                >
                  <Palette className="h-4 w-4" /> {themeSaving ? "Đang lưu…" : "Áp dụng"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
