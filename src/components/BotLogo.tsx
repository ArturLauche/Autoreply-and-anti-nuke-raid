import { useState } from "react";
import { useBranding } from "../lib/useBranding";
import { cn } from "../lib/utils";

/**
 * Logo mặc định của Protogon: CÁ VOI vector tối giản (thay mặt bot cũ).
 * - Trắng trên nền rounded-square đen: tương phản đen/trắng rõ nét ở mọi cỡ,
 *   kể cả favicon 16–20px.
 * - Cùng MỘT hình (path y hệt) với public/favicon.svg và preloader trong
 *   index.html — đổi hình phải sửa cả ba, scripts/test-web-contracts.cjs chốt hạ.
 */
export function WhaleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      className={cn("h-full w-full shrink-0", className)}
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="16" fill="#09090b" />
      {/* Thân cá voi (đầu tròn bên trái) */}
      <path
        d="M9 34C9 25.5 18 21 28.5 21C37 21 43.5 24 46 29V39C43.5 44 37 47 28.5 47C18 47 9 42.5 9 34Z"
        fill="#ffffff"
      />
      {/* Đuôi hai thuỳ */}
      <path d="M44 28 L58 17 L50 34 L58 49 L44 39 Z" fill="#ffffff" />
      {/* Mắt (khoét nền cho tương phản) */}
      <circle cx="17" cy="32" r="2.4" fill="#09090b" />
    </svg>
  );
}

/**
 * Khung logo vuông bo góc dùng cho nav/footer/auth — MỘT nguồn duy nhất thay cho
 * các bản wrapper gradient+glow trước đây từng chép lệch nhau ở 5 nơi.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-neutral-950 p-0.5 shadow-sm",
        className,
      )}
    >
      <BotLogo className="h-full w-full" />
    </span>
  );
}

/**
 * Logo / avatar bot trên web. Hiển thị ảnh bot do admin sở hữu bot đặt
 * (Tính năng ẩn → Tùy chỉnh giao diện); chưa đặt thì dùng ảnh bot mặc định.
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
        "flex items-center justify-center overflow-hidden rounded-full bg-neutral-950 text-white",
        className,
      )}
    >
      <WhaleIcon className={cn("h-full w-full", fallbackClassName)} />
    </span>
  );
}
