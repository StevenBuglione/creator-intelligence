"use client";
import { useState } from "react";
import { Icon } from "../_components/Icon";
import {
  Callout,
  EmptyState,
  PageHeader,
  Provenance,
  RawValues,
  RefreshButton,
  SkeletonRows,
  YouTubeAttribution,
} from "../_components/ui";
import { formatLabel, pageIntro, type Row } from "../_lib/api";
import type { Workspace } from "../_lib/workspace";

export function Research({
  ws,
  ready,
  items,
  onInspire,
}: {
  ws: Workspace;
  ready: boolean;
  items: Row[];
  onInspire: (url: string) => void;
}) {
  const [identifier, setIdentifier] = useState("");
  return (
    <>
      <PageHeader
        eyebrow="Evidence"
        title="Research"
        intro={pageIntro.Research}
        actions={<RefreshButton ws={ws} />}
      />
      {ws.status.mode !== "demo" && <YouTubeAttribution />}
      <section className="sheet query" aria-labelledby="lookup-title">
        <h3 id="lookup-title" className="sheet-kicker">
          Look up one public video
        </h3>
        <form
          className="query-row"
          onSubmit={(e) => {
            e.preventDefault();
            void ws.run(async () => {
              await ws.call("video_lookup", { id: identifier });
              setIdentifier("");
              await ws.refresh();
            });
          }}
        >
          <div className="field field-grow">
            <label className="field-label" htmlFor="video-lookup">
              Public video ID
            </label>
            <input
              id="video-lookup"
              className="mono"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              maxLength={11}
              spellCheck={false}
              autoComplete="off"
              placeholder="11 characters"
            />
          </div>
          <div className="query-actions">
            <button className="btn btn-primary" disabled={ws.busy}>
              <Icon name="research" />
              Look up video
            </button>
          </div>
        </form>
        {ws.status.public_api_configured === false && (
          <Callout tone="caution">
            This installation has no public YouTube Data API key, so new lookups
            will be refused. Stored records remain readable.
          </Callout>
        )}
      </section>
      <div className="list-head">
        <h3>Stored public records</h3>
        <span className="count">{ready ? items.length : "—"}</span>
      </div>
      {!ready ? (
        <section className="sheet">
          <SkeletonRows count={4} />
        </section>
      ) : !items.length ? (
        <section className="sheet">
          <EmptyState
            icon="research"
            title="No public records yet"
            action={
              <button
                className="btn btn-secondary"
                onClick={() => ws.go("Channels")}
              >
                Track a channel
              </button>
            }
          >
            Add a channel to collect its visible uploads through the official
            API.
          </EmptyState>
        </section>
      ) : (
        <ul className="records">
          {items.map((row) => {
            const url = "https://www.youtube.com/watch?v=" + row.id;
            return (
              <li key={row.id} className="record">
                <div className="record-main">
                  <h4 className="record-title">{String(row.body.title)}</h4>
                  <p className="record-ids">
                    <span>
                      Video <code>{row.id}</code>
                    </span>
                    {row.body.channel_id ? (
                      <span>
                        Channel <code>{String(row.body.channel_id)}</code>
                      </span>
                    ) : null}
                    <span
                      className="format-tag"
                      title="Format is unknown unless the source establishes it."
                    >
                      {formatLabel(row.body.format)}
                    </span>
                  </p>
                  <Provenance meta={row.meta} expires={row.expires_at} />
                </div>
                <div className="record-stats">
                  <p className="micro">Statistics as returned</p>
                  <RawValues
                    values={
                      (row.body.statistics ?? {}) as Record<string, unknown>
                    }
                  />
                </div>
                <div className="record-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => onInspire(url)}
                  >
                    <Icon name="idea" />
                    Use as inspiration
                  </button>
                  <a
                    className="text-link"
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View source video
                    <Icon name="external" size={15} />
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
