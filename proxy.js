import http from "node:http";

const TARGET_PORT = 3000;
const PROXY_PORT = 3001;

const SHARE_ROUTES = ["/share", "/api/share"];
// SvelteKit/Vite internal paths needed for CSS/JS/HMR to work
const ASSET_PREFIXES = ["/_app", "/src", "/@vite", "/@fs", "/node_modules", "/favicon.ico"];

const proxy = http.createServer((req, res) => {
  const allowed =
    SHARE_ROUTES.some((p) => req.url?.startsWith(p)) ||
    ASSET_PREFIXES.some((p) => req.url?.startsWith(p));
  if (!allowed) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const opts = {
    hostname: "127.0.0.1",
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };

  const upstream = http.request(opts, (upRes) => {
    res.writeHead(upRes.statusCode ?? 200, upRes.headers);
    upRes.pipe(res);
  });

  upstream.on("error", () => {
    res.writeHead(502);
    res.end("Bad Gateway");
  });

  req.pipe(upstream);
});

proxy.listen(PROXY_PORT, () => {
  console.log(`[proxy] :${PROXY_PORT} -> :${TARGET_PORT} (only /share, /api/share)`);
});
