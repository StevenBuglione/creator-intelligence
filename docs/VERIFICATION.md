# Open-source release verification

Prepared 2026-10-16. This is the initial public source release of version 0.1.0.
Fresh checks ran against the public source checkout on 2026-10-16 with Node 24.19.0,
pnpm 11.25.0, an isolated PostgreSQL/Redis stack and generated test-only credentials.

| Check | Actual result |
|---|---|
| Frozen dependency install | Passed on Windows and in the Linux image build |
| ESLint and strict TypeScript | Passed |
| Vitest | 43 passed across eight files, including three installation-identity checks |
| Production build | Passed on Windows and inside the Linux Docker image |
| Playwright | Two passed: desktop 1440px and mobile 390px reviewed blueprint workflows |
| Windows initialization | Created an isolated ACL-protected environment from supplied fixture channel/project IDs |
| Docker Compose runtime | Six services started in an isolated test project on separate loopback ports |
| API/UI smoke | HTTP 200; unauthenticated API operation rejected with HTTP 401 |
| MCP HTTP and stdio | Both initialized, listed 18 tools, returned status and rejected derived metrics |
| Redis/worker | PONG; sync, purge, delivery and backup schedules present; first draft backup integrity verified |
| Documentation preview | Homepage inspected in browser; no document overflow at the available 304px viewport |

The configuration has no maintainer channel/project defaults. OAuth compares the configured
immutable channel ID and permits its display name to differ. Wrong-channel and replay
rejection tests still pass. The live Google probe takes an optional operator-supplied video ID.
The MCP smoke verifier supports a separate test endpoint through MCP_ORIGIN.

Tests used synthetic provider responses and isolated test/demo databases; the runtime smoke
used an empty test workspace. No live Google calls or production ContentOS delivery occurred
during these checks. They do not certify every external installation, creative output quality,
or Google compliance. See known-gaps.md for remaining acceptance gates.

The earlier private implementation passed 40 Vitest cases and two browser workflows and
made real public API reads. Those historical results do not certify modifications in this
release. The two live_verified entries in feature_coverage.json preserve those historical
public-adapter reads, not a new operator's authorization. No new owner OAuth, managed Claude
registration or production ContentOS delivery is claimed. Public release and YouTube approval
are distinct. The ledger retains 128 not_started, two live_verified, one implemented, six tested,
13 demo_verified and one in_progress entries; all 28 G-class features remain disabled.


## Audit-readiness revision, 2026-10-16

The current revision passed ESLint, strict TypeScript, 48 Vitest tests across nine files,
a Windows production build and both desktop/mobile Playwright workflows. The Linux Docker
image built successfully. An isolated six-service Compose deployment passed UI/API health,
HTTP 401 without authentication, and HTTP/stdio MCP initialization with 18 tools each.
Both transports returned stored status and rejected governed metrics after explicit fixture
consent. Before fixture consent, MCP status returned POLICY_ACCEPTANCE_REQUIRED.
The isolated worker registered all four schedules; its daily backup had not yet completed
at this check. Earlier backup evidence is historical and is not a new completion claim.

New checks cover versioned privacy/terms agreement, CSRF and owner-only acceptance,
optional MCP sharing disabled by default, immediate sharing revocation, policy renewal,
no automatically accepted policies, and owner-report expiry/purge. MCP reads do not call
Google transport or token refresh, and collection operations are rejected for agents.
The local deployment was backed up and upgraded through migrations 1, 2 and 3; existing
migration checksums are preserved. A running deployment still requires its owner's actual
agreement and Google consent. Tests do not substitute for either.

New-app Google owner authorization, actual managed-Claude use, and a real ContentOS receipt
remain separate live acceptance gates. The feature ledger retains the previous statuses;
these security and retention checks do not imply completion of the 151-feature backlog.
