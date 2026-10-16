# ContentOS receiver contract

The new repository is independent of the existing ContentOS producer. A receiver
compatible with this contract has **not** been verified against a production installation. The supplied
local inbox is explicitly a synthetic contract fixture, allowed only in demo/test
mode. Live mode remains disconnected until a real receiver and token are supplied.

POST the configured HTTPS URL (HTTP is allowed only on localhost), with a server
Bearer credential and `Idempotency-Key: approved-blueprint:<uuid>:<revision>`.
The canonical JSON payload is hashed before approval. The event fields are:

```json
{
  "event_type": "creator_intelligence.blueprint.approved.v1",
  "idempotency_key": "approved-blueprint:<uuid>:<revision>",
  "source_app": "creator-intelligence",
  "blueprint_id": "<uuid>",
  "revision": 1,
  "working_title": "Original working title",
  "title_variants": [],
  "target_format": "youtube_shorts",
  "target_duration_seconds": 60,
  "hook": "Original hook",
  "outline": ["Setup", "Payoff"],
  "script": "Original script",
  "research_sources": [{"url":"https://www.youtube.com/watch?v=<id>","provenance":"user_selected_reference","note":"Inspiration only"}],
  "thumbnail_brief": "Editorial brief for original artwork",
  "risk_flags": ["Verify factual claims"]
}
```

The receiver must atomically deduplicate the key and reject key/payload mismatch,
including when a response is lost. Repeat requests return the original project:

```json
{"project_id":"<production project ID>","idempotency_key":"approved-blueprint:<uuid>:<revision>"}
```

No redirect is followed. Missing credentials, wrong receipts, and permanent errors
require attention; network/429/5xx failures enter retry. Retries use the identical
persisted payload/key, at most once per minute, only while the approval remains
valid. Owner/session/revision/payload hash/target/expiry are bound together.
After expiry, approval is required again. An owner revision creates a new key.
Changing the destination after a delivery was queued requires a new revision
and approval, so an uncertain previous send is never silently redirected.

The adapter creates a production backlog item. It does not authorize a YouTube
upload or publication. Those remain in the existing production/publishing tools.
After publication, linking a video verifies the actual owner channel with the
official API before exposing its available owner analytics with the blueprint.
