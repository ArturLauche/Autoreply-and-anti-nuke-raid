import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { BarChart3, Command, Hash, KeyRound, Palette, Save, ShieldHalf, Shield, Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { MultiSelect } from "../ui/multi-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
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
  const [autoModLogChannelId, setAutoModLogChannelId] = useState(
    data.guild.autoModLogChannelId ?? "none",
  );
  const [modRoles, setModRoles] = useState<string[]>(data.guild.modRoles);
  const [adminRoles, setAdminRoles] = useState<string[]>(data.guild.adminRoles);
  const [theme, setTheme] = useState(data.guild.theme || DEFAULT_THEME);
  const [themeSaving, setThemeSaving] = useState(false);
  const [saving, setSaving] = useState(false);

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
        autoModLogChannelId: autoModLogChannelId === "none" ? "" : autoModLogChannelId,
        modRoles,
        adminRoles,
      });
      toast.success("Đã lưu cài đặt — bot áp dụng trong vòng 30 giây");
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
          Prefix, kênh log và phân quyền mod/admin
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Command className="h-4 w-4 text-primary" /> Prefix lệnh
            </CardTitle>
            <CardDescription>
              Dùng cho lệnh text, ví dụ <code className="font-mono text-xs">!help</code>. Slash command hoạt động độc lập.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <div className="grid flex-1 gap-1.5">
                <Label>Prefix</Label>
                <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} maxLength={3} />
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Đang lưu…" : "Lưu"}
              </Button>
            </div>
            <p className="mt-3 rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
              Lệnh hiện có: <code className="font-mono text-primary">{prefix}help</code>,{" "}
              <code className="font-mono text-primary">{prefix}ping</code>,{" "}
              <code className="font-mono text-primary">{prefix}prefix</code>,{" "}
              <code className="font-mono text-primary">{prefix}autoreply</code>,{" "}
              <code className="font-mono text-primary">{prefix}antinuke</code>,{" "}
              <code className="font-mono text-primary">{prefix}setlog</code>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Hash className="h-4 w-4 text-primary" /> Kênh log
            </CardTitle>
            <CardDescription>
              Cảnh báo chống nuke, báo cáo hàng ngày và sự kiện quan trọng sẽ được gửi
              vào kênh log chung dưới đây.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Kênh log chung</Label>
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
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Kênh log hành động mod thủ công (ban · timeout · kick · warn · gỡ hình phạt · purge)
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
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Kênh log auto-mod nội dung (từ ngữ xấu · link mời · link độc hại · spam · mention · ảnh/file)
              </Label>
              <Select value={autoModLogChannelId} onValueChange={setAutoModLogChannelId}>
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
            </div>
            <p className="text-xs text-muted-foreground">
              Nếu chưa chọn kênh riêng, log auto-mod và log hành động mod sẽ gửi vào kênh log
              chung. Chống nuke/raid luôn gửi vào kênh log chung.
            </p>
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" /> Lưu thay đổi
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" /> Báo cáo chống nuke hàng ngày
            </CardTitle>
            <CardDescription>
              Bot gửi bản tóm tắt sự kiện chống nuke vào kênh log ~00:00 UTC mỗi ngày
              (cần đặt kênh log phía trên).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="text-sm">
              {data.guild.dailyReportEnabled ? (
                <span className="text-emerald-400">Đang bật — báo cáo được gửi tự động.</span>
              ) : (
                <span className="text-muted-foreground">Đang tắt.</span>
              )}
            </div>
            <Switch
              checked={data.guild.dailyReportEnabled}
              onCheckedChange={toggleDailyReport}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldHalf className="h-4 w-4 text-primary" /> Role Mod
            </CardTitle>
            <CardDescription>
              Mod được miễn trừ khỏi chống nuke và có thể quản lý rule auto reply trong Discord.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MultiSelect
              options={roleOptions}
              value={modRoles}
              onChange={setModRoles}
              placeholder="Chọn role mod…"
              emptyLabel="Chưa có role được đồng bộ"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-primary" /> Role Admin
            </CardTitle>
            <CardDescription>
              Admin được miễn trừ hoàn toàn khỏi mọi module chống nuke.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MultiSelect
              options={roleOptions}
              value={adminRoles}
              onChange={setAdminRoles}
              placeholder="Chọn role admin…"
              emptyLabel="Chưa có role được đồng bộ"
            />
            <Button className="mt-4 w-full" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" /> Lưu thay đổi
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary/25">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-primary" /> Mật khẩu tính năng ẩn 🔒
            </CardTitle>
            <CardDescription>
              Đặt mật khẩu để mở khóa các tính năng dành riêng cho admin: reaction role,
              giveaway, gửi DM trực tiếp, auto reply và tùy chỉnh giao diện. Chỉ <b>admin sở
              hữu bot</b> được phép đặt mật khẩu này.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!data.guild.isBotOwner && (
              <p className="rounded-lg bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700">
                🔒 Bạn không phải admin sở hữu bot — không được phép tương tác mật khẩu tính
                năng ẩn. Chỉ chủ sở hữu bot (tài khoản Discord đã tạo bot) mới được đặt / đổi
                / xóa mật khẩu này.
              </p>
            )}
            <div className={data.guild.isBotOwner ? "space-y-3" : "pointer-events-none opacity-50"}>
            <div className="grid flex-1 gap-1.5">
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
            <div className="flex flex-wrap gap-2">
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
                <KeyRound className="h-4 w-4" /> {data.guild.hiddenPasswordSet ? "Đổi mật khẩu" : "Đặt mật khẩu"}
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
            </div>
            <p className="text-xs text-muted-foreground">
              Trạng thái:{" "}
              {data.guild.hiddenPasswordSet ? (
                <span className="font-medium text-emerald-400">Đã đặt mật khẩu</span>
              ) : (
                <span className="font-medium text-amber-400">Chưa đặt mật khẩu</span>
              )}
            </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-4 w-4 text-primary" /> Chủ đề màu của server 🎨
            </CardTitle>
            <CardDescription>
              Mỗi server chọn một màu riêng — áp dụng cho toàn bộ trang quản lý server này
              (nút bấm, thẻ, thanh sidebar) ngay lập tức.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2">
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
                    await updateSettings({ token: TOKEN(), guildId: data.guild.discordId, theme });
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
      </div>
    </div>
  );
}
