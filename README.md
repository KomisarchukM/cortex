# CORTEX — Performance Laboratory

A serious-looking, deliberately excessive entertainment assessment. Thirty dimensions, twenty interactive task families, seeded adaptive testing, real performance telemetry, a secure operator console, and privately assigned prank results. Real measurements and displayed results stay separate. Final disclosure compares both.

**Sending this to a friend? Start with [docs/FRIEND_START_HERE.md](docs/FRIEND_START_HERE.md).** No application source edits are required. The tutorial covers local setup, preparing the prank, the three environment changes for Debian hosting, updates and backups.

![CORTEX workspace](docs/screenshots/workspace-desktop.png)

## Local setup

Supports Node 22.12 and newer; Node 24 LTS is recommended. npm is included. Run inside this `cortex` directory:

```bash
npm install
npm run admin:setup
npm run dev
```

The credential command creates `.env`, asks for an operator username and hidden password (12+ characters), stores a salted scrypt hash, and generates `SESSION_SECRET`. There is no committed or public default password. For a generated development password: `npm run admin:generate`; read the ignored `data/operator-credentials.txt`, store the password, then delete that file. This dedicated command avoids PowerShell/npm argument-forwarding issues. Manual setup removes any old generated credential file. The development server reloads `.env` changes; restart/recreate production after credential changes.

- Participant workspace: **http://localhost:3000**
- Operator console: **http://localhost:3000/admin**
- Resume: **http://localhost:3000/assessment**
- Report: **http://localhost:3000/results**
- Disclosure: **http://localhost:3000/reveal**

SQLite creates `data/cortex.db` automatically. Completed responses persist across restarts. Keep the same browser/cookies and origin to resume. `npm run demo` creates a held sample session, a disaster profile and a demo invite. `npm run db:migrate` applies migrations; `npm run db:reset` asks for `RESET CORTEX` before erasing all data. Stop the app before resetting or backing up local data.

## Assessments

Choose **English** or **Українська** with the **Language / Мова тесту** selector before starting. Ukrainian covers onboarding, instructions, all generated question variants/choices, memory words, typing passages, reports and disclosure. The selected language is saved in the session and restored after pause/reload, so changing the browser preference cannot change an active test. Existing sessions default to English. The operator console stays in English; administrator-authored custom result text is shown as entered. Ukrainian typing accepts ordinary keyboard apostrophes and canonically equivalent Unicode.

| Mode                      | Estimated duration | Dimensions                           |
| ------------------------- | ------------------ | ------------------------------------ |
| Quick Diagnostic          | ~10 min            | 7 core dimensions                    |
| Standard Assessment       | ~30 min            | All 30                               |
| Comprehensive Assessment  | ~60 min            | All 30, two passes                   |
| Extended Research Battery | ~90–120 min        | All 30, three passes                 |
| Custom                    | Variable           | Chosen modules and 1–100 trials each |

These are **estimates**, not enforced time limits. Participant speed and breaks affect duration. Live estimates use actual throughput; break recommendations appear after about 15 minutes of active work. You can pause without fullscreen restrictions. Every accepted response autosaves. Unsubmitted timed trials restart when resumed; text/selection drafts are local to that browser. Failed network submissions are retained and retried without advancing twice.

The battery includes reaction with random delays, visual/choice/tone cues and no-go trials; grids; forward/reverse/updating/symbol/spatial spans; sequence playback; word recognition/delay/recall; streaming target detection and dense search; Stroop; symbol coding; original logic/numerical/language questions; visual matrices and rotations; route reasoning; uncertain decisions; rule switching and adaptation; multitasking gauge/alert/arithmetic; quantity/angle/percentage estimation; interval reproduction; aiming/path/checkpoint/marker/drag precision; typing; structured error detection; hidden-rule induction; consistency, confidence, retention, distractors and longitudinal telemetry.

Most items are procedural. Language uses thirty original prompts and ordinary vocabulary. The server uses a versioned registry and seeded generator; the same seed, plan, trial and difficulty reproduce the same challenge. The admin detail exposes seed and difficulty trajectory. `shared/modules.ts` defines identity, category, family, instructions, budgets, adaptation and plan construction. `server/generators.ts` owns answers; `server/scoring.ts` grades them; client task renderers never import those server files. Completion is the plan’s accepted response count.

Raw task accuracy, median latency, variance, false starts, span, switch cost, precision, confidence calibration, typing speed/corrections, consistency and change-over-time are internal entertainment metrics. The CORTEX Index ranges 0–1000. Decision consistency records preferences across equivalent expected-value conditions; it is not a personality assessment. Mixed task difficulty can affect timing/accuracy trends. Zero means unmeasured or zero observed performance, not a clinical deficit. Percentiles and reference ranges are fictional.

## Operator guide

1. Log in at `/admin` using the credentials from setup.
2. **Result Profiles → Create profile**. Give it a name. Choose Real, Manual, Preset or Scripted mode.
3. Load **Absolute Disaster** for a terrible starting result (70/1000 = 7/100, 0.4th fictional percentile). Other templates: Suspiciously Average, Impossible Genius and Chaotic. Edit every category, scalar, label, recommendation, strengths and weaknesses. Advanced JSON supports chart timeline/distribution values. Custom profiles function as reusable editable presets.
4. Set **Hold for operator review** and the desired reveal mode. Save.
5. **Invite Links**: select the profile, configure expiry/uses and generate. Copy the unique URL immediately. Its plaintext token is not recoverable; only a keyed hash is stored. The profile snapshot attaches privately when the participant starts. No profile details are returned before result release.
6. **Sessions / Active Sessions**: search an alias and open its session. Progress, recent answers, real metrics and difficulty update every five seconds. No surveillance is used.
7. **Configure displayed result** changes a particular session. Profile edits affect only future starts. Genuine responses/metrics are preserved.
8. After completion, click **Release results**. A held participant page checks automatically every five seconds. Released overrides can still be edited.
9. Click **Trigger prank reveal**, or choose immediate/delayed release disclosure. Manual/temporarily disabled disclosure has a 24-hour fallback so participants are eventually informed.
10. The participant’s `/reveal` compares real and displayed values. Genuine scores also remain available in admin details. Audit actions appear in **System Status**.

## Architecture and stack

React 19, TypeScript, Vite, Express 5, Node crypto, Zod, Helmet, built-in Node SQLite and the `pg` PostgreSQL driver. One server, one database. Hand-built SVG charts and instrument controls; no heavy chart or animation libraries. Fonts are bundled and served locally. There are no external runtime analytics, image, font or data requests.

The UI uses graphite, warm ivory and pine; Manrope plus IBM Plex Mono; thin borders; restrained animation; accessible labels, visible focus, modal focus management, keyboard/pointer controls and reduced-motion support. Desktop is primary; tablet and mobile reflow. Motor tasks offer arrow/Enter and tap alternatives. Sound requires a user-triggered calibration and has a visual/muted alternative.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/ASSESSMENT_ENGINE.md](docs/ASSESSMENT_ENGINE.md).

```text
src/pages/                 workspace, participant console, report/reveal, admin
src/components/tests/      task instruments and timers
src/components/admin/      result profile editor
shared/                    public contracts and module registry
server/                    API, auth, generators, scoring, database adapters
database/                  versioned SQL migrations
tests/                     unit, integration and browser workflows
scripts/                   credentials, demo/reset, build, deployment and recovery
deploy/                    Nginx example
docs/                      tutorial, deployment, architecture and verification
```

## Database

`DATABASE_URL=sqlite:./data/cortex.db` locally. For a standalone PostgreSQL process use `postgres://USER:PASSWORD@HOST:5432/DB`. Production Compose sets this automatically. SQL is parameterized; session updates lock rows in PostgreSQL and serialize transactions in SQLite. Unpredictable public IDs are separate from hashed bearer cookies. Indexed sessions/responses/profiles/invites/auth/audit tables store JSON records without unnecessary participant identity. Responses and real metrics are not overwritten by prank values. The registry is versioned in code rather than duplicated in a separate modules table. One operator account is configured through env rather than a password table.

## Docker and Debian

```bash
docker compose up --build -d
docker compose logs --tail=100 app
docker compose down
```

Configure admin credentials first; stop the normal dev server on 3000. Local Compose serves the production bundle over loopback HTTP with SQLite and explicit local-only cookie settings. The volume persists after `down`; `down -v` erases it.

For AWS Debian, follow [docs/AWS_DEBIAN_DEPLOYMENT.md](docs/AWS_DEBIAN_DEPLOYMENT.md). `docker-compose.prod.yml` runs PostgreSQL and the app, with Nginx/Certbot on the host, health checks, non-root app execution, restart policies and an unexposed database. `scripts/setup-debian.sh`, `deploy.sh`, `backup.sh`, `restore.sh` and `create-admin.sh` provide safe helpers. Restores/reset require explicit destructive confirmation. Both ZIP and Git deployment are supported.

## Checks

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm start
```

Run `npm run format` to format. E2E uses installed Chrome on Windows; Linux uses Playwright Chromium (`npx playwright install --with-deps chromium` on your CI/test machine). Set `BROWSER_CHANNEL=msedge` if you prefer installed Edge. Tests start an isolated development app on port 3101 with test-only credentials and `data/e2e.db`; they never use the real `.env` credentials. API tests use an isolated in-memory SQLite DB. Set `TEST_DATABASE_URL` to a dedicated PostgreSQL test database for the same integration suite; never point it at production. CI provides a disposable PostgreSQL service.

Production `npm start` serves the built bundle. Set `NODE_ENV=production` and HTTPS `APP_ORIGIN`; for local production QA only, set `ALLOW_INSECURE_LOCAL=1` with `http://localhost:3000` (the bypass rejects public HTTP hosts). See [docs/VERIFICATION.md](docs/VERIFICATION.md) for checks actually performed and remaining environment limitations.

## Security and privacy

- Environment-only operator hash/session secret; salted asynchronous scrypt; database-backed eight-hour admin auth and 30-day participant cookies.
- Separate roles; admin API authentication, synchronizer CSRF tokens, strict origin checks, bounded input validation, persistent five-attempt/15-minute login throttling.
- 256-bit cryptographic tokens, hashed at rest; expiring/use-limited invites; no passwords in URLs.
- HTTPS/Secure cookies in public production; HttpOnly and SameSite=Strict always; CSP and security headers; React escapes alias/text output.
- No camera, microphone, location, fingerprinting, external analytics, unrelated browser inspection or keystroke recording. Only displayed typing-test input is stored.
- Optional focus-loss count only while assessing; no tab blocking or involuntary fullscreen. No clinical, employment, IQ or population validity is claimed.
- Raw data stays in your database until you erase it. Back up securely. Clearing participant cookies removes their access; aliases are not recovery passwords.
- One trusted proxy only. Keep application binding on loopback; Nginx overwrites forwarded headers. Do not horizontally scale independent SQLite copies.

## Troubleshooting

**Missing SESSION_SECRET / login unavailable:** run `npm run admin:setup`. **Bad password:** use `npm run admin:generate` for a fresh local login and read the newly written credential file. Do not use an old generated password after manual setup. Development reloads automatically; restart/recreate production. A password reset also resets the corresponding login throttle. **Port conflict:** stop the old CORTEX process before starting another, or change `PORT` and `APP_ORIGIN` together. Startup now exits with a clear error instead of claiming the occupied port is listening. **Invite already used:** issue another. **No results:** finish and release the session. **Lost progress:** same browser, cookies and origin are required. **Sound blocked:** use the sound-check button or mute. **Node 22.12 SQLite warning:** expected; npm scripts enable `--experimental-sqlite` automatically. For direct execution use `node --experimental-sqlite --import tsx server/index.ts`.

Skills used: `frontend-design` for visual composition and browser QA, `ui-ux-pro-max` for dense analytics/accessibility/React guidance, and `ponytail` for a compact complete architecture. Sites capabilities were inspected; the requested Node/PostgreSQL Debian target is delivered as a local application and deployment package rather than a Workers-hosted site.
