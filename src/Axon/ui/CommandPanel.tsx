// ───────────────────────────────────────────────────────────────────
// Command Panel — conversation, activity feed, quick commands,
// composer, and settings pane.
// ───────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { useAxon } from "../AxonProvider";
import { useCompanyFilter } from "@/stores/store";
import { ANTHROPIC_API_KEY } from "../config";
import { AxonSettingsPane } from "./AxonSettings";

type Tab = "conversation" | "activity" | "settings";

const QUICK_COMMANDS_COMMON = [
  "Brief me",
  "What tasks are overdue?",
  "What's due this week?",
  "How many active users?",
];

const QUICK_COMMANDS_CWA = [
  "Show me the finance dashboard",
  "How many employees do we have?",
  "Switch to Simplicity",
];

const QUICK_COMMANDS_SIMPLICITY = [
  "Open Simplicity analytics",
  "How many signups today?",
  "Switch to CodeWithAli",
];

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function CommandPanel() {
  const {
    panelOpen,
    closePanel,
    status,
    conversation,
    activity,
    submitCommand,
    interrupt,
    startListening,
    clearConversation,
    liveTranscript,
  } = useAxon();
  const { activeCompany } = useCompanyFilter();
  const loc = useLocation();

  const [tab, setTab] = useState<Tab>("conversation");
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation.length, tab]);

  const send = () => {
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    submitCommand(t, "text");
  };

  const statusLabel: Record<string, string> = {
    idle: "Idle",
    listening: "Listening",
    processing: "Processing",
    speaking: "Speaking",
    executing: "Executing",
    error: "Error",
  };

  const quicks = [
    ...QUICK_COMMANDS_COMMON,
    ...(activeCompany === "simplicityFunds"
      ? QUICK_COMMANDS_SIMPLICITY
      : QUICK_COMMANDS_CWA),
  ];

  return (
    <aside className="axon-panel" data-open={panelOpen} aria-hidden={!panelOpen}>
      <header className="axon-panel-header">
        <div className="axon-panel-title">
          <span className="axon-status-dot" data-state={status} />
          AXON · {statusLabel[status] ?? status}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="axon-btn" onClick={interrupt} title="Stop speaking">
            Stop
          </button>
          <button className="axon-btn" onClick={clearConversation} title="Clear session">
            Clear
          </button>
          <button className="axon-btn" onClick={closePanel} aria-label="Close panel">
            ×
          </button>
        </div>
      </header>

      <div className="axon-panel-body">
        {/* Tabs */}
        <div className="axon-tabs">
          <button
            className="axon-tab"
            data-active={tab === "conversation"}
            onClick={() => setTab("conversation")}
          >
            Conversation
          </button>
          <button
            className="axon-tab"
            data-active={tab === "activity"}
            onClick={() => setTab("activity")}
          >
            Activity · {activity.length}
          </button>
          <button
            className="axon-tab"
            data-active={tab === "settings"}
            onClick={() => setTab("settings")}
          >
            Settings
          </button>
        </div>

        {/* Pane */}
        <div ref={scrollRef} className="axon-pane">
          {tab === "conversation" && (
            <ConversationPane />
          )}
          {tab === "activity" && <ActivityPane />}
          {tab === "settings" && <AxonSettingsPane />}

          {!ANTHROPIC_API_KEY && tab === "conversation" && (
            <div
              style={{
                marginTop: 16,
                padding: 10,
                border: "1px dashed rgba(var(--axon-accent-rgb), 0.45)",
                borderRadius: 6,
                fontSize: 12,
                color: "var(--axon-muted)",
              }}
            >
              Reasoning engine is offline — set <code>VITE_ANTHROPIC_API_KEY</code> in your <code>.env</code> to activate.
            </div>
          )}
        </div>

        {/* Quick commands (conversation tab only) */}
        {tab === "conversation" && (
          <>
            <div className="axon-quickrow">
              <div
                style={{
                  width: "100%",
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  color: "var(--axon-muted)",
                  marginBottom: 4,
                }}
              >
                QUICK COMMANDS · {loc.pathname}
              </div>
              {quicks.map((q) => (
                <button
                  key={q}
                  className="axon-quickchip"
                  onClick={() => submitCommand(q, "text")}
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="axon-composer">
              <button
                className="axon-btn axon-btn-icon"
                onClick={startListening}
                title="Push to talk"
                aria-label="Push to talk"
              >
                ◉
              </button>
              <input
                aria-label="Type a command"
                placeholder={
                  status === "listening"
                    ? liveTranscript || "listening…"
                    : "Type a command or ask something…"
                }
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                  if (e.key === "Escape") closePanel();
                }}
              />
              <button
                className="axon-btn"
                onClick={send}
                disabled={!draft.trim()}
              >
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function ConversationPane() {
  const { conversation } = useAxon();
  if (conversation.length === 0) {
    return (
      <div style={{ color: "var(--axon-muted)", fontSize: 12, padding: 8 }}>
        Standing by. Try: <em>"Hey AXON, brief me."</em>
      </div>
    );
  }
  return (
    <>
      {conversation.map((t) => (
        <div key={t.id} className="axon-turn" data-role={t.role}>
          <div className="axon-turn-meta">
            <span>
              {t.role === "axon" ? "AXON" : t.role === "user" ? "YOU" : "SYSTEM"}
              {t.modality === "voice" ? " · VOICE" : ""}
              {typeof t.confidence === "number"
                ? ` · ${Math.round(t.confidence * 100)}%`
                : ""}
            </span>
            <span>{formatTime(t.timestamp)}</span>
          </div>
          <div style={{ whiteSpace: "pre-wrap" }}>{t.text}</div>
          {t.actions && t.actions.length > 0 && (
            <div className="axon-turn-actions">
              {t.actions.map((a) => (
                <div key={a.id} className="axon-turn-action">
                  ▸ <strong>{a.actionName}</strong> — {a.summary}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function ActivityPane() {
  const { activity } = useAxon();
  if (activity.length === 0) {
    return (
      <div style={{ color: "var(--axon-muted)", fontSize: 12, padding: 8 }}>
        No actions yet this session.
      </div>
    );
  }
  return (
    <>
      {activity
        .slice()
        .reverse()
        .map((a) => (
          <div
            key={a.id}
            className="axon-activity-row"
            data-error={!!a.error}
          >
            <div>
              <span className="axon-activity-name">{a.actionName}</span>
              <div style={{ fontSize: 11, color: "var(--axon-muted)" }}>
                {a.summary}
                {a.error ? ` — ${a.error}` : ""}
              </div>
            </div>
            <span className="axon-activity-time">{formatTime(a.timestamp)}</span>
          </div>
        ))}
    </>
  );
}
