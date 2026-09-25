import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexReactClient, ConvexProvider } from "convex/react";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import RootErrorBoundary from "./components/RootErrorBoundary";
import { LangProvider } from "./lib/i18n";
import { resolveConvexUrl } from "./lib/convexUrl";
import { clearLegacyDiscordAccess } from "./lib/discord";
import "./index.css";

clearLegacyDiscordAccess();

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
