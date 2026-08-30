"use client";

import type { AnalysisArea } from "@/lib/domain";
import { AREA_COLOR_VAR } from "@/lib/demo/constants";

function areaRing(area: AnalysisArea): [number, number][] {
  if (area.polygon) return area.polygon;
  if (!area.bbox) return [];
  const [minLon, minLat, maxLon, maxLat] = area.bbox;
  return [
    [minLon, minLat],
    [maxLon, minLat],
    [maxLon, maxLat],
    [minLon, maxLat],
  ];
}

/** Area outlines + labels positioned over a frame, in percent coordinates. */
export default function AreaOverlay({
  areas,
  viewBbox,
  emphasize,
}: {
  areas: AnalysisArea[];
  viewBbox: [number, number, number, number];
  /** Area ids to draw at full strength; others fade. Empty = all full. */
  emphasize?: string[];
}) {
  const [minLon, , maxLon, maxLat] = viewBbox;
  const minLat = viewBbox[1];
  const px = (lon: number) => ((lon - minLon) / (maxLon - minLon)) * 100;
  const py = (lat: number) => ((maxLat - lat) / (maxLat - minLat)) * 100;
  const strength = (id: string) =>
    !emphasize || emphasize.length === 0 || emphasize.includes(id) ? 1 : 0.25;

  return (
    <>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      >
        {areas.map((area) => {
          const ring = areaRing(area);
          if (!ring.length) return null;
          return (
            <polygon
              key={area.id}
              points={ring.map(([lon, lat]) => `${px(lon).toFixed(2)},${py(lat).toFixed(2)}`).join(" ")}
              fill="none"
              stroke={AREA_COLOR_VAR[area.kind]}
              strokeWidth={2}
              strokeDasharray="7 5"
              opacity={strength(area.id)}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
      {areas.map((area) => {
        const ring = areaRing(area);
        if (!ring.length) return null;
        const left = Math.min(...ring.map(([lon]) => px(lon)));
        const top = Math.min(...ring.map(([, lat]) => py(lat)));
        if (left > 100 || top > 100) return null;
        return (
          <span
            key={area.id}
            className="mono"
            style={{
              position: "absolute",
              left: `${Math.max(left, 0)}%`,
              top: `${Math.max(top, 0)}%`,
              background: "rgba(0,0,0,0.55)",
              color: AREA_COLOR_VAR[area.kind],
              fontSize: 10.5,
              padding: "1px 6px",
              borderRadius: 4,
              whiteSpace: "nowrap",
              opacity: strength(area.id),
              pointerEvents: "none",
            }}
          >
            {area.label}
          </span>
        );
      })}
    </>
  );
}
