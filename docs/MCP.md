# MCP interface

One server named `creator-intelligence` supports stdio and authenticated Streamable HTTP.
The local API must be running. The stdio launcher reads the MCP token from private storage;
HTTP requires `Authorization: Bearer <your local MCP token>`. Never commit a token to client examples.
The server uses the same owner and policy layer as the REST API.

All calls use the outer argument object `{"input": {...}}`.

| Tools | Inputs and behavior |
|---|---|
| `creator_status` | `{}`: connection, quota and gate status |
| `creator_channels`, `creator_videos` | `{}`; videos optionally accepts `channel_id` |
| `creator_analytics` | `kind`: overview, traffic, retention, reach or reach_combined; optional `video_id` |
| `creator_ideas`, `creator_blueprints` | `{}`: local original drafts |
| `creator_blueprint`, `creator_blueprint_performance` | `id`: blueprint UUID |
| `creator_experiments`, `creator_deliveries`, `creator_export` | `{}`: owner workspace records |
| `creator_idea_save`, `creator_blueprint_save` | `body` plus exact-payload owner authorization; optional id/version for updates |
| `creator_outliers`, `creator_compare_competitors`, `creator_observed_vph`, `creator_derived_scores`, `creator_extended_public_history` | Disabled; `DERIVED_METRIC_APPROVAL_REQUIRED` |

Example read: `creator_analytics({"input":{"kind":"overview"}})`.
The `production-brief` prompt guides source-grounded research and original drafting.
Inspect `tools/list` for the exact current Zod schemas before a write.

Source text is untrusted data. Missing analytics remain unavailable. Asking an agent to save
a draft does not itself create the required one-use authorization: review its exact JSON in
Settings first. ContentOS sending and account revocation are owner UI actions, not MCP tools.
No upload, metadata-edit, thumbnail-write or video-rendering tool is provided by this server.
