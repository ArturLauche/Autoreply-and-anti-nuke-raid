import { useState } from "react";
import { useBranding } from "../lib/useBranding";
import { cn } from "../lib/utils";

/**
 * Logo mặc định của Protogon: CÁ VOI vector (thay mặt bot cũ).
 * - Dáng đặc trưng của cá voi: thân to + đuôi cong vểnh + vây đuôi hai thuỳ
 *   (khác đuôi cá) + mắt và đường miệng.
 * - Trắng trên nền rounded-square đen: tương phản đen/trắng rõ nét mọi cỡ.
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
      {/* Thân cá voi + đuôi cong vểnh + vây đuôi hai thuỳ (một khối liền) */}
      <path
        d="M59 11 C55 12 52 13 49 14 C45 14.5 39 13 33 13 C40 17 46 19 49 20 C48.5 25 48 28 47 30 C43 28 40 26 36 25 C31 23 26 21 22 21 C15 21 9 26 7 33 C5 40 18 53 36 53 C42 53 46 51 48 49 C51 39 53 29 55 20 C56 17 58 13 59 11 Z"
        fill="#ffffff"
      />
      {/* Mắt và đường miệng — khoét nền cho tương phản */}
      <circle cx="15.4" cy="31.9" r="2.2" fill="#09090b" />
      <path
        d="M10 40 C14 43.5 19 44.5 25 43.5"
        stroke="#09090b"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
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
