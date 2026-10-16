"use client";
import { useMemo } from "react";
import { Icon } from "../_components/Icon";
import {
  Counter,
  EmptyState,
  PageHeader,
  RefreshButton,
  SkeletonRows,
} from "../_components/ui";
import {
  downloadJson,
  emptyDraft,
  formatDate,
  formatDuration,
  formatLabel,
  pageIntro,
  type Draft,
  type Row,
} from "../_lib/api";
import type { Workspace } from "../_lib/workspace";

const lines = (v: string) => v.split("\n");
const words = (v: string) => (v.trim() ? v.trim().split(/\s+/).length : 0);

export function Blueprints({
  ws,
  ready,
  items,
  draft,
  setDraft,
  editing,
  setEditing,
  video,
  setVideo,
  onLinked,
  clearSource,
}: {
  ws: Workspace;
  ready: boolean;
  items: Row[];
  draft: Draft;
  setDraft: (d: Draft) => void;
  editing: Row | null;
  setEditing: (r: Row | null) => void;
  video: string;
  setVideo: (v: string) => void;
  onLinked: () => void;
  clearSource: () => void;
}) {
  const baseline = useMemo(
    () => JSON.stringify(editing ? editing.body : emptyDraft),
    [editing],
  );
  const dirty = JSON.stringify(draft) !== baseline;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft({ ...draft, [key]: value });
  const beats = draft.outline.filter((b) => b.trim());
  const scriptWords = words(draft.script);

  async function save() {
    const row = await ws.call<Row>("blueprint_save", {
      body: draft,
      ...(editing ? { id: editing.id, version: editing.version } : {}),
    });
    setEditing(row);
    setDraft(row.body as Draft);
    ws.setMessage("Saved revision " + row.version);
    await ws.refresh();
  }
  async function exportRow(row: Row) {
    await ws.run(async () => {
      const result = await ws.call("blueprint_export", {
        id: row.id,
        revision: row.version,
      });
      downloadJson(result, `creator-blueprint-${row.id}-v${row.version}.json`);
      ws.setMessage(`Exported revision ${row.version} as local JSON.`);
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="Create"
        title="Blueprints"
        intro={pageIntro.Blueprints}
        actions={<RefreshButton ws={ws} />}
      />
      <div className="editor-layout">
        <section className="sheet editor" aria-labelledby="editor-title">
          <div className="editor-head">
            <div>
              <p className="micro">
                {editing
                  ? "Saved blueprint"
                  : draft.idea_id
                    ? "From a saved idea"
                    : "Draft"}
              </p>
              <h3 id="editor-title">
                {editing
                  ? "Edit revision " + editing.version
                  : "New production blueprint"}
              </h3>
            </div>
            <span
              className={"save-state" + (dirty ? " is-dirty" : "")}
              aria-live="polite"
            >
              <span className="state-dot" aria-hidden="true" />
              {dirty
                ? "Unsaved changes"
                : editing
                  ? `Revision ${editing.version} is current`
                  : "Nothing written yet"}
            </span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ws.run(save);
            }}
          >
            <fieldset className="block">
              <legend>
                <span className="block-n">01</span> Concept
              </legend>
              <div className="field">
                <div className="field-top">
                  <label className="field-label" htmlFor="bp-title">
                    Working title
                  </label>
                  <Counter value={draft.working_title.length} max={200} />
                </div>
                <input
                  id="bp-title"
                  className="input-title"
                  required
                  maxLength={200}
                  value={draft.working_title}
                  onChange={(e) => set("working_title", e.target.value)}
                />
              </div>
              <div className="field-row">
                <div className="field">
                  <label className="field-label" htmlFor="bp-format">
                    Format
                  </label>
                  <select
                    id="bp-format"
                    value={draft.target_format}
                    onChange={(e) => set("target_format", e.target.value)}
                  >
                    <option value="youtube_shorts">Shorts</option>
                    <option value="youtube_long_form">Long form</option>
                  </select>
                </div>
                <div className="field">
                  <div className="field-top">
                    <label className="field-label" htmlFor="bp-duration">
                      Duration (seconds)
                    </label>
                    <span className="counter">
                      {formatDuration(draft.target_duration_seconds)}
                    </span>
                  </div>
                  <input
                    id="bp-duration"
                    type="number"
                    min={10}
                    max={3600}
                    value={draft.target_duration_seconds}
                    onChange={(e) =>
                      set("target_duration_seconds", Number(e.target.value))
                    }
                  />
                </div>
              </div>
            </fieldset>
            <fieldset className="block">
              <legend>
                <span className="block-n">02</span> Opening
              </legend>
              <div className="field">
                <label className="field-label" htmlFor="bp-hook">
                  Hook
                </label>
                <textarea
                  id="bp-hook"
                  rows={3}
                  value={draft.hook}
                  onChange={(e) => set("hook", e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="bp-titles">
                  Alternative titles (one per line)
                </label>
                <textarea
                  id="bp-titles"
                  rows={3}
                  value={draft.title_variants?.join("\n") ?? ""}
                  onChange={(e) =>
                    set("title_variants", lines(e.target.value).filter(Boolean))
                  }
                />
              </div>
            </fieldset>
            <fieldset className="block">
              <legend>
                <span className="block-n">03</span> Structure
              </legend>
              <div className="field-pair">
                <div className="field">
                  <label className="field-label" htmlFor="bp-outline">
                    Outline (one beat per line)
                  </label>
                  <textarea
                    id="bp-outline"
                    required
                    rows={6}
                    value={draft.outline.join("\n")}
                    onChange={(e) => set("outline", lines(e.target.value))}
                  />
                </div>
                <div className="beats">
                  <p className="micro">
                    {beats.length} beat{beats.length === 1 ? "" : "s"}
                  </p>
                  {beats.length ? (
                    <ol>
                      {beats.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ol>
                  ) : (
                    <p className="muted">
                      Beats appear here as you write them.
                    </p>
                  )}
                </div>
              </div>
            </fieldset>
            <fieldset className="block">
              <legend>
                <span className="block-n">04</span> Script
              </legend>
              <div className="field">
                <div className="field-top">
                  <label className="field-label" htmlFor="bp-script">
                    Script
                  </label>
                  <span
                    className="counter"
                    title="Estimate at 150 words per minute"
                  >
                    {scriptWords} words · ≈
                    {formatDuration((scriptWords / 150) * 60)} read
                  </span>
                </div>
                <textarea
                  id="bp-script"
                  className="script"
                  rows={10}
                  value={draft.script}
                  onChange={(e) => set("script", e.target.value)}
                />
              </div>
            </fieldset>
            <fieldset className="block">
              <legend>
                <span className="block-n">05</span> Packaging
              </legend>
              <div className="field">
                <label className="field-label" htmlFor="bp-thumb">
                  Thumbnail brief
                </label>
                <textarea
                  id="bp-thumb"
                  rows={3}
                  value={draft.thumbnail_brief}
                  onChange={(e) => set("thumbnail_brief", e.target.value)}
                />
              </div>
            </fieldset>
            <fieldset className="block">
              <legend>
                <span className="block-n">06</span> Evidence and risks
              </legend>
              <div className="field">
                <label className="field-label" htmlFor="bp-sources">
                  Research source URLs (one per line)
                </label>
                <textarea
                  id="bp-sources"
                  className="mono"
                  rows={3}
                  value={draft.research_sources.map((s) => s.url).join("\n")}
                  onChange={(e) =>
                    set(
                      "research_sources",
                      lines(e.target.value)
                        .filter(Boolean)
                        .map(
                          (url) =>
                            draft.research_sources.find(
                              (s) => s.url === url,
                            ) ?? {
                              url,
                              note: "User-selected inspiration; independently verify claims.",
                            },
                        ),
                    )
                  }
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="bp-risks">
                  Risks / unverified claims (one per line)
                </label>
                <textarea
                  id="bp-risks"
                  rows={3}
                  value={draft.risk_flags.join("\n")}
                  onChange={(e) =>
                    set("risk_flags", lines(e.target.value).filter(Boolean))
                  }
                />
              </div>
            </fieldset>
            <div className="savebar">
              <span className="savebar-note">
                {editing
                  ? `Saving creates revision ${editing.version + 1}.`
                  : "Saving creates revision 1."}
              </span>
              {editing && (
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => {
                    setEditing(null);
                    setDraft(emptyDraft);
                  }}
                >
                  <Icon name="plus" />
                  New blueprint
                </button>
              )}
              <button className="btn btn-primary" disabled={ws.busy}>
                Save blueprint revision
              </button>
            </div>
          </form>
        </section>
        <div className="bp-column">
          <div className="list-head">
            <h3>Saved blueprints</h3>
            <span className="count">{ready ? items.length : "—"}</span>
          </div>
          {!ready ? (
            <SkeletonRows count={3} />
          ) : !items.length ? (
            <div className="sheet">
              <EmptyState icon="blueprint" title="No saved blueprints">
                Save the form to create revision 1. Each later save adds a
                revision you can export as local JSON.
              </EmptyState>
            </div>
          ) : (
            items.map((row) => (
              <section
                key={row.id}
                className={
                  "bp" + (editing?.id === row.id ? " is-selected" : "")
                }
                aria-label={String(row.body.working_title)}
              >
                <h3>
                  {String(row.body.working_title)} <small>v{row.version}</small>
                </h3>
                {row.body.hook ? (
                  <p className="bp-hook">{String(row.body.hook)}</p>
                ) : null}
                <p className="bp-meta">
                  Format: {formatLabel(row.body.target_format)} ·{" "}
                  {String(row.body.target_duration_seconds)} seconds
                  {row.updated_at ? ` · ${formatDate(row.updated_at)}` : ""}
                </p>
                <div className="bp-actions">
                  <button
                    className="btn btn-quiet btn-small"
                    aria-pressed={editing?.id === row.id}
                    onClick={() => {
                      setEditing(row);
                      setDraft(row.body as Draft);
                      clearSource();
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    <Icon name="edit" size={16} />
                    Edit
                  </button>
                  <button
                    className="btn btn-secondary btn-small"
                    disabled={ws.busy}
                    onClick={() => void exportRow(row)}
                  >
                    <Icon name="download" size={16} />
                    Export blueprint JSON
                  </button>
                </div>
              </section>
            ))
          )}
          <section className="sheet link-video" aria-labelledby="link-title">
            <h3 id="link-title">Published video link</h3>
            <p>
              Link a video you published separately to inspect its
              owner-authorized performance.
            </p>
            {editing ? (
              <div className="query-row">
                <div className="field field-grow">
                  <label className="field-label" htmlFor="link-video">
                    Published video ID
                  </label>
                  <input
                    id="link-video"
                    className="mono"
                    value={video}
                    onChange={(e) => setVideo(e.target.value)}
                    maxLength={11}
                    spellCheck={false}
                  />
                </div>
                <div className="query-actions">
                  <button
                    className="btn btn-secondary"
                    disabled={ws.busy || !ws.status.google?.connected}
                    onClick={() =>
                      void ws.run(async () => {
                        await ws.call("link_video", {
                          id: editing.id,
                          video_id: video,
                        });
                        onLinked();
                        ws.setMessage(
                          "Published video linked after verifying it belongs to your channel.",
                        );
                      })
                    }
                  >
                    <Icon name="link" />
                    Link video & view performance
                  </button>
                </div>
              </div>
            ) : (
              <p className="muted">Open a saved blueprint to link a video.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
