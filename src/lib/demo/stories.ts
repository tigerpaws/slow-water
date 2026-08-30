import type { Story } from "./types";
import dotyStory from "@/data/stories/doty-ravine.json";
import tasmamStory from "@/data/stories/tasmam-koyom.json";

export const DEMO_STORIES = [dotyStory, tasmamStory] as unknown as Story[];

const KEY = "slowwater:stories";

/** Fired on window whenever the saved-story set changes (same-tab). */
export const STORIES_CHANGED_EVENT = "slowwater:stories-changed";

function notifyChanged(): void {
  try {
    window.dispatchEvent(new Event(STORIES_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

function readSaved(): Record<string, Story> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function listSavedStories(): Story[] {
  return Object.values(readSaved());
}

export function saveStory(story: Story): void {
  try {
    const all = readSaved();
    all[story.id] = story;
    window.localStorage.setItem(KEY, JSON.stringify(all));
    notifyChanged();
  } catch {
    /* storage unavailable — export/import still works */
  }
}

export function deleteStory(id: string): void {
  try {
    const all = readSaved();
    delete all[id];
    window.localStorage.setItem(KEY, JSON.stringify(all));
    notifyChanged();
  } catch {
    /* ignore */
  }
}

export function getStory(id: string): Story | undefined {
  return DEMO_STORIES.find((s) => s.id === id) ?? readSaved()[id];
}

export function isDemoStory(id: string): boolean {
  return DEMO_STORIES.some((s) => s.id === id);
}

export function exportStory(story: Story): void {
  const blob = new Blob([JSON.stringify(story, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${story.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
