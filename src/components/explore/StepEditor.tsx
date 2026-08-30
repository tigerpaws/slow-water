"use client";

import { useRouter } from "next/navigation";
import { useExplore, cloneViewState } from "@/stores/explore";
import { exportStory, saveStory } from "@/lib/demo/stories";

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

/** Story-draft bar: capture, step chips, title, save/play/export — plus the
 * inline editor for the selected step. */
export default function StepEditor() {
  const router = useRouter();
  const story = useExplore((s) => s.story);
  const selectedStepId = useExplore((s) => s.selectedStepId);
  const { captureStep, updateStep, removeStep, moveStep, selectStep, ensureStory, setStory, setStoryMeta } =
    useExplore.getState();
  const step = story?.steps.find((st) => st.id === selectedStepId);
  const stepIndex = story?.steps.findIndex((st) => st.id === selectedStepId) ?? -1;

  const handlePlay = () => {
    const s = useExplore.getState().story;
    if (!s || s.steps.length === 0) return;
    saveStory(s);
    router.push(`/view/${s.id}`);
  };

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => captureStep()} style={{ fontWeight: 600 }}>
          + Capture step
        </button>
        {story ? (
          <>
            <input
              value={story.title}
              onChange={(e) => setStoryMeta({ title: e.target.value })}
              aria-label="Story title"
              style={{ ...inputStyle, width: 180, fontWeight: 600 }}
            />
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {story.steps.map((st, i) => (
                <button
                  key={st.id}
                  className={st.id === selectedStepId ? "selected" : undefined}
                  onClick={() => selectStep(st.id === selectedStepId ? null : st.id)}
                  title={st.phase || st.say.slice(0, 60) || `step ${i + 1}`}
                  style={{ padding: "3px 9px", fontSize: 12, fontVariantNumeric: "tabular-nums" }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 5, marginLeft: "auto" }}>
              <button style={{ fontSize: 12 }} onClick={() => story && saveStory(story)}>
                Save
              </button>
              <button style={{ fontSize: 12 }} onClick={handlePlay} disabled={story.steps.length === 0}>
                Play ▸
              </button>
              <button style={{ fontSize: 12 }} onClick={() => story && exportStory(story)}>
                Export
              </button>
              <button style={{ fontSize: 12 }} onClick={() => setStory(null)}>
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <button onClick={() => ensureStory()}>New story</button>
            <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
              capture the canvas as steps, or ask the assistant to draft them
            </span>
          </>
        )}
      </div>

      {step && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "150px 1fr",
            gap: 10,
            maxHeight: "24vh",
            overflowY: "auto",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 4 }}>
              <button style={{ padding: "1px 8px", fontSize: 11 }} onClick={() => moveStep(step.id, -1)} disabled={stepIndex <= 0}>
                ↑
              </button>
              <button
                style={{ padding: "1px 8px", fontSize: 11 }}
                onClick={() => moveStep(step.id, 1)}
                disabled={stepIndex < 0 || stepIndex >= (story?.steps.length ?? 0) - 1}
              >
                ↓
              </button>
              <button style={{ padding: "1px 8px", fontSize: 11 }} onClick={() => removeStep(step.id)}>
                delete
              </button>
            </div>
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
            <button
              style={{ fontSize: 11.5 }}
              onClick={() => updateStep(step.id, { viewState: cloneViewState(useExplore.getState().viewState) })}
            >
              Update view from canvas
            </button>
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
