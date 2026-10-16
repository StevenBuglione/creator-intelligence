"use client";
import { useState } from "react";
import { Icon } from "../_components/Icon";
import {
  EmptyState,
  PageHeader,
  Provenance,
  RawValues,
  RefreshButton,
  SkeletonRows,
  YouTubeAttribution,
} from "../_components/ui";
import { formatDateTime, pageIntro, type Row } from "../_lib/api";
import type { Workspace } from "../_lib/workspace";

export function Channels({
  ws,
  ready,
  items,
}: {
  ws: Workspace;
  ready: boolean;
  items: Row[];
}) {
  const [identifier, setIdentifier] = useState("");
  return (
    <>
      <PageHeader
        eyebrow="Evidence"
        title="Channels"
        intro={pageIntro.Channels}
        actions={<RefreshButton ws={ws} />}
      />
      {ws.status.mode !== "demo" && <YouTubeAttribution />}
      <section className="sheet query" aria-labelledby="track-title">
        <h3 id="track-title" className="sheet-kicker">
          Track a public channel
        </h3>
        <form
          className="query-row"
          onSubmit={(e) => {
            e.preventDefault();
            void ws.run(async () => {
              await ws.call("channel_add", { identifier });
              setIdentifier("");
              await ws.refresh();
            });
          }}
        >
          <div className="field field-grow">
            <label className="field-label" htmlFor="channel-identifier">
              Public channel ID or @handle
            </label>
            <input
              id="channel-identifier"
              className="mono"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="@channel-handle"
              spellCheck={false}
              autoComplete="off"
              aria-describedby="track-hint"
            />
          </div>
          <div className="query-actions">
            <button className="btn btn-primary" disabled={ws.busy}>
              <Icon name="plus" />
              Track channel
            </button>
          </div>
        </form>
        <p className="query-help" id="track-hint">
          Tracking starts at the first observation. Earlier counts are
          unavailable. Refresh or delete public records within 30 days.
        </p>
      </section>
      <div className="list-head">
        <h3>Tracked channels</h3>
        <span className="count">{ready ? items.length : "—"}</span>
      </div>
      {!ready ? (
        <section className="sheet">
          <SkeletonRows count={3} />
        </section>
      ) : !items.length ? (
        <section className="sheet">
          <EmptyState icon="channels" title="No channels tracked">
            Enter a public channel ID or @handle above. Collection is capped at
            200 visible uploads per sync and uses the official API only.
          </EmptyState>
        </section>
      ) : (
        <ul className="records">
          {items.map((row) => (
            <ChannelRow key={row.id} row={row} ws={ws} />
          ))}
        </ul>
      )}
    </>
  );
}

function ChannelRow({ row, ws }: { row: Row; ws: Workspace }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="record">
      <div className="record-main">
        <h4 className="record-title">{String(row.body.title)}</h4>
        <p className="record-ids">
          <span>
            Channel <code>{row.id}</code>
          </span>
          <span>
            Tracking since{" "}
            <time dateTime={String(row.body.tracking_since)}>
              {formatDateTime(String(row.body.tracking_since)) ??
                String(row.body.tracking_since)}
            </time>
          </span>
        </p>
        <Provenance meta={row.meta} expires={row.expires_at} />
      </div>
      <div className="record-stats">
        <p className="micro">Statistics as returned</p>
        <RawValues
          values={(row.body.statistics ?? {}) as Record<string, unknown>}
        />
      </div>
      <div className="record-actions">
        {!confirming ? (
          <button
            className="btn btn-quiet btn-danger-text"
            onClick={() => setConfirming(true)}
          >
            <Icon name="trash" />
            Remove channel and cached records
          </button>
        ) : (
          <div
            className="inline-confirm"
            role="group"
            aria-label="Confirm removal"
          >
            <p>
              Stops collection and deletes this channel&apos;s cached records.
            </p>
            <div>
              <button
                className="btn btn-danger"
                disabled={ws.busy}
                autoFocus
                onClick={() =>
                  void ws.run(async () => {
                    await ws.call("channel_remove", { id: row.id });
                    await ws.refresh();
                  })
                }
              >
                Remove
              </button>
              <button
                className="btn btn-quiet"
                onClick={() => setConfirming(false)}
              >
                Keep
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
