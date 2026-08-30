"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useExplore } from "@/stores/explore";
import { DEMO_SITES } from "@/lib/demo/load";
import { DEMO_STORIES, exportStory, saveStory } from "@/lib/demo/stories";
import type { Story } from "@/lib/demo/types";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mono"
      style={{ fontSize: 10.5, letterSpacing: "0.1em", color: "var(--ink-soft)", margin: "18px 0 6px" }}
    >
      {children}
    </div>
  );
}

export default function Sidebar({ siteId }: { siteId: string }) {
  const router = useRouter();
  const story = useExplore((s) => s.story);
  const selectedStepId = useExplore((s) => s.selectedStepId);
  const { selectStep, removeStep, moveStep, setStory, ensureStory, setStoryMeta } = useExplore.getState();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    const s = useExplore.getState().story;
    if (s) saveStory(s);
  };

  const handlePlay = () => {
    const s = useExplore.getState().story;
    if (!s || s.steps.length === 0) return;
    saveStory(s);
    router.push(`/view/${s.id}`);
  };

  const handleImport = (file: File) => {
    file.text().then((text) => {
      try {
        const imported = JSON.parse(text) as Story;
        if (!imported.steps) throw new Error("not a story");
        setStory(imported);
      } catch {
        alert("That file doesn't look like a story export.");
      }
    });
  };

  return (
    <aside
      style={{
        width: 232,
        flexShrink: 0,
        borderRight: "1px solid var(--border)",
        background: "var(--panel)",
        padding: "14px 14px 24px",
        overflowY: "auto",
      }}
    >
      <Link href="/" style={{ textDecoration: "none", fontWeight: 700, fontSize: 15 }}>
        Slow Water
      </Link>

      <SectionLabel>SITES</SectionLabel>
      {DEMO_SITES.map((s) => (
        <a
          key={s.id}
          href={`/explore/${s.id}`}
          style={{
            display: "block",
            padding: "5px 8px",
            borderRadius: 6,
            fontSize: 13,
            textDecoration: "none",
            background: s.id === siteId ? "var(--accent-soft)" : "transparent",
            fontWeight: s.id === siteId ? 600 : 400,
          }}
        >
          {s.label}
        </a>
      ))}

      <SectionLabel>STORY DRAFT</SectionLabel>
      {story ? (
        <>
          <input
            value={story.title}
            onChange={(e) => setStoryMeta({ title: e.target.value })}
            style={{
              width: "100%",
              fontSize: 13,
              fontWeight: 600,
              padding: "4px 6px",
              border: "1px solid var(--border)",
              borderRadius: 6,
              background: "var(--bg)",
              color: "var(--ink)",
              marginBottom: 6,
            }}
          />
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 3 }}>
            {story.steps.map((step, i) => (
              <li key={step.id}>
                <div
                  onClick={() => selectStep(step.id)}
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "baseline",
                    padding: "4px 7px",
                    borderRadius: 6,
                    fontSize: 12.5,
                    cursor: "pointer",
                    background: step.id === selectedStepId ? "var(--accent-soft)" : "transparent",
                  }}
                >
                  <span className="mono" style={{ color: "var(--ink-soft)", fontSize: 11 }}>
                    {i + 1}
                  </span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    {step.phase || step.say.slice(0, 40) || "untitled step"}
                  </span>
                </div>
                {step.id === selectedStepId && (
                  <div style={{ display: "flex", gap: 4, padding: "2px 7px 4px" }}>
                    <button style={{ padding: "1px 7px", fontSize: 11 }} onClick={() => moveStep(step.id, -1)}>↑</button>
                    <button style={{ padding: "1px 7px", fontSize: 11 }} onClick={() => moveStep(step.id, 1)}>↓</button>
                    <button style={{ padding: "1px 7px", fontSize: 11 }} onClick={() => removeStep(step.id)}>delete</button>
                  </div>
                )}
              </li>
            ))}
          </ol>
          {story.steps.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--ink-soft)", padding: "2px 7px" }}>
              No steps yet — set up the canvas and hit Capture, or ask the assistant.
            </div>
          )}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
            <button style={{ fontSize: 12 }} onClick={handleSave}>Save</button>
            <button style={{ fontSize: 12 }} onClick={handlePlay} disabled={story.steps.length === 0}>Play ▸</button>
            <button style={{ fontSize: 12 }} onClick={() => exportStory(story)}>Export</button>
            <button style={{ fontSize: 12 }} onClick={() => setStory(null)}>Close</button>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <button style={{ fontSize: 12 }} onClick={() => ensureStory()}>New story</button>
          <button style={{ fontSize: 12 }} onClick={() => fileRef.current?.click()}>Import…</button>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImport(f);
          e.target.value = "";
        }}
      />

      <SectionLabel>DEMO STORIES</SectionLabel>
      {DEMO_STORIES.map((s) => (
        <a
          key={s.id}
          href={`/view/${s.id}`}
          style={{ display: "block", padding: "5px 8px", borderRadius: 6, fontSize: 13, textDecoration: "none" }}
        >
          {s.title} ▸
        </a>
      ))}
    </aside>
  );
}
