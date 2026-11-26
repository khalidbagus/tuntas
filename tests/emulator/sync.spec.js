import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PROJECT_ID = "demo-tuntas-dev";
const AUTH_EMULATOR = "http://127.0.0.1:9099";
const FIRESTORE_EMULATOR = "http://127.0.0.1:8080";

async function clearEmulators() {
  await Promise.all([
    fetch(
      `${AUTH_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/accounts`,
      { method: "DELETE" },
    ),
    fetch(
      `${FIRESTORE_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
      { method: "DELETE" },
    ),
  ]);
}

async function listOobCodes() {
  const res = await fetch(
    `${AUTH_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/oobCodes`,
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.oobCodes || [];
}

async function createSeededUser({ email, password, emailVerified = true }) {
  const res = await fetch(
    `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-tuntas-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const created = await res.json();
  if (emailVerified && created.localId) {
    await fetch(
      `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-tuntas-api-key`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken: created.idToken,
          emailVerified: true,
        }),
      },
    );
  }
  return created;
}

test.beforeEach(async () => {
  await clearEmulators();
});

test("account entry: email sign-up, verification, password reset, Google sign-in & error paths, demo/local return, WCAG AA", async ({
  page,
  context,
}) => {
  // First visit while signed out opens standalone Login / Sign-up screen without workspace shell
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to Tuntas" })).toBeVisible();
  await expect(page.locator(".rail")).toHaveCount(0);
  await expect(page.locator(".bottom-nav")).toHaveCount(0);
  await expect(page.getByText("demo@example.com", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Enter demo" }).click();
  await expect(page).toHaveURL(/\?demo=1&from=%2Flogin#\/home$/);
  await expect(page.locator(".demo-bar")).toContainText("demo@example.com");
  await page.getByRole("link", { name: "Exit demo" }).first().click();
  await expect(page).toHaveURL(/\/#\/login$/);

  await page.goto("/#/account");
  await expect(page.getByRole("heading", { name: "Sign in to Tuntas" })).toBeVisible();

  // Desktop accessibility + overflow check
  const desktopAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(desktopAxe.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  // Blocked Google popup shows guidance
  await page.evaluate(() => {
    window.__origOpen = window.open;
    window.open = () => null;
  });
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByRole("alert")).toContainText("blocked the sign-in popup");
  await page.evaluate(() => {
    if (window.__origOpen) window.open = window.__origOpen;
  });

  // Canceled Google popup shows cancellation guidance (wait for load then close; SDK polls closed state)
  const closedPopupPromise = context.waitForEvent("page");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const closedPopup = await closedPopupPromise;
  await closedPopup.waitForLoadState("domcontentloaded").catch(() => { });
  await closedPopup.close();
  await expect(page.getByRole("alert")).toContainText(
    "canceled before finishing",
    { timeout: 15000 },
  );

  // Create account with email/password -> triggers verification pending
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Email address").fill("alice@example.com");
  await page.getByLabel(/Password/).fill("Secret123!");
  await page.locator("form button[type='submit']").click();

  await expect(page.getByText("alice@example.com").first()).toBeVisible();
  await expect(page.getByText("Verification pending")).toBeVisible();
  await expect(page.getByText("Sync off")).toBeVisible();

  // Resend verification & verify via emulator OOB link -> refresh turns chip green
  await page.getByRole("button", { name: "Resend verification email" }).click();
  await expect
    .poll(async () => (await listOobCodes()).filter((c) => c.requestType === "VERIFY_EMAIL").length)
    .toBeGreaterThanOrEqual(1);
  const verifyCodes = (await listOobCodes()).filter(
    (c) => c.requestType === "VERIFY_EMAIL",
  );
  const oobRes = await fetch(verifyCodes[verifyCodes.length - 1].oobLink);
  expect(oobRes.ok).toBe(true);

  await page.getByRole("button", { name: "I’ve verified" }).click();
  await expect(page.getByText("Verified", { exact: true })).toBeVisible();

  // Session restoration on reload preserves signed-in account
  await page.reload();
  await expect(page.getByText("alice@example.com").first()).toBeVisible();
  await expect(page.getByText("Sync off")).toBeVisible();

  // Sign out -> duplicate create-account shows clear message -> wrong password -> Forgot password
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();

  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Email address").fill("alice@example.com");
  await page.getByLabel(/Password/).fill("Secret123!");
  await page.locator("form button[type='submit']").click();
  await expect(page.getByRole("alert")).toContainText("already exists with this email");

  await page.getByRole("button", { name: "Forgot password" }).click();
  await page.getByLabel("Email address").fill("alice@example.com");
  await page.getByRole("button", { name: "Send reset email" }).click();
  await expect(page.getByRole("status")).toContainText("alice@example.com");
  await expect
    .poll(
      async () =>
        (await listOobCodes()).filter((c) => c.requestType === "PASSWORD_RESET")
          .length,
    )
    .toBeGreaterThanOrEqual(1);

  // Google Continue creates account on first use and signs in returning user
  const googlePopup1Promise = context.waitForEvent("page");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const gPopup1 = await googlePopup1Promise;
  await gPopup1.getByRole("button", { name: "Add new account" }).click();
  await gPopup1.getByLabel(/Email/i).fill("guser@example.com");
  await gPopup1.getByRole("button", { name: /Sign in with Google/i }).click();

  await expect(page.getByText("guser@example.com").first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Google", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();

  // Returning Google sign-in selects existing user
  const googlePopup2Promise = context.waitForEvent("page");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const gPopup2 = await googlePopup2Promise;
  await gPopup2.getByText("guser@example.com").first().click();
  await expect(page.getByText("guser@example.com").first()).toBeVisible({ timeout: 10000 });

  // Demo isolation & return route + Mobile 390px + ID check
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("link", { name: "Enter demo" }).click();
  await expect(page).toHaveURL(/\?demo=1.*#\/home$/);
  await page.goto("/?demo=1&from=%2Faccount#/account");
  await expect(
    page.getByText("Accounts are disabled in the sample workspace"),
  ).toBeVisible();
  await page.getByRole("link", { name: "Exit demo" }).first().click();
  await expect(page).toHaveURL(/#\/account$/);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Language").selectOption("id");
  await expect(page.getByRole("heading", { name: "Masuk ke Tuntas" })).toBeVisible();
  const mobileAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(mobileAxe.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("opt-in local import (retry-safe), two-profile progress sync, device-only originals, offline retry, deletion tombstone, and account isolation", async ({
  browser,
}) => {
  test.setTimeout(90000);
  await createSeededUser({ email: "alice@example.com", password: "Password123!" });
  await createSeededUser({ email: "bob@example.com", password: "Password123!" });

  const profileA = await browser.newContext({
    viewport: { width: 1280, height: 850 },
  });
  const profileB = await browser.newContext({
    viewport: { width: 1280, height: 850 },
  });
  const pageA = await profileA.newPage();
  const pageB = await profileB.newPage();

  try {
    // 1. Local-only use on Profile A while signed out
    await pageA.goto("/#/account");
    await pageA.getByRole("button", { name: "Continue on this device" }).click();
    await pageA.goto("/#/capture");
    await pageA.getByRole("button", { name: "Paste text" }).click();
    await pageA
      .getByLabel("Document text")
      .fill(
        "City power bill\nCustomer ref: CP-900\nAmount due: USD 65.00\nPlease pay by 15 December 2026.",
      );
    await pageA.getByRole("button", { name: "Save & organize" }).click();
    await expect(
      pageA.getByRole("heading", { name: "City power bill" }),
    ).toBeVisible();
    await pageA.getByRole("button", { name: "Add follow-up" }).click();
    await pageA.getByRole("button", { name: "Create action" }).click();
    await expect(pageA.getByRole("status")).toContainText("Added to Actions");

    // 2. Sign in Alice on Profile A -> local records are isolated from Alice until opt-in import
    await pageA.goto("/#/account");
    await pageA.getByLabel("Email address").fill("alice@example.com");
    await pageA.getByLabel(/Password/).fill("Password123!");
    await pageA.locator("form button[type='submit']").click();
    await expect(pageA.getByText("alice@example.com").first()).toBeVisible();
    await expect(pageA.getByText("Sync off")).toBeVisible();

    await pageA.goto("/#/library");
    await expect(pageA.getByText("0 documents", { exact: true })).toBeVisible();

    // 3. Opt-in sync & local import prompt (cancel keeps sync off; confirm imports safely)
    await pageA.goto("/#/account");
    await pageA.getByRole("button", { name: "Enable sync" }).click();
    const importRegion = pageA.getByRole("region", {
      name: "Import records from this device?",
    });
    await expect(importRegion).toBeVisible();
    await expect(importRegion).toContainText("1 local document(s) and 1 follow-up(s)");
    await expect(importRegion.getByRole("button", { name: "Cancel" })).toBeFocused();
    await importRegion.getByRole("button", { name: "Cancel" }).click();
    await expect(pageA.getByText("Sync off")).toBeVisible();

    // Accept import & sync
    await pageA.getByRole("button", { name: "Enable sync" }).click();
    await pageA.getByRole("button", { name: "Import local records & enable sync" }).click();
    await expect(pageA.locator(".sync-status-pill")).toHaveText("Synced", {
      timeout: 15000,
    });

    // Capture a second document with group + prerequisite links on Profile A
    await pageA.goto("/#/capture");
    await pageA.getByRole("button", { name: "Paste text" }).click();
    await pageA
      .getByLabel("Document text")
      .fill(
        "Lease renewal notice\nRenew your lease by 22 December 2026.",
      );
    await pageA.getByRole("button", { name: "Save & organize" }).click();
    await expect(
      pageA.getByRole("heading", { name: "Lease renewal notice" }),
    ).toBeVisible();
    await pageA.getByRole("button", { name: "Add follow-up" }).click();
    await pageA.getByRole("button", { name: "Create action" }).click();
    await expect(pageA.getByRole("status")).toContainText("Added to Actions");

    await pageA.goto("/#/actions");
    await pageA.getByRole("button", { name: "New group" }).click();
    await pageA.getByLabel("Group name").fill("Home paperwork");
    await pageA.getByRole("button", { name: "Create group" }).click();
    await expect(pageA.getByRole("region", { name: "Home paperwork" })).toBeVisible();

    // Assign both actions to "Home paperwork" and connect a prerequisite link
    const standalone = pageA.locator(".standalone-bucket").first();
    for (const remaining of [1, 0]) {
      const row = standalone.locator(".action-card").first();
      await row.getByRole("button", { name: "Details", exact: true }).click();
      await row.getByLabel(/Group|Add to group/).selectOption({ label: "Home paperwork" });
      await expect(standalone.locator(".action-card")).toHaveCount(remaining);
    }

    const groupCardA = pageA.getByRole("region", { name: "Home paperwork" });
    await expect(groupCardA.locator(".action-card")).toHaveCount(2);
    const secondCardA = groupCardA.locator(".action-card").nth(1);
    await expect(
      secondCardA.getByRole("button", { name: "Hide details", exact: true }),
    ).toBeVisible();
    await secondCardA.getByRole("combobox", { name: /Add prerequisite/ }).selectOption({ index: 1 });
    await secondCardA.getByRole("button", { name: "Connect step", exact: true }).click();
    await expect(secondCardA.locator(".readiness-chip")).toContainText("Waiting");

    await pageA.goto("/#/account");
    await pageA.getByRole("button", { name: "Sync now" }).click();
    await expect(pageA.locator(".sync-status-pill")).toHaveText("Synced", {
      timeout: 15000,
    });

    // 4. Profile B signs in as Alice -> sees active sync notice -> enables sync -> receives all progress
    await pageB.goto("/#/account");
    await pageB.getByLabel("Email address").fill("alice@example.com");
    await pageB.getByLabel(/Password/).fill("Password123!");
    await pageB.locator("form button[type='submit']").click();
    await expect(pageB.getByText("alice@example.com").first()).toBeVisible();
    await expect(
      pageB.getByText("Progress sync is already active on another device"),
    ).toBeVisible();

    await pageB.getByRole("button", { name: "Enable sync" }).click();
    await expect(pageB.locator(".sync-status-pill")).toHaveText("Synced", {
      timeout: 15000,
    });

    // Profile B sees documents & device-only original boundary
    await pageB.goto("/#/library");
    await expect(pageB.getByText("2 documents", { exact: true })).toBeVisible();
    await pageB.getByRole("link", { name: /City power bill/ }).click();
    await expect(pageB.getByText("Synced from another device")).toBeVisible();
    await pageB.getByText("Original document").click();
    await expect(
      pageB.getByText("Original file, extracted text, and evidence excerpts stay on the device"),
    ).toBeVisible();

    // While Profile A STILL retains original extracted text
    await pageA.goto("/#/library");
    await pageA.getByRole("link", { name: /City power bill/ }).click();
    await pageA.getByText("Original document").click();
    await expect(pageA.getByText("Customer ref: CP-900")).toBeVisible();

    // Profile B sees group and prerequisite link
    await pageB.goto("/#/actions");
    const groupCardB = pageB.getByRole("region", { name: "Home paperwork" });
    await expect(groupCardB).toBeVisible();
    await expect(groupCardB.locator(".action-card")).toHaveCount(2);
    await expect(
      groupCardB.locator(".action-card").nth(1).locator(".readiness-chip"),
    ).toContainText("Waiting");

    // 5. Offline edit on Profile B -> Pending -> reconnect -> Synced to Profile A
    await profileB.setOffline(true);
    const firstCheckboxB = groupCardB.locator("input[type='checkbox']").first();
    await firstCheckboxB.click();
    await pageB.goto("/#/account");
    await expect(pageB.locator(".sync-status-pill")).toHaveText("Pending");

    await profileB.setOffline(false);
    await expect(pageB.locator(".sync-status-pill")).toHaveText("Synced", {
      timeout: 15000,
    });

    await pageA.goto("/#/actions");
    const refreshedGroupA = pageA.getByRole("region", { name: "Home paperwork" });
    await expect(refreshedGroupA.getByText("1 of 2 steps completed")).toBeVisible({
      timeout: 15000,
    });
    await expect(
      refreshedGroupA.locator(".action-card").nth(1).locator(".readiness-chip"),
    ).toHaveText("Ready");

    // 6. Cross-device deletion without resurrection when offline Profile B reconnects
    await profileB.setOffline(true);
    await pageB.goto("/#/library");
    await pageB.getByRole("link", { name: /Lease renewal notice/ }).click();
    await pageB.getByRole("button", { name: "Edit details" }).click();
    await pageB.getByLabel("Document title").fill("Stale offline edit before delete");
    await pageB.getByRole("button", { name: "Save changes" }).click();

    // Profile A deletes Lease renewal notice permanently while B is offline
    await pageA.goto("/#/library");
    await pageA.getByRole("link", { name: /Lease renewal notice/ }).click();
    await pageA.getByRole("button", { name: "Delete document" }).click();
    await pageA.getByRole("button", { name: "Delete permanently" }).click();
    await expect(pageA).toHaveURL(/#\/library$/);
    await expect(pageA.getByText("1 document", { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(pageA.locator(".account-rail-link")).toContainText("Synced", {
      timeout: 15000,
    });

    // Reconnect Profile B -> remote tombstone wins; deleted doc stays deleted on both B and A
    await profileB.setOffline(false);
    await pageB.goto("/#/account");
    await expect(pageB.locator(".sync-status-pill")).toHaveText("Synced", {
      timeout: 15000,
    });
    await pageB.goto("/#/library");
    await expect(pageB.getByText("1 document", { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(
      pageB.getByRole("link", { name: /Lease renewal notice|Stale offline/ }),
    ).toHaveCount(0);

    await pageA.reload();
    await expect(pageA.getByText("1 document", { exact: true })).toBeVisible();
    await expect(
      pageA.getByRole("link", { name: /Lease renewal notice|Stale offline/ }),
    ).toHaveCount(0);

    // 7. Sign out Alice on Profile A -> local-only copy is preserved -> switch to Bob -> strict UID isolation
    await pageA.goto("/#/account");
    await pageA.getByRole("button", { name: "Sign out" }).click();
    await pageA.getByRole("button", { name: "Continue on this device" }).click();
    await pageA.goto("/#/library");
    await expect(pageA.getByText("1 document", { exact: true })).toBeVisible();
    await expect(pageA.getByRole("link", { name: /City power bill/ })).toBeVisible();

    // Sign in as Bob -> Bob's workspace must have 0 documents (zero leakage from Alice or local)
    await pageA.goto("/#/account");
    await pageA.getByLabel("Email address").fill("bob@example.com");
    await pageA.getByLabel(/Password/).fill("Password123!");
    await pageA.locator("form button[type='submit']").click();
    await expect(pageA.getByText("bob@example.com").first()).toBeVisible();
    await pageA.goto("/#/library");
    await expect(pageA.getByText("0 documents", { exact: true })).toBeVisible();
  } finally {
    await profileA.close();
    await profileB.close();
  }
});
