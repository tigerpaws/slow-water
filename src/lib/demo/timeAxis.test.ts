import { describe, expect, it } from "vitest";
import { TIME_AXIS, makeTimeScale } from "./timeAxis";

const range = { start: "2020-01-01", end: "2020-12-31" };

describe("makeTimeScale", () => {
  it("keeps the track fraction and the SVG x on the same scale (playhead alignment)", () => {
    const scale = makeTimeScale(range);
    for (const d of ["2020-02-15", "2020-06-30", "2020-11-01"]) {
      const ms = Date.parse(d);
      expect(scale.frac(ms)).toBeCloseTo(scale.x(ms) / TIME_AXIS.W, 10);
    }
  });

  it("maps the range ends to the plot edges", () => {
    const scale = makeTimeScale(range);
    const { W, PAD } = TIME_AXIS;
    expect(scale.x(Date.parse(range.start))).toBeCloseTo(PAD.left, 6);
    expect(scale.x(Date.parse(range.end))).toBeCloseTo(W - PAD.right, 6);
  });

  it("clamps fractions for out-of-range dates", () => {
    const scale = makeTimeScale(range);
    expect(scale.frac(Date.parse("2019-01-01"))).toBe(0);
    expect(scale.frac(Date.parse("2021-06-01"))).toBe(1);
  });

  it("is monotonic in time", () => {
    const scale = makeTimeScale(range);
    expect(scale.x(Date.parse("2020-03-01"))).toBeLessThan(scale.x(Date.parse("2020-09-01")));
  });
});
