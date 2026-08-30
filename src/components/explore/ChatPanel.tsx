"use client";

/** Placeholder — replaced by the authoring assistant in the chat phase. */
export default function ChatPanel({ siteId }: { siteId: string }) {
  void siteId;
  return (
    <aside
      style={{
        width: 320,
        flexShrink: 0,
        borderLeft: "1px solid var(--border)",
        background: "var(--panel)",
        padding: 14,
      }}
    >
      <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.1em", color: "var(--ink-soft)" }}>
        ASSISTANT
      </div>
      <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>Chat assistant coming online…</p>
    </aside>
  );
}
