import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { DoorClosed, IdCard, Mail, Save, Shuffle, UserPlus, UserMinus } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "../ui/card";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import type { GuildData } from "../../lib/types";
import { getSessionToken } from "../../lib/discord";

import { translate } from "../../lib/i18n";
const TOKEN = () => getSessionToken();

/**
 * WelcomePanel v2 — chào thành viên mới + tạm biệt thành viên rời server.
 * Nâng cấp học từ Carl-bot/Welcomer/ProBot:
 *   - Template ngẫu nhiên: nhiều dòng (mỗi dòng 1 câu), bot chọn ngẫu nhiên mỗi lượt.
 *   - Embed tùy chỉnh: tiêu đề, màu #hex, ảnh banner, thumbnail.
 *   - Welcome DM: tin nhắn chào riêng qua DM thành viên mới.
 *   - Autorole: tự cấp role khi vào server (trễ 0-120s, tùy chọn cấp cả bot).
 * Placeholder: {user} {username} {server} {count} {created} {boost}.
 */

type Kind = "welcome" | "goodbye";

const PLACEHOLDER_BADGE = "{user} {username} {server} {count} {created} {boost}";

/** Xem trước nội dung với giá trị mẫu. */
function previewOf(template: string, kind: Kind, guildName: string, memberCount: number) {
  const sample =
    kind === "welcome"
      ? translate("Chào mừng {user} đã đến {server}! Bạn là thành viên thứ {count} 🎉")
      : translate("{user} đã rời {server}. Hẹn gặp lại!");
  return (template.trim() || sample)
    .replaceAll("{user}", "@ThànhViênMới")
    .replaceAll("{username}", translate("ThànhViênMới"))
    .replaceAll("{server}", guildName)
    .replaceAll("{count}", String(memberCount ?? 0))
    .replaceAll("{created}", "365")
    .replaceAll("{boost}", "7");
}

/** Card cấu hình welcome/goodbye: kênh, template ngẫu nhiên, embed tùy chỉnh. */
function GreetingCard({
  kind,
  data,
  onSave,
}: {
  kind: Kind;
  data: GuildData;
  onSave: (patch: Record<string, unknown>, msg: string) => Promise<void>;
}) {
  const g = data.guild;
  const isWelcome = kind === "welcome";
  const enabled = isWelcome ? g.welcomeEnabled : g.goodbyeEnabled;
  const channelId = isWelcome ? g.welcomeChannelId : g.goodbyeChannelId;
  const message = isWelcome ? g.welcomeMessage : g.goodbyeMessage;
  const useEmbed = isWelcome ? g.welcomeUseEmbed : g.goodbyeUseEmbed;
  const random = isWelcome ? g.welcomeRandom : g.goodbyeRandom;
  const embedTitle = isWelcome ? g.welcomeEmbedTitle : g.goodbyeEmbedTitle;
  const embedColor = isWelcome ? g.welcomeEmbedColor : g.goodbyeEmbedColor;
  const embedImage = isWelcome ? g.welcomeEmbedImage : g.goodbyeEmbedImage;
  const embedThumbnail = isWelcome ? g.welcomeEmbedThumbnail : g.goodbyeEmbedThumbnail;

  const [channel, setChannel] = useState(channelId ?? "none");
  const [msg, setMsg] = useState(message ?? "");
  const [randomMsg, setRandomMsg] = useState(random ?? "");
  const [title, setTitle] = useState(embedTitle ?? "");
  const [color, setColor] = useState(embedColor ?? "#57f287");
  const [image, setImage] = useState(embedImage ?? "");
  const [thumb, setThumb] = useState(embedThumbnail ?? "");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused) return;
    setChannel(channelId ?? "none");
    setMsg(message ?? "");
    setRandomMsg(random ?? "");
    setTitle(embedTitle ?? "");
    setColor(embedColor ?? "#57f287");
    setImage(embedImage ?? "");
    setThumb(embedThumbnail ?? "");
  }, [channelId, message, random, embedTitle, embedColor, embedImage, embedThumbnail, focused]);

  const textChannels = data.channels.filter((c) => c.type === 0 || c.type === 5);

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {isWelcome ? <UserPlus className="h-4 w-4" /> : <UserMinus className="h-4 w-4" />}
            </span>
            <div>
              <h3 className="font-display text-sm font-bold">
                {isWelcome
                  ? translate("Chào thành viên mới")
                  : translate("Tạm biệt thành viên rời server")}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {isWelcome
                  ? translate("Gửi lời chào vào kênh bạn chọn mỗi khi có thành viên tham gia")
                  : translate("Gửi lời tạm biệt khi có thành viên rời server")}
              </p>
            </div>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => {
              // Bật mà chưa có kênh gửi = bot im lặng mãi (không có chỗ nào để gửi).
              // Chặn ngay tại đây kèm lý do rõ ràng thay vì lưu xong để người dùng
              // tưởng tính năng hỏng.
              if (v && channel === "none") {
                toast.error(translate("Chọn kênh gửi trước khi bật tính năng này."));
                return;
              }
              void onSave({ [`${kind}Enabled`]: v }, translate(v ? "Đã bật" : "Đã tắt"));
            }}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">{translate("Kênh gửi")}</Label>
          <Select
            value={channel}
            onValueChange={(v) => {
              setChannel(v);
              // Lưu NGAY khi chọn kênh: nếu chỉ giữ ở state rồi bật công tắc trước khi
              // bấm "Lưu cài đặt", cấu hình sẽ là "đang bật + chưa có kênh" → bot
              // không gửi gì và người dùng không hiểu vì sao.
              void onSave(
                { [`${kind}ChannelId`]: v === "none" ? "" : v },
                translate("Đã lưu kênh gửi"),
              );
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={translate("Chọn kênh")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{translate("— Không dùng —")}</SelectItem>
              {textChannels.map((c) => (
                <SelectItem key={c.channelId} value={c.channelId}>
                  #{c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Nội dung gốc v1 — giữ tương thích; template ngẫu nhiên nếu có sẽ thắng. */}
        <div className="space-y-2">
          <Label className="text-xs">
            {translate("Nội dung")}{" "}
            <Badge variant="secondary" className="ml-1">
              {PLACEHOLDER_BADGE}
            </Badge>
          </Label>
          <Textarea
            rows={3}
            value={msg}
            placeholder={
              isWelcome
                ? translate("Chào mừng {user} đã đến {server}! Bạn là thành viên thứ {count} 🎉")
                : translate("{user} đã rời {server}. Hẹn gặp lại!")
            }
            onFocus={() => setFocused(true)}
            onChange={(e) => setMsg(e.target.value)}
            onBlur={() => setFocused(false)}
          />
          <p className="text-[11px] text-muted-foreground">
            {translate("Xem trước:")} {previewOf(msg, kind, g.name, g.memberCount ?? 0)}
          </p>
        </div>

        {/* Template ngẫu nhiên (Carl-bot style): mỗi dòng 1 câu, bot chọn random. */}
        <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
          <div className="flex items-center gap-2">
            <Shuffle className="h-4 w-4 text-primary" />
            <p className="text-xs font-medium">{translate("Template ngẫu nhiên")}</p>
            <Badge variant="secondary">
              {translate("{n} câu", { n: randomMsg.split("\n").filter((l) => l.trim()).length })}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {translate(
              "Mỗi dòng là một câu — bot chọn ngẫu nhiên mỗi lượt vào/rời server để tin nhắn không bị nhàm. Điền vào đây thì phần này thay cho nội dung ở trên.",
            )}
          </p>
          <Textarea
            rows={3}
            value={randomMsg}
            placeholder={translate(
              "Chào mừng {user} đến {server}!\nRất vui có {username} trong nhà!\nNgười thứ {count} vừa xuất hiện 🎉",
            )}
            onFocus={() => setFocused(true)}
            onChange={(e) => setRandomMsg(e.target.value)}
            onBlur={() => setFocused(false)}
          />
        </div>

        {/* Embed tùy chỉnh sâu. */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
          <div>
            <p className="text-xs font-medium">{translate("Gửi dạng embed")}</p>
            <p className="text-[11px] text-muted-foreground">
              {translate("Tắt = gửi tin nhắn thường, không có khung embed.")}
            </p>
          </div>
          <Switch
            checked={useEmbed}
            onCheckedChange={(v) => onSave({ [`${kind}UseEmbed`]: v }, translate("Đã lưu"))}
          />
        </div>

        {useEmbed && (
          <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">{translate("Tiêu đề embed")}</Label>
              <Input
                value={title}
                placeholder={isWelcome ? translate("🎉 Thành viên mới!") : translate("👋 Tạm biệt")}
                onFocus={() => setFocused(true)}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => setFocused(false)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">{translate("Màu (#hex)")}</Label>
              <Input
                value={color}
                placeholder="#57f287"
                onFocus={() => setFocused(true)}
                onChange={(e) => setColor(e.target.value)}
                onBlur={() => setFocused(false)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">{translate("Ảnh banner (URL)")}</Label>
              <Input
                value={image}
                placeholder="https://…/banner.png"
                onFocus={() => setFocused(true)}
                onChange={(e) => setImage(e.target.value)}
                onBlur={() => setFocused(false)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">{translate("Thumbnail (URL)")}</Label>
              <Input
                value={thumb}
                placeholder="https://…/avatar.png"
                onFocus={() => setFocused(true)}
                onChange={(e) => setThumb(e.target.value)}
                onBlur={() => setFocused(false)}
              />
            </div>
          </div>
        )}

        <Button
          className="w-full"
          onClick={async () => {
            if (channel === "none" && enabled) {
              return toast.error(
                translate("Đang bật thì phải chọn kênh gửi, hoặc tắt tính năng này."),
              );
            }
            const colorTrim = color.trim();
            if (colorTrim && !/^#[0-9a-fA-F]{3,8}$/.test(colorTrim)) {
              return toast.error(translate("Màu phải ở dạng #hex, ví dụ #57f287"));
            }
            await onSave(
              {
                [`${kind}ChannelId`]: channel === "none" ? "" : channel,
                [`${kind}Message`]: msg,
                [`${kind}Random`]: randomMsg,
                [`${kind}EmbedTitle`]: title,
                [`${kind}EmbedColor`]: colorTrim,
                [`${kind}EmbedImage`]: image.trim(),
                [`${kind}EmbedThumbnail`]: thumb.trim(),
              },
              translate("Đã lưu — bot áp dụng trong khoảng 3 phút"),
            );
          }}
        >
          <Save className="h-4 w-4" /> {translate("Lưu cài đặt")}
        </Button>
      </CardContent>
    </Card>
  );
}

/** Welcome DM — tin nhắn riêng qua DM thành viên mới. */
function DmCard({
  data,
  onSave,
}: {
  data: GuildData;
  onSave: (patch: Record<string, unknown>, msg: string) => Promise<void>;
}) {
  const g = data.guild;
  const [msg, setMsg] = useState(g.welcomeDmMessage ?? "");
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setMsg(g.welcomeDmMessage ?? "");
  }, [g.welcomeDmMessage, focused]);

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mail className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-display text-sm font-bold">{translate("Chào qua DM")}</h3>
              <p className="text-[11px] text-muted-foreground">
                {translate("Gửi lời chào riêng qua tin nhắn trực tiếp (DM) cho thành viên mới")}
              </p>
            </div>
          </div>
          <Switch
            checked={g.welcomeDmEnabled}
            onCheckedChange={(v) =>
              onSave({ welcomeDmEnabled: v }, translate(v ? "Đã bật" : "Đã tắt"))
            }
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">
            {translate("Nội dung DM")}{" "}
            <Badge variant="secondary" className="ml-1">
              {PLACEHOLDER_BADGE}
            </Badge>
          </Label>
          <Textarea
            rows={2}
            value={msg}
            placeholder={translate(
              "Cảm ơn {username} đã tham gia {server}! Đọc #quy-tắc trước khi chat nhé.",
            )}
            onFocus={() => setFocused(true)}
            onChange={(e) => setMsg(e.target.value)}
            onBlur={() => setFocused(false)}
          />
          <p className="text-[11px] text-muted-foreground">
            {translate("Xem trước:")} {previewOf(msg, "welcome", g.name, g.memberCount ?? 0)}
          </p>
        </div>
        <Button
          className="w-full"
          onClick={() =>
            onSave({ welcomeDmMessage: msg }, translate("Đã lưu — bot áp dụng trong khoảng 3 phút"))
          }
        >
          <Save className="h-4 w-4" /> {translate("Lưu cài đặt")}
        </Button>
      </CardContent>
    </Card>
  );
}

/** Autorole — tự cấp role khi thành viên vào server. */
function AutoroleCard({
  data,
  onSave,
}: {
  data: GuildData;
  onSave: (patch: Record<string, unknown>, msg: string) => Promise<void>;
}) {
  const g = data.guild;
  const roleId = g.autoroleRoleId ?? "none";
  const [delay, setDelay] = useState(String(g.autoroleDelaySec ?? 0));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDelay(String(g.autoroleDelaySec ?? 0));
  }, [g.autoroleDelaySec, focused]);

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IdCard className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-display text-sm font-bold">
                {translate("Autorole — tự cấp role")}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {translate("Tự gán role cho thành viên mới ngay khi họ vào server")}
              </p>
            </div>
          </div>
          <Switch
            checked={g.autoroleEnabled}
            onCheckedChange={(v) =>
              onSave({ autoroleEnabled: v }, translate(v ? "Đã bật" : "Đã tắt"))
            }
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">{translate("Role gán tự động")}</Label>
            <Select
              value={roleId}
              onValueChange={(v) =>
                onSave({ autoroleRoleId: v === "none" ? "" : v }, translate("Đã lưu"))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={translate("Chọn role")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{translate("— Không dùng —")}</SelectItem>
                {data.roles.map((r) => (
                  <SelectItem key={r.roleId} value={r.roleId}>
                    @{r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">{translate("Chờ trước khi gán (giây, 0–120)")}</Label>
            <Input
              type="number"
              min={0}
              max={120}
              value={delay}
              onFocus={() => setFocused(true)}
              onChange={(e) => setDelay(e.target.value)}
              onBlur={() => {
                setFocused(false);
                const n = Math.max(0, Math.min(120, Math.floor(Number(delay) || 0)));
                setDelay(String(n));
                void onSave({ autoroleDelaySec: n }, translate("Đã lưu"));
              }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
          <div>
            <p className="text-xs font-medium">{translate("Cấp role cho bot")}</p>
            <p className="text-[11px] text-muted-foreground">
              {translate("Mặc định tắt — bot mới vào server không nhận role tự động")}
            </p>
          </div>
          <Switch
            checked={g.autoroleIncludeBots}
            onCheckedChange={(v) => onSave({ autoroleIncludeBots: v }, translate("Đã lưu"))}
          />
        </div>

        <p className="text-[11px] text-muted-foreground">
          {translate(
            "Chống raid: khi server đang khóa vì raid, autorole tạm dừng để không gán role cho loạt tài khoản ập vào.",
          )}
        </p>
      </CardContent>
    </Card>
  );
}

export default function WelcomePanel({ data }: { data: GuildData }) {
  const updateSettings = useMutation(api.guilds.updateSettings);
  const g = data.guild;
  const activeCount = [
    g.welcomeEnabled,
    g.goodbyeEnabled,
    g.welcomeDmEnabled,
    g.autoroleEnabled,
  ].filter(Boolean).length;

  async function onSave(patch: Record<string, unknown>, msg: string) {
    try {
      await updateSettings({ token: TOKEN(), guildId: g.discordId, ...patch });
      toast.success(msg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : translate("Lưu thất bại"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DoorClosed className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">{translate("Welcome & Goodbye")}</h2>
          {activeCount > 0 && (
            <Badge variant="success">
              {activeCount} {translate("đang bật")}
            </Badge>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {translate(
          "Chào thành viên mới và tạm biệt người rời server: template ngẫu nhiên, embed tùy chỉnh, DM chào riêng và autorole. Bot không chào bot, không bao giờ ping @everyone từ nội dung bạn nhập, và tự im lặng khi server đang khóa chống raid.",
        )}{" "}
      </p>

      <GreetingCard kind="welcome" data={data} onSave={onSave} />
      <GreetingCard kind="goodbye" data={data} onSave={onSave} />
      <DmCard data={data} onSave={onSave} />
      <AutoroleCard data={data} onSave={onSave} />
    </div>
  );
}
