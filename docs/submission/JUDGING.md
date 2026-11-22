# Run and evaluate Tuntas

Tuntas is a mobile-responsive web app in the Web/Chrome track. The local library belongs to one browser profile and origin. Signing in lets you opt in to cross-device sync for filing metadata and action progress. Original files and evidence stay on the device.

## Populated demo

Start the local server below and open the [sample workspace](http://127.0.0.1:5173/?demo=1#/home) in Chrome. The [hosted demo](https://tuntas-dev.web.app/?demo=1#/home) reflects the most recent deployment. With the latest source, a fresh demo starts with **2 Inbox items**, **12 filed documents** covering all six categories, and **7 open follow-ups** across two groups and one standalone step. Use the header language picker for **English** or **Bahasa Indonesia**.

1. Open **Actions → Training reimbursement**. **Save training approval** is complete, **Check workshop invoice** starts overdue, and **Submit reimbursement claim** waits for both prerequisites. The claim is due on the day the examples are first added. **Today’s Focus** recommends the invoice when it is the highest-priority ready step.
2. Open **View connections** to see both prerequisites converge on the claim. Open **Check workshop invoice** and read **Evidence at a glance**. Complete it to advance from `1 of 4` to `2 of 4` and make the claim **Ready**.
3. Try **Household membership renewal** for a three-step chain across two source notices. Use **No Due Date** to find **Verify confirmation** and try adding or removing a deadline.
4. Open **Inbox → Northgrid Water & Power billing notice** and compare the two dates with the original. Open **Courtyard room booking note** to review an ambiguous category, choose a category, and select **Confirm & file**.
5. Open **Library**. Search for `TR-608` to find the related approval and invoice across categories. Search for `BL-2048` under **Personal Records** and expand **Original document** to read its text and download the synthetic policy PDF.
6. Open **Undangan pengarahan relawan** under **Other**. Use **Add follow-up** to create the suggested action with an optional due date. Under **Purchases**, search for `184.000` and open **Restaurant dinner receipt** to inspect one of four redacted receipt photos with manually entered totals.
7. Choose **Exit demo** to return to the separate personal workspace.

On the development machine, use [the private local demo](http://127.0.0.1:5173/?demo=1&receipts=1#/library) to see the additional photographed receipts under **Purchases**. These fixtures live in the ignored `.release/private-demo-receipts` directory and are served only by the loopback development server.

For live cloud AI, use **Capture → Paste text** with a fresh synthetic renewal, select **Firebase AI · prefer device, allow cloud**, and check the per-document consent box. On a browser without a ready on-device model, inspect the **Firebase · cloud** label and the quoted evidence. Confirm the follow-up, reload Actions, and reopen its source.

## Local installation

Use Node 22.13+ and npm. In the source directory:

```sh
npm ci
npm run dev -- --port 5173 --strictPort
```

Open `http://127.0.0.1:5173`. Keep that origin and profile to preserve the library. No Firebase account is needed for the local-rule tour below. Cloud AI and desktop local-model inference require the separate Firebase configuration below. A production preview without App Check configuration intentionally disables AI.

## Three-minute functional tour without configuration

1. On Home, choose **Try sample** on the Household renewal card. The fictional notice uses **Local rules**.
2. Check the excerpt and original. Choose **Add follow-up**, verify the due date of **12 December 2026**, then choose **Create action**.
3. Open Actions, reload, and follow the link back to the source document. Open Library and search for `household renewal` to find it again.
4. Try the sample again to verify duplicate handling. Use **Undo filing** after a fresh filing to move a document to Inbox for review.
5. Paste `Sample lease and invoice` with Local rules to see an ambiguous review state. With an image-only PDF, use manual filing or download the retained original.

Use only synthetic data. Clearing site data deletes the local library; another browser profile starts empty.

## Reproduce real Firebase AI Logic inference

Follow the [Firebase hybrid web guide](https://firebase.google.com/docs/ai-logic/hybrid/web/get-started) and [App Check debug-provider guide](https://firebase.google.com/docs/app-check/web/debug-provider). Enable Firebase AI Logic with Gemini Developer API and App Check for a development web app. Configure quotas before live calls.

Copy `.env.example` to `.env.local`, supplying your own web configuration. For localhost development register a private debug token in App Check and set `TUNTAS_APP_CHECK_DEBUG_TOKEN`. A production site key is not required for this loopback debug path. Restart Vite after configuration changes. Do not publish this file or share the token in the submission.

Paste this fictional renewal in Capture. Change the reference for each live run because byte-identical input opens the existing document.

```text
Household membership renewal notice
Synthetic reference: DEMO-LOCAL-001
Renew your membership by 12 December 2026.
```

On a supported desktop Chrome with a downloaded local model, select **Firebase AI · device only**, then Save & organize. Inspect the actual processing result for **Firebase · on device**. Browser API presence alone does not prove model readiness. Setup/download time may require a retry; free sufficient RAM before testing. The observed laptop succeeded with roughly 5.9 GiB RAM available; this is an observation, not a universal threshold.

For cloud fallback on unsupported browsers, use a different synthetic reference, select **Firebase AI · prefer device, allow cloud**, and explicitly tick the per-document consent box. Supported desktops may still choose local inference. Samsung Chrome lacking the local API was verified to return **Firebase · cloud**. With per-document consent, cloud photo processing sends JPEG/PNG bytes to Google's model. Photo results require review. Original files remain in browser storage.

Failure should preserve the original for retry, local rules (text), or manual filing. Device-only must never silently escalate to cloud. The SDK adapter guard is version-specific and must be reviewed on Firebase SDK upgrades.

## Checks and limits

```sh
npm test
npx playwright install chromium webkit
npm run test:e2e
npm run test:e2e:webkit
npm run build
```

Automated browser tests use synthetic fixtures and clear Firebase configuration. They test local behavior, not live inference. Historical live inference evidence is recorded separately in [verification](../VERIFICATION.md). WebKit automation is not a physical iPhone test.

Limits: one PDF/JPEG/PNG up to 8 MiB, image cap 24 megapixels, text cap 16,000 characters; PDF embedded-text extraction up to eight pages. No scanned-PDF OCR, cold offline launch, encrypted vault, native app, account authentication or cloud document synchronization is claimed.
