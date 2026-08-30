"use client";

import { useEffect, useRef, useState } from "react";

/** Observed content-box size of an element. */
export function useBoxSize<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  { w: number; h: number },
] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}
