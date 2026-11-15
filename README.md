# Tuntas ✦
Capture a document once. Find it later by what it contains, correct uncertain filing, or attach a follow-up. This is a local-first web MVP based on the actual Tuntas Stitch exports. No Firebase account is required for the browser-only workflow.

## Run locally
Use Node 22.13+ and npm. From this folder:
```sh
npm ci
npm run dev
```
Open the loopback URL printed by Vite. Use the **same hostname, port and browser profile** on later visits. A separate profile starts empty. For the production bundle use `npm run build`, then `npm run preview`. Public deployment is not part of this setup.

## Try it
1. On Home choose the arrow on **Fieldnote Supply · Synthetic receipt**. The sample runs real local rules, never a Firebase request. It files under Purchases with USD 24.00 and a source excerpt.
2. Open Library. Search for `notebook 24.00`. Open the result, inspect the original, edit the category or Undo filing. Undo moves the record to Inbox without deleting the original. Capture the same receipt again to open the existing document.
3. Add an action with a title of your choice. Its date is optional. Complete it in Actions and follow its source link.
4. Paste `Sample lease and invoice`: conflicting matches need review. Submit a PDF without a text layer: the original remains available for retry, download or manual filing.

## Storage, formats and boundaries
React/Vite; IndexedDB stores originals, documents and actions in one browser origin. File staging is transactional, with unique SHA-256 fingerprints. The original blob, extracted text, classification proposal and user edits are separate. No external image, analytics, font or model request is needed in local mode. This is a single-profile workspace, **not** an authenticated account or an encrypted zero-knowledge vault. A person using the same browser profile can access it. Clearing site data removes it. No Firestore, Storage, cloud sync, uploads or multi-user permissions are enabled; Firebase backend security rules and cross-account tests are not applicable to this build. Do not enable new cloud data stores without ownership rules and emulator tests.

Accepts one PDF, JPEG or PNG up to 8 MiB; 24-megapixel image cap; 16,000 characters of pasted text; 300 documents per workspace. PDF.js reads up to 8 pages / 16,000 characters of embedded text in a worker. Partial reads require review. A scanned PDF is never described as an on-device PDF inference: manually file, or supply a photograph. Native camera availability depends on browser and device; no deskew or multipage OCR. Local rules recognize a few literal document types and labeled totals, not arbitrary natural language. An open tab supports offline local filing; cold offline app launch and background sync are not implemented.

## Firebase integration
The local workspace has an ignored development configuration for **Tuntas Dev**. Consented cloud inference works on the connected Samsung, including four private receipt photographs evaluated with the owner's permission. Desktop CPU text inference also succeeded through Firebase AI Logic with a synthetic receipt, SDK-reported **Firebase · on device**, and zero cloud generation requests. The installed local manifest identifies **v3Nano**. A Devpost staff reply relaying Firebase's answer accepts model access through Firebase AI Logic for this version question; see [provenance](docs/PROVENANCE.md). Production attestation remains unverified. See [development access](docs/DEVELOPMENT-ACCESS.md) and [recorded results](docs/VERIFICATION.md).

The Firebase classifier is invoked from the configured Capture and Retry controls. The Home sample uses local rules. `src/firebase-ai.js` uses the modular SDK and App Check, initializes the model from the button gesture and calls `generateContent`. `src/engine.js` selects a swappable classifier.

For a future authorized test:
1. Register a development web app with Firebase AI Logic (Gemini Developer API). Use [Firebase's current hybrid web setup](https://firebase.google.com/docs/ai-logic/hybrid/web/get-started), including a supported Chrome desktop, Prompt API setup and device model availability. A browser with ordinary JavaScript support alone is insufficient.
2. Register **reCAPTCHA Enterprise** for the web app; enable AI Logic App Check enforcement. Follow Firebase’s local debug-provider instructions for a private development token if needed. Never commit a token, use a service account in the frontend, or whitelist localhost as a production attestation domain. Set AI quotas in the Firebase project before testing; the local input cap is not a server-side spending limit.
3. Copy `.env.example` to `.env.local`, fill the public web app settings and site key, restart Vite. No credentials are included. Firebase SDK initialization happens on AI processing, not on opening an unconfigured app.
4. Paste a **new synthetic** receipt via Capture. Select **device only** to prohibit cloud fallback. A first model download can take time. For a separate consented test select hybrid and tick its per-document disclosure. In hybrid mode PDF text, pasted text or JPEG/PNG bytes may be sent to Google's model; raw PDF files are never sent. Cloud mode does not store a copy in Firestore or Storage.
5. On success inspect the returned processing source; unreported source stays unreported. On failure the app keeps the original. Verify device and cloud outcomes separately before recording competition footage. Download/setup delays can require a retry; UI timeout does not cancel a request already sent to the SDK.

## Verification
```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```
Playwright uses an isolated profile and a separate loopback server on port 5174. Fixtures are generated synthetic bytes. To regenerate demo screenshots with the normal dev server running at 5173, use `node scripts/demo-screens.mjs`. See [test observations](docs/VERIFICATION.md).

[Stitch audit and priorities](docs/STITCH-AUDIT.md) · [routes and processing states](docs/FLOW.md) · [competition and provenance](docs/PROVENANCE.md).


[Judging instructions](docs/submission/JUDGING.md) · [Release validation](docs/submission/VALIDATION.md)

Raw Google Stitch exports, AI prompts/handovers and submission drafts remain local and are excluded by `.gitignore`. They are not application runtime dependencies. The source, license, third-party notices and app documentation are versioned; `npm ci` and `npm run build` do not require those design exports.
