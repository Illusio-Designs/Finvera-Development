# Project flow and backend review — 15 November 2026

This review covered account/session/reset flows, role and brand boundaries, uploads, public content rendering, API failures, workspace tools, dependency advisories and the release pipeline. It is a bounded review with reproducible checks, not a guarantee that every possible defect has been found.

## Fixed

| Area | Reproduced problem | Change |
| --- | --- | --- |
| Two-step login | Tickets remained usable after password changes; disabling 2FA bypassed the pending step. Replay protection was process-local, and concurrent backup-code use could race. | Tickets bind to current credentials and require a stored single-use claim. Proof claims are unique in MySQL across workers. User-row locks serialize ticket/backup consumption. Session creation rechecks credentials under a transaction. |
| Password reset | A failed password save permanently consumed the link. Concurrent link issuance was not serialized. | Password, token consumption and session revocation commit together. User locks serialize issuance/reset; successful resets invalidate other reset/invite links. |
| Private settings | Any signed-in role could retrieve non-public, non-system settings. | The flat endpoint returns private settings only to callers with settings-area access. System settings remain hidden. |
| Uploads | Substring extension matching accepted unsupported extensions; timestamp filenames could collide under concurrent uploads. | Exact extension/MIME pairs, client-facing 400 errors and random UUID filenames. |
| API error handling | HTML gateway responses caused JSON parser errors; a late 401 could clear a newer login. | Recoverable status-bearing errors, no raw HTML in messages, and token-aware session expiry handling. |
| Public rich text | Saved HTML could include executable markup on blog/project/custom pages. | Shared HTML sanitizer at every saved-content rendering boundary; formatting, images, tables and safe links retained. |
| Backend failures | Production 500 messages could expose SQL/internal details; invalid error statuses could break the handler. Rejected CORS origins were reported as 500s. | Generic production 5xx responses, validated status codes and explicit CORS 403 responses. |
| Link audit | DNS resolution could hang; nested gallery/social URLs were skipped. | Finite DNS and HTTP deadlines, abort signals, recursive URL extraction and deduplicated sources. |
| Public rendering | Backend fetches could outlast static-render budgets during outages. | Eight-second request deadlines with existing empty-data fallback behavior retained. |
| Dependencies | Critical advisories in the original frontend/backend dependency trees. | Patched Next.js 15, aligned TipTap packages, patched frontend transitive dependencies and compatible backend updates. |

2FA claims reuse the existing `auth_tokens` table with separate, purpose-prefixed hashes. Email reset/invite lookups explicitly reject other token kinds. Existing cleanup removes expired authentication rows. A deployment invalidates pending five-minute tickets; users can restart sign-in.

## Verification

- Backend and frontend unit suites plus TypeScript checks.
- `Backendjs/tests/integration/project-audit.cjs`: disposable MySQL HTTP integration, with stubbed mail delivery; tests stale tickets, concurrent backup/TOTP reuse, shared proof claims, failed-reset rollback, concurrent reset, session revocation, upload validation/collisions, settings boundaries and CORS failures.
- Desktop/mobile dashboard browser checks using mocked API fixtures; editor, search, payment and preference interactions checked separately.
- Production build/CI and deployment status recorded in the release PRs.

The integration script refuses to run unless `FINVERA_AUDIT_TESTS=1`, `DB_HOST=127.0.0.1`, `DB_NAME=finvera_audit_test` and a nonstandard `DB_PORT` are set. It recreates only that explicitly disposable schema. Do not use production credentials or data.

## Remaining work and limits

- The frontend dependency audit reports zero known advisories at review time. The backend dependency audit has no critical advisories, but still reports high advisories for Nodemailer and Sharp, plus moderate Sequelize/UUID advisories. Nodemailer 10 and Sharp 0.35 upgrades require a separate compatibility stage (SMTP delivery, image processing and server Node version); this patch does not silently upgrade these major versions or downgrade Sequelize as suggested by the audit tool.
- The FTP deployment now includes the dependency lockfile for reproducible installation. It copies source and restarts Passenger; it does **not** run NPM on the hosting server. Compatible backend dependency updates in the manifests/lockfile are verified locally and in CI. A server administrator must install the updated backend dependencies in cPanel (or run `npm ci` with the committed lockfile), then restart the app. Repository audit results do not certify the server's installed packages.
- Dedicated production restore-test credentials are still required for the previously added backup restore drill. Database dumps do not replace a tested media/offsite/full recovery procedure.
- Live Meta publishing, cross-business Meta permissions and real SMTP delivery were not exercised against customer accounts. Those require configured provider accounts and a controlled staging exercise.
- Existing public-site fallbacks can show reduced content during backend outages. Deadlines bound the wait; they do not provide an independent offline content store.
