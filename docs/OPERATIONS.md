# Install and operate

This is a single-owner, self-hosted release candidate. The maintained setup helpers use
PowerShell 7 on Windows. Containerized app services run Linux; automated macOS/Linux host
onboarding has not been verified. Node 24.19.x and pnpm 11.25.0 are required for development
and the stdio launcher. Docker Compose runs six services.

## Your Google project

1. Create a dedicated Google Cloud project for this API client. Enable YouTube Data API v3,
   YouTube Analytics API and YouTube Reporting API. Record your project number and channel ID.
2. Create a server-side API key restricted to YouTube Data API v3. The optional helper
   `scripts/provision-public-api-key.ps1 -Project YOUR_PROJECT_ID` creates or reuses a named
   service-restricted key and stores it using Windows current-user DPAPI. Run it only after
   signing in to your own project with gcloud. Review application restrictions for your host.
3. Create an OAuth Web application client. Request only `youtube.readonly` and
   `yt-analytics.readonly`. Use the callback `http://localhost:4311/api/v1/auth/google/callback`.
4. Save the downloaded client JSON as `%USERPROFILE%/.creator-intelligence/secrets/google-client.json`.
   Never put it in Git, a screenshot, a prompt or the public website.
5. Follow the README quick start. Sign in locally and review the versioned privacy policy and
   terms. MCP sharing is optional and disabled until explicitly selected. Then open Settings
   and connect your own channel.
   The authorized channel ID must match `OWNED_CHANNEL_ID`; its display title may change.
   Missing/broad scopes, wrong channels, expired state and callback replay are rejected.
6. Run `./scripts/with-local-env.ps1 pnpm test:integration:google` only when you want live
   API checks. Optional `VERIFY_VIDEO_ID` selects one additional public-video probe.

Owner consent is a human action. OAuth verification, quota increases and additional-metric
approval are separate. Each installation supplies its own identity, credentials and consent.
Do not pool projects or rotate keys to evade quotas. Consult current [Google guidance](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
and [YouTube policy](https://developers.google.com/youtube/terms/developer-policies).
The audit form is https://support.google.com/youtube/contact/yt_api_form .
No approval is supplied with this source release; governed metrics are unimplemented and disabled.

## Credentials and services

`init-local.ps1` generates random secrets outside Git and preserves an existing environment.
It restricts Windows ACLs to the current user and SYSTEM. `with-local-env.ps1` loads that
environment and decrypts an optional DPAPI API key only into the child process. Node must
already be on PATH. Google refresh tokens are encrypted in PostgreSQL with AES-256-GCM.
Keep the encryption key with your private recovery material.

UI: localhost:4310; API: localhost:4311; MCP HTTP: localhost:4312/mcp;
PostgreSQL: localhost:6437; Redis: localhost:6438. All host bindings are loopback.
Do not expose the stack publicly without a separate security and multi-user review.
Avoid printing resolved Compose configuration: it contains secrets. Docker administrators
and the host owner can inspect container environments and must be trusted.

## Claude and other clients

Use one authenticated MCP connection. The README has a Claude Code registration example;
other clients use the same stdio launcher or bearer-authenticated Streamable HTTP endpoint.
Confirm an actual initialize/tools/list/status call; configuration alone does not prove access.
Managed clients may require administrator allowlisting. Never bypass their policy.
The current MCP reads stored observations and edits explicitly authorized drafts. It cannot
initiate Google API collection, refresh Google tokens, or invoke Google MCP tools. The Google
OAuth client belongs to the direct backend integration, not the downstream MCP client.
Before adding an agent-driven Google OAuth workflow, review Google's [agent client isolation guidance](https://support.google.com/cloud/answer/15549257#agentic-client)
and provision a separate designated agent client where required.
Google credentials are not returned by MCP tools. Requested records do leave your device if
your connected AI client sends them to a provider. Verify its data-handling settings.

In Settings, authorize the exact JSON for one Claude draft before calling `creator_idea_save`
or `creator_blueprint_save`. The one-use authorization is bound to content/session and expires
after 15 minutes. Review the saved blueprint and export its current revision as local JSON.

## Standalone blueprint export

The UI's Export blueprint JSON button downloads the selected saved revision. The
`creator_blueprint_export` MCP tool returns the same schema: `creator_intelligence.blueprint.v1`,
blueprint ID, revision, export time, original blueprint and provenance. A stale revision is
rejected so the exported content always matches the requested version. There is no receiver,
outbound delivery queue, external production adapter or publishing integration.

## Tests and recovery

`pnpm verify` requires PostgreSQL and uses `creator_intelligence_test` with unique fixture
owners, plus `creator_intelligence_demo` on ports 4410/4411 for browser tests. Demo setup resets
only the disposable demo owner. Chrome is used on Windows; install Playwright Chromium on Linux.
The default suite uses fake providers. Tests must never be pointed at someone else's data.

The worker syncs every six hours, purges hourly and backs up original drafts daily.
Collection and backups require current policy agreement. Startup removes retired schedules
and rejects obsolete queued operations without executing them.
Owner report caches expire within 30 days unless refreshed, as well as being removed on
disconnect. Backups exclude API caches, Google tokens and private analytics.
Managed encrypted backups normally expire after seven days and are removed by Delete My Data.
Manual exports remain the operator's responsibility. Restore requires the same owner/key and
an empty workspace; `scripts/backup.ts restore` uses a separate restore database.

Local Disconnect removes this app's connection and owner reports but does not invoke Google's
revocation endpoint. A separate typed-confirmation control or Google Account permissions can
revoke the project grant. If you share a project, that can affect its other clients too.

Use `docker compose stop` for a reversible shutdown. Preserve database volumes and keys
before upgrades. `docker compose down -v` destroys this installation's data volumes; it is
an explicit uninstall choice, never a setup or verification step.
