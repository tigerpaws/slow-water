"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIDataTypes,
  type UIMessage,
} from "ai";
import { useExplore, cloneViewState, newId } from "@/stores/explore";
import type { Story, ViewState } from "@/lib/demo/types";
import type { AppUITools, ViewSpec } from "@/lib/chat/schemas";
import { ResizeHandle, usePanelWidth } from "@/components/PanelResize";

/** Chat messages typed by the app's tool set — no casts at the tool boundary. */
type AppUIMessage = UIMessage<unknown, UIDataTypes, AppUITools>;

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

type ClientToolCall =
  | { toolName: "set_view"; input: AppUITools["set_view"]["input"] }
  | { toolName: "add_step"; input: AppUITools["add_step"]["input"] }
  | { toolName: "update_step"; input: AppUITools["update_step"]["input"] }
  | { toolName: "remove_step"; input: AppUITools["remove_step"]["input"] }
  | { toolName: "set_story_title"; input: AppUITools["set_story_title"]["input"] };

function runClientTool(call: ClientToolCall, ensureChatStory: () => void): string {
  const store = useExplore.getState();
  switch (call.toolName) {
    case "set_view":
      store.applyViewState(buildViewState(call.input));
      return "view applied";
    case "add_step": {
      ensureChatStory();
      const i = call.input;
      const viewState = buildViewState(i.view);
      // Create the step FIRST so it becomes the selected one — applying the
      // view before that would live-sync it into the previously selected step.
      const step = store.addStep({
        phase: i.phase,
        say: i.say,
        pointAt: i.pointAt,
        facts: i.facts ?? [],
        viewState,
        scrub: i.scrub,
      });
      store.applyViewState(viewState);
      return `added step ${step.id} (#${store.story?.steps.length ?? 0})`;
    }
    case "update_step": {
      const { stepId, ...patch } = call.input;
      if (!store.story?.steps.some((s) => s.id === stepId)) return `no step "${stepId}"`;
      store.updateStep(stepId, patch);
      return `updated ${stepId}`;
    }
    case "remove_step":
      store.removeStep(call.input.stepId);
      return `removed ${call.input.stepId}`;
    case "set_story_title":
      ensureChatStory();
      store.setStoryMeta({ title: call.input.title });
      return `title set to "${call.input.title}"`;
  }
}

/** Two site-specific starter prompts, shown by the input until the chat begins. */
const SITE_SUGGESTIONS: Record<string, [string, string]> = {
  "doty-ravine": [
    "Show how the restored corridor held its greenness through the 2020–22 drought while the landscape dipped.",
    "Draft a 3-step story about the downstream corridor widening since 2016, with real numbers.",
  ],
  "tasmam-koyom": [
    "Show me the month the Dixie Fire burned through the valley.",
    "How did meadow moisture change after the beaver release? Use real numbers.",
  ],
};

const TOOL_LABELS: Record<string, string> = {
  set_view: "set the canvas",
  add_step: "added a step",
  update_step: "updated a step",
  remove_step: "removed a step",
  set_story_title: "titled the story",
  query_stats: "queried the data",
};

export default function ChatPanel() {
  const pathname = usePathname();
  const router = useRouter();
  const mode: "explore" | "edit" = pathname.startsWith("/edit") ? "edit" : "explore";
  const siteId = useExplore((s) => s.site?.id) ?? "";
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = usePanelWidth("slowwater:chat-width", 330, 260, 600);
  // In explore, the first story-affecting tool call of a conversation starts a
  // FRESH story for this site (never appends to some other open story) and
  // moves the user into its editor; the conversation survives the navigation
  // because this panel is mounted at the layout level. In edit, work on the
  // open story.
  const conversationStoryRef = useRef<string | null>(null);
  const ensureChatStory = () => {
    const st = useExplore.getState();
    if (mode === "edit") {
      st.ensureStory();
      return;
    }
    if (conversationStoryRef.current && st.story?.id === conversationStoryRef.current) return;
    const fresh: Story = {
      id: newId("story"),
      siteId: st.site?.id ?? siteId,
      title: "Untitled story",
      steps: [],
    };
    st.setStory(fresh);
    conversationStoryRef.current = fresh.id;
    router.push(`/edit/${fresh.id}`);
  };

  const { messages, sendMessage, status, addToolOutput, clearError, error } = useChat<AppUIMessage>({
    transport: new DefaultChatTransport<AppUIMessage>({
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
      if (toolCall.dynamic) return;
      if (toolCall.toolName === "query_stats") return; // server-executed
      const output = runClientTool(toolCall, ensureChatStory);
      addToolOutput({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output });
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
    <>
    <ResizeHandle width={panelWidth} setWidth={setPanelWidth} grows="left" label="Resize assistant panel" />
    <aside
      style={{
        width: panelWidth,
        flexShrink: 0,
        borderLeft: "1px solid var(--border)",
        background: "var(--panel)",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
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
              if (part.type === "reasoning") {
                if (!part.text.trim()) return null;
                if (part.state === "streaming")
                  return (
                    <div key={i} style={{ margin: "3px 0" }}>
                      <span
                        className="mono"
                        style={{ fontSize: 9.5, letterSpacing: "0.08em", color: "var(--accent)" }}
                      >
                        THINKING
                      </span>
                      <p
                        style={{
                          fontSize: 12,
                          margin: "2px 0 0",
                          whiteSpace: "pre-wrap",
                          color: "var(--ink-soft)",
                          fontStyle: "italic",
                        }}
                      >
                        {part.text}
                      </p>
                    </div>
                  );
                return (
                  <details key={i} style={{ margin: "2px 0" }}>
                    <summary
                      className="mono"
                      style={{ fontSize: 10, color: "var(--ink-soft)", cursor: "pointer", listStylePosition: "inside" }}
                    >
                      thought process
                    </summary>
                    <p
                      style={{
                        fontSize: 12,
                        margin: "4px 0 0",
                        whiteSpace: "pre-wrap",
                        color: "var(--ink-soft)",
                        fontStyle: "italic",
                      }}
                    >
                      {part.text}
                    </p>
                  </details>
                );
              }
              if (isToolUIPart<AppUITools>(part)) {
                const name = getToolName(part);
                const state = part.state;
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
      {messages.length === 0 && SITE_SUGGESTIONS[siteId] && (
        <div style={{ padding: "0 12px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="mono" style={{ fontSize: 9.5, letterSpacing: "0.1em", color: "var(--ink-soft)" }}>
            TRY
          </span>
          {SITE_SUGGESTIONS[siteId].map((prompt) => (
            <button
              key={prompt}
              onClick={() => {
                if (busy) return;
                sendMessage({ text: prompt });
              }}
              style={{
                textAlign: "left",
                fontSize: 12,
                lineHeight: 1.4,
                padding: "7px 10px",
                background: "var(--panel-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--ink)",
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}
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
    </>
  );
}
