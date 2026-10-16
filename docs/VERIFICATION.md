# Release verification

## Visual redesign verification, 16 October 2026

The redesign at b3564d9572b437ae1dadca2d87fa579691c5b51f passed the literal
`pnpm verify` command on Node 24.19.0 and pnpm 11.25.0: lint, typecheck, 47 tests
across nine files, production build, and both desktop/mobile browser workflows.
The browser workflows verify fixture reports, editing, versioning and downloaded
blueprint JSON. Earlier attempts stopped at a port conflict with an existing demo
preview; the successful run started its own fresh servers after that conflict was cleared.

The Linux image built with frozen dependencies and passed the isolated six-service
check: UI/API 200, unauthenticated API 401, HTTP and stdio discovery of 18 MCP tools,
stored status reads, blocked derived metrics, blueprint export discovery and three
worker schedules. These checks use isolated fixture consent, not consent on behalf
of the deployment owner. Local fonts include their upstream license notices.

This visual change does not complete additional backlog features or establish Google
approval. See [policy review](POLICY_REVIEW.md) for the review scope and remaining
reviewer decisions. Private screenshots, logs and application materials are excluded
from source control.

## Standalone release baseline

Checked 2026-10-16 against the standalone public source checkout with Node 24.19.0,
pnpm 11.25.0 and isolated test/demo databases. This remains a release candidate;
the 151-row backlog is not a list of completed capabilities.

| Check | Actual result |
|---|---|
| ESLint and strict TypeScript | Passed |
| Vitest | 47 passed across nine files |
| Windows production build | Passed |
| Playwright | Desktop 1440px and mobile 390px passed, including actual blueprint JSON downloads |
| Blueprint export | Exact revision, schema, original content and provenance returned; stale revision rejected |
| Retired production operations | Approve, send, drain and delivery reads rejected, including for the owner |
| Build cleanup | Generated server output is removed before compilation to prevent stale executable modules |

The suite uses synthetic provider responses. Privacy tests cover owner-only versioned
agreement, CSRF, optional MCP sharing off by default, immediate sharing revocation,
policy renewal and no automatic consent. Owner reports expire within 30 days and expired
records are excluded and purged. Agent reads do not call Google transport or refresh
Google tokens; collection operations are unavailable to agents.

The standalone Linux image built with a frozen dependency install and passed isolated
six-service startup, UI/API health and HTTP 401 without authentication. HTTP and stdio
each listed 18 tools, including blueprint export and excluding delivery reads. Both
returned stored status and blocked derived metrics. Exactly three worker schedules
remain: sync, purge and backup. The same checks passed after the maintainer's live
deployment upgrade, with its database backed up first. No obsolete compiled adapter
remains in generated server output. The current daily backup had not yet completed;
prior backup/restore evidence is historical, not a new completion claim.

The earlier consent revision's pre-consent MCP status check returned
POLICY_ACCEPTANCE_REQUIRED. The standalone suite repeats the underlying consent tests.

## Authorized live evidence

On 2026-10-16 the maintainer connected a dedicated Google project and web OAuth client
after personally accepting the local policy, optional MCP sharing and Google consent.
The connection matched the configured owner channel with exactly youtube.readonly and
yt-analytics.readonly. Real public channel/video reads and owner overview/traffic
retrieval succeeded. Two reach jobs exist; no reach report has arrived. No missing
impression or CTR value is presented as a measured zero. Retention/reach display
checks still use fixtures, not evidence that every live report is available.

Claude registration and allowlisting are configured. After owner sign-in, a real
Claude Code invocation called creator_status and received the live connected state,
disabled metrics and standalone boundary. This proves a client read, not a live
agent draft write or verification of every tool. Account training settings are an
owner attestation, not independently inspected evidence. No production Google
revocation was performed; destructive deletion/revocation tests use isolated fixtures.

Public code, installation consent, OAuth verification and YouTube additional-metric
approval are distinct. All 28 governed backlog features remain unimplemented and
disabled. External production sync is excluded from the standalone scope. Each
installation supplies its own credentials and permissions. See known-gaps.md and
feature_coverage.json for remaining acceptance boundaries.
