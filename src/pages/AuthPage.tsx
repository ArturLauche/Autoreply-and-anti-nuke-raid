import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Bot, ExternalLink, KeyRound, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import CherryBlossom from "../components/CherryBlossom";
import HaimiyaChat from "../components/HaimiyaChat";
import { usePublicConfig } from "../lib/usePublicConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import {
  OAUTH_VERIFIER_KEY,
  OAUTH_STATE_KEY,
  buildAuthorizeUrl,
  generateChallenge,
  generateVerifier,
  randomState,
} from "../lib/discord";

const DISCORD_LOGO = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
    <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

export default function AuthPage() {
  const { clientId, loading: configLoading, error: configError } = usePublicConfig();
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const returnTo =
    new URLSearchParams(location.search).get("returnTo") ?? "/dashboard";

  async function startOAuth() {
    if (!clientId) return;
    setLoading(true);
    try {
      const verifier = generateVerifier();
      const challenge = await generateChallenge(verifier);
      const state = randomState();
      sessionStorage.setItem(OAUTH_VERIFIER_KEY, verifier);
      sessionStorage.setItem(OAUTH_STATE_KEY, state);
      sessionStorage.setItem("wio_oauth_return", returnTo);
      window.location.href = buildAuthorizeUrl(clientId, state, challenge);
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <CherryBlossom count={12} />
      <div className="absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(60%_60%_at_50%_40%,black,transparent)]" />
      <div className="absolute inset-x-0 top-0 h-[360px] bg-glow-sakura" />
      <div className="absolute inset-x-0 bottom-0 h-[300px] bg-glow-sky" />
      <HaimiyaChat position="dashboard" />

      <div className="relative grid w-full max-w-4xl gap-8 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="hidden flex-col justify-center lg:flex"
        >
          <Link to="/" className="mb-8 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff8fab] to-[#c84b8f] shadow-[0_0_20px_-4px_hsl(342_92%_66%/0.8)]">
              <Bot className="h-5 w-5" />
            </span>
            <span className="font-display text-xl font-bold">Protogon<span className="text-primary">.</span></span>
          </Link>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight">
            Quản lý bot Discord của bạn <span className="text-gradient-sakura">từ một nơi</span>
          </h1>
          <ul className="mt-8 space-y-4">
            {[
              "Hệ thống nhiệt độ 4 giai đoạn + warn tích lũy",
              "Join Gate chống selfbot khi vào server",
              "Chặn link độc hại & file nguy hiểm",
              "Chống nuke/raid + auto reply, đồng bộ 30 giây",
            ].map((t) => (
              <li key={t} className="flex items-center gap-3 text-muted-foreground">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Card className="border-border/80 bg-card/70 shadow-2xl backdrop-blur">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Đăng nhập vào Protogon</CardTitle>
              <CardDescription>
                Sử dụng tài khoản Discord để quản lý các server của bạn
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {configLoading ? (
                // Đang tải cấu hình — chỉ hiện spinner nhỏ, không hiện hộp cảnh báo vàng
                <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/30 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Đang kết nối…
                </div>
              ) : clientId ? (
                <Button
                  size="lg"
                  className="w-full bg-[#5865f2] text-white shadow-none hover:bg-[#4752c4]"
                  onClick={startOAuth}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : DISCORD_LOGO}
                  {loading ? "Đang chuyển tới Discord…" : "Đăng nhập với Discord"}
                </Button>
              ) : configError ? (
                <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm">
                  <p className="flex items-center gap-2 font-semibold text-danger">
                    <ShieldCheck className="h-4 w-4" /> Không kết nối được máy chủ
                  </p>
                  <p className="mt-2 leading-relaxed text-danger/80">
                    Máy chủ backend của Protogon hiện không truy cập được từ trang
                    web này (lỗi kết nối Convex). Nếu bạn là quản trị viên, hãy
                    kiểm tra cấu hình{" "}
                    <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs">VITE_CONVEX_URL</code>{" "}
                    và thử lại sau ít phút.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                  <p className="flex items-center gap-2 font-semibold text-amber-400">
                    <KeyRound className="h-4 w-4" /> Cần cấu hình Client ID
                  </p>
                  <p className="mt-2 leading-relaxed text-amber-100/80">
                    Để đăng nhập, bạn cần tạo ứng dụng Discord và điền{" "}
                    <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs">DISCORD_CLIENT_ID</code>{" "}
                    vào mục API Keys. Cách làm:
                  </p>
                  <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-amber-100/70">
                    <li>Tạo bot tại Discord Developer Portal</li>
                    <li>Sao chép <b>Application ID</b> (Client ID)</li>
                    <li>Dán vào API Keys với tên <b>DISCORD_CLIENT_ID</b></li>
                    <li>
                      Thêm redirect URI <code className="rounded bg-black/30 px-1 font-mono text-xs">{window.location.origin}/discord/callback</code>{" "}
                      vào <b>OAuth2 → Redirects</b> của ứng dụng
                    </li>
                  </ol>
                </div>
              )}

              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                Khi đăng nhập, Protogon cần quyền <b className="text-foreground">identify</b> và{" "}
                <b className="text-foreground">guilds</b> để hiển thị server bạn quản lý.
                Chúng tôi không lưu mật khẩu hay tin nhắn của bạn.
              </p>

              <div className="flex items-center justify-between border-t border-border pt-4 text-xs">
                <Link to="/" className="text-muted-foreground transition-colors hover:text-primary">
                  ← Về trang chủ
                </Link>
                <a
                  href="https://discord.com/developers/applications"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-primary"
                >
                  Discord Developer Portal <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
