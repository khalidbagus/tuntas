import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 2,
  fullyParallel: true,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:5174",
    viewport: { width: 1280, height: 850 },
    trace: "off",
  },
  webServer: {
    // Local journey tests must stay independent of a developer's live project.
    env: {
      VITE_FIREBASE_USE_EMULATORS: "",
      VITE_FIREBASE_API_KEY: "",
      VITE_FIREBASE_PROJECT_ID: "",
      VITE_FIREBASE_APP_ID: "",
      VITE_APP_CHECK_SITE_KEY: "",
      TUNTAS_APP_CHECK_DEBUG_TOKEN: "",
    },
    command: "npm run dev -- --port 5174 --strictPort",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
    timeout: 90000,
  },
});
