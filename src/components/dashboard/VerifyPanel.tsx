import { useCallback, useRef, useState, type RefObject } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { BadgeCheck, Eye, Fingerprint, Hash, Mail, Send, ShieldCheck, ShieldOff } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "../ui/card";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import type { GuildData } from "../../lib/types";
import { getSessionToken } from "../../lib/discord";

const TOKEN = () => getSessionToken();

export default function VerifyPanel({ data }: { data: GuildData }) {
  const updateSettings = useMutation(api.guilds.updateSettings);
  const g = data.guild;
  const channels = data.channels.filter((c) => c.type === 0 || c.type === 5);
  const roles = data.roles;

  // Local state for debounced text inputs
  const [localTitle, setLocalTitle] = useState(g.verifyWelcomeTitle ?? "");
  const [localDesc, setLocalDesc] = useState(g.verifyWelcomeDescription ?? "");
  const [localColor, setLocalColor] = useState(g.verifyWelcomeColor ?? "#f2629e");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  /** Chèn placeholder vào vị trí cursor của textarea */
  function insertPlaceholder(
    ref: RefObject<HTMLTextAreaElement | null>,
    setter: React.Dispatch<React.SetStateAction<string>>,
    current: string,
    debounce: (p: Record<string, unknown>) => void,
    basePatch: Record<string, unknown>,
    placeholder: string,
  ) {
    const el = ref.current;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + placeholder + current.slice(end);
    setter(next);
    debounce({ ...basePatch, verifyWelcomeDescription: next || null });
    // Focus + đặt cursor sau placeholder
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.selectionStart = el.selectionEnd = start + placeholder.length;
      }
    });
  }

  const flushDebounced = useCallback(
    (patch: Record<string, unknown>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        try {
          await updateSettings({ token: TOKEN(), guildId: g.discordId, ...patch });
        } catch (e: unknown) {
          toast.error(String(e));
        }
      }, 600);
    },
    [g.discordId, updateSettings],
  );

  async function patch(p: Record<string, unknown>, msg?: string) {
    try {
      await updateSettings({ token: TOKEN(), guildId: g.discordId, ...p });
      if (msg) toast.success(msg);
    } catch (e: unknown) {
      toast.error(String(e));
    }
  }

  // Welcome embed preview
  const previewTitle = localTitle || "🌸 Chào mừng bạn!";
  const previewDesc =
    (localDesc || "Bạn đã xác minh thành công. Chào mừng bạn đến với server!")
      .replace(/\{user\}/g, "@thành viên")
      .replace(/\{server\}/g, g.name || "Server");
  const previewColor = localColor || "#f2629e";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <BadgeCheck className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold">Xác minh thành viên (Verify)</h2>
          <p className="text-xs text-muted-foreground">
            Thành viên mới sẽ nhận role Unverified và phải xác minh trước khi vào server.
          </p>
        </div>
      </div>

      {/* Enable / Disable */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card/50 px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Bật xác minh thành viên</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Khi bật, thành viên mới sẽ nhận role chưa xác minh và cần verify để vào server.
            </p>
          </div>
        </div>
        <Switch
          checked={g.verifyEnabled}
          onCheckedChange={(v) => patch({ verifyEnabled: v }, v ? "Đã bật xác minh thành viên" : "Đã tắt xác minh thành viên")}
        />
      </div>

      {/* Verify Method Selector */}
      {g.verifyEnabled && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card/50 px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <Fingerprint className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">Phương thức xác minh</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <b>Button</b> — thành viên bấm nút để xác minh ngay lập tức.
                <b>Captcha</b> — bot gửi mã qua DM, thành viên nhập mã trong kênh.
              </p>
            </div>
          </div>
          <select
            value={g.verifyMethod}
            onChange={(e) => patch({ verifyMethod: e.target.value as "button" | "captcha" }, "Đã đổi phương thức xác minh")}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="button">🖱️ Button — bấm nút xác minh</option>
            <option value="captcha">🔑 Captcha — nhập mã từ DM</option>
          </select>
        </div>
      )}

      {g.verifyEnabled && (
        <Card>
          <CardContent className="space-y-5 p-5">
            {/* Welcome DM toggle */}
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/50 px-4 py-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Mail className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Gửi DM chào mừng sau khi verify</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Bot gửi embed chào mừng qua DM cho thành viên ngay khi xác minh thành công.
                  </p>
                </div>
              </div>
              <Switch
                checked={g.verifyWelcomeEnabled}
                onCheckedChange={(v) => patch({ verifyWelcomeEnabled: v }, v ? "Đã bật DM chào mừng" : "Đã tắt DM chào mừng")}
              />
            </div>

            {g.verifyWelcomeEnabled && (
              <div className="space-y-4 rounded-xl border border-border bg-background/50 p-4">
                {/* Welcome title */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Tiêu đề embed</Label>
                  <input
                    type="text"
                    value={localTitle}
                    onChange={(e) => {
                      setLocalTitle(e.target.value);
                      flushDebounced({ verifyWelcomeTitle: e.target.value || null });
                    }}
                    placeholder="🌸 Chào mừng bạn!"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    maxLength={256}
                  />
                </div>
                {/* Welcome description */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Nội dung embed</Label>
                  <textarea
                    ref={descRef}
                    value={localDesc}
                    onChange={(e) => {
                      setLocalDesc(e.target.value);
                      flushDebounced({ verifyWelcomeDescription: e.target.value || null });
                    }}
                    placeholder="Bạn đã xác minh thành công. Chào mừng bạn đến với server!"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    rows={3}
                    maxLength={2000}
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">Chèn:</span>
                    {([
                      ["{user}", "Tag thành viên"],
                      ["{server}", "Tên server"],
                    ] as const).map(([ph, label]) => (
                      <button
                        key={ph}
                        type="button"
                        onClick={() => insertPlaceholder(descRef, setLocalDesc, localDesc, flushDebounced, { verifyWelcomeDescription: null }, ph)}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-mono text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                        title={label}
                      >
                        {ph}
                      </button>
                    ))}
                    <span className="text-[10px] text-muted-foreground">— {"{user}"} để tag, {"{server}"} để tên server</span>
                  </div>
                </div>
                {/* Welcome color */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Màu embed</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={localColor}
                      onChange={(e) => {
                        setLocalColor(e.target.value);
                        flushDebounced({ verifyWelcomeColor: e.target.value });
                      }}
                      className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent"
                    />
                    <input
                      type="text"
                      value={localColor}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLocalColor(v);
                        if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                          flushDebounced({ verifyWelcomeColor: v });
                        }
                      }}
                      placeholder="#f2629e"
                      className="w-28 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-mono"
                      maxLength={7}
                    />
                    <span className="text-[10px] text-muted-foreground">để trống = màu mặc định</span>
                  </div>
                </div>

                {/* Welcome embed preview */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs font-medium">
                    <Eye className="h-3 w-3" /> Xem trước DM chào mừng
                  </Label>
                  <div className="overflow-hidden rounded-xl border border-border">
                    <div
                      className="px-4 py-3"
                      style={{ backgroundColor: previewColor + "22", borderLeft: `4px solid ${previewColor}` }}
                    >
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tin nhắn trực tiếp từ Protogon</p>
                    </div>
                    <div className="border-t border-border bg-background/80 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
                          <span className="text-lg">🤖</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">Protogon</p>
                            <Badge variant="secondary" className="text-[9px]">APP</Badge>
                            <span className="text-[10px] text-muted-foreground">Hôm nay lúc 00:00</span>
                          </div>
                          <div className="mt-1 rounded-lg bg-muted/50 p-3">
                            <p className="text-sm font-semibold" style={{ color: previewColor }}>{previewTitle}</p>
                            <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">{previewDesc}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Kênh Verify */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Hash className="h-3.5 w-3.5" /> Kênh xác minh
              </Label>
              <p className="text-xs text-muted-foreground">
                Kênh hiển thị embed xác minh. Thành viên mới chỉ thấy kênh này.
              </p>
              <select
                value={g.verifyChannelId ?? ""}
                onChange={(e) => patch({ verifyChannelId: e.target.value || null }, "Đã cập nhật kênh xác minh")}
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

            {/* Role Unverified */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <ShieldOff className="h-3.5 w-3.5" /> Role chưa xác minh (Unverified)
              </Label>
              <p className="text-xs text-muted-foreground">
                Role gán tự động cho thành viên mới khi vừa vào server.
              </p>
              <select
                value={g.unverifiedRoleId ?? ""}
                onChange={(e) => patch({ unverifiedRoleId: e.target.value || null }, "Đã cập nhật role chưa xác minh")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">— Chọn role —</option>
                {roles.map((r) => (
                  <option key={r.roleId} value={r.roleId}>
                    @{r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Role Verified */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <ShieldCheck className="h-3.5 w-3.5" /> Role đã xác minh (Verified)
              </Label>
              <p className="text-xs text-muted-foreground">
                Role gán cho thành viên sau khi xác minh thành công. Role chưa xác minh sẽ bị gỡ.
              </p>
              <select
                value={g.verifiedRoleId ?? ""}
                onChange={(e) => patch({ verifiedRoleId: e.target.value || null }, "Đã cập nhật role đã xác minh")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">— Chọn role —</option>
                {roles.map((r) => (
                  <option key={r.roleId} value={r.roleId}>
                    @{r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Config summary */}
            <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Cách hoạt động:</p>
              <p>• Thành viên mới vào server → tự động nhận <b>role chưa xác minh</b>.</p>
              <p>• Bot gửi embed trong <b>kênh xác minh</b> với nút / phản ứng để xác minh.</p>
              <p>• Sau khi xác minh → gỡ role chưa xác minh, gán <b>role đã xác minh</b>.</p>
              {g.verifyWelcomeEnabled && (
                <p>• Bot gửi <b>DM chào mừng</b> với embed tùy chỉnh đến thành viên đã xác minh.</p>
              )}
            </div>

            {/* Send panel button */}
            {g.verifyChannelId && (
              <button
                onClick={() => patch({ verifySendPanel: true }, "Đã yêu cầu bot gửi panel xác minh!")}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Send className="h-4 w-4" />
                Gửi panel xác minh vào kênh
              </button>
            )}

            {/* Current config badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant={g.verifyChannelId ? "default" : "secondary"}>
                <Hash className="mr-1 h-3 w-3" />
                {g.verifyChannelId
                  ? `#${data.channels.find((c) => c.channelId === g.verifyChannelId)?.name ?? "?"}`
                  : "Chưa chọn kênh"}
              </Badge>
              <Badge variant={g.unverifiedRoleId ? "default" : "secondary"}>
                <ShieldOff className="mr-1 h-3 w-3" />
                {g.unverifiedRoleId
                  ? `@${data.roles.find((r) => r.roleId === g.unverifiedRoleId)?.name ?? "?"}`
                  : "Chưa chọn role"}
              </Badge>
              <Badge variant={g.verifiedRoleId ? "default" : "secondary"}>
                <ShieldCheck className="mr-1 h-3 w-3" />
                {g.verifiedRoleId
                  ? `@${data.roles.find((r) => r.roleId === g.verifiedRoleId)?.name ?? "?"}`
                  : "Chưa chọn role"}
              </Badge>
              {g.verifyWelcomeEnabled && (
                <Badge variant="success">
                  <Mail className="mr-1 h-3 w-3" />
                  DM chào mừng bật
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Slash / prefix command info */}
      <div className="rounded-xl bg-muted/50 p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">💡 Lệnh nhanh:</p>
        <p>
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">/verify setup</code>{" "}
          hoặc{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">!verify setup</code>{" "}
          — thiết lập xác minh bằng lệnh Discord.
        </p>
      </div>
    </div>
  );
}
