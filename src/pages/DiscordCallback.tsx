import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAction } from "convex/react";
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
  getSessionToken,
  safeRedirectPath,
  setSessionToken,
  storeDiscordAccess,
} from "../lib/discord";

import { translate } from "../lib/i18n";
/**
 * Chuyển lỗi đăng nhập thành thông điệp người dùng hiểu được.
 * Đặc biệt: 15/09/2026 Discord gặp sự cố "Session Unavailability" (500) —
 * người dùng tưởng dashboard lỗi, cần nói rõ lỗi nằm ở phía Discord.
 * Server trả { ok: false, reason } thay vì throw (Convex prod mask message
 * của action thành "Server Error") — reason giờ luôn là text thật.
 */
function friendlyAuthError(raw: string): string {
  if (raw.includes("NEED_CLIENT_SECRET_EXCHANGE")) {
    return translate("Cấu hình đăng nhập chưa hoàn tất — thử lại sau ít phút.");
  }
  // Lỗi trao đổi token từ Discord (5xx) → Discord đang sự cố, không phải lỗi dashboard.
  const m = raw.match(/Discord token API lỗi (\d{3})/);
  if (m && Number(m[1]) >= 500) {
    return translate(
      "Discord đang gặp sự cố tạm thời (lỗi {p0} từ phía Discord). Vui lòng thử lại sau ít phút — trạng thái: status.discord.com",
      { p0: m[1] },
    );
  }
  if (/Không lấy được thông tin người dùng \((\d{3})\)/.test(raw)) {
    const code = raw.match(/\((\d{3})\)/)?.[1];
    if (code && Number(code) >= 500) {
      return translate(
        "Discord đang gặp sự cố tạm thời (lỗi {p0} từ phía Discord). Vui lòng thử lại sau ít phút — trạng thái: status.discord.com",
        { p0: code },
      );
    }
  }
  return raw || translate("Đăng nhập thất bại, vui lòng thử lại.");
}

export default function DiscordCallback() {
  const navigate = useNavigate();
  const { clientId, loading: configLoading, error: configError } = usePublicConfig();
  const exchangeAndLogin = useAction(api.sessionAuth.exchangeAndLogin);
  // Làm mới im lặng: server tự hỏi Discord bằng access token (client không tự báo).
  const refreshGuildsServer = useAction(api.sessionAuth.refreshGuildsServer);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (configLoading) return;
    if (configError) {
      setError(translate("Không thể kết nối tới máy chủ Protogon. Vui lòng thử lại sau."));
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
        const silentReturn = safeRedirectPath(sessionStorage.getItem("wio_silent_return"));
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
              await refreshGuildsServer({ token: sessToken, accessToken: oauth.access_token });
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
        setError(oauthError ?? translate("Thiếu mã xác nhận từ Discord."));
        return;
      }
      if (!clientId) {
        setError(translate("DISCORD_CLIENT_ID chưa được cấu hình trong API Keys."));
        return;
      }
      if (!verifier || !savedState || savedState !== state) {
        setError(translate("Phiên đăng nhập không hợp lệ. Vui lòng thử lại."));
        return;
      }
      try {
        // Đăng nhập an toàn: server tự trao đổi code với Discord (kèm
        // client_secret) và tự tạo session token — client không thể giả mạo
        // danh tính hay tự cấp token cho mình. Lỗi trả { ok: false, reason }
        // (không throw — Convex prod mask message action).
        let result = await exchangeAndLogin({
          code,
          codeVerifier: verifier,
          redirectUri: window.location.origin + "/discord/callback",
        });
        if (!result.ok && result.reason.includes("NEED_CLIENT_SECRET_EXCHANGE") && clientId) {
          // Fallback: deployment chưa có DISCORD_CLIENT_SECRET → web tự trao đổi
          // code bằng PKCE (OAuth gốc đã dùng S256 challenge nên code không thể
          // bị dùng bởi kẻ khác) rồi gửi access token lên — server vẫn xác thực
          // lại với Discord.
          const oauth = await exchangeCode(clientId, code, verifier);
          result = await exchangeAndLogin({
            code,
            codeVerifier: verifier,
            redirectUri: window.location.origin + "/discord/callback",
            accessToken: oauth.access_token,
          });
        }
        if (!result.ok || !result.token) {
          setError(friendlyAuthError(!result.ok ? (result.reason ?? "") : ""));
          return;
        }
        // Lưu access token để dashboard tự làm mới danh sách server sau này.
        storeDiscordAccess({
          access_token: result.accessToken,
          refresh_token: undefined,
          expires_in: undefined,
        });
        setSessionToken(result.token);
        sessionStorage.removeItem(OAUTH_VERIFIER_KEY);
        sessionStorage.removeItem(OAUTH_STATE_KEY);
        sessionStorage.removeItem("wio_oauth_return");
        navigate(safeRedirectPath(returnTo), { replace: true });
      } catch (e) {
        setError(friendlyAuthError(e instanceof Error ? e.message : ""));
      }
    }
    void run();
  }, [clientId, configLoading, configError, exchangeAndLogin, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {error ? (
          <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4 sm:p-6">
            <AlertTriangle className="mx-auto h-8 w-8 text-danger" />
            <h1 className="mt-3 font-display text-lg font-semibold">
              {translate("Đăng nhập thất bại")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <div className="mt-5 flex justify-center gap-3">
              <Link to="/auth">
                <Button variant="secondary">{translate("Thử lại")}</Button>
              </Link>
              <Link to="/">
                <Button variant="ghost">{translate("Về trang chủ")}</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">{translate("Đang xác thực với Discord…")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
