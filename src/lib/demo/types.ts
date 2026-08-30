/**
 * Demo-site data model: what the app consumes. Built from the pipeline's
 * output by scripts/build-demo-data.ts and checked into public/demo/.
 */
import type { AnalysisArea, MonthlyStat, RenderKind, SiteEvent } from "../pipeline/types";

export type Granularity = "quarterly" | "monthly";
export type ViewName = "context" | "tight";
export type Metric = "ndvi" | "ndmi" | "nbr";

export interface DemoWindow {
  id: string;
  label: string;
  start: string;
  end: string;
  sceneCount?: number;
}

export interface DemoSiteManifest {
  id: string;
  name: string;
  description: string;
  center: { lat: number; lon: number };
  views: Record<string, { widthMeters: number; outputPixels: number }>;
  timeRange: { start: string; end: string };
  events: SiteEvent[];
  analysisAreas: AnalysisArea[];
  renders: RenderKind[];
  granularities: Partial<Record<Granularity, { windows: DemoWindow[] }>>;
}

export interface SiteStats {
  areas: AnalysisArea[];
  series: Record<string, MonthlyStat[]>;
}

/** Per-area, per-year summer (Jul–Sep) means, for grounding the chat. */
export type SiteSummary = Record<
  string,
  Record<string, { ndvi?: number; ndmi?: number; nbr?: number; water?: number }>
>;

/** Frames live at a conventional path — no per-frame manifest entries needed. */
export function framePath(
  siteId: string,
  granularity: Granularity,
  view: string,
  render: RenderKind,
  windowId: string
): string {
  return `/demo/${siteId}/frames/${granularity}/${view}-${render}/${windowId}.webp`;
}

// ---------------- Story model ----------------

export interface PaneState {
  view: ViewName;
  render: RenderKind;
  granularity: Granularity;
  windowId: string;
}

export interface ChartState {
  visible: boolean;
  metric: Metric;
  /** Area ids to emphasize; empty = all equal. */
  emphasize: string[];
}

export interface ViewState {
  layout: 1 | 2 | 3;
  panes: PaneState[];
  linkedScrub: boolean;
  showAreas: boolean;
  chart: ChartState;
}

export interface StoryFact {
  text: string;
  source?: string;
}

export interface StoryStep {
  id: string;
  phase?: string;
  viewState: ViewState;
  /** Auto-play a window range in one pane when the step is shown. */
  scrub?: { paneIndex: number; fromId: string; toId: string };
  say: string;
  /** What the overlay/narration should draw attention to. */
  pointAt?: string;
  facts: StoryFact[];
}

export interface Story {
  id: string;
  siteId: string;
  title: string;
  logline?: string;
  steps: StoryStep[];
}
