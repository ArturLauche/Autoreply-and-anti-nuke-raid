import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import {
  BadgeCheck,
  CalendarClock,
  DoorOpen,
  Image,
  Lock,
  Plus,
  ShieldQuestion,
  Trash2,
  UserPlus,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "../ui/card";
import { Switch } from "../ui/switch";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import type { GuildData } from "../../lib/types";
import { getSessionToken } from "../../lib/discord";

import { translate } from "../../lib/i18n";
const TOKEN = () => getSessionToken();

function ModuleNumber({
  value,
  min,
  max,
  onCommit,
}: {
  value: number;
  min: number;
  max?: number;
  onCommit: (n: number) => void;
}) {
  const [v, setV] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setV(String(value));
  }, [value, focused]);
  return (
    <Input
      type="number"
      min={min}
      max={max}
      value={v}
      onFocus={() => setFocused(true)}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        setFocused(false);
        const n = Number(v);
        if (!Number.isNaN(n) && n >= min) onCommit(Math.round(n));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function GateRow({
  icon: Icon,
  title,
  desc,
  checked,
  onToggle,
}: {
  icon: typeof DoorOpen;
  title: string;
  desc: string;
  checked: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-secondary/50 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} />
    </div>
  );
}

export default function JoinGatePanel({ data }: { data: GuildData }) {
  const updateSettings = useMutation(api.guilds.updateSettings);
  const g = data.guild;

  const [whitelistInput, setWhitelistInput] = useState("");
  const locked = g.lockdownUntil !== null && g.lockdownUntil > Date.now();

  async function patch(p: Record<string, unknown>, msg?: string) {
    try {
      await updateSettings({ token: TOKEN(), guildId: g.discordId, ...p });
      if (msg) toast.success(msg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lưu thất bại");
    }
  }

  async function addWhitelist() {
    const id = whitelistInput.trim();
    if (!/^\d{15,20}$/.test(id)) {
      return toast.error(translate("Nhập đúng ID người dùng Discord (15-20 chữ số)"));
    }
    const current = g.joinGateWhitelist || [];
    if (current.includes(id)) {
      setWhitelistInput("");
      return toast.info(translate("ID này đã có trong danh sách trắng"));
    }
    await patch({ joinGateWhitelist: [...current, id] }, `Đã thêm ${id} vào danh sách trắng`);
    setWhitelistInput("");
  }

  async function removeWhitelist(id: string) {
    await patch(
      { joinGateWhitelist: (g.joinGateWhitelist || []).filter((x) => x !== id) },
      `Đã xóa ${id} khỏi danh sách trắng`,
    );
  }

  const activeChecks = [
    g.joinGateMinAgeDays > 0,
    g.joinGateRequireAvatar,
    g.joinGateRequireFlag,
    g.joinGateRaidKick,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">
            {translate("Join Gate — cổng vào server")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {translate(
              "Quét từng thành viên mới khi tham gia và tự động chặn tài khoản nghi selfbot",
            )}{" "}
          </p>
        </div>
        <Badge
          variant={g.joinGateEnabled ? "default" : "secondary"}
          className="gap-1.5 px-3 py-1.5"
        >
          <DoorOpen className="h-3.5 w-3.5" />
          {g.joinGateEnabled ? `Đang bật · ${activeChecks} tiêu chí` : "Đang tắt"}
        </Badge>
      </div>

      {/* Toggle chính */}
      <Card className={g.joinGateEnabled ? "border-primary/30 bg-primary/5" : ""}>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <DoorOpen className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display font-semibold">{translate("Bật Join Gate")}</p>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                {translate(
                  "Khi bật, mọi thành viên mới đều được kiểm tra theo các tiêu chí bên dưới trước khi ở lại server. Kẻ không đạt sẽ bị",
                )}{" "}
                <b className="text-foreground">{translate("kick hoặc ban")}</b>{" "}
                {translate("ngay lập tức.")}{" "}
              </p>
            </div>
          </div>
          <Switch
            checked={g.joinGateEnabled}
            onCheckedChange={(v) =>
              patch({ joinGateEnabled: v }, v ? "Đã bật Join Gate" : "Đã tắt Join Gate")
            }
          />
        </CardContent>
      </Card>

      {!g.joinGateEnabled && (
        <div className="rounded-xl border border-border bg-secondary px-4 py-3 text-sm text-foreground">
          {translate(
            "⚠️ Join Gate đang tắt — mọi tài khoản đều được vào tự do (kể cả selfbot).",
          )}{" "}
        </div>
      )}

      {/* Các tiêu chí */}
      <div className="grid gap-3">
        <GateRow
          icon={CalendarClock}
          title={translate("Chặn tài khoản quá mới")}
          desc="Tài khoản tạo ít hơn số ngày dưới đây sẽ bị chặn (0 = tắt). Selfbot thường dùng tài khoản mới tạo hàng loạt."
          checked={g.joinGateMinAgeDays > 0}
          onToggle={(v) => patch({ joinGateMinAgeDays: v ? 7 : 0 })}
        />
        {g.joinGateMinAgeDays > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/50 px-4 py-3">
            <Label className="shrink-0 text-xs text-muted-foreground">
              {translate("Tuổi tối thiểu (ngày)")}
            </Label>
            <div className="w-28">
              <ModuleNumber
                value={g.joinGateMinAgeDays}
                min={1}
                max={3650}
                onCommit={(n) => patch({ joinGateMinAgeDays: n })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {translate("Khuyến nghị 7-14 ngày để hạn chế tài khoản dùng 1 lần.")}{" "}
            </p>
          </div>
        )}

        <GateRow
          icon={Image}
          title={translate("Yêu cầu có avatar riêng")}
          desc="Tài khoản không có ảnh đại diện riêng (đang dùng hình mặc định) sẽ bị chặn."
          checked={g.joinGateRequireAvatar}
          onToggle={(v) => patch({ joinGateRequireAvatar: v })}
        />

        <GateRow
          icon={BadgeCheck}
          title={translate("Yêu cầu có huy hiệu tài khoản")}
          desc="Tài khoản không có bất kỳ huy hiệu công khai nào (flag = 0) sẽ bị chặn — selfbot mới hầu như không có huy hiệu."
          checked={g.joinGateRequireFlag}
          onToggle={(v) => patch({ joinGateRequireFlag: v })}
        />

        <GateRow
          icon={Lock}
          title={translate("Chặn lượt vào khi đang bị raid")}
          desc="Khi server đang khóa kênh (raid), mọi thành viên mới đều bị xử lý — chặn đà tấn công thứ hai."
          checked={g.joinGateRaidKick}
          onToggle={(v) => patch({ joinGateRaidKick: v })}
        />
        {locked && (
          <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {translate("🔒 Server của bạn")} <b>{translate("đang bị khóa kênh")}</b>{" "}
            {translate(
              "— nếu bật tiêu chí trên, mọi thành viên mới sẽ bị xử lý ngay bây giờ.",
            )}{" "}
          </div>
        )}

        <GateRow
          icon={ShieldQuestion}
          title={translate("Hình thức xử lý")}
          desc="Kick = thành viên có thể quay lại; Ban = chặn vĩnh viễn (mạnh hơn với selfbot)."
          checked={g.joinGatePunish === "ban"}
          onToggle={(v) => patch({ joinGatePunish: v ? "ban" : "kick" })}
        />
        {g.joinGatePunish === "ban" && (
          <p className="px-4 text-xs text-muted-foreground">
            {translate("⚠️ Đang ở chế độ")} <b className="text-danger">Ban</b>{" "}
            {translate(
              "— tài khoản vi phạm bị cấm vĩnh viễn. Chọn Kick nếu bạn muốn nhẹ tay hơn.",
            )}{" "}
          </p>
        )}
      </div>

      {/* Danh sách trắng */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
              <UserPlus className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display font-semibold">{translate("Danh sách trắng")}</p>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                {translate("Những ID người dùng này")} <b>{translate("luôn được vào")}</b>
                {translate(
                  ", bỏ qua mọi tiêu chí — dùng cho tài khoản phụ / bạn bè quen biết.",
                )}{" "}
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Input
              placeholder={translate("Nhập ID người dùng Discord…")}
              value={whitelistInput}
              onChange={(e) => setWhitelistInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void addWhitelist();
              }}
            />
            <Button onClick={addWhitelist}>
              <Plus className="h-4 w-4" /> {translate("Thêm")}{" "}
            </Button>
          </div>
          {(g.joinGateWhitelist || []).length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {translate("Chưa có ID nào — mọi thành viên mới đều bị kiểm tra.")}{" "}
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {g.joinGateWhitelist.map((id) => (
                <span
                  key={id}
                  className="group flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-1 font-mono text-xs text-foreground transition-colors hover:bg-accent"
                >
                  {id}
                  <button
                    onClick={() => removeWhitelist(id)}
                    className="text-muted-foreground/60 transition-colors hover:text-destructive"
                    aria-label={`Xóa ${id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border bg-secondary/50 p-4 text-xs text-muted-foreground">
        <p className="mb-1 font-medium text-foreground">{translate("📌 Lưu ý quan trọng")}</p>
        <p>
          • Discord <b>{translate("không cho bot đọc")}</b>{" "}
          {translate(
            "trạng thái email/điện thoại đã xác thực, nên Join Gate dùng các tín hiệu công khai (tuổi tài khoản, avatar, huy hiệu, trạng thái raid) để nhận diện selfbot.",
          )}{" "}
        </p>
        <p className="mt-1">
          {translate("• Bot cần quyền")}{" "}
          <b className="text-foreground">{translate("Kick/Ban thành viên")}</b>{" "}
          {translate(
            "để xử lý. Muốn cho một người cụ thể luôn vào, thêm ID của họ vào danh sách trắng phía trên.",
          )}{" "}
        </p>
      </div>
    </div>
  );
}
