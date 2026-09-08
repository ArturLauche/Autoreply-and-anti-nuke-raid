import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  ArrowRight,
  Bot,
  Bug,
  Crown,
  Facebook,
  Flame,
  Gavel,
  Gift,
  Heart,
  LayoutDashboard,
  Lock,
  Mail,
  MessageCircle,
  MessageSquareReply,
  Palette,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  User,
  UserCheck,
  Zap,
} from "lucide-react";
import { ChevronDown, LogOut } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import CherryBlossom from "../components/CherryBlossom";
import BotLogo from "../components/BotLogo";
import HaimiyaChat, { HaimiyaAvatar } from "../components/HaimiyaChat";
import Taskbar from "../components/Taskbar";
import { useBranding } from "../lib/useBranding";
import { usePublicConfig } from "../lib/usePublicConfig";
import { useBotStatus } from "../lib/useBotStatus";
import {
  clearSessionToken,
  discordAvatarUrl,
  getSessionToken,
  setRememberLogin,
} from "../lib/discord";
import type { MeData } from "../lib/types";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

function Nav() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const token = getSessionToken();
  const me = useQuery(api.sessions.me, { token }) as MeData | null | undefined;
  const logout = useMutation(api.sessions.logout);
  const avatar = me?.user
    ? discordAvatarUrl({ id: me.user.discordId, avatar: me.user.avatar })
    : null;
  const [remember, setRemember] = useState(
    sessionStorage.getItem("wio_remember_login") !== "0",
  );

  async function handleLogout() {
    setMenuOpen(false);
    await logout({ token });
    clearSessionToken();
    navigate("/");
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="rounded-xl bg-gradient-to-br from-white/95 via-white/45 to-white/0 p-[2px] drop-shadow-[0_0_12px_rgba(255,255,255,0.75)]">
            <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#ff8fab] to-[#c84b8f] p-0.5 shadow-[0_0_20px_-4px_hsl(342_92%_66%/0.9)]">
              <BotLogo className="h-full w-full" />
            </span>
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            Protogon<span className="text-primary">.</span>
            <span className="ml-1.5 hidden align-middle text-xs font-semibold text-muted-foreground sm:inline">
              🌸 cùng trợ lý Haimiya
            </span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#features" className="transition-colors hover:text-foreground">Tính năng</a>
          <a href="#antinuke" className="transition-colors hover:text-foreground">Bảo vệ server</a>
          <a href="#haimiya" className="transition-colors hover:text-foreground">Haimiya</a>
          <a href="#how" className="transition-colors hover:text-foreground">Cách hoạt động</a>
        </nav>
        {me ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-full border border-border bg-card/70 py-1 pl-1 pr-2.5 transition-colors hover:bg-accent"
            >
              {avatar ? (
                <img src={avatar} alt={me.user.username} className="h-8 w-8 rounded-full ring-2 ring-primary/40" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                  {(me.user.globalName ?? me.user.username).slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="hidden max-w-[8rem] truncate text-sm font-medium sm:block">
                {me.user.globalName ?? me.user.username}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-border bg-card/95 p-2 shadow-2xl backdrop-blur">
                <div className="border-b border-border/70 px-2.5 pb-2 pt-1">
                  <p className="truncate text-sm font-bold">{me.user.globalName ?? me.user.username}</p>
                  <p className="truncate text-xs text-muted-foreground">{me.user.discordId}</p>
                </div>
                <Link
                  to="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="mt-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors hover:bg-accent"
                >
                  <LayoutDashboard className="h-4 w-4 text-primary" /> Bảng điều khiển
                </Link>
                <label className="mt-1 flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-accent">
                  <span className="text-xs text-muted-foreground">
                    Lưu đăng nhập <b className="text-foreground">(7 ngày)</b>
                  </span>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={remember}
                    onClick={(e) => {
                      e.preventDefault();
                      const next = !remember;
                      setRemember(next);
                      setRememberLogin(next);
                    }}
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                      remember ? "bg-primary" : "bg-secondary"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                        remember ? "left-[18px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </label>
                <button
                  onClick={handleLogout}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-danger/10"
                >
                  <LogOut className="h-4 w-4" /> Đăng xuất
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link to="/auth">
            <Button size="sm">Đăng nhập</Button>
          </Link>
        )}
      </div>
    </header>
  );
}

/**
 * Nút mở dashboard thông minh: nếu đã đăng nhập → vào thẳng /dashboard,
 * ngược lại → sang trang đăng nhập (kèm returnTo để quay lại sau khi đăng nhập).
 */
function DashboardCta({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "outline";
}) {
  const token = getSessionToken();
  const me = useQuery(api.sessions.me, { token }) as MeData | null | undefined;
  const loggedIn = token !== "" && me !== null;
  const to = loggedIn ? "/dashboard" : "/auth?returnTo=/dashboard";
  return (
    <Link to={to}>
      <Button size="lg" variant={variant}>
        {children}
      </Button>
    </Link>
  );
}

/** Thanh nhiệt mini mô phỏng trong mockup chat. */
function HeatBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function HeroChatCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32, rotate: 1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
      className="relative"
    >
      <div className="absolute -inset-6 rounded-3xl bg-glow-sakura blur-2xl" />
      <div className="relative rounded-2xl border border-border bg-[#1e1a20] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-black/40 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[#f23f43]" />
          <span className="h-3 w-3 rounded-full bg-[#f0b232]" />
          <span className="h-3 w-3 rounded-full bg-[#23a55a]" />
          <span className="ml-3 text-xs font-medium text-white/40"># general · Protogon Bot 🌸</span>
        </div>
        <div className="space-y-4 p-5 font-sans">
          {/* Auto reply */}
          <div className="flex items-end gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5865f2] text-xs font-bold text-white">Huy</span>
            <div className="max-w-[80%]">
              <p className="mb-1 text-xs font-semibold text-white">huy_nguyen <span className="ml-1 font-normal text-white/40">Hôm nay chơi gì @protogon?</span></p>
              <div className="rounded-lg rounded-bl-none bg-[#2b2d31] px-3 py-2 text-sm text-white/90">
                Hôm nay chơi gì? <span className="font-semibold text-[#ff8fab]">@protogon</span>
              </div>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ff8fab] to-[#c84b8f] text-primary-foreground shadow-[0_0_16px_-2px_hsl(342_92%_66%/0.9)]">
              <Bot className="h-5 w-5" />
            </span>
            <div className="max-w-[80%]">
              <p className="mb-1 text-xs font-semibold text-white">Protogon <span className="ml-1 font-normal text-white/40">BOT</span></p>
              <div className="rounded-lg rounded-bl-none border border-primary/40 bg-[#2b2d31] px-3 py-2 text-sm text-white/90">
                Chào <span className="font-semibold text-primary">Huy</span>! Hôm nay thử một trận Valorant 5v5 nhé 🎮
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-white/40">
                <Timer className="h-3 w-3" /> rule “game-night” · cooldown 30s
              </div>
            </div>
          </div>

          {/* Cảnh báo nhiệt */}
          <div className="rounded-lg border border-pink-400/30 bg-pink-500/10 px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-pink-300">
              <Flame className="h-4 w-4" /> NHIỆT ĐỘ VI PHẠM — THÀNH VIÊN “dang_spam”
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1">
                <HeatBar value={55} color="bg-gradient-to-r from-amber-500 via-pink-500 to-red-500" />
                <div className="mt-1 flex justify-between text-[10px] text-white/40">
                  <span>warn 25</span><span>tạm khóa 40</span><span>kick 70</span><span>ban 90</span>
                </div>
              </div>
              <span className="shrink-0 rounded-md bg-pink-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-pink-300">55/100</span>
            </div>
            <p className="mt-1.5 text-[11px] text-white/60">
              Tái phạm trong 30 phút → nhiệt <b className="text-pink-300">×2</b> · đã gửi DM cảnh báo ⚠️
            </p>
          </div>

          {/* Join gate */}
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <UserCheck className="h-4 w-4" /> JOIN GATE — TỰ ĐỘNG CHẶN SELFBOT
            </div>
            <p className="mt-1 text-[11px] text-white/60">
              🚪 <span className="font-mono text-white/80">selfbot_9123</span> bị chặn: tài khoản{" "}
              <b className="text-emerald-300">mới 2 ngày</b>, không avatar, không huy hiệu → đã kick.
            </p>
          </div>
        </div>
      </div>
      <div className="absolute -right-3 -top-3 animate-float">
        <Badge variant="success" className="gap-1.5 border border-emerald-500/40 bg-[#0b1410] px-3 py-1 shadow-xl">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          Bot đang trực tuyến
        </Badge>
      </div>
    </motion.div>
  );
}

function Features() {
  const items = [
    {
      icon: MessageSquareReply,
      title: "Tự trả lời thông minh",
      desc: "Rule theo từ khóa hoặc @mention, hỗ trợ {user}, {username}, cooldown chống spam. Trả lời ngay, đúng giọng server của bạn.",
    },
    {
      icon: Flame,
      title: "Hệ thống nhiệt độ 4 giai đoạn",
      desc: "Mỗi vi phạm cộng điểm nhiệt; đủ ngưỡng tự tăng cấp: cảnh báo DM → tạm khóa → kick → ban. Hạ nhiệt theo phút, tái phạm bị ×2 nhiệt.",
    },
    {
      icon: ShieldCheck,
      title: "Moderation lọc nội dung",
      desc: "Chống spam tin nhắn, spam mention, từ ngữ xấu, spam ảnh/file và chặn link mời Discord — kèm warn tích lũy tăng cấp hình phạt.",
    },
    {
      icon: Bug,
      title: "Chặn link độc hại & file nguy hiểm",
      desc: "Phát hiện domain lừa đảo (nitro giả, gift giả, crypto scam…), link IP và file đuôi nguy hiểm (.exe, .scr, .bat…) — xóa tin + cảnh báo ngay.",
    },
    {
      icon: UserCheck,
      title: "Join Gate chống selfbot",
      desc: "Cổng vào server: chặn tài khoản quá mới, không avatar, không huy hiệu và mọi lượt vào khi đang bị raid — kèm danh sách trắng.",
    },
    {
      icon: ShieldAlert,
      title: "Chống nuke & raid",
      desc: "8 module phát hiện ban/kick hàng loạt, raid thành viên, tạo/xóa kênh, role, xóa tin — phạt trực tiếp + khóa kênh tự động khi bị tấn công.",
    },
    {
      icon: Gavel,
      title: "Công cụ Mod",
      desc: "/mod timeout · kick · ban · purge — ghi đầy đủ lý do + người thực hiện vào kênh log. Lệnh text: !timeout !kick !ban !purge.",
    },
  ];
  return (
    <section id="features" className="relative py-24">
      <div className="container">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mx-auto max-w-2xl text-center"
        >
          <motion.div variants={fadeUp}>
            <Badge className="mb-4"><Sparkles className="h-3.5 w-3.5" /> Mọi thứ trong một bot</Badge>
          </motion.div>
          <motion.h2 variants={fadeUp} className="font-display text-3xl font-bold tracking-tight md:text-5xl">
            Bảo vệ toàn diện & <span className="text-gradient-sakura">giao tiếp</span> cho server của bạn
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-4 text-muted-foreground">
            Từ tự trả lời thông minh đến 14 module bảo vệ — Protogon canh server 24/7 và cấu hình mọi thứ qua dashboard trực quan, có trợ lý Haimiya sẵn sàng giải đáp.
          </motion.p>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {items.map((f) => (
            <motion.div key={f.title} variants={fadeUp}>
              <div className="card-hover group h-full rounded-xl border border-border bg-card p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Dải điểm nổi bật thêm */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="mt-10 grid gap-3 rounded-2xl border border-border bg-card/60 p-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {[
            { icon: Crown, t: "Warn tích lũy", d: "Đủ N lần warn → tự tăng cấp hình phạt" },
            { icon: LayoutDashboard, t: "Bảng nhiệt & warn", d: "Xem từng thành viên, xóa nhiệt 1 cú nhấn" },
            { icon: Zap, t: "Đồng bộ tự động", d: "Chỉnh trên web → bot áp dụng trong vài phút" },
            { icon: Timer, t: "Báo cáo hàng ngày", d: "Tóm tắt sự kiện, nhiệt & warn gửi vào kênh log" },
          ].map((b) => (
            <div key={b.t} className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <b.icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">{b.t}</p>
                <p className="text-xs text-muted-foreground">{b.d}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/** Tính năng ẩn dành riêng cho admin — bảo vệ bằng mật khẩu. */
function HiddenFeatures() {
  const items = [
    {
      icon: ShieldCheck,
      title: "Reaction Role",
      desc: "Thành viên bấm emoji dưới tin nhắn là tự nhận / gỡ role — tạo & chỉnh bảng ngay trên dashboard hoặc bằng /reactionrole create · add · edit (kèm !reactionrole).",
    },
    {
      icon: Palette,
      title: "Tùy chỉnh giao diện",
      desc: "Đổi avatar bot & trợ lý AI Haimiya ngay từ web — áp dụng toàn bộ trang chủ, đăng nhập và dashboard.",
    },
    {
      icon: Gift,
      title: "Giveaway 🎉",
      desc: "Nhiều mẫu tin nhắn (mặc định, sang trọng, VIP, nhanh gọn), chèn ảnh, lời dẫn tùy chỉnh, tự cấp role thưởng cho người thắng — tạo được qua dashboard, /giveaway start hoặc !giveaway start.",
    },
    {
      icon: Mail,
      title: "Gửi DM trực tiếp",
      desc: "Nhập ID người dùng + nội dung trên dashboard — bot nhắn riêng cho họ ngay lập tức.",
    },
    {
      icon: MessageSquareReply,
      title: "Auto Reply cho admin",
      desc: "Quản lý rule tự trả lời được chuyển vào khu vực ẩn — chỉ người biết mật khẩu mới chỉnh được.",
    },
  ];
  return (
    <section className="relative py-16">
      <div className="container">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="mx-auto max-w-2xl text-center"
        >
          <motion.div variants={fadeUp}>
            <Badge className="mb-4 border-primary/40 bg-primary/10 text-primary">
              <Lock className="h-3.5 w-3.5" /> Tính năng ẩn — dành riêng admin
            </Badge>
          </motion.div>
          <motion.h2 variants={fadeUp} className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Mở khóa bằng <span className="text-gradient-sakura">mật khẩu bí mật</span> 🔒
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-3 text-muted-foreground">
            Quản trị viên đặt mật khẩu trong Cài đặt — ai đăng nhập cũng thấy giao diện bình
            thường, chỉ người nhập đúng mật khẩu mới thấy khu vực quyền lực này.
          </motion.p>
        </motion.div>
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {items.map((f) => (
            <motion.div key={f.title} variants={fadeUp}>
              <div className="card-hover h-full rounded-xl border border-primary/20 bg-gradient-to-b from-card to-primary/5 p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/** Thang nhiệt 4 giai đoạn — trực quan + sinh động. */
function HeatLadder() {
  const tiers = [
    { label: "Cảnh báo", range: "25 → 39", color: "from-amber-400 to-yellow-300", text: "text-amber-400", bar: "bg-amber-500/70" },
    { label: "Tạm khóa", range: "40 → 69", color: "from-pink-400 to-rose-300", text: "text-pink-400", bar: "bg-pink-500/70" },
    { label: "Kick", range: "70 → 89", color: "from-orange-400 to-amber-300", text: "text-orange-400", bar: "bg-orange-500/70" },
    { label: "Ban", range: "90 → 100", color: "from-red-400 to-rose-300", text: "text-red-400", bar: "bg-red-500/70" },
  ];
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
        <Flame className="h-4 w-4 text-orange-400" /> Thang nhiệt tự leo thang hình phạt
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        {tiers.map((t, i) => (
          <motion.div
            key={t.label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className={`rounded-lg border border-border bg-gradient-to-b ${t.color} p-3`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-black/70">{t.label}</span>
              <span className="font-mono text-[10px] font-semibold text-black/60">{t.range}</span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-black/20">
              <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${(i + 1) * 25}%` }} />
            </div>
          </motion.div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Vừa bị phạt mà tái phạm → nhiệt nhân <b className="text-pink-400">×2</b> trong 30 phút. Warn tích lũy chạy song song: đủ 3 lần warn → tự tăng cấp.
      </p>
    </div>
  );
}

function AntiNuke() {
  const nukeModules = [
    "Chống ban hàng loạt", "Chống kick hàng loạt", "Chống raid thành viên",
    "Chống tạo kênh spam", "Chống xóa kênh hàng loạt", "Chống tạo role spam",
    "Chống xóa role hàng loạt", "Chống xóa tin hàng loạt",
  ];
  const modModules = [
    "Chống spam tin nhắn", "Chống spam mention", "Lọc từ ngữ xấu",
    "Chống spam ảnh/file", "Chặn link mời Discord", "Chặn link độc hại & file nguy hiểm",
  ];
  return (
    <section id="antinuke" className="relative overflow-hidden py-24">
      <div className="absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(60%_60%_at_50%_40%,black,transparent)]" />
      <div className="container relative">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="danger" className="mb-4"><ShieldAlert className="h-3.5 w-3.5" /> Phòng thủ 14 module</Badge>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
              Chặn đứng kẻ phá hoại <br />
              trước khi <span className="text-gradient-sakura">server sụp đổ</span>
            </h2>
            <p className="mt-4 max-w-lg text-muted-foreground">
              Hai lớp phòng thủ: <b className="text-foreground">Anti Nuke</b> canh cấu trúc server (ban/kick hàng loạt, phá kênh, phá role…) và{" "}
              <b className="text-foreground">Moderation</b> lọc nội dung độc hại mỗi ngày. Vượt ngưỡng → xác định thủ phạm qua audit log, phạt theo cài đặt và cảnh báo real-time tới kênh log.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["Phạt trực tiếp", "Khóa kênh khi raid", "Miễn trừ role", "Kênh log riêng", "Báo cáo hàng ngày"].map((t) => (
                <span key={t} className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs text-muted-foreground">
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-8">
              <HeatLadder />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="rounded-2xl border border-border bg-card p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-display font-semibold">
                <ShieldCheck className="h-5 w-5 text-primary" /> Module đang bảo vệ
              </div>
              <Badge variant="success">14/14 bật</Badge>
            </div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              🛡️ Anti Nuke / Raid — phạt trực tiếp
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {nukeModules.map((m) => (
                <div key={m} className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2">
                  <span className="text-sm">{m}</span>
                  <span className="relative ml-2 flex h-4 w-7 items-center rounded-full bg-primary px-0.5">
                    <span className="ml-auto h-3 w-3 rounded-full bg-white" />
                  </span>
                </div>
              ))}
            </div>
            <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              🧹 Moderation nội dung — cộng nhiệt + warn
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {modModules.map((m) => (
                <div key={m} className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2">
                  <span className="text-sm">{m}</span>
                  <span className="relative ml-2 flex h-4 w-7 items-center rounded-full bg-primary px-0.5">
                    <span className="ml-auto h-3 w-3 rounded-full bg-white" />
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100/70">
              <span className="font-semibold text-amber-300">🔒 Khóa kênh khi raid:</span> vượt ngưỡng bất kỳ module nào → bot chặn thành viên gửi tin trong toàn server, tự mở lại sau vài phút hoặc khi mod dùng <code className="font-mono">/antinuke unlock</code>.
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/** Gặp gỡ Haimiya-senpai — trợ lý ảo. */
function HaimiyaSection() {
  const branding = useBranding();
  return (
    <section id="haimiya" className="relative overflow-hidden py-24">
      <div className="absolute inset-x-0 bottom-0 h-[420px] bg-glow-sky" />
      <div className="container relative">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="order-2 lg:order-1"
          >              <div className="relative mx-auto w-fit">
              <div className="absolute -inset-8 rounded-full bg-glow-sakura blur-2xl" />
              <div className="relative animate-float">
                <div className="flex h-64 w-64 items-center justify-center rounded-full border-2 border-white/80 bg-gradient-to-br from-[#ffe0ed] via-[#fdf2f8] to-[#d6ecff] shadow-[0_24px_60px_-20px_hsl(342_60%_55%/0.45)]">
                  <HaimiyaAvatar className="h-48 w-48" src={branding?.haimiyaAvatarUrl ?? null} />
                </div>
                <span className="absolute -right-2 top-6 animate-float text-2xl" style={{ animationDelay: "0.6s" }}>🌸</span>
                <span className="absolute -left-3 bottom-14 animate-float text-xl" style={{ animationDelay: "1.2s" }}>🎀</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="order-1 lg:order-2"
          >
            <Badge className="mb-4"><Heart className="h-3.5 w-3.5" /> Gặp gỡ trợ lý ảo</Badge>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
              Haimiya — <span className="text-gradient-sakura">trợ lý ảo đáng tin cậy</span>
            </h2>
            <p className="mt-4 max-w-lg text-muted-foreground">
              Lấy cảm hứng từ nhân vật "đáng sợ mà đáng yêu" — Haimiya là trợ lý ảo của Protogon,
              luôn túc trực trên website và dashboard. Tôi giải đáp mọi thắc mắc về bot bằng tiếng Việt:
              hệ thống nhiệt độ, warn tích lũy, Join Gate, chống nuke/raid, auto reply, cách host bot…
            </p>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
              {[
                "Giải đáp tức thì, 24/7 — không cần chờ đợi",
                "Biết rõ từng tính năng & cách cấu hình của Protogon",
                "Trả lời rõ ràng, nghiêm túc — trên web lẫn trong dashboard",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs text-primary">🌸</span>
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={() => window.dispatchEvent(new Event("haimiya-open"))}
              >
                <MessageCircle className="h-4 w-4" /> Hỏi thử Haimiya ngay
              </Button>
              <DashboardCta variant="outline">
                Vào dashboard <ArrowRight className="h-4 w-4" />
              </DashboardCta>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      icon: Bot,
      title: "Tạo ứng dụng Discord",
      desc: "Tạo bot trên Discord Developer Portal, lấy token và Client ID, dán vào API Keys của Protogon.",
    },
    {
      n: "02",
      icon: ShieldCheck,
      title: "Mời bot vào server",
      desc: "Nhấn Mời bot, chọn server của bạn — Protogon tự động tạo cấu hình mặc định an toàn với đủ 14 module.",
    },
    {
      n: "03",
      icon: LayoutDashboard,
      title: "Cấu hình trên dashboard",
      desc: "Thêm rule trả lời, chỉnh nhiệt độ & warn, bật Join Gate, chọn hình phạt — mọi thứ hiệu lực trong vài phút.",
    },
  ];
  return (
    <section id="how" className="py-24">
      <div className="container">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mx-auto max-w-2xl text-center"
        >
          <motion.div variants={fadeUp}>
            <Badge className="mb-4"><Zap className="h-3.5 w-3.5" /> Bắt đầu nhanh</Badge>
          </motion.div>
          <motion.h2 variants={fadeUp} className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Hoạt động trong <span className="text-gradient-sakura">3 bước</span>
          </motion.h2>
        </motion.div>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="relative rounded-xl border border-border bg-card p-6"
            >
              <span className="font-mono text-4xl font-bold text-primary/25">{s.n}</span>
              <div className="mt-2 flex items-center gap-3">
                <s.icon className="h-5 w-5 text-primary" />
                <h3 className="font-display text-lg font-semibold">{s.title}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBanner() {
  const branding = useBranding();
  return (
    <section className="py-16">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-br from-[#ffdcec] via-[#fff7fa] to-[#cfe8ff] p-8 text-center shadow-xl md:p-16 dark:border-white/10 dark:from-[#2b1c33] dark:via-[#241c33] dark:to-[#152238]"
        >
          <div className="absolute inset-0 bg-glow-sakura opacity-50" />
          <div className="absolute inset-0 bg-glow-sky opacity-60" />
          <div className="relative">
            <HaimiyaAvatar
              className="mx-auto h-28 w-28 drop-shadow-[0_10px_30px_hsl(342_92%_66%/0.4)]"
              src={branding?.haimiyaAvatarUrl ?? null}
            />
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight md:text-5xl">
              Sẵn sàng để Haimiya <br className="hidden md:block" /> hỗ trợ bạn quản lý server?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Đăng nhập bằng Discord, mời Protogon vào server — nhiệt độ, Join Gate, lọc nội dung, chống nuke và trợ lý ảo bật ngay lập tức. Miễn phí cho mọi server.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <DashboardCta>
                Bắt đầu ngay <ArrowRight className="h-4 w-4" />
              </DashboardCta>
              <Button size="lg" variant="outline" onClick={() => window.dispatchEvent(new Event("haimiya-open"))}>
                <MessageCircle className="h-4 w-4" /> Trò chuyện với Haimiya
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default function Landing() {
  const branding = useBranding();
  const { discordInvite, facebookUrl } = usePublicConfig();
  const botStatus = useBotStatus();
  const ownerName = botStatus?.ownerName ?? "wiothemilo";
  const ownerAvatar = botStatus?.ownerAvatarUrl ?? null;
  return (
    <div className="relative min-h-screen text-foreground">
      <CherryBlossom count={18} />
      <HaimiyaChat />
      <Taskbar />
      <div className="relative z-10">
        <Nav />
        <main>
          <section className="relative overflow-hidden pb-16 pt-28 md:pb-20 md:pt-32">
            <div className="absolute inset-0 bg-grid opacity-50 [mask-image:radial-gradient(70%_60%_at_50%_30%,black,transparent)]" />
            <div className="absolute inset-x-0 top-0 h-[420px] bg-glow-sakura" />
            <div className="absolute inset-x-0 bottom-0 h-[320px] bg-glow-sky" />
            <div className="container relative grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
              <div>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="flex flex-col items-center gap-4 text-center lg:block lg:text-left"
                >
                  <span className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-white/70 bg-gradient-to-br from-[#ffe0ed] to-[#d8ecff] shadow-[0_10px_30px_-10px_hsl(342_70%_60%/0.5)] lg:hidden">
                    <HaimiyaAvatar className="h-20 w-20" src={branding?.haimiyaAvatarUrl ?? null} />
                  </span>
                  <Badge variant="secondary" className="border border-primary/30">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                    </span>
                    Discord Bot · Nhiệt độ · Join Gate · Tính năng ẩn 🔒
                  </Badge>
                </motion.div>
                <motion.h1
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.1 }}
                  className="mt-4 text-center font-display text-3xl font-bold leading-[1.12] tracking-tight sm:text-4xl md:text-6xl lg:mt-0 lg:text-left"
                >
                  Bot Discord <span className="text-gradient-sakura">bảo vệ toàn diện</span>
                  <br />
                  tự trả lời & <span className="shimmer-text">chống raid</span>
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.2 }}
                  className="mx-auto mt-5 max-w-lg text-center text-base text-muted-foreground sm:text-lg lg:mx-0 lg:text-left"
                >
                  Tag <span className="font-mono text-primary">@protogon</span> hoặc nhắc từ khóa — bot trả lời ngay. Hệ thống{" "}
                  <b className="text-foreground">nhiệt độ 4 giai đoạn</b> kèm warn tích lũy,{" "}
                  <b className="text-foreground">Join Gate chống selfbot</b>,{" "}
                  <b className="text-foreground">chặn link độc hại & file nguy hiểm</b> và{" "}
                  <b className="text-foreground">14 module bảo vệ</b> canh server 24/7.
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.3 }}
                  className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
                >
                  <DashboardCta>
                    Mở dashboard <ArrowRight className="h-4 w-4" />
                  </DashboardCta>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => window.dispatchEvent(new Event("haimiya-open"))}
                  >
                    <HaimiyaAvatar className="h-6 w-6" src={branding?.haimiyaAvatarUrl ?? null} /> Hỏi Haimiya
                  </Button>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                  className="mx-auto mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-border pt-6 lg:mx-0"
                >
                  {[
                    ["14", "Module bảo vệ"],
                    ["4", "Giai đoạn nhiệt"],
                    ["24/7", "Giám sát tự động"],
                  ].map(([v, l]) => (
                    <div key={l}>
                      <p className="font-display text-2xl font-bold text-primary">{v}</p>
                      <p className="text-xs text-muted-foreground">{l}</p>
                    </div>
                  ))}
                </motion.div>
              </div>
              <div className="hidden lg:block">
                <HeroChatCard />
              </div>
            </div>
          </section>

          <Features />
          <HiddenFeatures />
          <AntiNuke />
          <HaimiyaSection />
          <HowItWorks />
          <CtaBanner />
        </main>
        <footer className="border-t border-border py-10">
          <div className="container">
            <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-gradient-to-br from-white/95 via-white/45 to-white/0 p-[2px] drop-shadow-[0_0_10px_rgba(255,255,255,0.7)]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#ff8fab] to-[#c84b8f] p-0.5">
                    <HaimiyaAvatar className="h-full w-full" src={branding?.haimiyaAvatarUrl ?? null} />
                  </span>
                </span>
                <div>
                  <p className="font-display font-semibold">Protogon Bot</p>
                  <p className="text-xs text-muted-foreground">
                    Bot Discord bảo vệ server · trợ lý Haimiya 🌸
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <a href={discordInvite} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">
                    <MessageCircle className="h-4 w-4 text-indigo-500" />
                    Discord server
                  </Button>
                </a>
                <a href={facebookUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">
                    <Facebook className="h-4 w-4 text-sky-500" />
                    Fanpage Facebook
                  </Button>
                </a>
              </div>
            </div>
            <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 md:flex-row">
              <p className="text-center text-sm text-muted-foreground">
                © {new Date().getFullYear()} Protogon Bot · Tự trả lời thông minh, nhiệt độ vi phạm, Join Gate & phòng thủ chống raid cho Discord
              </p>
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                {ownerAvatar ? (
                  <img
                    src={ownerAvatar}
                    alt={ownerName}
                    className="h-8 w-8 rounded-full object-cover ring-2 ring-white/70"
                    draggable={false}
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#8fc8ff] to-[#f79fc6] text-white">
                    <User className="h-4 w-4" />
                  </span>
                )}
                <span>
                  Chủ bot: <b className="text-foreground">{ownerName}</b>
                  <span className="ml-1.5 hidden sm:inline">· cập nhật 24/7</span>
                </span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
