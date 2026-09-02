"use client";

/** A labeled cluster of segmented buttons, boxed so grouping reads at a glance. */
export default function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        border: "1px solid var(--border)",
        borderRadius: 9,
        padding: "3px 4px 3px 9px",
        background: "var(--panel)",
      }}
    >
      <span className="mono" style={{ fontSize: 9.5, letterSpacing: "0.09em", color: "var(--ink-soft)" }}>
        {label}
      </span>
      <div style={{ display: "flex", gap: 3 }}>{children}</div>
    </div>
  );
}
