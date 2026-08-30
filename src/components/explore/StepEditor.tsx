"use client";

import { useExplore } from "@/stores/explore";
import { windowIndex, windowsFor } from "@/lib/demo/load";
import { METRICS } from "@/lib/demo/constants";
import type { DemoSiteManifest, PaneState, StoryStep } from "@/lib/demo/types";

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

const selectStyle: React.CSSProperties = {
  fontSize: 12,
  padding: "3px 6px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "var(--bg)",
  color: "var(--ink)",
  fontFamily: "inherit",
};

function windowLabel(site: DemoSiteManifest, pane: PaneState, windowId?: string): string {
  const windows = windowsFor(site, pane.granularity);
  const id = windowId ?? pane.windowId;
  return windows[windowIndex(windows, id)]?.label ?? id;
}

/** One mono line that states the step's entire visual definition. */
function recipeLine(site: DemoSiteManifest, step: StoryStep): string {
  const vs = step.viewState;
  const panes = vs.panes.map((p) => `${p.view} ${p.render}`).join(" + ");
  const labels = [...new Set(vs.panes.map((p) => windowLabel(site, p)))].join(" / ");
  const parts = [
    vs.layout === 1 ? "single" : `${vs.layout}-up`,
    panes,
    labels,
    vs.showAreas ? "areas on" : "areas off",
    vs.chart.visible
      ? `chart ${METRICS[vs.chart.metric].short}${vs.chart.emphasize.length ? ` (${vs.chart.emphasize.join(", ")})` : ""}`
      : "chart hidden",
  ];
  if (step.scrub) {
    const pane = vs.panes[step.scrub.paneIndex] ?? vs.panes[0];
    parts.push(`plays ${windowLabel(site, pane, step.scrub.fromId)} → ${windowLabel(site, pane, step.scrub.toId)}`);
  }
  return parts.join(" · ");
}

/** Capture bar, or — when a step is selected — the step recipe card.
 * The live-edit rule: while a step is selected, everything on the canvas IS
 * the step; all changes save to it immediately. */
export default function StepEditor() {
  const site = useExplore((s) => s.site);
  const story = useExplore((s) => s.story);
  const selectedStepId = useExplore((s) => s.selectedStepId);
  const { captureStep, updateStep, removeStep, duplicateStep, selectStep, ensureStory } = useExplore.getState();
  const step = story?.steps.find((st) => st.id === selectedStepId);
  const stepIndex = story?.steps.findIndex((st) => st.id === selectedStepId) ?? -1;

  if (!site) return null;

  const scrubPaneIdx = step?.scrub?.paneIndex ?? 0;
  const scrubPane = step?.viewState.panes[scrubPaneIdx] ?? step?.viewState.panes[0];
  const scrubWindows = step && scrubPane ? windowsFor(site, scrubPane.granularity) : [];

  const enableRange = () => {
    if (!step || !scrubPane || scrubWindows.length === 0) return;
    const fromId = scrubPane.windowId;
    const last = scrubWindows[scrubWindows.length - 1].id;
    updateStep(step.id, {
      scrub: { paneIndex: 0, fromId: fromId === last ? scrubWindows[0].id : fromId, toId: last },
    });
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
      {!step && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => captureStep()} style={{ fontWeight: 600 }}>
            + Capture step
          </button>
          {!story ? (
            <>
              <button onClick={() => ensureStory()}>New story</button>
              <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                capture the canvas as steps, or ask the assistant to draft them
              </span>
            </>
          ) : (
            <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
              adds a step from the current canvas — or select a step in the sidebar to edit it
            </span>
          )}
        </div>
      )}

      {step && (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span
              className="mono"
              style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--accent)", fontWeight: 500 }}
            >
              EDITING STEP {stepIndex + 1}
            </span>
            <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
              canvas changes save to this step as you make them
            </span>
            <div style={{ display: "flex", gap: 5, marginLeft: "auto" }}>
              <button style={{ fontSize: 12 }} onClick={() => captureStep()}>
                + Capture next
              </button>
              <button style={{ fontSize: 12 }} onClick={() => duplicateStep(step.id)}>
                Duplicate
              </button>
              <button style={{ fontSize: 12 }} onClick={() => removeStep(step.id)}>
                Delete
              </button>
              <button style={{ fontSize: 12, fontWeight: 600 }} onClick={() => selectStep(null)}>
                Done
              </button>
            </div>
          </div>

          <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-soft)", lineHeight: 1.4 }}>
            {recipeLine(site, step)}
          </div>

          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={step.viewState.chart.visible}
                onChange={(e) => useExplore.getState().setChart({ visible: e.target.checked })}
              />
              Show chart in this step
            </label>

            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span className="mono" style={{ fontSize: 10.5, letterSpacing: "0.08em", color: "var(--ink-soft)" }}>
                PLAYBACK
              </span>
              <button
                className={!step.scrub ? "selected" : undefined}
                style={{ padding: "2px 9px", fontSize: 12 }}
                onClick={() => updateStep(step.id, { scrub: undefined })}
              >
                Hold frame
              </button>
              <button
                className={step.scrub ? "selected" : undefined}
                style={{ padding: "2px 9px", fontSize: 12 }}
                onClick={() => !step.scrub && enableRange()}
              >
                Play range
              </button>
              {step.scrub && (
                <>
                  {step.viewState.layout > 1 && (
                    <select
                      style={selectStyle}
                      value={scrubPaneIdx}
                      onChange={(e) =>
                        updateStep(step.id, { scrub: { ...step.scrub!, paneIndex: Number(e.target.value) } })
                      }
                      aria-label="Scrub pane"
                    >
                      {step.viewState.panes.map((_, i) => (
                        <option key={i} value={i}>
                          pane {i + 1}
                        </option>
                      ))}
                    </select>
                  )}
                  <select
                    style={selectStyle}
                    value={step.scrub.fromId}
                    onChange={(e) => updateStep(step.id, { scrub: { ...step.scrub!, fromId: e.target.value } })}
                    aria-label="Play from"
                  >
                    {scrubWindows.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>→</span>
                  <select
                    style={selectStyle}
                    value={step.scrub.toId}
                    onChange={(e) => updateStep(step.id, { scrub: { ...step.scrub!, toId: e.target.value } })}
                    aria-label="Play to"
                  >
                    {scrubWindows.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                  <button
                    style={{ padding: "2px 8px", fontSize: 11 }}
                    onClick={() =>
                      scrubPane && updateStep(step.id, { scrub: { ...step.scrub!, fromId: scrubPane.windowId } })
                    }
                  >
                    from = current
                  </button>
                  <button
                    style={{ padding: "2px 8px", fontSize: 11 }}
                    onClick={() =>
                      scrubPane && updateStep(step.id, { scrub: { ...step.scrub!, toId: scrubPane.windowId } })
                    }
                  >
                    to = current
                  </button>
                </>
              )}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "150px 1fr",
              gap: 10,
              maxHeight: "22vh",
              overflowY: "auto",
            }}
          >
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
                  style={{ ...inputStyle, minHeight: 56, resize: "vertical" }}
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
        </>
      )}
    </div>
  );
}
