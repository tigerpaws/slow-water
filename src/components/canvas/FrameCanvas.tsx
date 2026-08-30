"use client";

import { useExplore } from "@/stores/explore";
import FramePane from "./FramePane";

/** The multi-pane frame area. Time control lives in TimePanel. */
export default function FrameCanvas({ editable }: { editable: boolean }) {
  const site = useExplore((s) => s.site);
  const viewState = useExplore((s) => s.viewState);
  const activePane = useExplore((s) => s.activePane);
  const { setPane, setActivePane, setLayout, toggleAreas, toggleLinked } = useExplore.getState();

  if (!site) return null;

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 8 }}>
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

      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 10 }}>
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
    </div>
  );
}
