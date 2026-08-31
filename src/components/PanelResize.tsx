"use client";

import { useCallback, useEffect, useState } from "react";

/** Panel width with persistence; reads the stored value after mount. */
export function usePanelWidth(
  key: string,
  initial: number,
  min: number,
  max: number
): [number, (w: number) => void] {
  const [width, setWidth] = useState(initial);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const stored = Number(window.localStorage.getItem(key));
        if (Number.isFinite(stored) && stored >= min && stored <= max) setWidth(stored);
      } catch {
        /* storage unavailable */
      }
    }, 0);
    return () => clearTimeout(t);
  }, [key, min, max]);

  const set = useCallback(
    (w: number) => {
      const clamped = Math.max(min, Math.min(max, Math.round(w)));
      setWidth(clamped);
      try {
        window.localStorage.setItem(key, String(clamped));
      } catch {
        /* ignore */
      }
    },
    [key, min, max]
  );

  return [width, set];
}

/**
 * Slim vertical drag handle. `grows` says which drag direction makes the
 * panel wider: "right" for a left-docked panel, "left" for a right-docked one.
 */
export function ResizeHandle({
  width,
  setWidth,
  grows,
  label,
}: {
  width: number;
  setWidth: (w: number) => void;
  grows: "left" | "right";
  label: string;
}) {
  const [dragging, setDragging] = useState(false);
  const dir = grows === "right" ? 1 : -1;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture is an optimization; window listeners below do the work */
    }
    setDragging(true);
    const move = (ev: PointerEvent) => setWidth(startW + dir * (ev.clientX - startX));
    const up = () => {
      setDragging(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setWidth(width - 16 * dir);
        if (e.key === "ArrowRight") setWidth(width + 16 * dir);
      }}
      style={{
        width: 5,
        flexShrink: 0,
        cursor: "col-resize",
        touchAction: "none",
        background: dragging ? "var(--accent)" : "transparent",
        transition: dragging ? "none" : "background 120ms",
      }}
      onMouseEnter={(e) => {
        if (!dragging) e.currentTarget.style.background = "var(--border-strong)";
      }}
      onMouseLeave={(e) => {
        if (!dragging) e.currentTarget.style.background = "transparent";
      }}
    />
  );
}
