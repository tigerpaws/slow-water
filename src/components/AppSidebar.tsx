"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useExplore } from "@/stores/explore";
import { DEMO_SITES } from "@/lib/demo/load";
import { DEMO_STORIES, exportStory, saveStory } from "@/lib/demo/stories";

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
  const selectedStepId = useExplore((s) => s.selectedStepId);
  const { selectStep, removeStep, moveStep, setStory, setStoryMeta } = useExplore.getState();
  const showDraft = pathname.startsWith("/explore") && !!story;

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

      <SectionLabel>STORIES</SectionLabel>
      {DEMO_STORIES.map((s) => (
        <NavLink key={s.id} href={`/view/${s.id}`} active={pathname === `/view/${s.id}`}>
          {s.title}
        </NavLink>
      ))}

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
            {story.steps.map((step, i) => (
              <li key={step.id}>
                <div
                  onClick={() => selectStep(step.id === selectedStepId ? null : step.id)}
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
                    <button style={{ padding: "1px 7px", fontSize: 11 }} onClick={() => moveStep(step.id, -1)}>
                      ↑
                    </button>
                    <button style={{ padding: "1px 7px", fontSize: 11 }} onClick={() => moveStep(step.id, 1)}>
                      ↓
                    </button>
                    <button style={{ padding: "1px 7px", fontSize: 11 }} onClick={() => removeStep(step.id)}>
                      delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ol>
          {story.steps.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--ink-soft)", padding: "2px 7px" }}>
              No steps yet — set up the canvas and capture, or ask the assistant.
            </div>
          )}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
            <button style={{ fontSize: 12 }} onClick={() => saveStory(story)}>
              Save
            </button>
            <button style={{ fontSize: 12 }} onClick={handlePlay} disabled={story.steps.length === 0}>
              Play ▸
            </button>
            <button style={{ fontSize: 12 }} onClick={() => exportStory(story)}>
              Export
            </button>
            <button style={{ fontSize: 12 }} onClick={() => setStory(null)}>
              Close
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
