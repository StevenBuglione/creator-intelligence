"use client";
import { ReportChart } from "../_components/charts";
import { Icon } from "../_components/Icon";
import {
  DataTable,
  EmptyState,
  PageHeader,
  Provenance,
  RefreshButton,
  SkeletonRows,
  StateTag,
  YouTubeAttribution,
} from "../_components/ui";
import {
  formatDate,
  formatDateTime,
  formatLabel,
  pageIntro,
  type Observation,
  type PageName,
  type Row,
} from "../_lib/api";
import type { Workspace } from "../_lib/workspace";

export type Summary = {
  channels: Row[];
  videos: Row[];
  ideas: Row[];
  blueprints: Row[];
};

export function Overview({
  ws,
  ready,
  summary,
  metrics,
}: {
  ws: Workspace;
  ready: boolean;
  summary: Summary | null;
  metrics: Observation[];
}) {
  const { status } = ws;
  const steps: {
    n: string;
    label: string;
    count: number | undefined;
    unit: [string, string];
    page: PageName;
  }[] = [
    {
      n: "01",
      label: "Sources",
      count: summary?.channels.length,
      unit: ["channel tracked", "channels tracked"],
      page: "Channels",
    },
    {
      n: "02",
      label: "Evidence",
      count: summary?.videos.length,
      unit: ["public video", "public videos"],
      page: "Research",
    },
    {
      n: "03",
      label: "Ideas",
      count: summary?.ideas.length,
      unit: ["original idea", "original ideas"],
      page: "Ideas",
    },
    {
      n: "04",
      label: "Blueprints",
      count: summary?.blueprints.length,
      unit: ["blueprint", "blueprints"],
      page: "Blueprints",
    },
  ];
  const report = metrics[0];
  const recent = [...(summary?.blueprints ?? [])]
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
    .slice(0, 3);
  return (
    <>
      <PageHeader
        eyebrow="Evidence"
        title="Overview"
        intro={pageIntro.Overview}
        actions={<RefreshButton ws={ws} />}
      />
      {status.mode !== "demo" && <YouTubeAttribution />}
      <ol className="pipeline" aria-label="Research to export workflow">
        {steps.map((s) => (
          <li key={s.n}>
            <button
              type="button"
              className="pipeline-step"
              onClick={() => ws.go(s.page)}
            >
              <span className="pipeline-n">{s.n}</span>
              <span className="pipeline-label">{s.label}</span>
              <span className="pipeline-count">
                {ready && s.count !== undefined ? s.count : "—"}
              </span>
              <span className="pipeline-unit">
                {ready && s.count !== undefined
                  ? s.count === 1
                    ? s.unit[0]
                    : s.unit[1]
                  : "Loading"}
              </span>
              <Icon name="arrow" />
            </button>
          </li>
        ))}
        <li>
          <span className="pipeline-step pipeline-end">
            <span className="pipeline-n">05</span>
            <span className="pipeline-label">Export</span>
            <span className="pipeline-count pipeline-glyph">
              <Icon name="download" size={22} />
            </span>
            <span className="pipeline-unit">Local blueprint JSON</span>
          </span>
        </li>
      </ol>
      {ready && summary && summary.channels.length === 0 && (
        <div className="next-step">
          <div>
            <h3>Ready for the next video</h3>
            <p>
              Add a public channel, select a source, and write an original
              angle. Keep the evidence attached as you develop the blueprint.
            </p>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => ws.go("Channels")}
          >
            Add research sources
          </button>
        </div>
      )}
      <div className="split">
        <section className="sheet" aria-labelledby="latest-report">
          <div className="sheet-head">
            <div>
              <h3 id="latest-report">Your channel, with evidence</h3>
              <p className="sheet-sub">
                Latest stored daily report. Views and engaged views are separate
                measures. Missing values mean not available.
              </p>
            </div>
            <button
              className="btn btn-quiet btn-small"
              onClick={() => ws.go("My channel")}
            >
              All reports
              <Icon name="arrow" size={16} />
            </button>
          </div>
          {!ready ? (
            <SkeletonRows count={4} />
          ) : !report ? (
            <EmptyState icon="channel" title="Not available yet">
              {status.google?.connected
                ? "Sync the overview report from My channel. Stored reports may lag YouTube."
                : "Connect your owner channel in Settings to load private analytics. Nothing is shown until a real report is stored."}
            </EmptyState>
          ) : (
            <>
              <Provenance meta={report.meta} />
              {report.data.rows ? (
                <>
                  <ReportChart rows={report.data.rows} />
                  <DataTable
                    rows={report.data.rows}
                    caption="Stored channel report values"
                  />
                </>
              ) : (
                <p className="not-available">Not available</p>
              )}
            </>
          )}
        </section>
        <aside className="stack">
          <section className="sheet" aria-labelledby="ws-status">
            <h3 id="ws-status">Workspace status</h3>
            <dl className="facts">
              <div>
                <dt>Owner channel</dt>
                <dd>
                  <StateTag tone={status.google?.connected ? "on" : "off"}>
                    {status.google?.connected ? "Connected" : "Not connected"}
                  </StateTag>
                  {status.google?.channel_id && (
                    <code>{status.google.channel_id}</code>
                  )}
                </dd>
              </div>
              <div>
                <dt>Public API key</dt>
                <dd>
                  <StateTag tone={status.public_api_configured ? "on" : "off"}>
                    {status.public_api_configured
                      ? "Configured"
                      : "Not configured"}
                  </StateTag>
                </dd>
              </div>
              <div>
                <dt>MCP sharing</dt>
                <dd>
                  <StateTag
                    tone={ws.policy.agent_data_allowed ? "warn" : "neutral"}
                  >
                    {ws.policy.agent_data_allowed ? "On" : "Off"}
                  </StateTag>
                </dd>
              </div>
              <div>
                <dt>Derived metrics</dt>
                <dd>
                  <StateTag tone="neutral">Disabled</StateTag>
                  <a
                    href={
                      status.derived_metrics?.application_url ??
                      "https://developers.google.com/youtube/terms/derived-metrics-policy"
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Approval requirements
                  </a>
                </dd>
              </div>
              <div>
                <dt>Quota day (PT)</dt>
                <dd>
                  {status.quota?.day_pt ?? "Not available"}
                  {status.quota?.resets_at && (
                    <span className="muted">
                      Resets {formatDateTime(status.quota.resets_at)}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
            {status.publishing && <p className="fine">{status.publishing}</p>}
          </section>
          <section className="sheet" aria-labelledby="recent-bp">
            <h3 id="recent-bp">Recent blueprints</h3>
            {!ready ? (
              <SkeletonRows count={2} />
            ) : recent.length ? (
              <ul className="recent">
                {recent.map((b) => (
                  <li key={b.id}>
                    <span className="recent-title">
                      {String(b.body.working_title)}
                    </span>
                    <span className="recent-meta">
                      v{b.version} · {formatLabel(b.body.target_format)} ·{" "}
                      {formatDate(b.updated_at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                No blueprints yet. Develop one from a saved idea.
              </p>
            )}
            <button
              className="btn btn-quiet btn-small"
              onClick={() => ws.go("Blueprints")}
            >
              Open blueprints
              <Icon name="arrow" size={16} />
            </button>
          </section>
        </aside>
      </div>
    </>
  );
}
