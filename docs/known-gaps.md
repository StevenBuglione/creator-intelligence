# Release boundaries

Version 0.1.0 is a runnable release candidate, not completion of all P0/P1 acceptance gates.
The 151-row coverage ledger preserves planned, implemented, tested, demo and live distinctions.

- Each operator needs their own Google project, API key, OAuth client and channel consent.
  The maintainer's new owner OAuth flow is still not live-account verified. Offline OAuth
  tests do not establish Google's approval or consent for an installation.
- MCP protocol behavior is tested; the maintainer's managed Claude registration still needs
  administrator allowlisting and actual client verification.
- ContentOS's typed adapter, queue and idempotency are fixture-tested. A real production
  receiver and service authorization are not verified by those tests.
- All 28 approval-gated backlog features remain not started/disabled. The five corresponding
  MCP tools return a policy error. No custom scores or extended API history are enabled.
- Collection is capped at 200 visible uploads per channel per sync. No full YouTube index,
  pre-tracking history, exact search demand, competitor CTR/retention or revenue is claimed.
- Original script editing/versioning is implemented. Dedicated automatic script writing,
  broad search/discovery, many optimization tools, browser extensions and multi-user access
  remain outside this release. Optional model output quality needs a real model and human review.
- The application has a local privacy page but still needs a versioned affirmative policy
  acceptance gate before full audit readiness. Public site publication does not resolve that.
- Windows setup and Linux containers are covered; macOS/Linux host setup scripts are not
  supplied. Publishing, rendering and media generation remain separate tools.
- Source distribution does not make the maintainer's private deployment publicly accessible.
  A Google review still requires accurate deployment-specific evidence and suitable reviewer access.
