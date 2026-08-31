import type { Story } from "./types";
import { parseStory, storySchema } from "./schemas";
import dotyStory from "@/data/stories/doty-ravine.json";
import tasmamStory from "@/data/stories/tasmam-koyom.json";

// Validated at module load: a malformed demo story fails tests and the build.
export const DEMO_STORIES: Story[] = [dotyStory, tasmamStory].map(parseStory);

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
    const raw: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
    if (typeof raw !== "object" || raw === null) return {};
    // Validate per entry so one corrupted story doesn't take the rest down.
    const out: Record<string, Story> = {};
    for (const [id, value] of Object.entries(raw)) {
      const parsed = storySchema.safeParse(value);
      if (parsed.success) out[id] = parsed.data;
    }
    return out;
  } catch {
    return {};
  }
}

export function listSavedStories(): Story[] {
  return Object.values(readSaved());
}

/** Auto-save filter: skip empty untitled drafts so they don't litter the list. */
export function shouldAutosave(story: Story): boolean {
  if (isDemoStory(story.id)) return false;
  return story.steps.length > 0 || (story.title.trim() !== "" && story.title !== "Untitled story");
}

export function saveStory(story: Story): void {
  if (isDemoStory(story.id)) return; // demo stories are read-only
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

/** True when the story matches its saved copy byte-for-byte. */
export function isStorySaved(story: Story): boolean {
  const saved = readSaved()[story.id];
  return !!saved && JSON.stringify(saved) === JSON.stringify(story);
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
