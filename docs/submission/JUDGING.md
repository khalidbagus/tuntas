# Run and evaluate Tuntas

Tuntas is a mobile-responsive web app; select Web/Chrome for judging. No native Android or iOS application is supplied. The default library belongs to one browser profile and origin. There is no account login or cross-device sync.

## Hosted demo

Open [Tuntas](https://tuntas-dev.web.app/) in Chrome. The sample walkthrough below works directly on the hosted site. For live cloud AI, use **Capture → Paste text** with a fresh synthetic renewal, select **Firebase AI · prefer device, allow cloud**, and check the per-document consent box. On a browser without a ready on-device model, inspect the **Firebase · cloud** label and the quoted evidence. Confirm the suggested follow-up, reload Actions, and reopen the source document. The hosted flow was verified signed out with production App Check.

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
