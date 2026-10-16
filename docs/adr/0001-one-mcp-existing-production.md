# ADR 0001: one MCP, private local installations

The public MIT source release exposes one authenticated MCP registration per installation.
API, worker and optional review UI share the same application services, owner authorization,
provenance and policy gates. PostgreSQL and Redis remain local backing services.

The core workflow is official evidence -> original idea -> versioned blueprint -> explicit
owner approval -> idempotent ContentOS delivery. The external producer renders and publishes.
A fixture receipt is not evidence of a real production delivery. No existing publisher is
replaced, revoked or made public by distributing this source.

The initial private development history contains deployment-specific records and remains
private. This public repository starts from a reviewed implementation snapshot with generic
configuration, MIT licensing, public documentation and independently rerun checks.
Public code is distinct from hosted access, API credentials, analytics and Google approval.
