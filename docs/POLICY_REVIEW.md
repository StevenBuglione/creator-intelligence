# Policy review, 16 October 2026

This records an engineering review of the standalone release candidate, not a Google
approval or a guarantee of acceptance. Installation-specific evidence and the private
application remain outside the public repository.

| Area | Implementation and evidence | Qualification |
|---|---|---|
| Identity and source distribution | Individual developer identified; MIT implementation and Pages documentation share one repository. | Public source does not expose the maintainer's private runtime or transfer credentials/approvals. |
| Consent and disclosure | Public/local privacy and terms; versioned owner agreement; optional MCP sharing off by default; provider processing disclosed. | Owner acceptance is personal. Automated tests use fixtures. |
| Collection and quota | Official Data, Analytics and Reporting endpoints; restricted key; exact read scopes/channel; bounded collection and Pacific-day quota accounting. | No scraping, media download, quota sharding, or publishing route. |
| Data lifecycle | Expiry filters plus purge; owner reports removed on disconnect; explicit Google revocation; invalid-grant cleanup; delete/export controls. | Actual production revocation is deliberately not performed during verification. Downloaded exports/manual backups remain operator-controlled. |
| Presentation | Raw metric tables, provenance, separate views/engaged views, unavailable states, distinct original drafts; unmodified linked YouTube attribution. | No synthetic values presented as real owner analytics. Reach availability is installation-specific. |
| Additional metrics | All 28 governed backlog items remain unimplemented/disabled; five MCP entries return policy errors. | Submit the proposed formulas and retention scope for review; a submission alone enables nothing. |
| AI/MCP | Authenticated reads of stored records, separate sharing consent, content-bound authorization for draft writes; no Google token exposure or agent-initiated Google collection. | Provider training/retention settings must be reviewed by each operator. Current owner account settings are an attestation. |
| Security and distribution | Loopback deployment, session/CSRF/PKCE controls, encrypted tokens/backups, private credentials, staged-source scan; self-hosted licensed fonts. | Not an independent penetration test. GitHub private vulnerability reporting is enabled. |

## Official sources and decisions

- [YouTube API terms](https://developers.google.com/youtube/terms/api-services-terms-of-service): review covers identity, privacy, security and review access. The application describes the actual private installation and public source separately.
- [Developer policies](https://developers.google.com/youtube/terms/developer-policies): checked consent, data use, revocation, retention, official access and presentation against the controls above.
- [Policy guidance](https://developers.google.com/youtube/terms/developer-policies-guide): additional-metrics permission is distinct from ordinary API access. Personal use is not treated as an exemption.
- [Derived-metrics policy](https://developers.google.com/youtube/terms/derived-metrics-policy): the application uses the Analytics & Reporting route and requests only its explicitly described prospective scope. Metadata remains on standard refresh/deletion rules.
- [Google user-data policy](https://developers.google.com/terms/api-services-user-data-policy): optional transfer to a connected AI provider is disclosed and tied to visible user-facing features; no advertising, resale or built-in training workflow.
- [Required minimum functionality](https://developers.google.com/youtube/terms/required-minimum-functionality): this release links to YouTube, with no embedded player, upload, public comment or YouTube mutation feature. Do not claim those features are qualified.
- [YouTube branding](https://developers.google.com/youtube/terms/branding-guidelines): product identity is distinct; attribution assets retain their proportions, link to YouTube and carry separate notices.
- [OAuth verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification): personal/Testing exceptions concern OAuth verification, not approval for additional metrics. Testing can require renewed consent when tokens expire.
- [AI-agent client guidance](https://support.google.com/cloud/answer/15549257#agentic-client): the current Google client serves the direct backend; downstream MCP reads cached records without Google OAuth or collection. The private application requests confirmation of this boundary. Any future Google-authenticated agent workflow requires separate review and client isolation.

## Submission boundaries

Describe the sole personal user truthfully; do not claim a registered business or Google
endorsement. Request no quota increase when none is needed. Identify any mismatch in the
form's initial-audit routing rather than claiming a requested re-audit. Supply fresh
address-bar evidence and make an explicit reviewer-access offer for the private local
installation. Google may require a guided demonstration or another review arrangement.
The applicant must review the amendment, attestations and supporting-material permissions
and submit personally. No acceptance or review outcome is claimed here.
