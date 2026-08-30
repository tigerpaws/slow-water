/**
 * The single source of the time-axis geometry shared by the scrub track and
 * the chart SVG in TimePanel. Both must derive x-positions from the same
 * scale or the playhead drifts off its chart point — `frac` is defined as
 * `x / W` so the alignment holds by construction (and is unit-tested).
 */

export const TIME_AXIS = {
  W: 900,
  H: 190,
  PAD: { left: 46, right: 10, top: 8, bottom: 18 },
} as const;

export interface TimeScale {
  /** SVG x coordinate (viewBox units) for a timestamp. */
  x: (ms: number) => number;
  /** Horizontal fraction of the full panel width [0..1] for a timestamp. */
  frac: (ms: number) => number;
  /** Inner plot width/height in viewBox units. */
  iw: number;
  ih: number;
}

export function makeTimeScale(range: { start: string; end: string }): TimeScale {
  const { W, H, PAD } = TIME_AXIS;
  const t0 = Date.parse(range.start);
  const t1 = Date.parse(range.end);
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (ms: number) => PAD.left + ((ms - t0) / (t1 - t0)) * iw;
  const frac = (ms: number) => Math.max(0, Math.min(1, x(ms) / W));
  return { x, frac, iw, ih };
}
