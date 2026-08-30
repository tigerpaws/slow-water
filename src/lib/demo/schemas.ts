import { z } from "zod";
import type {
  DemoSiteManifest,
  SiteStats,
  SiteSummary,
  Story,
  StoryStep,
  ViewState,
} from "./types";

/**
 * Runtime validation for everything that crosses a serialization boundary:
 * bundled demo JSON, localStorage stories, and the chat route's site data.
 * Each schema is checked against the hand-written interface it feeds, so a
 * drift between the two is a compile error here rather than a cast elsewhere.
 */

export const renderKindSchema = z.enum(["rgb", "ndvi", "ndmi"]);
export const granularitySchema = z.enum(["quarterly", "monthly"]);
export const viewNameSchema = z.enum(["context", "tight"]);
export const metricSchema = z.enum(["ndvi", "ndmi", "nbr"]);

export const analysisAreaSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["treatment", "control", "reference"]),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  polygon: z.array(z.tuple([z.number(), z.number()])).optional(),
  notes: z.string().optional(),
});

export const siteEventSchema = z.object({
  start: z.string(),
  end: z.string().optional(),
  label: z.string(),
  kind: z.enum(["restoration", "drought", "fire", "flood", "other"]),
});

export const monthlyStatSchema = z.object({
  from: z.string(),
  to: z.string(),
  ndviMean: z.number().optional(),
  ndviStDev: z.number().optional(),
  ndwiMean: z.number().optional(),
  ndmiMean: z.number().optional(),
  nbrMean: z.number().optional(),
  waterFraction: z.number().optional(),
  validFraction: z.number().optional(),
});

const demoWindowSchema = z.object({
  id: z.string(),
  label: z.string(),
  start: z.string(),
  end: z.string(),
  sceneCount: z.number().optional(),
});

const granularityDataSchema = z.object({ windows: z.array(demoWindowSchema) });

export const demoSiteManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  center: z.object({ lat: z.number(), lon: z.number() }),
  views: z.record(z.string(), z.object({ widthMeters: z.number(), outputPixels: z.number() })),
  timeRange: z.object({ start: z.string(), end: z.string() }),
  events: z.array(siteEventSchema),
  analysisAreas: z.array(analysisAreaSchema),
  renders: z.array(renderKindSchema),
  granularities: z.object({
    quarterly: granularityDataSchema.optional(),
    monthly: granularityDataSchema.optional(),
  }),
});

export const siteStatsSchema = z.object({
  areas: z.array(analysisAreaSchema),
  series: z.record(z.string(), z.array(monthlyStatSchema)),
});

export const siteSummarySchema = z.record(
  z.string(),
  z.record(
    z.string(),
    z.object({
      ndvi: z.number().optional(),
      ndmi: z.number().optional(),
      nbr: z.number().optional(),
      water: z.number().optional(),
    })
  )
);

export const paneStateSchema = z.object({
  view: viewNameSchema,
  render: renderKindSchema,
  granularity: granularitySchema,
  windowId: z.string(),
});

export const chartStateSchema = z.object({
  visible: z.boolean(),
  metric: metricSchema,
  emphasize: z.array(z.string()),
});

export const viewStateSchema = z.object({
  layout: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  panes: z.array(paneStateSchema),
  linkedScrub: z.boolean(),
  showAreas: z.boolean(),
  chart: chartStateSchema,
});

export const storyStepSchema = z.object({
  id: z.string(),
  phase: z.string().optional(),
  viewState: viewStateSchema,
  scrub: z
    .object({ paneIndex: z.number().int().min(0), fromId: z.string(), toId: z.string() })
    .optional(),
  say: z.string(),
  pointAt: z.string().optional(),
  facts: z.array(z.object({ text: z.string(), source: z.string().optional() })).default([]),
});

export const storySchema = z.object({
  id: z.string(),
  siteId: z.string(),
  title: z.string(),
  logline: z.string().optional(),
  steps: z.array(storyStepSchema),
});

/** Compile-time drift guards: each schema's output must satisfy its interface. */
export function parseStory(data: unknown): Story {
  return storySchema.parse(data);
}
export function parseViewState(data: unknown): ViewState {
  return viewStateSchema.parse(data);
}
export function parseStoryStep(data: unknown): StoryStep {
  return storyStepSchema.parse(data);
}
export function parseDemoSiteManifest(data: unknown): DemoSiteManifest {
  return demoSiteManifestSchema.parse(data);
}
export function parseSiteStats(data: unknown): SiteStats {
  return siteStatsSchema.parse(data);
}
export function parseSiteSummary(data: unknown): SiteSummary {
  return siteSummarySchema.parse(data);
}
