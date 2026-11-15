# Workspace management tools

Implemented with the shared dashboard shell, cards, fields, selects and dialogs.

- [x] Leads: duplicate contact warning before save. Existing ownership and daily follow-ups remain available.
- [x] Renewals: payment ledger with idempotent receipt recording and administrator void corrections. Existing expiry alerts and renewal history remain available. A renewal with receipts cannot be deleted.
- [x] Website: desktop/mobile private draft previews in page, blog and project editors; published-content link checks on Website overview.
- [x] Search: command-palette record search for leads, renewals, clients and content, scoped by server permissions and assigned brands.
- [x] Notifications: category push preferences in Account → Notifications, linked from the notification bell. Security alerts remain enabled; inbox updates remain available. Unread counts include records beyond the displayed page.
- [x] Backups: System health → Restore drill imports into a temporary isolated database, checks manifest table/row counts and removes it. Results persist across refreshes.
- [x] Access: Users → Access by role exposes the server permission matrix. Navigation adopts refreshed server roles instead of retaining stale token permissions.

## Restore configuration

A server administrator must provide `BACKUP_TEST_DB_HOST` and `BACKUP_TEST_DB_USER`, optionally `BACKUP_TEST_DB_PORT` (default 3306) and `BACKUP_TEST_DB_PASSWORD`, using server configuration. The application database credentials are not a restore target. Use a dedicated MySQL user restricted to CREATE/DROP and table operations on the reserved `finvera_restore_test_%` database prefix. Do not grant access to the application database.

Without this connection the dashboard displays a configuration explanation and disables the drill. Archive verification still works. Production test credentials are not configured by this change.

Drills accept archives up to 32 MB compressed / 64 MB expanded and a bounded subset of the application's SQL dump format. The worker has a 90-second execution budget; the persistent lease expires after 180 seconds. A process termination may prevent cleanup; administrators should inspect and remove abandoned databases under the reserved test prefix after checking no drill is active. A cleanup failure reports the temporary database name. This verifies database backup restoration; uploaded media and a full disaster-recovery exercise require separate procedures.

## Verification

Unit tests cover normalized duplicate detection, receipt validation, category defaults/security, public-network link checking, SQL statement restrictions and cleanup after failed restoration. Frontend tests check server/client permission parity and role revocation.

`Backendjs/tests/integration/workspace-tools.cjs` requires an explicitly disposable local MySQL database. It refuses other hosts, normal ports and database names without the fixture prefix. Run with `FINVERA_WORKSPACE_TESTS=1 DB_HOST=127.0.0.1 DB_PORT=<disposable-port> DB_NAME=finvera_workspace_test DB_USER=root DB_PASSWORD='' JWT_SECRET=<fixture-value> NODE_ENV=test BACKUP_DIR=<fixture-backup-directory> node Backendjs/tests/integration/workspace-tools.cjs`.

The integration suite checks authenticated HTTP routes, role boundaries, assigned-brand search, duplicate matching, idempotent payments, ledger retention, preference preservation and complete unread counts. It creates a real backup and restores it with a restricted test user, checks row contents/counts, and verifies database cleanup. All records are generated fixtures; notification delivery is not exercised.

Payment entries record receipts in whole INR and do not transfer funds, change renewal dates or automatically mark invoices paid. Link checks use HEAD requests, cap scans at 30 URLs and may require manual review for sites that block automated checks. Private/action links are skipped. Search returns bounded results rather than exporting entire collections.
