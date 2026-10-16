# Creator Intelligence

**Open-source creator research and production planning through one authenticated MCP server.**

[Project website](https://stevenbuglione.github.io/creator-intelligence/) · [Setup](docs/OPERATIONS.md) · [MCP tools](docs/MCP.md) · [Verification](docs/VERIFICATION.md) · [MIT license](LICENSE)

Creator Intelligence gives Claude and compatible MCP clients access to official YouTube
research, owner-authorized reports, original ideas and versioned production blueprints.
It runs on your machine with TypeScript, Docker Compose, PostgreSQL, Redis/BullMQ,
Fastify and Next.js. It is a standalone application: reviewed blueprints export as
local JSON files with their revision and provenance.

## Release status

Version 0.1.0 is a **release candidate**. The implementation and tests are public;
the maintainer's deployment, credentials, private analytics and Google application are not.
The complete 151-feature backlog is not implemented. Read the [coverage ledger](feature_coverage.json)
and [known gaps](docs/known-gaps.md) before relying on a feature.

- Public channel/video lookup, bounded uploads ingestion, provenance, quota accounting and 30-day expiry.
- Read-only owner OAuth, Analytics and Reporting adapters, with explicit missing-data states.
- Original idea and blueprint editing, versioning, exact-content MCP draft authorization and local blueprint JSON export.
- Session/CSRF/PKCE controls, encrypted OAuth tokens, local export/deletion and encrypted original-draft backups.
- Eighteen MCP tools; five governed analytics tools return a blocked response. No custom-score permission is bundled.

No scraping, quota bypass, fabricated analytics or mandatory paid cloud service.
This MCP does not upload or render videos. Existing publishing tools continue separately.

## Quick start on Windows

Install Node.js 24.19.x, pnpm 11.25.0, PowerShell 7 and Docker Compose.
Create your own Google project and enable the three YouTube APIs; see the [setup guide](docs/OPERATIONS.md).

```powershell
git clone https://github.com/StevenBuglione/creator-intelligence.git
cd creator-intelligence
pnpm install --frozen-lockfile
./scripts/init-local.ps1 -OwnedChannelId 'YOUR_CHANNEL_ID' -GoogleProjectNumber 'YOUR_PROJECT_NUMBER'
./scripts/with-local-env.ps1 docker compose up --build -d
./scripts/copy-owner-password.ps1
```

Replace both identity placeholders with your values. Open http://localhost:4310,
paste the generated owner password, and clear the clipboard after login. Review and accept
the privacy policy and terms; enable optional MCP sharing only if you want a connected AI
client to receive requested records. Local
drafting works before Google is connected; API-backed data requires your credentials.
Installations use their own credentials and quotas. Never use the maintainer's project.

## Connect one MCP server

Build the local stdio launcher, then register it with Claude Code:

```powershell
pnpm build
$launcher = (Resolve-Path ./scripts/mcp-launch.ps1).Path
claude mcp add --scope user creator-intelligence -- pwsh -NoProfile -File $launcher
```

The Docker services must be running. An administrator may need to allow the launcher
on managed devices. The launcher loads the MCP token locally, not Google tokens.
Alternatively use the authenticated HTTP endpoint at `http://localhost:4312/mcp`;
register only one transport. See [tool inputs, authorization and examples](docs/MCP.md).

## Verify locally

```powershell
./scripts/with-local-env.ps1 pnpm verify
```

This runs lint, TypeScript, unit/integration tests, production build and desktop/mobile
browser workflows. PostgreSQL is required. Tests use separate test/demo databases and
synthetic providers. They do not make Google API calls or prove your account connection.
Use the separate opt-in `pnpm test:integration:google` after owner consent.

## Google approval and privacy

Open-source licensing grants rights to the code, not to Google credentials, YouTube
content or additional metrics. Each operator must meet the applicable API requirements.
Derived scores and extended public-statistical retention remain disabled; no approval
is claimed. A personal deployment's audit is distinct from distribution of the software.
Read [privacy](https://stevenbuglione.github.io/creator-intelligence/privacy.html),
[terms](https://stevenbuglione.github.io/creator-intelligence/terms.html), and
[third-party notices](THIRD_PARTY_NOTICES.md). Optional Claude/provider processing
depends on that account's settings and is not necessarily local.

Copyright © 2026 Steven Patrick Buglione. Project code and documentation: MIT.
Dependencies, service APIs and container images retain their own licenses and terms.
