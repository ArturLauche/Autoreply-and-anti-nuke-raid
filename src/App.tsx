import { lazy, Suspense, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import RequireAuth from "./components/RequireAuth";

import { translate, useT } from "./lib/i18n";
// Route-level code splitting: khách vào landing chỉ tải Landing + vendors.
// Các trang dashboard/admin nặng (nhiều panel) chỉ tải khi thật sự mở —
// giảm đáng kể JS parse/execute lần đầu.
const AuthPage = lazy(() => import("./pages/AuthPage"));
const DiscordCallback = lazy(() => import("./pages/DiscordCallback"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const GuildPage = lazy(() => import("./pages/GuildPage"));
const GuildHistory = lazy(() => import("./pages/GuildHistory"));
const Monitor = lazy(() => import("./pages/Monitor"));
const Admin = lazy(() => import("./pages/Admin"));
const StatsPage = lazy(() => import("./pages/StatsPage"));

const BASE_TITLE = "Protogon — Bot Discord tự trả lời & chống nuke/raid";

/**
 * Title riêng cho từng route — tránh toàn bộ trang dùng chung 1 title.
 * Chuỗi ở đây là KEY tiếng Việt: dịch lúc render (xem TitleSync) để title
 * đổi theo ngôn ngữ người dùng chọn.
 */
const ROUTE_TITLES: Array<[pattern: string, title: string]> = [
  ["/auth", "Đăng nhập — Protogon"],
  ["/dashboard", "Dashboard — Protogon"],
  ["/stats", "Thống kê nhiệt độ — Protogon"],
  ["/monitor", "Giám sát bot — Protogon"],
  ["/admin", "Quản trị — Protogon"],
];

function TitleSync({ lang }: { lang: string }) {
  const { pathname } = useLocation();
  useEffect(() => {
    const match = ROUTE_TITLES.find(([p]) => pathname.startsWith(p));
    document.title = translate(match ? match[1] : BASE_TITLE);
    // lang nằm trong deps: đổi ngôn ngữ phải ghi lại title ngay.
  }, [pathname, lang]);
  return null;
}

/**
 * Màn hình chờ khi chunk route đang tải lần đầu: logo + thanh tiến trình mảnh
 * chạy vô hạn ở đỉnh trang (kiểu GitHub/YouTube — người dùng thấy "đang đi"
 * thay vì spinner đứng yên giữa màn hình trống).
 */
function RouteFallback() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Progress bar mảnh bám đỉnh — như top loading bar quen thuộc */}
      <div aria-hidden className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden">
        <div className="h-full w-1/3 animate-route-progress bg-foreground" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <img src="/favicon.svg" alt="" className="h-10 w-10 animate-pulse-fade" />
        <p className="text-xs tracking-wide text-muted-foreground">{translate("Đang tải…")}</p>
      </div>
    </div>
  );
}

export default function App() {
  // App là consumer của LangContext: khi người dùng đổi ngôn ngữ, App re-render
  // và tạo lại element cho toàn bộ Routes → mọi component con vẽ lại bằng
  // translate() ở ngôn ngữ mới (translate đọc trạng thái module lúc render).
  const { lang } = useT();
  return (
    <>
      <TitleSync lang={lang} />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/discord/callback" element={<DiscordCallback />} />
          <Route path="/monitor" element={<Monitor />} />
          <Route path="/admin" element={<Admin />} />
          <Route
            path="/stats"
            element={
              <RequireAuth>
                <StatsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/:guildId"
            element={
              <RequireAuth>
                <GuildPage />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/:guildId/history"
            element={
              <RequireAuth>
                <GuildHistory />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Toaster
        position="top-right"
        theme="system"
        toastOptions={{
          className: "rounded-[0.625rem]",
        }}
      />
    </>
  );
}
