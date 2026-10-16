"use client";
import { useMemo, useState } from "react";
import { Icon } from "../_components/Icon";
import { DataTable, PageHeader, StateTag } from "../_components/ui";
import {
  downloadJson,
  formatDateTime,
  pageIntro,
  type PolicyState,
} from "../_lib/api";
import type { Workspace } from "../_lib/workspace";

const sections = [
  ["privacy", "Privacy and MCP sharing"],
  ["draft", "Claude draft authorization"],
  ["google", "Google access"],
  ["quota", "Quota and access status"],
  ["data", "Your data"],
] as const;

export function Settings({ ws }: { ws: Workspace }) {
  const { policy, status } = ws;
  const google = status.google;
  const [agentDraft, setAgentDraft] = useState(
    '{"operation":"idea_save","input":{"body":{"title":"","angle":"","references":[]}}}',
  );
  const [agentGrant, setAgentGrant] = useState("");
  const [copied, setCopied] = useState(false);
  const parsed = useMemo(() => {
    try {
      const value = JSON.parse(agentDraft) as { operation?: unknown };
      return {
        ok: true as const,
        value,
        operation: String(value?.operation ?? "missing"),
      };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Invalid JSON",
      };
    }
  }, [agentDraft]);

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        intro={pageIntro.Settings}
      />
      <div className="settings-layout">
        <nav className="toc" aria-label="Settings sections">
          {sections.map(([id, label]) => (
            <a key={id} href={"#" + id}>
              {label}
            </a>
          ))}
        </nav>
        <div className="settings-body">
          <section
            id="privacy"
            className="sheet setting"
            aria-labelledby="privacy-title"
          >
            <h3 id="privacy-title">Privacy and MCP sharing</h3>
            <dl className="facts">
              <div>
                <dt>Policy</dt>
                <dd>
                  <StateTag tone="on">Accepted</StateTag>
                  <span>
                    Policy {policy.version} accepted{" "}
                    {policy.accepted_at
                      ? formatDateTime(policy.accepted_at)
                      : ""}
                  </span>
                </dd>
              </div>
              <div>
                <dt>MCP data sharing</dt>
                <dd>
                  <StateTag
                    tone={policy.agent_data_allowed ? "warn" : "neutral"}
                  >
                    {policy.agent_data_allowed ? "enabled" : "disabled"}
                  </StateTag>
                </dd>
              </div>
            </dl>
            <p>
              Requested records may reach the connected AI provider. Verify its
              account settings before sharing.{" "}
              <a href="/privacy">Review privacy and data controls</a>.
            </p>
            <div className="setting-actions">
              <button
                className={
                  "btn " +
                  (policy.agent_data_allowed ? "btn-secondary" : "btn-primary")
                }
                disabled={ws.busy}
                onClick={async () => {
                  if (
                    !policy.agent_data_allowed &&
                    !(await ws.confirm({
                      title: "Enable MCP data sharing?",
                      body: (
                        <p>
                          Allow the connected MCP client to read requested
                          workspace records, including owner analytics, under
                          its provider&apos;s privacy settings?
                        </p>
                      ),
                      confirmLabel: "Enable sharing",
                    }))
                  )
                    return;
                  void ws.run(async () =>
                    ws.setPolicy(
                      await ws.request<PolicyState>("policy/agent-data", {
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
            </div>
          </section>

          <section
            id="draft"
            className="sheet setting"
            aria-labelledby="draft-title"
          >
            <h3 id="draft-title">Authorize one Claude draft</h3>
            <p>
              Review the exact idea or blueprint JSON from Claude. This
              authorizes one save for 15 minutes. You can review and export
              saved blueprints as local JSON files.
            </p>
            <div className="field">
              <div className="field-top">
                <label className="field-label" htmlFor="draft-json">
                  Draft request JSON
                </label>
                <span
                  className={"json-state " + (parsed.ok ? "is-ok" : "is-bad")}
                  aria-live="polite"
                >
                  <Icon name={parsed.ok ? "check" : "alert"} size={15} />
                  {parsed.ok
                    ? `Valid JSON · ${parsed.operation}`
                    : "Invalid JSON"}
                </span>
              </div>
              <textarea
                id="draft-json"
                className="code-input"
                rows={8}
                spellCheck={false}
                value={agentDraft}
                aria-invalid={!parsed.ok || undefined}
                aria-describedby="draft-json-error"
                onChange={(e) => {
                  setAgentDraft(e.target.value);
                  setAgentGrant("");
                }}
              />
              {!parsed.ok && (
                <p className="hint hint-error" id="draft-json-error">
                  {parsed.error}
                </p>
              )}
            </div>
            <div className="setting-actions">
              <button
                className="btn btn-primary"
                disabled={ws.busy || !parsed.ok}
                onClick={async () => {
                  if (!parsed.ok) return;
                  const ok = await ws.confirm({
                    title: "Authorize this exact draft?",
                    body: (
                      <>
                        <p>
                          Authorize this exact draft to be saved once by Claude?
                          The authorization expires after 15 minutes and only
                          matches this content.
                        </p>
                        <pre className="dialog-pre">
                          {JSON.stringify(parsed.value, null, 2)}
                        </pre>
                      </>
                    ),
                    confirmLabel: "Authorize once",
                  });
                  if (ok)
                    void ws.run(async () => {
                      const grant = await ws.call<{
                        input: Record<string, unknown>;
                        authorization: unknown;
                      }>("agent_authorize", parsed.value);
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
                      setCopied(false);
                    });
                }}
              >
                <Icon name="shield" />
                Authorize reviewed draft
              </button>
            </div>
            {agentGrant && (
              <div className="grant">
                <div className="field">
                  <label className="field-label" htmlFor="draft-grant">
                    One-use authorized input for Claude
                  </label>
                  <textarea
                    id="draft-grant"
                    className="code-input"
                    readOnly
                    rows={8}
                    value={agentGrant}
                  />
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() =>
                    void navigator.clipboard.writeText(agentGrant).then(() => {
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 2500);
                    })
                  }
                >
                  <Icon name={copied ? "check" : "copy"} />
                  {copied ? "Copied" : "Copy authorized input"}
                </button>
              </div>
            )}
          </section>

          <section
            id="google"
            className="sheet setting"
            aria-labelledby="google-title"
          >
            <h3 id="google-title">Google access</h3>
            <dl className="facts">
              <div>
                <dt>Owner channel</dt>
                <dd>
                  <StateTag tone={google?.connected ? "on" : "off"}>
                    {google?.connected ? "Connected" : "Not connected"}
                  </StateTag>
                  {google?.channel_id && <code>{google.channel_id}</code>}
                </dd>
              </div>
              {google?.verified_at && (
                <div>
                  <dt>Verified</dt>
                  <dd>{formatDateTime(google.verified_at)}</dd>
                </div>
              )}
              <div>
                <dt>Scopes</dt>
                <dd>
                  <code>youtube.readonly</code>{" "}
                  <code>yt-analytics.readonly</code>
                </dd>
              </div>
            </dl>
            <p>
              Read-only access for Creator Intelligence. Your existing upload
              and publish connection stays intact.
            </p>
            {!google?.configured && (
              <p className="fine">
                Dedicated Google OAuth client configuration is pending.
              </p>
            )}
            <div className="setting-actions">
              <button
                className="btn btn-primary"
                disabled={ws.busy || !google?.configured}
                onClick={() =>
                  void ws.run(async () => {
                    const d = await ws.request<{ url: string }>(
                      "auth/google/start",
                      {},
                    );
                    window.location.assign(d.url);
                  })
                }
              >
                Connect owner channel
              </button>
              <button
                className="btn btn-secondary"
                disabled={ws.busy || !google?.connected}
                onClick={async () => {
                  if (
                    await ws.confirm({
                      title: "Remove the local connection?",
                      body: (
                        <p>
                          Disconnect this app and delete its stored owner
                          analytics? This does not revoke the Google project
                          grant.
                        </p>
                      ),
                      confirmLabel: "Remove connection",
                      tone: "danger",
                    })
                  )
                    void ws.run(async () => {
                      await ws.call("disconnect");
                      await ws.refresh();
                    });
                }}
              >
                Remove local connection & owner metrics
              </button>
            </div>
            <details className="disclosure danger-zone">
              <summary>
                <Icon name="alert" />
                Revoke Google access for this project
              </summary>
              <div className="disclosure-body">
                <p>
                  Revocation can disconnect other clients using this Google
                  project, including a publisher. Local removal above only
                  removes this app&apos;s stored connection.
                </p>
                <div className="setting-actions">
                  <button
                    className="btn btn-danger"
                    disabled={ws.busy || !google?.connected}
                    onClick={async () => {
                      const confirmation = await ws.confirm({
                        title: "Revoke this project's Google grant?",
                        body: (
                          <p>
                            This revokes this Google project&apos;s grant and
                            can affect any other clients in the same project.
                          </p>
                        ),
                        confirmLabel: "Revoke project access",
                        tone: "danger",
                        phrase: "REVOKE GOOGLE PROJECT ACCESS",
                      });
                      if (confirmation === "REVOKE GOOGLE PROJECT ACCESS")
                        void ws.run(async () => {
                          await ws.call("revoke_google_project", {
                            confirmation,
                          });
                          await ws.refresh();
                          ws.setMessage(
                            "Google project access revoked. Clients using this project grant require reauthorization.",
                          );
                        });
                    }}
                  >
                    Revoke project access
                  </button>
                  <a
                    className="text-link"
                    href="https://security.google.com/settings/security/permissions"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Manage Google Account permissions
                    <Icon name="external" size={15} />
                  </a>
                </div>
              </div>
            </details>
          </section>

          <section
            id="quota"
            className="sheet setting"
            aria-labelledby="quota-title"
          >
            <h3 id="quota-title">Quota & access status</h3>
            <dl className="facts">
              <div>
                <dt>Quota day (Pacific)</dt>
                <dd>{status.quota?.day_pt ?? "Not available"}</dd>
              </div>
              <div>
                <dt>Resets</dt>
                <dd>
                  {formatDateTime(status.quota?.resets_at) ?? "Not available"}
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
                <dt>Derived metrics</dt>
                <dd>
                  <StateTag tone="neutral">Disabled</StateTag>
                  {status.derived_metrics?.reason && (
                    <code>{status.derived_metrics.reason}</code>
                  )}
                </dd>
              </div>
            </dl>
            {status.quota?.usage?.length ? (
              <DataTable
                rows={status.quota.usage}
                caption="Quota usage tracked by this app"
              />
            ) : (
              <p className="muted">No API requests tracked today.</p>
            )}
            {status.quota?.coverage && (
              <p className="fine">{status.quota.coverage}</p>
            )}
            <p>
              Derived competitor metrics remain disabled until genuine YouTube
              approval.{" "}
              <a
                href="https://developers.google.com/youtube/terms/derived-metrics-policy"
                target="_blank"
                rel="noreferrer"
              >
                Official approval requirements
              </a>
            </p>
          </section>

          <section
            id="data"
            className="sheet setting"
            aria-labelledby="data-title"
          >
            <h3 id="data-title">Your data</h3>
            <p>
              Export everything this workspace stores, or delete it. Deletion
              also removes this app&apos;s Google connection and managed draft
              backups. It does not delete videos from YouTube.{" "}
              <a href="/privacy">Privacy & retention</a>
            </p>
            <div className="setting-actions">
              <button
                className="btn btn-secondary"
                disabled={ws.busy}
                onClick={() =>
                  void ws.run(async () => {
                    const data = await ws.call("export");
                    downloadJson(data, "creator-intelligence-export.json");
                    ws.setMessage("Workspace export downloaded.");
                  })
                }
              >
                <Icon name="download" />
                Export data
              </button>
              <button className="btn btn-quiet" onClick={ws.signOut}>
                <Icon name="exit" />
                Sign out
              </button>
            </div>
            <div className="danger-zone danger-row">
              <div>
                <p className="danger-title">Delete app data</p>
                <p className="fine">
                  Removes drafts, cached records, owner reports and managed
                  backups. Separately downloaded exports remain yours to manage.
                </p>
              </div>
              <button
                className="btn btn-danger"
                disabled={ws.busy}
                onClick={async () => {
                  if (
                    await ws.confirm({
                      title: "Delete all app data?",
                      body: (
                        <p>
                          Delete all data and this app&apos;s Google connection?
                          This cannot be undone.
                        </p>
                      ),
                      confirmLabel: "Delete everything",
                      tone: "danger",
                      phrase: "DELETE",
                    })
                  )
                    void ws.run(async () => {
                      await ws.call("delete_data");
                      ws.clearSession();
                    });
                }}
              >
                <Icon name="trash" />
                Delete app data
              </button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
