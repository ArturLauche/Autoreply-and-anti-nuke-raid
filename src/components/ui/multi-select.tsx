import * as React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  emptyLabel?: string;
  /** Nhãn cho ô tìm kiếm (vd: "Tìm role…"). Ẩn ô tìm nếu không truyền. */
  searchPlaceholder?: string;
  className?: string;
}

/**
 * MultiSelect có ô TRA CỨU (tìm kiếm) — lọc danh sách theo từ khóa khi bấm mở.
 * Danh sách đã chọn luôn hiển thị trước (kể cả khi đang lọc) để không mất dấu
 * lựa chọn hiện có. So khớp KHÔNG DẤU (bỏ dấu tiếng Việt) + không phân biệt
 * hoa/thường: gõ "mod" ra "Mod", "quản trị"…
 */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Chọn…",
  emptyLabel = "Không có lựa chọn",
  searchPlaceholder,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [inputEl, setInputEl] = React.useState<HTMLInputElement | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  // Đóng khi chạm/bấm NGOÀI — phải nghe cả pointerdown (mobile touch không
  // phát mousedown theo cách chứa đúng e.target trên vài trình duyệt) lẫn
  // touchstart để dropdown không bị kẹt mở trên điện thoại.
  React.useEffect(() => {
    function outside(e: Event) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", outside);
    document.addEventListener("touchstart", outside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("touchstart", outside);
    };
  }, []);

  // Tự focus ô tìm kiếm khi mở dropdown.
  React.useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputEl?.focus(), 10);
      return () => clearTimeout(t);
    }
    setQuery("");
  }, [open, inputEl]);

  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  /** Chuẩn hoá: bỏ dấu tiếng Việt + lowercase — để "quản trị" khớp "Quản Trị". */
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");

  const q = norm(query.trim());
  const selectedSet = new Set(value);
  // Đã chọn hiển thị trước; đang lọc thì chỉ hiện khớp (cả đã chọn lẫn chưa).
  const filtered = options
    .filter((o) => q === "" || norm(o.label).includes(q) || norm(o.sublabel ?? "").includes(q))
    .sort((a, b) => {
      const sa = selectedSet.has(a.value) ? 0 : 1;
      const sb = selectedSet.has(b.value) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return a.label.localeCompare(b.label, "vi");
    });

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-secondary/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
      >
        <span className="flex flex-wrap gap-1">
          {value.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            value.slice(0, 4).map((v) => {
              const opt = options.find((o) => o.value === v);
              return (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-1.5 py-0.5 text-xs text-primary"
                >
                  {opt?.label ?? v}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(v);
                    }}
                    className="hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })
          )}
          {value.length > 4 && (
            <span className="text-xs text-muted-foreground">+{value.length - 4}</span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        // z-40 phải cao hơn header sticky (z-40) → z-[60] để dropdown không bị
        // header che khi widget nằm sát mép trên. max-sm: giữ trong màn hình.
        <div className="absolute z-[60] mt-1 w-full rounded-xl border border-border bg-popover shadow-xl">
          {/* Ô tra cứu — hiện khi có searchPlaceholder và danh sách đủ dài */}
          {searchPlaceholder && options.length > 6 && (
            <div className="sticky top-0 flex items-center gap-2 border-b border-border bg-popover p-2 rounded-t-xl">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={setInputEl}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Xóa tìm kiếm"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          <div className="max-h-60 overflow-y-auto p-1 max-sm:max-h-[min(45dvh,16rem)]">
            {options.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">{emptyLabel}</div>
            )}
            {options.length > 0 && filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Không khớp "{query}"
              </div>
            )}
            {filtered.map((opt) => {
              const selected = value.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggle(opt.value)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent",
                    selected && "text-primary",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-input",
                    )}
                  >
                    {selected && <Check className="h-3 w-3" />}
                  </span>
                  <span className="flex-1 truncate">{opt.label}</span>
                  {opt.sublabel && (
                    <span className="text-xs text-muted-foreground">{opt.sublabel}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
