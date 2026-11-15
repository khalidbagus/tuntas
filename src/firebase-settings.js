// Private development tokens are read only in Vite's development mode.
const env = import.meta.env ?? {};
const loopbackHosts = ["localhost", "127.0.0.1", "[::1]"];
export const debugToken =
  import.meta.env?.DEV &&
  loopbackHosts.includes(globalThis.location?.hostname)
    ? typeof __TUNTAS_APPCHECK_DEBUG_TOKEN__ === "string"
      ? __TUNTAS_APPCHECK_DEBUG_TOKEN__
      : ""
    : "";

export const firebaseConfigured = Boolean(
  env.VITE_FIREBASE_API_KEY &&
    env.VITE_FIREBASE_PROJECT_ID &&
    env.VITE_FIREBASE_APP_ID &&
    (env.VITE_APP_CHECK_SITE_KEY || debugToken),
);
