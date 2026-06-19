import http from "node:http";

const TARGET_PORT = 3000;
const PROXY_PORT = 3001;

const ALLOWED = ["/share", "/api/share"];

const proxy = http.createServer((req, res) => {
  const allowed = ALLOWED.some((p) => req.url?.startsWith(p));
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
