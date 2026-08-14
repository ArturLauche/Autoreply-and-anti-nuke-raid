import { useState } from "react";
import { Bot } from "lucide-react";
import { useBranding } from "../lib/useBranding";
import { cn } from "../lib/utils";

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
        "flex items-center justify-center rounded-full bg-gradient-to-br from-[#ffb3d1] via-[#f79fc6] to-[#8fc8ff] text-white",
        className,
      )}
    >
      <Bot className={cn("h-[62%] w-[62%]", fallbackClassName)} />
    </span>
  );
}
