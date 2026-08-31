"use client";

import { usePathname } from "next/navigation";
import ChatPanel from "@/components/explore/ChatPanel";

/**
 * Mounts the assistant at the layout level so it survives navigation between
 * explore and edit views — an in-flight conversation (and its streaming tool
 * calls) continues across the route change.
 */
export default function ChatDock() {
  const pathname = usePathname();
  if (!pathname.startsWith("/explore") && !pathname.startsWith("/edit")) return null;
  return <ChatPanel />;
}
