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
  await page
    .getByRole("region", { name: "Suggested follow-up" })
    .getByRole("button", { name: "Dismiss", exact: true })
    .click();
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
test("demo mode: direct entry, zero external requests, simultaneous tabs + reload idempotency, URL preservation, and Capture", async ({
  page,
  context,
}) => {
  const external = [];
  const watchRequests = (p) =>
    p.on("request", (r) => {
      if (
        /^https?:/.test(r.url()) &&
        !r.url().startsWith("http://127.0.0.1:5174/")
      ) {
        external.push(r.url());
      }
    });
  watchRequests(page);

  const tab2 = await context.newPage();
  watchRequests(tab2);
  await Promise.all([
    page.goto("/?demo=1#/home"),
    tab2.goto("/?demo=1#/home"),
  ]);

  await expect(page.getByText("Sample workspace").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Exit demo" })).toBeVisible();

  const workspace = page.getByRole("region", { name: "Workspace overview" });
  await expect(
    workspace.getByRole("link", { name: /^Inbox/ }),
  ).toHaveAccessibleName(/Inbox.*\b2$/);
  await expect(
    workspace.getByRole("link", { name: /^Library/ }),
  ).toHaveAccessibleName(/Library.*\b17$/);
  await expect(
    workspace.getByRole("link", { name: /^Actions/ }),
  ).toHaveAccessibleName(/Actions.*\b7$/);

  // Reloading after concurrent multi-tab open keeps seeded counts unchanged.
  await page.reload();
  await expect(
    workspace.getByRole("link", { name: /^Inbox/ }),
  ).toHaveAccessibleName(/Inbox.*\b2$/);
  await expect(
    workspace.getByRole("link", { name: /^Library/ }),
  ).toHaveAccessibleName(/Library.*\b17$/);
  await expect(
    workspace.getByRole("link", { name: /^Actions/ }),
  ).toHaveAccessibleName(/Actions.*\b7$/);

  // Tab 2 sees the same filed documents in Library with zero duplicates.
  await tab2.getByRole("link", { name: "Library", exact: true }).first().click();
  await expect(tab2).toHaveURL(/\?demo=1#\/library$/);
  await expect(tab2.getByText("17 documents")).toBeVisible();
  await tab2.close();

  // Demo mode stays active across Inbox, Library, Document Detail, Actions, and Capture.
  await page.getByRole("link", { name: /^Inbox/ }).first().click();
  await expect(page).toHaveURL(/\?demo=1#\/inbox$/);
  await page.getByRole("link", { name: "Library", exact: true }).first().click();
  await expect(page).toHaveURL(/\?demo=1#\/library$/);
  await expect(page.getByText("17 documents")).toBeVisible();

  // Verify all four redacted receipt photos are labeled, searchable by total, and open cleanly.
  for (const [title, total] of [
    ["Restaurant dinner receipt", "184.000"],
    ["Ice cream counter receipt", "14.000"],
    ["Rice bowl takeaway bill", "182.600"],
    ["Delivery meal receipt", "51.542"],
  ]) {
    await page.getByLabel("Search documents").fill(total);
    await expect(page.getByText("1 document", { exact: true })).toBeVisible();
    const row = page.getByRole("link", { name: new RegExp(title) });
    await expect(row).toContainText("Redacted receipt sample");
    await row.click();
    await expect(page.getByText("Redacted receipt sample · Document")).toBeVisible();
    await page.getByText("Original document", { exact: true }).click();
    const img = page.getByRole("img", { name: "Original captured document" });
    await expect(img).toBeVisible();
    await expect
      .poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0))
      .toBeTruthy();
    await page.getByRole("link", { name: "Library", exact: true }).first().click();
  }
  await page.getByLabel("Search documents").fill("");
  await expect(page.getByText("17 documents")).toBeVisible();

  await page
    .getByRole("link", { name: /Household membership renewal notice/ })
    .click();
  await expect(page).toHaveURL(/\?demo=1#\/document\/demo-doc-renewal$/);
  await expect(page.getByText("Synthetic sample · Document")).toBeVisible();

  await page.getByRole("link", { name: "Actions", exact: true }).first().click();
  await expect(page).toHaveURL(/\?demo=1#\/actions$/);
  await expect(page.getByRole("checkbox")).toHaveCount(9);

  await page.getByRole("link", { name: "Capture", exact: true }).first().click();
  await expect(page).toHaveURL(/\?demo=1#\/capture$/);
  await expect(
    page.getByRole("button", { name: "Save & organize" }),
  ).toBeVisible();

  expect(external).toEqual([]);
});
test("demo mode: phone 390px discoverability, 320px reflow, Inbox review, Library search, Actions backlink + original, and axe WCAG A/AA", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/?demo=1#/home");
  await expect(page.getByRole("link", { name: "Exit demo" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?demo=1#/home");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();

  // Inbox, Library, and Actions workspace cards are immediately visible above the fold at phone width.
  const workspace = page.getByRole("region", { name: "Workspace overview" });
  const navBox = await page.locator(".bottom-nav").boundingBox();
  expect(navBox).not.toBeNull();
  for (const label of [/^Inbox/, /^Library/, /^Actions/]) {
    const card = workspace.getByRole("link", { name: label });
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    expect(box.y + box.height).toBeLessThanOrEqual(navBox.y);
  }

  // Run WCAG A/AA accessibility checks on seeded demo views before mutations.
  for (const url of [
    "/?demo=1#/home",
    "/?demo=1#/inbox",
    "/?demo=1#/library",
    "/?demo=1#/actions",
    "/?demo=1#/capture",
    "/?demo=1#/document/demo-doc-renewal",
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

  // Review Inbox utility notice with two plausible dates and confirm filing.
  await page.locator(".bottom-nav").getByRole("link", { name: /^Inbox/ }).click();
  await page
    .getByRole("link", { name: /Northgrid Water & Power billing notice/ })
    .click();
  await expect(page.getByText(/Two plausible dates appear/)).toBeVisible();
  await page.getByText("Original document", { exact: true }).click();
  await expect(page.locator(".original pre")).toContainText("18 December 2026");
  await expect(page.locator(".original pre")).toContainText("28 December 2026");
  await page.getByRole("button", { name: "Confirm & file" }).click();
  await expect(page.getByText("Filed in Library", { exact: true })).toBeVisible();

  await page.locator(".bottom-nav").getByRole("link", { name: /^Inbox/ }).click();
  await page.getByRole("link", { name: /Courtyard room booking note/ }).click();
  await page.getByLabel("Primary category").selectOption("Home & Living");
  await page.getByRole("button", { name: "Confirm & file" }).click();
  await expect(page.getByText("Filed in Library", { exact: true })).toBeVisible();
  await page.locator(".bottom-nav").getByRole("link", { name: /^Inbox/ }).click();
  await expect(page.getByText("You’re all caught up.")).toBeVisible();

  // Search Library by merchant and amount, then inspect original.
  await page.locator(".bottom-nav").getByRole("link", { name: "Library" }).click();
  await page.getByLabel("Search documents").fill("Fieldnote");
  await expect(
    page.getByRole("link", { name: /Fieldnote Supply notebook receipt/ }),
  ).toBeVisible();
  await page.getByLabel("Search documents").fill("24.00");
  await page
    .getByRole("link", { name: /Fieldnote Supply notebook receipt/ })
    .click();
  await page.getByText("Original document", { exact: true }).click();
  await expect(page.locator(".original pre")).toContainText("USD 24.00");

  // Inspect Actions (open + completed) and open original from Actions.
  await page.locator(".bottom-nav").getByRole("link", { name: "Actions" }).click();
  await expect(
    page.getByRole("checkbox", { name: "Complete Submit renewal" }),
  ).toBeVisible();
  await expect(page.getByText(/Due Dec 12, 2026/)).toBeVisible();
  await expect(
    page.getByRole("checkbox", {
      name: "Complete Submit signed course outline and ID verification",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", {
      name: "Reopen Confirm hallway access window with building desk",
    }),
  ).toBeChecked();

  await page
    .getByRole("link", { name: "Household membership renewal notice" })
    .first()
    .click();
  await page.getByText("Original document", { exact: true }).click();
  await expect(page.locator(".original pre")).toContainText(
    "Renew your membership by 12 December 2026.",
  );
});
test("Explore demo from empty Home and keep existing personal workspace isolated", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Your first document goes here.")).toBeVisible();
  await page.getByRole("link", { name: "Explore demo" }).click();
  await expect(page).toHaveURL(/\?demo=1#\/home$/);
  await expect(page.getByText("Sample workspace").first()).toBeVisible();

  await page.getByRole("link", { name: "Exit demo" }).first().click();
  await expect(page).toHaveURL(/\/#\/home$/);
  await expect(page.getByText("Your first document goes here.")).toBeVisible();

  // Save a personal document in normal mode.
  await page.getByRole("button", { name: "Paste text" }).click();
  await page
    .getByLabel("Document text")
    .fill("Personal garage lease\nMonthly parking lease");
  await page.getByRole("button", { name: "Save & organize" }).click();
  await expect(page.getByText("Filed in Library", { exact: true })).toBeVisible();

  // Enter demo mode, modify a demo record, then exit back to personal workspace.
  await page.goto("/?demo=1#/inbox");
  await page
    .getByRole("link", { name: /Northgrid Water & Power billing notice/ })
    .click();
  await page.getByRole("button", { name: "Confirm & file" }).click();
  await expect(page.getByText("Filed in Library", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Exit demo" }).first().click();
  await expect(page).toHaveURL(/\/#\/home$/);
  await page.getByRole("link", { name: "Library", exact: true }).first().click();
  await expect(page.getByText("1 document", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Personal garage lease/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Fieldnote Supply notebook receipt/ }),
  ).toHaveCount(0);

  await page.reload();
  await expect(page.getByText("1 document", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Personal garage lease/ }),
  ).toBeVisible();
});
test("demo mode: already-seeded demo receives new examples without losing edits", async ({
  page,
}) => {
  // Simulate an existing visitor who already has demo-seed-v1 and an edited title, before demo-redacted-receipts-v1 existed.
  await page.goto("/");
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open("tuntas-demo-workspace-v1", 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          const docs = db.createObjectStore("documents", { keyPath: "id" });
          docs.createIndex("digest", "digest", { unique: true });
          db.createObjectStore("originals");
          db.createObjectStore("actions", { keyPath: "id" });
          db.createObjectStore("meta", { keyPath: "key" });
        };
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(["documents", "meta"], "readwrite");
          tx.objectStore("meta").put({
            key: "demo-seed-v1",
            seededAt: 1,
            version: 1,
          });
          tx.objectStore("documents").put({
            id: "demo-doc-renewal",
            digest: "custom-edited-digest",
            created: 1000,
            status: "organized",
            title: "Custom edited renewal",
            name: "custom.txt",
            mime: "text/plain",
            size: 21,
            source: "Demo sample",
            sample: true,
            category: "Home & Living",
            tags: ["edited"],
            facts: [],
            text: "Custom edited renewal",
            mode: "Manual edit",
            reason: "",
            reviewed: true,
            autoFiled: false,
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );

  await page.goto("/?demo=1#/library");
  await expect(page.getByText("14 documents")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Custom edited renewal/ }),
  ).toBeVisible();
  for (const title of [
    "Cedarbridge workshop invoice",
    "Birchline policy confirmation",
    "Undangan pengarahan relawan",
    "Restaurant dinner receipt",
    "Ice cream counter receipt",
    "Rice bowl takeaway bill",
    "Delivery meal receipt",
    "KFC Kota Kasablanka order receipt",
    "ASICS Kota Kasablanka shoe receipt",
    "Kopi Janji Jiwa takeaway coffee receipt",
    "Warung Taburai handwritten dinner bill",
    "Haus! Tebet milk tea receipt",
  ]) {
    await expect(
      page.getByRole("link", { name: new RegExp(title) }),
    ).toBeVisible();
  }

  await page.goto("/?demo=1#/actions");
  const group = page.getByRole("region", { name: "Training reimbursement" });
  await expect(group.getByText("1 of 4 steps completed")).toBeVisible();
  await group.getByRole("checkbox", { name: "Complete Check workshop invoice" }).click();
  await expect(group.getByText("2 of 4 steps completed")).toBeVisible();
  await page.reload();
  await expect(group.getByText("2 of 4 steps completed")).toBeVisible();

  await page.goto("/?demo=1#/library");
  await expect(page.getByText("14 documents")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Custom edited renewal/ }),
  ).toBeVisible();
});
test("language picker: EN -> Bahasa Indonesia -> EN on same receipt, persistence, keyboard operation, 320px/390px, and axe WCAG A/AA", async ({
  page,
}) => {
  await page.goto("/?demo=1#/document/demo-doc-redacted-receipt-1");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const picker = page.getByLabel("Language");
  await expect(picker).toHaveValue("en");
  await expect(
    page.getByRole("heading", { name: "Restaurant dinner receipt" }),
  ).toBeVisible();

  // Switch English -> Bahasa Indonesia on the same receipt.
  await picker.selectOption("id");
  await expect(page).toHaveURL(/\?demo=1#\/document\/demo-doc-redacted-receipt-1$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await expect(
    page.getByRole("heading", { name: "Filing details" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Detail pengarsipan" }),
  ).toBeVisible();
  await expect(
    page.locator("dd").getByText("Belanja", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Sumber: Grand Total : 184.000")).toBeVisible();

  // Receipt image & original text stay in their original language/bytes.
  await page.getByText("Dokumen asli", { exact: true }).click();
  const img = page.getByRole("img", { name: "Dokumen asli yang ditangkap" });
  await expect(img).toBeVisible();
  await expect
    .poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0))
    .toBeTruthy();

  // Persist Bahasa Indonesia across reload and inspect formatted Indonesian calendar date in Actions & Capture.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await expect(page.getByLabel("Bahasa")).toHaveValue("id");

  await page.getByRole("link", { name: "Tindakan", exact: true }).first().click();
  await expect(page).toHaveURL(/\?demo=1#\/actions$/);
  const expectedIdDate = await page.evaluate(() =>
    new Intl.DateTimeFormat("id-ID", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2026, 11, 12))),
  );
  await expect(page.getByText(`Tenggat ${expectedIdDate}`)).toBeVisible();

  // Check WCAG A/AA in Bahasa Indonesia across key demo views.
  for (const url of [
    "/?demo=1#/home",
    "/?demo=1#/library",
    "/?demo=1#/actions",
    "/?demo=1#/capture",
    "/?demo=1#/document/demo-doc-redacted-receipt-1",
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

  // Verify no clipping or horizontal overflow at 320px and 390px in Bahasa Indonesia and English.
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const url of [
      "/?demo=1#/home",
      "/?demo=1#/document/demo-doc-redacted-receipt-1",
    ]) {
      await page.goto(url);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      const pickerBox = await page.locator(".lang-picker").boundingBox();
      expect(pickerBox).not.toBeNull();
      expect(pickerBox.x + pickerBox.width).toBeLessThanOrEqual(width);
    }
  }

  // Switch back Bahasa Indonesia -> English via keyboard on the same receipt.
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.goto("/?demo=1#/document/demo-doc-redacted-receipt-1");
  const langSelect = page.locator(".lang-picker select");
  await expect(langSelect).toHaveAttribute("aria-label", "Bahasa");
  await langSelect.focus();
  await expect(langSelect).toBeFocused();
  await langSelect.press("ArrowUp");
  if ((await langSelect.inputValue()) !== "en") {
    await langSelect.selectOption("en");
  }
  await expect(langSelect).toHaveAttribute("aria-label", "Language");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { name: "Filing details" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\?demo=1#\/document\/demo-doc-redacted-receipt-1$/);
});

test("Enhancement A: illustrated Library category tiles, combined search, artwork fallback, and 360px mobile layout", async ({
  page,
}) => {
  await page.goto("/?demo=1#/library");
  const picker = page.getByRole("group", { name: "Browse by category" });
  const tiles = picker.getByRole("button");
  await expect(tiles).toHaveCount(7);
  await expect(picker.getByRole("button", { name: /All Documents/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(picker.getByRole("button", { name: /Purchases/ })).toContainText("10");
  await expect(picker.getByRole("button", { name: /Home & Living/ })).toContainText("2");
  for (const category of ["Money & Bills", "Personal Records", "Other"]) {
    await expect(picker.getByRole("button", { name: new RegExp(category) })).toContainText("1");
  }

  // Confirm artwork images loaded with real dimensions.
  const loadedCount = await picker.locator("img").evaluateAll((imgs) =>
    imgs.filter((img) => img.complete && img.naturalWidth > 0).length,
  );
  expect(loadedCount).toBe(7);

  // Combine category filter and search query, then reset category while keeping query.
  await picker.getByRole("button", { name: /Purchases/ }).click();
  await expect(page.getByText("10 documents")).toBeVisible();
  await page.getByLabel("Search documents").fill("184.000");
  await expect(page.getByText("1 document", { exact: true })).toBeVisible();
  await picker.getByRole("button", { name: /Home & Living/ }).click();
  await expect(page.getByText("No matching documents")).toBeVisible();
  await picker.getByRole("button", { name: /All Documents/ }).click();
  await expect(page.getByLabel("Search documents")).toHaveValue("184.000");
  await expect(page.getByText("1 document", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.getByText("17 documents")).toBeVisible();

  await picker.getByRole("button", { name: /Home & Living/ }).click();
  await page.getByLabel("Search documents").fill("184.000");
  await expect(page.getByText("No matching documents")).toBeVisible();
  await page.getByRole("button", { name: "Clear search and filters" }).click();
  await expect(page.getByText("17 documents")).toBeVisible();
  await expect(picker.getByRole("button", { name: /All Documents/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Artwork fallback and narrow 360px Samsung Chrome viewport check.
  await page.route("**/categories/category-purchases.png", (route) => route.abort());
  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload();
  await expect(picker.getByRole("button", { name: /Purchases/ })).toBeVisible();
  await expect(picker.locator(".category-art-fallback")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("Enhancements B & I: urgency states, completed vs overdue, missing-date review, add/edit/remove due date", async ({
  page,
}) => {
  await sample(page);
  await page.getByRole("button", { name: "Add an action" }).click();
  await page.getByLabel("Action title").fill("Overdue follow-up");
  const { yesterdayIso, todayIso, soonIso } = await page.evaluate(() => {
    const fmt = (offset) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return [
        String(d.getFullYear()).padStart(4, "0"),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0"),
      ].join("-");
    };
    return { yesterdayIso: fmt(-1), todayIso: fmt(0), soonIso: fmt(3) };
  });
  await page.getByLabel(/Due date/).fill(yesterdayIso);
  await page.getByRole("button", { name: "Create action" }).click();
  await expect(page.getByLabel("Action title")).toHaveCount(0);

  await page.getByRole("button", { name: "Add an action" }).click();
  await page.getByLabel("Action title").fill("Undated follow-up");
  await page.getByRole("button", { name: "Create action" }).click();

  await page.getByRole("link", { name: "Actions", exact: true }).first().click();
  const overdueCard = page.locator(".action-card", { hasText: "Overdue follow-up" });
  await expect(overdueCard.locator(".urgency-badge")).toHaveText("Overdue");

  // Completing an overdue action replaces Overdue with Completed.
  await page.getByRole("checkbox", { name: "Complete Overdue follow-up" }).click();
  await expect(overdueCard.locator(".urgency-badge")).toHaveText("Completed");

  // Filter by No Due Date, add a due date, edit it, and remove it.
  await page.getByRole("button", { name: /No Due Date/ }).click();
  await expect(page.locator(".action-card")).toHaveCount(1);
  const undatedCard = page.locator(".action-card", { hasText: "Undated follow-up" });
  await expect(undatedCard.locator(".urgency-badge")).toHaveText("No Due Date");

  await undatedCard.getByRole("button", { name: "Details" }).click();
  await expect(undatedCard.getByText(/No source excerpt was recorded/)).toBeVisible();
  await undatedCard.getByLabel("Due date").fill(todayIso);
  await undatedCard.getByRole("button", { name: "Save date" }).click();
  await page.getByRole("button", { name: /^All/ }).click();
  await expect(undatedCard.locator(".urgency-badge")).toHaveText("Due Today");

  await page.reload();
  const reloadedCard = page.locator(".action-card", { hasText: "Undated follow-up" });
  await expect(reloadedCard.locator(".urgency-badge")).toHaveText("Due Today");

  await reloadedCard.getByRole("button", { name: "Details" }).click();
  await reloadedCard.getByLabel("Due date").fill(soonIso);
  await reloadedCard.getByRole("button", { name: "Save date" }).click();
  await expect(reloadedCard.locator(".urgency-badge")).toHaveText("Due Soon");
  await reloadedCard.getByRole("button", { name: "Remove date" }).click();
  await expect(reloadedCard.locator(".urgency-badge")).toHaveText("No Due Date");
});

test("Enhancements C, D, E, G, H: connected demo workflow, progress, cycle prevention, graph, and override", async ({
  page,
}) => {
  await page.goto("/?demo=1#/actions/demo-action-renewal-address");

  const renewalGroup = page.getByRole("region", {
    name: "Household membership renewal",
  });
  await expect(renewalGroup.getByText("0 of 3 steps completed")).toBeVisible();
  await expect(
    renewalGroup.getByRole("progressbar", {
      name: /0 of 3 steps completed/,
    }),
  ).toBeVisible();

  // Evidence at a Glance on Prepare address proof.
  const step1 = renewalGroup.locator(".action-card", {
    hasText: "Prepare address proof",
  });
  await expect(step1.getByText("“Account: Northgrid Residential 418”")).toBeVisible();
  await expect(step1.getByRole("link", { name: "Open original document" })).toHaveAttribute(
    "href",
    "#/document/demo-doc-utility",
  );

  // Cycle check: trying to make step1 depend on step3 (Verify confirmation) fails cleanly.
  await step1.getByLabel("Add prerequisite").selectOption("demo-action-renewal-verify");
  await step1.getByRole("button", { name: "Connect step" }).click();
  await expect(step1.getByRole("alert")).toContainText("circular dependency");

  // Waiting action shows advisory override when clicked; completing step1 makes step2 Ready.
  const step2 = renewalGroup.locator("#action-card-demo-action-renewal");
  await expect(step2).toContainText("Waiting on 1 step");
  await page.getByRole("checkbox", { name: "Complete Submit renewal" }).click();
  await expect(step2.getByText("This step is waiting on unfinished prerequisites:")).toBeVisible();
  await step2.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("checkbox", { name: "Complete Prepare address proof" }).click();
  await expect(renewalGroup.getByText("1 of 3 steps completed")).toBeVisible();
  await expect(step2).toContainText("Ready");

  // Reopening step1 moves unfinished step2 back to Waiting; completed steps are never reversed.
  await page.getByRole("checkbox", { name: "Reopen Prepare address proof" }).click();
  await expect(step2).toContainText("Waiting on 1 step");
  await expect(renewalGroup.getByText("0 of 3 steps completed")).toBeVisible();

  await page.getByRole("checkbox", { name: "Complete Prepare address proof" }).click();
  await expect(step2).toContainText("Ready");
  await page.getByRole("checkbox", { name: "Complete Submit renewal" }).click();
  await expect(renewalGroup.getByText("2 of 3 steps completed")).toBeVisible();
  await page.getByRole("checkbox", { name: "Reopen Prepare address proof" }).click();
  await expect(
    page.getByRole("checkbox", { name: "Reopen Submit renewal" }),
  ).toBeChecked();

  // Interactive dependency graph: open, select node, zoom, check text list, close.
  await renewalGroup.getByRole("button", { name: "View connections" }).click();
  const graph = renewalGroup.getByRole("region", {
    name: /Connections · Household membership renewal/,
  });
  await expect(graph).toBeVisible();
  await graph.getByRole("button", { name: /Verify confirmation/ }).first().click();
  await expect(graph.locator(".graph-inspector")).toContainText("Verify confirmation");
  await graph.getByRole("button", { name: "Zoom in" }).click();
  await expect(graph.locator(".graph-zoom-value")).toHaveText("125%");
  await graph.getByRole("button", { name: "Reset zoom" }).click();
  await expect(graph.locator(".graph-zoom-value")).toHaveText("100%");
  await expect(graph.locator(".graph-text-list")).toContainText("Prepare address proof");
  await graph.getByRole("button", { name: "Hide connections" }).click();
  await expect(graph).toHaveCount(0);

  await page.reload();
  await expect(renewalGroup.getByText("1 of 3 steps completed")).toBeVisible();
});

test("expanded demo: focus advances through two prerequisites and examples have usable originals", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(2026, 10, 22, 12));
  await page.goto("/?demo=1#/home");
  const focus = page.getByRole("region", { name: "Today’s Focus" });
  await expect(focus).toContainText("Check workshop invoice");
  await expect(focus).toContainText("Overdue");
  await focus.getByRole("link", { name: "Open action" }).click();
  await expect(page).toHaveURL(/\?demo=1#\/actions\/demo-action-training-invoice$/);

  const group = page.getByRole("region", { name: "Training reimbursement" });
  const claim = group.locator("#action-card-demo-action-training-submit");
  await expect(group.getByText("1 of 4 steps completed")).toBeVisible();
  await expect(group.getByText("“Check the invoice total and reference before submitting your claim.”")).toBeVisible();
  await expect(claim.locator(".urgency-badge")).toHaveText("Due Today");
  await expect(claim).toContainText("Waiting on 1 step");
  await group.getByRole("button", { name: "View connections" }).click();
  const graph = group.getByRole("region", { name: "Connections · Training reimbursement" });
  const relationships = graph.locator(".graph-text-list li");
  await expect(relationships).toHaveCount(3);
  for (const prerequisite of ["Save training approval", "Check workshop invoice"]) {
    await expect(relationships.filter({ hasText: prerequisite })).toContainText(
      "Submit reimbursement claim",
    );
  }
  await graph.getByRole("button", { name: "Hide connections" }).click();
  await group.getByRole("checkbox", { name: "Complete Check workshop invoice" }).click();
  await expect(claim.locator(".readiness-chip")).toHaveText("Ready");
  await page.goto("/?demo=1#/home");
  await expect(focus).toContainText("Submit reimbursement claim");

  await page.goto("/?demo=1#/library");
  const picker = page.getByRole("group", { name: "Browse by category" });
  await picker.getByRole("button", { name: /Personal Records/ }).click();
  await page.getByLabel("Search documents").fill("BL-2048");
  await page.getByRole("link", { name: /Birchline policy confirmation/ }).click();
  await page.getByText("Original document", { exact: true }).click();
  await expect(page.locator(".original pre")).toContainText("Policy reference: BL-2048");
  const download = page.getByRole("link", { name: "Download original" });
  await expect(download).toHaveAttribute("download", "birchline-policy-letter.pdf");
  await expect(download).toHaveAttribute("href", /^blob:/);

  await page.goto("/?demo=1#/document/demo-doc-volunteer-briefing");
  await page.getByRole("button", { name: "Add follow-up" }).click();
  await expect(page.getByLabel(/Due date/)).toHaveValue("");
  await page.getByRole("button", { name: "Create action" }).click();
  await page.goto("/?demo=1#/actions");
  await page.getByRole("button", { name: /No Due Date/ }).click();
  await expect(
    page.getByRole("checkbox", { name: "Complete Konfirmasi kehadiran relawan" }),
  ).toBeVisible();
});

test("v1 IndexedDB upgrade preserves records, personal/demo isolation holds for groups, and offline edits + Bahasa Indonesia pass WCAG AA", async ({
  page,
  context,
}) => {
  // Open demo mode first so tuntas-workspace-v1 has not been opened at v2 yet.
  await page.goto("/?demo=1#/home");
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open("tuntas-workspace-v1", 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          const docs = db.createObjectStore("documents", { keyPath: "id" });
          docs.createIndex("digest", "digest", { unique: true });
          db.createObjectStore("originals");
          db.createObjectStore("actions", { keyPath: "id" });
        };
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(["documents", "originals", "actions"], "readwrite");
          tx.objectStore("documents").put({
            id: "legacy-doc-1",
            digest: "legacy-digest-1",
            created: 1000,
            status: "organized",
            title: "Legacy water bill",
            name: "legacy.txt",
            mime: "text/plain",
            size: 16,
            source: "text",
            sample: false,
            category: "Money & Bills",
            tags: [],
            facts: [],
            text: "Legacy water bill",
            mode: "Local rules",
            reason: "",
            reviewed: true,
            autoFiled: true,
          });
          tx.objectStore("originals").put(
            { bytes: new TextEncoder().encode("Legacy water bill").buffer, type: "text/plain" },
            "legacy-doc-1",
          );
          tx.objectStore("actions").put({
            id: "legacy-action-1",
            documentId: "legacy-doc-1",
            title: "Pay legacy bill",
            due: "",
            done: false,
            created: 2000,
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );

  // Visit personal workspace so IndexedDB v1 -> v2 upgrade runs non-destructively.
  await page.goto("/#/home");
  await expect(page.getByRole("link", { name: /Legacy water bill/ }).first()).toBeVisible();
  await page.getByRole("button", { name: "Try sample" }).click();
  await page.getByRole("button", { name: "Add follow-up" }).click();
  await page.getByRole("button", { name: "Create action" }).click();

  await page.getByRole("link", { name: "Actions", exact: true }).first().click();
  await expect(page.getByText("Pay legacy bill")).toBeVisible();

  await context.setOffline(true);
  await page.getByRole("button", { name: "New group" }).click();
  await page.getByLabel("Group name").fill("Personal offline checklist");
  await page.getByRole("button", { name: "Create group" }).click();
  const personalGroup = page.getByRole("region", { name: "Personal offline checklist" });
  await expect(personalGroup).toBeVisible();

  // Assign both personal actions (from two different documents) into the group and link them.
  for (const title of ["Pay legacy bill", "Renew your membership"]) {
    const card = page.locator(".action-card", { hasText: title });
    await card.getByRole("button", { name: "Details" }).click();
    await card.getByLabel(/group/i).selectOption({ label: "Personal offline checklist" });
  }
  const secondCard = personalGroup.locator(".action-card", {
    has: page.getByRole("checkbox", { name: /Renew your membership/ }),
  });
  await secondCard.getByLabel("Add prerequisite").selectOption("legacy-action-1");
  await secondCard.getByRole("button", { name: "Connect step" }).click();
  await expect(secondCard).toContainText("Waiting on 1 step");

  // Explicit override completes waiting step cleanly.
  await page.getByRole("checkbox", { name: "Complete Renew your membership" }).click();
  await secondCard.getByRole("button", { name: "Complete anyway" }).click();
  await expect(
    page.getByRole("checkbox", { name: "Reopen Renew your membership" }),
  ).toBeChecked();

  await context.setOffline(false);

  // Personal groups must never appear in demo workspace.
  await page.goto("/?demo=1#/actions");
  await expect(page.getByText("Personal offline checklist")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Household membership renewal" })).toBeVisible();

  // Check Bahasa Indonesia and axe WCAG A/AA across updated demo screens including Graph.
  await page.getByLabel("Language").selectOption("id");
  await expect(page.getByRole("button", { name: "Grup baru" })).toBeVisible();
  for (const url of ["/?demo=1#/home", "/?demo=1#/library", "/?demo=1#/actions"]) {
    if (!page.url().endsWith(url.replace("/?", "?"))) {
      await page.goto(url);
    }
    if (url.endsWith("#/actions")) {
      await page
        .getByRole("region", { name: "Training reimbursement" })
        .getByRole("button", { name: "Lihat keterkaitan" })
        .click();
    }
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

test("Home keeps Explore demo across empty/populated states and places Document capture above Recent documents", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Explore demo" })).toHaveCount(1);
  const emptyCaptureBox = await page
    .getByRole("region", { name: "Document capture" })
    .boundingBox();
  const emptyRecentBox = await page
    .locator("section.section", { hasText: "Recent documents" })
    .boundingBox();
  expect(emptyCaptureBox).not.toBeNull();
  expect(emptyRecentBox).not.toBeNull();
  expect(emptyCaptureBox.y + emptyCaptureBox.height).toBeLessThanOrEqual(
    emptyRecentBox.y + 1,
  );

  // Populate personal workspace with a document and follow-up so Today's Focus appears.
  await sample(page);
  await page.getByRole("button", { name: "Add follow-up" }).click();
  await page.getByRole("button", { name: "Create action" }).click();

  for (const vp of [
    { width: 1280, height: 850 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(vp);
    await page.goto("/#/home");
    await expect(page.getByRole("link", { name: "Explore demo" })).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Explore demo" })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();

    const focusSection = page.getByRole("region", { name: "Today’s Focus" });
    const captureSection = page.getByRole("region", { name: "Document capture" });
    const recentSection = page.locator("section.section", {
      hasText: "Recent documents",
    });

    await expect(captureSection.getByRole("button", { name: "Upload file" })).toBeVisible();
    await expect(captureSection.getByRole("button", { name: "Try sample" })).toBeVisible();

    const focusBox = await focusSection.boundingBox();
    const captureBox = await captureSection.boundingBox();
    const recentBox = await recentSection.boundingBox();
    expect(focusBox.y + focusBox.height).toBeLessThanOrEqual(captureBox.y + 1);
    expect(captureBox.y + captureBox.height).toBeLessThanOrEqual(recentBox.y + 1);

    // Confirm DOM/reading order matches Today's Focus -> Document capture -> Recent documents.
    const order = await page.evaluate(() => {
      const f = document.querySelector('section[aria-label="Today’s Focus"]');
      const c = document.querySelector('section[aria-label="Document capture"]');
      const r = [...document.querySelectorAll("section.section")].find((s) =>
        s.textContent.includes("Recent documents"),
      );
      return {
        fBeforeC: Boolean(f.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING),
        cBeforeR: Boolean(c.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING),
      };
    });
    expect(order).toEqual({ fBeforeC: true, cBeforeR: true });
  }

  await page.setViewportSize({ width: 1280, height: 850 });
  await page.getByRole("link", { name: "Explore demo" }).click();
  await expect(page).toHaveURL(/\?demo=1#\/home$/);
  await expect(page.getByRole("link", { name: "Explore demo" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Exit demo" })).toBeVisible();
  await page.getByRole("link", { name: "Exit demo" }).first().click();
  await expect(page).toHaveURL(/\/#\/home$/);
  await expect(page.getByRole("link", { name: "Explore demo" })).toHaveCount(1);
});

test("Delete filed document: cancel default focus, cascade actions/links, reload persistence, failure recovery, demo isolation, and Bahasa Indonesia WCAG AA", async ({
  page,
}) => {
  // Capture & file Doc 1 (with 2 actions) and Doc 2 (with 1 dependent action).
  await page.goto("/#/capture");
  await page.getByRole("button", { name: "Paste text" }).click();
  await page
    .getByLabel("Document text")
    .fill("Monthly water invoice\nAccount W-101\nTotal: USD 30.00");
  await page.getByRole("button", { name: "Save & organize" }).click();
  await expect(page.getByRole("heading", { name: "Monthly water invoice" })).toBeVisible();
  const doc1Url = page.url();

  for (const title of ["Check meter reading", "Pay water invoice"]) {
    await page.getByRole("button", { name: "Add an action" }).click();
    await page.getByLabel("Action title").fill(title);
    await page.getByRole("button", { name: "Create action" }).click();
    await expect(page.getByLabel("Action title")).toHaveCount(0);
  }

  await sample(page);
  await page.getByRole("button", { name: "Add follow-up" }).click();
  await page.getByRole("button", { name: "Create action" }).click();
  await expect(page.getByLabel("Action title")).toHaveCount(0);

  // Put all 3 actions into one group and link Doc 1 action -> Doc 2 action.
  await page.getByRole("link", { name: "Actions", exact: true }).first().click();
  await page.getByRole("button", { name: "New group" }).click();
  await page.getByLabel("Group name").fill("Monthly errands");
  await page.getByRole("button", { name: "Create group" }).click();
  const group = page.getByRole("region", { name: "Monthly errands" });
  await expect(group).toBeVisible();

  for (const title of ["Check meter reading", "Pay water invoice", "Renew your membership"]) {
    const card = page.locator(".action-card", {
      has: page.getByRole("checkbox", { name: new RegExp(title) }),
    });
    await card.getByRole("button", { name: "Details" }).click();
    await card.getByLabel(/group/i).selectOption({ label: "Monthly errands" });
  }
  const renewCard = group.locator(".action-card", {
    has: page.getByRole("checkbox", { name: /Renew your membership/ }),
  });
  const payOption = await renewCard
    .getByLabel("Add prerequisite")
    .locator("option", { hasText: "Pay water invoice" })
    .getAttribute("value");
  await renewCard.getByLabel("Add prerequisite").selectOption(payOption);
  await renewCard.getByRole("button", { name: "Connect step" }).click();
  await expect(renewCard).toContainText("Waiting on 1 step");
  await expect(group.getByText("0 of 3 steps completed")).toBeVisible();

  // Open Doc 1, test Delete document confirmation default focus & Cancel.
  await page.goto(doc1Url);
  await page.getByRole("button", { name: "Delete document" }).click();
  const confirm = page.getByRole("region", {
    name: /Delete “Monthly water invoice”\?/,
  });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText("2 linked follow-ups");
  const cancelBtn = confirm.getByRole("button", { name: "Cancel" });
  await expect(cancelBtn).toBeFocused();
  await cancelBtn.click();
  await expect(confirm).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Monthly water invoice" })).toBeVisible();

  // Confirm deletion and verify redirect, cascade cleanup, Today's Focus update, and reload persistence.
  await page.getByRole("button", { name: "Delete document" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL(/#\/library$/);
  await expect(page.getByRole("status")).toContainText("Document deleted.");
  await expect(page.getByText("1 document", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Monthly water invoice/ })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Household membership renewal notice/ }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Actions", exact: true }).first().click();
  await expect(page.getByText("Check meter reading")).toHaveCount(0);
  await expect(page.getByText("Pay water invoice")).toHaveCount(0);
  await expect(group.getByText("0 of 1 steps completed")).toBeVisible();
  await expect(renewCard).not.toContainText("Waiting");

  await page.getByRole("link", { name: "Home", exact: true }).first().click();
  await expect(page.getByRole("region", { name: "Today’s Focus" })).toContainText(
    "Renew your membership",
  );

  await page.reload();
  await expect(page.getByRole("region", { name: "Today’s Focus" })).toContainText(
    "Renew your membership",
  );

  // Failure path: capture a 3rd doc, remove it underneath in IndexedDB, then confirm error keeps detail page open.
  await page.goto("/#/capture");
  await page.getByRole("button", { name: "Paste text" }).click();
  await page.getByLabel("Document text").fill("Temp receipt\nTotal: USD 5.00");
  await page.getByRole("button", { name: "Save & organize" }).click();
  await expect(page.getByRole("heading", { name: "Temp receipt" })).toBeVisible();
  const tempUrl = page.url();
  const tempId = tempUrl.split("/").pop();
  await page.evaluate(
    (docId) =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open("tuntas-workspace-v1");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(["documents", "originals"], "readwrite");
          tx.objectStore("documents").delete(docId);
          tx.objectStore("originals").delete(docId);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    tempId,
  );
  await page.getByRole("button", { name: "Delete document" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL(tempUrl);
  await expect(page.getByRole("alert")).toContainText("could not be deleted");

  // Demo isolation & Bahasa Indonesia + axe WCAG AA check.
  await page.goto("/?demo=1#/document/demo-doc-training-invoice");
  await page.getByLabel("Language").selectOption("id");
  await page.getByRole("button", { name: "Hapus dokumen" }).click();
  const idConfirm = page.getByRole("region", {
    name: /Hapus “Cedarbridge workshop invoice”\?/,
  });
  await expect(idConfirm).toBeVisible();
  await expect(idConfirm).toContainText("1 tindak lanjut yang tertaut");
  await expect(idConfirm.getByRole("button", { name: "Batal" })).toBeFocused();

  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);

  await idConfirm.getByRole("button", { name: "Hapus permanen" }).click();
  await expect(page).toHaveURL(/\?demo=1#\/library$/);
  await expect(page.getByRole("status")).toContainText("Dokumen dihapus.");
  await expect(page.getByText("16 dokumen", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("16 dokumen", { exact: true })).toBeVisible();

  await page.goto("/?demo=1#/actions");
  const demoGroup = page.getByRole("region", { name: "Training reimbursement" });
  await expect(demoGroup.getByText("1 dari 3 langkah selesai")).toBeVisible();
  await expect(
    demoGroup.locator("#action-card-demo-action-training-submit .readiness-chip"),
  ).toHaveText("Siap");

  // Personal workspace retains its own document untouched.
  await page.getByRole("link", { name: "Keluar demo" }).click();
  await page.getByLabel("Bahasa").selectOption("en");
  await page.getByRole("link", { name: "Library", exact: true }).first().click();
  await expect(page.getByText("1 document", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Household membership renewal notice/ }),
  ).toBeVisible();
});

test("account entry without Firebase Auth config supports local-only continuation, demo return routing, and ID WCAG AA", async ({
  page,
}) => {
  await page.goto("/#/account");
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
  await expect(page.getByText("Cloud sign-in is not configured here")).toBeVisible();

  await page.getByLabel("Language").selectOption("id");
  await expect(page.getByRole("heading", { name: "Akun" })).toBeVisible();

  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);

  await page.getByLabel("Bahasa").selectOption("en");
  await page.getByRole("link", { name: "Explore demo" }).click();
  await expect(page).toHaveURL(/\?demo=1.*#\/home$/);
  await page.goto("/?demo=1&from=%2Faccount#/account");
  await expect(
    page.getByText("Accounts are disabled in the sample workspace"),
  ).toBeVisible();

  await page.getByRole("link", { name: "Exit demo" }).first().click();
  await expect(page).toHaveURL(/#\/account$/);

  await page.getByRole("link", { name: "Continue on this device" }).click();
  await expect(page).toHaveURL(/#\/home$/);
});

test("Milestone 1 & 2: standalone #/login demo entry, Hybrid AI privacy indicator, 1-click workflow template, and calendar export", async ({
  page,
}) => {
  await page.goto("/#/login");
  await expect(page.getByRole("heading", { name: "Sign in to Tuntas" })).toBeVisible();
  await expect(page.locator(".rail")).toHaveCount(0);
  await expect(page.locator(".bottom-nav")).toHaveCount(0);
  await expect(page.getByText("demo@example.com", { exact: true })).toBeVisible();

  const loginAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(loginAxe.violations).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Language").selectOption("id");
  await expect(page.getByRole("heading", { name: "Masuk ke Tuntas" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await page.getByLabel("Bahasa").selectOption("en");
  await page.setViewportSize({ width: 1280, height: 850 });

  await page.getByRole("link", { name: "Enter demo" }).click();
  await expect(page).toHaveURL(/\?demo=1&from=%2Flogin#\/home$/);
  await expect(page.locator(".demo-bar")).toContainText("demo@example.com");
  await page.getByRole("link", { name: "Exit demo" }).click();
  await expect(page).toHaveURL(/\/#\/login$/);

  // Capture privacy indicator & 1-click workflow template
  await page.getByRole("button", { name: "Continue on this device" }).click();
  await expect(page).toHaveURL(/#\/home$/);
  await page.goto("/#/capture");
  await expect(page.locator(".privacy-strip")).toContainText("Local rules · On device");

  await page.getByRole("button", { name: "Paste text" }).click();
  await page
    .getByLabel("Document text")
    .fill("Monthly fiber bill\nInvoice #FB-209\nTotal: USD 45.00\nPay invoice by 20 December 2026.");
  await page.getByRole("button", { name: "Save & organize" }).click();
  await expect(page.getByRole("heading", { name: "Monthly fiber bill" })).toBeVisible();
  await expect(page.locator(".status-line .privacy-badge")).toContainText(
    "Processed locally · Rules only",
  );

  const templateCard = page.getByRole("region", { name: "Suggested workflow template" });
  await expect(templateCard).toBeVisible();
  await expect(templateCard).toContainText("3 connected steps");
  await templateCard.getByRole("button", { name: "Create 3-step workflow" }).click();
  await expect(templateCard).toContainText("Workflow created");
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Suggested workflow template" }),
  ).toContainText("Workflow created");

  await page.getByRole("link", { name: "Open in Actions" }).click();
  const group = page.getByRole("region", { name: "Monthly fiber bill" });
  await expect(group).toBeVisible();
  await expect(group.getByText("0 of 3 steps completed")).toBeVisible();
  await expect(group.locator(".action-card").nth(1)).toContainText("Waiting on 1 step");

  // Calendar export on dated action & hint on undated action
  const payStep = group.locator(".action-card", {
    hasText: "Pay bill before due date",
  });
  await payStep.getByRole("button", { name: "Details" }).click();
  const gcalLink = payStep.getByRole("link", { name: "Google Calendar" });
  await expect(gcalLink).toHaveAttribute(
    "href",
    /https:\/\/calendar\.google\.com\/calendar\/render\?/,
  );
  await expect(gcalLink).toHaveAttribute("href", /dates=20261220%2F20261221/);

  const downloadPromise = page.waitForEvent("download");
  await payStep.getByRole("button", { name: "Download .ics" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("tuntas-pay-bill-before-due-date-2026-12-20.ics");
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const icsContent = Buffer.concat(chunks).toString("utf8");
  expect(icsContent).toContain("BEGIN:VCALENDAR");
  expect(icsContent).toContain("DTSTART;VALUE=DATE:20261220");
  expect(icsContent).toContain("DTEND;VALUE=DATE:20261221");

  const verifyStep = group.locator(".action-card", {
    has: page.getByRole("checkbox", {
      name: /Verify bill amount and reference/,
    }),
  });
  await verifyStep.getByRole("button", { name: "Details", exact: true }).click();
  await expect(
    verifyStep.getByText("Save a due date above to export a calendar reminder."),
  ).toBeVisible();

  const actionsAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(actionsAxe.violations).toEqual([]);
});

test("Milestones 3 & 4: Split Bill Phase 1 on IDR receipt and Ask Your Paperwork in Library with WCAG AA", async ({
  page,
}) => {
  // 1. Split Bill Phase 1 on demo Indonesian restaurant receipt (184.000 IDR)
  await page.goto("/?demo=1#/document/demo-doc-redacted-receipt-1");
  await page.getByRole("button", { name: "Split bill" }).click();
  const splitPanel = page.getByRole("region", { name: "Create split bill" });
  await expect(splitPanel).toBeVisible();
  await expect(splitPanel.getByLabel("Currency")).toHaveValue("IDR");
  await expect(splitPanel.getByLabel("Currency").locator("option")).toHaveCount(5);

  const nameInputs = splitPanel.getByLabel("Participant name");
  await nameInputs.nth(1).fill("Budi");
  await splitPanel.getByRole("button", { name: "Add person" }).click();
  await nameInputs.nth(2).fill("Siti");
  await splitPanel
    .getByLabel(/Payment instructions/)
    .fill("BCA 1234567890 / QRIS");
  await splitPanel.getByRole("button", { name: "Create split bill" }).click();

  await expect(splitPanel.getByText("Split bill ready")).toBeVisible();
  await expect(splitPanel.getByText("Saved in Actions")).toBeVisible();

  await splitPanel.getByRole("link", { name: "Open in Actions" }).click();
  const splitGroup = page.getByRole("region", { name: "Restaurant dinner receipt" });
  await expect(splitGroup).toBeVisible();
  await expect(splitGroup.getByText("0 of 3 steps completed")).toBeVisible();
  await expect(splitGroup.getByText("All split shares settled")).toBeVisible();
  await expect(splitGroup.getByText("Waiting on 2 steps")).toBeVisible();

  // 2. Ask Your Paperwork in Library (spending total + factual renewal with clickable citation)
  await page.goto("/?demo=1#/library");
  const askSection = page.getByRole("region", { name: "Ask your paperwork" });
  await expect(askSection).toBeVisible();

  await askSection.getByRole("button", { name: "How much did I spend on receipts?" }).click();
  const answerRegion = askSection.getByRole("region", { name: "Paperwork answer" });
  await expect(answerRegion).toBeVisible();
  await expect(answerRegion).toContainText("2,072,442");
  await expect(answerRegion.locator(".ask-citation-link")).toHaveCount(5);
  await expect(
    answerRegion.getByRole("link", { name: /KFC Kota Kasablanka order receipt/ }),
  ).toBeVisible();

  // Check WCAG AA + 360px mobile overflow with Ask Your Paperwork open
  const libraryAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(libraryAxe.violations).toEqual([]);

  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await page.setViewportSize({ width: 1280, height: 850 });

  await askSection.getByRole("button", { name: "When does household membership renew?" }).click();
  await expect(answerRegion).toContainText("2026-12-12");
  await answerRegion
    .getByRole("link", { name: /Household membership renewal notice/ })
    .click();
  await expect(page).toHaveURL(/\?demo=1#\/document\/demo-doc-renewal$/);
});

test("Demo extra receipts, itemized prefill, and interactive Demo Shared Split Bills with reload & WCAG AA", async ({
  page,
}) => {
  await page.goto("/?demo=1#/library");
  await expect(page.getByText("17 documents")).toBeVisible();

  // 1. Verify KFC PDF original downloads cleanly and Itemized Split Bill pre-populates 3 dishes + 4546 tax
  await page.getByRole("link", { name: /KFC Kota Kasablanka order receipt/ }).click();
  await page.getByText("Original document", { exact: true }).click();
  const kfcDownload = page.getByRole("link", { name: "Download original" });
  await expect(kfcDownload).toHaveAttribute("download", "digital_receipt_1.pdf");

  await page.getByRole("button", { name: "Split bill" }).click();
  const kfcSplit = page.getByRole("region", { name: "Create split bill" });
  await kfcSplit.getByRole("button", { name: "Itemized" }).click();
  await expect(kfcSplit.getByLabel("Item name")).toHaveCount(3);
  await expect(kfcSplit.getByLabel("Item name").first()).toHaveValue("1 Lado Ijo Don");
  await expect(kfcSplit.getByLabel("Tax & service charge")).toHaveValue("4546");

  // 2. Verify all 4 new photo receipts decode real <img> originals & Warung Taburai itemized items
  for (const docId of [
    "demo-doc-asics-receipt",
    "demo-doc-jiwa-receipt",
    "demo-doc-haus-receipt",
    "demo-doc-taburai-receipt",
  ]) {
    await page.goto(`/?demo=1#/document/${docId}`);
    await page.getByText("Original document", { exact: true }).click();
    const img = page.getByRole("img", { name: "Original captured document" });
    await expect(img).toBeVisible();
    await expect
      .poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0))
      .toBeTruthy();
  }

  await page.getByRole("button", { name: "Split bill" }).click();
  const taburaiSplit = page.getByRole("region", { name: "Create split bill" });
  await taburaiSplit.getByRole("button", { name: "Itemized" }).click();
  await expect(taburaiSplit.getByLabel("Item name")).toHaveCount(2);
  await expect(taburaiSplit.getByLabel("Item name").first()).toHaveValue("1 Pkt Ayam Bakar");

  // 3. Interactive Demo Shared Split Bills in Actions (Incoming accept + proof, Outgoing confirm)
  await page.goto("/?demo=1#/actions");
  const sharedSection = page.getByRole("region", { name: "Shared split bills" });
  await expect(sharedSection).toBeVisible();

  await sharedSection.getByRole("link", { name: /KFC Kota Kasablanka team lunch/ }).click();
  await expect(page).toHaveURL(/\?demo=1#\/split\/demo-split-incoming-kfc$/);
  await expect(page.getByText("Demo preview · stored locally")).toBeVisible();

  const inAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(inAxe.violations).toEqual([]);

  await page.getByRole("button", { name: "Accept share" }).click();
  await page.getByLabel(/Transfer reference/).fill("Transfer QRIS 16000 ref QRIS-9921");
  await page.getByRole("button", { name: "Verify proof" }).click();
  await expect(page.getByRole("status")).toContainText("QRIS-9921");
  await page.getByRole("button", { name: "Submit payment proof" }).click();
  await expect(page.getByText("Proof submitted")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Proof submitted")).toBeVisible();

  // Outgoing split: confirm Siti Rahma's submitted proof -> Confirmed
  await page.goto("/?demo=1#/actions");
  await sharedSection
    .getByRole("link", { name: /Warung Taburai handwritten dinner bill/ })
    .click();
  await expect(page).toHaveURL(/\?demo=1#\/split\/demo-split-outgoing-taburai$/);

  const outAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(outAxe.violations).toEqual([]);

  await page.getByRole("button", { name: "Confirm payment received" }).click();
  await expect(page.getByText("Confirmed").first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Confirmed").first()).toBeVisible();
});
