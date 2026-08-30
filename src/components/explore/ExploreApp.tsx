"use client";

import { useEffect, useState } from "react";
import { useExplore } from "@/stores/explore";
import FrameCanvas from "@/components/canvas/FrameCanvas";
import ChartPanel from "@/components/canvas/ChartPanel";
import Sidebar from "./Sidebar";
import StepEditor from "./StepEditor";
import ChatPanel from "./ChatPanel";

export default function ExploreApp({ siteId }: { siteId: string }) {
  const site = useExplore((s) => s.site);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    useExplore
      .getState()
      .loadSite(siteId)
      .catch((e: Error) => setError(e.message));
  }, [siteId]);

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
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar siteId={siteId} />
      <main style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "16px 18px 40px" }}>
        {error && <p style={{ color: "var(--fire)" }}>{error}</p>}
        {site && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 1100, margin: "0 auto" }}>
            <div>
              <h1 style={{ fontSize: 19, margin: 0 }}>{site.name}</h1>
              <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "3px 0 0", maxWidth: "72ch" }}>
                {site.description}
              </p>
            </div>
            <FrameCanvas editable />
            <ChartPanel editable />
            <StepEditor />
          </div>
        )}
      </main>
      <ChatPanel siteId={siteId} />
    </div>
  );
}
