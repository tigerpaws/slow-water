import type { DemoSiteManifest, Granularity } from "./types";
import { framePath } from "./types";

/** Every frame URL a site can show, ordered so the most-reached-for variants
 * warm first: monthly before quarterly; within one, whole variants at a time
 * in the manifest's render order (rgb, ndvi, ndmi), context before tight. */
export function siteFrameUrls(site: DemoSiteManifest): string[] {
  const urls: string[] = [];
  const granularities: Granularity[] = ["monthly", "quarterly"];
  for (const granularity of granularities) {
    const windows = site.granularities[granularity]?.windows ?? [];
    for (const render of site.renders) {
      for (const view of Object.keys(site.views)) {
        for (const w of windows) urls.push(framePath(site.id, granularity, view, render, w.id));
      }
    }
  }
  return urls;
}

const startedSites = new Set<string>();

/** Warm the browser cache with a site's entire frame set in the background —
 * a few low-priority lanes so it never competes with what's on screen. Runs
 * once per site per session; the active variant still loads instantly via
 * FramePane's own preload. */
export function preloadSiteFrames(site: DemoSiteManifest, delayMs = 1000): void {
  if (typeof window === "undefined" || startedSites.has(site.id)) return;
  startedSites.add(site.id);
  const queue = siteFrameUrls(site);
  const next = () => {
    const url = queue.shift();
    if (!url) return;
    const img = new Image();
    img.fetchPriority = "low";
    img.onload = next;
    img.onerror = next;
    img.src = url;
  };
  window.setTimeout(() => {
    for (let lane = 0; lane < 3; lane++) next();
  }, delayMs);
}
