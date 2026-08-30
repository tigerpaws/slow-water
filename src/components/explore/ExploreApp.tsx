"use client";

import { useEffect, useMemo, useState } from "react";
import { useExplore } from "@/stores/explore";
import { windowIndex, windowsFor } from "@/lib/demo/load";
import FrameCanvas from "@/components/canvas/FrameCanvas";
import TimePanel from "@/components/canvas/TimePanel";
import StepEditor from "./StepEditor";
import ChatPanel from "./ChatPanel";

export default function ExploreApp({ siteId }: { siteId: string }) {
  const site = useExplore((s) => s.site);
  const story = useExplore((s) => s.story);
  const selectedStepId = useExplore((s) => s.selectedStepId);
  const [error, setError] = useState<string | null>(null);

  const editingStep = story?.steps.find((st) => st.id === selectedStepId);
  const scrubRange = useMemo(() => {
    if (!editingStep?.scrub || !site) return null;
    const windows = windowsFor(site, editingStep.viewState.panes[editingStep.scrub.paneIndex]?.granularity ?? "quarterly");
    const from = windowIndex(windows, editingStep.scrub.fromId);
    const to = windowIndex(windows, editingStep.scrub.toId);
    return from <= to ? { from, to } : { from: to, to: from };
  }, [editingStep, site]);

  useEffect(() => {
    useExplore
      .getState()
      .loadSite(siteId)
      .catch((e: Error) => setError(e.message));
  }, [siteId]);

  // Canvas changes write through to the selected step only in explore mode.
  useEffect(() => {
    useExplore.getState().setLiveSync(true);
    return () => useExplore.getState().setLiveSync(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
      const s = useExplore.getState();
      if (e.key === "ArrowRight") s.stepWindow(1);
      if (e.key === "ArrowLeft") s.stepWindow(-1);
      if (e.key === " ") {
        e.preventDefault();
        s.setPlaying(!s.playing);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      <main style={{ flex: 1, minWidth: 0, overflow: "hidden", padding: "12px 18px 14px", display: "flex" }}>
        {error && <p style={{ color: "var(--fire)" }}>{error}</p>}
        {site && (
          <div
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              maxWidth: 1100,
              margin: "0 auto",
              width: "100%",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
              <h1 style={{ fontSize: 18, margin: 0, whiteSpace: "nowrap" }}>{site.name}</h1>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--ink-soft)",
                  margin: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {site.description}
              </p>
            </div>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                border: editingStep ? "2px solid var(--accent)" : "2px solid transparent",
                borderRadius: 14,
                padding: 6,
              }}
            >
              <FrameCanvas editable />
              <TimePanel editable range={scrubRange} />
            </div>
            <StepEditor />
          </div>
        )}
      </main>
      <ChatPanel siteId={siteId} />
    </div>
  );
}
