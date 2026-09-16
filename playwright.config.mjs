import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://127.0.0.1:4174",
    viewport: { width: 1440, height: 1100 },
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command: "PORT=4174 node server.mjs",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
  },
  reporter: "list",
});
