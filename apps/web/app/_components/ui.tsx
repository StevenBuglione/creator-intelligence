import type { ReactNode } from "react";
import { formatDate, formatDateTime, humanize, type Meta } from "../_lib/api";
import { Icon, type IconName } from "./Icon";
import type { Workspace } from "../_lib/workspace";

export function PageHeader({
  eyebrow,
  title,
  intro,
  actions,
}: {
  eyebrow: ReactNode;
  title: string;
  intro?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h2 tabIndex={-1}>{title}</h2>
        {intro && <p className="page-intro">{intro}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  icon = "info",
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
        {action && <div className="empty-action">{action}</div>}
      </div>
    </div>
  );
}

export function Callout({
  tone = "info",
  children,
}: {
  tone?: "info" | "caution" | "danger" | "positive";
  children: ReactNode;
}) {
  const icon: IconName =
    tone === "positive" ? "check" : tone === "info" ? "info" : "alert";
  return (
    <div className={"callout callout-" + tone}>
      <Icon name={icon} />
      <div>{children}</div>
    </div>
  );
}

export function StateTag({
  tone,
  children,
}: {
  tone: "on" | "off" | "warn" | "neutral";
  children: ReactNode;
}) {
  return (
    <span className={"state state-" + tone}>
      <span className="state-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

export function Provenance({
  meta,
  expires,
}: {
  meta: Meta;
  expires?: string | null;
}) {
  const retrieved = formatDateTime(meta.retrieved_at);
  return (
    <p className="provenance">
      <span className="prov-source">
        {meta.source.startsWith("youtube_") ? (
          <a href="https://www.youtube.com/" target="_blank" rel="noreferrer">
            Source: YouTube
          </a>
        ) : meta.source === "synthetic" ? (
          "Synthetic demonstration — not YouTube data"
        ) : (
          meta.source
        )}
      </span>
      <span>
        {meta.ownership?.replaceAll("_", " ") ??
          "source classification unavailable"}
      </span>
      <span>
        {retrieved ? (
          <>
            Retrieved <time dateTime={meta.retrieved_at}>{retrieved}</time>
          </>
        ) : (
          "No timestamp"
        )}
      </span>
      <span className={meta.stale ? "prov-stale" : undefined}>
        {meta.stale ? "Stored / refresh due" : "Stored observation"}
      </span>
      {expires && <span>Expires {formatDate(expires)}</span>}
      {meta.not_available ? <span>{meta.not_available}</span> : null}
    </p>
  );
}

function isNumeric(v: unknown) {
  return (
    (typeof v === "number" && Number.isFinite(v)) ||
    (typeof v === "string" && v.trim() !== "" && /^-?\d+(\.\d+)?%?$/.test(v))
  );
}

export function DataTable({
  rows,
  caption,
}: {
  rows: Record<string, unknown>[];
  caption?: string;
}) {
  if (!rows.length) return <p className="not-available">Not available</p>;
  const keys = Object.keys(rows[0] ?? {});
  return (
    <div
      className="table-scroll"
      tabIndex={0}
      role="region"
      aria-label={caption ?? "Data table"}
    >
      <table className="data-table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {keys.map((k) => (
              <th
                key={k}
                scope="col"
                className={isNumeric(rows[0]?.[k]) ? "num" : undefined}
              >
                <span className="th-label">{humanize(k)}</span>
                <code className="th-key">{k}</code>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {keys.map((k) =>
                r[k] === null || r[k] === undefined ? (
                  <td key={k} className="na">
                    Not available
                  </td>
                ) : (
                  <td
                    key={k}
                    className={
                      isNumeric(r[k])
                        ? "num"
                        : String(r[k]).length <= 24
                          ? "short"
                          : undefined
                    }
                  >
                    {typeof r[k] === "object"
                      ? JSON.stringify(r[k])
                      : String(r[k])}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Raw key/value statistics, shown exactly as the API returned them. */
export function RawValues({ values }: { values: Record<string, unknown> }) {
  const entries = Object.entries(values ?? {});
  if (!entries.length)
    return <p className="not-available">No statistics returned</p>;
  return (
    <dl className="raw-values">
      {entries.map(([k, v]) => (
        <div key={k}>
          <dt>
            <code>{k}</code>
          </dt>
          <dd className={v == null ? "na" : undefined}>
            {v == null
              ? "Not available"
              : typeof v === "object"
                ? JSON.stringify(v)
                : String(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function YouTubeAttribution() {
  return (
    <div className="youtube-attribution">
      <a href="https://www.youtube.com/" target="_blank" rel="noreferrer">
        <img
          src="/youtube-developed-light.png"
          width="210"
          height="75"
          alt="Developed with YouTube"
        />
      </a>
      <span>
        Official YouTube API records. Creative drafts are independent output.
      </span>
    </div>
  );
}

export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  );
}

export function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span className={"counter" + (value > max * 0.9 ? " counter-near" : "")}>
      {value}/{max}
    </span>
  );
}

export function RefreshButton({ ws }: { ws: Workspace }) {
  return (
    <button
      className="btn btn-secondary"
      disabled={ws.busy}
      onClick={() => void ws.run(() => ws.refresh())}
    >
      <Icon name="refresh" />
      Refresh view
    </button>
  );
}
