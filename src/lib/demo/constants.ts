import type { AnalysisArea, MonthlyStat } from "../domain";
import type { Metric } from "./types";

/** Kind → CSS variable (theme-aware). */
export const AREA_COLOR_VAR: Record<AnalysisArea["kind"], string> = {
  treatment: "var(--treatment)",
  control: "var(--control)",
  reference: "var(--reference)",
};

export const EVENT_FILL: Record<string, string> = {
  restoration: "rgba(90, 170, 110, 0.16)",
  drought: "rgba(210, 150, 60, 0.16)",
  fire: "rgba(210, 90, 60, 0.18)",
  flood: "rgba(80, 140, 230, 0.16)",
  other: "rgba(150, 150, 150, 0.16)",
};

export interface MetricDef {
  label: string;
  short: string;
  domain: [number, number];
  get: (s: MonthlyStat) => number | undefined;
  percent?: boolean;
}

export const METRICS: Record<Metric, MetricDef> = {
  ndvi: { label: "NDVI · greenness", short: "NDVI", domain: [0, 0.9], get: (s) => s.ndviMean },
  ndmi: { label: "NDMI · moisture", short: "NDMI", domain: [-0.3, 0.6], get: (s) => s.ndmiMean },
  nbr: { label: "NBR · burn", short: "NBR", domain: [-0.3, 0.8], get: (s) => s.nbrMean },
};
