import { motion } from "framer-motion";
import { Bot, Flame, Timer, UserCheck } from "lucide-react";
import { Badge } from "../ui/badge";

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

export default function HeroChatCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32, rotate: 1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
      className="relative"
    >
      <div className="relative rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-lg">
        <div className="flex items-center gap-2 border-b border-black/40 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-white/25" />
          <span className="h-3 w-3 rounded-full bg-white/25" />
          <span className="h-3 w-3 rounded-full bg-white/25" />
          <span className="ml-3 text-xs font-medium text-white/40">
            # general · Protogon Bot 🌸
          </span>
        </div>
        <div className="space-y-4 p-5 font-sans">
          {/* Auto reply */}
          <div className="flex items-end gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white">
              Huy
            </span>
            <div className="max-w-[80%]">
              <p className="mb-1 text-xs font-semibold text-white">
                huy_nguyen{" "}
                <span className="ml-1 font-normal text-white/40">
                  {translate("Hôm nay chơi gì @protogon?")}
                </span>
              </p>
              <div className="rounded-lg rounded-bl-none bg-white/10 px-3 py-2 text-sm text-white/90">
                {translate("Hôm nay chơi gì?")}{" "}
                <span className="font-semibold text-white">@protogon</span>
              </div>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black">
              <Bot className="h-5 w-5" />
            </span>
            <div className="max-w-[80%]">
              <p className="mb-1 text-xs font-semibold text-white">
                Protogon <span className="ml-1 font-normal text-white/40">BOT</span>
              </p>
              <div className="rounded-lg rounded-bl-none border border-white/30 bg-white/10 px-3 py-2 text-sm text-white/90">
                {translate("Chào")} <span className="font-semibold text-white">Huy</span>
                {translate("! Hôm nay thử một trận Valorant 5v5 nhé 🎮")}{" "}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-white/40">
                <Timer className="h-3 w-3" /> rule “game-night” · cooldown 30s
              </div>
            </div>
          </div>

          {/* Cảnh báo nhiệt */}
          <div className="rounded-lg border border-white/25 bg-white/5 px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Flame className="h-4 w-4" />{" "}
              {translate("NHIỆT ĐỘ VI PHẠM — THÀNH VIÊN “dang_spam”")}{" "}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1">
                <HeatBar value={55} color="bg-white" />
                <div className="mt-1 flex justify-between text-[10px] text-white/40">
                  <span>warn 25</span>
                  <span>{translate("tạm khóa 40")}</span>
                  <span>kick 70</span>
                  <span>ban 90</span>
                </div>
              </div>
              <span className="shrink-0 rounded-md bg-white/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                55/100
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-white/60">
              {translate("Tái phạm trong 30 phút → nhiệt")} <b className="text-white">×2</b>{" "}
              {translate("· đã gửi DM cảnh báo ⚠️")}{" "}
            </p>
          </div>

          {/* Join gate */}
          <div className="rounded-lg border border-white/20 bg-white/5 px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
              <UserCheck className="h-4 w-4" /> {translate("JOIN GATE — TỰ ĐỘNG CHẶN SELFBOT")}{" "}
            </div>
            <p className="mt-1 text-[11px] text-white/60">
              🚪 <span className="font-mono text-white/80">selfbot_9123</span> bị chặn: tài khoản{" "}
              <b className="text-white">{translate("mới 2 ngày")}</b>
              {translate(", không avatar, không huy hiệu → đã kick.")}{" "}
            </p>
          </div>
        </div>
      </div>
      <div className="absolute -right-3 -top-3 animate-float">
        <Badge
          variant="success"
          className="gap-1.5 border border-white/20 bg-[#0a0a0a] px-3 py-1 shadow-md"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          {translate("Bot đang trực tuyến")}{" "}
        </Badge>
      </div>
    </motion.div>
  );
}
