import type { Cadence, TimeWindow } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthSpanLabel(year: number, m1: number, m2: number): string {
  return m1 === m2
    ? `${MONTHS[m1 - 1]} ${year}`
    : `${MONTHS[m1 - 1]}–${MONTHS[m2 - 1]} ${year}`;
}

/**
 * Slice the site's time range into frame windows. Windows extending past
 * `end` (or past today) are dropped.
 */
export function buildWindows(
  range: { start: string; end: string },
  cadence: Cadence
): TimeWindow[] {
  const startYear = Number(range.start.slice(0, 4));
  const endYear = Number(range.end.slice(0, 4));
  const windows: TimeWindow[] = [];

  const push = (year: number, m1: number, m2: number, id: string) => {
    windows.push({
      id,
      start: iso(year, m1, 1),
      end: iso(year, m2, lastDay(year, m2)),
      label: monthSpanLabel(year, m1, m2),
    });
  };

  for (let year = startYear; year <= endYear; year++) {
    switch (cadence) {
      case "seasonal":
        for (let q = 0; q < 4; q++) push(year, q * 3 + 1, q * 3 + 3, `${year}-Q${q + 1}`);
        break;
      case "monthly":
        for (let m = 1; m <= 12; m++) push(year, m, m, `${year}-${String(m).padStart(2, "0")}`);
        break;
      case "summer-monthly":
        for (let m = 6; m <= 10; m++) push(year, m, m, `${year}-${String(m).padStart(2, "0")}`);
        break;
      case "annual-summer":
        push(year, 7, 9, `${year}-summer`);
        break;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  return windows.filter((w) => w.start >= range.start && w.end <= range.end && w.end <= today);
}
