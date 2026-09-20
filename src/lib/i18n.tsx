import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { EN } from "./i18n.en";

/**
 * Đa ngôn ngữ kiểu gettext: chuỗi tiếng Việt trong code là KEY —
 * `t("Đăng nhập")` trả bản EN nếu có, không có thì rơi về nguyên chuỗi VI.
 * Lợi ích: thêm chuỗi mới không bao giờ quên update dict làm vỡ UI; dict EN
 * chỉ là lớp phủ. Script scripts/check-i18n.cjs chặn chuỗi t("…") chưa có
 * bản dịch EN để không lọt tiếng Việt sang người dùng EN.
 */
export type Lang = "vi" | "en";

const LANG_KEY = "protogon-lang";

function readInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "en" || saved === "vi") return saved;
    // Không có lựa chọn lưu: theo ngôn ngữ trình duyệt, mặc định VI (sản phẩm gốc).
    const nav = navigator.language?.toLowerCase() ?? "";
    return nav.startsWith("vi") || nav === "" ? "vi" : "en";
  } catch {
    return "vi";
  }
}

/** Ngôn ngữ hiện tại ở cấp module — dùng cho helper ngoài React (format ngày…). */
let currentLang: Lang = typeof window === "undefined" ? "vi" : readInitialLang();

/** Thay {ten} bằng giá trị biến — kiểu gettext format, không cần lib ngoài. */
function formatVars(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m,
  );
}

/** Dịch một chuỗi VI sang ngôn ngữ hiện tại (ngoài React — ưu tiên dùng useT). */
export function translate(s: string, vars?: Record<string, string | number>): string {
  if (currentLang === "vi") return formatVars(s, vars);
  return formatVars(EN[s] ?? s, vars);
}

/** Ngôn ngữ hiện tại — dùng khi cần gửi lựa chọn lên backend (ví dụ AI). */
export function currentLanguage(): Lang {
  return currentLang;
}

/** Locale cho toLocaleString/toLocaleTimeString theo ngôn ngữ hiện tại. */
export function dateLocale(): string {
  return currentLang === "vi" ? "vi-VN" : "en-US";
}

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Dịch chuỗi VI (key) — component dùng hook này để tự re-render khi đổi ngôn ngữ.
   *  Hỗ trợ biến {ten}: t("Đã lưu {n} rule", { n }). */
  t: (s: string, vars?: Record<string, string | number>) => string;
  dateLocale: () => string;
}

const LangContext = createContext<LangContextValue>({
  lang: "vi",
  setLang: () => {},
  t: (s) => s,
  dateLocale: () => "vi-VN",
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(currentLang);

  const setLang = useCallback((l: Lang) => {
    currentLang = l;
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      // localStorage chặn (private mode) — vẫn đổi cho phiên hiện tại.
    }
    setLangState(l);
  }, []);

  // Cập nhật attribute lang của <html> — trình duyệt đọc màn hình + font phụ thuộc.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (s: string, vars?: Record<string, string | number>) =>
      lang === "vi" ? formatVars(s, vars) : formatVars(EN[s] ?? s, vars),
    [lang],
  );
  const value = useMemo(() => ({ lang, setLang, t, dateLocale }), [lang, setLang, t]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

/** Hook dịch trong component — UI tự cập nhật ngay khi người dùng đổi ngôn ngữ. */
export function useT(): LangContextValue {
  return useContext(LangContext);
}
