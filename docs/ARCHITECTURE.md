# CORTEX architecture

React + TypeScript + Vite; one Express process serves the API and the production bundle. The development process embeds Vite middleware. Node 24 LTS includes SQLite; PostgreSQL uses the same parameterized SQL repository. No native build dependencies or third-party telemetry.

The module registry describes 30 dimensions. Seeded generators run only on the server. A challenge DTO excludes its answer; response scoring and adaptation run on the server. A session stores a versioned plan and current difficulty. Each response is uniquely indexed by session/trial and atomically advances progress; retrying an acknowledged response is idempotent. Pausing discards only the unsubmitted timed trial. Every accepted response persists immediately; local drafts recover text and selection after reload. No profile configuration is included in participant DTOs.

Raw responses, calculated metrics, override configuration and released snapshots are separate records. Invite assignments snapshot a profile at session creation. Profile changes affect future sessions; an admin can explicitly change an existing session. Participants authenticate by a HttpOnly random cookie. Admins have a separate eight-hour cookie, scrypt password verification, origin checks, synchronizer CSRF tokens, and login throttling. Database-stored auth sessions make restart/revocation work. All IDs and invite secrets use crypto.randomBytes; token hashes use a keyed HMAC. Credentials are environment-only.

Defaults: manual result hold, eventual reveal within 24 hours of release. Admin reveal may happen sooner. Fictional percentiles are explicitly entertainment benchmarks. Browser timings are approximate and unvalidated. Decision preferences have consistency scores, not objectively correct personality answers. Actual durations depend on participant speed; estimates derive from task budgets and live throughput.

Design: an instrument console with warm ivory paper, dark graphite rail, muted pine accent, sharp hairline borders, Manrope typography and IBM Plex Mono measurements. Spacing 4/8/12/16/24/32/48; radii 3/6px. SVG charts carry readable scales and adjacent tables. Motion is limited to stimuli and result arrival; reduced motion is respected. No external font or analytics requests.

Production: Nginx terminates HTTPS; a loopback-only containerized application talks to an unexposed PostgreSQL container. Database migrations run on startup. Backups use pg_dump; releases use commit-tagged local images. This repository does not configure AWS accounts.
