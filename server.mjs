import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const dataDir = join(root, "data");
const stateFile = join(dataDir, "oa-state.json");
const backupFile = join(dataDir, "oa-state.backup.json");
const pwaHead = `
    <meta name="theme-color" content="#9f2f24" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="秦時線 OA" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/assets/qinxian-logo.svg" type="image/svg+xml" />`;
const pwaScript = `
    <script>
      if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
          navigator.serviceWorker.register("/sw.js").catch(() => {});
        });
      }
    </script>`;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".md": "text/plain; charset=utf-8",
  ".ai": "application/pdf",
  ".svg": "image/svg+xml; charset=utf-8",
};

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function hasMeaningfulState(data) {
  return Boolean(
    data &&
    (
      (data.settings?.users || []).length ||
      (data.products || []).length ||
      (data.partners || []).length ||
      (data.purchases || []).length ||
      (data.sales || []).length ||
      (data.qinLiveSales || []).length ||
      (data.liveSales || []).length ||
      (data.knitters || []).length ||
      (data.samples || []).length
    )
  );
}

createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${port}`);
  if (url.pathname === "/api/state" && req.method === "GET") {
    try {
      const data = await readFile(stateFile, "utf8");
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(data);
    } catch {
      try {
        const backup = await readFile(backupFile, "utf8");
        res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
        res.end(backup);
      } catch {
        res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
        res.end("{}");
      }
    }
    return;
  }
  if (url.pathname === "/api/state" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const nextState = JSON.parse(body);
      if (!hasMeaningfulState(nextState) && existsSync(stateFile)) {
        const currentState = JSON.parse(await readFile(stateFile, "utf8"));
        if (hasMeaningfulState(currentState)) {
          res.writeHead(409, { "content-type": "application/json; charset=utf-8" });
          res.end('{"ok":false,"reason":"refuse_empty_overwrite"}');
          return;
        }
      }
      await mkdir(dataDir, { recursive: true });
      if (existsSync(stateFile)) {
        await writeFile(backupFile, await readFile(stateFile, "utf8"), "utf8");
      }
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
  if (requestPath === "/index.html") {
    const html = await readFile(filePath, "utf8");
    res.end(html
      .replace("</head>", `${pwaHead}\n  </head>`)
      .replace("</body>", `${pwaScript}\n  </body>`));
    return;
  }
  createReadStream(filePath).pipe(res);
}).listen(port, () => {
  console.log(`OA system running at http://localhost:${port}`);
});
