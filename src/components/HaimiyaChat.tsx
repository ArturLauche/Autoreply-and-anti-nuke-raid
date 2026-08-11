import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { Send, Sparkles, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { askHaimiya, GREETING, QUICK_QUESTIONS } from "../lib/haimiya";
import { useBranding } from "../lib/useBranding";
import { cn } from "../lib/utils";

interface ChatMessage {
  role: "user" | "haimiya";
  text: string;
  suggestions?: string[];
}

/**
 * Avatar chibi Haimiya-senpai — vẽ lại theo concept ảnh gốc (mèo đen + tóc bạc xanh)
 * bằng SVG thuần, không dùng ảnh ngoài. Gồm: beanie tai mèo đen có miếng vá mặt mèo,
 * tóc bạc xanh, mắt xanh sáng, má hồng, răng nanh, choker đen.
 * Nếu truyền `src` (ảnh tùy chỉnh do admin sở hữu bot đặt) sẽ hiển thị ảnh đó thay SVG.
 */
export function HaimiyaAvatar({
  className,
  src,
}: {
  className?: string;
  src?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt="Haimiya"
        onError={() => setFailed(true)}
        className={`rounded-full object-cover ${className ?? ""}`}
        draggable={false}
      />
    );
  }
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      {/* thân áo đen + vai */}
      <path d="M12 64v-9c0-7 9-11 20-11s20 4 20 11v9z" fill="#23222e" />
      {/* cổ */}
      <rect x="27" y="42" width="10" height="9" rx="2.5" fill="#ffeaf2" />
      {/* tóc sau — bạc xanh */}
      <path
        d="M18 32c0-11 6-19 14-19s14 8 14 19v5c-4-2-9-3.5-14-3.5s-10 1.5-14 3.5z"
        fill="#c6daf4"
      />
      {/* mặt */}
      <circle cx="32" cy="34" r="13.5" fill="#ffeaf2" />
      {/* mái tóc — bạc xanh sáng */}
      <path
        d="M18.5 33c.5-7.5 6.5-12 13.5-12s13 4.5 13.5 12c-3.5-3-8-4.5-13.5-4.5s-10 1.5-13.5 4.5z"
        fill="#dbe9fa"
      />
      {/* lọn tóc hai bên */}
      <path
        d="M20 38q-2.5 7 1 12"
        stroke="#c6daf4"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M44 38q2.5 7-1 12"
        stroke="#c6daf4"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      {/* beanie đen + tai mèo */}
      <path
        d="M18.5 31v-4.5c0-5.5 5.5-8.5 13.5-8.5s13.5 3 13.5 8.5V31c-3.5-2.5-8-4-13.5-4s-10 1.5-13.5 4z"
        fill="#2b2b38"
      />
      {/* tai mèo trái */}
      <path d="M19 21l-5-10 11 4z" fill="#2b2b38" />
      <path d="M20.5 21.5l-3.5-6.5 7 2.5z" fill="#ff9dbb" />
      {/* tai mèo phải */}
      <path d="M45 21l5-10-11 4z" fill="#2b2b38" />
      <path d="M43.5 21.5l3.5-6.5-7 2.5z" fill="#ff9dbb" />
      {/* miếng vá mặt mèo trên beanie */}
      <rect x="26" y="20" width="12" height="10" rx="3" fill="#fdfdfd" />
      <circle cx="30" cy="24.5" r="1.2" fill="#333" />
      <circle cx="34" cy="24.5" r="1.2" fill="#333" />
      <path
        d="M29.5 27.5q2 2.1 4 0"
        stroke="#333"
        strokeWidth="0.9"
        fill="none"
        strokeLinecap="round"
      />
      {/* mắt xanh sáng, đồng tử hẹp */}
      <path d="M21.5 34.5q4-4.5 8 0q-4 4.5-8 0z" fill="#4aa5ff" stroke="#12355e" strokeWidth="0.8" />
      <path d="M34.5 34.5q4-4.5 8 0q-4 4.5-8 0z" fill="#4aa5ff" stroke="#12355e" strokeWidth="0.8" />
      <ellipse cx="25.5" cy="34.8" rx="1" ry="2.2" fill="#12355e" />
      <ellipse cx="38.5" cy="34.8" rx="1" ry="2.2" fill="#12355e" />
      <circle cx="24" cy="33.6" r="0.9" fill="#fff" opacity="0.9" />
      <circle cx="37" cy="33.6" r="0.9" fill="#fff" opacity="0.9" />
      {/* má hồng */}
      <ellipse cx="21" cy="38.5" rx="3" ry="1.8" fill="#ff9dbb" opacity="0.75" />
      <ellipse cx="43" cy="38.5" rx="3" ry="1.8" fill="#ff9dbb" opacity="0.75" />
      {/* miệng cười hở răng nanh */}
      <path
        d="M28.5 40.5q3.5 3.5 7 0"
        stroke="#c26a85"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M35 41.3l1.3 2.7 1.5-2.5z" fill="#fff" stroke="#c26a85" strokeWidth="0.6" strokeLinejoin="round" />
      {/* choker đen + vòng kim loại */}
      <path d="M26.5 48h11" stroke="#2b2b38" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="48" r="1.7" fill="none" stroke="#cfd6e4" strokeWidth="1.3" />
    </svg>
  );
}

/** Avatar bot (logo) — dùng ảnh tùy chỉnh nếu có, ngược lại mặc định là Haimiya. */
export function BotAvatar({
  className,
  src,
}: {
  className?: string;
  src?: string | null;
}) {
  return <HaimiyaAvatar className={className} src={src} />;
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/70"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

export default function HaimiyaChat({
  position = "landing",
}: {
  position?: "landing" | "dashboard";
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "haimiya", text: GREETING, suggestions: QUICK_QUESTIONS },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number>(0);
  const branding = useBranding();
  const avatarSrc = branding?.haimiyaAvatarUrl ?? null;
  const askAI = useAction(api.haimiya.ask);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("haimiya-open", onOpen);
    return () => window.removeEventListener("haimiya-open", onOpen);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing, open]);

  function send(text: string) {
    const q = text.trim();
    if (!q || typing) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setTyping(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      try {
        // Ưu tiên AI thật (khi đã cấu hình SAMBANOVA_API_KEY / OPENAI_API_KEY); nếu offline → dùng bộ kiến thức.
        const history = messages
          .concat([{ role: "user", text: q }])
          .slice(-8)
          .map((m) => ({
            role: m.role === "user" ? ("user" as const) : ("assistant" as const),
            content: m.text,
          }));
        const res = await askAI({ messages: history });
        if (res && !res.offline && res.reply) {
          setMessages((m) => [...m, { role: "haimiya", text: res.reply }]);
          setTyping(false);
          return;
        }
      } catch {
        // fallback bên dưới
      }
      const ans = askHaimiya(q);
      setMessages((m) => [
        ...m,
        { role: "haimiya", text: ans.text, suggestions: ans.suggestions },
      ]);
      setTyping(false);
    }, 650 + Math.random() * 500);
  }

  return (
    <>
      {/* Nút mở chat */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Trò chuyện với Haimiya"
        className={cn(
          "group fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full",
          "border border-white/50 bg-gradient-to-br from-[#ff8fab] to-[#f2629e] p-0.5 pr-1",
          "shadow-[0_8px_30px_-6px_hsl(342_92%_66%/0.6)] transition-transform hover:scale-105",
          open && "pointer-events-none opacity-0",
        )}
      >
        <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white/95 ring-2 ring-white/60 shadow-inner">
          <HaimiyaAvatar className="h-10 w-10" src={avatarSrc} />
          <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
            <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
          </span>
        </span>
        <span className="hidden pr-2 text-sm font-bold text-[#3d0f22] sm:block">
          Haimiya
        </span>
      </button>

      {/* Cửa sổ chat */}
      {open && (
        <div
          className={cn(
            "fixed bottom-5 right-5 z-50 flex w-[min(94vw,24rem)] flex-col overflow-hidden rounded-2xl",
            "border border-primary/30 bg-card/95 shadow-2xl backdrop-blur",
            "animate-in fade-in-0 zoom-in-95 duration-200",
          )}
        >
          {/* Header */}
          <div className="relative flex items-center gap-3 bg-gradient-to-r from-[#ffb3d1] via-[#f79fc6] to-[#8fc8ff] px-4 py-3">
            <div className="relative">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 ring-2 ring-white/50">
                <HaimiyaAvatar className="h-10 w-10" src={avatarSrc} />
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#f79fc6] bg-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="font-display text-sm font-bold leading-tight text-[#3d0f22]">
                Haimiya
              </p>
              <p className="text-[11px] font-medium text-[#5c1533]">
                Trợ lý ảo của Protogon — giải đáp về bot, nhiệt độ, tính năng ẩn
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Đóng"
              className="rounded-lg p-1.5 text-[#5c1533] transition-colors hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tin nhắn */}
          <div className="h-[22rem] space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex items-end gap-2", m.role === "user" && "justify-end")}
              >
                {m.role === "haimiya" && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/95 ring-1 ring-border">
                    <HaimiyaAvatar className="h-7 w-7" src={avatarSrc} />
                  </span>
                )}
                <div
                  className={cn(
                    "chat-bubble-tail max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    m.role === "haimiya"
                      ? "haimiya rounded-bl-sm border border-border bg-secondary/80 text-foreground/95"
                      : "user rounded-br-sm bg-primary text-primary-foreground",
                  )}
                >
                  {m.text}
                  {m.suggestions && i === messages.length - 1 && !typing && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {m.suggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => send(s)}
                          className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex items-end gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/95 ring-1 ring-border">
                  <HaimiyaAvatar className="h-7 w-7" src={avatarSrc} />
                </span>
                <div className="chat-bubble-tail haimiya rounded-2xl rounded-bl-sm border border-border bg-secondary/80 px-3.5">
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border/70 p-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2 focus-within:border-primary/50">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send(input);
                }}
                placeholder="Hỏi tôi điều gì đó…"
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button
                onClick={() => send(input)}
                disabled={!input.trim() || typing}
                aria-label="Gửi"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              {position === "dashboard"
                ? "Haimiya sẵn sàng giải đáp — hỏi về Protogon hay bất cứ điều gì ngoài lề."
                : "Haimiya trò chuyện thoải mái — hỏi về Protogon hoặc bất cứ điều gì bạn muốn."}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
