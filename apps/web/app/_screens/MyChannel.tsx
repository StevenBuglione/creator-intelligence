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
  YouTubeAttribution,
} from "../_components/ui";
import { pageIntro, type Observation } from "../_lib/api";
import type { Workspace } from "../_lib/workspace";

const kinds: Record<string, string> = {
  overview: "Daily views, engaged views, watch time and subscriber changes.",
  traffic: "Views and watch time by traffic source type.",
  retention: "Audience watch ratio across one video. Needs a video ID.",
  reach:
    "Thumbnail impressions and click-through rate from the Reporting API. Needs a video ID; can stay pending while Google prepares reports.",
};

const reportDate = (d?: string) =>
  d && /^\d{8}$/.test(d)
    ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`
    : d;

export function MyChannel({
  ws,
  ready,
  metrics,
  kind,
  setKind,
  video,
  setVideo,
}: {
  ws: Workspace;
  ready: boolean;
  metrics: Observation[];
  kind: string;
  setKind: (kind: string) => void;
  video: string;
  setVideo: (video: string) => void;
}) {
  const connected = Boolean(ws.status.google?.connected);
  const shown = metrics.slice(0, kind === "reach" ? 100 : 1);
  return (
    <>
      <PageHeader
        eyebrow="Evidence"
        title="My channel"
        intro={pageIntro["My channel"]}
        actions={<RefreshButton ws={ws} />}
      />
      {ws.status.mode !== "demo" && <YouTubeAttribution />}
      <section className="sheet query" aria-labelledby="report-query">
        <h3 id="report-query" className="sr-only">
          Choose a stored report
        </h3>
        <form
          className="query-row"
          onSubmit={(e) => {
            e.preventDefault();
            void ws.run(() => ws.refresh());
          }}
        >
          <div className="field field-report">
            <label className="field-label" htmlFor="report-kind">
              Report
            </label>
            <select
              id="report-kind"
              aria-label="Report"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {Object.keys(kinds).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </div>
          <div className="field field-grow">
            <label className="field-label" htmlFor="report-video">
              Video ID (required for retention/reach)
            </label>
            <input
              id="report-video"
              className="mono"
              value={video}
              onChange={(e) => setVideo(e.target.value)}
              placeholder="11-character video ID"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div className="query-actions">
            <button className="btn btn-primary" disabled={ws.busy}>
              Load stored report
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={ws.busy || !connected}
              aria-describedby="sync-hint"
              onClick={() =>
                void ws.run(async () => {
                  const to = new Date(Date.now() - 2 * 86400_000)
                      .toISOString()
                      .slice(0, 10),
                    from = new Date(Date.now() - 28 * 86400_000)
                      .toISOString()
                      .slice(0, 10);
                  await ws.call(
                    kind === "reach" ? "reporting_sync" : "analytics_sync",
                    { kind, from, to, ...(video ? { video_id: video } : {}) },
                  );
                  await ws.refresh();
                })
              }
            >
              <Icon name="refresh" />
              Sync from YouTube
            </button>
          </div>
        </form>
        <p className="query-help" id="sync-hint">
          <strong>{kind}</strong> — {kinds[kind]}{" "}
          {connected
            ? "Sync requests the last 28 days, ending two days ago."
            : "Sync needs a connected owner channel."}
        </p>
      </section>
      <p className="note">
        Views and engaged views are separate measures. Missing values mean not
        available. Stored reports may lag YouTube.
      </p>
      {!ready ? (
        <section className="sheet">
          <SkeletonRows count={5} />
        </section>
      ) : !shown.length ? (
        <section className="sheet">
          <EmptyState icon="channel" title="Not available yet">
            {connected
              ? "Sync the selected report. Reach reports can remain pending while Google prepares them."
              : "Connect your owner channel in Settings to load private analytics."}
          </EmptyState>
        </section>
      ) : (
        shown.map((o, i) => (
          <section
            className="sheet report"
            key={i}
            aria-label={`Stored ${kind} report`}
          >
            <Provenance meta={o.meta} />
            {o.data.rows ? (
              <>
                <ReportChart rows={o.data.rows} />
                <DataTable
                  rows={o.data.rows}
                  caption={`Stored ${kind} report values`}
                />
              </>
            ) : (
              <>
                <div className="figures">
                  <div className="figure">
                    <span className="figure-label">Thumbnail impressions</span>
                    <span className="figure-value">
                      {o.data.impressions == null
                        ? "Not available"
                        : o.data.impressions.toLocaleString()}
                    </span>
                  </div>
                  <div className="figure">
                    <span className="figure-label">
                      Thumbnail click-through rate
                    </span>
                    <span className="figure-value">
                      {o.data.ctr == null
                        ? "Not available"
                        : (o.data.ctr * 100).toFixed(2) + "%"}
                    </span>
                  </div>
                  <div className="figure">
                    <span className="figure-label">Report date</span>
                    <span className="figure-value figure-small">
                      {reportDate(o.data.date) ?? "Not available"}
                    </span>
                  </div>
                </div>
                <DataTable
                  caption="Stored reach report values"
                  rows={[
                    {
                      date: o.data.date,
                      thumbnail_impressions: o.data.impressions,
                      thumbnail_ctr:
                        o.data.ctr == null
                          ? "Not available"
                          : (o.data.ctr * 100).toFixed(2) + "%",
                    },
                  ]}
                />
                <p className="fine">
                  Thumbnail impressions and CTR are not end-screen or card click
                  metrics.
                </p>
              </>
            )}
          </section>
        ))
      )}
    </>
  );
}
