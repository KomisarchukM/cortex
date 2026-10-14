# Verification record

## Ukrainian and startup/login regression fixes — 14 October 2026

The application now supports Node 22.12 directly through the npm startup/test/database scripts. Actual `npm run dev` was exercised on the installed Node 22.12.0. The SQLite flag is passed to the application child process, and `.env` changes restart the dev server. A stale compiled server on port 3000 was identified and replaced; startup now reports an occupied port and exits instead of printing a false success. Fresh generated credentials were verified against the real local admin UI without exposing the password in logs.

An actual `.env` modification-time change was verified to replace the development application process and restore a healthy endpoint; the same generated credentials still logged in through Chrome after reload.

Ukrainian is saved in the participant session and defaults to English for older records. A localization regression enumerates all 30 dimensions × 3 difficulties × 30 rounds (2,700 variants), verifies repeatability, distinct translated choices, language coverage and scoring. It also checks every module/mode, participant UI translation calls, canonical Ukrainian text and keyboard apostrophes. Existing English/API/security tests remain in the suite. Cyrillic fonts are self-hosted. Ukrainian desktop/mobile screenshots are included with the final verification artifacts; no body overflow was observed in the workspace.

The admin console and arbitrary custom administrator-authored text remain in the administrator’s chosen language (English console; custom text as entered). No external translation service is used. No participant data, profiles, responses or session secret were reset when fixing admin credentials.

Final regression results: **17 unit/API/security/localization tests and 7 Chrome E2E journeys passed on Node 22.12.0**. The browser suite completes all 30 dimensions in both English and Ukrainian, verifies Ukrainian preparation/session creation/disclosure, confirms language persistence after pause/reload, and repeats the operator profile/invite/override/release/reveal workflow. TypeScript, ESLint and formatting checks passed. The same 17 non-browser tests also passed on Node 24.19.0.

The production bundle was exercised on Node 22.12.0 with the actual generated local admin credentials. Ukrainian Stroop choices, the longest color label on mobile, typing accuracy (100%), results and disclosure passed, with no browser errors or unexpected external requests. The Ukrainian screenshots in `docs/qa/` record that check. Updated minified chunks are approximately 254 kB for the main application, 57 kB for Ukrainian content, and 28 kB for assessment instruments.

Verified locally on Windows on 14 October 2026, using the bundled Node 24.19.0 runtime and installed Chrome. The application is entertainment software, not a validated cognitive instrument.

## Checks performed

- Dependency installation completed; locked versions recorded in `package-lock.json`.
- Prettier formatting and final format check passed.
- ESLint and TypeScript strict checking passed.
- 13 unit/API/security tests passed. Coverage includes seeded generation (all 30 dimensions × 8 difficulties × 12 rounds), discrete/partial/error scoring, empty metrics, adaptive boundaries, hash/token validation, autosave/pause/resume, concurrent idempotent submissions, profile assignment, expiring/use-limited invite rejection, held/released results, overrides, reveal, admin auth, CSRF/origin enforcement, production cookie flags/headers, password rotation and persistent rate limits.
- Five Chrome E2E journeys passed: all 30 dimensions in a shortened battery; matrix/word-recall/streaming/drag variants; the complete profile→invite→resume→override→release→reveal workflow; direct reaction/memory/spatial/typing/interval inputs; desktop/tablet/mobile layout checks. A later focus/navigation refinement passed the three workflow/input/layout journeys again.
- Compiled the production frontend and Node backend, started the compiled app locally, and used Chrome on the actual production bundle. Visited workspace, protocol, admin login/dashboard, session detail, assessment, results and disclosure. Checked desktop (1440) and mobile (390); the development layout suite also covers tablet (768). No browser console errors, runtime exceptions, unexpected external network requests or body overflow in the checked production journey. Evidence is in `docs/qa/`.
- A dedicated visual pass inspected screenshots of workspace, admin dashboard, report/disclosure and mobile layouts. Refined modal/trial focus, keyboard motor controls, meaningful chart labels, responsive table containment and an angle graphic that could clip.
- Production dependency audit (`npm audit --omit=dev`) reported **0 known vulnerabilities** at verification time. This is not a guarantee against future advisories.

## Performance findings

An initial build accidentally inherited development `NODE_ENV` from `.env`. A portable build helper now forces production compilation. Initial JavaScript fell from 486.78 kB to about 248 kB minified (about 79 kB gzip). The current initial stylesheet is about 48 kB (11 kB gzip); admin and assessment are separate lazy chunks around 22/27 kB (6/8 kB gzip), with a separate report/chart chunk. No heavyweight chart/animation dependency is used.

The production smoke measured roughly 338 kB of initial resource transfer on the local server without Nginx compression and 214 DOM nodes. Exact timings depend on local hardware/cache and are not a published performance guarantee. Reverse-proxy gzip is configured in the Nginx example. Static assets are cached. Source fonts are self-hosted; small fonts are emitted as files so the strict CSP does not block inlined font data. Completed answer handling reads only the latest three response records for adaptation; the full response set is used for final scores/live detail, not every progress update. Live admin/report polling is every five seconds rather than on every frame.

## Security review

Confirmed separate admin/participant auth, keyed token hashes, 256-bit invite/session secrets, participant-only access, admin synchronizer CSRF tokens and origin checks, bounded server input, parameterized SQL, escaped React output, production Secure/HttpOnly/SameSite cookies, CSP/security headers, no profile leakage before release, and real scores retained through overrides. Credential changes invalidate existing admin cookies. Reveal configurations can change after release, but final disclosure cannot be hidden again and has a 24-hour deadline. Secrets/databases are excluded from Git and the delivery ZIP.

The tests intentionally use dummy credentials. Local development credentials were generated into ignored `.env` / `data/operator-credentials.txt`; these are not delivered to the friend. Only displayed test inputs and optional assessment focus-loss counts are recorded. Browser-only measurement data can be fabricated by a determined participant; this is deliberately light anti-cheat entertainment.

## Not exercised in this environment

- Docker builds/Compose startup, Debian package installation, Nginx/Certbot, PostgreSQL execution, real certificate issuance, remote AWS access and PostgreSQL backup/restore were **not run locally**: this Windows environment has no Docker/PostgreSQL server and no supplied Debian host. Docker files, parameterized PostgreSQL adapter/row locks, health checks and deployment/recovery helpers are supplied; CI includes disposable PostgreSQL tests and a Docker build when installed at the repository root. Review and run that CI/deployment dry run before Internet hosting.
- No full 90–120-minute human endurance session was performed. Shortened browser batteries exercised every dimension and selected variants; deterministic unit tests exercised all generated variants/difficulties. Published durations are task-budget estimates and depend on speed and breaks.
- No external accessibility audit or clinical validation is claimed. Keyboard/focus/responsive behavior and readable chart alternatives were checked in the implemented flows.
- Headroom tools were discovered and called, but their configured optional compression proxy was unreachable. Focused source/log reads were used; compression is on demand, not automatic application traffic processing.

The user requested a friend tutorial/deployment handoff instead of an actual AWS deployment. [FRIEND_START_HERE.md](FRIEND_START_HERE.md) gives the minimum-change route; [AWS_DEBIAN_DEPLOYMENT.md](AWS_DEBIAN_DEPLOYMENT.md) covers full server operations.
