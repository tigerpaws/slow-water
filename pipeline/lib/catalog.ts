import { shPost } from "./client";
import type { ShProvider } from "./providers";
import type { TimeWindow, WindowCoverage } from "./types";

export interface SceneInfo {
  datetime: string;
  cloudCover: number;
}

interface CatalogFeature {
  properties: { datetime: string; "eo:cloud_cover": number };
}

interface CatalogResponse {
  features: CatalogFeature[];
  context?: { next?: number };
}

/** All Sentinel-2 L2A scenes intersecting the bbox in the date range. */
export async function searchScenes(
  provider: ShProvider,
  bbox: [number, number, number, number],
  start: string,
  end: string
): Promise<SceneInfo[]> {
  const scenes: SceneInfo[] = [];
  let next: number | undefined = undefined;
  do {
    const res = await shPost(
      provider,
      `/catalog/1.0.0/search`,
      {
        collections: ["sentinel-2-l2a"],
        bbox,
        datetime: `${start}T00:00:00Z/${end}T23:59:59Z`,
        limit: 100,
        next,
        fields: {
          include: ["properties.datetime", "properties.eo:cloud_cover"],
          exclude: ["geometry", "assets", "links"],
        },
      },
      "application/geo+json"
    );
    const page = (await res.json()) as CatalogResponse;
    for (const f of page.features) {
      scenes.push({
        datetime: f.properties.datetime,
        cloudCover: f.properties["eo:cloud_cover"],
      });
    }
    next = page.context?.next;
  } while (next !== undefined);
  return scenes.sort((a, b) => a.datetime.localeCompare(b.datetime));
}

/**
 * Group a scene list into per-window coverage stats (scene counts after the
 * cloud filter, plus the least-cloudy scene for labeling "simple" frames).
 */
export function coverageForWindows(
  scenes: SceneInfo[],
  windows: TimeWindow[],
  maxCloudCoverage: number
): WindowCoverage[] {
  return windows.map((window) => {
    const inWindow = scenes.filter(
      (s) =>
        s.datetime.slice(0, 10) >= window.start &&
        s.datetime.slice(0, 10) <= window.end &&
        s.cloudCover <= maxCloudCoverage
    );
    const best = inWindow.reduce<SceneInfo | undefined>(
      (acc, s) => (!acc || s.cloudCover < acc.cloudCover ? s : acc),
      undefined
    );
    return {
      window,
      sceneCount: inWindow.length,
      minCloudCover: best?.cloudCover,
      bestSceneDate: best?.datetime,
    };
  });
}
