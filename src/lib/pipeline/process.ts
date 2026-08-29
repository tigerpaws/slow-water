import { shPost, SH_BASE } from "./client";
import { frameEvalscript } from "./evalscripts";
import type { MosaicMode, RenderKind, TimeWindow } from "./types";

export interface FrameRequest {
  bbox: [number, number, number, number];
  outputPixels: number;
  window: TimeWindow;
  render: RenderKind;
  mode: MosaicMode;
  maxCloudCoverage: number;
}

/** Render one PNG frame via the Process API. */
export async function fetchFrame(req: FrameRequest): Promise<Buffer> {
  const dataFilter: Record<string, unknown> = {
    timeRange: {
      from: `${req.window.start}T00:00:00Z`,
      to: `${req.window.end}T23:59:59Z`,
    },
    maxCloudCoverage: req.maxCloudCoverage,
  };
  if (req.mode === "simple") dataFilter.mosaickingOrder = "leastCC";

  const res = await shPost(
    `${SH_BASE}/process`,
    {
      input: {
        bounds: {
          bbox: req.bbox,
          properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" },
        },
        data: [
          {
            type: "sentinel-2-l2a",
            dataFilter,
            processing: { upsampling: "BICUBIC" },
          },
        ],
      },
      output: {
        width: req.outputPixels,
        height: req.outputPixels,
        responses: [{ identifier: "default", format: { type: "image/png" } }],
      },
      evalscript: frameEvalscript(req.render, req.mode),
    },
    "image/png"
  );
  return Buffer.from(await res.arrayBuffer());
}
