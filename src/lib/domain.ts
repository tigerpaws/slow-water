/**
 * Domain types shared between the app and the offline pipeline
 * (pipeline/lib/ imports these; the app never imports pipeline code).
 */

export type RenderKind = "rgb" | "ndvi" | "ndmi";

export interface SiteEvent {
  start: string;
  end?: string;
  label: string;
  kind: "restoration" | "drought" | "fire" | "flood" | "other";
}

export interface AnalysisArea {
  id: string;
  label: string;
  kind: "treatment" | "control" | "reference";
  /** [minLon, minLat, maxLon, maxLat] in WGS84. Provide bbox or polygon. */
  bbox?: [number, number, number, number];
  /** Ring of [lon, lat] vertices in WGS84 (closing edge implied). */
  polygon?: [number, number][];
  notes?: string;
}

export interface MonthlyStat {
  from: string;
  to: string;
  ndviMean?: number;
  ndviStDev?: number;
  ndwiMean?: number;
  /** Vegetation moisture (NDMI, B08/B11). */
  ndmiMean?: number;
  /** Normalized Burn Ratio (B08/B12); drops sharply after fire. */
  nbrMean?: number;
  /** Fraction of area pixels classified as open water (SCL water or NDWI>0). */
  waterFraction?: number;
  /** Fraction of AOI pixels that were valid (cloud-free, in-swath). */
  validFraction?: number;
}
