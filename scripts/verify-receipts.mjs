// Opt-in, private live evaluation through the existing Capture UI on a connected phone.
// Supply an output directory outside the repository. Receipt bytes never become fixtures.
import { chromium, expect } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "input-dir": { type: "string" },
    "output-dir": { type: "string" },
    expectations: { type: "string" },
    cdp: { type: "string", default: "http://127.0.0.1:9222" },
    "allow-cloud": { type: "boolean", default: false },
  },
});
if (
  !values["allow-cloud"] ||
  !values["input-dir"] ||
  !values["output-dir"] ||
  !values.expectations
)
  throw Error(
    "Provide --input-dir, --output-dir, --expectations and explicit --allow-cloud consent.",
  );
const output = path.resolve(values["output-dir"]);
const repo = path.resolve(".");
const relativeOutput = path.relative(repo, output);
if (!relativeOutput.startsWith("..") && !path.isAbsolute(relativeOutput))
  throw Error("Private evaluation output must be outside the repository.");
await mkdir(output, { recursive: true });
const browser = await chromium.connectOverCDP(values.cdp, { timeout: 15000 });
const page = browser
  .contexts()
  .flatMap((context) => context.pages())
  .find((candidate) =>
    /^http:\/\/(localhost|127\.0\.0\.1):5173\//.test(candidate.url()),
  );
if (!page) throw Error("Open Tuntas on the connected phone first.");
page.setDefaultTimeout(15000);
const run = {
  started: new Date().toISOString(),
  device: "Connected Android Chrome",
  receipts: [],
};
const expectations = JSON.parse(await readFile(values.expectations, "utf8"));
const generations = [];
page.on("response", async (response) => {
  if (!new URL(response.url()).pathname.includes(":generateContent")) return;
  const generation = { status: response.status() };
  generations.push(generation);
  try {
    generation.body = await response.json();
  } catch {}
});
try {
  for (let number = 1; number <= 4; number++) {
    const name = "receipt_" + number + ".jpeg";
    const bytes = await readFile(path.join(values["input-dir"], name));
    const digest = createHash("sha256").update(bytes).digest("hex");
    const generationStart = generations.length;
    await page.goto("http://localhost:5173/#/capture");
    await expect(
      page.getByRole("heading", { name: "Capture", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Select original file").setInputFiles({
      name,
      mimeType: "image/jpeg",
      buffer: bytes,
    });
    await page.getByLabel("Processing method").selectOption("hybrid");
    await page.getByRole("checkbox", { name: /For this document/ }).check();
    await page
      .getByRole("button", { name: "Save & organize", exact: true })
      .click();
    await page.waitForURL(/#\/document\//, { timeout: 110000 });
    const id = new URL(page.url()).hash.split("/").at(-1);
    const result = await page.evaluate(async (docId) => {
      const { snapshot, original } = await import("/src/db.js");
      const doc = (await snapshot()).docs.find((item) => item.id === docId);
      const blob = await original(docId);
      const hash = await crypto.subtle.digest(
        "SHA-256",
        await blob.arrayBuffer(),
      );
      return {
        doc,
        original: {
          size: blob.size,
          type: blob.type,
          digest: Array.from(new Uint8Array(hash), (v) =>
            v.toString(16).padStart(2, "0"),
          ).join(""),
        },
      };
    }, id);
    const total =
      result.doc.facts.find((fact) => /^grand total$/i.test(fact.label)) ||
      result.doc.facts.find((fact) => /^total$/i.test(fact.label));
    const actualTotal = total
      ? Number(total.value.replace(/[^0-9]/g, ""))
      : null;
    const record = {
      file: name,
      id,
      beforeReview: result.doc,
      originalRetained:
        result.original.digest === digest &&
        result.original.size === bytes.length,
      expectedTotal: expectations[name].total,
      actualTotal,
      totalMatches: actualTotal === expectations[name].total,
      cloudResponses: generations.slice(generationStart),
    };
    run.receipts.push(record);
    await page.screenshot({
      path: path.join(output, name + ".review.png"),
      fullPage: true,
    });
    // Confirm only a successful image proposal with the visibly verified total.
    if (
      result.doc.status === "needs_review" &&
      record.totalMatches &&
      record.originalRetained
    ) {
      await page
        .getByRole("button", { name: "Confirm & file", exact: true })
        .click();
      await expect(
        page.getByText("Filed in Library", { exact: true }),
      ).toBeVisible();
      await page.goto("http://localhost:5173/#/library");
      await page.getByLabel("Search documents").fill(result.doc.title);
      await page
        .getByRole("link")
        .filter({ hasText: result.doc.title })
        .first()
        .click();
      await page.reload();
      await expect(
        page.getByRole("heading", { name: result.doc.title, exact: true }),
      ).toBeVisible();
      await page.getByText("Original document", { exact: true }).click();
      await expect(
        page.getByRole("img", { name: "Original captured document" }),
      ).toBeVisible();
      record.filedSearchReload = true;
    }
    await writeFile(
      path.join(output, "receipt-results.json"),
      JSON.stringify(run, null, 2),
    );
    console.log(
      JSON.stringify({
        file: name,
        status: result.doc.status,
        mode: result.doc.mode,
        totalMatches: record.totalMatches,
        originalRetained: record.originalRetained,
        filedSearchReload: !!record.filedSearchReload,
        cloudResponses: record.cloudResponses.map((r) => r.status),
      }),
    );
  }
} finally {
  await writeFile(
    path.join(output, "receipt-results.json"),
    JSON.stringify(run, null, 2),
  );
  // Detach from the user's phone without closing its tabs.
  await browser.close();
}
