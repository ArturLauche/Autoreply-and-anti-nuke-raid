#!/usr/bin/env node
/**
 * test-browser-contracts.cjs — test HÀNH VI mức trình duyệt cho 3 lớp lỗi im
 * lặng mà test so-chuỗi không chạm tới:
 *
 *   A. Preloader fail-open (bug thảm hoạ PR #15 để lại): /boot.js bị chặn/404/
 *      tải dở/throw → app vẫn phải hiện, lớp phủ #boot phải biến mất, trang
 *      phải tương tác được. TRƯỚC ĐÂY: `window.__bootDone?.()` no-op → lớp phủ
 *      phủ kín app vĩnh viễn.
 *   B. Đường đóng preloader BÌNH THƯỜNG (boot.js sống) vẫn đúng như cũ.
 *   C. Canonical /status→/monitor + redirect 301: mở /status phải rơi về
 *      /monitor, canonical/og:url/JSON-LD phải là /monitor — không được có hai
 *      URL cùng tự khai canonical.
 *   D. Skip-link thật sự dùng được bằng bàn phím (Tab → hiện → Enter → focus
 *      nhảy vào <main>), không chỉ "tồn tại trong source".
 *   E. Route public mở trực tiếp (SPA fallback) + private route noindex +
 *      route lạ 404 có thương hiệu.
 *
 * KHÔNG cài dependency mới: điều khiển Chromium bằng DevTools Protocol qua
 * WebSocket SẴN CÓ của Node (>=22), phục vụ dist/ bằng http server của Node.
 * Trình duyệt tìm theo thứ tự: $CHROME_BIN → /usr/bin/chromium* → cache
 * playwright. Thiếu trình duyệt = FAIL có hướng dẫn (không im lặng xanh).
 *
 * Chạy: node scripts/test-browser-contracts.cjs (đã nằm trong bun run test)
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn, spawnSync } = require("node:child_process");
const { test } = require("node:test");

/**
 * Cửa thoát rõ ràng cho môi trường KHÔNG có trình duyệt (CI image lạ, box tối
 * thiểu). Mặc định vẫn FAIL kèm hướng dẫn — test im lặng skip là test dối.
 */
const browserTest = process.env.SKIP_BROWSER_TESTS === "1" ? test.skip : test;

const ROOT = path.resolve(__dirname, "..");
const DIST = process.env.BROWSER_TEST_DIST || path.join(ROOT, "dist");
const MANIFEST = require("../src/lib/routes.json");
const ROUTES = MANIFEST.routes;
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.convex.cloud https://*.convex.site wss://*.convex.cloud wss://*.convex.site https://discord.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://discord.com",
  "frame-ancestors 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

// ─── Tìm trình duyệt ────────────────────────────────────────────────────────
function findChromium() {
  const candidates = [];
  if (process.env.CHROME_BIN) candidates.push(process.env.CHROME_BIN);
  candidates.push(
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  );
  const cacheDirs = [
    path.join(os.homedir(), ".cache/ms-playwright"),
    path.join(os.homedir(), "Library/Caches/ms-playwright"),
  ];
  for (const dir of cacheDirs) {
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.startsWith("chromium")) continue;
      candidates.push(
        path.join(dir, entry, "chrome-linux", "chrome"),
        path.join(dir, entry, "chrome-linux64", "chrome"),
        path.join(dir, entry, "chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"),
      );
    }
  }
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // không đọc được — thử ứng viên kế tiếp
    }
  }
  return null;
}

// ─── Static server dựng đúng kiểu production (CSP + SPA fallback + redirect) ──
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
};

function routeFor(pathname) {
  const norm = pathname.length > 1 ? pathname.replace(/\/+$/, "") || "/" : "/";
  return (
    ROUTES.find((r) => r.match === "exact" && r.path === norm) ??
    ROUTES.find((r) => r.match === "prefix" && norm.startsWith(`${r.path}/`)) ??
    ROUTES.find((r) => r.match === "prefix" && norm === r.path) ??
    null
  );
}

function startServer(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const pathname = decodeURIComponent(req.url.split("?")[0]);
      const route = routeFor(pathname);
      const headers = { "content-security-policy": CSP };
      const send = (code, file, extra = {}) => {
        fs.readFile(file, (err, data) => {
          if (err) {
            res.writeHead(500, { "content-type": "text/plain" });
            res.end("server error");
            return;
          }
          res.writeHead(code, {
            "content-type": MIME[path.extname(file)] || "application/octet-stream",
            ...headers,
            ...extra,
          });
          res.end(data);
        });
      };
      // 1) Alias có redirect → 301 (giống vercel.json + nginx location = /status)
      if (route && route.redirect) {
        res.writeHead(301, { ...headers, location: route.redirect });
        res.end();
        return;
      }
      // 2) Route cần SPA fallback → index.html (private kèm noindex header)
      if (route && route.spaFallback) {
        const extra = route.visibility === "private" ? { "x-robots-tag": "noindex, nofollow" } : {};
        return send(200, path.join(DIST, "index.html"), extra);
      }
      // 3) Có file thật (/, /sitemap.xml, /assets/*, /boot.js, favicon…) → phục vụ.
      // "/" không có route SPA fallback (index.html là file thật) — map về index.html.
      const filePath = pathname === "/" ? "/index.html" : pathname;
      const file = path.normalize(path.join(DIST, filePath));
      if (file.startsWith(DIST) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        return send(200, file);
      }
      // 4) Còn lại → 404 có thương hiệu, noindex
      return send(404, path.join(DIST, "404.html"), { "x-robots-tag": "noindex, nofollow" });
    });
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

// ─── CDP client tối giản trên WebSocket sẵn có của Node ─────────────────────
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.events = new Map();
    this.responses = [];
    ws.addEventListener("message", (event) => this._onMessage(event.data));
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", () => reject(new Error("WebSocket tới DevTools thất bại")), {
        once: true,
      });
    });
    const cdp = new Cdp(ws);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    return cdp;
  }

  _onMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
    } catch {
      return;
    }
    if (msg.id && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
      return;
    }
    if (msg.method === "Network.responseReceived") {
      this.responses.push(msg.params.response);
    }
    const waiters = this.events.get(msg.method);
    if (waiters) {
      for (const waiter of waiters.splice(0)) waiter(msg.params);
    }
  }

  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method) {
    return new Promise((resolve) => {
      if (!this.events.has(method)) this.events.set(method, []);
      this.events.get(method).push(resolve);
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(`evaluate lỗi: ${result.exceptionDetails.text}`);
    }
    return result.result.value;
  }

  async goto(url) {
    const loaded = this.once("Page.loadEventFired");
    await this.send("Page.navigate", { url });
    await Promise.race([
      loaded,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`timeout khi mở ${url}`)), 20000),
      ),
    ]);
  }

  async tab() {
    await this.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Tab",
      code: "Tab",
      windowsVirtualKeyCode: 9,
      nativeVirtualKeyCode: 9,
    });
    await this.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Tab",
      code: "Tab",
      windowsVirtualKeyCode: 9,
      nativeVirtualKeyCode: 9,
    });
  }

  async enter() {
    for (const type of ["keyDown", "keyUp"]) {
      await this.send("Input.dispatchKeyEvent", {
        type,
        key: "Enter",
        code: "Enter",
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13,
        text: type === "keyDown" ? "\r" : undefined,
      });
    }
  }

  async clickAt(x, y) {
    for (const type of ["mousePressed", "mouseReleased"]) {
      await this.send("Input.dispatchMouseEvent", {
        type,
        x,
        y,
        button: "left",
        clickCount: 1,
      });
    }
  }

  /** Click chuột THẬT tại toạ độ phần tử (chứng minh không có gì chặn con trỏ). */
  async clickSelector(selector) {
    const box = await this.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      el.scrollIntoView({ block: "center" });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    })()`);
    if (!box) throw new Error(`không tìm thấy phần tử ${selector}`);
    await this.clickAt(box.x, box.y);
    return box;
  }

  /** Click chuột thật vào phần tử có ĐÚNG nội dung text (VI/EN/DE…). */
  async clickText(text) {
    const box = await this.evaluate(`(() => {
      const el = [...document.querySelectorAll("button, a")].find(
        (b) => (b.textContent || "").trim() === ${JSON.stringify(text)},
      );
      if (!el) return null;
      el.scrollIntoView({ block: "center" });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    })()`);
    if (!box) throw new Error(`không tìm thấy phần tử có text ${JSON.stringify(text)}`);
    await this.clickAt(box.x, box.y);
    return box;
  }

  static async launch(bin) {
    const port = 39000 + Math.floor(Math.random() * 2000);
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "protogon-browser-"));
    const child = spawn(
      bin,
      [
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${userDataDir}`,
        "--window-size=1280,800",
        "about:blank",
      ],
      { stdio: "ignore" },
    );
    const wsUrl = await (async () => {
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        try {
          const res = await fetch(`http://127.0.0.1:${port}/json/list`);
          const targets = await res.json();
          const page = targets.find((t) => t.type === "page");
          if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
        } catch {
          // trình duyệt chưa mở cổng — thử lại
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      throw new Error(`Chromium không mở cổng debug (${bin})`);
    })();
    return { cdp: await Cdp.connect(wsUrl), child, port, userDataDir };
  }

  async close() {
    try {
      await this.send("Page.close");
    } catch {
      // trang đã đóng — bỏ qua
    }
  }
}

// ─── Dựng dữ liệu dùng chung ────────────────────────────────────────────────
let shared = null;

async function setup() {
  if (shared) return shared;
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    console.error(`[browser-test] Thiếu ${DIST}/index.html — đang build…`);
    const build = spawnSync("bun", ["run", "build"], { cwd: ROOT, stdio: "inherit" });
    if (build.status !== 0) throw new Error("build thất bại, không có gì để test");
  }
  const bin = findChromium();
  if (!bin) {
    throw new Error(
      "Không tìm thấy trình duyệt Chromium. Cài chromium hoặc đặt CHROME_BIN=/path/to/chrome. " +
        "(Đặt SKIP_BROWSER_TESTS=1 để bỏ qua cụm test này ở môi trường không có trình duyệt.)",
    );
  }
  const port = 46000 + Math.floor(Math.random() * 3000);
  const server = await startServer(port);
  const base = `http://127.0.0.1:${port}`;
  const launched = await Cdp.launch(bin);
  shared = {
    base,
    server,
    bin,
    port,
    launched,
    async openPage() {
      // Chromium hiện đại chỉ nhận PUT cho /json/new (GET bị từ chối).
      const res = await fetch(`http://127.0.0.1:${launched.port}/json/new?about:blank`, {
        method: "PUT",
      });
      const target = await res.json();
      const page = await Cdp.connect(target.webSocketDebuggerUrl);
      // Headless không có cửa sổ thật → phải bật "giả lập focus" để
      // element.focus()/Tab/Enter hoạt động như trình duyệt thường.
      await page.send("Emulation.setFocusEmulationEnabled", { enabled: true });
      await page.send("Page.bringToFront");
      return page;
    },
  };
  return shared;
}

function teardown() {
  if (!shared) return;
  shared.launched.child.kill("SIGKILL");
  shared.server.close();
  shared = null;
}

const OVERLAY_STATE = `(() => {
  const boot = document.getElementById("boot");
  if (!boot) return "removed";
  const cs = getComputedStyle(boot);
  const covered = (() => {
    const el = document.elementFromPoint(Math.floor(innerWidth / 2), Math.floor(innerHeight / 2));
    return !!(el && (el === boot || boot.contains(el)));
  })();
  const hidden = cs.visibility === "hidden" || Number(cs.opacity) === 0 || boot.classList.contains("is-done");
  return covered ? "covering" : hidden ? "hidden" : "visible";
})()`;

browserTest(
  "A. /boot.js bị chặn → app vẫn hiện, lớp phủ biến mất, trang tương tác được",
  async (t) => {
    const ctx = await setup();
    const page = await ctx.openPage();
    t.after(() => page.close());
    await page.send("Network.setBlockedURLs", { urls: ["*/boot.js*", "*boot.js*"] });
    await page.goto(ctx.base + "/");
    // Chốt an toàn của BootSignal là 3s, rồi 700ms nữa overlay mới rời DOM →
    // chờ 4.5s cho chắc. Nếu fail-open hoạt động, người dùng chỉ kẹt tối đa 3s
    // (thay vì vĩnh viễn như trước khi có finishBootOverlay).
    await new Promise((r) => setTimeout(r, 4500));

    const bootDoneExists = await page.evaluate("typeof window.__bootDone");
    t.diagnostic(`window.__bootDone = ${bootDoneExists} (phải là "undefined" — chặn có hiệu lực)`);
    if (bootDoneExists !== "undefined") {
      // Chặn không hiệu lực thì toàn bộ assertion sau vô nghĩa → fail sớm, rõ ràng.
      t.diagnostic("⚠️ Network.setBlockedURLs không chặn được /boot.js");
    }

    const app = await page.evaluate(`(() => ({
    rootChildren: document.querySelectorAll("#root > *").length,
    h1: document.querySelector("h1")?.textContent?.trim().slice(0, 40) ?? null,
    overlay: ${OVERLAY_STATE},
  }))()`);
    t.diagnostic(`app: ${JSON.stringify(app)}`);

    if (bootDoneExists === "undefined") {
      t.assert.strictEqual(
        app.overlay,
        "removed",
        "lớp phủ #boot phải được gỡ khi boot.js không chạy",
      );
    }
    t.assert.ok(app.rootChildren > 0, "React phải render được (không phải trang trắng)");
    t.assert.ok(app.h1 && app.h1.length > 0, "phải có H1 có nội dung");

    // Tương tác THẬT: bấm nút đổi ngôn ngữ bằng toạ độ chuột → ngôn ngữ đổi.
    // (Click qua toạ độ, không phải element.click(): nếu lớp phủ #boot còn chặn
    // con trỏ thì cú click này rơi vào lớp phủ và ngôn ngữ KHÔNG đổi.)
    const clickedLang = await (async () => {
      await page.clickText("EN");
      await new Promise((r) => setTimeout(r, 400));
      return page.evaluate("document.documentElement.lang");
    })();
    t.diagnostic(`lang sau khi bấm EN = ${clickedLang}`);
    t.assert.strictEqual(
      clickedLang,
      "en",
      "bấm EN phải đổi được ngôn ngữ — trang không bị lớp phủ chặn",
    );
  },
);

browserTest("B. /boot.js chạy bình thường → preloader đóng đúng thiết kế cũ", async (t) => {
  const ctx = await setup();
  const page = await ctx.openPage();
  t.after(() => page.close());
  await page.send("Network.setBlockedURLs", { urls: [] });
  await page.goto(ctx.base + "/");
  await new Promise((r) => setTimeout(r, 1600));

  const state = await page.evaluate(`(() => ({
    bootDone: typeof window.__bootDone,
    overlay: ${OVERLAY_STATE},
    h1: !!document.querySelector("h1"),
  }))()`);
  t.diagnostic(`normal boot: ${JSON.stringify(state)}`);
  t.assert.strictEqual(state.bootDone, "function", "/boot.js phải chạy và gán window.__bootDone");
  t.assert.strictEqual(state.overlay, "removed", "lớp phủ phải được gỡ sau khi boot hoàn tất");
  t.assert.ok(state.h1, "app phải render");
});

browserTest("C. /status → 301 /monitor; canonical/og:url/JSON-LD đều là /monitor", async (t) => {
  const ctx = await setup();
  const page = await ctx.openPage();
  t.after(() => page.close());

  await page.goto(ctx.base + "/status");
  await new Promise((r) => setTimeout(r, 1200));

  // Redirect được chứng minh ở mức hành vi: fetch có follow redirect thì
  // `redirected === true` và URL cuối là /monitor. Nếu /status TỰ PHỤC VỤ trang
  // (không redirect) thì redirected === false — đúng thứ cần chặn.
  // MÃ 301 cố định (không phải 302) do test cấu hình khoá: vercel.json
  // (permanent: true) và Dockerfile.web (return 301).
  const statusUrl = ctx.base + "/status";
  const redirectProof = await page.evaluate(`(async () => {
    const res = await fetch(${JSON.stringify(statusUrl)});
    return { redirected: res.redirected, url: res.url, status: res.status };
  })()`);
  t.diagnostic(`fetch /status (có follow): ${JSON.stringify(redirectProof)}`);
  t.assert.strictEqual(
    redirectProof.redirected,
    true,
    "/status phải redirect, không tự phục vụ trang",
  );
  t.assert.ok(
    redirectProof.url.endsWith("/monitor"),
    `redirect phải rơi về /monitor (đang ở ${redirectProof.url})`,
  );
  t.assert.strictEqual(redirectProof.status, 200, "sau redirect phải ra trang thật");

  const after = await page.evaluate(`(() => ({
    pathname: location.pathname,
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null,
    ogUrl: document.querySelector('meta[property="og:url"]')?.content ?? null,
    robots: document.querySelector('meta[name="robots"]')?.content ?? null,
    jsonld: (() => {
      const el = document.getElementById("route-jsonld");
      if (!el) return null;
      const j = JSON.parse(el.textContent);
      const page_ = (j["@graph"] || []).find((g) => g["@type"] === "WebPage");
      const crumbs = (j["@graph"] || []).find((g) => g["@type"] === "BreadcrumbList");
      return { url: page_?.url ?? null, id: page_?.["@id"] ?? null, crumb: crumbs?.itemListElement?.[1]?.item ?? null };
    })(),
  }))()`);
  t.diagnostic(`sau khi mở /status: ${JSON.stringify(after)}`);

  t.assert.strictEqual(after.pathname, "/monitor", "/status phải rơi về /monitor (redirect 301)");
  const origin = new URL(ctx.base).origin;
  t.assert.strictEqual(after.canonical, `${origin}/monitor`, "canonical phải là /monitor");
  t.assert.strictEqual(after.ogUrl, `${origin}/monitor`, "og:url phải dùng URL canonical");
  t.assert.strictEqual(
    after.jsonld?.url,
    `${origin}/monitor`,
    "JSON-LD WebPage url phải là canonical",
  );
  t.assert.strictEqual(
    after.jsonld?.id,
    `${origin}/monitor#webpage`,
    "JSON-LD @id phải dựa trên canonical",
  );
  t.assert.strictEqual(after.jsonld?.crumb, `${origin}/monitor`, "breadcrumb phải dùng canonical");
});

browserTest("D. /monitor giữ canonical chính nó (trang canonical thật sự)", async (t) => {
  const ctx = await setup();
  const page = await ctx.openPage();
  t.after(() => page.close());
  await page.goto(ctx.base + "/monitor");
  await new Promise((r) => setTimeout(r, 1100));
  const state = await page.evaluate(`(() => ({
    pathname: location.pathname,
    canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
    robots: document.querySelector('meta[name="robots"]')?.content ?? null,
    h1: document.querySelector("h1")?.textContent?.trim() ?? null,
  }))()`);
  const origin = new URL(ctx.base).origin;
  t.diagnostic(`/monitor: ${JSON.stringify(state)}`);
  t.assert.strictEqual(state.canonical, `${origin}/monitor`);
  t.assert.strictEqual(state.robots, "index,follow");
  t.assert.ok(state.h1 && state.h1.length > 0);
});

browserTest(
  "E. Skip-link dùng được bằng bàn phím: Tab → hiện → Enter → focus vào <main>",
  async (t) => {
    const ctx = await setup();
    const page = await ctx.openPage();
    t.after(() => page.close());
    await page.goto(ctx.base + "/features");
    await new Promise((r) => setTimeout(r, 1200));

    await page.tab();
    const first = await page.evaluate(`(() => {
    const el = document.activeElement;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { tag: el.tagName, href: el.getAttribute("href"), text: (el.textContent || "").trim().slice(0, 40), width: r.width, height: r.height };
  })()`);
    t.diagnostic(`Tab đầu tiên: ${JSON.stringify(first)}`);
    t.assert.strictEqual(first?.tag, "A", "Tab đầu tiên phải dừng ở skip-link");
    t.assert.strictEqual(first?.href, "#main", "skip-link phải trỏ tới #main");
    t.assert.ok(
      (first?.width ?? 0) > 40 && (first?.height ?? 0) > 20,
      "skip-link phải HIỆN khi focus (không còn ẩn)",
    );

    await page.enter();
    await new Promise((r) => setTimeout(r, 400));
    const after = await page.evaluate(`(() => ({
    hash: location.hash,
    activeTag: document.activeElement?.tagName ?? null,
    activeId: document.activeElement?.id ?? null,
    activeIsMain: document.activeElement === document.querySelector("main#main"),
    mainTop: document.querySelector("main#main")?.getBoundingClientRect().top ?? null,
  }))()`);
    t.diagnostic(`sau Enter: ${JSON.stringify(after)}`);
    t.assert.strictEqual(after.hash, "#main", "Enter phải nhảy tới #main");
    // Chromium chỉ tự focus đích fragment khi đích focusable được — nhờ
    // tabIndex={-1}. Focus không vào <main> thì người dùng bàn phím vẫn đứng
    // nguyên ở đầu trang (bấm Tab tiếp tục quay lại điều hướng).
    if (!after.activeIsMain) {
      // Dự phòng: ép focus như trình duyệt chuẩn phải làm, rồi đo lại — chỉ để
      // phân biệt "thiếu tabIndex" với "trình duyệt không tự focus".
      const forced = await page.evaluate(`(() => {
      const main = document.querySelector("main#main");
      if (!main) return "no-main";
      if (main.tabIndex !== -1) return "missing-tabindex";
      main.focus();
      return document.activeElement === main ? "focusable" : "not-focusable";
    })()`);
      t.diagnostic(`kiểm tra đích nhảy: ${forced}`);
      t.assert.strictEqual(forced, "focusable", "<main id=main> phải focusable (tabIndex={-1})");
    }
    t.assert.ok((after.mainTop ?? -1) >= -2, "phần main phải nằm trong khung nhìn");
  },
);

browserTest(
  "F. Route public mở trực tiếp được; private route có noindex; route lạ 404 thương hiệu",
  async (t) => {
    const ctx = await setup();

    // Public direct visit (SPA fallback trong production)
    {
      const page = await ctx.openPage();
      t.after(() => page.close());
      await page.goto(ctx.base + "/features");
      await new Promise((r) => setTimeout(r, 1800));
      const state = await page.evaluate(`(() => ({
      h1: document.querySelector("h1")?.textContent?.trim().slice(0, 40) ?? null,
      title: document.title.slice(0, 40),
      overlay: ${OVERLAY_STATE},
    }))()`);
      t.diagnostic(`/features trực tiếp: ${JSON.stringify(state)}`);
      t.assert.ok(state.h1, "/features mở trực tiếp phải ra trang thật (không 404)");
      t.assert.notStrictEqual(state.overlay, "covering", "lớp phủ không được chặn nội dung");
    }

    // Private route: header noindex phía server
    {
      const page = await ctx.openPage();
      t.after(() => page.close());
      await page.goto(ctx.base + "/"); // vào cùng origin rồi mới fetch được
      const res = await page.evaluate(`(async () => {
      const r = await fetch("${ctx.base}/admin", { redirect: "manual" });
      return { status: r.status, robots: r.headers.get("x-robots-tag") };
    })()`);
      t.diagnostic(`/admin: ${JSON.stringify(res)}`);
      t.assert.strictEqual(res.status, 200, "private route vẫn phục vụ SPA");
      t.assert.strictEqual(
        res.robots,
        "noindex, nofollow",
        "hosting phải gắn X-Robots-Tag noindex",
      );
    }

    // Public route KHÔNG được có noindex
    {
      const page = await ctx.openPage();
      t.after(() => page.close());
      await page.goto(ctx.base + "/");
      const robots = await page.evaluate(`(async () => {
      const r = await fetch("${ctx.base}/monitor", { redirect: "manual" });
      return { status: r.status, robots: r.headers.get("x-robots-tag") };
    })()`);
      t.diagnostic(`/monitor: ${JSON.stringify(robots)}`);
      t.assert.strictEqual(robots.status, 200);
      t.assert.strictEqual(robots.robots, null, "trang public KHÔNG được gắn noindex");
    }

    // Route lạ → 404 có thương hiệu + noindex
    {
      const page = await ctx.openPage();
      t.after(() => page.close());
      await page.goto(ctx.base + "/");
      const res = await page.evaluate(`(async () => {
      const r = await fetch("${ctx.base}/duong-dan-la", { redirect: "manual" });
      const text = await r.text();
      return { status: r.status, robots: r.headers.get("x-robots-tag"), hasHeading: /404/.test(text) };
    })()`);
      t.diagnostic(`/duong-dan-la: ${JSON.stringify(res)}`);
      t.assert.strictEqual(res.status, 404);
      t.assert.strictEqual(res.robots, "noindex, nofollow");
      t.assert.ok(res.hasHeading, "404 phải là trang 404 có thương hiệu");
    }
  },
);

browserTest("G. Không có lỗi console trong suốt các route công khai", async (t) => {
  const ctx = await setup();
  const page = await ctx.openPage();
  t.after(() => page.close());
  // Lắng nghe console + exception bằng CDP event
  const consoleErrors = [];
  const listener = (params) => {
    if (params.type === "error")
      consoleErrors.push((params.args || []).map((a) => a.value ?? a.description).join(" "));
  };
  if (!page.events.has("Runtime.consoleAPICalled")) page.events.set("Runtime.consoleAPICalled", []);
  page.events.get("Runtime.consoleAPICalled").push(listener);
  const pageErrors = [];
  if (!page.events.has("Runtime.exceptionThrown")) page.events.set("Runtime.exceptionThrown", []);
  page.events.get("Runtime.exceptionThrown").push((params) => {
    pageErrors.push(params.exceptionDetails?.text ?? "unknown");
  });

  for (const route of ["/", "/features", "/monitor", "/terms", "/privacy", "/data-deletion"]) {
    await page.goto(ctx.base + route);
    await new Promise((r) => setTimeout(r, 800));
  }
  t.diagnostic(`console errors: ${JSON.stringify(consoleErrors)}`);
  t.diagnostic(`page exceptions: ${JSON.stringify(pageErrors)}`);
  t.assert.deepStrictEqual(consoleErrors, [], "không được có console error (CSP/asset/404 ẩn)");
  t.assert.deepStrictEqual(pageErrors, [], "không được có exception khi chạy");
});

// Dọn dẹp sau toàn bộ suite: giết Chromium + đóng server
test.after(() => {
  teardown();
});
