"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Observed content-box size of an element. Returns a callback ref so it works
 * for elements that mount later than the component (e.g. after data loads).
 */
export function useBoxSize<T extends HTMLElement>(): [(el: T | null) => void, { w: number; h: number }] {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const roRef = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    roRef.current = ro;
  }, []);
  return [ref, size];
}
