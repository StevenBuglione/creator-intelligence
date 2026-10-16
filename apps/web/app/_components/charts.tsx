"use client";
import { useEffect, useId, useRef, useState } from "react";
import { humanize } from "../_lib/api";

type Series = {
  key: string;
  label: string;
  tone: 1 | 2;
  values: (number | null)[];
};

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry?.contentRect.width ?? 0)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceMax(value: number) {
  if (value <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(value));
  const f = value / exp;
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return step * exp;
}

const num = (v: number) =>
  Math.abs(v) < 10 && !Number.isInteger(v)
    ? v.toLocaleString(undefined, { maximumFractionDigits: 3 })
    : v.toLocaleString();

function pickTicks(count: number, max = 6) {
  if (count <= max) return Array.from({ length: count }, (_, i) => i);
  const out = new Set<number>();
  for (let i = 0; i < max; i++)
    out.add(Math.round((i * (count - 1)) / (max - 1)));
  return [...out];
}

export function LineChart({
  title,
  xLabels,
  series,
  xCaption,
}: {
  title: string;
  xLabels: string[];
  series: Series[];
  xCaption: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const hintId = useId();
  const n = xLabels.length;
  const H = width < 520 ? 210 : 250,
    m = { top: 14, right: width < 520 ? 16 : 96, bottom: 30, left: 48 };
  const plotW = Math.max(10, width - m.left - m.right),
    plotH = H - m.top - m.bottom;
  const all = series.flatMap((s) =>
    s.values.filter((v): v is number => v != null),
  );
  const yMax = niceMax(Math.max(...all, 0));
  const x = (i: number) =>
    m.left + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const y = (v: number) => m.top + plotH - (v / yMax) * plotH;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);
  const showMarkers = n <= 40;

  function segments(values: (number | null)[]) {
    const parts: string[] = [];
    let current = "";
    values.forEach((v, i) => {
      if (v == null) {
        if (current) parts.push(current);
        current = "";
      } else
        current +=
          (current ? " L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1);
    });
    if (current) parts.push(current);
    return parts;
  }
  function locate(clientX: number, rect: DOMRect) {
    const px = clientX - rect.left - m.left;
    const i = Math.round((px / plotW) * (n - 1));
    setActive(Math.min(n - 1, Math.max(0, i)));
  }
  const tipLeft = active == null ? 0 : x(active);
  return (
    <figure className="chart">
      <figcaption className="chart-head">
        <span className="chart-title">{title}</span>
        {series.length > 1 && (
          <span className="legend">
            {series.map((s) => (
              <span key={s.key} className="legend-item">
                <span className={"swatch tone-" + s.tone} aria-hidden="true" />
                {s.label}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      <div
        ref={ref}
        className="chart-canvas"
        tabIndex={0}
        aria-describedby={hintId}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            const step = e.key === "ArrowRight" ? 1 : -1;
            setActive((a) =>
              Math.min(n - 1, Math.max(0, (a ?? (step > 0 ? -1 : n)) + step)),
            );
          } else if (e.key === "Escape") setActive(null);
        }}
        onBlur={() => setActive(null)}
      >
        <span id={hintId} className="sr-only">
          {title}. Exact values are in the table below. Use the left and right
          arrow keys to read each point.
        </span>
        {width > 0 && (
          <svg
            width={width}
            height={H}
            role="img"
            aria-label={`${title}, ${series.map((s) => s.label).join(" and ")} across ${n} stored points`}
            onPointerMove={(e) =>
              locate(e.clientX, e.currentTarget.getBoundingClientRect())
            }
            onPointerLeave={() => setActive(null)}
          >
            {yTicks.map((t) => (
              <g key={t}>
                <line
                  className={t === 0 ? "axis" : "grid"}
                  x1={m.left}
                  x2={m.left + plotW}
                  y1={y(t)}
                  y2={y(t)}
                />
                <text
                  className="tick"
                  x={m.left - 8}
                  y={y(t) + 4}
                  textAnchor="end"
                >
                  {num(t)}
                </text>
              </g>
            ))}
            {pickTicks(n, width < 520 ? 3 : 6).map((i) => (
              <text
                key={i}
                className="tick"
                x={x(i)}
                y={H - 8}
                textAnchor={
                  n > 1 && i === 0
                    ? "start"
                    : n > 1 && i === n - 1
                      ? "end"
                      : "middle"
                }
              >
                {xLabels[i]}
              </text>
            ))}
            {active != null && (
              <line
                className="crosshair"
                x1={x(active)}
                x2={x(active)}
                y1={m.top}
                y2={m.top + plotH}
              />
            )}
            {series.map((s) => (
              <g key={s.key} className={"series tone-" + s.tone}>
                {segments(s.values).map((d, i) => (
                  <path key={i} d={d} className="line" />
                ))}
                {s.values.map((v, i) =>
                  v == null || (!showMarkers && i !== active) ? null : (
                    <circle
                      key={i}
                      className={"marker" + (i === active ? " is-active" : "")}
                      cx={x(i)}
                      cy={y(v)}
                      r={i === active ? 5.5 : 4}
                    />
                  ),
                )}
              </g>
            ))}
            {width >= 520 &&
              series.map((s) => {
                const last = s.values.findLastIndex((v) => v != null);
                const v = s.values[last];
                if (last < 0 || v == null) return null;
                return (
                  <text
                    key={s.key}
                    className="direct-label"
                    x={x(last) + 10}
                    y={y(v) + 4}
                  >
                    {s.label}
                  </text>
                );
              })}
          </svg>
        )}
        {active != null && width > 0 && (
          <div
            className="chart-tip"
            style={{
              left: Math.min(Math.max(tipLeft, 90), width - 90),
            }}
            role="status"
          >
            <strong>{xLabels[active]}</strong>
            {series.map((s) => (
              <span key={s.key}>
                <span className={"swatch tone-" + s.tone} aria-hidden="true" />
                {s.label}
                <b>
                  {s.values[active] == null
                    ? "Not available"
                    : num(s.values[active]!)}
                </b>
              </span>
            ))}
          </div>
        )}
      </div>
      <p className="chart-note">{xCaption}</p>
    </figure>
  );
}

export function BarChart({
  title,
  bars,
  caption,
}: {
  title: string;
  bars: { label: string; value: number; detail?: string }[];
  caption: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const sorted = [...bars].sort((a, b) => b.value - a.value);
  const labelW = Math.min(150, Math.max(90, width * 0.28)),
    valueW = 64,
    rowH = 34,
    barH = 18;
  const plotW = Math.max(10, width - labelW - valueW);
  const max = Math.max(...sorted.map((b) => b.value), 1);
  const H = sorted.length * rowH + 6;
  return (
    <figure className="chart">
      <figcaption className="chart-head">
        <span className="chart-title">{title}</span>
      </figcaption>
      <div ref={ref} className="chart-canvas">
        {width > 0 && (
          <svg
            width={width}
            height={H}
            role="img"
            aria-label={`${title}. Exact values are in the table below.`}
          >
            <line className="axis" x1={labelW} x2={labelW} y1={0} y2={H} />
            {sorted.map((b, i) => {
              const w = Math.max(2, (b.value / max) * plotW),
                top = i * rowH + (rowH - barH) / 2,
                r = Math.min(4, w);
              return (
                <g
                  key={b.label}
                  className={"bar-row" + (active === i ? " is-active" : "")}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                >
                  <rect
                    className="hit"
                    x={0}
                    y={i * rowH}
                    width={width}
                    height={rowH}
                  />
                  <text
                    className="bar-label"
                    x={labelW - 10}
                    y={top + barH / 2 + 4}
                    textAnchor="end"
                  >
                    {b.label}
                  </text>
                  <path
                    className="bar tone-1"
                    d={`M${labelW} ${top}h${w - r}a${r} ${r} 0 0 1 ${r} ${r}v${barH - 2 * r}a${r} ${r} 0 0 1 -${r} ${r}h-${w - r}z`}
                  />
                  <text
                    className="bar-value"
                    x={labelW + w + 8}
                    y={top + barH / 2 + 4}
                  >
                    {b.value.toLocaleString()}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
        {active != null && sorted[active]?.detail && (
          <div
            className="chart-tip"
            style={{
              left: Math.min(labelW + 120, width - 90),
              top: active * rowH + rowH + 4,
            }}
            role="status"
          >
            <strong>{sorted[active]!.label}</strong>
            <span>{sorted[active]!.detail}</span>
          </div>
        )}
      </div>
      <p className="chart-note">{caption}</p>
    </figure>
  );
}

const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/** Chooses an honest chart for a stored report; returns null when one would mislead. */
export function ReportChart({ rows }: { rows: Record<string, unknown>[] }) {
  const first = rows[0] ?? {};
  if ("insightTrafficSourceType" in first) {
    if (!rows.every((r) => finite(r.views))) return null;
    return (
      <BarChart
        title="Views by traffic source"
        caption="Stored owner report. Each source is a separate YouTube category; exact values are in the table."
        bars={rows.map((r) => ({
          label: String(r.insightTrafficSourceType),
          value: r.views as number,
          detail: finite(r.estimatedMinutesWatched)
            ? `${(r.views as number).toLocaleString()} views · ${r.estimatedMinutesWatched.toLocaleString()} minutes watched`
            : `${(r.views as number).toLocaleString()} views`,
        }))}
      />
    );
  }
  if ("audienceWatchRatio" in first) {
    if (rows.length < 2) return null;
    return (
      <LineChart
        title="Audience watch ratio"
        xCaption="Horizontal axis: elapsed share of the video. Relative retention is a different measure and stays in the table."
        xLabels={rows.map((r) =>
          finite(r.elapsedVideoTimeRatio)
            ? Math.round(r.elapsedVideoTimeRatio * 100) + "%"
            : "—",
        )}
        series={[
          {
            key: "audienceWatchRatio",
            label: humanize("audienceWatchRatio"),
            tone: 1,
            values: rows.map((r) =>
              finite(r.audienceWatchRatio) ? r.audienceWatchRatio : null,
            ),
          },
        ]}
      />
    );
  }
  if ("views" in first && rows.length >= 2) {
    const series: Series[] = [
      {
        key: "views",
        label: "Views",
        tone: 1,
        values: rows.map((r) => (finite(r.views) ? r.views : null)),
      },
    ];
    if ("engagedViews" in first)
      series.push({
        key: "engagedViews",
        label: "Engaged views",
        tone: 2,
        values: rows.map((r) =>
          finite(r.engagedViews) ? r.engagedViews : null,
        ),
      });
    return (
      <LineChart
        title={series.length > 1 ? "Views and engaged views" : "Views"}
        xCaption="Views and engaged views are separate YouTube measures. Gaps mean not available, never zero."
        xLabels={rows.map((r, i) => String(r.day ?? `Sample ${i + 1}`))}
        series={series}
      />
    );
  }
  return null;
}
