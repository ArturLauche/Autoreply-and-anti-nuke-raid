import type { Lang } from "./i18n";

export const SITE_URL = "https://protogon.freebuff.app";

/** Static index dùng domain mặc định; sau hydration dùng origin của domain đang phục vụ. */
export function activeSiteUrl(): string {
  if (
    typeof window !== "undefined" &&
    window.location.origin &&
    window.location.origin !== "null"
  ) {
    return window.location.origin;
  }
  return SITE_URL;
}

type RouteKind =
  | "home"
  | "features"
  | "terms"
  | "privacy"
  | "data-deletion"
  | "monitor"
  | "auth"
  | "dashboard"
  | "stats"
  | "admin"
  | "callback"
  | "not-found";

type Copy = Record<Exclude<RouteKind, "not-found">, { title: string; description: string }>;

const COPY: Record<Lang, Copy> = {
  vi: {
    home: {
      title: "Protogon — Bot Discord tự trả lời & chống nuke/raid",
      description:
        "Protogon giúp bảo vệ server Discord với auto-reply, hệ thống nhiệt độ 4 giai đoạn, Join Gate chống selfbot, chặn link độc hại và 32 module chống nuke/raid.",
    },
    features: {
      title: "Tính năng — Protogon: bot Discord tự trả lời & chống nuke/raid",
      description:
        "Toàn bộ tính năng của bot Discord Protogon: tự trả lời theo từ khoá, hệ thống nhiệt độ 4 giai đoạn, Join Gate, 32 module chống nuke/raid và backup server.",
    },
    terms: {
      title: "Điều khoản sử dụng — Protogon",
      description: "Điều khoản sử dụng bot Protogon và bảng điều khiển web cho cộng đồng Discord.",
    },
    privacy: {
      title: "Chính sách quyền riêng tư — Protogon",
      description: "Chính sách quyền riêng tư và cách Protogon xử lý dữ liệu người dùng.",
    },
    "data-deletion": {
      title: "Lưu trữ & xoá dữ liệu — Protogon",
      description: "Thông tin lưu trữ, thời hạn và quy trình yêu cầu xoá dữ liệu của Protogon.",
    },
    monitor: {
      title: "Giám sát bot — Protogon",
      description:
        "Theo dõi trạng thái, độ trễ và số liệu vận hành của bot Protogon theo thời gian thực.",
    },
    auth: {
      title: "Đăng nhập — Protogon",
      description: "Đăng nhập an toàn bằng Discord để quản lý các server của bạn trên Protogon.",
    },
    dashboard: {
      title: "Dashboard — Protogon",
      description: "Quản lý cấu hình bảo vệ và tự động hóa cho các server Discord của bạn.",
    },
    stats: {
      title: "Thống kê nhiệt độ — Protogon",
      description: "Theo dõi thành viên có nhiệt độ vi phạm cao trong các server bạn quản lý.",
    },
    admin: {
      title: "Quản trị — Protogon",
      description: "Khu vực quản trị dành riêng cho chủ sở hữu bot Protogon.",
    },
    callback: {
      title: "Đang xác thực Discord — Protogon",
      description: "Đang hoàn tất đăng nhập Discord an toàn với Protogon.",
    },
  },
  en: {
    home: {
      title: "Protogon — Discord bot with auto-replies & anti-nuke/raid",
      description:
        "Protogon protects Discord servers with auto-replies, a four-stage heat system, Join Gate anti-selfbot, malicious-link blocking, and 32 anti-nuke/raid modules.",
    },
    features: {
      title: "Features — Protogon: Discord auto-reply & anti-nuke bot",
      description:
        "Every Protogon Discord bot feature: keyword auto-replies, a four-stage heat system, Join Gate, 32 anti-nuke/raid modules, and full server backup & restore.",
    },
    terms: {
      title: "Terms of Service — Protogon",
      description: "Terms for using the Protogon Discord bot and web dashboard.",
    },
    privacy: {
      title: "Privacy Policy — Protogon",
      description: "How Protogon handles user data and protects your privacy.",
    },
    "data-deletion": {
      title: "Data Retention & Deletion — Protogon",
      description: "Protogon retention information and the process for requesting data deletion.",
    },
    monitor: {
      title: "Bot monitor — Protogon",
      description: "Live Protogon bot status, latency, and operational metrics.",
    },
    auth: {
      title: "Sign in — Protogon",
      description: "Securely sign in with Discord to manage your servers on Protogon.",
    },
    dashboard: {
      title: "Dashboard — Protogon",
      description: "Manage protection settings and automation for your Discord servers.",
    },
    stats: {
      title: "Heat stats — Protogon",
      description: "Track members with the highest violation heat across servers you manage.",
    },
    admin: {
      title: "Admin — Protogon",
      description: "A private administration area for the Protogon bot owner.",
    },
    callback: {
      title: "Verifying Discord — Protogon",
      description: "Completing a secure Discord sign-in for Protogon.",
    },
  },
  de: {
    home: {
      title: "Protogon — Discord-Bot mit Auto-Antworten & Anti-Nuke/Raid",
      description:
        "Protogon schützt Discord-Server mit Auto-Antworten, einem vierstufigen Heat-System, Join Gate gegen Selfbots, schädlichen Links und 32 Anti-Nuke/Raid-Modulen.",
    },
    features: {
      title: "Funktionen — Protogon: Discord-Bot mit Auto-Antworten & Anti-Nuke",
      description:
        "Alle Funktionen des Protogon-Discord-Bots: Auto-Antworten nach Schlüsselwörtern, vierstufiges Heat-System, Join Gate, 32 Anti-Nuke/Raid-Module und Server-Backup.",
    },
    terms: {
      title: "Nutzungsbedingungen — Protogon",
      description: "Nutzungsbedingungen für den Protogon-Discord-Bot und das Web-Dashboard.",
    },
    privacy: {
      title: "Datenschutzerklärung — Protogon",
      description: "Wie Protogon mit Benutzerdaten umgeht und Ihre Privatsphäre schützt.",
    },
    "data-deletion": {
      title: "Speicherung & Löschung — Protogon",
      description:
        "Informationen zu Speicherung, Aufbewahrung und Löschung von Daten bei Protogon.",
    },
    monitor: {
      title: "Bot-Monitor — Protogon",
      description: "Live-Status, Latenz und Betriebsdaten des Protogon-Bots.",
    },
    auth: {
      title: "Anmelden — Protogon",
      description: "Mit Discord sicher anmelden und Ihre Server auf Protogon verwalten.",
    },
    dashboard: {
      title: "Dashboard — Protogon",
      description: "Schutz-Einstellungen und Automatisierung für Ihre Discord-Server verwalten.",
    },
    stats: {
      title: "Heat-Statistiken — Protogon",
      description: "Mitglieder mit der höchsten Verstoß-Heat in verwalteten Servern verfolgen.",
    },
    admin: {
      title: "Administration — Protogon",
      description: "Privater Verwaltungsbereich für den Protogon-Bot-Besitzer.",
    },
    callback: {
      title: "Discord wird geprüft — Protogon",
      description: "Sichere Discord-Anmeldung für Protogon wird abgeschlossen.",
    },
  },
};

function routeKind(pathname: string): RouteKind {
  const path = pathname !== "/" ? pathname.replace(/\/+$/, "") || "/" : "/";
  if (path === "/") return "home";
  if (path === "/features") return "features";
  if (path === "/terms") return "terms";
  if (path === "/privacy") return "privacy";
  if (path === "/data-deletion") return "data-deletion";
  if (path === "/monitor" || path === "/status") return "monitor";
  if (path === "/auth") return "auth";
  if (path === "/discord/callback") return "callback";
  if (path === "/dashboard" || path.startsWith("/dashboard/")) return "dashboard";
  if (path === "/stats") return "stats";
  if (path === "/admin") return "admin";
  return "not-found";
}

/**
 * Các route ĐƯỢC PHÉP index — MỘT nguồn duy nhất cho cả meta robots,
 * canonical và JSON-LD theo route. Thêm route public mới PHẢI thêm vào đây,
 * nếu không trang đó bị gắn noindex dù đang nằm trong sitemap (bug lớp:
 * meta và sitemap mâu thuẫn, công cụ tìm kiếm bỏ qua trang im lặng).
 */
const INDEXED_KINDS: RouteKind[] = [
  "home",
  "features",
  "terms",
  "privacy",
  "data-deletion",
  "monitor",
];

function setMeta(attribute: "name" | "property", key: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function setCanonical(href: string | null): void {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.appendChild(element);
  }
  element.href = href;
}

/**
 * Dữ liệu có cấu trúc THEO ROUTE (WebPage + BreadcrumbList), gắn vào <head>
 * sau hydration. index.html đã có 2 khối tĩnh (Organization + SoftwareApplication)
 * — khối này bổ sung phần chỉ route cụ thể mới biết được (URL nào, thuộc trang
 * gì, nằm ở đâu trong cây điều hướng). Chỉ chạy cho JSONLD_KINDS (tập con của
 * INDEXED_KINDS, bỏ "home" — trang chủ đã có JSON-LD tĩnh và không cần
 * breadcrumb một mức). Route KHÔNG được index (/auth, /dashboard, 404…):
 * GỠ hẳn — để dữ liệu có cấu trúc của trang noindex là tự mâu thuẫn với chính
 * meta robots của nó.
 */
const JSONLD_KINDS = ["features", "terms", "privacy", "data-deletion", "monitor"] as const;
type JsonLdKind = (typeof JSONLD_KINDS)[number];

function syncRouteJsonLd(pathname: string, kind: RouteKind, lang: Lang): void {
  const ID = "route-jsonld";
  const existing = document.getElementById(ID);
  if (!(JSONLD_KINDS as readonly string[]).includes(kind)) {
    existing?.remove();
    return;
  }
  const jsonLdKind = kind as JsonLdKind;
  const siteUrl = activeSiteUrl();
  const normalized = pathname !== "/" ? pathname.replace(/\/+$/, "") || "/" : "/";
  const url = `${siteUrl}${normalized}`;
  const copy = COPY[lang][jsonLdKind];
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: copy.title,
        description: copy.description,
        inLanguage: lang,
        isPartOf: {
          "@id": `${siteUrl}/#website`,
          "@type": "WebSite",
          name: "Protogon",
          url: siteUrl,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Protogon", item: siteUrl },
          { "@type": "ListItem", position: 2, name: copy.title, item: url },
        ],
      },
    ],
  };
  let element = document.getElementById(ID) as HTMLScriptElement | null;
  if (!element) {
    element = document.createElement("script");
    element.type = "application/ld+json";
    element.id = ID;
    document.head.appendChild(element);
  }
  element.textContent = JSON.stringify(data);
}

/** Đồng bộ metadata sau hydration; static index vẫn có fallback cho crawler. */
export function syncRouteMetadata(pathname: string, lang: Lang): void {
  const kind = routeKind(pathname);
  const copy = kind === "not-found" ? COPY[lang].home : COPY[lang][kind];
  const indexed = INDEXED_KINDS.includes(kind);
  const normalized = pathname !== "/" ? pathname.replace(/\/+$/, "") || "/" : "/";
  const siteUrl = activeSiteUrl();
  const ogImage = `${siteUrl}/og-image.png`;

  document.title = kind === "not-found" ? `404 — ${copy.title}` : copy.title;
  setMeta("name", "description", copy.description);
  setMeta("property", "og:title", document.title);
  setMeta("property", "og:description", copy.description);
  setMeta("property", "og:url", indexed ? `${siteUrl}${normalized}` : siteUrl);
  setMeta("property", "og:image", ogImage);
  setMeta("property", "og:image:alt", "Protogon — Discord server protection");
  setMeta("name", "twitter:title", document.title);
  setMeta("name", "twitter:description", copy.description);
  setMeta("name", "twitter:image", ogImage);
  setMeta("name", "twitter:image:alt", "Protogon — Discord server protection");
  setMeta("name", "robots", indexed ? "index,follow" : "noindex,nofollow");
  setCanonical(indexed ? `${siteUrl}${normalized}` : null);
  syncRouteJsonLd(pathname, kind, lang);
}
