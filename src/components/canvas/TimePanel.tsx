"use client";

import { useEffect } from "react";
import { useExplore } from "@/stores/explore";
import { METRICS, AREA_COLOR_VAR, EVENT_FILL } from "@/lib/demo/constants";
import type { Metric } from "@/lib/demo/types";
import { windowIndex, windowMidDate, windowsFor } from "@/lib/demo/load";
import { TIME_AXIS, makeTimeScale } from "@/lib/demo/timeAxis";

const { W, H, PAD } = TIME_AXIS;

/**
 * Time control + chart in one container sharing one x-geometry: the scrub
 * track spans exactly the chart's time axis, so the playhead sits directly
 * above its point on the series. Works with the chart hidden (bar only),
 * and the scrubbable range can be restricted (view-mode scrub steps).
 */
export default function TimePanel({
  editable,
  showScrub = true,
  range = null,
}: {
  editable: boolean;
  showScrub?: boolean;
  /** Restrict scrubbing/playing to window indices [from, to] of the active pane. */
  range?: { from: number; to: number } | null;
}) {
  const site = useExplore((s) => s.site);
  const stats = useExplore((s) => s.stats);
  const viewState = useExplore((s) => s.viewState);
  const activePane = useExplore((s) => s.activePane);
  const playing = useExplore((s) => s.playing);
  const { setChart, setWindowByIndex, setPlaying } = useExplore.getState();

  const pane = viewState.panes[Math.min(activePane, viewState.panes.length - 1)];
  const windows = site ? windowsFor(site, pane.granularity) : [];
  const currentIdx = site ? windowIndex(windows, pane.windowId) : 0;
  const minIdx = Math.max(0, Math.min(range?.from ?? 0, windows.length - 1));
  const maxIdx = Math.max(minIdx, Math.min(range?.to ?? windows.length - 1, windows.length - 1));

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const s = useExplore.getState();
      if (!s.site) return;
      const w = windowsFor(s.site, s.viewState.panes[s.activePane].granularity);
      const idx = windowIndex(w, s.viewState.panes[s.activePane].windowId);
      if (idx >= maxIdx) s.setPlaying(false);
      else s.setWindowByIndex(s.activePane, idx + 1);
    }, 420);
    return () => clearInterval(id);
  }, [playing, maxIdx]);

  if (!site) return null;
  const chartVisible = viewState.chart.visible && !!stats;
  if (!chartVisible && !showScrub) return null;

  const metric = METRICS[viewState.chart.metric];
  const { x, frac: xFrac, ih } = makeTimeScale(site.timeRange);
  const [yMin, yMax] = metric.domain;
  const y = (v: number) => PAD.top + ih - ((Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin)) * ih;

  const trackLeft = windows.length ? xFrac(windowMidDate(windows[minIdx])) : 0;
  const trackRight = windows.length ? xFrac(windowMidDate(windows[maxIdx])) : 1;
  const cursorMs = windows[currentIdx] ? windowMidDate(windows[currentIdx]) : null;

  const years: number[] = [];
  for (let yr = Number(site.timeRange.start.slice(0, 4)); yr <= Number(site.timeRange.end.slice(0, 4)); yr++)
    years.push(yr);
  const faded = (id: string) => viewState.chart.emphasize.length > 0 && !viewState.chart.emphasize.includes(id);

  const handlePlay = () => {
    if (!playing && currentIdx >= maxIdx) setWindowByIndex(activePane, minIdx);
    setPlaying(!playing);
  };

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "8px 12px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", minHeight: 26 }}>
        {showScrub && (
          <button onClick={handlePlay} style={{ minWidth: 56, padding: "2px 10px", fontSize: 12.5 }}>
            {playing ? "Pause" : "Play"}
          </button>
        )}
        {chartVisible && editable && (
          <div style={{ display: "flex", gap: 4 }}>
            {(Object.keys(METRICS) as Metric[]).map((key) => (
              <button
                key={key}
                className={viewState.chart.metric === key ? "selected" : undefined}
                style={{ padding: "2px 9px", fontSize: 12 }}
                onClick={() => setChart({ metric: key })}
              >
                {METRICS[key].short}
              </button>
            ))}
          </div>
        )}
        {chartVisible && !editable && (
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-soft)", letterSpacing: "0.05em" }}>
            {metric.label.toUpperCase()}
          </span>
        )}
        {chartVisible && stats && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {stats.areas.map((a) => (
              <button
                key={a.id}
                onClick={
                  editable
                    ? () =>
                        setChart({
                          emphasize: viewState.chart.emphasize.includes(a.id)
                            ? viewState.chart.emphasize.filter((id) => id !== a.id)
                            : [...viewState.chart.emphasize, a.id],
                        })
                    : undefined
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11.5,
                  border: "none",
                  background: "none",
                  padding: 0,
                  color: "var(--ink-soft)",
                  opacity: faded(a.id) ? 0.4 : 1,
                  cursor: editable ? "pointer" : "default",
                }}
              >
                <span style={{ width: 13, height: 3, background: AREA_COLOR_VAR[a.kind], display: "inline-block" }} />
                {a.label}
              </button>
            ))}
          </div>
        )}
        <span
          className="mono"
          style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-soft)", fontVariantNumeric: "tabular-nums" }}
        >
          {windows[currentIdx]?.label ?? ""}
        </span>
      </div>

      {showScrub && (
        <div style={{ position: "relative", height: 22 }}>
          <input
            type="range"
            min={minIdx}
            max={maxIdx}
            value={Math.max(minIdx, Math.min(currentIdx, maxIdx))}
            onChange={(e) => {
              setPlaying(false);
              setWindowByIndex(activePane, Number(e.target.value));
            }}
            aria-label="Time"
            style={{
              position: "absolute",
              left: `${trackLeft * 100}%`,
              width: `${Math.max(trackRight - trackLeft, 0.02) * 100}%`,
              top: 0,
              height: 22,
              margin: 0,
            }}
          />
        </div>
      )}

      {chartVisible && stats && (
        <div style={{ width: "100%", aspectRatio: `${W} / ${H}`, maxHeight: "min(24vh, 205px)" }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            style={{ width: "100%", height: "100%", display: "block" }}
          >
            {site.events.map((ev) => {
              const x0 = Math.max(PAD.left, x(Date.parse(ev.start)));
              const x1 = Math.min(W - PAD.right, x(Date.parse(ev.end ?? ev.start)));
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
            {[0, 0.5, 1].map((f) => {
              const v = yMin + f * (yMax - yMin);
              return (
                <g key={f}>
                  <line x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
                  <text x={PAD.left - 6} y={y(v) + 3} fontSize={9.5} fill="var(--ink-soft)" textAnchor="end">
                    {metric.percent ? `${Math.round(v * 100)}%` : v.toFixed(2)}
                  </text>
                </g>
              );
            })}
            {years.map((yr) => (
              <text
                key={yr}
                x={x(Date.parse(`${yr}-07-01`))}
                y={H - 5}
                fontSize={9.5}
                fill="var(--ink-soft)"
                textAnchor="middle"
              >
                {yr}
              </text>
            ))}
            {stats.areas.map((a) => {
              const pts = (stats.series[a.id] ?? [])
                .map((s) => ({ v: metric.get(s), d: s.from }))
                .filter((p): p is { v: number; d: string } => p.v !== undefined)
                .map((p) => `${x(Date.parse(p.d)).toFixed(1)},${y(p.v).toFixed(1)}`)
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
            {cursorMs !== null && (
              <line
                x1={x(cursorMs)}
                y1={PAD.top}
                x2={x(cursorMs)}
                y2={PAD.top + ih}
                stroke="var(--ink)"
                strokeWidth={1.3}
                strokeDasharray="4 3"
                opacity={0.7}
              />
            )}
          </svg>
        </div>
      )}
    </div>
  );
}
