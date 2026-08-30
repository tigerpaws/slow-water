"use client";

import { useExplore } from "@/stores/explore";
import { METRICS, AREA_COLOR_VAR, EVENT_FILL } from "@/lib/demo/constants";
import type { Metric } from "@/lib/demo/types";
import { windowIndex, windowMidDate, windowsFor } from "@/lib/demo/load";

export default function ChartPanel({ editable }: { editable: boolean }) {
  const site = useExplore((s) => s.site);
  const stats = useExplore((s) => s.stats);
  const chart = useExplore((s) => s.viewState.chart);
  const panes = useExplore((s) => s.viewState.panes);
  const activePane = useExplore((s) => s.activePane);
  const { setChart } = useExplore.getState();

  if (!site || !stats || !chart.visible) return null;

  const metric = METRICS[chart.metric];
  const W = 900;
  const H = 210;
  const PAD = { left: 46, right: 8, top: 10, bottom: 20 };
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const { start, end } = site.timeRange;
  const [yMin, yMax] = metric.domain;
  const x = (d: string | number) => {
    const t = typeof d === "number" ? d : Date.parse(d);
    return PAD.left + ((t - Date.parse(start)) / (Date.parse(end) - Date.parse(start))) * iw;
  };
  const y = (v: number) =>
    PAD.top + ih - ((Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin)) * ih;

  const pane = panes[Math.min(activePane, panes.length - 1)];
  const windows = windowsFor(site, pane.granularity);
  const current = windows[windowIndex(windows, pane.windowId)];
  const cursor = current ? windowMidDate(current) : null;

  const years: number[] = [];
  for (let yr = Number(start.slice(0, 4)); yr <= Number(end.slice(0, 4)); yr++) years.push(yr);
  const ticks = [0, 0.5, 1].map((f) => yMin + f * (yMax - yMin));
  const faded = (id: string) =>
    chart.emphasize.length > 0 && !chart.emphasize.includes(id);

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
        {editable ? (
          <div style={{ display: "flex", gap: 4 }}>
            {(Object.keys(METRICS) as Metric[]).map((key) => (
              <button
                key={key}
                className={chart.metric === key ? "selected" : undefined}
                style={{ padding: "2px 9px", fontSize: 12 }}
                onClick={() => setChart({ metric: key })}
              >
                {METRICS[key].short}
              </button>
            ))}
          </div>
        ) : (
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-soft)", letterSpacing: "0.05em" }}>
            {metric.label.toUpperCase()}
          </span>
        )}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {stats.areas.map((a) => (
            <button
              key={a.id}
              onClick={
                editable
                  ? () =>
                      setChart({
                        emphasize: chart.emphasize.includes(a.id)
                          ? chart.emphasize.filter((id) => id !== a.id)
                          : [...chart.emphasize, a.id],
                      })
                  : undefined
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                border: "none",
                background: "none",
                padding: 0,
                color: "var(--ink-soft)",
                opacity: faded(a.id) ? 0.4 : 1,
                cursor: editable ? "pointer" : "default",
              }}
            >
              <span style={{ width: 14, height: 3, background: AREA_COLOR_VAR[a.kind], display: "inline-block" }} />
              {a.label}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {site.events.map((ev) => {
          const x0 = Math.max(PAD.left, x(ev.start));
          const x1 = Math.min(W - PAD.right, x(ev.end ?? ev.start));
          if (x1 <= PAD.left) return null;
          return (
            <g key={ev.label}>
              <rect x={x0} y={PAD.top} width={Math.max(x1 - x0, 2)} height={ih} fill={EVENT_FILL[ev.kind]} />
              <text x={x0 + 4} y={PAD.top + 11} fontSize={9.5} fill="var(--ink-soft)">
                {ev.label}
              </text>
            </g>
          );
        })}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(v) + 3} fontSize={9.5} fill="var(--ink-soft)" textAnchor="end">
              {metric.percent ? `${Math.round(v * 100)}%` : v.toFixed(2)}
            </text>
          </g>
        ))}
        {years.map((yr) => (
          <text key={yr} x={x(`${yr}-07-01`)} y={H - 5} fontSize={9.5} fill="var(--ink-soft)" textAnchor="middle">
            {yr}
          </text>
        ))}
        {stats.areas.map((a) => {
          const pts = (stats.series[a.id] ?? [])
            .map((s) => ({ v: metric.get(s), d: s.from }))
            .filter((p): p is { v: number; d: string } => p.v !== undefined)
            .map((p) => `${x(p.d).toFixed(1)},${y(p.v).toFixed(1)}`)
            .join(" ");
          return (
            <polyline
              key={a.id}
              points={pts}
              fill="none"
              stroke={AREA_COLOR_VAR[a.kind]}
              strokeWidth={a.kind === "treatment" ? 2.4 : 1.6}
              opacity={faded(a.id) ? 0.25 : a.kind === "treatment" ? 1 : 0.85}
            />
          );
        })}
        {cursor && (
          <line
            x1={x(cursor)}
            y1={PAD.top}
            x2={x(cursor)}
            y2={PAD.top + ih}
            stroke="var(--ink)"
            strokeWidth={1.3}
            strokeDasharray="4 3"
            opacity={0.7}
          />
        )}
      </svg>
    </div>
  );
}
