# Release preparation validation — 15 November 2026

## Changes

Prepared Devpost copy, judging instructions, a timed video script, hosting configuration and a source-packaging command. Recorded the Devpost/Discord model clarification in provenance. These are local preparations; no remote repository, deployment, video upload or submission was created.

Broader WebKit testing initially returned 11 passes and three timeouts. The image failures showed Home remaining visible after early hash navigation to Capture. The route listener now reconciles the current location immediately after subscribing. Image tests also compare exact original bytes and MIME after reload. The retained WebKit command uses one worker on this laptop.

## Observed checks

| Command / check | Result |
|---|---|
| `npm.cmd test` | 14 passed, 0 failed. |
| Initial `npm.cmd run test:e2e -- --reporter=line` | 14 passed in 31.6 seconds, before the route fix and stronger byte assertions. |
| `node node_modules/@playwright/test/cli.js test --browser=webkit --reporter=line --workers=1` | 14 passed in 1.7 minutes after the fix, including byte/MIME retention, mobile recovery and accessibility checks. |
| `node node_modules/@playwright/test/cli.js test --reporter=line` | Final Chromium run: 14 passed in 1.1 minutes, including the strengthened image assertions. |
| `node node_modules/vite/bin/vite.js build` | Production build passed after the route fix. |
| Allowlisted source snapshot, `npm.cmd ci --no-audit --no-fund` | Fresh installation succeeded: 168 packages. npm reported deprecated OpenTelemetry packages and two dependency install scripts not approved by the installed npm policy; installation still completed. No approval policy was changed. |
| Fresh snapshot build, `node node_modules/vite/bin/vite.js build` | Passed without `.env.local`; final route fix and package scripts were copied into this installed preflight snapshot before a second successful build. The final packaged snapshot is regenerated separately with fresh file hashes. |
| Source/production credential check | Initial source snapshot passed patterns and exact private-token comparison; 17 production files checked. Regenerate final report with `npm run release:prepare`. |

Existing non-failing warnings: Lucide client directives in Vite, PDF.js standard-font warning for the generated test fixture, and terminal color environment warnings. These runs do not establish dependency-audit status.

Live cloud and desktop local inference were verified earlier on this date, as recorded in [verification](../VERIFICATION.md); they were not rerun for this packaging pass. Physical iOS remains untested. Automated WebKit is engine coverage, not a physical Safari claim. Production App Check attestation and live judge access remain pending approved domain/provider setup.

The credential scanner is bounded and is not a general security certification. Source hashes identify package contents, not code authorship dates. No private receipts or raw extracted results are included.
