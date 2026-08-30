import { create } from "zustand";
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
  addStep: (step: Omit<StoryStep, "id"> & { id?: string }) => StoryStep;
  updateStep: (id: string, patch: Partial<StoryStep>) => void;
  removeStep: (id: string) => void;
  moveStep: (id: string, dir: -1 | 1) => void;
  selectStep: (id: string | null) => void;
  setStoryMeta: (patch: Partial<Pick<Story, "title" | "logline">>) => void;
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

  loadSite: async (siteId) => {
    const site = await fetchSite(siteId);
    const stats = await fetchStats(siteId);
    set({ site, stats, viewState: defaultViewState(site), activePane: 0, playing: false });
  },

  setLayout: (layout) =>
    set((s) => {
      const panes = s.viewState.panes.slice(0, layout).map(clonePane);
      while (panes.length < layout) panes.push(clonePane(panes[panes.length - 1] ?? s.viewState.panes[0]));
      return {
        viewState: { ...s.viewState, layout, panes },
        activePane: Math.min(s.activePane, layout - 1),
      };
    }),

  setPane: (index, patch) =>
    set((s) => {
      if (!s.site) return {};
      const panes = s.viewState.panes.map(clonePane);
      const pane = { ...panes[index], ...patch };
      // Changing granularity re-anchors the window to the nearest date.
      if (patch.granularity && patch.granularity !== panes[index].granularity) {
        const oldWindows = windowsFor(s.site, panes[index].granularity);
        const old = oldWindows[windowIndex(oldWindows, panes[index].windowId)];
        const next = windowsFor(s.site, patch.granularity as Granularity);
        if (old && next.length) pane.windowId = nearestWindow(next, windowMidDate(old)).id;
      }
      panes[index] = pane;
      return { viewState: { ...s.viewState, panes } };
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
    set({ viewState: { ...s.viewState, panes } });
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
    set({ viewState: { ...s.viewState, panes } });
  },

  setPlaying: (playing) => set({ playing }),
  toggleAreas: () => set((s) => ({ viewState: { ...s.viewState, showAreas: !s.viewState.showAreas } })),
  toggleLinked: () => set((s) => ({ viewState: { ...s.viewState, linkedScrub: !s.viewState.linkedScrub } })),
  setChart: (patch) =>
    set((s) => ({ viewState: { ...s.viewState, chart: { ...s.viewState.chart, ...patch } } })),
  applyViewState: (vs) =>
    set({ viewState: cloneViewState(vs), activePane: 0, playing: false }),

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
    set({ story: { ...story, steps: [...story.steps, step] }, selectedStepId: step.id });
    return step;
  },

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
