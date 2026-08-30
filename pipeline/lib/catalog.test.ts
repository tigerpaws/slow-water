import { describe, expect, it } from "vitest";
import { coverageForWindows, type SceneInfo } from "./catalog";
import type { TimeWindow } from "./types";

const windows: TimeWindow[] = [
  { id: "2020-Q1", start: "2020-01-01", end: "2020-03-31", label: "Jan–Mar 2020" },
  { id: "2020-Q2", start: "2020-04-01", end: "2020-06-30", label: "Apr–Jun 2020" },
];

const scenes: SceneInfo[] = [
  { datetime: "2020-02-10T18:00:00Z", cloudCover: 10 },
  { datetime: "2020-02-20T18:00:00Z", cloudCover: 70 },
  { datetime: "2020-03-01T18:00:00Z", cloudCover: 25 },
  { datetime: "2020-05-05T18:00:00Z", cloudCover: 5 },
];

describe("coverageForWindows", () => {
  it("counts only scenes under the cloud threshold and picks the clearest", () => {
    const coverage = coverageForWindows(scenes, windows, 60);
    expect(coverage[0]).toMatchObject({
      sceneCount: 2, // the 70%-cloud scene is excluded
      minCloudCover: 10,
      bestSceneDate: "2020-02-10T18:00:00Z",
    });
    expect(coverage[1]).toMatchObject({ sceneCount: 1, minCloudCover: 5 });
  });

  it("reports zero scenes (and no best) for empty windows", () => {
    const coverage = coverageForWindows(scenes, [
      { id: "2020-Q4", start: "2020-10-01", end: "2020-12-31", label: "Oct–Dec 2020" },
    ], 60);
    expect(coverage[0].sceneCount).toBe(0);
    expect(coverage[0].bestSceneDate).toBeUndefined();
  });

  it("respects a stricter threshold", () => {
    const coverage = coverageForWindows(scenes, windows, 15);
    expect(coverage[0].sceneCount).toBe(1);
  });
});
