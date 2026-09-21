import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { translate } from "./i18n";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(ts: number | null | undefined): string {
  if (!ts) return translate("chưa rõ");
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return translate("{p}s trước", { p: s });
  const m = Math.floor(s / 60);
  if (m < 60) return translate("{p}p trước", { p: m });
  const h = Math.floor(m / 60);
  if (h < 24) return translate("{p} giờ trước", { p: h });
  return translate("{p} ngày trước", { p: Math.floor(h / 24) });
}
