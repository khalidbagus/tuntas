// Capture only a new, isolated profile with the built-in synthetic sample.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const dir = "docs/demo";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 940 },
  });
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: "Try sample receipt" }).click();
  await page
    .getByRole("heading", { name: "Fieldnote Supply receipt" })
    .waitFor();
  await page.getByRole("button", { name: "Dismiss message" }).click();
  await page.screenshot({ path: dir + "/filed-receipt.png" });
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("heading", { name: "Life, sorted." }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: dir + "/desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: dir + "/mobile.png" });
} finally {
  await browser.close();
}
