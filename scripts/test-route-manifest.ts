// TEST: bảng tuyến đường (route manifest) — nguồn duy nhất cho route/SEO/hosting.
// Chạy: bun scripts/test-route-manifest.ts
//
// Vì sao có test này: bug lớp "/features 404 khi mở trực tiếp" và "/status trùng
// canonical" đều xuất phát từ việc kiến thức route nằm rải ở 4+ nơi độc lập.
// Bảng routes.json là nguồn duy nhất; test này khoá HÀNH VI của bảng và của
// các hàm đọc (khớp exact/prefix, alias→canonical, bộ sitemap, bộ SPA
// fallback) để App.tsx, seo.ts và test cấu hình hosting đều bám cùng một sự
// thật. Đổi bảng mà làm hỏng một trong các bất biến dưới đây = test đỏ.
import {
  ROUTES,
  PRIVATE_ROUTES,
  PUBLIC_INDEXABLE_ROUTES,
  REDIRECT_ROUTES,
  SITEMAP_ROUTES,
  SPA_FALLBACK_ROUTES,
  canonicalPathFor,
  normalizePath,
  routeForPath,
  routeLabel,
  vercelRewriteSource,
} from "../src/lib/routes";

let pass = 0;
let fail = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(ok ? `  ✅ ${label}` : `  ❌ ${label}${ok ? "" : ` — ${detail ?? ""}`}`);
  if (ok) pass++;
  else fail++;
};

console.log("── #1 khoá route theo exact / prefix ──");

check("trang chủ khớp exact", routeForPath("/")?.path === "/");
check("/features khớp exact", routeForPath("/features")?.seoKind === "features");
check("/dashboard khớp prefix", routeForPath("/dashboard")?.match === "prefix");
check(
  "/dashboard/123 khớp prefix /dashboard",
  routeForPath("/dashboard/123")?.path === "/dashboard",
);
check(
  "/dashboard/123/history khớp prefix /dashboard",
  routeForPath("/dashboard/123/history")?.seoKind === "dashboard",
);
check("/dashboardxyz KHÔNG khớp prefix /dashboard", routeForPath("/dashboardxyz") === null);
check("URL không tồn tại → null (404)", routeForPath("/khong-ton-tai") === null);
check(
  "trailing slash không phải route khác: /terms/ === /terms",
  routeForPath("/terms/")?.path === "/terms",
);
check("normalizePath giữ '/'", normalizePath("/") === "/");
check("normalizePath cắt dấu gạch cuối", normalizePath("/status/") === "/status");

console.log("── #2 alias → canonical (một URL duy nhất được index) ──");

check("/status canonical về /monitor", canonicalPathFor("/status") === "/monitor");
check("/monitor canonical là chính nó", canonicalPathFor("/monitor") === "/monitor");
check(
  "/status/ (có slash cuối) cũng canonical về /monitor",
  canonicalPathFor("/status/") === "/monitor",
);
check(
  "route private canonical là chính nó (nhưng không index)",
  canonicalPathFor("/admin") === "/admin",
);
check("URL 404 không có canonical", canonicalPathFor("/khong-ton-tai") === null);
check(
  "alias trỏ tới một route TỒN TẠI và route đó không phải alias",
  REDIRECT_ROUTES.every(
    (r) => r.redirect !== null && ROUTES.some((t) => t.path === r.redirect && t.redirect === null),
  ),
);
check(
  "alias KHÔNG index và KHÔNG vào sitemap",
  REDIRECT_ROUTES.every((r) => !r.index && !r.sitemap),
);
check(
  "không alias nào nằm trong SITEMAP_ROUTES",
  !SITEMAP_ROUTES.some((r) => REDIRECT_ROUTES.includes(r)),
);

console.log("── #3 bộ route dùng cho sitemap / SPA fallback / redirect ──");

check(
  "SITEMAP_ROUTES chỉ có public + indexable + không alias",
  SITEMAP_ROUTES.every((r) => r.visibility === "public" && r.index && !r.redirect),
);
check(
  "/status KHÔNG nằm trong SITEMAP_ROUTES (tránh nội dung trùng)",
  !SITEMAP_ROUTES.some((r) => r.path === "/status"),
);
check(
  "/monitor LÀ route sitemap duy nhất cho trạng thái",
  SITEMAP_ROUTES.filter((r) => r.seoKind === "monitor").length === 1,
);
check("trang chủ không cần SPA fallback", !SPA_FALLBACK_ROUTES.some((r) => r.path === "/"));
check(
  "SPA_FALLBACK_ROUTES gồm mọi trang public cần fallback (trang chủ + alias loại trừ)",
  SPA_FALLBACK_ROUTES.every((r) => r.path !== "/" && !r.redirect),
);
check(
  "PRIVATE_ROUTES đều noindex + không sitemap",
  PRIVATE_ROUTES.every((r) => !r.index && !r.sitemap),
);
check(
  "PUBLIC_INDEXABLE_ROUTES đều public + index",
  PUBLIC_INDEXABLE_ROUTES.every((r) => r.visibility === "public" && r.index),
);
check(
  "không route nào vừa private vừa public",
  ROUTES.every((r) => ["public", "private"].includes(r.visibility)),
);

console.log("── #4 hợp đồng hosting suy ra từ bảng ──");

check(
  "rewrite Vercel cho route exact chính là path",
  SPA_FALLBACK_ROUTES.filter((r) => r.match === "exact").every(
    (r) => vercelRewriteSource(r) === r.path,
  ),
);
check(
  "rewrite Vercel cho route prefix có dạng /prefix/:path*",
  SPA_FALLBACK_ROUTES.filter((r) => r.match === "prefix").every((r) =>
    vercelRewriteSource(r).endsWith("/:path*"),
  ),
);
check(
  "routeLabel đánh dấu prefix cho người đọc log",
  routeLabel({ path: "/dashboard", match: "prefix" } as never) === "/dashboard/*",
);

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
