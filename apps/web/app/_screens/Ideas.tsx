"use client";
import { useState } from "react";
import { Icon } from "../_components/Icon";
import {
  Counter,
  EmptyState,
  PageHeader,
  RefreshButton,
  SkeletonRows,
} from "../_components/ui";
import {
  emptyDraft,
  formatDate,
  pageIntro,
  type Draft,
  type Row,
} from "../_lib/api";
import type { Workspace } from "../_lib/workspace";

type Angle = {
  title: string;
  angle: string;
  hook: string;
  unverified_claims: string[];
};

export function Ideas({
  ws,
  ready,
  items,
  title,
  setTitle,
  source,
  setSource,
  onDevelop,
}: {
  ws: Workspace;
  ready: boolean;
  items: Row[];
  title: string;
  setTitle: (v: string) => void;
  source: string;
  setSource: (v: string) => void;
  onDevelop: (draft: Draft) => void;
}) {
  const [angle, setAngle] = useState("");
  return (
    <>
      <PageHeader
        eyebrow="Create"
        title="Ideas"
        intro={pageIntro.Ideas}
        actions={<RefreshButton ws={ws} />}
      />
      <div className="workbench">
        <section className="sheet composer" aria-labelledby="composer-title">
          <h3 id="composer-title">Write a distinct angle</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ws.run(async () => {
                await ws.call("idea_save", {
                  title,
                  angle,
                  references: source
                    ? [
                        {
                          url: source,
                          note: "Inspiration, not a claim of ownership.",
                        },
                      ]
                    : [],
                });
                setTitle("");
                setAngle("");
                await ws.refresh();
                ws.setMessage("Idea saved.");
              });
            }}
          >
            <div className="field">
              <div className="field-top">
                <label className="field-label" htmlFor="idea-title">
                  Working title
                </label>
                <Counter value={title.length} max={200} />
              </div>
              <input
                id="idea-title"
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="idea-source">
                Source URL (optional)
              </label>
              <input
                id="idea-source"
                type="url"
                className="mono"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                aria-describedby="idea-source-hint"
              />
              <p className="hint" id="idea-source-hint">
                Saved as inspiration, not a claim of ownership.
              </p>
            </div>
            <div className="field">
              <div className="field-top">
                <label className="field-label" htmlFor="idea-angle">
                  Original angle
                </label>
                <button
                  type="button"
                  className="btn btn-quiet btn-small"
                  disabled={ws.busy || !title}
                  aria-describedby="suggest-hint"
                  onClick={() =>
                    void ws.run(async () => {
                      const result = await ws.call<{ angles: Angle[] }>(
                        "suggest_angles",
                        { topic: title, source_urls: source ? [source] : [] },
                      );
                      setAngle(
                        "AI-generated creative suggestions; verify claims.\n\n" +
                          result.angles
                            .map(
                              (a) =>
                                a.title +
                                "\n" +
                                a.angle +
                                "\n" +
                                a.hook +
                                "\nUnverified claims: " +
                                (a.unverified_claims.join("; ") ||
                                  "None supplied; still review independently"),
                            )
                            .join("\n\n"),
                      );
                      ws.setMessage(
                        "Local model suggestions — review claims and select an original angle.",
                      );
                    })
                  }
                >
                  <Icon name="spark" size={16} />
                  Suggest three angles with local model
                </button>
              </div>
              <textarea
                id="idea-angle"
                rows={7}
                value={angle}
                onChange={(e) => setAngle(e.target.value)}
              />
              <p className="hint" id="suggest-hint">
                Optional local model. You can also write here or use Claude with
                the MCP evidence tools.
              </p>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" disabled={ws.busy}>
                Save idea
              </button>
            </div>
          </form>
        </section>
        <div className="idea-column">
          <div className="list-head">
            <h3>Saved ideas</h3>
            <span className="count">{ready ? items.length : "—"}</span>
          </div>
          {!ready ? (
            <SkeletonRows count={3} />
          ) : !items.length ? (
            <div className="sheet">
              <EmptyState icon="idea" title="No ideas yet">
                Write a working title and an angle that is your own. Start from
                a research record with “Use as inspiration” to keep its source
                attached.
              </EmptyState>
            </div>
          ) : (
            items.map((row) => {
              const refs = (row.body.references ?? []) as {
                url: string;
                note: string;
              }[];
              return (
                <section
                  key={row.id}
                  className="idea"
                  aria-label={String(row.body.title)}
                >
                  <h3>{String(row.body.title)}</h3>
                  {row.body.angle ? (
                    <p className="idea-angle">{String(row.body.angle)}</p>
                  ) : (
                    <p className="muted">No angle written yet.</p>
                  )}
                  <div className="idea-foot">
                    <span className="idea-meta">
                      {refs.length
                        ? `${refs.length} source${refs.length === 1 ? "" : "s"}`
                        : "No sources"}
                      {row.updated_at ? ` · ${formatDate(row.updated_at)}` : ""}
                    </span>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() =>
                        onDevelop({
                          ...emptyDraft,
                          idea_id: row.id,
                          working_title: String(row.body.title),
                          hook: String(row.body.angle),
                          research_sources: refs,
                        })
                      }
                    >
                      Develop blueprint
                      <Icon name="arrow" size={16} />
                    </button>
                  </div>
                </section>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
