import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { KeyRound, Lock, ShieldCheck, ShieldX } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardContent } from "../ui/card";
import { getSessionToken } from "../../lib/discord";
import type { GuildData } from "../../lib/types";

export function hiddenUnlockKey(guildId: string): string {
  return `wio_hidden_unlocked_${guildId}`;
}

export default function UnlockPanel({
  data,
  onUnlocked,
}: {
  data: GuildData;
  onUnlocked: () => void;
}) {
  const verify = useMutation(api.hidden.verifyHiddenPassword);
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);

  // 🔒 CHỈ admin sở hữu bot mới được tương tác mật khẩu / tính năng ẩn.
  if (!data.guild.isBotOwner) {
    return (
      <Card className="mx-auto max-w-md border-primary/30">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ffd6e8] to-[#cfe4ff] text-danger shadow-lg">
            <ShieldX className="h-8 w-8" />
          </span>
          <div>
            <h2 className="font-display text-xl font-bold">Tính năng ẩn 🔒</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Chỉ <b>admin sở hữu bot</b> mới được phép tương tác mật khẩu và đăng nhập vào
              tính năng ẩn — không phải owner hay mod của một server.
            </p>
            {!data.guild.botOwnerSet && (
              <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                Chưa có chủ sở hữu nào được thiết lập. Chủ bot cần đăng nhập bằng chính tài
                khoản Discord đã tạo bot, vào <b>Cài đặt → Mật khẩu tính năng ẩn</b> để đặt
                mật khẩu đầu tiên — người đó sẽ trở thành chủ sở hữu bot.
              </p>
            )}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Quyền quản lý server không đủ để mở khóa mục này.
          </p>
        </CardContent>
      </Card>
    );
  }

  async function unlock() {
    if (!password) return;
    setChecking(true);
    try {
      const ok = await verify({
        token: getSessionToken(),
        guildId: data.guild.discordId,
        password,
      });
      if (ok) {
        sessionStorage.setItem(hiddenUnlockKey(data.guild.discordId), "1");
        toast.success("Đã mở khóa tính năng ẩn 🔓");
        onUnlocked();
      } else {
        toast.error("Sai mật khẩu rồi, thử lại nhé senpai!");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mở khóa thất bại");
    } finally {
      setChecking(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md border-primary/30">
      <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ffd6e8] to-[#cfe4ff] text-primary shadow-lg">
          <Lock className="h-8 w-8" />
        </span>
        <div>
          <h2 className="font-display text-xl font-bold">Tính năng ẩn 🔒</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Mục này được bảo vệ bằng mật khẩu do chủ sở hữu bot đặt. Chỉ người biết mật khẩu mới
            nhìn thấy nội dung bên trong.
          </p>
        </div>
        <div className="grid w-full gap-1.5">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") unlock();
            }}
            placeholder="Mật khẩu tính năng ẩn…"
            autoFocus
            maxLength={64}
          />
          <Button onClick={unlock} disabled={checking || !password} className="w-full">
            {checking ? (
              "Đang kiểm tra…"
            ) : (
              <>
                <KeyRound className="h-4 w-4" /> Mở khóa
              </>
            )}
          </Button>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Quên mật khẩu? Vào Cài đặt để đặt lại (chỉ chủ sở hữu bot).
        </p>
      </CardContent>
    </Card>
  );
}
