import { defineConfig, loadEnv } from "vite";
import { readFile } from "node:fs/promises";
import path from "node:path";

const privateReceiptsDirectory = ".release/private-demo-receipts";

function localDemoReceipts() {
  return {
    name: "local-demo-receipts",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__tuntas_demo_receipts", async (req, res) => {
        const file = req.url?.split("?")[0]?.slice(1);
        const localHost = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;
        if (
          req.method !== "GET" ||
          !localHost.test(req.headers.host || "") ||
          req.headers["sec-fetch-site"] === "cross-site" ||
          !/^(?:manifest\.json|receipt_[1-8]\.jpeg)$/.test(file || "")
        ) {
          res.writeHead(404).end();
          return;
        }
        try {
          const bytes = await readFile(
            path.join(server.config.root, privateReceiptsDirectory, file),
          );
          res.writeHead(200, {
            "Content-Type": file.endsWith(".json") ? "application/json" : "image/jpeg",
            "Cache-Control": "no-store",
          }).end(bytes);
        } catch (error) {
          res.writeHead(error.code === "ENOENT" ? 404 : 500).end();
        }
      });
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const privateEnv = command === "serve" ? loadEnv(mode, process.cwd(), "") : {};
  return {
    plugins: [localDemoReceipts()],
    server: {
      fs: {
        deny: [
          ".env",
          ".env.*",
          "*.{crt,pem,key,p12,pfx,cer,der}",
          ".npmrc",
          ".yarnrc.yml",
          "**/.git/**",
          `**/${privateReceiptsDirectory}/**`,
        ],
      },
    },
    define: {
      __TUNTAS_APPCHECK_DEBUG_TOKEN__: JSON.stringify(
        privateEnv.TUNTAS_APP_CHECK_DEBUG_TOKEN || "",
      ),
    },
  };
});
