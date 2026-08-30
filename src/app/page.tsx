"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { bboxAround } from "@/lib/pipeline/geo";
import type {
  AnalysisArea,
  Manifest,
  MonthlyStat,
  MosaicMode,
  RenderKind,
  SiteStats,
} from "@/lib/pipeline/types";

const KNOWN_SITES = [
  { id: "doty-ravine", label: "Doty Ravine" },
  { id: "doty-ravine-monthly", label: "Doty (monthly)" },
  { id: "tasmam-koyom", label: "Tásmam Koyóm" },
  { id: "tasmam-koyom-monthly", label: "Tásmam (monthly)" },
];
const DEFAULT_SITE = KNOWN_SITES[0].id;

const EVENT_COLORS: Record<string, string> = {
  restoration: "rgba(80, 200, 120, 0.18)",
  drought: "rgba(230, 160, 60, 0.18)",
  fire: "rgba(230, 80, 60, 0.18)",
  flood: "rgba(80, 140, 230, 0.18)",
  other: "rgba(160, 160, 160, 0.18)",
};

const AREA_COLORS: Record<AnalysisArea["kind"], string> = {
  treatment: "#6fbf73",
  control: "#7aa5d1",
  reference: "#d1a35a",
};

interface MetricDef {
  label: string;
  domain: [number, number];
  get: (s: MonthlyStat) => number | undefined;
  percent?: boolean;
}

const METRICS: Record<string, MetricDef> = {
  ndvi: { label: "NDVI · greenness", domain: [0, 0.9], get: (s) => s.ndviMean },
  ndmi: { label: "NDMI · moisture", domain: [-0.3, 0.6], get: (s) => s.ndmiMean },
  water: { label: "open water", domain: [0, 0.4], get: (s) => s.waterFraction, percent: true },
  nbr: { label: "NBR · burn", domain: [-0.3, 0.8], get: (s) => s.nbrMean },
};

function dateToX(date: string, start: string, end: string, width: number): number {
  const t = Date.parse(date);
  const t0 = Date.parse(start);
  const t1 = Date.parse(end);
  return ((t - t0) / (t1 - t0)) * width;
}

function StatsChart({
  stats,
  manifest,
  metricKey,
  currentWindowMid,
}: {
  stats: SiteStats;
  manifest: Manifest;
  metricKey: string;
  currentWindowMid: string | null;
}) {
  const metric = METRICS[metricKey];
  const W = 900;
  const H = 240;
  const PAD = { left: 48, right: 8, top: 10, bottom: 22 };
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const { start, end } = manifest.site.timeRange;
  const [yMin, yMax] = metric.domain;
  const y = (v: number) => PAD.top + ih - ((Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin)) * ih;
  const x = (d: string) => PAD.left + dateToX(d, start, end, iw);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => yMin + f * (yMax - yMin));
  const years: number[] = [];
  for (let yr = Number(start.slice(0, 4)); yr <= Number(end.slice(0, 4)); yr++) years.push(yr);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {manifest.site.events.map((ev) => {
        const x0 = Math.max(PAD.left, x(ev.start));
        const x1 = Math.min(W - PAD.right, x(ev.end ?? ev.start));
        if (x1 <= PAD.left) return null;
        return (
          <g key={ev.label}>
            <rect x={x0} y={PAD.top} width={Math.max(x1 - x0, 2)} height={ih} fill={EVENT_COLORS[ev.kind]} />
            <text x={x0 + 4} y={PAD.top + 12} fontSize={10} fill="#9a9a9a">
              {ev.label}
            </text>
          </g>
        );
      })}
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)} stroke="#2e2e2e" strokeWidth={1} />
          <text x={PAD.left - 6} y={y(v) + 3} fontSize={10} fill="#8a8a8a" textAnchor="end">
            {metric.percent ? `${Math.round(v * 100)}%` : v.toFixed(2)}
          </text>
        </g>
      ))}
      {years.map((yr) => (
        <text key={yr} x={x(`${yr}-07-01`)} y={H - 6} fontSize={10} fill="#8a8a8a" textAnchor="middle">
          {yr}
        </text>
      ))}
      {stats.areas.map((area) => {
        const series = stats.series[area.id] ?? [];
        const points = series
          .map((s) => ({ v: metric.get(s), d: s.from }))
          .filter((p): p is { v: number; d: string } => p.v !== undefined)
          .map((p) => `${x(p.d).toFixed(1)},${y(p.v).toFixed(1)}`)
          .join(" ");
        return (
          <polyline
            key={area.id}
            points={points}
            fill="none"
            stroke={AREA_COLORS[area.kind]}
            strokeWidth={area.kind === "treatment" ? 2.5 : 1.7}
            opacity={area.kind === "treatment" ? 1 : 0.85}
          />
        );
      })}
      {currentWindowMid && (
        <line
          x1={x(currentWindowMid)}
          y1={PAD.top}
          x2={x(currentWindowMid)}
          y2={PAD.top + ih}
          stroke="#e0e0e0"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      )}
    </svg>
  );
}

/** Ring of [lon, lat] vertices for an area (bbox areas become a rectangle ring). */
function areaRing(area: AnalysisArea): [number, number][] {
  if (area.polygon) return area.polygon;
  if (!area.bbox) return [];
  const [minLon, minLat, maxLon, maxLat] = area.bbox;
  return [
    [minLon, minLat],
    [maxLon, minLat],
    [maxLon, maxLat],
    [minLon, maxLat],
  ];
}

/** Percent-positioned area outlines (rects or polygons) over the current frame. */
function AreaOverlay({
  areas,
  viewBbox,
}: {
  areas: AnalysisArea[];
  viewBbox: [number, number, number, number];
}) {
  const [minLon, minLat, maxLon, maxLat] = viewBbox;
  const px = (lon: number) => ((lon - minLon) / (maxLon - minLon)) * 100;
  const py = (lat: number) => ((maxLat - lat) / (maxLat - minLat)) * 100;
  return (
    <>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      >
        {areas.map((area) => {
          const ring = areaRing(area);
          if (ring.length === 0) return null;
          return (
            <polygon
              key={area.id}
              points={ring.map(([lon, lat]) => `${px(lon).toFixed(2)},${py(lat).toFixed(2)}`).join(" ")}
              fill="none"
              stroke={AREA_COLORS[area.kind]}
              strokeWidth={2}
              strokeDasharray="7 5"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
      {areas.map((area) => {
        const ring = areaRing(area);
        if (ring.length === 0) return null;
        const left = Math.min(...ring.map(([lon]) => px(lon)));
        const top = Math.min(...ring.map(([, lat]) => py(lat)));
        if (left > 100 || top > 100) return null;
        return (
          <span
            key={area.id}
            style={{
              position: "absolute",
              left: `${Math.max(left, 0)}%`,
              top: `${Math.max(top, 0)}%`,
              background: "rgba(0,0,0,0.6)",
              color: AREA_COLORS[area.kind],
              fontSize: 11,
              padding: "1px 5px",
              borderRadius: 3,
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            {area.label}
          </span>
        );
      })}
    </>
  );
}

const noopSubscribe = () => () => {};

export default function Home() {
  // Rendering-only site id for the nav highlight. During hydration this is
  // DEFAULT_SITE (the prerendered value), corrected right after — never use it
  // to decide what to fetch.
  const siteId = useSyncExternalStore(
    noopSubscribe,
    () => new URLSearchParams(window.location.search).get("site") ?? DEFAULT_SITE,
    () => DEFAULT_SITE
  );
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<string>("context");
  const [render, setRender] = useState<RenderKind>("rgb");
  const [mode, setMode] = useState<MosaicMode>("composite");
  const [metricKey, setMetricKey] = useState<string>("ndvi");
  const [showAreas, setShowAreas] = useState(true);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Read the URL directly: the render-time siteId starts as DEFAULT_SITE
    // during hydration, and fetching for that value races the real site's
    // fetch — last response wins and can display the wrong site entirely.
    const site = new URLSearchParams(window.location.search).get("site") ?? DEFAULT_SITE;
    let cancelled = false;
    fetch(`/timelapses/${site}/manifest.json`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((m: Manifest) => {
        if (cancelled) return;
        setManifest(m);
        const first = Object.values(m.variants)[0];
        if (first) {
          setView(first.view);
          setRender(first.render);
          setMode(first.mode);
        }
      })
      .catch(() => {
        if (!cancelled)
          setLoadError(`No manifest found — run: npx tsx scripts/fetch-timelapse.ts sites/${site}.json`);
      });
    fetch(`/timelapses/${site}/stats.json`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: SiteStats | MonthlyStat[] | null) => {
        if (cancelled || !s) return;
        if (Array.isArray(s)) return; // legacy shape; regenerate with the CLI
        setStats(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const variantKey = `${view}-${render}-${mode}`;
  const variant = manifest?.variants[variantKey] ?? null;
  const frames = useMemo(() => variant?.frames ?? [], [variant]);
  const frame = frames[Math.min(frameIndex, frames.length - 1)];

  const viewBbox = useMemo(() => {
    const vc = manifest?.site.views[view];
    if (!manifest || !vc) return null;
    return bboxAround(manifest.site.center, vc.widthMeters);
  }, [manifest, view]);

  // Preload every frame of the active variant so scrubbing is instant.
  useEffect(() => {
    frames.forEach((f) => {
      const img = new Image();
      img.src = f.path;
    });
  }, [frames]);

  useEffect(() => {
    if (playing) {
      playRef.current = setInterval(
        () => setFrameIndex((i) => (frames.length ? (i + 1) % frames.length : 0)),
        450
      );
    }
    return () => {
      if (playRef.current) clearInterval(playRef.current);
    };
  }, [playing, frames.length]);

  const step = useCallback(
    (delta: number) =>
      setFrameIndex((i) => Math.max(0, Math.min(frames.length - 1, i + delta))),
    [frames.length]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const windowMid = frame
    ? new Date((Date.parse(frame.window.start) + Date.parse(frame.window.end)) / 2)
        .toISOString()
        .slice(0, 10)
    : null;

  const buttonStyle = (selected: boolean, enabled = true) => ({
    padding: "4px 10px",
    borderRadius: 6,
    border: "1px solid #3a3a3a",
    background: selected ? "#3a5a3f" : "#232323",
    color: enabled ? "#e5e5e5" : "#555",
    cursor: enabled ? "pointer" : "default",
    fontSize: 13,
  });

  const toggle = (
    label: string,
    options: string[],
    value: string,
    onChange: (v: string) => void,
    available: (v: string) => boolean
  ) => (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <span style={{ color: "#8a8a8a", fontSize: 12, minWidth: 44 }}>{label}</span>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          disabled={!available(opt)}
          style={buttonStyle(value === opt, available(opt))}
        >
          {opt}
        </button>
      ))}
    </div>
  );

  const hasVariant = (v: string, r: string, m: string) =>
    Boolean(manifest?.variants[`${v}-${r}-${m}`]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#161616",
        color: "#e5e5e5",
        fontFamily: "system-ui, sans-serif",
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div style={{ width: "min(920px, 100%)" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          {KNOWN_SITES.map((s) => (
            <a
              key={s.id}
              href={`/?site=${s.id}`}
              style={{
                color: s.id === siteId ? "#e5e5e5" : "#8a8a8a",
                fontSize: 13,
                textDecoration: s.id === siteId ? "underline" : "none",
              }}
            >
              {s.label}
            </a>
          ))}
        </div>
        <h1 style={{ fontSize: 20, margin: 0 }}>{manifest?.site.name ?? "Satellite timelapse"}</h1>
        <p style={{ color: "#9a9a9a", fontSize: 13, marginTop: 4 }}>
          {manifest?.site.description ?? ""}
        </p>
      </div>

      {loadError && (
        <div style={{ color: "#e6a03c", fontFamily: "monospace", fontSize: 14 }}>{loadError}</div>
      )}

      {manifest && (
        <>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", width: "min(920px, 100%)" }}>
            {toggle("view", Object.keys(manifest.site.views), view, (v) => setView(v), (v) =>
              hasVariant(v, render, mode)
            )}
            {toggle("render", ["rgb", "ndvi"], render, (v) => setRender(v as RenderKind), (r) =>
              hasVariant(view, r, mode)
            )}
            {stats && (
              <button onClick={() => setShowAreas((a) => !a)} style={buttonStyle(showAreas)}>
                areas
              </button>
            )}
          </div>

          {frame && (
            <div style={{ width: "min(920px, 100%)" }}>
              <div style={{ position: "relative", overflow: "hidden", borderRadius: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={frame.path}
                  alt={`${manifest.site.name} — ${frame.window.label}`}
                  style={{
                    width: "100%",
                    display: "block",
                    imageRendering: view === "tight" ? "pixelated" : "auto",
                    background: "#000",
                  }}
                />
                {showAreas && stats && viewBbox && (
                  <AreaOverlay areas={stats.areas} viewBbox={viewBbox} />
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                <button onClick={() => setPlaying((p) => !p)} style={buttonStyle(false)}>
                  {playing ? "Pause" : "Play"}
                </button>
                <input
                  type="range"
                  min={0}
                  max={Math.max(frames.length - 1, 0)}
                  value={Math.min(frameIndex, frames.length - 1)}
                  onChange={(e) => {
                    setPlaying(false);
                    setFrameIndex(Number(e.target.value));
                  }}
                  style={{ flex: 1 }}
                />
                <span style={{ fontVariantNumeric: "tabular-nums", minWidth: 130, textAlign: "right" }}>
                  {frame.window.label}
                </span>
              </div>
              <div style={{ color: "#8a8a8a", fontSize: 12, marginTop: 4 }}>
                {frame.sceneCount} usable scenes in window
                {mode === "simple" && frame.bestSceneDate
                  ? ` · best scene ${frame.bestSceneDate.slice(0, 10)} (${frame.bestSceneCloudCover?.toFixed(0)}% cloud)`
                  : " · cloud-masked median composite"}
              </div>
            </div>
          )}

          {stats && (
            <div style={{ width: "min(920px, 100%)", background: "#1d1d1d", borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {Object.entries(METRICS).map(([key, m]) => (
                    <button key={key} onClick={() => setMetricKey(key)} style={buttonStyle(metricKey === key)}>
                      {m.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  {stats.areas.map((a) => (
                    <span key={a.id} style={{ fontSize: 12, color: "#c8c8c8", display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 14, height: 3, background: AREA_COLORS[a.kind], display: "inline-block" }} />
                      {a.label}
                    </span>
                  ))}
                </div>
              </div>
              <StatsChart stats={stats} manifest={manifest} metricKey={metricKey} currentWindowMid={windowMid} />
            </div>
          )}
        </>
      )}
    </main>
  );
}
