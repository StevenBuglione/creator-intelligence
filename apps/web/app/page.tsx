"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./_components/Icon";
import { Mark } from "./_components/Mark";
import { useConfirm } from "./_components/dialog";
import { ErrorBanner, SuccessBanner } from "./_components/feedback";
import { StateTag } from "./_components/ui";
import {
  API,
  emptyDraft,
  pages,
  type Draft,
  type Observation,
  type PageName,
  type PolicyState,
  type Row,
  type Status,
} from "./_lib/api";
import type { Workspace } from "./_lib/workspace";
import { Consent, Login } from "./_screens/Gate";
import { Overview, type Summary } from "./_screens/Overview";
import { MyChannel } from "./_screens/MyChannel";
import { Research } from "./_screens/Research";
import { Channels } from "./_screens/Channels";
import { Ideas } from "./_screens/Ideas";
import { Blueprints } from "./_screens/Blueprints";
import { Settings } from "./_screens/Settings";

export default function Home() {
  const [csrf, setCsrf] = useState(""),
    [page, setPage] = useState<PageName>("Overview"),
    [loadedPage, setLoadedPage] = useState<PageName | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState<Status>({}),
    [items, setItems] = useState<Row[]>([]),
    [summary, setSummary] = useState<Summary | null>(null),
    [metrics, setMetrics] = useState<Observation[]>([]),
    [kind, setKind] = useState("overview"),
    [video, setVideo] = useState(""),
    [message, setMessage] = useState(""),
    [source, setSource] = useState(""),
    [ideaTitle, setIdeaTitle] = useState(""),
    [draft, setDraft] = useState<Draft>(emptyDraft),
    [editing, setEditing] = useState<Row | null>(null),
    [checked, setChecked] = useState(false);
  const [policy, setPolicy] = useState<PolicyState | null>(null);
  const [confirmElement, confirm] = useConfirm();
  const sequence = useRef(0);
  const heading = useRef<HTMLDivElement>(null);
  const navigated = useRef(false);

  async function request<T = unknown>(
    path: string,
    body?: unknown,
    token = csrf,
  ): Promise<T> {
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
      }
      throw new Error(data.error?.code ?? "Request failed");
    }
    return data.data as T;
  }
  const call = <T = unknown,>(op: string, input: unknown = {}) =>
    request<T>("operations/" + op, input);
  async function run(work: () => Promise<void>, keepMessage = false) {
    setBusy(true);
    setError("");
    if (!keepMessage) setMessage("");
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
    const seq = ++sequence.current,
      current = page;
    const invoke = <T,>(op: string, input: unknown = {}) =>
      request<T>("operations/" + op, input, token);
    const nextStatus = await invoke<Status>("status");
    if (seq !== sequence.current) return;
    setStatus(nextStatus);
    if (current === "Overview") {
      const [channels, videos, ideas, blueprints] = await Promise.all(
        ["channels", "videos", "ideas", "blueprints"].map((op) =>
          invoke<Row[]>(op),
        ),
      );
      const report = await invoke<Observation[]>("analytics", {
        kind: "overview",
      });
      if (seq !== sequence.current) return;
      setSummary({
        channels: channels!,
        videos: videos!,
        ideas: ideas!,
        blueprints: blueprints!,
      });
      setItems([]);
      setMetrics(report);
    } else {
      const op =
        current === "Research"
          ? "videos"
          : current === "Channels"
            ? "channels"
            : current === "Ideas"
              ? "ideas"
              : current === "Blueprints"
                ? "blueprints"
                : null;
      const rows = op ? await invoke<Row[]>(op) : [];
      if (seq !== sequence.current) return;
      setItems(rows);
      if (current === "My channel") {
        setMetrics([]);
        const report = await invoke<Observation[]>("analytics", {
          kind,
          ...(video ? { video_id: video } : {}),
        });
        if (seq !== sequence.current) return;
        setMetrics(report);
      }
    }
    setLoadedPage(current);
  }
  useEffect(() => {
    request<{ csrf: string; policy: PolicyState }>("session")
      .then((d) => {
        setCsrf(d.csrf);
        setPolicy(d.policy);
      })
      .catch(() => {})
      .finally(() => setChecked(true));
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    // Background reloads keep the confirmation of the action that caused them.
    if (csrf && policy?.accepted) void run(() => refresh(), true);
  }, [csrf, page, kind, policy?.accepted]);
  useEffect(() => {
    // Move focus to the new page title after navigation, not on first load.
    if (!navigated.current) return;
    heading.current?.querySelector("h2")?.focus({ preventScroll: true });
    document
      .querySelector('.nav [aria-current="page"]')
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [page]);

  function go(next: PageName) {
    navigated.current = true;
    setPage(next);
    setEditing(null);
    setDraft(emptyDraft);
    setError("");
    setMessage("");
    window.scrollTo({ top: 0 });
  }
  function moveTo(next: PageName) {
    navigated.current = true;
    setPage(next);
    window.scrollTo({ top: 0 });
  }
  const signOut = () =>
    void run(async () => {
      await request("logout", {});
      setCsrf("");
    });

  if (!checked) return <div className="boot" aria-busy="true" />;
  if (!csrf)
    return (
      <Login
        busy={busy}
        error={error}
        onSubmit={(password) =>
          run(async () => {
            const d = await request<{ csrf: string; policy: PolicyState }>(
              "login",
              { password },
            );
            setCsrf(d.csrf);
            setPolicy(d.policy);
          })
        }
      />
    );
  if (!policy?.accepted)
    return (
      <Consent
        policy={policy}
        busy={busy}
        error={error}
        onSignOut={signOut}
        onAccept={(choices) =>
          run(async () => {
            const current = await request<PolicyState>("policy/accept", {
              version: policy?.version,
              privacy_accepted: choices.privacy,
              terms_accepted: choices.terms,
              agent_data_allowed: choices.agent,
            });
            setPolicy(current);
          })
        }
      />
    );

  const ws: Workspace = {
    busy,
    status,
    policy,
    setPolicy,
    run,
    call,
    request,
    refresh: () => refresh(),
    setPage: moveTo,
    go,
    setMessage,
    signOut,
    clearSession: () => setCsrf(""),
    confirm,
  };
  const ready = loadedPage === page;
  const google = status.google;
  const groups = ["Evidence", "Create", "Workspace"] as const;
  return (
    <div className="app">
      <a className="skip" href="#content">
        Skip to content
      </a>
      <aside className="rail">
        <div className="brand">
          <Mark />
          <h1>
            Creator <span>Intelligence</span>
          </h1>
        </div>
        <nav aria-label="Workspace" className="nav">
          {groups.map((group) => (
            <div className="nav-group" key={group}>
              <p className="nav-heading" aria-hidden="true">
                {group}
              </p>
              {pages
                .filter((p) => p.group === group)
                .map((p) => (
                  <button
                    aria-current={page === p.name ? "page" : undefined}
                    key={p.name}
                    onClick={() => go(p.name)}
                  >
                    <Icon name={p.icon} />
                    <span>{p.name}</span>
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <div className="rail-foot">
          <p className="nav-heading">Workflow</p>
          <ol className="workflow">
            {[
              ["Research", ["Research", "Channels", "My channel", "Overview"]],
              ["Idea", ["Ideas"]],
              ["Blueprint", ["Blueprints"]],
              ["Local JSON export", ["Blueprints"]],
            ].map(([label, on]) => (
              <li
                key={label as string}
                className={
                  (on as string[]).includes(page) ? "is-on" : undefined
                }
              >
                {label as string}
              </li>
            ))}
          </ol>
          <p className="rail-links">
            <a href="/privacy">Privacy & data controls</a>
            <a href="/terms">Terms of use</a>
          </p>
        </div>
      </aside>
      <div className="main-col">
        <div className="contextbar">
          {status.mode === "demo" ? (
            <span
              className="mode-badge"
              title="Deterministic fixtures. Not real channel data."
            >
              SYNTHETIC DEMONSTRATION
            </span>
          ) : (
            <span className="mode-live">Creator workspace</span>
          )}
          <StateTag tone={google?.connected ? "on" : "off"}>
            {google?.connected
              ? "Owner channel connected"
              : "Owner channel disconnected"}
          </StateTag>
          <StateTag tone={policy.agent_data_allowed ? "warn" : "neutral"}>
            {policy.agent_data_allowed ? "MCP sharing on" : "MCP sharing off"}
          </StateTag>
          <span className="context-scope">
            Standalone research and planning
          </span>
        </div>
        <main id="content" className="content" aria-busy={busy}>
          <div
            className={"progress" + (busy ? " is-on" : "")}
            aria-hidden="true"
          />
          {busy && (
            <p role="status" className="sr-only">
              Working…
            </p>
          )}
          <div className="feedback">
            {error && (
              <ErrorBanner
                code={error}
                note="No values were invented."
                onDismiss={() => setError("")}
              />
            )}
            {message && (
              <SuccessBanner
                message={message}
                onDismiss={() => setMessage("")}
              />
            )}
          </div>
          <div key={page} className="page" ref={heading}>
            {page === "Overview" && (
              <Overview
                ws={ws}
                ready={ready}
                summary={summary}
                metrics={metrics}
              />
            )}
            {page === "My channel" && (
              <MyChannel
                ws={ws}
                ready={ready}
                metrics={metrics}
                kind={kind}
                setKind={setKind}
                video={video}
                setVideo={setVideo}
              />
            )}
            {page === "Research" && (
              <Research
                ws={ws}
                ready={ready}
                items={items}
                onInspire={(url) => {
                  setSource(url);
                  setIdeaTitle("");
                  setMessage("");
                  moveTo("Ideas");
                }}
              />
            )}
            {page === "Channels" && (
              <Channels ws={ws} ready={ready} items={items} />
            )}
            {page === "Ideas" && (
              <Ideas
                ws={ws}
                ready={ready}
                items={items}
                title={ideaTitle}
                setTitle={setIdeaTitle}
                source={source}
                setSource={setSource}
                onDevelop={(next) => {
                  setEditing(null);
                  setDraft(next);
                  setMessage("");
                  moveTo("Blueprints");
                }}
              />
            )}
            {page === "Blueprints" && (
              <Blueprints
                ws={ws}
                ready={ready}
                items={items}
                draft={draft}
                setDraft={setDraft}
                editing={editing}
                setEditing={setEditing}
                video={video}
                setVideo={setVideo}
                onLinked={() => {
                  setKind("overview");
                  moveTo("My channel");
                }}
                clearSource={() => setSource("")}
              />
            )}
            {page === "Settings" && <Settings ws={ws} />}
          </div>
          <footer className="content-foot">
            <span>Research → idea → blueprint → local export</span>
            <a href="/privacy">Privacy & data controls</a>
            <a href="/terms">Terms of use</a>
          </footer>
        </main>
      </div>
      {confirmElement}
    </div>
  );
}
