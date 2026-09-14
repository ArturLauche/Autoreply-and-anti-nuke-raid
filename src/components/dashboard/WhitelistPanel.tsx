import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Plus, Save, ShieldCheck, Trash2, UserCheck, Users } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { MultiSelect } from "../ui/multi-select";
import type { GuildData } from "../../lib/types";
import { getSessionToken } from "../../lib/discord";

const TOKEN = () => getSessionToken();

/**
 * Whitelist của RIÊNG server này — chọn người dùng (ID Discord) hoặc role để được
 * MIỄN TRỪ khỏi moderation (spam, từ xấu, link…), anti-raid và anti-nuke.
 * Danh sách chỉ có tác dụng tại server đang quản lý (local), không chia sẻ sang
 * server khác dùng chung bot.
 */
export default function WhitelistPanel({ data }: { data: GuildData }) {
  const updateSettings = useMutation(api.guilds.updateSettings);
  const [whitelistRoles, setWhitelistRoles] = useState<string[]>(data.guild.whitelistRoles);
  const [whitelistUsers, setWhitelistUsers] = useState<string[]>(data.guild.whitelistUsers);
  const [userInput, setUserInput] = useState("");
  const [saving, setSaving] = useState(false);

  const roleOptions = data.roles
    .filter((r) => r.name !== "@everyone")
    .map((r) => ({ value: r.roleId, label: r.name }));

  function addUserIds(raw: string) {
    const ids = raw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter((s) => /^\d{15,20}$/.test(s));
    if (ids.length === 0) {
      toast.error(
        "Nhập ID Discord hợp lệ (15–20 chữ số), cách nhau bởi dấu phẩy hoặc khoảng trắng.",
      );
      return;
    }
    setWhitelistUsers((prev) => [...new Set([...prev, ...ids])].slice(0, 100));
    setUserInput("");
    toast.success(`Đã thêm ${ids.length} ID — bấm Lưu để áp dụng`);
  }

  function removeUser(id: string) {
    setWhitelistUsers((prev) => prev.filter((x) => x !== id));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateSettings({
        token: TOKEN(),
        guildId: data.guild.discordId,
        whitelistUsers,
        whitelistRoles,
      });
      toast.success("Đã lưu whitelist — bot áp dụng trong vòng ~3 phút");
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
          <h2 className="font-display text-lg font-semibold">Whitelist của server này</h2>
          <p className="text-sm text-muted-foreground">
            Người dùng / role trong danh sách này sẽ <b className="text-foreground">không bị</b>{" "}
            moderation, anti-raid và anti-nuke xử lý —{" "}
            <b className="text-foreground">chỉ áp dụng cho {data.guild.name}</b>. Mỗi server dùng
            bot có danh sách whitelist riêng (local), không chia sẻ giữa các server.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? "Đang lưu…" : "Lưu whitelist"}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" /> Role được miễn trừ
            </CardTitle>
            <CardDescription>
              Thành viên sở hữu role này được bỏ qua toàn bộ kiểm tra moderation, anti-raid và
              anti-nuke của <b className="text-foreground">server này</b> (kể cả raid/nuke phát hiện
              qua AI). Role ở server khác không ảnh hưởng.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MultiSelect
              options={roleOptions}
              value={whitelistRoles}
              onChange={setWhitelistRoles}
              placeholder="Chọn role miễn trừ…"
              emptyLabel="Chưa có role được đồng bộ"
              searchPlaceholder="Gõ tên role để tìm nhanh…"
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Role Mod / Admin đã cấu hình trong Cài đặt vẫn hoạt động riêng — danh sách này dành
              cho role tùy chỉnh (ví dụ: VIP, YouTuber, Staff…).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="h-4 w-4 text-primary" /> Người dùng được miễn trừ
            </CardTitle>
            <CardDescription>
              Nhập <b>ID Discord</b> của người dùng (bật Chế độ nhà phát triển trong Discord → chuột
              phải tên người dùng → Sao chép ID người dùng) để họ không bị hệ thống xử lý{" "}
              <b className="text-foreground">tại server này</b>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="ID Discord, VD: 123456789012345678 (cách nhau phẩy / space)"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addUserIds(userInput);
                }}
              />
              <Button variant="outline" onClick={() => addUserIds(userInput)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {whitelistUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Chưa có người dùng nào — thêm ID phía trên để miễn trừ.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {whitelistUsers.map((id) => (
                  <span
                    key={id}
                    className="group flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-xs text-primary transition-colors hover:bg-primary/20"
                  >
                    {id}
                    <button
                      onClick={() => removeUser(id)}
                      className="text-primary/60 transition-colors hover:text-danger"
                      aria-label={`Xóa ${id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {whitelistUsers.length}/100 người dùng · {whitelistRoles.length}/100 role
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-transparent to-sky-500/5">
        <CardContent className="flex items-start gap-3 p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Nguyên tắc ưu tiên</p>
            <p className="mt-1">
              Danh sách áp dụng cho{" "}
              <b className="text-foreground">toàn bộ module của server {data.guild.name}</b>: spam,
              từ ngữ xấu, link mời, link độc hại, file nguy hiểm, raid thành viên, ban/kick hàng
              loạt, tạo/xóa kênh &amp; role hàng loạt, webhook/thread hàng loạt… Người dùng/role
              trong danh sách được bỏ qua hoàn toàn — không cộng nhiệt, không xóa tin, không ban.
              Danh sách này <b className="text-foreground">không ảnh hưởng đến các server khác</b>{" "}
              đang dùng bot.
            </p>
            <p className="mt-1">
              Lưu ý: whitelist không miễn trừ Join Gate (chống selfbot khi vào server) — tính năng
              đó có danh sách trắng riêng trong mục Join Gate.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
