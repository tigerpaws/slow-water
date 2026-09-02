"use client";

import { useEffect, useState } from "react";
import { DEMO_SITES } from "@/lib/demo/load";
import { DEMO_STORIES, listSavedStories } from "@/lib/demo/stories";
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
    <main style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "48px 20px 96px" }}>
      <h1 style={{ fontSize: 34, margin: 0, letterSpacing: "-0.01em" }}>Slow Water</h1>
      <p className="serif" style={{ fontSize: 16.5, color: "var(--ink-soft)", maxWidth: "62ch", marginTop: 8 }}>
        A tool for turning satellite archives into environmental evidence. When restoration
        work slows water down — beaver dams, reconnected floodplains — the land holds
        moisture longer, stays green deeper into the dry season, and shrugs off drought and
        fire in ways a decade of imagery can actually show. Slow Water pairs that imagery
        with the numbers to back what your eyes see, over two California stream-restoration
        sites where beavers are doing the engineering.
      </p>
      <p className="serif" style={{ fontSize: 14.5, color: "var(--ink-soft)", maxWidth: "62ch", marginTop: 10 }}>
        <strong style={{ color: "var(--ink)" }}>Watch</strong> a guided story, step by step.{" "}
        <strong style={{ color: "var(--ink)" }}>Explore</strong> a site yourself — scrub through
        time, compare views side by side, chart the analysis areas.{" "}
        <strong style={{ color: "var(--ink)" }}>Author</strong> your own story with an assistant
        that drives the canvas and cites real measurements, never invented ones.
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
              </div>
            ))}
          </div>
        </>
      )}

      <SectionLabel>THE DATA</SectionLabel>
      <p className="serif" style={{ fontSize: 14.5, color: "var(--ink)", maxWidth: "66ch", margin: "0 0 12px" }}>
        Every frame is a cloud-masked median composite of ESA Sentinel-2 scenes (10&nbsp;m per
        pixel), built offline through the Sentinel Hub APIs and served here as a static
        archive. Each site comes at two zooms — a wide context view and a view tight on the
        worked reach — in three renders: true color, NDVI for greenness, and NDMI for
        moisture. Alongside the imagery, monthly statistics are computed over three
        hand-drawn analysis areas per site — the restoration treatment, a control, and a
        reference — so every claim in a story can point at a number.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        <div style={{ ...cardStyle, cursor: "default" }}>
          <div style={{ fontWeight: 650, fontSize: 14.5 }}>Doty Ravine</div>
          <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 6, lineHeight: 1.7 }}>
            Sierra foothills · Placer County, CA
            <br />2016 – 2025 · 40 quarterly + 117 monthly composites
            <br />2 zooms × 3 renders · ~5 km &amp; 1.8 km views
          </div>
        </div>
        <div style={{ ...cardStyle, cursor: "default" }}>
          <div style={{ fontWeight: 650, fontSize: 14.5 }}>Tásmam Koyóm</div>
          <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 6, lineHeight: 1.7 }}>
            Humbug Valley · Plumas County, CA
            <br />2019 – 2025 · 28 quarterly + 84 monthly composites
            <br />2 zooms × 3 renders · 6 km &amp; 2.2 km views
          </div>
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 10, maxWidth: "66ch" }}>
        1,614 frames and roughly 600 area-months of NDVI, NDMI, and NBR statistics in all.
        This prototype ships with these two sites baked in; the full app would fetch imagery
        for any location and time range on demand.
      </p>

      <SectionLabel>GLOSSARY</SectionLabel>
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "14px 28px",
          margin: 0,
        }}
      >
        {[
          [
            "Sentinel-2",
            "ESA's twin imaging satellites: free 10 m-per-pixel imagery of everywhere on Earth, every ~5 days, since 2015.",
          ],
          [
            "Composite",
            "One image per time window, built by stacking every usable satellite pass and taking the per-pixel median with clouds masked out — the weather removed, the season kept.",
          ],
          [
            "NDVI · greenness",
            "A vegetation index computed from red and near-infrared light: how much living plant matter a pixel holds, from ~0 (bare ground) to ~0.9 (dense canopy).",
          ],
          [
            "NDMI · moisture",
            "A water index from near- and shortwave-infrared light: moisture held in soil and vegetation. Blue in the renders means wet ground — the beaver signal.",
          ],
          [
            "NBR · burn ratio",
            "An index that collapses when vegetation burns and recovers with the canopy — a gauge of fire severity and of how recovery is going.",
          ],
          [
            "Treatment / control / reference",
            "The compared analysis areas: where the restoration happened; a similar reach where it didn't; and a baseline area that tracks the climate alone. Divergence between their lines is the evidence.",
          ],
          [
            "Granularity",
            "How finely time is sliced: quarterly composites for decade-scale trends, monthly ones for dated events like a fire or a beaver release.",
          ],
          [
            "Process-based restoration",
            "Restoring a stream by restoring its processes — slowing water, reconnecting floodplains — often with beaver dam analogues (BDAs): human-built starter dams that real beavers take over.",
          ],
        ].map(([term, def]) => (
          <div key={term}>
            <dt style={{ fontWeight: 650, fontSize: 13.5 }}>{term}</dt>
            <dd className="serif" style={{ fontSize: 13.5, color: "var(--ink-soft)", margin: "3px 0 0" }}>
              {def}
            </dd>
          </div>
        ))}
      </dl>

      <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 48 }}>
        Prototype. Imagery: Copernicus Sentinel-2 data, processed via Sentinel Hub.
        Restoration context: Placer Land Trust, Maidu Summit Consortium, CDFW, and USFWS
        published materials.
      </p>
      </div>
    </main>
  );
}
