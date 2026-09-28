import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexReactClient, ConvexProvider } from "convex/react";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import RootErrorBoundary from "./components/RootErrorBoundary";
import { LangProvider } from "./lib/i18n";
import { resolveConvexUrl } from "./lib/convexUrl";
import { clearLegacyDiscordAccess } from "./lib/discord";
import { finishBootOverlay } from "./lib/bootOverlay";
import "./index.css";

clearLegacyDiscordAccess();

try {
  const convex = new ConvexReactClient(resolveConvexUrl());

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <LangProvider>
        <ConvexProvider client={convex}>
          <RootErrorBoundary>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </RootErrorBoundary>
        </ConvexProvider>
      </LangProvider>
    </React.StrictMode>,
  );
} catch (error) {
  // Bootstrap chết TRƯỚC khi React mount (resolveConvexUrl throw fail-closed,
  // DOM thiếu #root, lỗi parse bundle…) → không component nào chạy được để đóng
  // preloader. Gỡ lớp phủ ở đây để người dùng nhìn thấy trang trắng + lỗi ở
  // console, thay vì màn "Protogon. 0%" kẹt vĩnh viễn.
  console.error("[bootstrap] Khởi động app thất bại:", error);
  finishBootOverlay();
  throw error;
}
