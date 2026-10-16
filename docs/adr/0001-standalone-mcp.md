# ADR 0001: one MCP, private local installations

The public MIT source release exposes one authenticated MCP registration per installation.
API, worker and optional review UI share the same application services, owner authorization,
provenance and policy gates. PostgreSQL and Redis remain local backing services.

The core workflow is official evidence -> original idea -> versioned blueprint -> local JSON
export. The owner explicitly requested a standalone application on 2026-10-16. There is no
external production adapter, outbound delivery or publishing integration. Existing publishers
are outside this application and their permissions remain unchanged.

The initial private development history contains deployment-specific records and remains
private. This public repository starts from a reviewed implementation snapshot with generic
configuration, MIT licensing, public documentation and independently rerun checks.
Public code is distinct from hosted access, API credentials, analytics and Google approval.
