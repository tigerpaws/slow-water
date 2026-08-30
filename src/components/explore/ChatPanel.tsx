"use client";

import { useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { useExplore, cloneViewState } from "@/stores/explore";
import type { PaneState, StoryStep, ViewState } from "@/lib/demo/types";

interface ViewSpec {
  layout?: number;
  panes?: PaneState[];
  showAreas?: boolean;
  chart?: { visible?: boolean; metric?: ViewState["chart"]["metric"]; emphasize?: string[] };
}

/** Merge a (possibly partial) chat-provided view spec onto the current canvas state. */
function buildViewState(spec: ViewSpec | undefined): ViewState {
  const current = cloneViewState(useExplore.getState().viewState);
  if (!spec) return current;
  const panes = spec.panes?.length ? spec.panes.map((p) => ({ ...p })) : current.panes;
  const layout = (spec.layout ?? panes.length) as 1 | 2 | 3;
  while (panes.length < layout) panes.push({ ...panes[panes.length - 1] });
  return {
    layout,
    panes: panes.slice(0, layout),
    linkedScrub: current.linkedScrub,
    showAreas: spec.showAreas ?? current.showAreas,
    chart: {
      visible: spec.chart?.visible ?? current.chart.visible,
      metric: spec.chart?.metric ?? current.chart.metric,
      emphasize: spec.chart?.emphasize ?? current.chart.emphasize,
    },
  };
}

function runClientTool(toolName: string, input: unknown): string {
  const store = useExplore.getState();
  if (toolName === "set_view") {
    store.applyViewState(buildViewState(input as ViewSpec));
    return "view applied";
  }
  if (toolName === "add_step") {
    const i = input as {
      phase?: string;
      say: string;
      pointAt?: string;
      facts?: { text: string; source?: string }[];
      view?: ViewSpec;
      scrub?: StoryStep["scrub"];
    };
    const viewState = buildViewState(i.view);
    store.applyViewState(viewState);
    const step = store.addStep({
      phase: i.phase,
      say: i.say,
      pointAt: i.pointAt,
      facts: i.facts ?? [],
      viewState,
      scrub: i.scrub,
    });
    return `added step ${step.id} (#${(store.story?.steps.length ?? 0)})`;
  }
  if (toolName === "update_step") {
    const { stepId, ...patch } = input as { stepId: string } & Partial<StoryStep>;
    if (!store.story?.steps.some((s) => s.id === stepId)) return `no step "${stepId}"`;
    store.updateStep(stepId, patch);
    return `updated ${stepId}`;
  }
  if (toolName === "remove_step") {
    const { stepId } = input as { stepId: string };
    store.removeStep(stepId);
    return `removed ${stepId}`;
  }
  if (toolName === "set_story_title") {
    const { title } = input as { title: string };
    store.ensureStory();
    store.setStoryMeta({ title });
    return `title set to "${title}"`;
  }
  return `unknown tool ${toolName}`;
}

const TOOL_LABELS: Record<string, string> = {
  set_view: "set the canvas",
  add_step: "added a step",
  update_step: "updated a step",
  remove_step: "removed a step",
  set_story_title: "titled the story",
  query_stats: "queried the data",
};

export default function ChatPanel({ siteId }: { siteId: string }) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, addToolOutput, clearError, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages }) => {
        const s = useExplore.getState();
        return {
          body: {
            messages,
            siteId,
            canvas: s.viewState,
            storyDraft: s.story
              ? {
                  title: s.story.title,
                  steps: s.story.steps.map((st, i) => ({
                    id: st.id,
                    index: i + 1,
                    phase: st.phase,
                    say: st.say.slice(0, 120),
                  })),
                }
              : null,
          },
        };
      },
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: ({ toolCall }) => {
      const { toolName, toolCallId, input: toolInput } = toolCall as unknown as {
        toolName: string;
        toolCallId: string;
        input: unknown;
      };
      if (toolName === "query_stats") return; // server-executed
      const output = runClientTool(toolName, toolInput);
      addToolOutput({ tool: toolName as never, toolCallId, output: output as never });
    },
  });

  const busy = status === "streaming" || status === "submitted";

  const send = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    sendMessage({ text });
    setTimeout(() => scrollRef.current?.scrollTo({ top: 1e6 }), 50);
  };

  return (
    <aside
      style={{
        width: 330,
        flexShrink: 0,
        borderLeft: "1px solid var(--border)",
        background: "var(--panel)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="mono"
        style={{ fontSize: 10.5, letterSpacing: "0.1em", color: "var(--ink-soft)", padding: "14px 14px 8px" }}
      >
        ASSISTANT
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "0 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && (
          <p style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
            I can drive the canvas, pull real numbers from the site&apos;s data, and draft story steps.
            Try: &ldquo;show the fire month&rdquo;, &ldquo;how did moisture change after the beaver release?&rdquo;,
            or &ldquo;draft a 3-step story about drought resilience&rdquo;.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id}>
            <div
              className="mono"
              style={{ fontSize: 9.5, letterSpacing: "0.08em", color: m.role === "user" ? "var(--accent)" : "var(--ink-soft)" }}
            >
              {m.role === "user" ? "YOU" : "ASSISTANT"}
            </div>
            {m.parts.map((part, i) => {
              if (part.type === "text")
                return (
                  <p key={i} style={{ fontSize: 13, margin: "3px 0", whiteSpace: "pre-wrap" }}>
                    {part.text}
                  </p>
                );
              if (part.type.startsWith("tool-")) {
                const name = part.type.slice(5);
                const state = (part as { state?: string }).state;
                return (
                  <div
                    key={i}
                    className="mono"
                    style={{
                      fontSize: 10.5,
                      color: "var(--ink-soft)",
                      background: "var(--panel-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 5,
                      padding: "2px 8px",
                      margin: "3px 0",
                      display: "inline-block",
                    }}
                  >
                    {state === "output-available" ? "✓" : "…"} {TOOL_LABELS[name] ?? name}
                  </div>
                );
              }
              return null;
            })}
          </div>
        ))}
        {error && (
          <p style={{ fontSize: 12, color: "var(--fire)" }}>
            {error.message.includes("API key") || error.message.includes("401")
              ? "Chat needs ANTHROPIC_API_KEY in .env.local."
              : `Error: ${error.message}`}
            <button style={{ marginLeft: 6, fontSize: 11 }} onClick={clearError}>dismiss</button>
          </p>
        )}
        {busy && <p className="mono" style={{ fontSize: 11, color: "var(--ink-soft)" }}>thinking…</p>}
      </div>
      <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 6 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask about the site or draft steps…"
          rows={2}
          style={{
            flex: 1,
            resize: "none",
            fontSize: 13,
            fontFamily: "inherit",
            padding: "6px 9px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--bg)",
            color: "var(--ink)",
          }}
        />
        <button onClick={send} disabled={busy || !input.trim()} style={{ alignSelf: "flex-end" }}>
          Send
        </button>
      </div>
    </aside>
  );
}
