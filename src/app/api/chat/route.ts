import { createAnthropic } from "@ai-sdk/anthropic";

// Identity-linked API keys must name the workspace each request acts in.
const anthropic = createAnthropic({
  headers: process.env.ANTHROPIC_WORKSPACE_ID
    ? { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID }
    : undefined,
});
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";
import type { DemoSiteManifest, SiteStats, SiteSummary } from "@/lib/demo/types";
import dotyManifest from "../../../../public/demo/doty-ravine/manifest.json";
import dotySummary from "../../../../public/demo/doty-ravine/summary.json";
import dotyStats from "../../../../public/demo/doty-ravine/stats.json";
import tasmamManifest from "../../../../public/demo/tasmam-koyom/manifest.json";
import tasmamSummary from "../../../../public/demo/tasmam-koyom/summary.json";
import tasmamStats from "../../../../public/demo/tasmam-koyom/stats.json";

export const maxDuration = 60;

const SITES: Record<string, { manifest: DemoSiteManifest; summary: SiteSummary; stats: SiteStats }> = {
  "doty-ravine": {
    manifest: dotyManifest as unknown as DemoSiteManifest,
    summary: dotySummary as SiteSummary,
    stats: dotyStats as unknown as SiteStats,
  },
  "tasmam-koyom": {
    manifest: tasmamManifest as unknown as DemoSiteManifest,
    summary: tasmamSummary as SiteSummary,
    stats: tasmamStats as unknown as SiteStats,
  },
};

const paneSchema = z.object({
  view: z.enum(["context", "tight"]).describe("context ≈ 5-6 km wide; tight ≈ 2 km on the worked area"),
  render: z.enum(["rgb", "ndvi", "ndmi"]).describe("rgb = true color, ndvi = greenness, ndmi = moisture"),
  granularity: z.enum(["quarterly", "monthly"]),
  windowId: z.string().describe('e.g. "2021-Q3" (quarterly) or "2021-08" (monthly)'),
});

const viewSpecSchema = z.object({
  layout: z.number().int().min(1).max(3).optional().describe("number of side-by-side panes; defaults to panes.length"),
  panes: z.array(paneSchema).min(1).max(3).optional(),
  showAreas: z.boolean().optional().describe("draw the analysis-area outlines on the frames"),
  chart: z
    .object({
      visible: z.boolean().optional(),
      metric: z.enum(["ndvi", "ndmi", "nbr"]).optional(),
      emphasize: z.array(z.string()).optional().describe("area ids to emphasize; [] = all"),
    })
    .optional(),
});

function siteContext(siteId: string): string {
  const site = SITES[siteId];
  if (!site) return "Unknown site.";
  const { manifest, summary } = site;
  const gran = Object.entries(manifest.granularities)
    .map(([g, d]) => `${g}: ${d.windows.length} windows (${d.windows[0]?.id} … ${d.windows[d.windows.length - 1]?.id})`)
    .join("; ");
  const areas = manifest.analysisAreas
    .map((a) => `- id "${a.id}" (${a.kind}): ${a.label}. ${a.notes ?? ""}`)
    .join("\n");
  const events = manifest.events.map((e) => `- ${e.start}${e.end ? `→${e.end}` : ""}: ${e.label} (${e.kind})`).join("\n");
  const summaryLines = Object.entries(summary)
    .map(([areaId, byYear]) => {
      const rows = Object.entries(byYear)
        .map(([y, v]) => `${y}: ndvi ${v.ndvi ?? "–"}, ndmi ${v.ndmi ?? "–"}, nbr ${v.nbr ?? "–"}`)
        .join(" | ");
      return `  ${areaId}: ${rows}`;
    })
    .join("\n");
  return `SITE: ${manifest.name} (${manifest.id})
${manifest.description}
Time range ${manifest.timeRange.start} → ${manifest.timeRange.end}. Granularities — ${gran}.
Views: ${Object.entries(manifest.views)
    .map(([k, v]) => `${k} (${v.widthMeters} m wide)`)
    .join(", ")}. Renders: rgb, ndvi, ndmi.

ANALYSIS AREAS (use these ids in chart.emphasize and query_stats):
${areas}

EVENTS:
${events}

SUMMER (Jul–Sep) MEANS PER AREA PER YEAR (precomputed; use query_stats for other slices):
${summaryLines}`;
}

const SYSTEM_BASE = `You are the authoring assistant inside "Slow Water", an app that turns satellite imagery of environmental restoration sites into step-by-step evidence stories.

The user is looking at a canvas showing satellite frames (1–3 panes), an optional analysis-area overlay, and a chart of per-area metrics over time. They are assembling a "story": an ordered list of steps. Each step captures a canvas state plus narration. Your job: drive the canvas to show interesting things, pull real numbers, and draft compelling, honest story steps.

Craft guidance (learned from the two demo storyboards):
- Each step makes exactly ONE claim, backed by a fact with a number and source where possible.
- Renders form a progression: rgb shows THAT something changed, ndvi measures it, ndmi explains it (water in the ground).
- Late-summer windows (Q3 / Jul–Sep) carry the signal in California; winter frames are green or snowy everywhere. Never use winter windows for ndmi (snow saturates it blue).
- Comparisons prove causation-ish: treatment vs control vs reference. Emphasize only the areas the claim is about.
- Honesty is content: disclaimers (e.g. irrigated fields), data limits (10 m pixels, smoke contamination), and "assumed unworked" caveats belong IN steps, not footnotes.
- Monthly granularity earns its place around dated events; quarterly for decade trends.

Tool usage:
- set_view: change what's on the canvas so the user sees what you're describing. Use it liberally while discussing.
- add_step: append a story step. Provide the full view spec for the step (don't rely on canvas state unless the user just set it up). Keep "say" to 1–3 sentences, vivid but precise.
- update_step / remove_step: edit the draft (step ids are in CURRENT STORY DRAFT below).
- set_story_title: give the draft a short, specific title (2–6 words, no generic labels). Whenever you add or edit steps and the draft is untitled ("Untitled story"), ALSO call set_story_title with a title that fits the story being told.
- query_stats: compute per-year means of a metric over an area for chosen months, from the real data. Use it to back claims with numbers instead of guessing.

Never invent numbers — use the summary table or query_stats. If the user asks for something the data can't show (e.g. individual dams at 10 m), say so and offer the honest alternative.`;

export async function POST(req: Request) {
  const { messages, siteId, canvas, storyDraft }: {
    messages: UIMessage[];
    siteId: string;
    canvas?: unknown;
    storyDraft?: unknown;
  } = await req.json();

  const site = SITES[siteId];
  if (!site) return new Response("unknown site", { status: 400 });

  const system = `${SYSTEM_BASE}

${siteContext(siteId)}

CURRENT CANVAS STATE:
${JSON.stringify(canvas ?? "unknown")}

CURRENT STORY DRAFT (step ids + summaries):
${JSON.stringify(storyDraft ?? "no draft yet")}`;

  const result = streamText({
    model: anthropic("claude-sonnet-5"),
    system,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(8),
    tools: {
      set_view: tool({
        description: "Set the canvas: pane layout, per-pane view/render/granularity/window, area overlay, chart state. Executed in the user's browser.",
        inputSchema: viewSpecSchema,
      }),
      add_step: tool({
        description: "Append a step to the story draft. Provide the complete view spec the step should show.",
        inputSchema: z.object({
          phase: z.string().optional().describe('short label like "Establish", "Stress test", "Limits"'),
          say: z.string().describe("the narration: one claim, 1–3 sentences"),
          pointAt: z.string().optional().describe("what the viewer should look at"),
          facts: z
            .array(z.object({ text: z.string(), source: z.string().optional() }))
            .optional(),
          view: viewSpecSchema.optional().describe("canvas state for this step; defaults to the current canvas"),
          scrub: z
            .object({ paneIndex: z.number().int().min(0), fromId: z.string(), toId: z.string() })
            .optional()
            .describe("auto-play a window range when the step is shown"),
        }),
      }),
      update_step: tool({
        description: "Update narration fields of an existing draft step.",
        inputSchema: z.object({
          stepId: z.string(),
          phase: z.string().optional(),
          say: z.string().optional(),
          pointAt: z.string().optional(),
          facts: z.array(z.object({ text: z.string(), source: z.string().optional() })).optional(),
        }),
      }),
      remove_step: tool({
        description: "Remove a step from the story draft.",
        inputSchema: z.object({ stepId: z.string() }),
      }),
      set_story_title: tool({
        description: "Set the story draft's title. Use a short, specific name (2–6 words) that fits the story being told.",
        inputSchema: z.object({ title: z.string().min(1).max(80) }),
      }),
      query_stats: tool({
        description: "Per-year mean of a metric over an analysis area, restricted to given months. Returns real numbers from the site's Sentinel-2 statistics.",
        inputSchema: z.object({
          areaId: z.string(),
          metric: z.enum(["ndvi", "ndmi", "nbr"]),
          months: z.array(z.number().int().min(1).max(12)).min(1).describe("e.g. [7,8,9] for summer"),
        }),
        execute: async ({ areaId, metric, months }) => {
          const series = site.stats.series[areaId];
          if (!series) return { error: `no area "${areaId}"; areas: ${site.stats.areas.map((a) => a.id).join(", ")}` };
          const pick = (p: (typeof series)[number]) =>
            metric === "ndvi" ? p.ndviMean : metric === "ndmi" ? p.ndmiMean : p.nbrMean;
          const byYear: Record<string, number[]> = {};
          for (const p of series) {
            const m = Number(p.from.slice(5, 7));
            const v = pick(p);
            if (months.includes(m) && v !== undefined) (byYear[p.from.slice(0, 4)] ??= []).push(v);
          }
          const result: Record<string, number> = {};
          for (const [year, vals] of Object.entries(byYear)) {
            result[year] = Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3));
          }
          return { areaId, metric, months, meansByYear: result };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
