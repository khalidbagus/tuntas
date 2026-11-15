# Run and evaluate Tuntas

Tuntas is a mobile-responsive web app; select Web/Chrome for judging. No native Android or iOS application is supplied. The default library belongs to one browser profile and origin. There is no account login or cross-device sync.

## Local installation

Use Node 22.13+ and npm. In the source directory:

```sh
npm ci
npm run dev -- --port 5173 --strictPort
```

Open `http://127.0.0.1:5173`. Keep that origin and profile to preserve the library. No Firebase account is needed for the local-rule tour below. Cloud AI and desktop local-model inference require the separate Firebase configuration below. A production preview without App Check configuration intentionally disables AI.

## Three-minute functional tour without configuration

1. On Home, choose **Try sample receipt**. This fictional Fieldnote receipt uses **Local rules**, not a live model.
2. Inspect its Purchases category, USD 24.00 total, source excerpt and retained original.
3. Open Library and search `notebook 24.00`. Open the result. Edit its category to Work & Study; save and reload to verify persistence.
4. Add an action such as `Pack the notebook`, leaving its date empty. Complete it in Actions and follow the document backlink.
5. Capture the same sample again: duplicate handling opens the existing original. Use Undo immediately after a fresh filing to move a document to Inbox; confirm its classification there.
6. Paste `Sample lease and invoice` using Local rules: inspect the ambiguous review state. Upload a PDF without embedded text: retain/download the original or file manually rather than claiming unsupported PDF OCR.

Use only synthetic data. Clearing site data deletes the local library; another browser profile starts empty.

## Reproduce real Firebase AI Logic inference

Follow the [Firebase hybrid web guide](https://firebase.google.com/docs/ai-logic/hybrid/web/get-started) and [App Check debug-provider guide](https://firebase.google.com/docs/app-check/web/debug-provider). Enable Firebase AI Logic with Gemini Developer API and App Check for a development web app. Configure quotas before live calls.

Copy `.env.example` to `.env.local`, supplying your own web configuration. For localhost development register a private debug token in App Check and set `TUNTAS_APP_CHECK_DEBUG_TOKEN`. A production site key is not required for this loopback debug path. Restart Vite after configuration changes. Do not publish this file or share the token in the submission.

Paste this fictional receipt in Capture (change the reference for each new inference; byte-identical input opens the existing document):

```text
SYNTHETIC RECEIPT — not a real transaction
Fieldnote Demo Shop
Receipt: DEMO-LOCAL-001
Item: Notebook
Total: USD 12.00
```

On a supported desktop Chrome with a downloaded local model, select **Firebase AI · device only**, then Save & organize. Inspect the actual processing result for **Firebase · on device**. Browser API presence alone does not prove model readiness. Setup/download time may require a retry; free sufficient RAM before testing. The observed laptop succeeded with roughly 5.9 GiB RAM available; this is an observation, not a universal threshold.

For cloud fallback on unsupported browsers, use a different receipt reference, select **Firebase AI · prefer device, allow cloud**, and explicitly tick the per-document consent box. Expect the actual SDK-reported source; supported desktops may still choose local inference. Samsung Chrome lacking the local API was verified to return **Firebase · cloud**. Photo processing sends JPEG/PNG bytes to Google's model when cloud inference is selected and consented; photo results require review. Original files remain in browser storage; Firestore and Cloud Storage are not enabled.

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
