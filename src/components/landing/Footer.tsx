import { Facebook, MessageCircle, User } from "lucide-react";
import { Button } from "../ui/button";
import { SafeHaimiyaAvatar } from "./shared";
import { useBotStatus } from "../../lib/useBotStatus";

import { translate } from "../../lib/i18n";
/** Khối chủ bot ở footer — tự chặn lỗi riêng, mặc định về tên gốc khi backend down. */
function FooterOwner() {
  const botStatus = useBotStatus();
  const ownerName = botStatus?.ownerName ?? "wiothemilo";
  const ownerAvatar = botStatus?.ownerAvatarUrl ?? null;
  return (
    <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
      {ownerAvatar ? (
        <img
          src={ownerAvatar}
          alt={ownerName}
          className="h-8 w-8 rounded-full object-cover ring-2 ring-white/70"
          draggable={false}
        />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <User className="h-4 w-4" />
        </span>
      )}
      <span>
        {translate("Chủ bot:")} <b className="text-foreground">{ownerName}</b>
        <span className="ml-1.5 hidden sm:inline">{translate("· cập nhật 24/7")}</span>
      </span>
    </div>
  );
}

/** Footer landing — liên kết cộng đồng + thông tin chủ bot. */
export default function Footer({
  discordInvite,
  facebookUrl,
}: {
  discordInvite: string;
  facebookUrl: string;
}) {
  return (
    <footer className="border-t border-border py-10">
      <div className="container">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary p-0.5 shadow-sm">
              <SafeHaimiyaAvatar className="h-full w-full" />
            </span>
            <div>
              <p className="font-display font-semibold">Protogon Bot</p>
              <p className="text-xs text-muted-foreground">
                {translate("Bot Discord bảo vệ server · trợ lý Haimiya")}{" "}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <a href={discordInvite} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm">
                <MessageCircle className="h-4 w-4" />
                Discord server
              </Button>
            </a>
            <a href={facebookUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm">
                <Facebook className="h-4 w-4" />
                Fanpage Facebook
              </Button>
            </a>
          </div>
        </div>
        <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 md:flex-row">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()}{" "}
            {translate(
              "Protogon Bot · Tự trả lời thông minh, nhiệt độ vi phạm, Join Gate & phòng thủ chống raid cho Discord",
            )}
          </p>
          <FooterOwner />
        </div>
      </div>
    </footer>
  );
}
