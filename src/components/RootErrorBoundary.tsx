import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import BotLogo from "./BotLogo";
import { Button } from "./ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Lớp chặn lỗi TOÀN TRANG: nếu một query Convex thất bại (backend down, hàm
 * chưa deploy…) mà không phần nào chặn được, thay vì trắng trang chỉ còn nền,
 * hiển thị màn hình báo lỗi theo đúng chủ đề Protogon + nút tải lại.
 */
export default class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[RootErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const msg = this.state.error?.message ?? "";

    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">

        <div className="relative flex max-w-lg flex-col items-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary p-2 shadow-sm">
            <BotLogo className="h-full w-full" />
          </span>

          <h1 className="mt-7 font-display text-2xl font-bold tracking-tight md:text-3xl">
            Máy chủ đang gặp sự cố 🌸
          </h1>

          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Protogon không kết nối được với máy chủ dữ liệu (backend Convex đang trả lỗi). Trang web
            sẽ hoạt động lại ngay khi máy chủ khỏe — bạn có thể thử tải lại.
          </p>

          {msg && (
            <p className="mt-5 max-w-full break-words rounded-lg border border-border bg-card/80 px-3 py-2 font-mono text-[11px] text-muted-foreground">
              {msg.slice(0, 220)}
            </p>
          )}

          <Button size="lg" className="mt-7" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" /> Tải lại trang
          </Button>
        </div>
      </div>
    );
  }
}
