import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/emulator",
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:5175",
    viewport: { width: 1280, height: 850 },
    trace: "off",
  },
  webServer: {
    env: {
      VITE_FIREBASE_USE_EMULATORS: "1",
      VITE_FIREBASE_PROJECT_ID: "demo-tuntas-dev",
      VITE_FIREBASE_API_KEY: "demo-tuntas-api-key",
      VITE_FIREBASE_AUTH_DOMAIN: "demo-tuntas-dev.firebaseapp.com",
      VITE_FIREBASE_APP_ID: "1:000000000000:web:tuntasemulator",
      VITE_FIREBASE_AUTH_EMULATOR_URL: "http://127.0.0.1:9099",
      VITE_FIREBASE_FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      VITE_APP_CHECK_SITE_KEY: "",
      TUNTAS_APP_CHECK_DEBUG_TOKEN: "",
    },
    command: "npm run dev -- --port 5175 --strictPort",
    url: "http://127.0.0.1:5175",
    reuseExistingServer: false,
    timeout: 90000,
  },
});
