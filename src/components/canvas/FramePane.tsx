"use client";

import { useEffect, useMemo } from "react";
import type { DemoSiteManifest, PaneState } from "@/lib/demo/types";
import { windowIndex, windowsFor } from "@/lib/demo/load";
import { framePath } from "@/lib/demo/types";
import { bboxAround } from "@/lib/pipeline/geo";
import { useBoxSize } from "@/lib/useBoxSize";
import AreaOverlay from "./AreaOverlay";

const RENDERS = ["rgb", "ndvi", "ndmi"] as const;
const GRANULARITIES = ["quarterly", "monthly"] as const;

function ControlRow({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {options.map((opt) => (
        <button
          key={opt}
          className={value === opt ? "selected" : undefined}
          style={{ padding: "2px 8px", fontSize: 12, borderRadius: 6 }}
          onClick={(e) => {
            e.stopPropagation();
            onChange(opt);
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function FramePane({
  site,
  pane,
  active,
  showAreas,
  emphasize,
  editable,
  onActivate,
  onChange,
}: {
  site: DemoSiteManifest;
  pane: PaneState;
  active: boolean;
  showAreas: boolean;
  emphasize?: string[];
  /** Show per-pane controls (explore mode). */
  editable: boolean;
  onActivate: () => void;
  onChange: (patch: Partial<PaneState>) => void;
}) {
  const windows = windowsFor(site, pane.granularity);
  const current = windows[windowIndex(windows, pane.windowId)];
  const [areaRef, areaSize] = useBoxSize<HTMLDivElement>();
  const side = Math.max(0, Math.min(areaSize.w, areaSize.h));
  const viewBbox = useMemo(() => {
    const vc = site.views[pane.view];
    return vc ? bboxAround(site.center, vc.widthMeters) : null;
  }, [site, pane.view]);

  // Preload the pane's active variant so scrubbing is instant.
  useEffect(() => {
    windows.forEach((w) => {
      const img = new Image();
      img.src = framePath(site.id, pane.granularity, pane.view, pane.render, w.id);
    });
  }, [site.id, pane.granularity, pane.view, pane.render, windows]);

  if (!current) return null;
  const src = framePath(site.id, pane.granularity, pane.view, pane.render, current.id);

  return (
    <div
      onClick={onActivate}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        cursor: editable ? "pointer" : "default",
      }}
    >
      {editable && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
          <ControlRow options={Object.keys(site.views)} value={pane.view} onChange={(v) => onChange({ view: v as PaneState["view"] })} />
          <ControlRow options={RENDERS} value={pane.render} onChange={(v) => onChange({ render: v as PaneState["render"] })} />
          <ControlRow options={GRANULARITIES} value={pane.granularity} onChange={(v) => onChange({ granularity: v as PaneState["granularity"] })} />
        </div>
      )}
      {/* Frames are square; size the wrapper to the largest square that fits so
          the overlay percentages always match the image exactly. */}
      <div
        ref={areaRef}
        style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        {side > 20 && (
          <div
            style={{
              position: "relative",
              width: side,
              height: side,
              overflow: "hidden",
              borderRadius: 10,
              border: active && editable ? "2px solid var(--accent)" : "2px solid transparent",
              background: "#000",
              boxSizing: "border-box",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`${site.name} — ${pane.view} ${pane.render} ${current.label}`}
              style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }}
            />
            {showAreas && viewBbox && (
              <AreaOverlay areas={site.analysisAreas} viewBbox={viewBbox} emphasize={emphasize} />
            )}
            <span
              className="mono"
              style={{
                position: "absolute",
                right: 8,
                bottom: 8,
                background: "rgba(0,0,0,0.55)",
                color: "#eee",
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 5,
              }}
            >
              {current.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
