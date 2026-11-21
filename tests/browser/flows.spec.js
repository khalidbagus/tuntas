import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
function pdf(line = "") {
  const stream = line ? "BT /F1 12 Tf 50 700 Td (" + line + ") Tj ET" : "";
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    "<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n",
    offsets = [0];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += i + 1 + " 0 obj\n" + o + "\nendobj\n";
  });
  const x = out.length;
  out +=
    "xref\n0 6\n0000000000 65535 f \n" +
    offsets
      .slice(1)
      .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
      .join("") +
    "trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n" +
    x +
    "\n%%EOF";
  return Buffer.from(out);
}
async function sample(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Try sample" }).click();
  await expect(
    page.getByRole("heading", { name: "Household membership renewal notice" }),
  ).toBeVisible();
}
async function upload(page, name, mime, bytes) {
  await page.goto("/#/capture");
  await page
    .getByLabel("Select original file")
    .setInputFiles({ name, mimeType: mime, buffer: bytes });
  await page.getByRole("button", { name: "Save & organize" }).click();
}
test("happy path: sample, search, edit, action completion, source and reload", async ({
  page,
}) => {
  await sample(page);
  await expect(
    page.locator("dd").filter({ hasText: "Total: USD 48.00" }),
  ).toContainText("USD 48.00");
  await page
    .getByRole("link", { name: "Library", exact: true })
    .first()
    .click();
  await page.getByLabel("Search documents").fill("family 48.00");
  await page
    .getByRole("link", { name: /Household membership renewal notice/ })
    .click();
  await page.getByRole("button", { name: "Edit details" }).click();
  await page.getByLabel("Primary category").selectOption("Work & Study");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: "Add an action" }).click();
  await page.getByLabel("Action title").fill("Confirm family plan");
  await page.getByRole("button", { name: "Create action" }).click();
  await page
    .getByRole("link", { name: "Actions", exact: true })
    .first()
    .click();
  await page
    .getByRole("checkbox", { name: "Complete Confirm family plan" })
    .click();
  // The confirmed action moves into Completed and gets a new accessible name.
  await expect(
    page.getByRole("checkbox", { name: "Reopen Confirm family plan" }),
  ).toBeChecked();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Reopen Confirm family plan" }),
  ).toBeChecked();
  await page
    .getByRole("link", { name: "Household membership renewal notice" })
    .click();
  await expect(page.getByText("Work & Study", { exact: true })).toBeVisible();
});
test("duplicate opens original; undo returns to Inbox; separate browser profile cannot retrieve it", async ({
  page,
  browser,
}) => {
  await sample(page);
  const url = page.url();
  await sample(page);
  expect(page.url()).toBe(url);
  await expect(page.getByRole("status")).toContainText("Already captured");
  await page.getByRole("button", { name: "Undo filing" }).click();
  await page
    .getByRole("link", { name: /^Inbox/ })
    .first()
    .click();
  await expect(
    page.getByRole("link", { name: /Household membership renewal notice/ }),
  ).toBeVisible();
  const other = await browser.newContext();
  try {
    const p = await other.newPage();
    await p.goto(url);
    await expect(p.getByText("Page not found")).toBeVisible();
  } finally {
    await other.close();
  }
});
test("ambiguous pasted text → review → manual correction; no external content requests", async ({
  page,
}) => {
  const external = [];
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !r.url().startsWith("http://127.0.0.1:5174/")
    )
      external.push(r.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Paste text" }).click();
  await page.getByLabel("Document text").fill("Sample lease and invoice");
  await page.getByRole("button", { name: "Save & organize" }).click();
  await expect(page.getByText("Needs review", { exact: true })).toBeVisible();
  await page.getByLabel("Primary category").selectOption("Home & Living");
  await page.getByRole("button", { name: "Confirm & file" }).click();
  await expect(
    page.getByText("Filed in Library", { exact: true }),
  ).toBeVisible();
  expect(external).toEqual([]);
});
test("PDF text layer is extracted and searched locally", async ({ page }) => {
  await upload(
    page,
    "fixture.pdf",
    "application/pdf",
    pdf("Stationery receipt"),
  );
  await expect(
    page.getByText("Filed in Library", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Stationery receipt" }),
  ).toBeVisible();
});
test("PDF without text survives retry, offline manual filing, and original download", async ({
  page,
  context,
}) => {
  await upload(page, "blank.pdf", "application/pdf", pdf());
  await expect(
    page.getByText(/This PDF has no readable text layer/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry processing" }).click();
  await expect(
    page.getByRole("button", { name: "Retry processing" }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("button", { name: "File without AI" }).click();
  await expect(
    page.getByText("Filed in Library", { exact: true }),
  ).toBeVisible();
  await page.getByText("Original document", { exact: true }).click();
  const down = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download original" }).click();
  expect((await down).suggestedFilename()).toBe("blank.pdf");
});
test("rejects a mismatched file signature before saving", async ({ page }) => {
  await upload(page, "x.png", "image/png", Buffer.from("not an image"));
  await expect(page.getByRole("alert")).toContainText("matching file format");
});
for (const mime of ["image/png", "image/jpeg"])
  test(
    "decodes " + mime + " and preserves original without pretending to OCR",
    async ({ page }) => {
      await page.goto("/");
      const bytes = await page.evaluate((m) => {
        const c = document.createElement("canvas");
        c.width = 100;
        c.height = 50;
        const g = c.getContext("2d");
        g.fillStyle = "white";
        g.fillRect(0, 0, 100, 50);
        g.fillStyle = "black";
        g.fillText("SAMPLE", 15, 25);
        return c.toDataURL(m).split(",")[1];
      }, mime);
      await upload(
        page,
        "sample." + mime.split("/")[1],
        mime,
        Buffer.from(bytes, "base64"),
      );
      await expect(
        page.getByText(/Local rules do not read images/),
      ).toBeVisible();
      await page.getByText("Original document", { exact: true }).click();
      await expect(
        page.getByRole("img", { name: "Original captured document" }),
      ).toBeVisible();
      // Compare bytes and MIME after reload, not just whether a preview rendered.
      await page.reload();
      await page.getByText("Original document", { exact: true }).click();
      const retained = await page.getByRole("link", { name: "Download original" }).evaluate(async (link) => {
        const blob = await (await fetch(link.href)).blob();
        return { type: blob.type, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) };
      });
      expect(retained.type).toBe(mime);
      expect(Buffer.from(retained.bytes)).toEqual(Buffer.from(bytes, "base64"));
    },
  );
for (const width of [320, 390, 768, 1440])
  test("responsive home and keyboard search at " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 840 });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Upload file" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.keyboard.press("Control+k");
    await expect(page.getByLabel("Search documents")).toBeFocused();
  });
test("accessible Home, Capture, detail, Library, Inbox, Actions (axe WCAG A/AA)", async ({
  page,
}) => {
  await sample(page);
  const id = page.url();
  for (const url of [
    id,
    "/#/home",
    "/#/capture",
    "/#/library",
    "/#/inbox",
    "/#/actions",
  ]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
});
test("mobile 390px journey: scan cancel, unreadable image recovery, keyboard-open manual filing, search and reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  // 1. Cancel picker on Home Scan -> stays on Home.
  const [cancelHomeChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Scan" }).click(),
  ]);
  await cancelHomeChooser.setFiles([]);
  await expect(
    page.getByRole("heading", { name: "Life, sorted." }),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/#\/capture/);

  // 2. Pick a corrupt PNG via Scan -> lands on Capture, cancel "Choose another" preserves it.
  const corruptPng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const [corruptChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Scan" }).click(),
  ]);
  await corruptChooser.setFiles({
    name: "receipt-corrupt.png",
    mimeType: "image/png",
    buffer: corruptPng,
  });
  await expect(page).toHaveURL(/#\/capture$/);
  await expect(page.getByText("receipt-corrupt.png")).toBeVisible();

  const [cancelCaptureChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Choose another" }).click(),
  ]);
  await cancelCaptureChooser.setFiles([]);
  await expect(page.getByText("receipt-corrupt.png")).toBeVisible();

  await page.getByRole("button", { name: "Save & organize" }).click();
  await expect(
    page.getByText(/Image could not be read or exceeds 24 megapixels/),
  ).toBeVisible();
  await page.getByText("Original document", { exact: true }).click();
  await expect(
    page.getByText("Image preview is unavailable. Download the original file to inspect it."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download original" }),
  ).toBeVisible();

  // 3. Return Home via mobile bottom dock, Scan a valid synthetic receipt PNG, and file with simulated keyboard open.
  await page.locator(".bottom-nav").getByRole("link", { name: "Home" }).click();
  const validPngBase64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 240;
    c.height = 140;
    const g = c.getContext("2d");
    g.fillStyle = "white";
    g.fillRect(0, 0, 240, 140);
    g.fillStyle = "#17243b";
    g.font = "16px sans-serif";
    g.fillText("Sample notebook receipt", 16, 40);
    g.fillText("Blue notebook", 16, 70);
    g.fillText("Total: USD 12.00", 16, 100);
    return c.toDataURL("image/png").split(",")[1];
  });
  const [validChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Scan" }).click(),
  ]);
  await validChooser.setFiles({
    name: "sample-notebook-receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from(validPngBase64, "base64"),
  });
  await expect(page.getByText("sample-notebook-receipt.png")).toBeVisible();
  await page.getByRole("button", { name: "Save & organize" }).click();
  await expect(
    page.getByText(/Local rules do not read images/),
  ).toBeVisible();

  await page.getByText("Original document", { exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Original captured document" }),
  ).toBeVisible();

  // Simulate virtual keyboard open (reduced viewport height).
  await page.setViewportSize({ width: 390, height: 420 });
  const titleInput = page.getByLabel("Document title");
  await titleInput.focus();
  await titleInput.fill("Sample notebook receipt");
  await page.getByLabel("Primary category").selectOption("Purchases");

  const fileBtn = page.getByRole("button", { name: "File without AI" });
  await fileBtn.focus();
  await fileBtn.evaluate((el) => el.scrollIntoView({ block: "nearest" }));
  const btnBox = await fileBtn.boundingBox();
  const navBox = await page.locator(".bottom-nav").boundingBox();
  expect(btnBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  expect(btnBox.y + btnBox.height).toBeLessThanOrEqual(navBox.y);

  await fileBtn.click();
  await expect(
    page.getByText("Filed in Library", { exact: true }),
  ).toBeVisible();

  // 4. Restore viewport, search Library, reload, reopen, and verify original persists.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".bottom-nav").getByRole("link", { name: "Library" }).click();
  await page.getByLabel("Search documents").fill("notebook");
  await page.getByRole("link", { name: /Sample notebook receipt/ }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Sample notebook receipt" }),
  ).toBeVisible();
  await page.getByText("Original document", { exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Original captured document" }),
  ).toBeVisible();
});
test("household renewal follow-up: 390px dock focus, idempotent confirm, duplicate intake, reload, and Actions backlink", async ({
  page,
  context,
}) => {
  const renewalText =
    "Household membership renewal notice\nAccount #HM-204\nRenew your membership by 12 December 2026.";
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Paste text" }).click();
  await page.getByLabel("Document text").fill(renewalText);
  await page.getByRole("button", { name: "Save & organize" }).click();

  await expect(
    page.getByRole("heading", { name: "Household membership renewal notice" }),
  ).toBeVisible();
  await expect(page.getByText("Filed in Library", { exact: true })).toBeVisible();
  await expect(
    page.getByText("“Renew your membership by 12 December 2026.”"),
  ).toBeVisible();
  await expect(page.getByText("Original document", { exact: true })).toBeVisible();

  const docUrl = page.url();
  // Open a second tab on the same document before confirming to verify idempotency.
  const tab2 = await context.newPage();
  await tab2.goto(docUrl);
  await tab2.getByRole("button", { name: "Add follow-up" }).click();

  await page.getByRole("button", { name: "Add follow-up" }).click();
  const titleInput = page.getByLabel("Action title");
  await expect(titleInput).toBeFocused();
  await expect(titleInput).toHaveValue("Renew your membership");
  await expect(page.getByLabel(/Due date/)).toHaveValue("2026-12-12");

  const inputBox = await titleInput.boundingBox();
  const navBox = await page.locator(".bottom-nav").boundingBox();
  expect(inputBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  expect(inputBox.y).toBeGreaterThanOrEqual(0);
  expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(navBox.y);

  await titleInput.fill("Renew household membership");
  await page.getByRole("button", { name: "Create action" }).click();
  await expect(page.getByText("Saved in Actions")).toBeVisible();

  // Second confirmation of the same suggestion in tab2 creates no duplicate action.
  await tab2.getByRole("button", { name: "Create action" }).click();
  await expect(tab2.getByRole("status")).toContainText("already saved in Actions");
  await tab2.close();

  // Duplicate intake reopens the original and keeps the saved follow-up idempotent.
  await page.goto("/#/capture");
  await page.getByRole("button", { name: "Paste text" }).click();
  await page.getByLabel("Document text").fill(renewalText);
  await page.getByRole("button", { name: "Save & organize" }).click();
  await expect(page).toHaveURL(docUrl);
  await expect(page.getByRole("status")).toContainText("Already captured");
  await expect(page.getByText("Saved in Actions")).toBeVisible();

  await page.getByRole("link", { name: "Open in Actions" }).click();
  await expect(page.getByRole("heading", { name: "Actions" })).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Complete Renew household membership" }),
  ).toHaveCount(1);
  await expect(page.getByText(/Due Dec 12, 2026/)).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Complete Renew household membership" }),
  ).toHaveCount(1);
  await expect(page.getByText(/Due Dec 12, 2026/)).toBeVisible();
  await page
    .getByRole("link", { name: "Household membership renewal notice" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Household membership renewal notice" }),
  ).toBeVisible();
  await page.getByText("Original document", { exact: true }).click();
  await expect(
    page.locator(".original pre"),
  ).toContainText("Renew your membership by 12 December 2026.");
});
test("ambiguous date follow-up leaves due blank and dismiss creates zero actions", async ({
  page,
}) => {
  const ambiguousText =
    "Household membership renewal notice\nAccount #HM-205\nRenew your membership by 03/04/2026.";
  await page.goto("/");
  await page.getByRole("button", { name: "Paste text" }).click();
  await page.getByLabel("Document text").fill(ambiguousText);
  await page.getByRole("button", { name: "Save & organize" }).click();

  await expect(
    page.getByText("“Renew your membership by 03/04/2026.”"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add follow-up" }).click();
  await expect(page.getByLabel(/Due date/)).toHaveValue("");
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Suggested follow-up" }),
  ).toHaveCount(0);

  await page.reload();
  await expect(
    page.getByRole("region", { name: "Suggested follow-up" }),
  ).toHaveCount(0);

  await page.getByRole("link", { name: "Actions", exact: true }).first().click();
  await expect(page.getByText("No actions yet.")).toBeVisible();
});
