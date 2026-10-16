"use client";
import { useState } from "react";
import { policyLinks } from "../../../../packages/domain/src/policy";
import { Icon } from "../_components/Icon";
import { Mark } from "../_components/Mark";
import { ErrorBanner } from "../_components/feedback";
import type { PolicyState } from "../_lib/api";

export function Login({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean;
  error: string;
  onSubmit: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  return (
    <div className="gate">
      <section className="gate-panel" aria-labelledby="gate-brand">
        <div className="gate-brand">
          <Mark />
          <h1 id="gate-brand">Creator Intelligence</h1>
        </div>
        <p className="gate-lede">
          A local workspace for YouTube research, original ideas and versioned
          production blueprints.
        </p>
        <ul className="gate-facts">
          <li>
            <Icon name="lock" />
            Runs on this computer. One owner, one password.
          </li>
          <li>
            <Icon name="database" />
            Records keep their source, timestamp and 30-day expiry.
          </li>
          <li>
            <Icon name="download" />
            Blueprints export as local JSON. Nothing is published.
          </li>
        </ul>
      </section>
      <main className="gate-main">
        <form
          className="gate-form"
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit(password);
          }}
        >
          <p className="eyebrow">Local workspace</p>
          <h2>Sign in</h2>
          <div className="field">
            <label className="field-label" htmlFor="owner-password">
              Owner password
            </label>
            <input
              id="owner-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="owner-password-hint"
              aria-invalid={error ? true : undefined}
            />
            <p className="hint" id="owner-password-hint">
              Use the private local credential helper to copy your owner
              password. Credentials stay on this computer.
            </p>
          </div>
          {error && <ErrorBanner code={error} />}
          <button className="btn btn-primary btn-wide" disabled={busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : null}
            Open workspace
          </button>
          <p className="gate-links">
            <a href="/privacy">Privacy & data controls</a>
            <a href="/terms">Terms of use</a>
          </p>
        </form>
      </main>
    </div>
  );
}

export function Consent({
  policy,
  busy,
  error,
  onAccept,
  onSignOut,
}: {
  policy: PolicyState | null;
  busy: boolean;
  error: string;
  onAccept: (choices: {
    privacy: boolean;
    terms: boolean;
    agent: boolean;
  }) => Promise<void>;
  onSignOut: () => void;
}) {
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [allowAgent, setAllowAgent] = useState(false);
  return (
    <div className="consent">
      <header className="consent-top">
        <Mark small />
        <span>Creator Intelligence</span>
      </header>
      <main className="consent-doc">
        <p className="eyebrow">
          Your privacy and choices · Policy {policy?.version}
        </p>
        <h1>Before you use Creator Intelligence</h1>
        <p className="lede">
          This application uses YouTube API Services for public research and
          reports from your authorized channel. Records and drafts are stored
          locally. Connecting Google requires your separate consent.
        </p>
        <p className="consent-read">
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
            void onAccept({
              privacy: privacyAccepted,
              terms: termsAccepted,
              agent: allowAgent,
            });
          }}
        >
          <fieldset className="choices">
            <legend>Required</legend>
            <div className="choice">
              <label>
                <input
                  type="checkbox"
                  required
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                />
                I agree to the privacy policy.
              </label>
            </div>
            <div className="choice">
              <label>
                <input
                  type="checkbox"
                  required
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />
                I agree to the terms of use, including the YouTube Terms of
                Service.
              </label>
            </div>
          </fieldset>
          <fieldset className="choices">
            <legend>Optional</legend>
            <div className="choice choice-optional">
              <label>
                <input
                  type="checkbox"
                  checked={allowAgent}
                  aria-describedby="agent-note"
                  onChange={(e) => setAllowAgent(e.target.checked)}
                />
                Optional: allow my connected MCP client to read requested
                workspace data, including owner reports, and send it to its AI
                provider under that account&apos;s settings.
              </label>
              <p className="hint" id="agent-note">
                Leave MCP sharing off to use the local interface only. Check
                your AI provider&apos;s privacy settings before enabling it. You
                can turn sharing off in Settings. Google credentials are never
                included in MCP results.
              </p>
            </div>
          </fieldset>
          {error && <ErrorBanner code={error} />}
          <div className="consent-actions">
            <button
              className="btn btn-primary"
              disabled={busy || !privacyAccepted || !termsAccepted}
            >
              Accept policies & open workspace
            </button>
            <button type="button" className="btn btn-quiet" onClick={onSignOut}>
              Sign out without accepting
            </button>
          </div>
        </form>
        <p className="consent-foot">
          <a href={policyLinks.privacy}>
            Developer contact and data deletion information
          </a>
        </p>
      </main>
    </div>
  );
}
