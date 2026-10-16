"use client";
import { useEffect, useState } from "react";
import { policyLinks } from "../../../packages/domain/src/policy";
type PolicyState = {
  version: string;
  accepted: boolean;
  accepted_at: string | null;
  agent_data_allowed: boolean;
};
type Row = {
  id: string;
  version: number;
  body: Record<string, unknown>;
  meta: {
    source: string;
    ownership?: string;
    retrieved_at: string;
    stale: boolean;
    not_available?: string;
  };
  updated_at: string;
};
type Observation = {
  data: {
    rows?: Record<string, unknown>[];
    impressions?: number;
    ctr?: number;
    date?: string;
  };
  meta: Row["meta"];
};
const API = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:4311";
const empty = {
  idea_id: undefined as string | undefined,
  working_title: "",
  target_format: "youtube_shorts",
  target_duration_seconds: 60,
  hook: "",
  outline: [""],
  research_sources: [] as { url: string; note: string }[],
  thumbnail_brief: "",
  script: "",
  risk_flags: [] as string[],
  title_variants: [] as string[],
};
export default function Home() {
  const [csrf, setCsrf] = useState(""),
    [password, setPassword] = useState(""),
    [page, setPage] = useState("Overview"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState<Record<string, unknown>>({}),
    [items, setItems] = useState<Row[]>([]),
    [metrics, setMetrics] = useState<Observation[]>([]),
    [identifier, setIdentifier] = useState(""),
    [title, setTitle] = useState(""),
    [angle, setAngle] = useState(""),
    [source, setSource] = useState(""),
    [draft, setDraft] = useState(empty),
    [editing, setEditing] = useState<Row | null>(null),
    [kind, setKind] = useState("overview"),
    [video, setVideo] = useState(""),
    [message, setMessage] = useState(""),
    [agentDraft, setAgentDraft] = useState(
      '{"operation":"idea_save","input":{"body":{"title":"","angle":"","references":[]}}}',
    ),
    [agentGrant, setAgentGrant] = useState("");
  const [policy, setPolicy] = useState<PolicyState | null>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [allowAgent, setAllowAgent] = useState(false);
  async function request(path: string, body?: unknown, token = csrf) {
    const r = await fetch(API + "/api/v1/" + path, {
      method: body === undefined ? "GET" : "POST",
      credentials: "include",
      headers:
        body === undefined
          ? {}
          : { "Content-Type": "application/json", "X-CSRF-Token": token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) {
      if (data.error?.code === "POLICY_ACCEPTANCE_REQUIRED") {
        // A server upgrade may introduce a new version while this tab is open.
        // Load the current agreement instead of submitting the stale version.
        const session = await fetch(API + "/api/v1/session", {
          credentials: "include",
        });
        if (session.ok) {
          const current = (await session.json()).data;
          setPolicy(current.policy);
          setCsrf(current.csrf);
        } else {
          setPolicy(null);
          setCsrf("");
        }
        setPrivacyAccepted(false);
        setTermsAccepted(false);
        setAllowAgent(false);
      }
      throw new Error(data.error?.code ?? "Request failed");
    }
    return data.data;
  }
  const call = (op: string, input: unknown = {}) =>
    request("operations/" + op, input);
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }
  async function refresh(token = csrf) {
    if (!token || !policy?.accepted) return;
    const invoke = (op: string, input: unknown = {}) =>
      request("operations/" + op, input, token);
    setStatus(await invoke("status"));
    const op =
      page === "Research"
        ? "videos"
        : page === "Channels"
          ? "channels"
          : page === "Ideas"
            ? "ideas"
            : page === "Blueprints"
              ? "blueprints"
              : null;
    setItems(op ? await invoke(op) : []);
    if (page === "My channel" || page === "Overview")
      setMetrics(
        await invoke("analytics", {
          kind,
          ...(video ? { video_id: video } : {}),
        }),
      );
  }
  useEffect(() => {
    request("session")
      .then((d) => {
        setCsrf(d.csrf);
        setPolicy(d.policy);
      })
      .catch(() => {});
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    if (csrf && policy?.accepted) void run(() => refresh());
  }, [csrf, page, kind, policy?.accepted]);
  async function saveBlueprint() {
    const row = await call("blueprint_save", {
      body: draft,
      ...(editing ? { id: editing.id, version: editing.version } : {}),
    });
    setEditing(row);
    setMessage("Saved revision " + row.version);
    await refresh();
  }
  async function exportBlueprint(row: Row) {
    await run(async () => {
      const result = await call("blueprint_export", {
        id: row.id,
        revision: row.version,
      });
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(result, null, 2)], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `creator-blueprint-${row.id}-v${row.version}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(`Exported revision ${row.version} as local JSON.`);
    });
  }
  const google = status.google as
    | { connected?: boolean; configured?: boolean; channel_id?: string }
    | undefined;
  if (!csrf)
    return (
      <main className="login">
        <p className="eyebrow">LOCAL WORKSPACE</p>
        <h1>Creator Intelligence</h1>
        <p>
          Evidence for the next video. Original ideas. A clear plan for your
          next video.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const d = await request("login", { password });
              setPassword("");
              setCsrf(d.csrf);
              setPolicy(d.policy);
            });
          }}
        >
          <label>
            Owner password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button disabled={busy}>Open workspace</button>
        </form>
        <p className="muted">
          Use the private local credential helper to copy your owner password.
          Credentials stay on this computer.
        </p>
        {error && <p role="alert">{error}</p>}
        <a href="/privacy">Privacy & data controls</a>
      </main>
    );
  if (!policy?.accepted)
    return (
      <main className="login">
        <p className="eyebrow">YOUR PRIVACY AND CHOICES</p>
        <h1>Before you use Creator Intelligence</h1>
        <p>
          This application uses YouTube API Services for public research and
          reports from your authorized channel. Records and drafts are stored
          locally. Connecting Google requires your separate consent.
        </p>
        <p>
          Policy version {policy?.version}. Read the{" "}
          <a href="/privacy" target="_blank" rel="noreferrer">
            privacy policy
          </a>
          ,{" "}
          <a href="/terms" target="_blank" rel="noreferrer">
            terms of use
          </a>
          ,{" "}
          <a href={policyLinks.youtube} target="_blank" rel="noreferrer">
            YouTube Terms of Service
          </a>{" "}
          and{" "}
          <a href={policyLinks.google} target="_blank" rel="noreferrer">
            Google Privacy Policy
          </a>
          .
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const current = await request("policy/accept", {
                version: policy?.version,
                privacy_accepted: privacyAccepted,
                terms_accepted: termsAccepted,
                agent_data_allowed: allowAgent,
              });
              setPolicy(current);
            });
          }}
        >
          <label>
            <input
              type="checkbox"
              required
              checked={privacyAccepted}
              onChange={(e) => setPrivacyAccepted(e.target.checked)}
            />{" "}
            I agree to the privacy policy.
          </label>
          <label>
            <input
              type="checkbox"
              required
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
            />{" "}
            I agree to the terms of use, including the YouTube Terms of Service.
          </label>
          <label>
            <input
              type="checkbox"
              checked={allowAgent}
              onChange={(e) => setAllowAgent(e.target.checked)}
            />{" "}
            Optional: allow my connected MCP client to read requested workspace
            data, including owner reports, and send it to its AI provider under
            that account's settings.
          </label>
          <p className="muted">
            Leave MCP sharing off to use the local interface only. Check your AI
            provider's privacy settings before enabling it. You can turn sharing
            off in Settings. Google credentials are never included in MCP
            results.
          </p>
          <button disabled={busy || !privacyAccepted || !termsAccepted}>
            Accept policies & open workspace
          </button>
        </form>
        {error && <p role="alert">{error}</p>}
        <button
          onClick={() =>
            void run(async () => {
              await request("logout", {});
              setCsrf("");
            })
          }
        >
          Sign out without accepting
        </button>
        <p>
          <a href={policyLinks.privacy}>
            Developer contact and data deletion information
          </a>
        </p>
      </main>
    );
  return (
    <div className="shell">
      <aside>
        <p className="eyebrow">LOCAL / PRIVATE</p>
        <h1>
          Creator
          <br />
          Intelligence<span>.</span>
        </h1>
        <nav aria-label="Workspace">
          {[
            "Overview",
            "My channel",
            "Research",
            "Channels",
            "Ideas",
            "Blueprints",
            "Settings",
          ].map((p) => (
            <button
              aria-current={page === p ? "page" : undefined}
              key={p}
              onClick={() => {
                setPage(p);
                setEditing(null);
                setDraft(empty);
              }}
            >
              {p}
            </button>
          ))}
        </nav>
        <p className="muted">Research → idea → blueprint → local export</p>
        <p>
          <a href="/privacy">Privacy & data controls</a> ·{" "}
          <a href="/terms">Terms of use</a>
        </p>
      </aside>
      <main>
        <header>
          <div>
            <p className="eyebrow">
              {status.mode === "demo"
                ? "SYNTHETIC DEMONSTRATION"
                : "CREATOR WORKSPACE"}
            </p>
            <h2>{page}</h2>
          </div>
          <button disabled={busy} onClick={() => void run(() => refresh())}>
            Refresh view
          </button>
        </header>
        <div className="status">
          <span>
            {google?.connected
              ? "Owner channel connected"
              : "Owner channel disconnected"}
          </span>
          <span>Standalone research and planning</span>
        </div>
        {["Overview", "My channel", "Research", "Channels"].includes(page) &&
          status.mode !== "demo" && (
            <div className="youtube-attribution">
              <a
                href="https://www.youtube.com/"
                target="_blank"
                rel="noreferrer"
              >
                <img
                  src="/youtube-developed-light.png"
                  width="280"
                  height="100"
                  alt="Developed with YouTube"
                />
              </a>
              <span>
                Official YouTube API records. Creative drafts are independent
                output.
              </span>
            </div>
          )}
        {error && (
          <p className="alert" role="alert">
            {error.replaceAll("_", " ")}. No values were invented.
          </p>
        )}
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
        {busy && <p role="status">Working…</p>}
        {(page === "Overview" || page === "My channel") && (
          <>
            <section>
              <h3>Your channel, with evidence</h3>
              <p>
                Views and engaged views are separate measures. Missing values
                mean not available. Stored reports may lag YouTube.
              </p>
              <div className="actions">
                <label>
                  Report
                  <select
                    aria-label="Report"
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                  >
                    {["overview", "traffic", "retention", "reach"].map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Video ID (required for retention/reach)
                  <input
                    value={video}
                    onChange={(e) => setVideo(e.target.value)}
                    placeholder="11-character video ID"
                  />
                </label>
                <button
                  disabled={busy}
                  onClick={() => void run(() => refresh())}
                >
                  Load stored report
                </button>
                <button
                  disabled={busy || !google?.connected}
                  onClick={() =>
                    void run(async () => {
                      const to = new Date(Date.now() - 2 * 86400_000)
                          .toISOString()
                          .slice(0, 10),
                        from = new Date(Date.now() - 28 * 86400_000)
                          .toISOString()
                          .slice(0, 10);
                      await call(
                        kind === "reach" ? "reporting_sync" : "analytics_sync",
                        {
                          kind,
                          from,
                          to,
                          ...(video ? { video_id: video } : {}),
                        },
                      );
                      await refresh();
                    })
                  }
                >
                  Sync from YouTube
                </button>
              </div>
            </section>
            <section>
              {!metrics.length ? (
                <div className="empty">
                  <h3>Not available yet</h3>
                  <p>
                    {google?.connected
                      ? "Sync the selected report. Reach reports can remain pending while Google prepares them."
                      : "Connect your owner channel in Settings to load private analytics."}
                  </p>
                </div>
              ) : (
                metrics.slice(0, kind === "reach" ? 100 : 1).map((o, i) => (
                  <div key={i}>
                    <Provenance meta={o.meta} />
                    {o.data.rows ? (
                      <>
                        <MetricChart rows={o.data.rows} />
                        <DataTable rows={o.data.rows} />
                      </>
                    ) : (
                      <DataTable
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
                    )}
                  </div>
                ))
              )}
            </section>
            <section>
              <h3>Ready for the next video</h3>
              <p>
                Add a public channel, select a source, and write an original
                angle. Keep the evidence attached as you develop the blueprint.
              </p>
              <button onClick={() => setPage("Channels")}>
                Add research sources
              </button>
            </section>
          </>
        )}
        {page === "Channels" && (
          <>
            <section>
              <form
                className="actions"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await call("channel_add", { identifier });
                    setIdentifier("");
                    await refresh();
                  });
                }}
              >
                <label>
                  Public channel ID or @handle
                  <input
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="@channel-handle"
                  />
                </label>
                <button disabled={busy}>Track channel</button>
              </form>
              <p className="muted">
                Tracking starts at the first observation. Earlier counts are
                unavailable. Refresh or delete public records within 30 days.
              </p>
            </section>
            {items.map((row) => (
              <section key={row.id}>
                <h3>{String(row.body.title)}</h3>
                <p>{row.id}</p>
                <Provenance meta={row.meta} />
                <p>Tracking since {String(row.body.tracking_since)}</p>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await call("channel_remove", { id: row.id });
                      await refresh();
                    })
                  }
                >
                  Remove channel and cached records
                </button>
              </section>
            ))}
          </>
        )}
        {page === "Research" && (
          <>
            <section>
              <form
                className="actions"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await call("video_lookup", { id: identifier });
                    setIdentifier("");
                    await refresh();
                  });
                }}
              >
                <label>
                  Public video ID
                  <input
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    maxLength={11}
                  />
                </label>
                <button disabled={busy}>Look up video</button>
              </form>
            </section>
            <p>
              Raw public records from tracked channels. Format remains unknown
              unless the source establishes it. No competitor scores or
              rankings.
            </p>
            <div className="cards">
              {items.map((row) => (
                <section key={row.id}>
                  <h3>{String(row.body.title)}</h3>
                  <a
                    href={"https://www.youtube.com/watch?v=" + row.id}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View source video ↗
                  </a>
                  <Provenance meta={row.meta} />
                  <DataTable
                    rows={[row.body.statistics as Record<string, unknown>]}
                  />
                  <p>Format: {String(row.body.format)}</p>
                  <button
                    onClick={() => {
                      setSource("https://www.youtube.com/watch?v=" + row.id);
                      setTitle("");
                      setPage("Ideas");
                    }}
                  >
                    Use as inspiration
                  </button>
                </section>
              ))}
            </div>
            {!items.length && (
              <p className="empty">
                Add a channel to collect its visible uploads through the
                official API.
              </p>
            )}
          </>
        )}
        {page === "Ideas" && (
          <>
            <section>
              <h3>Write a distinct angle</h3>
              <button
                disabled={busy || !title}
                onClick={() =>
                  void run(async () => {
                    const result = await call("suggest_angles", {
                      topic: title,
                      source_urls: source ? [source] : [],
                    });
                    setAngle(
                      "AI-generated creative suggestions; verify claims.\n\n" +
                        result.angles
                          .map(
                            (a: {
                              title: string;
                              angle: string;
                              hook: string;
                              unverified_claims: string[];
                            }) =>
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
                    setMessage(
                      "Local model suggestions — review claims and select an original angle.",
                    );
                  })
                }
              >
                Suggest three angles with local model
              </button>
              <p className="muted">
                Optional local model. You can also write here or use Claude with
                the MCP evidence tools.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await call("idea_save", {
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
                    await refresh();
                  });
                }}
              >
                <label>
                  Working title
                  <input
                    required
                    maxLength={200}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <label>
                  Original angle
                  <textarea
                    value={angle}
                    onChange={(e) => setAngle(e.target.value)}
                  />
                </label>
                <label>
                  Source URL (optional)
                  <input
                    type="url"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                  />
                </label>
                <button disabled={busy}>Save idea</button>
              </form>
            </section>
            {items.map((row) => (
              <section key={row.id}>
                <h3>{String(row.body.title)}</h3>
                <p>{String(row.body.angle)}</p>
                <button
                  onClick={() => {
                    setEditing(null);
                    setDraft({
                      ...empty,
                      idea_id: row.id,
                      working_title: String(row.body.title),
                      hook: String(row.body.angle),
                      research_sources: (row.body.references ?? []) as {
                        url: string;
                        note: string;
                      }[],
                    });
                    setPage("Blueprints");
                  }}
                >
                  Develop blueprint
                </button>
              </section>
            ))}
          </>
        )}
        {page === "Blueprints" && (
          <>
            <section>
              <h3>
                {editing
                  ? "Edit revision " + editing.version
                  : "New production blueprint"}
              </h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(saveBlueprint);
                }}
              >
                <label>
                  Working title
                  <input
                    required
                    maxLength={200}
                    value={draft.working_title}
                    onChange={(e) =>
                      setDraft({ ...draft, working_title: e.target.value })
                    }
                  />
                </label>
                <div className="actions">
                  <label>
                    Format
                    <select
                      value={draft.target_format}
                      onChange={(e) =>
                        setDraft({ ...draft, target_format: e.target.value })
                      }
                    >
                      <option value="youtube_shorts">Shorts</option>
                      <option value="youtube_long_form">Long form</option>
                    </select>
                  </label>
                  <label>
                    Duration (seconds)
                    <input
                      type="number"
                      min={10}
                      max={3600}
                      value={draft.target_duration_seconds}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          target_duration_seconds: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                <label>
                  Hook
                  <textarea
                    value={draft.hook}
                    onChange={(e) =>
                      setDraft({ ...draft, hook: e.target.value })
                    }
                  />
                </label>
                <label>
                  Outline (one beat per line)
                  <textarea
                    required
                    value={draft.outline.join("\n")}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        outline: e.target.value.split("\n"),
                      })
                    }
                  />
                </label>
                <label>
                  Alternative titles (one per line)
                  <textarea
                    value={draft.title_variants?.join("\n") ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        title_variants: e.target.value
                          .split("\n")
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
                <label>
                  Script
                  <textarea
                    rows={8}
                    value={draft.script}
                    onChange={(e) =>
                      setDraft({ ...draft, script: e.target.value })
                    }
                  />
                </label>
                <label>
                  Thumbnail brief
                  <textarea
                    value={draft.thumbnail_brief}
                    onChange={(e) =>
                      setDraft({ ...draft, thumbnail_brief: e.target.value })
                    }
                  />
                </label>
                <label>
                  Research source URLs (one per line)
                  <textarea
                    value={draft.research_sources.map((s) => s.url).join("\n")}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        research_sources: e.target.value
                          .split("\n")
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
                      })
                    }
                  />
                </label>
                <label>
                  Risks / unverified claims (one per line)
                  <textarea
                    value={draft.risk_flags.join("\n")}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        risk_flags: e.target.value.split("\n").filter(Boolean),
                      })
                    }
                  />
                </label>
                <button disabled={busy}>Save blueprint revision</button>
              </form>
            </section>
            {items.map((row) => (
              <section key={row.id}>
                <h3>
                  {String(row.body.working_title)} <small>v{row.version}</small>
                </h3>
                <p>{String(row.body.hook)}</p>
                <p>
                  Format: {String(row.body.target_format)} ·{" "}
                  {String(row.body.target_duration_seconds)} seconds
                </p>
                <div className="actions">
                  <button
                    onClick={() => {
                      setEditing(row);
                      setDraft(row.body as typeof draft);
                      setSource("");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Edit
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => void exportBlueprint(row)}
                  >
                    Export blueprint JSON
                  </button>
                </div>
              </section>
            ))}
            <section>
              <h3>Published video link</h3>
              {editing && (
                <div className="actions">
                  <label>
                    Published video ID
                    <input
                      value={video}
                      onChange={(e) => setVideo(e.target.value)}
                      maxLength={11}
                    />
                  </label>
                  <button
                    disabled={busy || !google?.connected}
                    onClick={() =>
                      void run(async () => {
                        await call("link_video", {
                          id: editing.id,
                          video_id: video,
                        });
                        setPage("My channel");
                        setKind("overview");
                        setMessage(
                          "Published video linked after verifying it belongs to your channel.",
                        );
                      })
                    }
                  >
                    Link video & view performance
                  </button>
                </div>
              )}
              <p>
                Link a video you published separately to inspect its
                owner-authorized performance.
              </p>
            </section>
          </>
        )}
        {page === "Settings" && (
          <>
            <section>
              <h3>Privacy and MCP sharing</h3>
              <p>
                Policy {policy.version} accepted{" "}
                {policy.accepted_at
                  ? new Date(policy.accepted_at).toLocaleString()
                  : ""}
                . <a href="/privacy">Review privacy and data controls</a>.
              </p>
              <p>
                MCP data sharing:{" "}
                {policy.agent_data_allowed ? "enabled" : "disabled"}. Requested
                records may reach the connected AI provider. Verify its account
                settings before sharing.
              </p>
              <button
                disabled={busy}
                onClick={() => {
                  if (
                    !policy.agent_data_allowed &&
                    !window.confirm(
                      "Allow the connected MCP client to read requested workspace records, including owner analytics, under its provider's privacy settings?",
                    )
                  )
                    return;
                  void run(async () =>
                    setPolicy(
                      await request("policy/agent-data", {
                        allowed: !policy.agent_data_allowed,
                      }),
                    ),
                  );
                }}
              >
                {policy.agent_data_allowed
                  ? "Disable MCP data sharing"
                  : "Enable MCP data sharing"}
              </button>
            </section>
            <section>
              <h3>Authorize one Claude draft</h3>
              <p>
                Review the exact idea or blueprint JSON from Claude. This
                authorizes one save for 15 minutes. You can review and export
                saved blueprints as local JSON files.
              </p>
              <label>
                Draft request JSON
                <textarea
                  rows={8}
                  value={agentDraft}
                  onChange={(e) => {
                    setAgentDraft(e.target.value);
                    setAgentGrant("");
                  }}
                />
              </label>
              <button
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Authorize this exact draft to be saved once by Claude?",
                    )
                  )
                    void run(async () => {
                      const request = JSON.parse(agentDraft);
                      const grant = await call("agent_authorize", request);
                      setAgentGrant(
                        JSON.stringify(
                          {
                            ...grant.input,
                            authorization: grant.authorization,
                          },
                          null,
                          2,
                        ),
                      );
                    });
                }}
              >
                Authorize reviewed draft
              </button>
              {agentGrant && (
                <>
                  <label>
                    One-use authorized input for Claude
                    <textarea readOnly rows={8} value={agentGrant} />
                  </label>
                  <button
                    onClick={() =>
                      void navigator.clipboard.writeText(agentGrant)
                    }
                  >
                    Copy authorized input
                  </button>
                </>
              )}
            </section>
            <section>
              <h3>Google access</h3>
              <p>
                Read-only access for Creator Intelligence. Your existing upload
                and publish connection stays intact.
              </p>
              <button
                disabled={busy || !google?.configured}
                onClick={() =>
                  void run(async () => {
                    const d = await request("auth/google/start", {});
                    window.location.assign(d.url);
                  })
                }
              >
                Connect owner channel
              </button>
              <button
                disabled={busy || !google?.connected}
                onClick={() => {
                  if (
                    window.confirm(
                      "Disconnect this app and delete its stored owner analytics?",
                    )
                  )
                    void run(async () => {
                      await call("disconnect");
                      await refresh();
                    });
                }}
              >
                Remove local connection & owner metrics
              </button>
              {!google?.configured && (
                <p>Dedicated Google OAuth client configuration is pending.</p>
              )}
              <details>
                <summary>
                  Revoke Google access for the entire shared project
                </summary>
                <p>
                  Revocation can disconnect other clients using this Google
                  project, including a publisher. Local removal above only
                  removes this app's stored connection.
                </p>
                <button
                  disabled={busy || !google?.connected}
                  onClick={() => {
                    const confirmation = window.prompt(
                      "This revokes the Google project grant and can affect other clients, including publishing. To proceed, type REVOKE GOOGLE PROJECT INCLUDING PUBLISHING",
                    );
                    if (
                      confirmation ===
                      "REVOKE GOOGLE PROJECT INCLUDING PUBLISHING"
                    )
                      void run(async () => {
                        await call("revoke_google_project", { confirmation });
                        await refresh();
                        setMessage(
                          "Google project access revoked. Existing publishing now requires reauthorization.",
                        );
                      });
                  }}
                >
                  Revoke entire project, including publishing
                </button>
                <p>
                  <a
                    href="https://security.google.com/settings/security/permissions"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Manage Google Account permissions
                  </a>
                </p>
              </details>
            </section>
            <section>
              <h3>Quota & access status</h3>
              <pre>{JSON.stringify(status.quota, null, 2)}</pre>
              <p>
                Derived competitor metrics remain disabled until genuine YouTube
                approval.
              </p>
              <a
                href="https://developers.google.com/youtube/terms/derived-metrics-policy"
                target="_blank"
                rel="noreferrer"
              >
                Official approval requirements
              </a>
            </section>
            <section>
              <h3>Your data</h3>
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const data = await call("export");
                    const url = URL.createObjectURL(
                      new Blob([JSON.stringify(data, null, 2)], {
                        type: "application/json",
                      }),
                    );
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "creator-intelligence-export.json";
                    a.click();
                    URL.revokeObjectURL(url);
                  })
                }
              >
                Export data
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Delete all data and this app’s Google connection? This cannot be undone.",
                    )
                  )
                    void run(async () => {
                      await call("delete_data");
                      setCsrf("");
                    });
                }}
              >
                Delete app data
              </button>
              <p>
                <a href="/privacy">Privacy & retention</a>
              </p>
              <button
                onClick={() =>
                  void run(async () => {
                    await request("logout", {});
                    setCsrf("");
                  })
                }
              >
                Sign out
              </button>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
function Provenance({ meta }: { meta: Row["meta"] }) {
  return (
    <p className="provenance">
      {meta.source.startsWith("youtube_") ? (
        <a href="https://www.youtube.com/" target="_blank" rel="noreferrer">
          Source: YouTube
        </a>
      ) : meta.source === "synthetic" ? (
        "Synthetic demonstration — not YouTube data"
      ) : (
        meta.source
      )}{" "}
      ·{" "}
      {meta.ownership?.replaceAll("_", " ") ??
        "source classification unavailable"}{" "}
      ·{" "}
      {meta.retrieved_at
        ? new Date(meta.retrieved_at).toLocaleString()
        : "No timestamp"}{" "}
      · {meta.stale ? "Stored / refresh due" : "Stored observation"}
      {meta.not_available ? " · " + meta.not_available : ""}
    </p>
  );
}
function DataTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <p className="empty">Not available</p>;
  const keys = Object.keys(rows[0] ?? {});
  return (
    <div className="table">
      <table>
        <thead>
          <tr>
            {keys.map((k) => (
              <th key={k}>{k.replaceAll("_", " ")}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {keys.map((k) => (
                <td key={k}>
                  {r[k] === null || r[k] === undefined
                    ? "Not available"
                    : typeof r[k] === "object"
                      ? JSON.stringify(r[k])
                      : String(r[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function MetricChart({ rows }: { rows: Record<string, unknown>[] }) {
  const metric =
      "audienceWatchRatio" in (rows[0] ?? {}) ? "audienceWatchRatio" : "views",
    points = rows.map((r) => r[metric]);
  if (
    points.length < 2 ||
    points.some((v) => typeof v !== "number" || !Number.isFinite(v))
  )
    return null;
  const values = points as number[],
    max = Math.max(...values, 1),
    coordinates = values
      .map(
        (v, i) =>
          `${40 + (i * 520) / (values.length - 1)},${160 - (v / max) * 120}`,
      )
      .join(" ");
  return (
    <figure style={{ margin: "1rem 0" }}>
      <svg
        role="img"
        aria-label={
          metric + " from stored official observations; values in table below"
        }
        viewBox="0 0 600 200"
        style={{ width: "100%", maxHeight: 240 }}
      >
        <path d="M40 25 V160 H565" fill="none" stroke="currentColor" />
        <polyline
          points={coordinates}
          fill="none"
          stroke="#b0652a"
          strokeWidth="3"
        />
        <text x="4" y="35" fill="currentColor" fontSize="12">
          {max.toLocaleString()}
        </text>
        <text x="4" y="165" fill="currentColor" fontSize="12">
          0
        </text>
        <text x="40" y="190" fill="currentColor" fontSize="12">
          {String(
            rows[0]?.day ?? rows[0]?.elapsedVideoTimeRatio ?? "First sample",
          )}
        </text>
        <text x="470" y="190" fill="currentColor" fontSize="12">
          {String(
            rows.at(-1)?.day ??
              rows.at(-1)?.elapsedVideoTimeRatio ??
              "Last sample",
          )}
        </text>
      </svg>
      <figcaption>
        {metric} · source and timestamps above; exact values below
      </figcaption>
    </figure>
  );
}
