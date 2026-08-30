"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useExplore } from "@/stores/explore";
import { getStory } from "@/lib/demo/stories";
import { windowIndex, windowsFor } from "@/lib/demo/load";
import type { Story } from "@/lib/demo/types";
import { useBoxSize } from "@/lib/useBoxSize";
import FrameCanvas from "@/components/canvas/FrameCanvas";
import TimePanel from "@/components/canvas/TimePanel";

export default function StoryPlayer({ storyId }: { storyId: string }) {
  const router = useRouter();
  const [story, setStory] = useState<Story | null>(null);
  const [missing, setMissing] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const site = useExplore((s) => s.site);

  // Load story + its site (deferred a tick: getStory reads localStorage).
  useEffect(() => {
    const t = setTimeout(() => {
      const s = getStory(storyId);
      if (!s) {
        setMissing(true);
        return;
      }
      setStory(s);
      useExplore.getState().loadSite(s.siteId).catch(() => setMissing(true));
    }, 0);
    return () => clearTimeout(t);
  }, [storyId]);

  const step = story?.steps[stepIdx];

  // Scrub-range window indices for this step, in the scrub pane's windows.
  const scrubRange = useMemo(() => {
    if (!step?.scrub || !site) return null;
    const windows = windowsFor(site, step.viewState.panes[step.scrub.paneIndex].granularity);
    const from = windowIndex(windows, step.scrub.fromId);
    const to = windowIndex(windows, step.scrub.toId);
    return from <= to ? { from, to } : { from: to, to: from };
  }, [step, site]);

  // Apply the step's view state; auto-play its scrub range if it has one.
  useEffect(() => {
    if (!step || !site) return;
    const store = useExplore.getState();
    store.applyViewState(step.viewState);
    if (step.scrub && scrubRange) {
      store.setActivePane(step.scrub.paneIndex);
      store.setWindowByIndex(step.scrub.paneIndex, scrubRange.from);
      store.setPlaying(true);
    }
    return () => useExplore.getState().setPlaying(false);
  }, [step, site, scrubRange]);

  const go = useCallback(
    (delta: number) => {
      if (!story) return;
      setStepIdx((i) => Math.max(0, Math.min(story.steps.length - 1, i + delta)));
    },
    [story]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        go(1);
      }
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "Escape") router.push("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, router]);

  const [areaRef, areaSize] = useBoxSize<HTMLDivElement>();
  const [panelRef, panelSize] = useBoxSize<HTMLDivElement>();

  // Exact height for the frame row: the largest square the panes can use,
  // bounded by width share and by the space left over the time panel — so
  // frames sit tight above the chart and the pair centers in the viewport.
  const frameHeight = (() => {
    if (!step || areaSize.h === 0) return null;
    const n = step.viewState.layout;
    const widthBound = (areaSize.w - 10 * (n - 1)) / n;
    const panelSpace = panelSize.h > 0 ? panelSize.h + 10 : 0;
    const heightBound = areaSize.h - panelSpace;
    return Math.max(60, Math.min(widthBound, heightBound));
  })();

  const openInExplore = () => {
    if (!story) return;
    useExplore.getState().setStory(story);
    router.push(`/explore/${story.siteId}`);
  };

  if (missing)
    return (
      <main style={{ padding: 40 }}>
        <p>Story not found. <Link href="/">Back home</Link></p>
      </main>
    );
  if (!story || !site || !step) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          padding: "10px 18px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Link href="/" style={{ textDecoration: "none", fontWeight: 700, fontSize: 14 }}>
          Slow Water
        </Link>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{story.title}</span>
        <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>
          {site.name}
        </span>
        <button onClick={openInExplore} style={{ marginLeft: "auto", fontSize: 12 }}>
          Open in explore
        </button>
      </header>

      <main style={{ flex: 1, minHeight: 0, overflow: "hidden", padding: "12px 18px", display: "flex" }}>
        <div
          ref={areaRef}
          style={{
            flex: 1,
            minHeight: 0,
            maxWidth: 1000,
            margin: "0 auto",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 10,
          }}
        >
          {frameHeight !== null && (
            <div style={{ height: frameHeight, display: "flex", flexShrink: 0 }}>
              <FrameCanvas editable={false} />
            </div>
          )}
          <div ref={panelRef}>
            <TimePanel editable={false} showScrub={!!step.scrub} range={scrubRange} />
          </div>
        </div>
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--border)",
          background: "var(--panel)",
          padding: "14px 18px 16px",
        }}
      >
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", gap: 18, alignItems: "stretch" }}>
          {/* Fixed height so the canvas doesn't jump between steps; long content scrolls inside. */}
          <div style={{ flex: 1, minWidth: 0, height: "clamp(180px, 30vh, 280px)", overflowY: "auto" }}>
            {step.phase && (
              <div
                className="mono"
                style={{ fontSize: 10.5, letterSpacing: "0.12em", color: "var(--accent)", textTransform: "uppercase" }}
              >
                {step.phase}
              </div>
            )}
            <p className="serif" style={{ fontSize: 15.5, lineHeight: 1.45, margin: "4px 0 6px", maxWidth: "75ch" }}>
              {step.say}
            </p>
            {step.pointAt && (
              <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 8px" }}>
                <span style={{ color: "var(--accent)" }}>→ </span>
                {step.pointAt}
              </p>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {step.facts.map((f, i) => (
                <span
                  key={i}
                  className="mono"
                  style={{
                    fontSize: 11.5,
                    background: "var(--panel-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 999,
                    padding: "2px 10px",
                  }}
                >
                  {f.text}
                  {f.source && <span style={{ color: "var(--ink-soft)" }}> · {f.source}</span>}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, paddingTop: 6 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => go(-1)} disabled={stepIdx === 0}>←</button>
              <button onClick={() => go(1)} disabled={stepIdx === story.steps.length - 1} style={{ fontWeight: 600 }}>
                Next →
              </button>
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              {story.steps.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setStepIdx(i)}
                  aria-label={`Step ${i + 1}`}
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    padding: 0,
                    border: "none",
                    background: i === stepIdx ? "var(--accent)" : "var(--border-strong)",
                  }}
                />
              ))}
            </div>
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-soft)" }}>
              {stepIdx + 1} / {story.steps.length}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
