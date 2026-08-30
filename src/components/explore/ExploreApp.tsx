"use client";

import { useEffect, useState } from "react";
import { useExplore } from "@/stores/explore";
import FrameCanvas from "@/components/canvas/FrameCanvas";
import TimePanel from "@/components/canvas/TimePanel";
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
            <FrameCanvas editable />
            <TimePanel editable />
            <StepEditor />
          </div>
        )}
      </main>
      <ChatPanel siteId={siteId} />
    </div>
  );
}
