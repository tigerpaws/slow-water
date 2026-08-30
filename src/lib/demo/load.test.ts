import { describe, expect, it } from "vitest";
import { defaultViewState, nearestWindow, windowIndex, windowsFor } from "./load";
import { testSite } from "@/test/fixtures";
import type { DemoSiteManifest } from "./types";

describe("windowIndex", () => {
  it("finds the window by id and falls back to 0 for unknown ids", () => {
    const windows = windowsFor(testSite, "quarterly");
    expect(windowIndex(windows, "2020-Q3")).toBe(2);
    expect(windowIndex(windows, "1999-Q1")).toBe(0);
  });
});

describe("nearestWindow", () => {
  it("picks the window whose midpoint is closest to a date", () => {
    const monthly = windowsFor(testSite, "monthly");
    const q3mid = Date.parse("2020-08-15");
    expect(nearestWindow(monthly, q3mid).id).toBe("2020-08");
  });
});

describe("defaultViewState", () => {
  it("prefers monthly granularity and lands on the latest summer window", () => {
    const vs = defaultViewState(testSite);
    expect(vs.panes[0].granularity).toBe("monthly");
    expect(vs.panes[0].windowId).toBe("2020-09"); // most recent Jul–Sep month
    expect(vs.layout).toBe(1);
  });

  it("falls back to quarterly when a site has no monthly data", () => {
    const quarterlyOnly: DemoSiteManifest = {
      ...testSite,
      granularities: { quarterly: testSite.granularities.quarterly },
    };
    const vs = defaultViewState(quarterlyOnly);
    expect(vs.panes[0].granularity).toBe("quarterly");
    expect(vs.panes[0].windowId).toBe("2020-Q3");
  });
});
