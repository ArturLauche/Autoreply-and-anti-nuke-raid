import { useState } from "react";
import { Bot } from "lucide-react";
import { useBranding } from "../lib/useBranding";
import { cn } from "../lib/utils";

/**
 * Khung logo vuông bo góc dùng cho nav/footer/auth — MỘT nguồn duy nhất thay cho
 * các bản wrapper gradient+glow trước đây từng chép lệch nhau ở 5 nơi.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[10px] bg-primary p-0.5 shadow-sm",
        className,
      )}
    >
      <BotLogo className="h-full w-full" />
    </span>
  );
}

/**
 * Logo / avatar bot trên web. Hiển thị ảnh bot do admin sở hữu bot đặt
 * (Tính năng ẩn → Tùy chỉnh giao diện); chưa đặt thì dùng Haimiya mặc định.
 */
export default function BotLogo({
  className,
  fallbackClassName,
}: {
  className?: string;
  fallbackClassName?: string;
}) {
  const branding = useBranding();
  const [failed, setFailed] = useState(false);
  const src = branding?.botAvatarUrl ?? branding?.haimiyaAvatarUrl ?? null;
  if (src && !failed) {
    return (
      <img
        src={src}
        alt="Protogon"
        onError={() => setFailed(true)}
        className={cn("rounded-full object-cover", className)}
        draggable={false}
      />
    );
  }
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-full bg-secondary text-secondary-foreground",
        className,
      )}
    >
      <Bot className={cn("h-[62%] w-[62%]", fallbackClassName)} />
    </span>
  );
}
