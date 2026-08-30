"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Manifest, MonthlyStat, MosaicMode, RenderKind } from "@/lib/pipeline/types";

const KNOWN_SITES = [
  { id: "doty-ravine", label: "Doty Ravine" },
  { id: "tasmam-koyom", label: "Tásmam Koyóm" },
];
const DEFAULT_SITE = KNOWN_SITES[0].id;

const EVENT_COLORS: Record<string, string> = {
  restoration: "rgba(80, 200, 120, 0.18)",
  drought: "rgba(230, 160, 60, 0.18)",
  fire: "rgba(230, 80, 60, 0.18)",
  flood: "rgba(80, 140, 230, 0.18)",
  other: "rgba(160, 160, 160, 0.18)",
};

function dateToX(date: string, start: string, end: string, width: number): number {
  const t = Date.parse(date);
  const t0 = Date.parse(start);
  const t1 = Date.parse(end);
  return ((t - t0) / (t1 - t0)) * width;
}

function NdviChart({
  stats,
  manifest,
  currentWindowMid,
}: {
  stats: MonthlyStat[];
  manifest: Manifest;
  currentWindowMid: string | null;
}) {
  const W = 900;
  const H = 220;
  const PAD = { left: 44, right: 8, top: 10, bottom: 22 };
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const { start, end } = manifest.site.timeRange;
  const yMin = 0;
  const yMax = 0.9;
  const y = (v: number) => PAD.top + ih - ((v - yMin) / (yMax - yMin)) * ih;
  const x = (d: string) => PAD.left + dateToX(d, start, end, iw);

  const points = stats
    .filter((s) => s.ndviMean !== undefined)
    .map((s) => `${x(s.from).toFixed(1)},${y(s.ndviMean!).toFixed(1)}`)
    .join(" ");

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
      {[0, 0.2, 0.4, 0.6, 0.8].map((v) => (
        <g key={v}>
          <line x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)} stroke="#2e2e2e" strokeWidth={1} />
          <text x={PAD.left - 6} y={y(v) + 3} fontSize={10} fill="#8a8a8a" textAnchor="end">
            {v.toFixed(1)}
          </text>
        </g>
      ))}
      {years.map((yr) => (
        <text key={yr} x={x(`${yr}-07-01`)} y={H - 6} fontSize={10} fill="#8a8a8a" textAnchor="middle">
          {yr}
        </text>
      ))}
      <polyline points={points} fill="none" stroke="#6fbf73" strokeWidth={2} />
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
      <text x={W - PAD.right} y={PAD.top + ih - 6} fontSize={10} fill="#6fbf73" textAnchor="end">
        mean NDVI over restoration reach (monthly)
      </text>
    </svg>
  );
}

const noopSubscribe = () => () => {};

export default function Home() {
  // Site selection comes from ?site=; the site links do full navigations, so
  // this is stable for the life of the page.
  const siteId = useSyncExternalStore(
    noopSubscribe,
    () => new URLSearchParams(window.location.search).get("site") ?? DEFAULT_SITE,
    () => DEFAULT_SITE
  );
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [stats, setStats] = useState<MonthlyStat[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<string>("context");
  const [render, setRender] = useState<RenderKind>("rgb");
  const [mode, setMode] = useState<MosaicMode>("composite");
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`/timelapses/${siteId}/manifest.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((m: Manifest) => {
        setManifest(m);
        const first = Object.values(m.variants)[0];
        if (first) {
          setView(first.view);
          setRender(first.render);
          setMode(first.mode);
        }
      })
      .catch(() => setLoadError(`No manifest found — run: npx tsx scripts/fetch-timelapse.ts sites/${siteId}.json`));
    fetch(`/timelapses/${siteId}/stats.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setStats)
      .catch(() => {});
  }, [siteId]);

  const variantKey = `${view}-${render}-${mode}`;
  const variant = manifest?.variants[variantKey] ?? null;
  const frames = useMemo(() => variant?.frames ?? [], [variant]);
  const frame = frames[Math.min(frameIndex, frames.length - 1)];

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

  const toggle = (
    label: string,
    options: string[],
    value: string,
    onChange: (v: string) => void,
    available: (v: string) => boolean
  ) => (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <span style={{ color: "#8a8a8a", fontSize: 12, width: 52 }}>{label}</span>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          disabled={!available(opt)}
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid #3a3a3a",
            background: value === opt ? "#3a5a3f" : "#232323",
            color: available(opt) ? "#e5e5e5" : "#555",
            cursor: available(opt) ? "pointer" : "default",
            fontSize: 13,
          }}
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
            {toggle("mode", ["composite", "simple"], mode, (v) => setMode(v as MosaicMode), (m) =>
              hasVariant(view, render, m)
            )}
          </div>

          {frame && (
            <div style={{ width: "min(920px, 100%)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={frame.path}
                alt={`${manifest.site.name} — ${frame.window.label}`}
                style={{
                  width: "100%",
                  imageRendering: view === "tight" ? "pixelated" : "auto",
                  borderRadius: 8,
                  background: "#000",
                }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginTop: 8,
                }}
              >
                <button
                  onClick={() => setPlaying((p) => !p)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: "1px solid #3a3a3a",
                    background: "#232323",
                    color: "#e5e5e5",
                    cursor: "pointer",
                  }}
                >
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

          {stats.length > 0 && (
            <div style={{ width: "min(920px, 100%)", background: "#1d1d1d", borderRadius: 8, padding: 12 }}>
              <NdviChart stats={stats} manifest={manifest} currentWindowMid={windowMid} />
            </div>
          )}
        </>
      )}
    </main>
  );
}
