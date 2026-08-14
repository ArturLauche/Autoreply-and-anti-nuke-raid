import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexReactClient, ConvexProvider } from "convex/react";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Convex backend URL (shared with the Discord bot):
// 1. A VITE_CONVEX_URL that points at a real deployment wins.
// 2. The workspace injects a local-dev value (http://127.0.0.1:3210) that only
//    works inside the sandbox — never in a user's browser — so any localhost
//    value is ignored and we fall back to the public Protogon production
//    deployment. The deployed site therefore always talks to the real backend.
const configuredUrl = import.meta.env.VITE_CONVEX_URL ?? "";
const isLocalDevUrl = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(
  configuredUrl,
);
const convexUrl =
  !configuredUrl || isLocalDevUrl
    ? "https://accomplished-chipmunk-74.convex.cloud"
    : configuredUrl;

const convex = new ConvexReactClient(convexUrl);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConvexProvider>
  </React.StrictMode>,
);
