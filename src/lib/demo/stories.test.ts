import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeStory } from "@/test/fixtures";

// stories.ts touches window.localStorage and window.dispatchEvent; give the
// node environment a minimal stand-in before importing it.
const backing = new Map<string, string>();
vi.stubGlobal("window", {
  localStorage: {
    getItem: (k: string) => backing.get(k) ?? null,
    setItem: (k: string, v: string) => void backing.set(k, v),
    removeItem: (k: string) => void backing.delete(k),
  },
  dispatchEvent: () => true,
});

const stories = await import("./stories");

describe("story persistence", () => {
  beforeEach(() => backing.clear());

  it("round-trips save → list → get → delete", () => {
    const story = makeStory("story-abc");
    stories.saveStory(story);
    expect(stories.listSavedStories().map((s) => s.id)).toEqual(["story-abc"]);
    expect(stories.getStory("story-abc")?.title).toBe("Test story");
    stories.deleteStory("story-abc");
    expect(stories.listSavedStories()).toEqual([]);
  });

  it("saving the same id overwrites rather than duplicating", () => {
    stories.saveStory(makeStory("story-abc"));
    stories.saveStory({ ...makeStory("story-abc"), title: "Renamed" });
    const all = stories.listSavedStories();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe("Renamed");
  });

  it("demo stories take precedence over saved copies with the same id", () => {
    const demoId = stories.DEMO_STORIES[0].id;
    stories.saveStory({ ...makeStory(demoId), title: "Shadow attempt" });
    expect(stories.getStory(demoId)?.title).toBe(stories.DEMO_STORIES[0].title);
  });

  it("isDemoStory recognizes only bundled ids", () => {
    expect(stories.isDemoStory(stories.DEMO_STORIES[0].id)).toBe(true);
    expect(stories.isDemoStory("story-abc")).toBe(false);
  });

  it("isStorySaved is exact-equality against the saved copy", () => {
    const story = makeStory("story-abc");
    expect(stories.isStorySaved(story)).toBe(false);
    stories.saveStory(story);
    expect(stories.isStorySaved(story)).toBe(true);
    expect(stories.isStorySaved({ ...story, title: "edited" })).toBe(false);
  });
});

describe("saved-story validation", () => {
  beforeEach(() => backing.clear());

  it("skips corrupted entries instead of failing the whole list", () => {
    stories.saveStory(makeStory("story-good"));
    const raw = JSON.parse(backing.get("slowwater:stories")!);
    raw["story-bad"] = { id: "story-bad", steps: "not-an-array" };
    backing.set("slowwater:stories", JSON.stringify(raw));
    expect(stories.listSavedStories().map((s) => s.id)).toEqual(["story-good"]);
  });

  it("bundled demo stories satisfy the story schema (parsed at import)", () => {
    expect(stories.DEMO_STORIES.length).toBeGreaterThan(0);
    for (const s of stories.DEMO_STORIES) {
      expect(s.steps.length).toBeGreaterThan(0);
      expect(s.steps.every((st) => st.viewState.panes.length >= 1)).toBe(true);
    }
  });
});
