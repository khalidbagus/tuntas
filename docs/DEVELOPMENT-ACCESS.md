> Current release note (15 November 2026): desktop CPU inference and the four-photo cloud flow have since succeeded. The model-version clarification is recorded in [provenance](PROVENANCE.md); remaining work is tracked in [release validation](submission/VALIDATION.md). Historical observations below retain their original context.

# Firebase and Android development

## Current development state

**Subsequent verification.** Local text inference now succeeds on the laptop CPU with more free RAM. Both a direct Chrome model prompt and a synthetic Tuntas receipt through Firebase AI Logic succeeded, with zero cloud generation for device-only processing. The installed manifest says `v3Nano`; the contest model-version clarification is recorded in [provenance](PROVENANCE.md). Four owner-authorized private receipt photos also completed Firebase cloud analysis, review, Library search and reload on Samsung. See the latest [verification entry](VERIFICATION.md).

Reproduce the bounded CPU test using `node scripts/verify-nano.mjs --profile <isolated-profile-with-model> --output <private-result-path>`. It uses an isolated desktop Chrome profile and synthetic text. Keep sufficient free RAM while the model is loading.

No iOS device is available, so physical Safari testing is deferred. The photographed-receipt cloud flow is now verified on Samsung. Current validation and remaining release limitations are recorded in [release validation](submission/VALIDATION.md).

Chrome also documents CPU inference. A dedicated GPU is optional when the CPU-path requirements are met. The service crash recorded below is an observation whose cause remains unproven. Treat the bypass flags as historical diagnostics. [Current Chrome requirements](https://developer.chrome.com/docs/ai/get-started)

## Android connection

Google Platform-Tools 37.0.3 was installed through winget from Google's verified archive on 15 November 2026. The Samsung phone was authorized in ADB. USB reverse forwarding from phone port 5173 to PC port 5173 was verified. The owner confirmed that Tuntas loaded in Chrome on the phone.

Start the dev server on the PC, then run the helper in PowerShell after reconnecting the phone.

```powershell
npm.cmd run dev -- --port 5173 --strictPort
# In a second terminal
./scripts/android-dev.ps1
```

Open `http://localhost:5173` in Chrome on the phone. Keep this origin to retain that phone's IndexedDB workspace. Use desktop Chrome's `chrome://inspect/#devices` to inspect the phone tab. Enable USB device discovery, unlock the phone and approve the debugging prompt on your trusted PC. The helper forwards the port over USB. It does not need a LAN listener or a firewall change. To remove the forwarding, run `./scripts/android-dev.ps1 -Disconnect`.

If the phone is absent, check USB debugging and try a data-capable cable. An unauthorized device needs approval on the phone. If several devices are attached, disconnect the others before using this helper. Windows reported an MTP media-transfer driver error during setup, while the ADB connection and web access worked.

## Firebase development configuration

The owner created **Tuntas Dev**, project ID `tuntas-dev`, on the Spark plan and accepted the Firebase project terms. The web client is **Tuntas Web Dev**. Its public Firebase web settings and a private App Check development token are in ignored `.env.local`.

The optional `TUNTAS_APP_CHECK_DEBUG_TOKEN` is loaded by Vite for the dev server. It is available to the browser only during development on a loopback hostname. Production builds omit this private token and require a real reCAPTCHA Enterprise site key. A debug token works only after it is registered under this web app in Firebase Console. Keep that token private, and revoke it from the console when the development machine should lose access.

Gemini Developer API activation completed. The owner registered the private token as **Tuntas local PC**. Firebase Console showed **Basic – Enforced** for Firebase AI Logic. The web app's production attestation provider is still unregistered, which is expected for this localhost debug setup.

A live test through Capture sent a fictional receipt with per-document cloud consent. The returned SDK source was **Firebase · cloud**, category **Purchases**, and total **USD 12.00** with a matching source excerpt. The original remained stored and the record appeared as filed in Library. [Live result screenshot](demo/firebase-cloud.jpg)

A subsequent physical-phone run (`SM-S928B`, Android 17, Chrome `157.0.8103.50`, `411x750` viewport) completed the full synthetic receipt journey (Scan cancel, corrupt PNG preview fallback recovery, manual filing under Purchases, Library search `notebook`, reload and original survival, plus pasted auto-filing, Undo and Action completion). [Mobile phone screenshot](demo/mobile-phone.png)

A live real-phone consented cloud test on the same Samsung `SM-S928B` (`Chrome 157.0.0.0`, `411x806`) submitted a fresh synthetic receipt (`Harbor Station Books`, `Order #HS-4082`, `USD 27.50`) through **Capture → Paste text → Firebase AI · prefer device, allow cloud** with the per-document consent checkbox ticked. It returned **Firebase · cloud**, category **Purchases**, and six facts with verbatim `Source:` excerpts, filing the retained original at `#/document/16be8143-b838-4fd2-ac22-6b0fca7f8c79`. [Mobile phone cloud screenshot](demo/mobile-phone-cloud.png)

On the Android phone (`LanguageModel` undefined), `Firebase AI · device only` refused silent cloud escalation, preserved the original in IndexedDB, and reported `"The on-device model is unavailable. Retry in supported Chrome or file manually."`. On desktop Windows Chrome `157.0.8103.52`:
- Playwright's default Chromium launch flags inject `--disable-component-update`, `--disable-features=...,OptimizationHints,...`, `--disable-field-trial-config`, and `--enable-unsafe-swiftshader`, holding `LanguageModel.availability()` at `"unavailable"`.
- Launching standalone `chrome.exe` with `--enable-features=OptimizationGuideOnDeviceModel:BypassPerfRequirement/true,PromptAPIForGeminiNano,PromptAPIForGeminiNanoMultimodalInput` moved `LanguageModel.availability()` from `"downloadable"` to `"available"` and downloaded `nano_v3_cpu_component` (`2025.8.21.1028`, `2,730.3 MiB` `weights.bin` into the isolated profile). However, `chrome://on-device-internals` reported `Enough VRAM: false (0 MiB actual, 3000 MiB required)` on this host's `Intel(R) Graphics` iGPU, and `LanguageModel.create()` failed with `InvalidStateError` because Chrome's `on_device_model` service disconnected unexpectedly (`reason: 0`, `Model crash count: 1 / 3`) on CPU load (`~1.33 GiB` free physical RAM of `15.4 GiB`). Sending a fresh synthetic receipt (`Northbay Office Supply`, `USD 31.80`) through **Capture → Paste text → Firebase AI · device only** preserved the original in IndexedDB, made zero cloud `generateContent` calls, and surfaced `"AI analysis did not finish with a usable result. Retry, choose local rules, or file manually."`.

For production App Check and Safari/WebKit checks:
- Building with `npm.cmd run build` produced 17 `dist/` files with zero occurrences of `TUNTAS_APP_CHECK_DEBUG_TOKEN`. Serving `dist/` via `vite preview` without `VITE_APP_CHECK_SITE_KEY` disabled the Firebase AI options in Capture (`Local filing rules · no AI` only), left `FIREBASE_APPCHECK_DEBUG_TOKEN` unset, and made zero external App Check/reCAPTCHA requests. Live reCAPTCHA Enterprise attestation still requires a registered `VITE_APP_CHECK_SITE_KEY` and deployment to an authorized domain.
- No Apple/iOS USB hardware is connected (`Get-PnpDevice` empty). Playwright **WebKit (iOS Safari engine)** `390x844` emulation caught an IndexedDB error (`Error preparing Blob/File data to be stored in object store`) in `src/db.js`, which was fixed by storing `{ bytes, type }` `ArrayBuffer` records with backward-compatible `Blob` reconstruction in `original()`. After the fix, the full WebKit `390x844` journey passed with zero cloud generation requests in `device only` mode; physical iOS Safari still requires an iPhone or iPad.

Add Firebase emulators when implementing Authentication, Firestore or Storage so ownership rules and failure handling can be tested locally. Current document storage uses IndexedDB.

The web on-device model requires supported desktop Chrome. The Android browser is suitable for camera/UI testing and consented cloud inference. For a live AI check, use a new synthetic input through Capture rather than the Home sample, which runs local rules. Check the response's source indicator before reporting device/cloud success.

Official setup guides are [Firebase hybrid web](https://firebase.google.com/docs/ai-logic/hybrid/web/get-started), [App Check local debug provider](https://firebase.google.com/docs/app-check/web/debug-provider) and [Android ADB](https://developer.android.com/tools/adb).
