import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const port = Number(process.argv[2] || 5173);
const root = path.resolve(import.meta.dirname, "..", "public");
const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
]);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const pathname = decodeURIComponent(url.pathname === "/" ? "/atlas.html" : url.pathname);
    const file = path.resolve(root, `.${pathname}`);

    if (!file.startsWith(root)) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    const body = await fs.readFile(file);
    res.writeHead(200, {
      "content-type": types.get(path.extname(file)) || "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Preview server listening on http://127.0.0.1:${port}`);
});
