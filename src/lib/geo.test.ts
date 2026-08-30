import { describe, expect, it } from "vitest";
import { bboxAround } from "./geo";

describe("bboxAround", () => {
  it("is symmetric around the center", () => {
    const [minLon, minLat, maxLon, maxLat] = bboxAround({ lat: 40, lon: -120 }, 2000);
    expect((minLon + maxLon) / 2).toBeCloseTo(-120, 9);
    expect((minLat + maxLat) / 2).toBeCloseTo(40, 9);
  });

  it("spans the requested width in meters at the equator", () => {
    const [minLon, minLat, maxLon, maxLat] = bboxAround({ lat: 0, lon: 0 }, 1000);
    expect((maxLat - minLat) * 111_320).toBeCloseTo(1000, 6);
    expect((maxLon - minLon) * 111_320).toBeCloseTo(1000, 6);
  });

  it("widens longitude span with latitude (cos correction)", () => {
    const box = bboxAround({ lat: 60, lon: 10 }, 1000);
    const lonSpan = box[2] - box[0];
    const latSpan = box[3] - box[1];
    // cos(60°) = 0.5 → longitude degrees must cover twice the latitude span.
    expect(lonSpan / latSpan).toBeCloseTo(2, 5);
  });
});
