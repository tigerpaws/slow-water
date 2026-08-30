"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DEMO_SITES } from "@/lib/demo/load";
import { DEMO_STORIES } from "@/lib/demo/stories";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mono"
      style={{ fontSize: 10.5, letterSpacing: "0.1em", color: "var(--ink-soft)", margin: "20px 0 6px" }}
    >
      {children}
    </div>
  );
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

/** Persistent app navigation: stories first, then sites. */
export default function AppSidebar() {
  const pathname = usePathname();
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
    </aside>
  );
}
