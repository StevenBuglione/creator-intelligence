# ADR 0002: local storage and operational scope

Date: 2026-10-16. Status: implemented.

The P0/P1 release uses typed JSONB entities and immutable observations in
PostgreSQL, accessed with Drizzle parameterized queries. Zod schemas validate
drafts and provider adapters validate reports. Dedicated relational tables hold
users, sessions, OAuth state/connections, quota reservations, approvals, deliveries
and audit events. This keeps the selected vertical slice compact while retaining
owner IDs, versions, unique keys, expiry and transactional invariants. It differs
from the handoff's larger per-feature table inventory; future modules can migrate
entities without changing the public service contract.

API, MCP and worker use the same Application service and typed client. Database
advisory locks serialize owner mutations, deletion, provider refresh and delivery
checks across processes. A persisted outbox keeps the exact approved payload and
idempotency key. Queue schedules have stable names, so restarts upsert rather than
duplicate schedules. The worker has only its narrow API token, not Google tokens.

Provider data is never included in draft backups. Daily encrypted backups contain
original drafts, manually selected links and watchlist preferences, authenticate
the saved file from disk, retain seven days by default, and are removed by Delete
My Data. An integration test performs an actual restore into an empty test owner.
Credentials and keys need a separate operator-controlled recovery plan. Restored
workspaces reconnect Google and recollect allowed data instead of restoring caches
that might have expired or been revoked.

Migration 1 is additive and checksum verified under a database lock. For a failed
upgrade, stop app/worker/MCP, preserve the database volume, return to the last
working image and diagnose before further writes. No automatic destructive down
migration is provided. Recover original drafts into a fresh database from the
encrypted backup when a forward migration cannot be repaired. Do not downgrade a
database after future incompatible migrations without that migration's plan.

PostgreSQL and Redis contain private local data and bind only to loopback on the
host. Windows credential ACLs and non-root app containers reduce accidental
exposure; the host owner and Docker administrators remain trusted. Remote hosting
and multi-user administration are outside this release. No paid hosted service
is needed to run it.
