import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { getSessionToken } from "../lib/discord";
import { Loader2 } from "lucide-react";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const token = getSessionToken();
  // Chưa đăng nhập → skip (RequireAuth sẽ chuyển hướng sang /auth ngay).
  const me = useQuery(api.sessions.me, token ? { token } : "skip");

  if (me === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm">Đang kiểm tra phiên đăng nhập…</span>
        </div>
      </div>
    );
  }

  if (me === null) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?returnTo=${returnTo}`} replace />;
  }

  return <>{children}</>;
}
