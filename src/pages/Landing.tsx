import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Command,
  Crown,
  LayoutDashboard,
  MessageSquareReply,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Timer,
  Zap,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_0_20px_-4px_hsl(187_92%_55%/0.8)]">
            <Bot className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            Wio<span className="text-primary">.</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#features" className="transition-colors hover:text-foreground">Tính năng</a>
          <a href="#antinuke" className="transition-colors hover:text-foreground">Chống nuke</a>
          <a href="#how" className="transition-colors hover:text-foreground">Cách hoạt động</a>
        </nav>
        <Link to="/auth">
          <Button size="sm">Đăng nhập</Button>
        </Link>
      </div>
    </header>
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
      <div className="absolute -inset-6 rounded-3xl bg-glow-cyan blur-2xl" />
      <div className="relative rounded-2xl border border-border bg-[#1e1f22] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-black/40 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[#f23f43]" />
          <span className="h-3 w-3 rounded-full bg-[#f0b232]" />
          <span className="h-3 w-3 rounded-full bg-[#23a55a]" />
          <span className="ml-3 text-xs font-medium text-white/40"># general · Wio Bot</span>
        </div>
        <div className="space-y-4 p-5 font-sans">
          <div className="flex items-end gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5865f2] text-xs font-bold text-white">Huy</span>
            <div className="max-w-[80%]">
              <p className="mb-1 text-xs font-semibold text-white">huy_nguyen <span className="ml-1 font-normal text-white/40">Hôm nay chơi gì mọi người? @wio</span></p>
              <div className="rounded-lg rounded-bl-none bg-[#2b2d31] px-3 py-2 text-sm text-white/90">
                Hôm nay chơi gì mọi người? <span className="font-semibold text-[#7289da]">@wio</span>
              </div>
            </div>
          </div>

          <div className="flex items-end gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_16px_-2px_hsl(187_92%_55%/0.9)]">
              <Bot className="h-5 w-5" />
            </span>
            <div className="max-w-[80%]">
              <p className="mb-1 text-xs font-semibold text-white">Wio <span className="ml-1 font-normal text-white/40">BOT</span></p>
              <div className="rounded-lg rounded-bl-none border border-primary/40 bg-[#2b2d31] px-3 py-2 text-sm text-white/90">
                Chào <span className="font-semibold text-primary">Huy</span>! Hôm nay thử một trận Valorant 5v5 nhé 🎮 — mọi người ai chưa có team thì tag tớ nhé!
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-white/40">
                <Timer className="h-3 w-3" /> trả lời theo rule “game-night” · cooldown 30s
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-red-400">
              <ShieldAlert className="h-4 w-4" /> CẢNH BÁO CHỐNG NUKE
            </div>
            <p className="mt-1 text-xs text-white/70">
              Phát hiện <span className="font-semibold text-red-400">6 lượt ban trong 10 giây</span> — đã <span className="font-semibold text-red-400">ban</span> thủ phạm và gửi log cho đội ngũ quản trị.
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
      title: "Tự trả lời theo từ khóa",
      desc: "Cấu hình phản hồi tùy chỉnh cho từ khóa hoặc khi bot bị tag @mention. Hỗ trợ placeholder {user}, {username}, cooldown chống spam.",
    },
    {
      icon: ShieldAlert,
      title: "Chống nuke & raid",
      desc: "9 module phát hiện ban/kick hàng loạt, raid thành viên, spam tin nhắn, tạo/xóa kênh, role và xóa tin — kèm khóa kênh tự động khi bị tấn công.",
    },
    {
      icon: Command,
      title: "Prefix + Slash command",
      desc: "Đầy đủ lệnh cơ bản: !help, !prefix, !autoreply, !antinuke, !setlog… và bản slash command tương ứng /autoreply, /antinuke.",
    },
    {
      icon: LayoutDashboard,
      title: "Dashboard quản trị",
      desc: "Quản lý mọi thứ bằng giao diện web: thêm rule, chỉnh threshold, chọn role được miễn trừ, chọn kênh log — không cần code.",
    },
    {
      icon: Zap,
      title: "Áp dụng tức thì",
      desc: "Cấu hình từ dashboard được bot đồng bộ trong vòng 30 giây, tự động cho mọi server bạn đang quản lý.",
    },
    {
      icon: Crown,
      title: "Quyền theo vai trò",
      desc: "Phân quyền linh hoạt: role Mod / Admin được miễn trừ khỏi chống nuke, chỉ chủ server và mod mới chỉnh được cấu hình.",
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
            Công cụ bảo vệ & <span className="text-gradient-cyan">giao tiếp</span> cho server của bạn
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-4 text-muted-foreground">
            Wio kết hợp tự động trả lời thông minh và phòng thủ chống raid trong một bot duy nhất — cấu hình nhanh qua dashboard.
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
      </div>
    </section>
  );
}

function AntiNuke() {
  const modules = [
    "Chống ban hàng loạt", "Chống kick hàng loạt", "Chống raid thành viên",
    "Chống tạo kênh spam", "Chống xóa kênh hàng loạt", "Chống tạo role spam",
    "Chống xóa role hàng loạt", "Chống xóa tin hàng loạt", "Chống spam tin nhắn",
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
            <Badge variant="danger" className="mb-4"><ShieldAlert className="h-3.5 w-3.5" /> Anti Nuke Raid</Badge>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
              Chặn đứng kẻ phá hoại <br />
              trước khi <span className="text-gradient-cyan">server sụp đổ</span>
            </h2>
            <p className="mt-4 max-w-lg text-muted-foreground">
              Khi vượt ngưỡng trong một khoảng thời gian ngắn, Wio tự động xác định thủ phạm qua audit log và xử lý theo chuỗi leo thang bạn chọn — kèm cảnh báo real-time tới kênh log.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["Cảnh báo", "Kick", "Ban", "Miễn trừ role", "Kênh log riêng"].map((t) => (
                <span key={t} className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs text-muted-foreground">
                  {t}
                </span>
              ))}
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
              <Badge variant="success">9/9 bật</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {modules.map((m) => (
                <div key={m} className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
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
            <div className="mt-2 rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Ví dụ:</span> ai đó ban 5 thành viên trong 10 giây → Wio kiểm tra quyền, cảnh báo trong #logs, tự động ban thủ phạm và khóa kênh. Mod & Admin được miễn trừ.
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
      desc: "Tạo bot trên Discord Developer Portal, lấy token và Client ID, dán vào API Keys của Wio.",
    },
    {
      n: "02",
      icon: ShieldCheck,
      title: "Mời bot vào server",
      desc: "Nhấn Mời bot, chọn server của bạn — Wio tự động tạo cấu hình mặc định an toàn.",
    },
    {
      n: "03",
      icon: LayoutDashboard,
      title: "Cấu hình trên dashboard",
      desc: "Thêm rule trả lời, chỉnh ngưỡng chống nuke, phân quyền mod/admin chỉ trong vài phút.",
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
            Hoạt động trong <span className="text-gradient-cyan">3 bước</span>
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
  return (
    <section className="py-16">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/15 via-card to-card p-10 text-center md:p-16"
        >
          <div className="absolute inset-0 bg-glow-cyan opacity-60" />
          <div className="relative">
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
              Sẵn sàng bảo vệ server của bạn?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Đăng nhập bằng Discord, mời Wio vào server và bật chống nuke ngay lập tức. Miễn phí cho mọi server.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/auth">
                <Button size="lg">
                  Bắt đầu ngay <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main>
        <section className="relative overflow-hidden pt-32 pb-20">
          <div className="absolute inset-0 bg-grid opacity-50 [mask-image:radial-gradient(70%_60%_at_50%_30%,black,transparent)]" />
          <div className="absolute inset-x-0 top-0 h-[420px] bg-glow-cyan" />
          <div className="container relative grid items-center gap-14 lg:grid-cols-2">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Badge variant="secondary" className="mb-5 border border-primary/30">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  Discord Bot · Auto Reply & Anti Nuke
                </Badge>
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="font-display text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl"
              >
                Bot Discord <span className="text-gradient-cyan">tự trả lời</span>
                <br />
                theo từ khóa & <span className="shimmer-text">chống raid</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="mt-5 max-w-lg text-lg text-muted-foreground"
              >
                Tag <span className="font-mono text-primary">@wio</span> hoặc nhắc đến từ khóa — bot trả lời ngay theo nội dung bạn tùy chỉnh. Cùng bộ giáp chống nuke bật tắt từng phần theo ý mod & owner.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.3 }}
                className="mt-8 flex flex-wrap items-center gap-3"
              >
                <Link to="/auth">
                  <Button size="lg">
                    Mở dashboard <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-border pt-6"
              >
                {[
                  ["9+", "Module chống nuke"],
                  ["2", "Prefix & slash"],
                  ["30s", "Đồng bộ cấu hình"],
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
        <AntiNuke />
        <HowItWorks />
        <CtaBanner />
      </main>
      <footer className="border-t border-border py-10">
        <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Bot className="h-4 w-4" />
            </span>
            <span className="font-display font-semibold">Wio Bot</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Wio Bot · Tự trả lời thông minh & phòng thủ chống raid cho Discord.
          </p>
        </div>
      </footer>
    </div>
  );
}
