"use client";

import { useExplore, cloneViewState } from "@/stores/explore";

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 13,
  padding: "5px 8px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "var(--bg)",
  color: "var(--ink)",
  fontFamily: "inherit",
};

/** Capture bar + inline editor for the selected story step. */
export default function StepEditor() {
  const story = useExplore((s) => s.story);
  const selectedStepId = useExplore((s) => s.selectedStepId);
  const { captureStep, updateStep } = useExplore.getState();
  const step = story?.steps.find((st) => st.id === selectedStepId);

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={() => captureStep()} style={{ fontWeight: 600 }}>
          + Capture step
        </button>
        <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
          snapshots the current canvas &amp; chart as a story step
        </span>
        {step && (
          <button
            style={{ marginLeft: "auto", fontSize: 12 }}
            onClick={() => updateStep(step.id, { viewState: cloneViewState(useExplore.getState().viewState) })}
          >
            Update step&apos;s view from canvas
          </button>
        )}
      </div>

      {step && (
        <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 11, color: "var(--ink-soft)" }}>
              PHASE
              <input
                style={inputStyle}
                value={step.phase ?? ""}
                placeholder="e.g. Establish"
                onChange={(e) => updateStep(step.id, { phase: e.target.value })}
              />
            </label>
            <label style={{ fontSize: 11, color: "var(--ink-soft)" }}>
              POINT AT
              <input
                style={inputStyle}
                value={step.pointAt ?? ""}
                placeholder="what to look at"
                onChange={(e) => updateStep(step.id, { pointAt: e.target.value })}
              />
            </label>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 11, color: "var(--ink-soft)" }}>
              SAY
              <textarea
                style={{ ...inputStyle, minHeight: 64, resize: "vertical" }}
                value={step.say}
                placeholder="One claim this step makes…"
                onChange={(e) => updateStep(step.id, { say: e.target.value })}
              />
            </label>
            <div>
              <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>FACTS</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 3 }}>
                {step.facts.map((f, i) => (
                  <div key={i} style={{ display: "flex", gap: 5 }}>
                    <input
                      style={{ ...inputStyle, flex: 2 }}
                      value={f.text}
                      placeholder="fact"
                      onChange={(e) =>
                        updateStep(step.id, {
                          facts: step.facts.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)),
                        })
                      }
                    />
                    <input
                      style={{ ...inputStyle, flex: 1 }}
                      value={f.source ?? ""}
                      placeholder="source"
                      onChange={(e) =>
                        updateStep(step.id, {
                          facts: step.facts.map((x, j) => (j === i ? { ...x, source: e.target.value } : x)),
                        })
                      }
                    />
                    <button
                      style={{ fontSize: 12 }}
                      onClick={() => updateStep(step.id, { facts: step.facts.filter((_, j) => j !== i) })}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  style={{ fontSize: 12, alignSelf: "flex-start" }}
                  onClick={() => updateStep(step.id, { facts: [...step.facts, { text: "" }] })}
                >
                  + fact
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
