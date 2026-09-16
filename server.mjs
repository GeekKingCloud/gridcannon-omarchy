import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const files = new Map([
  ["/", ["index.html", "text/html"]],
  ["/index.html", ["index.html", "text/html"]],
  ["/style.css", ["style.css", "text/css"]],
  ["/app.mjs", ["app.mjs", "text/javascript"]],
  ["/engine.mjs", ["engine.mjs", "text/javascript"]],
  ["/icon.svg", ["icon.svg", "image/svg+xml"]],
]);
export function server() {
  return createServer(async (req, res) => {
    let entry;
    try {
      entry = files.get(new URL(req.url, "http://localhost").pathname);
    } catch {
      /* Invalid request URL. */
    }
    if (!entry || !["GET", "HEAD"].includes(req.method)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    try {
      const body = await readFile(new URL(entry[0], import.meta.url));
      res.writeHead(200, {
        "Content-Type": `${entry[1]}; charset=utf-8`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      res.writeHead(500);
      res.end("Unable to read application file");
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  const app = server();
  app.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  app.listen(port, "127.0.0.1", () =>
    console.log(`Omarchy Gridcannon: http://127.0.0.1:${app.address().port}`),
  );
}
