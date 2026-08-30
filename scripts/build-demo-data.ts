/**
 * Build the checked-in demo dataset from pipeline output.
 *
 *   npx tsx scripts/build-demo-data.ts [--force]
 *
 * Reads sites/<id>.json + public/timelapses/<id>{,-monthly}/ and writes
 * public/demo/<id>/ with WebP frames, a merged manifest (granularity
 * dimension), stats, and a summary for the chat assistant.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { Manifest, MonthlyStat, RenderKind, SiteConfig } from "../src/lib/pipeline/types";
import type { DemoSiteManifest, DemoWindow, Granularity, SiteStats, SiteSummary } from "../src/lib/demo/types";

const SITES = ["doty-ravine", "tasmam-koyom"];
const RENDERS: RenderKind[] = ["rgb", "ndvi", "ndmi"];
const WEBP_QUALITY = 75;
const FORCE = process.argv.includes("--force");

const ROOT = process.cwd();
const SRC = path.join(ROOT, "public", "timelapses");
const OUT = path.join(ROOT, "public", "demo");

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function windowsOf(manifest: Manifest): DemoWindow[] {
  const variant = manifest.variants["context-rgb-composite"] ?? Object.values(manifest.variants)[0];
  return variant.frames.map((f) => ({
    id: f.window.id,
    label: f.window.label,
    start: f.window.start,
    end: f.window.end,
    sceneCount: f.sceneCount,
  }));
}

async function convertFrames(
  siteId: string,
  granularity: Granularity,
  srcDir: string,
  views: string[],
  windows: DemoWindow[]
): Promise<{ converted: number; bytes: number }> {
  let converted = 0;
  let bytes = 0;
  const jobs: (() => Promise<void>)[] = [];
  for (const view of views) {
    for (const render of RENDERS) {
      const outDir = path.join(OUT, siteId, "frames", granularity, `${view}-${render}`);
      fs.mkdirSync(outDir, { recursive: true });
      for (const w of windows) {
        const src = path.join(srcDir, `${view}-${render}-composite`, `${w.id}.png`);
        const dst = path.join(outDir, `${w.id}.webp`);
        jobs.push(async () => {
          if (!fs.existsSync(src)) {
            console.warn(`  missing source: ${src}`);
            return;
          }
          if (!FORCE && fs.existsSync(dst)) {
            bytes += fs.statSync(dst).size;
            return;
          }
          const buf = await sharp(src).webp({ quality: WEBP_QUALITY }).toBuffer();
          fs.writeFileSync(dst, buf);
          bytes += buf.length;
          converted++;
        });
      }
    }
  }
  // Modest concurrency; sharp saturates cores quickly.
  const POOL = 8;
  for (let i = 0; i < jobs.length; i += POOL) {
    await Promise.all(jobs.slice(i, i + POOL).map((j) => j()));
    process.stdout.write(".");
  }
  console.log("");
  return { converted, bytes };
}

function buildSummary(stats: SiteStats): SiteSummary {
  const summary: SiteSummary = {};
  for (const area of stats.areas) {
    const byYear: SiteSummary[string] = {};
    const buckets: Record<string, MonthlyStat[]> = {};
    for (const p of stats.series[area.id] ?? []) {
      const month = Number(p.from.slice(5, 7));
      if (month >= 7 && month <= 9) (buckets[p.from.slice(0, 4)] ??= []).push(p);
    }
    for (const [year, points] of Object.entries(buckets)) {
      const mean = (get: (p: MonthlyStat) => number | undefined) => {
        const vals = points.map(get).filter((v): v is number => v !== undefined);
        return vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3)) : undefined;
      };
      byYear[year] = {
        ndvi: mean((p) => p.ndviMean),
        ndmi: mean((p) => p.ndmiMean),
        nbr: mean((p) => p.nbrMean),
        water: mean((p) => p.waterFraction),
      };
    }
    summary[area.id] = byYear;
  }
  return summary;
}

async function buildSite(siteId: string): Promise<void> {
  console.log(`\n=== ${siteId} ===`);
  const config = readJson<SiteConfig>(path.join(ROOT, "sites", `${siteId}.json`));
  const views = Object.keys(config.views);
  const granularities: DemoSiteManifest["granularities"] = {};
  let totalBytes = 0;

  for (const [granularity, folder] of [
    ["quarterly", siteId],
    ["monthly", `${siteId}-monthly`],
  ] as [Granularity, string][]) {
    const manifestPath = path.join(SRC, folder, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      console.warn(`  no ${granularity} data (${manifestPath} missing)`);
      continue;
    }
    const manifest = readJson<Manifest>(manifestPath);
    const windows = windowsOf(manifest);
    console.log(`  ${granularity}: ${windows.length} windows × ${views.length} views × ${RENDERS.length} renders`);
    const { bytes } = await convertFrames(siteId, granularity, path.join(SRC, folder), views, windows);
    totalBytes += bytes;
    granularities[granularity] = { windows };
  }

  const stats = readJson<SiteStats>(path.join(SRC, siteId, "stats.json"));
  fs.writeFileSync(path.join(OUT, siteId, "stats.json"), JSON.stringify(stats));
  fs.writeFileSync(path.join(OUT, siteId, "summary.json"), JSON.stringify(buildSummary(stats), null, 2));

  const demoManifest: DemoSiteManifest = {
    id: config.id,
    name: config.name,
    description: config.description ?? "",
    center: config.center,
    views: config.views,
    timeRange: config.timeRange,
    events: config.events,
    analysisAreas: config.analysisAreas ?? [],
    renders: RENDERS,
    granularities,
  };
  fs.writeFileSync(path.join(OUT, siteId, "manifest.json"), JSON.stringify(demoManifest, null, 2));
  console.log(`  frames on disk: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
}

async function main() {
  for (const siteId of SITES) await buildSite(siteId);
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
