// Creates a new local, allowlisted snapshot. Never publishes or reads private photos.
import { readFile, readdir, mkdir, writeFile, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const root = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const destination = path.join(root, ".release", stamp);
const source = path.join(destination, "source");
const selected = [
  ".gitignore", ".gitattributes", ".env.example", "package.json", "package-lock.json",
  "index.html", "vite.config.js", "playwright.config.js", "firebase.json", "README.md", "LICENSE", "NOTICE.md",
  "docs/PROVENANCE.md", "docs/VERIFICATION.md", "docs/FLOW.md", "docs/STITCH-AUDIT.md", "docs/DEVELOPMENT-ACCESS.md",
  "docs/submission/JUDGING.md", "docs/submission/VALIDATION.md",
  "docs/demo/desktop.png", "docs/demo/mobile.png", "docs/demo/filed-receipt.png",
  "docs/demo/firebase-device.png", "docs/demo/mobile-phone.png", "docs/demo/mobile-phone-cloud.png",
  "docs/demo/firebase-cloud.jpg",
  "docs/demo/workspace-home.png", "docs/demo/workspace-library.png", "docs/demo/workspace-connections.png",
  "scripts/android-dev.ps1", "scripts/verify-nano.mjs", "scripts/verify-receipts.mjs", "scripts/demo-screens.mjs", "scripts/prepare-release.mjs",
];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw Error("Symlink not accepted in source snapshot.");
    if (entry.isDirectory()) await walk(file);
    else selected.push(path.relative(root, file).replaceAll("\\", "/"));
  }
}
for (const directory of ["src", "public", "tests"]) await walk(path.join(root, directory));

// Compare the actual token in memory only; never log its contents.
const localEnv = await readFile(path.join(root, ".env.local"), "utf8").catch(() => "");
const tokenLine = localEnv.match(/^TUNTAS_APP_CHECK_DEBUG_TOKEN\s*=\s*(.+)$/m)?.[1]?.trim();
const token = tokenLine?.replace(/^["']|["']$/g, "");
const patterns = [
  /AIza[\w-]{30,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /"type"\s*:\s*"service_account"/,
  /(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}/,
];
const manifest = [];
for (const file of [...new Set(selected)].sort()) {
  const bytes = await readFile(path.join(root, file));
  if (!/\.(png|jpg|jpeg|woff2?)$/i.test(file)) {
    const content = bytes.toString("utf8");
    if ((token && bytes.includes(Buffer.from(token))) || patterns.some((p) => p.test(content)))
      throw Error("Potential credential detected; review locally: " + file);
  }
  manifest.push({ file, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
}
let builtFiles = 0;
async function checkBuild(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await checkBuild(file);
    else {
      const bytes = await readFile(file);
      if (token && bytes.includes(Buffer.from(token))) throw Error("Private debug token found in production build.");
      builtFiles++;
    }
  }
}
await checkBuild(path.join(root, "dist")); // Require a build; never count missing artifacts as passed.
await mkdir(source, { recursive: true });
for (const entry of manifest) {
  const target = path.join(source, entry.file);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(root, entry.file), target);
}
await writeFile(path.join(destination, "manifest.json"), JSON.stringify({
  preparedAt: new Date().toISOString(),
  published: false,
  checks: { sourcePatterns: "passed", debugTokenComparison: token ? "passed" : "not configured", productionFilesScanned: builtFiles },
  limitations: "Allowlisted source and bounded credential checks only; visual assets need separate review. Tests are recorded separately.",
  files: manifest,
}, null, 2));
console.log(JSON.stringify({ source, files: manifest.length, productionFilesScanned: builtFiles, published: false }));
