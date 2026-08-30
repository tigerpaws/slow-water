"use client";

import { useEffect, useState } from "react";
import { DEMO_SITES } from "@/lib/demo/load";
import { DEMO_STORIES, deleteStory, listSavedStories } from "@/lib/demo/stories";
import type { Story } from "@/lib/demo/types";

const cardStyle: React.CSSProperties = {
  display: "block",
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "16px 18px",
  textDecoration: "none",
  boxShadow: "var(--shadow)",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mono"
      style={{ fontSize: 11.5, letterSpacing: "0.12em", color: "var(--ink-soft)", margin: "34px 0 10px", fontWeight: 500 }}
    >
      {children}
    </h2>
  );
}

export default function Home() {
  const [saved, setSaved] = useState<Story[]>([]);
  useEffect(() => {
    const t = setTimeout(() => setSaved(listSavedStories()), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "56px 20px 96px" }}>
      <h1 style={{ fontSize: 34, margin: 0, letterSpacing: "-0.01em" }}>Slow Water</h1>
      <p className="serif" style={{ fontSize: 16.5, color: "var(--ink-soft)", maxWidth: "62ch", marginTop: 8 }}>
        Environmental change, seen from orbit. Explore a decade of satellite imagery over two
        California stream-restoration sites, compare the worked land against its neighbors,
        and assemble the evidence into a story anyone can walk through.
      </p>

      <SectionLabel>WATCH A STORY</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        {DEMO_STORIES.map((s) => (
          <a key={s.id} href={`/view/${s.id}`} style={cardStyle}>
            <div style={{ fontWeight: 650, fontSize: 15.5 }}>{s.title}</div>
            {s.logline && (
              <div className="serif" style={{ fontSize: 13.5, color: "var(--ink-soft)", marginTop: 5, fontStyle: "italic" }}>
                {s.logline}
              </div>
            )}
            <div className="mono" style={{ fontSize: 11, color: "var(--accent)", marginTop: 10 }}>
              {s.steps.length} steps ▸
            </div>
          </a>
        ))}
      </div>

      <SectionLabel>EXPLORE A SITE</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        {DEMO_SITES.map((s) => (
          <a key={s.id} href={`/explore/${s.id}`} style={cardStyle}>
            <div style={{ fontWeight: 650, fontSize: 15.5 }}>{s.label}</div>
            <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 5 }}>
              {s.id === "doty-ravine"
                ? "Beaver-powered floodplain in the Sierra foothills · 2016–2025"
                : "Montane meadow through the Dixie Fire and a historic beaver release · 2019–2025"}
            </div>
            <div className="mono" style={{ fontSize: 11, color: "var(--accent)", marginTop: 10 }}>
              open in explore ▸
            </div>
          </a>
        ))}
      </div>

      {saved.length > 0 && (
        <>
          <SectionLabel>YOUR STORIES</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {saved.map((s) => (
              <div key={s.id} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
                <a href={`/view/${s.id}`} style={{ textDecoration: "none", fontWeight: 600, fontSize: 14, flex: 1 }}>
                  {s.title}
                </a>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                  {s.steps.length} steps · {s.siteId}
                </span>
                <button
                  style={{ fontSize: 11.5 }}
                  onClick={() => {
                    deleteStory(s.id);
                    setSaved(listSavedStories());
                  }}
                >
                  delete
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 48 }}>
        Prototype — two demo sites with Sentinel-2 imagery (ESA Copernicus), processed via Sentinel Hub.
        The full app would fetch any location on demand.
      </p>
    </main>
  );
}
