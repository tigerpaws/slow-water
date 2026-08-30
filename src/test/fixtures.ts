import type { DemoSiteManifest, DemoWindow, Story, ViewState } from "@/lib/demo/types";

function month(year: number, m: number): DemoWindow {
  const mm = String(m).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return { id: `${year}-${mm}`, label: `${mm}/${year}`, start: `${year}-${mm}-01`, end: `${year}-${mm}-${lastDay}` };
}

function quarter(year: number, q: number): DemoWindow {
  const m1 = (q - 1) * 3 + 1;
  const m3 = m1 + 2;
  const lastDay = new Date(Date.UTC(year, m3, 0)).getUTCDate();
  return {
    id: `${year}-Q${q}`,
    label: `Q${q} ${year}`,
    start: `${year}-${String(m1).padStart(2, "0")}-01`,
    end: `${year}-${String(m3).padStart(2, "0")}-${lastDay}`,
  };
}

/** One year of quarterly + monthly windows over a small test site. */
export const testSite: DemoSiteManifest = {
  id: "test-site",
  name: "Test Site",
  description: "",
  center: { lat: 40, lon: -120 },
  views: {
    context: { widthMeters: 5000, outputPixels: 1000 },
    tight: { widthMeters: 2000, outputPixels: 720 },
  },
  timeRange: { start: "2020-01-01", end: "2020-12-31" },
  events: [],
  analysisAreas: [],
  renders: ["rgb", "ndvi", "ndmi"],
  granularities: {
    quarterly: { windows: [1, 2, 3, 4].map((q) => quarter(2020, q)) },
    monthly: { windows: Array.from({ length: 12 }, (_, i) => month(2020, i + 1)) },
  },
};

export function freshViewState(): ViewState {
  return {
    layout: 1,
    panes: [{ view: "context", render: "rgb", granularity: "quarterly", windowId: "2020-Q1" }],
    linkedScrub: true,
    showAreas: false,
    chart: { visible: true, metric: "ndvi", emphasize: [] },
  };
}

export function makeStory(id: string, steps: Story["steps"] = []): Story {
  return { id, siteId: "test-site", title: "Test story", steps };
}
