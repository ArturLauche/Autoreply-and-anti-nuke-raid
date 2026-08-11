import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, X } from "lucide-react";
import { askHaimiya, GREETING, QUICK_QUESTIONS } from "../lib/haimiya";
import { cn } from "../lib/utils";

interface ChatMessage {
  role: "user" | "haimiya";
  text: string;
  suggestions?: string[];
}

/** Avatar chibi Haimiya-senpai — vẽ bằng SVG thuần, không dùng ảnh ngoài. */
export function HaimiyaAvatar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      {/* tóc sau */}
      <path
        d="M16 30c0-13 7-21 16-21s16 8 16 21c0 11-5 20-16 24-11-4-16-13-16-24z"
        fill="#f28bb8"
      />
      {/* búi tóc */}
      <circle cx="14" cy="15" r="8.5" fill="#f28bb8" />
      <circle cx="50" cy="15" r="8.5" fill="#f28bb8" />
      <circle cx="12" cy="13" r="3" fill="#f9b8d4" />
      <circle cx="48" cy="13" r="3" fill="#f9b8d4" />
      {/* mặt */}
      <circle cx="32" cy="34" r="16" fill="#ffe7f0" />
      {/* mái tóc */}
      <path
        d="M16 32c0-9 7-14 16-14s16 5 16 14c-4-4-9-6-16-6s-12 2-16 6z"
        fill="#f28bb8"
      />
      {/* lọn tóc hai bên */}
      <path
        d="M19 36q-2 8 3 12"
        stroke="#f28bb8"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M45 36q2 8-3 12"
        stroke="#f28bb8"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* mắt híp cười */}
      <path
        d="M23 34q3.2-4.4 6.4 0"
        stroke="#6b4453"
        strokeWidth="1.9"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M34.6 34q3.2-4.4 6.4 0"
        stroke="#6b4453"
        strokeWidth="1.9"
        fill="none"
        strokeLinecap="round"
      />
      {/* má hồng */}
      <ellipse cx="21.5" cy="39" rx="3.2" ry="1.9" fill="#ffb0c8" opacity="0.85" />
      <ellipse cx="42.5" cy="39" rx="3.2" ry="1.9" fill="#ffb0c8" opacity="0.85" />
      {/* miệng */}
      <path
        d="M29.6 41.5q2.4 2.6 4.8 0"
        stroke="#d4678a"
        strokeWidth="1.7"
        fill="none"
        strokeLinecap="round"
      />
      {/* hoa anh đào cài tóc */}
      <g>
        <circle cx="32" cy="15" r="3.4" fill="#ff5d8f" />
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse
            key={a}
            cx={32 + Math.cos((a * Math.PI) / 180) * 4.6}
            cy={15 + Math.sin((a * Math.PI) / 180) * 4.6}
            rx="2.9"
            ry="2.1"
            fill="#ff8fab"
            transform={`rotate(${a} 32 15)`}
          />
        ))}
      </g>
    </svg>
  );
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
    timerRef.current = window.setTimeout(() => {
      const ans = askHaimiya(q);
      setMessages((m) => [
        ...m,
        { role: "haimiya", text: ans.text, suggestions: ans.suggestions },
      ]);
      setTyping(false);
    }, 750 + Math.random() * 600);
  }

  return (
    <>
      {/* Nút mở chat */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Trò chuyện với Haimiya-senpai"
        className={cn(
          "group fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full",
          "border border-primary/40 bg-gradient-to-br from-[#ff8fab] to-[#f2629e] p-0.5 pr-1",
          "shadow-[0_8px_30px_-6px_hsl(342_92%_66%/0.6)] transition-transform hover:scale-105",
          open && "pointer-events-none opacity-0",
        )}
      >
        <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#2a1020] ring-2 ring-white/20">
          <HaimiyaAvatar className="h-9 w-9" />
          <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
            <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-[#2a1020] bg-emerald-400" />
          </span>
        </span>
        <span className="hidden pr-2 text-sm font-bold text-[#3d0f22] sm:block">
          Haimiya-senpai
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
          <div className="relative flex items-center gap-3 bg-gradient-to-r from-[#ff8fab] via-[#f2629e] to-[#c84b8f] px-4 py-3">
            <div className="relative">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2a1020] ring-2 ring-white/25">
                <HaimiyaAvatar className="h-9 w-9" />
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#f2629e] bg-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="font-display text-sm font-bold leading-tight text-[#3d0f22]">
                Haimiya-senpai
              </p>
              <p className="text-[11px] font-medium text-[#5c1533]">
                Trợ lý ảo của Protogon · luôn bên cạnh senpai 🌸
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
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2a1020]">
                    <HaimiyaAvatar className="h-7 w-7" />
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
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2a1020]">
                  <HaimiyaAvatar className="h-7 w-7" />
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
                placeholder="Hỏi em điều gì đó, senpai…"
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
                ? "Haimiya-senpai luôn sẵn sàng giải đáp — hỏi em bất cứ điều gì nhé!"
                : "Haimiya trả lời dựa trên kiến thức của Protogon — nhanh, miễn phí, không cần API key."}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
