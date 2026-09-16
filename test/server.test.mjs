import test from "node:test";
import assert from "node:assert/strict";
import { server } from "../server.mjs";
test("local server serves only app assets, rejects source/config paths, supplies CSP", async () => {
  const app = server();
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${app.address().port}`;
  try {
    const html = await fetch(base);
    assert.equal(html.status, 200);
    assert.match(await html.text(), /Omarchy Gridcannon/);
    assert.match(
      html.headers.get("content-security-policy"),
      /connect-src 'none'/,
    );
    for (const path of ["/engine.mjs", "/app.mjs", "/style.css", "/icon.svg"])
      assert.equal((await fetch(base + path)).status, 200);
    for (const path of [
      "/.git/config",
      "/package.json",
      "/README.md",
      "/server.mjs",
      "/%2e%2e/%2e%2e/etc/passwd",
    ])
      assert.equal((await fetch(base + path)).status, 404);
    assert.equal((await fetch(base, { method: "POST" })).status, 404);
  } finally {
    await new Promise((resolve) => app.close(resolve));
  }
});
