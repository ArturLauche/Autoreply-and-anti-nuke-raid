import { useMemo } from "react";
import { cn } from "../lib/utils";

interface PetalSpec {
  left: number;
  size: number;
  duration: number;
  delay: number;
  sway: number;
  opacity: number;
}

function makePetals(count: number): PetalSpec[] {
  return Array.from({ length: count }, () => ({
    left: Math.random() * 100,
    size: 6 + Math.random() * 9,
    duration: 9 + Math.random() * 10,
    delay: Math.random() * 19,
    sway: (Math.random() - 0.5) * 130,
    opacity: 0.45 + Math.random() * 0.4,
  }));
}

/**
 * Lớp cánh hoa anh đào rơi — thuần CSS, không tương tác,
 * nằm phía dưới nav/modal (z-0) để không cản thao tác.
 */
export default function CherryBlossom({
  count = 16,
  className,
}: {
  count?: number;
  className?: string;
}) {
  // Điện thoại: hiển thị ít cánh hoa hơn (≈60%) — nhẹ hơn cho GPU/pin.
  const isSmallScreen =
    typeof window !== "undefined" && window.matchMedia?.("(max-width: 640px)").matches;
  const effectiveCount = isSmallScreen ? Math.max(6, Math.round(count * 0.6)) : count;
  const petals = useMemo(() => makePetals(effectiveCount), [effectiveCount]);

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none fixed inset-0 z-0 overflow-hidden", className)}
    >
      {petals.map((p, i) => (
        <span
          key={i}
          className="petal"
          style={
            {
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size * 1.15}px`,
              animationDuration: `${p.duration}s`,
              animationDelay: `-${p.delay}s`,
              "--petal-sway": `${p.sway}px`,
              "--petal-opacity": p.opacity,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
