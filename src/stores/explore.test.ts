import { beforeEach, describe, expect, it, vi } from "vitest";
import { useExplore } from "./explore";
import { freshViewState, testSite } from "@/test/fixtures";

function reset(overrides: Partial<ReturnType<typeof useExplore.getState>> = {}) {
  useExplore.setState({
    site: testSite,
    stats: null,
    viewState: freshViewState(),
    activePane: 0,
    playing: false,
    story: null,
    selectedStepId: null,
    liveSync: false,
    ...overrides,
  });
}

const s = () => useExplore.getState();

describe("live-edit write-through (withSync)", () => {
  beforeEach(() => reset());

  it("writes canvas changes to the selected step while liveSync is on", () => {
    s().ensureStory();
    const step = s().captureStep();
    s().setLiveSync(true);
    s().toggleAreas();
    expect(s().story!.steps[0].viewState.showAreas).toBe(true);
    s().setChart({ metric: "ndmi" });
    expect(s().story!.steps[0].viewState.chart.metric).toBe("ndmi");
    expect(s().selectedStepId).toBe(step.id);
  });

  it("does NOT touch the step when liveSync is off (view-mode safety)", () => {
    s().ensureStory();
    s().captureStep();
    // liveSync stays false — as it is during story playback.
    s().toggleAreas();
    s().setWindowByIndex(0, 3);
    const step = s().story!.steps[0];
    expect(step.viewState.showAreas).toBe(false);
    expect(step.viewState.panes[0].windowId).toBe("2020-Q1");
  });

  it("does NOT touch steps when none is selected", () => {
    s().ensureStory();
    s().captureStep();
    s().selectStep(null);
    s().setLiveSync(true);
    s().toggleAreas();
    expect(s().story!.steps[0].viewState.showAreas).toBe(false);
  });
});

describe("step list operations", () => {
  beforeEach(() => reset());

  it("captureStep inserts after the selected step", () => {
    const a = s().captureStep();
    const b = s().captureStep(); // after a
    s().selectStep(a.id);
    const inserted = s().captureStep();
    expect(s().story!.steps.map((st) => st.id)).toEqual([a.id, inserted.id, b.id]);
    expect(s().selectedStepId).toBe(inserted.id);
  });

  it("captureStep appends when nothing is selected", () => {
    const a = s().captureStep();
    s().selectStep(null);
    const b = s().captureStep();
    expect(s().story!.steps.map((st) => st.id)).toEqual([a.id, b.id]);
  });

  it("duplicateStep deep-copies and inserts right after the original", () => {
    const a = s().captureStep();
    const b = s().captureStep();
    s().duplicateStep(a.id);
    const steps = s().story!.steps;
    expect(steps).toHaveLength(3);
    expect(steps[0].id).toBe(a.id);
    expect(steps[2].id).toBe(b.id);
    const copy = steps[1];
    expect(copy.id).not.toBe(a.id);
    expect(copy.viewState).not.toBe(steps[0].viewState);
    expect(copy.viewState.panes[0]).not.toBe(steps[0].viewState.panes[0]);
    expect(copy.viewState).toEqual(steps[0].viewState);
    expect(s().selectedStepId).toBe(copy.id);
  });

  it("moveStep respects list bounds", () => {
    const a = s().captureStep();
    const b = s().captureStep();
    s().moveStep(a.id, -1); // already first
    expect(s().story!.steps[0].id).toBe(a.id);
    s().moveStep(a.id, 1);
    expect(s().story!.steps.map((st) => st.id)).toEqual([b.id, a.id]);
  });

  it("removeStep clears the selection when it removes the selected step", () => {
    const a = s().captureStep();
    s().removeStep(a.id);
    expect(s().story!.steps).toHaveLength(0);
    expect(s().selectedStepId).toBeNull();
  });
});

describe("pane and window logic", () => {
  beforeEach(() => reset());

  it("re-anchors the window by date when a pane's granularity changes", () => {
    s().setPane(0, { windowId: "2020-Q3" });
    s().setPane(0, { granularity: "monthly" });
    // Q3 midpoint ≈ mid-August.
    expect(s().viewState.panes[0].windowId).toBe("2020-08");
  });

  it("linked scrub syncs other panes to the moved pane's date", () => {
    s().setLayout(2);
    s().setPane(1, { granularity: "monthly" });
    s().setWindowByIndex(0, 2); // pane 0 → 2020-Q3
    expect(s().viewState.panes[0].windowId).toBe("2020-Q3");
    expect(s().viewState.panes[1].windowId).toBe("2020-08");
  });

  it("unlinked scrub moves only the target pane", () => {
    s().setLayout(2);
    s().toggleLinked(); // off
    s().setWindowByIndex(0, 3);
    expect(s().viewState.panes[0].windowId).toBe("2020-Q4");
    expect(s().viewState.panes[1].windowId).toBe("2020-Q1");
  });

  it("stepWindow clamps at the ends", () => {
    s().stepWindow(-1);
    expect(s().viewState.panes[0].windowId).toBe("2020-Q1");
    s().setWindowByIndex(0, 3);
    s().stepWindow(1);
    expect(s().viewState.panes[0].windowId).toBe("2020-Q4");
  });

  it("setLayout grows panes by cloning the last and clamps activePane", () => {
    s().setActivePane(0);
    s().setLayout(3);
    expect(s().viewState.panes).toHaveLength(3);
    expect(s().viewState.panes[2]).toEqual(s().viewState.panes[0]);
    expect(s().viewState.panes[2]).not.toBe(s().viewState.panes[0]);
    s().setActivePane(2);
    s().setLayout(1);
    expect(s().activePane).toBe(0);
  });
});

describe("selection", () => {
  beforeEach(() => reset());

  it("selecting a step applies its view state to the canvas", () => {
    const a = s().captureStep();
    s().selectStep(null);
    s().toggleAreas();
    s().setWindowByIndex(0, 3);
    s().selectStep(a.id);
    expect(s().viewState.showAreas).toBe(false);
    expect(s().viewState.panes[0].windowId).toBe("2020-Q1");
  });
});

describe("scrub-range remapping on granularity change", () => {
  beforeEach(() => reset());

  it("remaps the selected step's scrub ids by date when the pane granularity changes", () => {
    const step = s().captureStep();
    s().setLiveSync(true);
    s().updateStep(step.id, { scrub: { paneIndex: 0, fromId: "2020-Q2", toId: "2020-Q4" } });
    s().setPane(0, { granularity: "monthly" });
    const scrub = s().story!.steps[0].scrub!;
    expect(scrub.fromId).toBe("2020-05"); // Q2 midpoint ≈ mid-May
    expect(scrub.toId).toBe("2020-11"); // Q4 midpoint ≈ mid-November
  });

  it("leaves scrubs on other panes alone", () => {
    s().setLayout(2);
    const step = s().captureStep();
    s().setLiveSync(true);
    s().updateStep(step.id, { scrub: { paneIndex: 1, fromId: "2020-Q2", toId: "2020-Q4" } });
    s().setPane(0, { granularity: "monthly" });
    expect(s().story!.steps[0].scrub).toEqual({ paneIndex: 1, fromId: "2020-Q2", toId: "2020-Q4" });
  });
});

describe("loadSite draft hygiene", () => {
  beforeEach(() => {
    reset();
    vi.stubGlobal("fetch", async (url: string) => ({
      ok: String(url).includes("manifest"),
      json: async () => testSite,
    }));
  });

  it("closes any open draft by default (it stays auto-saved)", async () => {
    s().setStory({ id: "story-a", siteId: "test-site", title: "Same site", steps: [] });
    await s().loadSite("test-site");
    expect(s().story).toBeNull();
  });

  it("keeps the draft when the caller opts out (edit/view flows)", async () => {
    s().setStory({ id: "story-b", siteId: "test-site", title: "Mine", steps: [] });
    await s().loadSite("test-site", { keepStory: true });
    expect(s().story?.id).toBe("story-b");
  });
});
