"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useExplore } from "@/stores/explore";
import { DEMO_SITES, windowIndex, windowsFor } from "@/lib/demo/load";
import {
  DEMO_STORIES,
  STORIES_CHANGED_EVENT,
  exportStory,
  isStorySaved,
  listSavedStories,
  saveStory,
} from "@/lib/demo/stories";
import { framePath } from "@/lib/demo/types";
import type { DemoSiteManifest, Story, StoryStep } from "@/lib/demo/types";

/** Short mono recipe for a step row: view · render · window (+panes, ▸range). */
function stepRecipe(site: DemoSiteManifest, step: StoryStep): string {
  const p = step.viewState.panes[0];
  const windows = windowsFor(site, p.granularity);
  const label = windows[windowIndex(windows, p.windowId)]?.label ?? p.windowId;
  const extra = step.viewState.layout > 1 ? ` +${step.viewState.layout - 1}` : "";
  return `${p.view} · ${p.render} · ${label}${extra}${step.scrub ? " · ▸" : ""}`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mono"
      style={{ fontSize: 10.5, letterSpacing: "0.1em", color: "var(--ink-soft)", margin: "14px 0 6px" }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid var(--border)", margin: "12px -14px 0" }} />;
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "5px 8px",
        borderRadius: 6,
        fontSize: 13,
        textDecoration: "none",
        background: active ? "var(--accent-soft)" : "transparent",
        fontWeight: active ? 600 : 400,
        lineHeight: 1.35,
      }}
    >
      {children}
    </Link>
  );
}

/** Persistent app navigation, plus the story-draft rail while exploring. */
export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const story = useExplore((s) => s.story);
  const site = useExplore((s) => s.site);
  const selectedStepId = useExplore((s) => s.selectedStepId);
  const { selectStep, moveStep, setStory, setStoryMeta } = useExplore.getState();
  const showDraft = pathname.startsWith("/explore") && !!story;
  const [savedFlash, setSavedFlash] = useState(false);

  const handleSaveClick = () => {
    const s = useExplore.getState().story;
    if (!s) return;
    saveStory(s);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const handleClose = () => {
    const s = useExplore.getState().story;
    if (s && s.steps.length > 0 && !isStorySaved(s)) {
      if (!window.confirm("Close this draft? Unsaved changes will be lost.")) return;
    }
    setStory(null);
  };

  const [saved, setSaved] = useState<Story[]>([]);
  useEffect(() => {
    const refresh = () => setSaved(listSavedStories());
    const t = setTimeout(refresh, 0);
    window.addEventListener(STORIES_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      clearTimeout(t);
      window.removeEventListener(STORIES_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const handlePlay = () => {
    const s = useExplore.getState().story;
    if (!s || s.steps.length === 0) return;
    saveStory(s);
    router.push(`/view/${s.id}`);
  };

  return (
    <aside
      style={{
        width: 220,
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

      <Divider />

      <SectionLabel>DEMO STORIES</SectionLabel>
      {DEMO_STORIES.map((s) => (
        <NavLink key={s.id} href={`/view/${s.id}`} active={pathname === `/view/${s.id}`}>
          {s.title}
        </NavLink>
      ))}

      {saved.length > 0 && (
        <>
          <SectionLabel>YOUR STORIES</SectionLabel>
          {saved.map((s) => (
            <NavLink key={s.id} href={`/view/${s.id}`} active={pathname === `/view/${s.id}`}>
              {s.title}
            </NavLink>
          ))}
        </>
      )}

      <SectionLabel>SITES</SectionLabel>
      {DEMO_SITES.map((s) => (
        <NavLink key={s.id} href={`/explore/${s.id}`} active={pathname === `/explore/${s.id}`}>
          {s.label}
        </NavLink>
      ))}

      {showDraft && story && (
        <>
          <Divider />
          <SectionLabel>STORY DRAFT</SectionLabel>
          <input
            value={story.title}
            onChange={(e) => setStoryMeta({ title: e.target.value })}
            aria-label="Story title"
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
              boxSizing: "border-box",
            }}
          />
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 3 }}>
            {story.steps.map((step, i) => {
              const pane = step.viewState.panes[0];
              return (
                <li key={step.id}>
                  <div
                    onClick={() => selectStep(step.id === selectedStepId ? null : step.id)}
                    style={{
                      display: "flex",
                      gap: 7,
                      alignItems: "center",
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
                    {site && pane && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={framePath(site.id, pane.granularity, pane.view, pane.render, pane.windowId)}
                        alt=""
                        style={{ width: 26, height: 26, objectFit: "cover", borderRadius: 4, flexShrink: 0 }}
                      />
                    )}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {step.phase || step.say.slice(0, 40) || "untitled step"}
                      </span>
                      {site && (
                        <span
                          className="mono"
                          style={{
                            display: "block",
                            fontSize: 9.5,
                            color: "var(--ink-soft)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {stepRecipe(site, step)}
                        </span>
                      )}
                    </span>
                  </div>
                  {step.id === selectedStepId && (
                    <div style={{ display: "flex", gap: 4, padding: "2px 7px 4px" }}>
                      <button style={{ padding: "1px 7px", fontSize: 11 }} onClick={() => moveStep(step.id, -1)}>
                        ↑
                      </button>
                      <button style={{ padding: "1px 7px", fontSize: 11 }} onClick={() => moveStep(step.id, 1)}>
                        ↓
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {story.steps.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--ink-soft)", padding: "2px 7px" }}>
              No steps yet — set up the canvas and capture, or ask the assistant.
            </div>
          )}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
            <button style={{ fontSize: 12 }} onClick={handleSaveClick}>
              {savedFlash ? "Saved ✓" : "Save"}
            </button>
            <button style={{ fontSize: 12 }} onClick={handlePlay} disabled={story.steps.length === 0}>
              Play ▸
            </button>
            <button style={{ fontSize: 12 }} onClick={() => exportStory(story)}>
              Export
            </button>
            <button style={{ fontSize: 12 }} onClick={handleClose}>
              Close
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
