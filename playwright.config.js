// @ts-check
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests",
  timeout: 60000,
  use: {
    baseURL: "http://localhost:8765",
    ...devices["iPhone 13"],
    browserName: "chromium",
  },
  webServer: {
    command: "npx http-server -p 8765 -c-1 .",
    url: "http://localhost:8765/index.html",
    reuseExistingServer: true,
  },
});
