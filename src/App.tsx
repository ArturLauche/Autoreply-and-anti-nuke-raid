import { lazy, Suspense, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import RequireAuth from "./components/RequireAuth";

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

/** Title riêng cho từng route — tránh toàn bộ trang dùng chung 1 title. */
const ROUTE_TITLES: Array<[pattern: string, title: string]> = [
  ["/auth", "Đăng nhập — Protogon"],
  ["/dashboard", "Dashboard — Protogon"],
  ["/stats", "Thống kê nhiệt độ — Protogon"],
  ["/monitor", "Giám sát bot — Protogon"],
  ["/admin", "Quản trị — Protogon"],
];

function TitleSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    const match = ROUTE_TITLES.find(([p]) => pathname.startsWith(p));
    document.title = match ? match[1] : BASE_TITLE;
  }, [pathname]);
  return null;
}

/** Màn hình chờ tối giản khi chunk route đang tải (vài trăm ms lần đầu). */
function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-foreground" />
    </div>
  );
}

export default function App() {
  return (
    <>
      <TitleSync />
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
