import { z } from "zod";
import {
  chartStateSchema,
  granularitySchema,
  metricSchema,
  paneStateSchema,
  renderKindSchema,
  viewNameSchema,
} from "@/lib/demo/schemas";

/**
 * Tool input schemas shared between the chat route (which hands them to the
 * model) and ChatPanel (which executes the canvas/story tools client-side).
 * One definition, both sides typed from it.
 */

const paneSpecSchema = paneStateSchema.extend({
  view: viewNameSchema.describe("context ≈ 5-6 km wide; tight ≈ 2 km on the worked area"),
  render: renderKindSchema.describe("rgb = true color, ndvi = greenness, ndmi = moisture"),
  granularity: granularitySchema,
  windowId: z.string().describe('e.g. "2021-Q3" (quarterly) or "2021-08" (monthly)'),
});

export const viewSpecSchema = z.object({
  layout: z
    .number()
    .int()
    .min(1)
    .max(3)
    .optional()
    .describe("number of side-by-side panes; defaults to panes.length"),
  panes: z.array(paneSpecSchema).min(1).max(3).optional(),
  showAreas: z.boolean().optional().describe("draw the analysis-area outlines on the frames"),
  chart: chartStateSchema
    .partial()
    .extend({ emphasize: z.array(z.string()).optional().describe("area ids to emphasize; [] = all") })
    .optional(),
});
export type ViewSpec = z.infer<typeof viewSpecSchema>;

const factSchema = z.object({ text: z.string(), source: z.string().optional() });

export const addStepInputSchema = z.object({
  phase: z.string().optional().describe('short label like "Establish", "Stress test", "Limits"'),
  say: z.string().describe("the narration: one claim, 1–3 sentences"),
  pointAt: z.string().optional().describe("what the viewer should look at"),
  facts: z.array(factSchema).optional(),
  view: viewSpecSchema.optional().describe("canvas state for this step; defaults to the current canvas"),
  scrub: z
    .object({ paneIndex: z.number().int().min(0), fromId: z.string(), toId: z.string() })
    .optional()
    .describe("auto-play a window range when the step is shown"),
});
export type AddStepInput = z.infer<typeof addStepInputSchema>;

export const updateStepInputSchema = z.object({
  stepId: z.string(),
  phase: z.string().optional(),
  say: z.string().optional(),
  pointAt: z.string().optional(),
  facts: z.array(factSchema).optional(),
});
export type UpdateStepInput = z.infer<typeof updateStepInputSchema>;

export const removeStepInputSchema = z.object({ stepId: z.string() });
export type RemoveStepInput = z.infer<typeof removeStepInputSchema>;

export const setStoryTitleInputSchema = z.object({ title: z.string().min(1).max(80) });
export type SetStoryTitleInput = z.infer<typeof setStoryTitleInputSchema>;

export const queryStatsInputSchema = z.object({
  areaId: z.string(),
  metric: metricSchema,
  months: z.array(z.number().int().min(1).max(12)).min(1).describe("e.g. [7,8,9] for summer"),
});
export type QueryStatsInput = z.infer<typeof queryStatsInputSchema>;

export type QueryStatsOutput =
  | { error: string }
  | { areaId: string; metric: string; months: number[]; meansByYear: Record<string, number> };

/** UI tool typing for useChat: input/output per tool name. */
export type AppUITools = {
  set_view: { input: ViewSpec; output: string };
  add_step: { input: AddStepInput; output: string };
  update_step: { input: UpdateStepInput; output: string };
  remove_step: { input: RemoveStepInput; output: string };
  set_story_title: { input: SetStoryTitleInput; output: string };
  query_stats: { input: QueryStatsInput; output: QueryStatsOutput };
};
