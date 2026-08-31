"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useExplore, newId } from "@/stores/explore";
import { windowIndex, windowsFor } from "@/lib/demo/load";
import { getStory, isDemoStory } from "@/lib/demo/stories";
import FrameCanvas from "@/components/canvas/FrameCanvas";
import TimePanel from "@/components/canvas/TimePanel";
import StepEditor from "./StepEditor";

/**
 * The shared canvas screen in two modes: "explore" browses a site (nothing is
 * recorded); "edit" authors a story — the step rail appears in the sidebar and
 * canvas changes write through to the selected step.
 */
export default function ExploreApp({
  mode,
  siteId,
  storyId,
}: {
  mode: "explore" | "edit";
  siteId?: string;
  storyId?: string;
}) {
  const router = useRouter();
  const site = useExplore((s) => s.site);
  const story = useExplore((s) => s.story);
  const selectedStepId = useExplore((s) => s.selectedStepId);
  const [error, setError] = useState<string | null>(null);

  const editingStep = mode === "edit" ? story?.steps.find((st) => st.id === selectedStepId) : undefined;
  const scrubRange = useMemo(() => {
    if (!editingStep?.scrub || !site) return null;
    const windows = windowsFor(site, editingStep.viewState.panes[editingStep.scrub.paneIndex]?.granularity ?? "quarterly");
    const from = windowIndex(windows, editingStep.scrub.fromId);
    const to = windowIndex(windows, editingStep.scrub.toId);
    return from <= to ? { from, to } : { from: to, to: from };
  }, [editingStep, site]);

  // Explore mode: load the site fresh.
  useEffect(() => {
    if (mode !== "explore" || !siteId) return;
    useExplore
      .getState()
      .loadSite(siteId)
      .catch((e: Error) => setError(e.message));
  }, [mode, siteId]);

  // Edit mode: resolve the story (reusing in-memory state when arriving from
  // explore or view mode), fork demo stories, and load the story's site.
  useEffect(() => {
    if (mode !== "edit" || !storyId) return;
    const t = setTimeout(() => {
      const st = useExplore.getState();
      const selectFirst = () => {
        const s = useExplore.getState();
        if (!s.selectedStepId && s.story?.steps.length) s.selectStep(s.story.steps[0].id);
      };
      if (st.story?.id === storyId) {
        const ready =
          st.site?.id === st.story.siteId
            ? Promise.resolve()
            : st.loadSite(st.story.siteId, { keepStory: true });
        ready.then(selectFirst).catch((e: Error) => setError(e.message));
        return;
      }
      const found = getStory(storyId);
      if (!found) {
        setError("Story not found — unsaved drafts don't survive a reload.");
        return;
      }
      if (isDemoStory(found.id)) {
        // Demo stories are read-only: editing always works on a copy.
        const fork = { ...found, id: newId("story"), title: `${found.title} (copy)` };
        useExplore.getState().setStory(fork);
        router.replace(`/edit/${fork.id}`);
        return;
      }
      useExplore
        .getState()
        .loadSite(found.siteId, { keepStory: true })
        .then(() => {
          useExplore.getState().setStory(found);
          selectFirst();
        })
        .catch((e: Error) => setError(e.message));
    }, 0);
    return () => clearTimeout(t);
  }, [mode, storyId, router]);

  // Canvas changes write through to the selected step only while editing.
  useEffect(() => {
    if (mode !== "edit") return;
    useExplore.getState().setLiveSync(true);
    return () => useExplore.getState().setLiveSync(false);
  }, [mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;
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
        {error && <p style={{ color: "var(--fire)", margin: "auto" }}>{error}</p>}
        {!error && site && (
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
              <h1 style={{ fontSize: 18, margin: 0, whiteSpace: "nowrap" }}>
                {mode === "edit" && story ? story.title : site.name}
              </h1>
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
                {mode === "edit" ? `editing a story on ${site.name}` : site.description}
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
            {mode === "edit" && <StepEditor />}
          </div>
        )}
      </main>
    </div>
  );
}
