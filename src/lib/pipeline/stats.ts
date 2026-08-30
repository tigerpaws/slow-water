import { shPost } from "./client";
import { STATS_EVALSCRIPT } from "./evalscripts";
import type { ShProvider } from "./providers";
import type { MonthlyStat } from "./types";

interface StatsBand {
  stats: { mean: number; stDev: number; sampleCount: number; noDataCount: number };
}

interface StatsInterval {
  interval: { from: string; to: string };
  outputs?: Record<string, { bands: { B0: StatsBand } }>;
  error?: { type: string };
}

interface StatsResponse {
  data: StatsInterval[];
  status?: string;
}

/**
 * Monthly mean NDVI/NDWI over the AOI via the Statistical API. Cloud pixels
 * are excluded through the evalscript's dataMask, so months that are fully
 * clouded come back empty and are skipped.
 */
export async function fetchMonthlyStats(
  provider: ShProvider,
  bbox: [number, number, number, number],
  start: string,
  end: string,
  maxCloudCoverage: number
): Promise<MonthlyStat[]> {
  const res = await shPost(
    provider,
    `/statistics`,
    {
      input: {
        bounds: {
          bbox,
          properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" },
        },
        data: [
          {
            type: "sentinel-2-l2a",
            dataFilter: { maxCloudCoverage, mosaickingOrder: "leastCC" },
          },
        ],
      },
      aggregation: {
        timeRange: { from: `${start}T00:00:00Z`, to: `${end}T23:59:59Z` },
        aggregationInterval: { of: "P1M" },
        width: 256,
        height: 256,
        evalscript: STATS_EVALSCRIPT,
      },
    },
    "application/json"
  );

  const body = (await res.json()) as StatsResponse;
  const stats: MonthlyStat[] = [];
  for (const interval of body.data ?? []) {
    const band = (id: string) => interval.outputs?.[id]?.bands.B0.stats;
    const ndvi = band("ndvi");
    if (!ndvi || ndvi.sampleCount === 0) continue;
    const total = ndvi.sampleCount;
    const valid = total - ndvi.noDataCount;
    if (valid === 0) continue;
    stats.push({
      from: interval.interval.from.slice(0, 10),
      to: interval.interval.to.slice(0, 10),
      ndviMean: ndvi.mean,
      ndviStDev: ndvi.stDev,
      ndwiMean: band("ndwi")?.mean,
      ndmiMean: band("ndmi")?.mean,
      nbrMean: band("nbr")?.mean,
      waterFraction: band("water")?.mean,
      validFraction: valid / total,
    });
  }
  return stats;
}
