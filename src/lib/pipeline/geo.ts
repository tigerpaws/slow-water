const METERS_PER_DEG_LAT = 111_320;

/** [minLon, minLat, maxLon, maxLat] square box around a WGS84 center point. */
export function bboxAround(
  center: { lat: number; lon: number },
  widthMeters: number
): [number, number, number, number] {
  const dLat = widthMeters / 2 / METERS_PER_DEG_LAT;
  const dLon =
    widthMeters / 2 / (METERS_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180));
  return [center.lon - dLon, center.lat - dLat, center.lon + dLon, center.lat + dLat];
}
