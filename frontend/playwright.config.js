import { defineConfig } from "@playwright/test";
import fs from "node:fs";

const browsers = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
];
const executablePath = browsers.find((value) => value && fs.existsSync(value));
export default defineConfig({
  testDir: "./test",
  timeout: 30000,
  workers: 1,
  use: {
    baseURL: process.env.UI_TEST_URL || "http://localhost:5173",
    viewport: { width: 1440, height: 1000 },
    launchOptions: executablePath ? { executablePath } : {},
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
