import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ command, mode }) => {
  const privateEnv = command === "serve" ? loadEnv(mode, process.cwd(), "") : {};
  return {
    define: {
      __TUNTAS_APPCHECK_DEBUG_TOKEN__: JSON.stringify(
        privateEnv.TUNTAS_APP_CHECK_DEBUG_TOKEN || "",
      ),
    },
  };
});
