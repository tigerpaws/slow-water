"use client";

import { useExplore } from "@/stores/explore";
import FramePane from "./FramePane";
import ControlGroup from "./ControlGroup";

function GroupButton({
  selected,
  title,
  onClick,
  children,
}: {
  selected: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={selected ? "selected" : undefined}
      title={title}
      onClick={onClick}
      style={{
        padding: "2px 9px",
        fontSize: 12,
        borderRadius: 6,
        ...(selected ? {} : { background: "transparent", borderColor: "transparent" }),
      }}
    >
      {children}
    </button>
  );
}

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
          <ControlGroup label="LAYOUT">
            {([1, 2, 3] as const).map((n) => (
              <GroupButton
                key={n}
                selected={viewState.layout === n}
                title={n === 1 ? "One frame" : `${n} frames side by side, each with its own controls`}
                onClick={() => setLayout(n)}
              >
                {n === 1 ? "single" : n === 2 ? "2-up" : "3-up"}
              </GroupButton>
            ))}
          </ControlGroup>
          <ControlGroup label="OVERLAYS">
            <GroupButton
              selected={viewState.showAreas}
              title="Outline the analysis areas on the frames — treatment, control, reference"
              onClick={toggleAreas}
            >
              areas
            </GroupButton>
            <GroupButton
              selected={viewState.chart.visible}
              title="Show the measurement chart below the frames"
              onClick={() => useExplore.getState().setChart({ visible: !viewState.chart.visible })}
            >
              chart
            </GroupButton>
          </ControlGroup>
          {viewState.layout > 1 && (
            <ControlGroup label="SCRUB">
              <GroupButton
                selected={viewState.linkedScrub}
                title="Move all panes through time together"
                onClick={toggleLinked}
              >
                linked
              </GroupButton>
            </ControlGroup>
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
