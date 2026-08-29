/**
 * Site config is the generalization seam of the pipeline: a new use case is a
 * new JSON file conforming to SiteConfig, with no code changes.
 */

export interface SiteConfig {
  id: string;
  name: string;
  description?: string;
  /** AOI center in WGS84. Frames are square boxes around this point. */
  center: { lat: number; lon: number };
  /** Named zoom levels, e.g. "context" (~5 km) and "tight" (~2 km). */
  views: Record<string, ViewConfig>;
  /** ISO dates bounding the sequence; trimmed to actual archive coverage. */
  timeRange: { start: string; end: string };
  /** How to slice the time range into frame windows. */
  cadence: Cadence;
  /** Scenes above this scene-level cloud % are excluded before compositing. */
  maxCloudCoverage: number;
  /** Known events, rendered as annotations on charts and the scrubber. */
  events: SiteEvent[];
  notes?: string;
}

export interface ViewConfig {
  /** Width of the square AOI box in meters. */
  widthMeters: number;
  /** Output image width/height in pixels (upsampled when beyond native 10m). */
  outputPixels: number;
}

export type Cadence = "seasonal" | "monthly" | "summer-monthly" | "annual-summer";

export interface SiteEvent {
  start: string;
  end?: string;
  label: string;
  kind: "restoration" | "drought" | "fire" | "flood" | "other";
}

/** One time slice of the sequence. */
export interface TimeWindow {
  id: string;
  /** Inclusive ISO date bounds. */
  start: string;
  end: string;
  label: string;
}

export type RenderKind = "rgb" | "ndvi";
/** "composite" = cloud-masked median across the window; "simple" = least-cloudy mosaic. */
export type MosaicMode = "composite" | "simple";

export interface FrameRecord {
  window: TimeWindow;
  path: string;
  /** Scenes available in the window after cloud filtering (from catalog). */
  sceneCount?: number;
  /** Least-cloudy scene datetime in the window, for labeling "simple" frames. */
  bestSceneDate?: string;
  bestSceneCloudCover?: number;
}

export interface VariantRecord {
  view: string;
  render: RenderKind;
  mode: MosaicMode;
  frames: FrameRecord[];
}

export interface Manifest {
  site: SiteConfig;
  generatedAt: string;
  /** Keyed by `${view}-${render}-${mode}`. */
  variants: Record<string, VariantRecord>;
  processingUnitsSpent?: number;
}

export interface WindowCoverage {
  window: TimeWindow;
  sceneCount: number;
  minCloudCover?: number;
  bestSceneDate?: string;
}

export interface MonthlyStat {
  from: string;
  to: string;
  ndviMean?: number;
  ndviStDev?: number;
  ndwiMean?: number;
  /** Fraction of AOI pixels that were valid (cloud-free, in-swath). */
  validFraction?: number;
}
