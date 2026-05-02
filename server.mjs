import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const dataDir = join(root, "data");
const stateFile = join(dataDir, "oa-state.json");
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".ai": "application/pdf",
  ".svg": "image/svg+xml; charset=utf-8",
};

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${port}`);
  if (url.pathname === "/api/state" && req.method === "GET") {
    try {
      const data = await readFile(stateFile, "utf8");
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(data);
    } catch {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end("{}");
    }
    return;
  }
  if (url.pathname === "/api/state" && req.method === "POST") {
    try {
      const body = await readBody(req);
      JSON.parse(body);
      await mkdir(dataDir, { recursive: true });
      await writeFile(stateFile, body, "utf8");
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end('{"ok":true}');
    } catch {
      res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
      res.end('{"ok":false}');
    }
    return;
  }
  const requestPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = normalize(join(root, requestPath));

  if (!filePath.startsWith(root) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, { "content-type": types[extname(filePath)] || "application/octet-stream" });
  createReadStream(filePath).pipe(res);
}).listen(port, () => {
  console.log(`OA system running at http://localhost:${port}`);
});
