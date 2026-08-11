import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import Landing from "./pages/Landing";
import AuthPage from "./pages/AuthPage";
import DiscordCallback from "./pages/DiscordCallback";
import Dashboard from "./pages/Dashboard";
import GuildPage from "./pages/GuildPage";
import GuildHistory from "./pages/GuildHistory";
import RequireAuth from "./components/RequireAuth";
import Taskbar from "./components/Taskbar";

export default function App() {
  return (
    <>
      <Taskbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/discord/callback" element={<DiscordCallback />} />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster
        position="top-right"
        theme="light"
        toastOptions={{
          style: {
            background: "hsl(0 0% 100%)",
            border: "1px solid hsl(340 40% 86%)",
            color: "hsl(265 32% 16%)",
          },
        }}
      />
    </>
  );
}
