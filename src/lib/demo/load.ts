import type { DemoSiteManifest, DemoWindow, Granularity, PaneState, SiteStats, ViewState } from "./types";

export const DEMO_SITES = [
  { id: "doty-ravine", label: "Doty Ravine" },
  { id: "tasmam-koyom", label: "Tásmam Koyóm" },
];

export async function fetchSite(siteId: string): Promise<DemoSiteManifest> {
  const res = await fetch(`/demo/${siteId}/manifest.json`);
  if (!res.ok) throw new Error(`No demo site "${siteId}"`);
  return res.json();
}

export async function fetchStats(siteId: string): Promise<SiteStats | null> {
  const res = await fetch(`/demo/${siteId}/stats.json`);
  return res.ok ? res.json() : null;
}

export function windowsFor(site: DemoSiteManifest, granularity: Granularity): DemoWindow[] {
  return site.granularities[granularity]?.windows ?? [];
}

export function windowIndex(windows: DemoWindow[], windowId: string): number {
  const i = windows.findIndex((w) => w.id === windowId);
  return i >= 0 ? i : 0;
}

export function windowMidDate(w: DemoWindow): number {
  return (Date.parse(w.start) + Date.parse(w.end)) / 2;
}

/** The window in `windows` whose midpoint is closest to `dateMs`. */
export function nearestWindow(windows: DemoWindow[], dateMs: number): DemoWindow {
  let best = windows[0];
  let bestDist = Infinity;
  for (const w of windows) {
    const d = Math.abs(windowMidDate(w) - dateMs);
    if (d < bestDist) {
      best = w;
      bestDist = d;
    }
  }
  return best;
}

export function defaultViewState(site: DemoSiteManifest): ViewState {
  const granularity: Granularity = site.granularities.monthly ? "monthly" : "quarterly";
  const windows = windowsFor(site, granularity);
  // Land on the most recent summer window — that's where the signal is.
  const summer =
    [...windows].reverse().find((w) => {
      const month = Number(w.start.slice(5, 7));
      return month >= 7 && month <= 9;
    }) ?? windows[windows.length - 1];
  const pane: PaneState = {
    view: "context",
    render: "rgb",
    granularity,
    windowId: summer?.id ?? "",
  };
  return {
    layout: 1,
    panes: [pane],
    linkedScrub: true,
    showAreas: false,
    chart: { visible: true, metric: "ndvi", emphasize: [] },
  };
}
