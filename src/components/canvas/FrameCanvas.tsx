"use client";

import { useEffect, useRef } from "react";
import { useExplore } from "@/stores/explore";
import { windowIndex, windowsFor } from "@/lib/demo/load";
import FramePane from "./FramePane";

/** The multi-pane canvas plus scrub bar, driven by the explore store. */
export default function FrameCanvas({ editable }: { editable: boolean }) {
  const site = useExplore((s) => s.site);
  const viewState = useExplore((s) => s.viewState);
  const activePane = useExplore((s) => s.activePane);
  const playing = useExplore((s) => s.playing);
  const { setPane, setActivePane, setLayout, toggleAreas, toggleLinked, setWindowByIndex, setPlaying } =
    useExplore.getState();
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pane = viewState.panes[Math.min(activePane, viewState.panes.length - 1)];
  const windows = site ? windowsFor(site, pane.granularity) : [];
  const currentIdx = windowIndex(windows, pane.windowId);

  useEffect(() => {
    if (playing) {
      playRef.current = setInterval(() => {
        const s = useExplore.getState();
        const w = s.site ? windowsFor(s.site, s.viewState.panes[s.activePane].granularity) : [];
        const idx = windowIndex(w, s.viewState.panes[s.activePane].windowId);
        if (idx >= w.length - 1) s.setPlaying(false);
        else s.stepWindow(1);
      }, 450);
    }
    return () => {
      if (playRef.current) clearInterval(playRef.current);
    };
  }, [playing]);

  if (!site) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {editable && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-soft)", letterSpacing: "0.06em" }}>
            LAYOUT
          </span>
          {([1, 2, 3] as const).map((n) => (
            <button
              key={n}
              className={viewState.layout === n ? "selected" : undefined}
              onClick={() => setLayout(n)}
              style={{ padding: "3px 10px" }}
            >
              {n === 1 ? "single" : n === 2 ? "2-up" : "3-up"}
            </button>
          ))}
          <button className={viewState.showAreas ? "selected" : undefined} onClick={toggleAreas}>
            areas
          </button>
          {viewState.layout > 1 && (
            <button className={viewState.linkedScrub ? "selected" : undefined} onClick={toggleLinked}>
              linked scrub
            </button>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        {viewState.panes.map((p, i) => (
          <FramePane
            key={i}
            site={site}
            pane={p}
            active={i === activePane && viewState.layout > 1}
            showAreas={viewState.showAreas}
            emphasize={viewState.chart.emphasize}
            editable={editable}
            onActivate={() => setActivePane(i)}
            onChange={(patch) => setPane(i, patch)}
          />
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => setPlaying(!playing)} style={{ minWidth: 64 }}>
          {playing ? "Pause" : "Play"}
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(windows.length - 1, 0)}
          value={currentIdx}
          onChange={(e) => {
            setPlaying(false);
            setWindowByIndex(activePane, Number(e.target.value));
          }}
          style={{ flex: 1 }}
          aria-label="Time"
        />
        <span className="mono" style={{ fontSize: 12, minWidth: 110, textAlign: "right", color: "var(--ink-soft)" }}>
          {windows[currentIdx]?.label ?? ""}
        </span>
      </div>
    </div>
  );
}
