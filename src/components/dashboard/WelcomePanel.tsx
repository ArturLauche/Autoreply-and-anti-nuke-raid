import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { DoorClosed, Save, UserPlus, UserMinus } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "../ui/card";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import type { GuildData } from "../../lib/types";
import { getSessionToken } from "../../lib/discord";

import { translate } from "../../lib/i18n";
const TOKEN = () => getSessionToken();

/**
 * WelcomePanel — chào thành viên mới + tạm biệt thành viên rời server.
 * Placeholder: {user} mention · {username} tên · {server} tên server · {count} số thành viên.
 * Bot áp dụng config trong vòng ~3 phút (cache getConfig).
 */

type Kind = "welcome" | "goodbye";

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

  const [channel, setChannel] = useState(channelId ?? "none");
  const [msg, setMsg] = useState(message ?? "");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setChannel(channelId ?? "none");
  }, [channelId, focused]);
  useEffect(() => {
    if (!focused) setMsg(message ?? "");
  }, [message, focused]);

  const textChannels = data.channels.filter((c) => c.type === 0 || c.type === 5);
  const preview = (msg.trim() || (isWelcome ? "Chào mừng {user}…" : "{user} đã rời…"))
    .replaceAll("{user}", "@ThànhViênMới")
    .replaceAll("{username}", "ThànhViênMới")
    .replaceAll("{server}", g.name)
    .replaceAll("{count}", String(g.memberCount ?? 0));

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
                  ? translate("Gửi tin chào vào kênh bạn chọn khi có thành viên tham gia")
                  : translate("Gửi tin tạm biệt khi có thành viên rời server")}
              </p>
            </div>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) =>
              onSave({ [`${kind}Enabled`]: v }, translate(v ? "Đã bật" : "Đã tắt"))
            }
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">{translate("Kênh gửi")}</Label>
          <Select value={channel} onValueChange={(v) => setChannel(v)}>
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

        <div className="space-y-2">
          <Label className="text-xs">
            {translate("Nội dung")}{" "}
            <Badge variant="secondary" className="ml-1">
              {"{user} {username} {server} {count}"}
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
            {translate("Xem trước:")} {preview}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
          <div>
            <p className="text-xs font-medium">{translate("Gửi dạng embed")}</p>
            <p className="text-[11px] text-muted-foreground">
              {translate("Tắt = gửi tin nhắn thường (không khung)")}
            </p>
          </div>
          <Switch
            checked={useEmbed}
            onCheckedChange={(v) => onSave({ [`${kind}UseEmbed`]: v }, translate("Đã lưu"))}
          />
        </div>

        <Button
          className="w-full"
          onClick={async () => {
            if (channel === "none" && enabled) {
              return toast.error(translate("Bật rồi phải chọn kênh gửi — hoặc tắt tính năng"));
            }
            await onSave(
              {
                [`${kind}ChannelId`]: channel === "none" ? "" : channel,
                [`${kind}Message`]: msg,
              },
              translate("Đã lưu — bot áp dụng trong vòng ~3 phút"),
            );
          }}
        >
          <Save className="h-4 w-4" /> {translate("Lưu cài đặt")}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function WelcomePanel({ data }: { data: GuildData }) {
  const updateSettings = useMutation(api.guilds.updateSettings);
  const g = data.guild;
  const activeCount = [g.welcomeEnabled, g.goodbyeEnabled].filter(Boolean).length;

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
          "Chào thành viên mới và tạm biệt thành viên rời server — kênh riêng, nội dung tùy chỉnh. Bot không chào bot, không ping @everyone từ nội dung tùy chỉnh (an toàn chống ping sập server).",
        )}{" "}
      </p>

      <GreetingCard kind="welcome" data={data} onSave={onSave} />
      <GreetingCard kind="goodbye" data={data} onSave={onSave} />
    </div>
  );
}
