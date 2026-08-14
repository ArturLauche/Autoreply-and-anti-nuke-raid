import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Button } from "../components/ui/button";
import { usePublicConfig } from "../lib/usePublicConfig";
import {
  OAUTH_STATE_KEY,
  OAUTH_VERIFIER_KEY,
  SILENT_STATE_KEY,
  SILENT_VERIFIER_KEY,
  exchangeCode,
  fetchDiscordGuilds,
  fetchDiscordUser,
  getSessionToken,
  newSessionToken,
  setSessionToken,
  storeDiscordAccess,
} from "../lib/discord";

export default function DiscordCallback() {
  const navigate = useNavigate();
  const { clientId, loading: configLoading, error: configError } = usePublicConfig();
  const login = useMutation(api.sessions.login);
  const refreshGuilds = useMutation(api.sessions.refreshGuilds);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (configLoading) return;
    if (configError) {
      setError("Không thể kết nối tới máy chủ Protogon. Vui lòng thử lại sau.");
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const oauthError = params.get("error");
    const savedState = sessionStorage.getItem(OAUTH_STATE_KEY);
    const verifier = sessionStorage.getItem(OAUTH_VERIFIER_KEY);
    const returnTo = sessionStorage.getItem("wio_oauth_return") ?? "/dashboard";

    async function run() {
      // Luồng làm mới im lặng (dashboard chuyển hướng tới đây, không đăng nhập mới).
      const silentState = sessionStorage.getItem(SILENT_STATE_KEY);
      const isSilent = !!silentState && silentState === state;
      if (isSilent) {
        sessionStorage.removeItem(SILENT_STATE_KEY);
        const silentVerifier = sessionStorage.getItem(SILENT_VERIFIER_KEY);
        sessionStorage.removeItem(SILENT_VERIFIER_KEY);
        const silentReturn = sessionStorage.getItem("wio_silent_return") ?? "/dashboard";
        sessionStorage.removeItem("wio_silent_return");
        async function runSilent() {
          if (oauthError || !code || !clientId || !silentVerifier) {
            window.location.replace(`${silentReturn}?silent=err`);
            return;
          }
          try {
            const oauth = await exchangeCode(clientId, code, silentVerifier);
            storeDiscordAccess(oauth);
            const sessToken = getSessionToken();
            if (sessToken) {
              const guilds = await fetchDiscordGuilds(oauth.access_token);
              await refreshGuilds({
                token: sessToken,
                guilds: guilds.map((g) => ({
                  id: g.id,
                  name: g.name,
                  icon: g.icon ?? undefined,
                  permissions: g.permissions,
                })),
              });
            }
            window.location.replace(`${silentReturn}?silent=ok`);
          } catch {
            window.location.replace(`${silentReturn}?silent=err`);
          }
        }
        void runSilent();
        return;
      }

      if (oauthError || !code) {
        setError(oauthError ?? "Thiếu mã xác nhận từ Discord.");
        return;
      }
      if (!clientId) {
        setError("DISCORD_CLIENT_ID chưa được cấu hình trong API Keys.");
        return;
      }
      if (!verifier || !savedState || savedState !== state) {
        setError("Phiên đăng nhập không hợp lệ. Vui lòng thử lại.");
        return;
      }
      try {
        const oauth = await exchangeCode(clientId, code, verifier);
        const { access_token } = oauth;
        // Lưu access token để dashboard tự làm mới danh sách server sau này.
        storeDiscordAccess(oauth);
        const [user, guilds] = await Promise.all([
          fetchDiscordUser(access_token),
          fetchDiscordGuilds(access_token),
        ]);
        const token = newSessionToken();
        await login({
          token,
          user: {
            discordId: user.id,
            username: user.username,
            globalName: user.global_name ?? undefined,
            avatar: user.avatar ?? undefined,
          },
          guilds: guilds.map((g) => ({
            id: g.id,
            name: g.name,
            icon: g.icon ?? undefined,
            permissions: g.permissions,
          })),
        });
        setSessionToken(token);
        sessionStorage.removeItem(OAUTH_VERIFIER_KEY);
        sessionStorage.removeItem(OAUTH_STATE_KEY);
        sessionStorage.removeItem("wio_oauth_return");
        navigate(returnTo.startsWith("/") ? returnTo : "/dashboard", { replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Đăng nhập thất bại, vui lòng thử lại.");
      }
    }
    void run();
  }, [clientId, configLoading, configError, login, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {error ? (
          <div className="rounded-2xl border border-danger/30 bg-danger/10 p-6">
            <AlertTriangle className="mx-auto h-8 w-8 text-danger" />
            <h1 className="mt-3 font-display text-lg font-semibold">Đăng nhập thất bại</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <div className="mt-5 flex justify-center gap-3">
              <Link to="/auth">
                <Button variant="secondary">Thử lại</Button>
              </Link>
              <Link to="/">
                <Button variant="ghost">Về trang chủ</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Đang xác thực với Discord…</p>
          </div>
        )}
      </div>
    </div>
  );
}
