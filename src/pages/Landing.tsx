import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import Nav from "../components/landing/Nav";
import Footer from "../components/landing/Footer";
import Taskbar from "../components/Taskbar";
import HeroChatCard from "../components/landing/HeroChatCard";
import {
  Features,
  HiddenFeatures,
  AntiNuke,
  HaimiyaSection,
  HowItWorks,
  CtaBanner,
} from "../components/landing/sections";
import { DashboardCta, SafeHaimiyaAvatar } from "../components/landing/shared";
import { usePublicConfig } from "../lib/usePublicConfig";

export default function Landing() {
  const { discordInvite, facebookUrl } = usePublicConfig();
  return (
    <div className="relative min-h-screen text-foreground">
      {/* Các phần phụ thuộc backend được bọc chặn lỗi riêng — backend down thì
          phần đó tự ẩn, hero/tính năng/footer vẫn hiển thị đầy đủ. */}
      <Nav />
      <main>
        {/* ============ HERO ============ */}
        <section className="relative overflow-hidden pb-16 pt-28 md:pb-20 md:pt-32">
          <div className="container relative grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center gap-4 text-center lg:block lg:text-left"
              >
                <span className="flex h-24 w-24 items-center justify-center rounded-full border border-border bg-card shadow-sm lg:hidden">
                  <SafeHaimiyaAvatar className="h-20 w-20" />
                </span>
                <Badge variant="secondary" className="border border-primary/30">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  Discord Bot · Nhiệt độ · Join Gate · Tính năng ẩn
                </Badge>
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="mt-4 text-center font-display text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl lg:mt-0 lg:text-left lg:text-4xl xl:text-[2.75rem]"
              >
                Bot Discord
                <span className="block text-primary">bảo vệ toàn diện</span>
                <span className="block">tự trả lời &amp; chống raid</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="mx-auto mt-5 max-w-lg text-center text-base text-muted-foreground sm:text-lg lg:mx-0 lg:text-left"
              >
                Tag <span className="font-mono text-primary">@protogon</span> hoặc nhắc từ khóa —
                bot trả lời ngay. Hệ thống <b className="text-foreground">nhiệt độ 4 giai đoạn</b>{" "}
                kèm warn tích lũy, <b className="text-foreground">Join Gate chống selfbot</b>,{" "}
                <b className="text-foreground">chặn link độc hại & file nguy hiểm</b> và{" "}
                <b className="text-foreground">32 module bảo vệ</b> canh server 24/7.
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
                  <SafeHaimiyaAvatar className="h-6 w-6" /> Hỏi Haimiya
                </Button>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="mx-auto mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-border pt-6 lg:mx-0"
              >
                {[
                  ["32", "Module bảo vệ"],
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
      <Footer discordInvite={discordInvite} facebookUrl={facebookUrl} />
      <Taskbar />
    </div>
  );
}
