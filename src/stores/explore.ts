import { create } from "zustand";
import { saveStory, shouldAutosave } from "@/lib/demo/stories";
import type {
  DemoSiteManifest,
  Granularity,
  PaneState,
  Story,
  StoryStep,
  SiteStats,
  ViewState,
} from "@/lib/demo/types";
import {
  defaultViewState,
  fetchSite,
  fetchStats,
  nearestWindow,
  windowIndex,
  windowMidDate,
  windowsFor,
} from "@/lib/demo/load";

let stepCounter = 0;
export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${(stepCounter++).toString(36)}`;
}

function clonePane(p: PaneState): PaneState {
  return { ...p };
}

export function cloneViewState(vs: ViewState): ViewState {
  return {
    ...vs,
    panes: vs.panes.map(clonePane),
    chart: { ...vs.chart, emphasize: [...vs.chart.emphasize] },
  };
}

interface ExploreStore {
  site: DemoSiteManifest | null;
  stats: SiteStats | null;
  viewState: ViewState;
  activePane: number;
  playing: boolean;
  story: Story | null;
  selectedStepId: string | null;
  /** Explore mode only: canvas changes write through to the selected step. */
  liveSync: boolean;
  setLiveSync: (on: boolean) => void;

  loadSite: (siteId: string) => Promise<void>;
  setLayout: (layout: 1 | 2 | 3) => void;
  setPane: (index: number, patch: Partial<PaneState>) => void;
  setActivePane: (index: number) => void;
  stepWindow: (delta: number) => void;
  setWindowByIndex: (paneIndex: number, windowIdx: number) => void;
  setPlaying: (playing: boolean) => void;
  toggleAreas: () => void;
  toggleLinked: () => void;
  setChart: (patch: Partial<ViewState["chart"]>) => void;
  applyViewState: (vs: ViewState) => void;

  ensureStory: () => Story;
  setStory: (story: Story | null) => void;
  captureStep: () => StoryStep;
  duplicateStep: (id: string) => void;
  addStep: (step: Omit<StoryStep, "id"> & { id?: string }) => StoryStep;
  updateStep: (id: string, patch: Partial<StoryStep>) => void;
  removeStep: (id: string) => void;
  moveStep: (id: string, dir: -1 | 1) => void;
  selectStep: (id: string | null) => void;
  setStoryMeta: (patch: Partial<Pick<Story, "title" | "logline">>) => void;
}

/**
 * The live-edit rule: while exploring with a step selected, every canvas
 * change writes through to that step. Free exploration (no selection, or
 * outside explore mode) records nothing.
 */
function withSync(
  s: Pick<ExploreStore, "liveSync" | "story" | "selectedStepId">,
  viewState: ViewState
): Partial<ExploreStore> {
  if (s.liveSync && s.story && s.selectedStepId) {
    const steps = s.story.steps.map((st) =>
      st.id === s.selectedStepId ? { ...st, viewState: cloneViewState(viewState) } : st
    );
    return { viewState, story: { ...s.story, steps } };
  }
  return { viewState };
}

export const useExplore = create<ExploreStore>((set, get) => ({
  site: null,
  stats: null,
  viewState: {
    layout: 1,
    panes: [{ view: "context", render: "rgb", granularity: "quarterly", windowId: "" }],
    linkedScrub: true,
    showAreas: false,
    chart: { visible: true, metric: "ndvi", emphasize: [] },
  },
  activePane: 0,
  playing: false,
  story: null,
  selectedStepId: null,
  liveSync: false,
  setLiveSync: (on) => set({ liveSync: on }),

  loadSite: async (siteId) => {
    const site = await fetchSite(siteId);
    const stats = await fetchStats(siteId);
    // Entering a site starts in free-exploration mode: no step selected.
    set({ site, stats, viewState: defaultViewState(site), activePane: 0, playing: false, selectedStepId: null });
  },

  setLayout: (layout) =>
    set((s) => {
      const panes = s.viewState.panes.slice(0, layout).map(clonePane);
      while (panes.length < layout) panes.push(clonePane(panes[panes.length - 1] ?? s.viewState.panes[0]));
      return {
        ...withSync(s, { ...s.viewState, layout, panes }),
        activePane: Math.min(s.activePane, layout - 1),
      };
    }),

  setPane: (index, patch) =>
    set((s) => {
      if (!s.site) return {};
      const site = s.site;
      const panes = s.viewState.panes.map(clonePane);
      const pane = { ...panes[index], ...patch };
      const granChanged = !!patch.granularity && patch.granularity !== panes[index].granularity;
      const oldWindows = windowsFor(site, panes[index].granularity);
      // Changing granularity re-anchors the window to the nearest date.
      if (granChanged) {
        const old = oldWindows[windowIndex(oldWindows, panes[index].windowId)];
        const next = windowsFor(site, patch.granularity as Granularity);
        if (old && next.length) pane.windowId = nearestWindow(next, windowMidDate(old)).id;
      }
      panes[index] = pane;
      const result = withSync(s, { ...s.viewState, panes });
      // A selected step's scrub range references window ids in the pane's old
      // granularity — remap them by date so they can't go stale.
      if (granChanged && result.story && s.selectedStepId) {
        const newWindows = windowsFor(site, pane.granularity);
        if (newWindows.length) {
          const remap = (id: string) => {
            const old = oldWindows[windowIndex(oldWindows, id)];
            return old ? nearestWindow(newWindows, windowMidDate(old)).id : newWindows[0].id;
          };
          const steps = result.story.steps.map((st) =>
            st.id === s.selectedStepId && st.scrub && st.scrub.paneIndex === index
              ? { ...st, scrub: { ...st.scrub, fromId: remap(st.scrub.fromId), toId: remap(st.scrub.toId) } }
              : st
          );
          return { ...result, story: { ...result.story, steps } };
        }
      }
      return result;
    }),

  setActivePane: (index) => set({ activePane: index }),

  stepWindow: (delta) => {
    const s = get();
    if (!s.site) return;
    const targets = s.viewState.linkedScrub
      ? s.viewState.panes.map((_, i) => i)
      : [s.activePane];
    const panes = s.viewState.panes.map(clonePane);
    for (const i of targets) {
      const windows = windowsFor(s.site, panes[i].granularity);
      if (!windows.length) continue;
      const idx = windowIndex(windows, panes[i].windowId);
      const next = Math.max(0, Math.min(windows.length - 1, idx + delta));
      panes[i].windowId = windows[next].id;
    }
    set(withSync(s, { ...s.viewState, panes }));
  },

  setWindowByIndex: (paneIndex, windowIdx) => {
    const s = get();
    if (!s.site) return;
    const panes = s.viewState.panes.map(clonePane);
    const windows = windowsFor(s.site, panes[paneIndex].granularity);
    const clamped = Math.max(0, Math.min(windows.length - 1, windowIdx));
    const target = windows[clamped];
    if (!target) return;
    panes[paneIndex].windowId = target.id;
    if (s.viewState.linkedScrub) {
      const mid = windowMidDate(target);
      for (let i = 0; i < panes.length; i++) {
        if (i === paneIndex) continue;
        const w = windowsFor(s.site, panes[i].granularity);
        if (w.length) panes[i].windowId = nearestWindow(w, mid).id;
      }
    }
    set(withSync(s, { ...s.viewState, panes }));
  },

  setPlaying: (playing) => set({ playing }),
  toggleAreas: () => set((s) => withSync(s, { ...s.viewState, showAreas: !s.viewState.showAreas })),
  toggleLinked: () => set((s) => withSync(s, { ...s.viewState, linkedScrub: !s.viewState.linkedScrub })),
  setChart: (patch) =>
    set((s) => withSync(s, { ...s.viewState, chart: { ...s.viewState.chart, ...patch } })),
  applyViewState: (vs) =>
    set((s) => ({ ...withSync(s, cloneViewState(vs)), activePane: 0, playing: false })),

  ensureStory: () => {
    const s = get();
    if (s.story) return s.story;
    const story: Story = {
      id: newId("story"),
      siteId: s.site?.id ?? "",
      title: "Untitled story",
      steps: [],
    };
    set({ story });
    return story;
  },

  setStory: (story) => set({ story, selectedStepId: story?.steps[0]?.id ?? null }),

  captureStep: () => {
    const s = get();
    const story = get().ensureStory();
    const step: StoryStep = {
      id: newId("step"),
      viewState: cloneViewState(s.viewState),
      say: "",
      facts: [],
    };
    // Insert after the selected step (authoring mid-story), else append.
    const steps = [...story.steps];
    const at = steps.findIndex((st) => st.id === s.selectedStepId);
    steps.splice(at >= 0 ? at + 1 : steps.length, 0, step);
    set({ story: { ...story, steps }, selectedStepId: step.id });
    return step;
  },

  duplicateStep: (id) =>
    set((s) => {
      if (!s.story) return {};
      const i = s.story.steps.findIndex((st) => st.id === id);
      if (i < 0) return {};
      const src = s.story.steps[i];
      const copy: StoryStep = {
        ...src,
        id: newId("step"),
        viewState: cloneViewState(src.viewState),
        facts: src.facts.map((f) => ({ ...f })),
        scrub: src.scrub ? { ...src.scrub } : undefined,
      };
      const steps = [...s.story.steps];
      steps.splice(i + 1, 0, copy);
      return { story: { ...s.story, steps }, selectedStepId: copy.id };
    }),

  addStep: (partial) => {
    const story = get().ensureStory();
    const step: StoryStep = { ...partial, id: partial.id ?? newId("step") };
    set({ story: { ...story, steps: [...story.steps, step] }, selectedStepId: step.id });
    return step;
  },

  updateStep: (id, patch) =>
    set((s) => {
      if (!s.story) return {};
      const steps = s.story.steps.map((st) => (st.id === id ? { ...st, ...patch } : st));
      return { story: { ...s.story, steps } };
    }),

  removeStep: (id) =>
    set((s) => {
      if (!s.story) return {};
      const steps = s.story.steps.filter((st) => st.id !== id);
      return {
        story: { ...s.story, steps },
        selectedStepId: s.selectedStepId === id ? null : s.selectedStepId,
      };
    }),

  moveStep: (id, dir) =>
    set((s) => {
      if (!s.story) return {};
      const steps = [...s.story.steps];
      const i = steps.findIndex((st) => st.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= steps.length) return {};
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { story: { ...s.story, steps } };
    }),

  selectStep: (id) => {
    set({ selectedStepId: id });
    const s = get();
    const step = s.story?.steps.find((st) => st.id === id);
    if (step) s.applyViewState(step.viewState);
  },

  setStoryMeta: (patch) =>
    set((s) => (s.story ? { story: { ...s.story, ...patch } } : {})),
}));

// Auto-save: every meaningful story change persists (debounced) — there is no
// Save button. Empty untitled drafts are filtered by shouldAutosave.
if (typeof window !== "undefined") {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastSeen: Story | null = null;
  useExplore.subscribe((s) => {
    if (s.story === lastSeen) return;
    lastSeen = s.story;
    const snapshot = s.story;
    if (!snapshot || !shouldAutosave(snapshot)) return;
    clearTimeout(timer);
    timer = setTimeout(() => saveStory(snapshot), 500);
  });
}
