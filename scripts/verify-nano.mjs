// Bounded diagnostic on an isolated Chrome profile, using synthetic text only.
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { writeFile, mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    profile: { type: "string" },
    output: { type: "string" },
    chrome: {
      type: "string",
      default: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    },
  },
});
if (!values.profile || !values.output)
  throw Error("Provide --profile and --output.");
const profile = path.resolve(values.profile);
const result = { started: new Date().toISOString(), hardwareBypass: false };
await mkdir(path.dirname(path.resolve(values.output)), { recursive: true });
const chromeProcess = spawn(
  values.chrome,
  [
    "--user-data-dir=" + profile,
    "--remote-debugging-port=9333",
    "--remote-debugging-address=127.0.0.1",
    "--no-first-run",
    "--no-default-browser-check",
    "--enable-features=PromptAPIForGeminiNano,PromptAPIForGeminiNanoMultimodalInput",
    "--start-minimized",
    "http://127.0.0.1:5173/#/capture",
  ],
  { windowsHide: true, stdio: "ignore" },
);
let browser;
try {
  const modelRoot = path.join(profile, "OptGuideOnDeviceModel");
  for (const entry of await readdir(modelRoot, { withFileTypes: true }).catch(
    () => [],
  )) {
    if (!entry.isDirectory()) continue;
    try {
      const manifest = JSON.parse(
        await readFile(
          path.join(modelRoot, entry.name, "manifest.json"),
          "utf8",
        ),
      );
      result.modelManifest = {
        componentVersion: manifest.version,
        baseModel: manifest.BaseModelSpec,
      };
    } catch {}
  }
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const response = await fetch("http://127.0.0.1:9333/json/version", {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  browser = await chromium.connectOverCDP("http://127.0.0.1:9333", {
    timeout: 10000,
  });
  const context = browser.contexts()[0];
  const page =
    context.pages().find((p) => p.url().startsWith("http://127.0.0.1:5173")) ||
    (await context.newPage());
  await page.goto("http://127.0.0.1:5173/#/capture");
  const options = {
    expectedInputs: [{ type: "text", languages: ["en"] }],
    expectedOutputs: [{ type: "text", languages: ["en"] }],
  };
  let availability;
  for (let attempt = 0; attempt < 15; attempt++) {
    availability = await page.evaluate(async (options) => {
      if (typeof LanguageModel === "undefined") return "api_missing";
      return LanguageModel.availability(options);
    }, options);
    if (availability !== "unavailable") break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  result.availability = availability;
  console.log(JSON.stringify({ stage: "availability", availability }));
  if (availability === "available" || availability === "downloadable") {
    const client = await context.newCDPSession(page);
    // Creation and a tiny prompt are measured separately from application inference.
    await client.send("Runtime.evaluate", {
      expression:
        "(async () => { window.__tuntasNanoProbe = {stage:'creating'}; try { const started=performance.now(); const model = await LanguageModel.create(" +
        JSON.stringify(options) +
        "); window.__tuntasNanoProbe={stage:'prompting',createMs:performance.now()-started}; const answer=await model.prompt('Reply with exactly the word READY.'); model.destroy(); window.__tuntasNanoProbe={...window.__tuntasNanoProbe,stage:'complete',answer,elapsedMs:performance.now()-started}; } catch(error) { window.__tuntasNanoProbe={stage:'failed',name:error.name,message:error.message}; } })()",
      userGesture: true,
      awaitPromise: false,
    });
    for (let attempt = 0; attempt < 90; attempt++) {
      result.rawProbe = await page.evaluate(() => window.__tuntasNanoProbe);
      if (["failed", "complete"].includes(result.rawProbe?.stage)) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.log(
      JSON.stringify({ stage: "raw_model", result: result.rawProbe }),
    );
  }
  if (result.rawProbe?.stage === "complete") {
    const generationRequests = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.includes(":generateContent"))
        generationRequests.push("cloud_generation");
    });
    await page.getByRole("button", { name: "Paste text", exact: true }).click();
    await page
      .getByLabel("Document text", { exact: true })
      .fill(
        "Synthetic local notebook receipt " +
          Date.now() +
          "\nFictional desk supplies\nTotal: USD 12.00",
      );
    await page.getByLabel("Processing method").selectOption("device");
    await page
      .getByRole("button", { name: "Save & organize", exact: true })
      .click();
    await page.waitForURL(/#\/document\//, { timeout: 110000 });
    result.application = await page.locator("main").innerText();
    result.cloudGenerationRequests = generationRequests.length;
    await page.screenshot({
      path: path.join(path.dirname(values.output), "nano-application.png"),
      fullPage: true,
    });
    console.log(
      JSON.stringify({
        stage: "application",
        onDevice: result.application.includes("Firebase · on device"),
        cloudGenerationRequests: generationRequests.length,
      }),
    );
  }
} catch (error) {
  result.error = {
    name: error.name,
    message: error.message.replace(/AIza[\w-]+/g, "[redacted]"),
  };
  console.log(JSON.stringify({ stage: "error", error: result.error }));
} finally {
  result.finished = new Date().toISOString();
  await writeFile(values.output, JSON.stringify(result, null, 2));
  if (browser) await browser.close().catch(() => {});
  chromeProcess.kill();
  if (
    !result.application?.includes("Firebase · on device") ||
    result.cloudGenerationRequests !== 0
  )
    globalThis.process.exitCode = 1;
}
