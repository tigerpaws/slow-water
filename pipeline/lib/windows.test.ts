import { afterEach, describe, expect, it, vi } from "vitest";
import { buildWindows } from "./windows";

const RANGE_2020 = { start: "2020-01-01", end: "2020-12-31" };

describe("buildWindows", () => {
  afterEach(() => vi.useRealTimers());

  it("slices a year into four quarters with correct bounds", () => {
    const windows = buildWindows(RANGE_2020, "seasonal");
    expect(windows.map((w) => w.id)).toEqual(["2020-Q1", "2020-Q2", "2020-Q3", "2020-Q4"]);
    expect(windows[0]).toMatchObject({ start: "2020-01-01", end: "2020-03-31" });
    expect(windows[2]).toMatchObject({ start: "2020-07-01", end: "2020-09-30", label: "Jul–Sep 2020" });
  });

  it("handles leap-year month ends in monthly cadence", () => {
    const windows = buildWindows(RANGE_2020, "monthly");
    expect(windows).toHaveLength(12);
    expect(windows[1]).toMatchObject({ id: "2020-02", end: "2020-02-29" });
  });

  it("summer-monthly covers June through October", () => {
    const windows = buildWindows(RANGE_2020, "summer-monthly");
    expect(windows.map((w) => w.id)).toEqual(["2020-06", "2020-07", "2020-08", "2020-09", "2020-10"]);
  });

  it("annual-summer emits one Jul–Sep window per year", () => {
    const windows = buildWindows({ start: "2019-01-01", end: "2020-12-31" }, "annual-summer");
    expect(windows.map((w) => w.id)).toEqual(["2019-summer", "2020-summer"]);
    expect(windows[0]).toMatchObject({ start: "2019-07-01", end: "2019-09-30" });
  });

  it("drops windows that have not fully elapsed yet", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2020-06-15T12:00:00Z"));
    const windows = buildWindows(RANGE_2020, "seasonal");
    // Q2 ends June 30 — still in progress on June 15, so only Q1 qualifies.
    expect(windows.map((w) => w.id)).toEqual(["2020-Q1"]);
  });

  it("clamps to the configured range bounds", () => {
    const windows = buildWindows({ start: "2020-04-01", end: "2020-09-30" }, "seasonal");
    expect(windows.map((w) => w.id)).toEqual(["2020-Q2", "2020-Q3"]);
  });
});
