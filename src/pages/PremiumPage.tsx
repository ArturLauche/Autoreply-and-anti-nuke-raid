import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUp, Check, Clock, Crown, Heart, Minus, Sparkles } from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import Footer from "../components/landing/Footer";
import LangSwitch from "../components/LangSwitch";
import SkipLink from "../components/SkipLink";
import { usePublicConfig } from "../lib/usePublicConfig";
import { translate } from "../lib/i18n";

/**
 * Trang /premium — nền tảng cho gói trả phí sắp tới.
 *
 * Vì sao CHƯA có nút mua: chưa có cổng thanh toán chạy thật. Dựng nút "Mua"
 * bấm vào không làm gì là loại slop nặng nhất — nó hứa hẹn rồi nuốt tiền người
 * dùng. Nên trang này ở trạng thái "sắp mở": nói rõ CHƯA bán, vẫn trình bày
 * gói và giá để người dùng biết sẽ mua cái gì, và để sẵn đường cắm cổng thanh
 * toán (Stripe) sau này mà không phải thiết kế lại từ đầu.
 */

interface Plan {
  id: string;
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: { label: string; included: boolean }[];
  /** Gói được nhấn mạnh — trung tâm trang. */
  featured?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Miễn phí",
    price: "0đ",
    period: "vĩnh viễn",
    tagline: "Đủ dùng cho hầu hết server cộng đồng.",
    features: [
      { label: "Tự trả lời, chặn link độc hại, 32 module chống nuke", included: true },
      { label: "Không giới hạn số server", included: true },
      { label: "Backup & khôi phục cấu trúc server", included: true },
      { label: "Số kênh riêng của bot (ví dụ bảng điều khiển)", included: false },
      { label: "Báo cáo nâng cao & xuất dữ liệu", included: false },
      { label: "Hỗ trợ ưu tiên", included: false },
    ],
  },
  {
    id: "supporter",
    name: "Đồng hành",
    price: "49.000đ",
    period: "mỗi tháng",
    tagline: "Dành cho server muốn nhiều kênh riêng và báo cáo đẹp hơn.",
    featured: true,
    features: [
      { label: "Tất cả tính năng của gói Miễn phí", included: true },
      { label: "Tối đa 10 kênh riêng có thư mục riêng", included: true },
      { label: "Báo cáo nâng cao & xuất dữ liệu", included: true },
      { label: "Tên riêng cho bot (thay vì Protogon)", included: true },
      { label: "Hỗ trợ ưu tiên", included: false },
    ],
  },
  {
    id: "pioneer",
    name: "Tiên phong",
    price: "99.000đ",
    period: "mỗi tháng",
    tagline: "Cho người muốn bot bám sát server mình nhất.",
    features: [
      { label: "Tất cả tính năng của gói Đồng hành", included: true },
      { label: "Số kênh riêng không giới hạn", included: true },
      { label: "Hỗ trợ ưu tiên trong 24 giờ", included: true },
      { label: "Ý tưởng tính năng được xếp hạng đầu", included: true },
      { label: "Avatar & biểu tượng riêng cho bot", included: true },
    ],
  },
];

export default function PremiumPage() {
  const { discordInvite, facebookUrl } = usePublicConfig();

  return (
    <div className="min-h-screen bg-background">
      <SkipLink />

      {/* Thanh đầu trang — cùng khuôn với /features */}
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 pt-6">
        <Link
          to="/"
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowUp className="h-4 w-4 -rotate-90" />
          {translate("Về trang chủ")}
        </Link>
        <LangSwitch />
      </div>

      <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-6 pb-16 pt-12">
        {/* Hero */}
        <header className="text-center">
          <Badge variant="secondary" className="mb-5 gap-1.5">
            <Crown className="h-3.5 w-3.5" />
            {translate("Gói Premium")}
          </Badge>
          <h1 className="mx-auto max-w-3xl font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            {translate("Trả phí để bot có thêm sức làm việc")}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {translate(
              "Gói Miễn phí luôn ở đó và không bao giờ bị cắt bớt. Premium chỉ mở thêm tiện ích cho server cần nhiều hơn — và là cách duy nhất để duy trì bot trong dài hạn.",
            )}
          </p>

          {/* Trạng thái trung thực: chưa mở bán. */}
          <div className="mx-auto mt-7 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-4 py-2 text-xs font-medium text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {translate("Chưa mở bán — cổng thanh toán đang hoàn thiện")}
          </div>
        </header>

        {/* 3 gói */}
        <section className="mt-14">
          <div className="grid gap-5 lg:grid-cols-3">
            {PLANS.map((plan, i) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.35, delay: i * 0.07 }}
                className={
                  plan.featured
                    ? "relative flex flex-col rounded-2xl border-2 border-foreground bg-card p-6 shadow-lg"
                    : "relative flex flex-col rounded-2xl border border-border bg-card p-6"
                }
              >
                {plan.featured && (
                  <span className="absolute -top-3 left-6 rounded-full bg-foreground px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary-foreground">
                    {translate("Được nhiều người chọn")}
                  </span>
                )}

                <h2 className="font-display text-lg font-bold text-foreground">{plan.name}</h2>
                <p className="mt-1.5 min-h-[2.5rem] text-sm leading-relaxed text-muted-foreground">
                  {plan.tagline}
                </p>

                <div className="mt-5 flex items-baseline gap-1.5 border-b border-border pb-5">
                  <span className="font-display text-3xl font-bold tracking-tight text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-xs text-muted-foreground">/ {plan.period}</span>
                </div>

                <ul className="mt-5 flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <li
                      key={f.label}
                      className={
                        f.included
                          ? "flex items-start gap-2.5 text-sm text-foreground"
                          : "flex items-start gap-2.5 text-sm text-muted-foreground/70"
                      }
                    >
                      {f.included ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                      ) : (
                        <Minus className="mt-0.5 h-4 w-4 shrink-0" />
                      )}
                      <span>{translate(f.label)}</span>
                    </li>
                  ))}
                </ul>

                {/* Chưa mở bán → KHÔNG dựng nút "Mua" giả. Chỉ mời đăng ký
                    quan tâm qua Discord để biết khi nào mở. */}
                <Button
                  className="mt-6 w-full"
                  variant={plan.featured ? "default" : "outline"}
                  disabled
                >
                  {translate("Sắp mở bán")}
                </Button>
              </motion.div>
            ))}
          </div>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            {translate(
              "Giá chưa chốt và sẽ không bao giờ cao hơn mức này cho người đã đăng ký sớm. Huỷ bất kỳ lúc nào.",
            )}
          </p>
        </section>

        {/* Đăng ký quan tâm */}
        <section className="mt-14 rounded-2xl border border-border bg-secondary/40 p-8 text-center">
          <h2 className="font-display text-xl font-bold text-foreground">
            {translate("Muốn biết khi nào mở bán?")}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {translate(
              "Nhắn một câu trong Discord là được. Mình sẽ báo trước ít nhất một tuần trước khi mở, và cho bạn giữ nguyên mức giá này nếu bạn đã đăng ký.",
            )}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <a href={discordInvite} target="_blank" rel="noreferrer">
                <Sparkles className="h-4 w-4" />
                {translate("Đăng ký qua Discord")}
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/donate">
                <Heart className="h-4 w-4" />
                {translate("Ủng hộ nhà phát triển")}
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <Footer discordInvite={discordInvite} facebookUrl={facebookUrl} />
    </div>
  );
}
