// Private development tokens are read only in Vite's development mode.
const env = import.meta.env ?? {};
const loopbackHosts = ["localhost", "127.0.0.1", "[::1]"];
const isLoopback = loopbackHosts.includes(globalThis.location?.hostname);

export const debugToken =
  import.meta.env?.DEV && isLoopback
    ? typeof __TUNTAS_APPCHECK_DEBUG_TOKEN__ === "string"
      ? __TUNTAS_APPCHECK_DEBUG_TOKEN__
      : ""
    : "";

export const useEmulators = Boolean(
  isLoopback &&
    (env.VITE_FIREBASE_USE_EMULATORS === "1" ||
      env.VITE_FIREBASE_USE_EMULATORS === "true"),
);

export const authEmulatorUrl =
  env.VITE_FIREBASE_AUTH_EMULATOR_URL || "http://127.0.0.1:9099";

export const firestoreEmulatorHost =
  env.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";

const projectId =
  env.VITE_FIREBASE_PROJECT_ID || (useEmulators ? "demo-tuntas-dev" : "");

export const firebaseAuthConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || (useEmulators ? "demo-tuntas-api-key" : ""),
  authDomain:
    env.VITE_FIREBASE_AUTH_DOMAIN ||
    (projectId ? `${projectId}.firebaseapp.com` : ""),
  projectId,
  appId:
    env.VITE_FIREBASE_APP_ID ||
    (useEmulators ? "1:000000000000:web:tuntasemulator" : ""),
};

export const firebaseAuthConfigured = Boolean(
  useEmulators ||
    (env.VITE_FIREBASE_API_KEY &&
      env.VITE_FIREBASE_PROJECT_ID &&
      env.VITE_FIREBASE_APP_ID),
);

export const firebaseConfigured = Boolean(
  env.VITE_FIREBASE_API_KEY &&
    env.VITE_FIREBASE_PROJECT_ID &&
    env.VITE_FIREBASE_APP_ID &&
    (env.VITE_APP_CHECK_SITE_KEY || debugToken),
);
