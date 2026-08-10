import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { BarChart3, Command, Hash, Save, ShieldHalf, Shield } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { MultiSelect } from "../ui/multi-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import type { GuildData } from "../../lib/types";

const TOKEN = () => localStorage.getItem("wio_session_token") ?? "";

export default function SettingsPanel({ data }: { data: GuildData }) {
  const updateSettings = useMutation(api.guilds.updateSettings);

  const [prefix, setPrefix] = useState(data.guild.prefix);
  const [logChannelId, setLogChannelId] = useState(data.guild.logChannelId ?? "none");
  const [modRoles, setModRoles] = useState<string[]>(data.guild.modRoles);
  const [adminRoles, setAdminRoles] = useState<string[]>(data.guild.adminRoles);
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
        logChannelId: logChannelId === "none" ? undefined : logChannelId,
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
              Cảnh báo chống nuke và sự kiện quan trọng sẽ được gửi vào kênh này.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
            <Button className="mt-4 w-full" onClick={handleSave} disabled={saving}>
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
      </div>
    </div>
  );
}
