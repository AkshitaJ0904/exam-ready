/* Local dev server: serves public/ and routes /api/* to the same handlers Vercel uses.
 *   node server.js        (PORT=8000 by default) */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { routes } = require("./lib/handlers");

const PUBLIC = path.join(__dirname, "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon" };

http.createServer((req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  const api = pathname.match(/^\/api\/([a-z]+)$/);
  if (api) {
    const handler = routes[api[1]];
    if (!handler) { res.statusCode = 404; return res.end("Not found"); }
    return handler(req, res);
  }
  let file = path.normalize(path.join(PUBLIC, pathname === "/" ? "index.html" : pathname));
  if (!file.startsWith(PUBLIC + path.sep)) { res.statusCode = 403; return res.end("Forbidden"); }
  fs.readFile(file, (err, data) => {
    if (err) { res.statusCode = 404; return res.end("Not found"); }
    res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
    res.end(data);
  });
}).listen(process.env.PORT || 8000, () => console.log(`Exam Ready running at http://localhost:${process.env.PORT || 8000}`));
