# Acceptance test plan and quality gates

Scope revision, 2026-10-16: the owner requires a standalone application. The selected P1 slice ends in local blueprint JSON export. External production sync is excluded. The ledger retains all 151 IDs and records this scope change.

This is an executable test design, not a claim that code or tests have been written. Codex should turn the cases below into Vitest, Playwright, integration tests, contract tests, and repeatable shell tasks. Everything listed as **required** must be runnable offline with representative deterministic fake provider responses; live-credential tests are optional and require the operator's consent.

## A. Commands and final demonstration

```powershell
# Follow README.md to initialize private credentials outside Git.
# PostgreSQL must be running; use scripts/with-local-env.ps1 to load the environment.
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm test:quota
pnpm verify:policy
pnpm test:e2e
# Start production-like deployment
# ./scripts/with-local-env.ps1 docker compose up --build -d
# ./scripts/with-local-env.ps1 docker compose ps
# Invoke-WebRequest http://localhost:4311/healthz
```

Provide a single `pnpm verify` that runs the static/test suite, plus `pnpm seed:demo` for test fixtures. `pnpm test:integration:google` runs only when the operator separately provides valid credentials; it must not be part of default CI.

## B. Required P0 tests: APIs, data and security

1. **Offline boot:** DB migration, Redis connectivity, web, API, worker, MCP start locally without a Google key; show a clear disconnected/demonstration state, not fabricated live data.
2. **Public channels:** import known fixture channel IDs and `@handles`, resolve to canonical channel IDs, enumerate uploads playlist with cursor pagination and deduplication, then fetch recent video metadata and counts. Unknown/private/deleted channels are explicit states.
3. **No false history:** public data first captured at T2 cannot be labeled a real T0/T1 value. The user sees `tracking_since=T2` and missing prior dates.
4. **Data provenance:** every numeric displayed value has its provider, retrieved timestamp, owner/third-party class and a freshness indicator; missing is not zero.
5. **Google OAuth (offline stub):** state and PKCE are validated, callback CSRF and replay blocked, least-privilege scopes enforced, tokens encrypted, token rotation preserves newest refresh token. Test channel ID mismatch and multi-channel selection.
6. **Data privacy:** owner 1 cannot read owner 2 credentials or owner-only metrics (future RBAC regression), logs never contain keys or OAuth tokens, secure cookies, encrypted backups, export/remove user data works.
7. **Reporting:** job enumeration, creating missing report job, download once by report ID, parse valid tabular CSV/TSV safely, handle no report yet, duplicate report, partial report, delayed metrics and schema upgrade. Show `pending`, not 0, for unavailable CTR/thumbnail impressions.
8. **Data API batching:** fetch known videos in proper batches, handle partially failed video IDs from `videos:batchGetStats.summary.failedVideoIds`, implement fallback to `videos.list` where permitted, no data loss on process restart.
9. **Quota logic:** `search.list` bucket = 100 calls/day and generic other-method bucket = 10k units/day by documented defaults, reserve configurable safety margin, track method, auto-stop before exceeding; reinitialize at Pacific midnight including DST, not UTC midnight. Make method cost configuration explicit and sourced from documentation.
10. **Retry behavior:** 429/5xx exponential backoff with jitter and Retry-After, duplicate enqueue prevention, permanent authorization failures disable owner sync and show reauthorization action. Fail without tight retries or quota burn.
11. **Source deletion:** delete a tracked competitor; no longer collect. Cancel outstanding jobs and purge data as applicable.
12. **Metadata freshness:** third-party titles, descriptions, channel names, thumbnail references and dependent embeddings refresh/purge by 30d. Verify unrelated user-authored project blueprints survive while forbidden cached source metadata does not.
13. **Statistics retention:** before approved access, drop third-party statistical snapshots and any computed dependents by 30d. With verified acceptance and authorized gate, never exceed 36 calendar months. When approval is revoked/reset, stop collecting protected fields and revert retention policy safely.
14. **Derived-metrics fail-closed:** with env flag false or missing signed/attested operator approval record, `/research/outliers`, competitor-derived velocity ratios/scores, ranking leaderboards and any MCP equivalent respond with `DERIVED_METRIC_APPROVAL_REQUIRED`; no background task computes or stores derived competitors scores. Invalid/missing approval evidence cannot enable them. Display the official approval link.
15. **No external scraping:** block disallowed/unsupported YouTube HTML scraping or third-party caption download from the approved provider interface. Only official endpoints for YouTube statistics. Media jobs require original locally supplied or licensed video assets.
16. **Disconnected owner:** owner-authenticated analytics 401/403 and account revocation trigger appropriate auth status; implement data-deletion scheduling and test against policy deadlines; user-initiated delete can force immediate application purge with backup lifecycle properly documented.

## C. Required P1: editor and standalone export

17. **Research candidate:** a public video is shown with original, untransformed API metrics and source video link; an editor can manually save it as an inspiration reference, no illegal derived competitor ranking.
18. **Candidate quality:** operator creates 3 distinct creative angles from references with a local LLM; when no LLM is available, a manual blueprint is still usable. No disguised invented YouTube CTR or popularity probability.
19. **Format separation:** Shorts vs long-form analysis segmented; a view count is not blindly compared with engaged views. Proprietary competitor Shorts-vs-long-form classification can be inferred from duration/shape but must show uncertainty if classification not authoritative.
20. **Owner dashboard:** given trusted Analytics API fixture, views, daily watch time, average duration, subscriber gain/loss, owner retention and traffic charts match fixture values. Missing private fields display `not available` (not 0).
21. **Reach report:** given a sample `channel_reach_basic_a1` row, display thumbnail impressions and CTR with correct percentage units; don't confuse those with end-screen/card click metrics. If job absent/no report yet display pending.
22. **Script and thumbnail:** generate title variants, hook and outline with associated source URLs, tag output as AI-generated, produce thumbnail editorial brief without needing paid image generation, support user edits and versioning.
23. **A/B tests:** local experiment ledger records title/thumb variant periods, but does not claim randomized exposure or causation if not using official experimental framework.
24. **Publish prevention:** no video upload, public comment reply, title edit or thumbnail update endpoint may mutate YouTube in P0/P1. If future feature added, distinct OAuth write scope plus preview and per-action confirmation.
25. **Standalone export:** save an original blueprint, then export its exact saved revision as JSON with schema version, blueprint ID, revision, export timestamp and provenance. Reject a stale revision after an edit. Verify the downloaded file on desktop and mobile and API/MCP parity. No external production adapter, delivery route, delivery schedule or publishing path may exist.
26. **MCP parity:** agent can retrieve same channels, owner metrics, candidate, idea and blueprint that REST API returns and can never bypass OAuth, owner boundaries or compliance gates. Mutating MCP tool requires explicit action authorization and is not callable by a background agent without direct owner approval.

## D. Permission-gated expansion (only after *accepted* YouTube analytics application)

27. **Observed VPH:** fixture from two public count snapshots (e.g. 1,200 @ T0, 1,500 @ T0+2h) produces 150 observed views/hour, with correct interval and timestamp. One sample -> `insufficient_observations`. Counter drop/edit -> `invalid_comparison` / not negative growth.
28. **Outlier:** only sample similarly-aged videos, within same channel and content format (minimum comparable N configurable, e.g. >= 5). A 48h count of 15k vs peer median 5k gives 3.0x; cross-age and Shorts/long-form mixed candidates must be rejected. Explain formula, sample size and data gaps in UI.
29. **Ranking:** scenario with incomplete samples is down-ranked by confidence/coverage or excluded, never fabricated. Model output must not claim measured YouTube search volume, predicted CTR, guaranteed virality or rankings supplied by YouTube.
30. **36-month TTL:** retained public statistical/derived numeric histories expire strictly by calendar month rules; non-stat metadata and comment texts still refresh/purge on their shorter requirement. Approval revocation clears privileged queues and deactivates APIs before returning data.
31. **Extension:** Chrome extension cannot call the protected local API without user auth, cannot borrow third-party account cookies or parse private YouTube internal APIs; fails gracefully if YouTube changes DOM.

## E. Creativity and source-integrity tests

32. **Copyright/rights:** generated clips and transcript-derived edits accept local user-owned/permitted assets only. A nonowned YouTube watch URL by itself is insufficient authorization to download media or third-party captions.
33. **Prompt injection:** adversarial YouTube titles, descriptions and comments cannot trigger file reads, agent token leakage, dangerous commands, YouTube modifications or external deliveries. Treat retrieved text as untrusted and require exact-content owner authorization for agent draft writes.
34. **Content quality:** seeded prompts yield at least 3 *meaningfully different* titles/angles, user edits persist, source claims are auditable; any unsupported claim is flagged rather than quietly invented.
35. **UI:** desktop, 390px mobile, keyboard operation, functional chart empty states, non-ambiguous missing-data legend, loading and error states, dark mode contrast, button focus and editable dialogs. No action control is decorative only.
36. **Freshness:** dashboard that previously showed fresh metrics continues to load from DB when YouTube is offline, with correct `last_synced` badge. Never label stale views as current live stats.

## F. Artifact-level deliverables for each feature ID

`FEATURE_MATRIX.csv` is the source-of-truth feature inventory. Codex should import it into tracking and produce machine-readable `feature_coverage.json` or CSV with `feature`, `phase`, `actual_status`, `implementation_link`, `test_name`, `unavailable_reason`, and `compliance_gate`. `actual_status` starts as `not_started`; never mark complete just because a component renders static placeholder content. Required progression: `not_started -> in_progress -> implemented -> tested -> demo_verified -> live_verified` where live verification requires real authorized API connection.

## G. Exit gates

**P0 exit:** local stack starts, offline demo passes, real-data probes work when keys supplied, no secret exposure, honest metrics, quota manager and 30d default retention enforced, guarded derived score endpoint rejects requests, user can connect owner channel and see own real data.

**P1 exit:** create original idea -> save versioned blueprint -> download local JSON with matching revision and provenance. The owner reports UI is mobile-usable and distinguishes real reports, fixture tests and pending reach data. No production receiver is required or connected. Remaining automatic writing and report-availability gaps are recorded in the ledger; local export does not claim a video was produced or published.

**P2+ exit:** each optional feature is independently tested; expensive and privileged providers disabled by default. `docs/known-gaps.md` lists all remaining divergence from proprietary vidIQ features.

**Compliance/audit exit:** app has truthful public privacy policy, secured demo/test credentials or review plan, screenshots of dashboard/OAuth controls, working access URL if required; operator manually submits official Google form. Store approval proof only after actually granted, and never treat form submission as acceptance.
