import { describe, expect, it } from "vitest";
import { siteFrameUrls } from "./preload";
import { testSite } from "@/test/fixtures";

describe("siteFrameUrls", () => {
  it("enumerates every granularity × render × view × window exactly once", () => {
    const urls = siteFrameUrls(testSite);
    // (12 monthly + 4 quarterly windows) × 3 renders × 2 views
    expect(urls).toHaveLength(16 * 3 * 2);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("warms monthly frames first, in the conventional path layout", () => {
    const urls = siteFrameUrls(testSite);
    expect(urls[0]).toBe("/demo/test-site/frames/monthly/context-rgb/2020-01.webp");
    const firstQuarterly = urls.findIndex((u) => u.includes("/quarterly/"));
    expect(firstQuarterly).toBe(12 * 3 * 2);
  });

  it("skips granularities a site doesn't have", () => {
    const monthlyOnly = { ...testSite, granularities: { monthly: testSite.granularities.monthly } };
    expect(siteFrameUrls(monthlyOnly)).toHaveLength(12 * 3 * 2);
  });
});
