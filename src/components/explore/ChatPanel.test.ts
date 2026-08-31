import { beforeEach, describe, expect, it } from "vitest";
import { runClientTool } from "./ChatPanel";
import { useExplore } from "@/stores/explore";
import { freshViewState, testSite } from "@/test/fixtures";

function reset() {
  useExplore.setState({
    site: testSite,
    stats: null,
    viewState: freshViewState(),
    activePane: 0,
    playing: false,
    story: null,
    selectedStepId: null,
    liveSync: false,
  });
}

const ensureChatStory = () => {
  const st = useExplore.getState();
  if (!st.story) st.setStory({ id: "story-t", siteId: "test-site", title: "T", steps: [] });
};

describe("add_step tool output", () => {
  beforeEach(() => reset());

  it("reports fresh, accurate positions and unique ids across consecutive adds", () => {
    const out1 = runClientTool({ toolName: "add_step", input: { say: "one" } }, ensureChatStory);
    const out2 = runClientTool({ toolName: "add_step", input: { say: "two" } }, ensureChatStory);
    expect(out1).toMatch(/as step 1 of 1$/);
    expect(out2).toMatch(/as step 2 of 2$/);
    const ids = useExplore.getState().story!.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(2);
    expect(out1).toContain(ids[0]);
    expect(out2).toContain(ids[1]);
  });

  it("stays accurate in edit mode with live-sync on (view applied after creation)", () => {
    ensureChatStory();
    useExplore.getState().setLiveSync(true);
    runClientTool({ toolName: "add_step", input: { say: "one" } }, ensureChatStory);
    const out2 = runClientTool(
      { toolName: "add_step", input: { say: "two", view: { showAreas: true } } },
      ensureChatStory
    );
    expect(out2).toMatch(/as step 2 of 2$/);
    const steps = useExplore.getState().story!.steps;
    // The second step's view must not have been live-synced into the first.
    expect(steps[0].viewState.showAreas).toBe(false);
    expect(steps[1].viewState.showAreas).toBe(true);
  });
});
