import { motion } from "framer-motion";
import {
  Archive,
  ArrowRight,
  Bot,
  Bug,
  Crown,
  Facebook,
  Flame,
  Gavel,
  Heart,
  LayoutDashboard,
  Lock,
  MessageCircle,
  Megaphone,
  MessageSquareReply,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  UserCheck,
  Zap,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { DashboardCta, SafeHaimiyaAvatar, fadeUp, stagger } from "./shared";

import { translate } from "../../lib/i18n";
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

export function Features() {
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
      title: "Chống nuke & raid — 24 module",
      desc: "Ban/kick hàng loạt, raid thành viên, phá kênh/role, webhook spam, bot lạ vào-rồi-rời (hit-and-run), tự cấp quyền quản trị… — phạt trực tiếp + khóa kênh tự động khi bị tấn công.",
    },
    {
      icon: Gavel,
      title: "Công cụ Mod",
      desc: "/mod timeout · kick · ban · purge — ghi đầy đủ lý do + người thực hiện vào kênh log. Lệnh text: !timeout !kick !ban !purge.",
    },
    {
      icon: Archive,
      title: "Backup & khôi phục server",
      desc: "Chụp toàn bộ server (role, kênh, tin nhắn kèm media, emoji), bản nén đẩy lên GitHub Gist, tự động backup định kỳ 2–30 ngày. Khôi phục vào server khác hoặc nhập cả file backup bot nuke (.msc).",
    },
    {
      icon: Megaphone,
      title: "Báo cáo khẩn & report",
      desc: "/report và !report cho mod: khi có raid/nuke hoặc bot phạt nhầm, AI Mimu v2.5 dò hàng trăm tin nhắn gần nhất để hiểu tình huống và đưa ra báo cáo rõ ràng cho cả server.",
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
            <Badge className="mb-4">
              <Sparkles className="h-3.5 w-3.5" /> {translate("Mọi thứ trong một bot")}{" "}
            </Badge>
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className="font-display text-3xl font-bold tracking-tight md:text-5xl"
          >
            Bảo vệ toàn diện &amp; giao tiếp cho server của bạn
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-4 text-muted-foreground">
            {translate(
              "Từ tự trả lời thông minh đến 32 module bảo vệ (24 chống nuke + 8 auto-mod) — Protogon canh server 24/7 và cấu hình mọi thứ qua dashboard trực quan, có trợ lý Haimiya sẵn sàng giải đáp.",
            )}{" "}
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
            {
              icon: LayoutDashboard,
              t: "Bảng nhiệt & warn",
              d: "Xem từng thành viên, xóa nhiệt 1 cú nhấn",
            },
            { icon: Zap, t: "Đồng bộ tự động", d: "Chỉnh trên web → bot áp dụng sau ~1 phút" },
            {
              icon: Timer,
              t: "Báo cáo hàng ngày",
              d: "Tóm tắt sự kiện, nhiệt & warn gửi vào kênh log",
            },
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

/**
 * Khu vực bí mật — KHÔNG liệt kê chi tiết tính năng ở đây. Những gì nằm trong
 * "Tính năng ẩn" chỉ dành riêng chủ sở hữu bot; công khai tên tính năng ra trang
 * chủ là lộ thông tin nội bộ cho mọi người.
 */
export function HiddenFeatures() {
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
              <Lock className="h-3.5 w-3.5" />{" "}
              {translate("Khu vực riêng tư — chỉ chủ sở hữu bot")}{" "}
            </Badge>
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className="font-display text-3xl font-bold tracking-tight md:text-4xl"
          >
            {translate("Một số khả năng đặc biệt…")}{" "}
          </motion.h2>
          <motion.p variants={fadeUp} className="mx-auto mt-3 max-w-xl text-muted-foreground">
            {translate(
              "Ngoài những gì bạn thấy, Protogon còn giữ riêng một khu vực quyền lực chỉ chủ sở hữu bot mở khóa được bằng mật khẩu bí mật — ngay trong dashboard, không cần cài thêm gì.",
            )}{" "}
          </motion.p>
          <motion.div
            variants={fadeUp}
            className="mt-6 flex flex-wrap items-center justify-center gap-2"
          >
            {["Chỉ dành chủ sở hữu bot", "Mở khóa bằng mật khẩu", "Được bảo vệ chặt chẽ"].map(
              (t) => (
                <span
                  key={t}
                  className="rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs text-muted-foreground"
                >
                  {t}
                </span>
              ),
            )}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/** Thang nhiệt 4 giai đoạn — trực quan + sinh động. */
function HeatLadder() {
  /* Thang nhiệt theo bảng đen trắng: mức càng cao → nền càng đậm.
     Thứ bậc đọc bằng độ đậm (contrast), không cần màu. */
  const tiers = [
    {
      label: "Cảnh báo",
      range: "25 → 39",
      chip: "border-border bg-secondary text-foreground",
      bar: "bg-foreground/40",
      fill: 25,
    },
    {
      label: "Tạm khóa",
      range: "40 → 69",
      chip: "border-foreground/30 bg-secondary text-foreground",
      bar: "bg-foreground/60",
      fill: 55,
    },
    {
      label: "Kick",
      range: "70 → 89",
      chip: "border-foreground/50 bg-secondary text-foreground",
      bar: "bg-foreground/80",
      fill: 80,
    },
    {
      label: "Ban",
      range: "90 → 100",
      chip: "border-foreground bg-foreground text-primary-foreground",
      bar: "bg-primary-foreground",
      fill: 100,
    },
  ];
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
        <Flame className="h-4 w-4" /> {translate("Thang nhiệt tự leo thang hình phạt")}{" "}
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        {tiers.map((t, i) => (
          <motion.div
            key={t.label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className={`rounded-lg border p-3 ${t.chip}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">{t.label}</span>
              <span className="font-mono text-[10px] font-semibold opacity-80">{t.range}</span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${t.fill}%` }} />
            </div>
          </motion.div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {translate("Vừa bị phạt mà tái phạm → nhiệt nhân")} <b className="text-foreground">×2</b>{" "}
        {translate(
          "trong 30 phút. Warn tích lũy chạy song song: đủ 3 lần warn → tự tăng cấp.",
        )}{" "}
      </p>
    </div>
  );
}

export function AntiNuke() {
  const nukeModules = [
    "Chống ban hàng loạt",
    "Chống kick hàng loạt",
    "Chống raid thành viên",
    "Chống tạo/xóa kênh",
    "Chống tạo/xóa thread",
    "Chống tạo webhook hàng loạt",
    "Chống xóa tin hàng loạt",
    "Chống tạo/xóa role",
    "Tự cấp quyền quản trị",
    "Chống thêm bot hàng loạt",
    "Cảnh báo bot lạ",
    "Bot vào-rồi-rời",
  ];
  const modModules = [
    "Chống spam tin nhắn",
    "Chống lặp tin nhắn",
    "Chống tin rỗng/nhiễu",
    "Chống spam mention",
    "Chống spam ảnh/file",
    "Lọc từ ngữ xấu",
    "Chặn link mời Discord",
    "Chặn link độc hại & file nguy hiểm",
  ];
  return (
    <section id="antinuke" className="relative overflow-hidden py-24">
      <div className="container relative">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="danger" className="mb-4">
              <ShieldAlert className="h-3.5 w-3.5" /> {translate("Phòng thủ 32 module")}{" "}
            </Badge>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
              {translate("Chặn đứng kẻ phá hoại")} <br />
              {translate("trước khi server sụp đổ")}{" "}
            </h2>
            <p className="mt-4 max-w-lg text-muted-foreground">
              {translate("Hai lớp phòng thủ:")} <b className="text-foreground">Anti Nuke</b> (24
              module) canh cấu trúc server (ban/kick hàng loạt, phá kênh, phá role…) và{" "}
              <b className="text-foreground">Moderation</b>{" "}
              {translate(
                "(8 module) lọc nội dung độc hại mỗi ngày. Vượt ngưỡng → xác định thủ phạm qua audit log, phạt theo cài đặt và cảnh báo real-time tới kênh log.",
              )}{" "}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                "Phạt trực tiếp",
                "Khóa kênh khi raid",
                "Miễn trừ role",
                "Kênh log riêng",
                "Báo cáo hàng ngày",
              ].map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs text-muted-foreground"
                >
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
            className="rounded-2xl border border-border bg-card p-6 shadow-md"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-display font-semibold">
                <ShieldCheck className="h-5 w-5 text-primary" />{" "}
                {translate("Module đang bảo vệ")}{" "}
              </div>
              <Badge variant="success">{translate("32/32 bật")}</Badge>
            </div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {translate("🛡️ Anti Nuke / Raid — phạt trực tiếp")}{" "}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {nukeModules.map((m) => (
                <div
                  key={m}
                  className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2"
                >
                  <span className="text-sm">{m}</span>
                  <span className="relative ml-2 flex h-4 w-7 items-center rounded-full bg-primary px-0.5">
                    <span className="ml-auto h-3 w-3 rounded-full bg-white" />
                  </span>
                </div>
              ))}
            </div>
            <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {translate("🧹 Moderation nội dung — cộng nhiệt + warn")}{" "}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {modModules.map((m) => (
                <div
                  key={m}
                  className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2"
                >
                  <span className="text-sm">{m}</span>
                  <span className="relative ml-2 flex h-4 w-7 items-center rounded-full bg-primary px-0.5">
                    <span className="ml-auto h-3 w-3 rounded-full bg-white" />
                  </span>
                </div>
              ))}
            </div>
            <p className="mb-3 mt-3 text-center text-[11px] text-muted-foreground">
              {translate("…và 12 module chống nuke khác — xem đầy đủ trong dashboard.")}{" "}
            </p>
            <div className="mt-0 rounded-lg border border-white/20 bg-white/5 p-3 text-xs text-white/70">
              <span className="font-semibold text-white">
                {translate("🔒 Khóa kênh khi raid:")}
              </span>{" "}
              {translate(
                "vượt ngưỡng bất kỳ module nào → bot chặn thành viên gửi tin trong toàn server, tự mở lại sau vài phút hoặc khi mod dùng",
              )}{" "}
              <code className="font-mono">/antinuke unlock</code>.
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/** Gặp gỡ Haimiya-senpai — trợ lý ảo. */
export function HaimiyaSection() {
  return (
    <section id="haimiya" className="relative overflow-hidden py-24">
      <div className="container relative">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="order-2 lg:order-1"
          >
            {" "}
            <div className="relative mx-auto w-fit">
              <div className="relative animate-float">
                <div className="flex h-64 w-64 items-center justify-center rounded-full border border-border bg-card shadow-sm">
                  <SafeHaimiyaAvatar className="h-48 w-48" />
                </div>
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
            <Badge className="mb-4">
              <Heart className="h-3.5 w-3.5" /> {translate("Gặp gỡ trợ lý ảo")}{" "}
            </Badge>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
              {translate("Haimiya — trợ lý ảo đáng tin cậy")}{" "}
            </h2>
            <p className="mt-4 max-w-lg text-muted-foreground">
              {translate(
                'Lấy cảm hứng từ nhân vật "đáng sợ mà đáng yêu" — Haimiya là trợ lý ảo của Protogon, luôn túc trực trên website và dashboard. Tôi giải đáp mọi thắc mắc về bot bằng tiếng Việt: hệ thống nhiệt độ, warn tích lũy, Join Gate, chống nuke/raid, auto reply, cách host bot…',
              )}{" "}
            </p>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
              {[
                "Giải đáp tức thì, 24/7 — không cần chờ đợi",
                "Biết rõ từng tính năng & cách cấu hình của Protogon",
                "Trả lời rõ ràng, nghiêm túc — trên web lẫn trong dashboard",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs text-primary">
                    🌸
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => window.dispatchEvent(new Event("haimiya-open"))}>
                <MessageCircle className="h-4 w-4" /> {translate("Hỏi thử Haimiya ngay")}{" "}
              </Button>
              <DashboardCta variant="outline">
                {translate("Vào dashboard")} <ArrowRight className="h-4 w-4" />
              </DashboardCta>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
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
      desc: "Nhấn Mời bot, chọn server của bạn — Protogon tự tạo cấu hình mặc định an toàn với đầy đủ 32 module bật sẵn, chỉnh sửa mọi thứ sau đó bất cứ lúc nào.",
    },
    {
      n: "03",
      icon: LayoutDashboard,
      title: "Cấu hình trên dashboard",
      desc: "Thêm rule trả lời, chỉnh nhiệt độ & warn, bật Join Gate, chọn hình phạt — mọi thứ hiệu lực sau ~1 phút.",
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
            <Badge className="mb-4">
              <Zap className="h-3.5 w-3.5" /> {translate("Bắt đầu nhanh")}{" "}
            </Badge>
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className="font-display text-3xl font-bold tracking-tight md:text-4xl"
          >
            {translate("Hoạt động trong 3 bước")}{" "}
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

export function CtaBanner() {
  return (
    <section className="py-16">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl border border-border bg-secondary p-8 text-center shadow-sm md:p-16"
        >
          <div className="relative">
            <SafeHaimiyaAvatar className="mx-auto h-28 w-28" />
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight md:text-5xl">
              {translate("Sẵn sàng để Haimiya")} <br className="hidden md:block" />{" "}
              {translate("hỗ trợ bạn quản lý server?")}{" "}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              {translate(
                "Đăng nhập bằng Discord, mời Protogon vào server — bật nhiệt độ, Join Gate, lọc nội dung và 32 module chống nuke ngay trên dashboard, có trợ lý ảo Haimiya đồng hành. Miễn phí cho mọi server.",
              )}{" "}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <DashboardCta>
                {translate("Bắt đầu ngay")} <ArrowRight className="h-4 w-4" />
              </DashboardCta>
              <Button
                size="lg"
                variant="outline"
                onClick={() => window.dispatchEvent(new Event("haimiya-open"))}
              >
                <MessageCircle className="h-4 w-4" /> {translate("Trò chuyện với Haimiya")}{" "}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export { HeatBar };
export { Facebook as FacebookIcon };
