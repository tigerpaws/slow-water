"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import ChatPanel, { chatNav } from "@/components/explore/ChatPanel";

/**
 * Mounts the assistant at the layout level. Every user navigation starts a
 * fresh conversation (the panel remounts via `key`); the one exception is a
 * navigation the assistant itself initiated (moving into a new story's
 * editor), which keeps the in-flight conversation alive.
 */
export default function ChatDock() {
  const pathname = usePathname();
  const [instance, setInstance] = useState(0);
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;
    if (chatNav.selfInitiated) {
      chatNav.selfInitiated = false;
      return;
    }
    const t = setTimeout(() => setInstance((i) => i + 1), 0);
    return () => clearTimeout(t);
  }, [pathname]);

  if (!pathname.startsWith("/explore") && !pathname.startsWith("/edit")) return null;
  return <ChatPanel key={instance} />;
}
