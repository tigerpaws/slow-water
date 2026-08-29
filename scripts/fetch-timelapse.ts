/**
 * Fetch a satellite timelapse for a site config.
 *
 * Usage:
 *   npx tsx scripts/fetch-timelapse.ts sites/doty-ravine.json [command] [flags]
 *
 * Commands:
 *   coverage    Report scene availability per window (cheap; catalog only)
 *   calibrate   Fetch ONE recent context RGB frame to verify AOI placement
 *   frames      Fetch all frames for the requested variants
 *   stats       Fetch monthly NDVI/NDWI series over the tight view
 *   all         coverage + frames + stats (default)
 *
 * Flags:
 *   --views context,tight     (default: all views in the site config)
 *   --renders rgb,ndvi        (default: rgb,ndvi)
 *   --modes composite,simple  (default: composite)
 *   --force                   Re-fetch frames that already exist on disk
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "../src/lib/pipeline/env";
import { bboxAround } from "../src/lib/pipeline/geo";
import { buildWindows } from "../src/lib/pipeline/windows";
import { searchScenes, coverageForWindows } from "../src/lib/pipeline/catalog";
import { fetchFrame } from "../src/lib/pipeline/process";
import { fetchMonthlyStats } from "../src/lib/pipeline/stats";
import { processingUnitsSpent } from "../src/lib/pipeline/client";
import type {
  Manifest,
  MosaicMode,
  RenderKind,
  SiteConfig,
  VariantRecord,
  WindowCoverage,
} from "../src/lib/pipeline/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseArgs() {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith("--"));
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    sitePath: positional[0],
    command: positional[1] ?? "all",
    views: flag("views")?.split(","),
    renders: (flag("renders")?.split(",") as RenderKind[]) ?? ["rgb", "ndvi"],
    modes: (flag("modes")?.split(",") as MosaicMode[]) ?? ["composite"],
    force: args.includes("--force"),
  };
}

function outDir(site: SiteConfig): string {
  return path.join(process.cwd(), "public", "timelapses", site.id);
}

async function reportCoverage(site: SiteConfig): Promise<WindowCoverage[]> {
  const windows = buildWindows(site.timeRange, site.cadence);
  const bbox = bboxAround(site.center, Math.max(...Object.values(site.views).map((v) => v.widthMeters)));
  console.log(`Searching catalog: ${windows.length} windows, ${site.timeRange.start} → ${site.timeRange.end}`);
  const scenes = await searchScenes(bbox, site.timeRange.start, site.timeRange.end);
  const coverage = coverageForWindows(scenes, windows, site.maxCloudCoverage);

  console.log(`\n${scenes.length} scenes total. Per-window (after <=${site.maxCloudCoverage}% cloud filter):`);
  for (const c of coverage) {
    const bar = "#".repeat(Math.min(c.sceneCount, 30));
    const cloud = c.minCloudCover !== undefined ? `min cloud ${c.minCloudCover.toFixed(0)}%` : "NO USABLE SCENES";
    console.log(`  ${c.window.id.padEnd(12)} ${String(c.sceneCount).padStart(3)} scenes  ${cloud.padEnd(18)} ${bar}`);
  }

  const dir = outDir(site);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "coverage.json"), JSON.stringify(coverage, null, 2));
  return coverage;
}

async function calibrate(site: SiteConfig): Promise<void> {
  const viewName = Object.keys(site.views)[0];
  const view = site.views[viewName];
  const windows = buildWindows(site.timeRange, site.cadence);
  // Most recent summer-ish window gives the clearest look.
  const window =
    [...windows].reverse().find((w) => Number(w.start.slice(5, 7)) >= 6 && Number(w.start.slice(5, 7)) <= 9) ??
    windows[windows.length - 1];
  console.log(`Calibration frame: view=${viewName}, window=${window.id}`);
  const png = await fetchFrame({
    bbox: bboxAround(site.center, view.widthMeters),
    outputPixels: view.outputPixels,
    window,
    render: "rgb",
    mode: "composite",
    maxCloudCoverage: site.maxCloudCoverage,
  });
  const dir = outDir(site);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "calibration.png");
  fs.writeFileSync(file, png);
  console.log(`Wrote ${file} (${(png.length / 1024).toFixed(0)} KB). PUs spent: ${processingUnitsSpent().toFixed(1)}`);
}

async function fetchAllFrames(
  site: SiteConfig,
  coverage: WindowCoverage[],
  opts: { views: string[]; renders: RenderKind[]; modes: MosaicMode[]; force: boolean }
): Promise<Record<string, VariantRecord>> {
  const variants: Record<string, VariantRecord> = {};
  const usable = coverage.filter((c) => c.sceneCount > 0);
  const skippedWindows = coverage.length - usable.length;
  if (skippedWindows > 0) console.log(`Skipping ${skippedWindows} windows with no usable scenes.`);

  for (const viewName of opts.views) {
    const view = site.views[viewName];
    if (!view) throw new Error(`View "${viewName}" not in site config`);
    const bbox = bboxAround(site.center, view.widthMeters);
    for (const mode of opts.modes) {
      for (const render of opts.renders) {
        const key = `${viewName}-${render}-${mode}`;
        const dir = path.join(outDir(site), key);
        fs.mkdirSync(dir, { recursive: true });
        const variant: VariantRecord = { view: viewName, render, mode, frames: [] };
        console.log(`\nVariant ${key}: ${usable.length} frames`);
        for (const c of usable) {
          const file = path.join(dir, `${c.window.id}.png`);
          const relPath = `/timelapses/${site.id}/${key}/${c.window.id}.png`;
          if (!opts.force && fs.existsSync(file)) {
            process.stdout.write("s");
          } else {
            const png = await fetchFrame({
              bbox,
              outputPixels: view.outputPixels,
              window: c.window,
              render,
              mode,
              maxCloudCoverage: site.maxCloudCoverage,
            });
            fs.writeFileSync(file, png);
            process.stdout.write(".");
            await sleep(150);
          }
          variant.frames.push({
            window: c.window,
            path: relPath,
            sceneCount: c.sceneCount,
            bestSceneDate: c.bestSceneDate,
            bestSceneCloudCover: c.minCloudCover,
          });
        }
        console.log("");
        variants[key] = variant;
      }
    }
  }
  return variants;
}

async function main() {
  loadEnv();
  const opts = parseArgs();
  if (!opts.sitePath) {
    console.error("Usage: npx tsx scripts/fetch-timelapse.ts <site.json> [coverage|calibrate|frames|stats|all] [flags]");
    process.exit(1);
  }
  const site = JSON.parse(fs.readFileSync(opts.sitePath, "utf8")) as SiteConfig;
  const views = opts.views ?? Object.keys(site.views);
  const dir = outDir(site);

  if (opts.command === "calibrate") {
    await calibrate(site);
    return;
  }

  const coverage = await reportCoverage(site);
  if (opts.command === "coverage") return;

  if (opts.command === "frames" || opts.command === "all") {
    const variants = await fetchAllFrames(site, coverage, { ...opts, views });
    const manifest: Manifest = {
      site,
      generatedAt: new Date().toISOString(),
      variants,
      processingUnitsSpent: processingUnitsSpent(),
    };
    fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
    console.log(`\nWrote manifest with ${Object.keys(variants).length} variants.`);
  }

  if (opts.command === "stats" || opts.command === "all") {
    const statsView = site.views["tight"] ?? site.views[views[0]];
    console.log("\nFetching monthly NDVI/NDWI statistics…");
    const stats = await fetchMonthlyStats(
      bboxAround(site.center, statsView.widthMeters),
      site.timeRange.start,
      site.timeRange.end,
      site.maxCloudCoverage
    );
    fs.writeFileSync(path.join(dir, "stats.json"), JSON.stringify(stats, null, 2));
    console.log(`Wrote stats.json with ${stats.length} monthly points.`);
  }

  console.log(`\nDone. Total processing units spent this run: ${processingUnitsSpent().toFixed(1)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
