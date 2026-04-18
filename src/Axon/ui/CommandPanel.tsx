// ───────────────────────────────────────────────────────────────────
// Command Panel v2 — glass UI, voice-state chip, smarter composer.
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
  "What's overdue?",
  "What's on screen?",
  "Schedule a reminder in 5 minutes",
];

const QUICK_COMMANDS_CWA = [
  "Open the finance dashboard",
  "Create a task: review Q2 roadmap, due Friday",
  "How many employees do we have?",
  "Switch to Simplicity",
];

const QUICK_COMMANDS_SIMPLICITY = [
  "Open Simplicity analytics",
  "How many users signed up today?",
  "Schedule a meeting tomorrow at 3pm",
  "Switch to CodeWithAli",
];

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABEL: Record<string, string> = {
  idle: "Idle",
  listening: "Listening",
  processing: "Thinking",
  speaking: "Speaking",
  executing: "Working",
  error: "Error",
};

const VOICE_LABEL: Record<string, string> = {
  standby: "Standby",
  armed: "Armed",
  dormant: "Dormant",
};

export function CommandPanel() {
  const {
    panelOpen,
    closePanel,
    status,
    voiceState,
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
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [conversation.length, tab]);

  const send = () => {
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    submitCommand(t, "text");
  };

  const quicks = [
    ...QUICK_COMMANDS_COMMON,
    ...(activeCompany === "simplicityFunds" ? QUICK_COMMANDS_SIMPLICITY : QUICK_COMMANDS_CWA),
  ];

  return (
    <aside className="axon-panel" data-open={panelOpen} aria-hidden={!panelOpen}>
      <header className="axon-panel-header">
        <div className="axon-panel-title">
          <span className="axon-status-dot" data-state={status} />
          <strong>AXON</strong>
          <span style={{ color: "var(--axon-muted)", fontWeight: 500 }}>
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="axon-voicepill" data-state={voiceState}>
            <span
              className="axon-status-dot"
              data-state={voiceState === "armed" ? "listening" : "idle"}
            />
            {VOICE_LABEL[voiceState] ?? voiceState}
          </span>
          <button className="axon-btn" onClick={interrupt} title="Stop speaking">
            Stop
          </button>
          <button className="axon-btn" onClick={clearConversation} title="Clear session">
            Clear
          </button>
          <button className="axon-btn" onClick={closePanel} aria-label="Close">
            ×
          </button>
        </div>
      </header>

      <div className="axon-panel-body">
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

        <div ref={scrollRef} className="axon-pane">
          {tab === "conversation" && <ConversationPane />}
          {tab === "activity" && <ActivityPane />}
          {tab === "settings" && <AxonSettingsPane />}

          {!ANTHROPIC_API_KEY && tab === "conversation" && (
            <div className="axon-hint">
              <strong style={{ color: "var(--axon-fg)" }}>AXON is offline.</strong>
              <br />
              Set <code>VITE_ANTHROPIC_API_KEY</code> in your <code>.env</code>, then restart{" "}
              <code>bun run tauri dev</code>.
            </div>
          )}
        </div>

        {tab === "conversation" && (
          <>
            <div className="axon-quickrow">
              <div className="axon-quickrow-label">
                Quick commands · {loc.pathname}
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
                data-active={status === "listening"}
                onClick={startListening}
                title="Push to talk (Ctrl+Space)"
                aria-label="Push to talk"
              >
                ◉
              </button>
              <input
                aria-label="Type a command"
                placeholder={
                  status === "listening"
                    ? liveTranscript || "listening…"
                    : voiceState === "dormant"
                    ? "Dormant — say 'Axon wake up' or type…"
                    : "Type a command, or just say 'Hey Axon…'"
                }
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                  if (e.key === "Escape") closePanel();
                }}
              />
              <button className="axon-btn" onClick={send} disabled={!draft.trim()}>
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
      <div style={{ color: "var(--axon-muted)", fontSize: 12.5, padding: 12, lineHeight: 1.6 }}>
        I'm listening. Try: <em>"Hey Axon, brief me."</em>
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
              {typeof t.confidence === "number" ? ` · ${Math.round(t.confidence * 100)}%` : ""}
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
      <div style={{ color: "var(--axon-muted)", fontSize: 12.5, padding: 12 }}>
        Nothing yet this session.
      </div>
    );
  }
  return (
    <>
      {activity
        .slice()
        .reverse()
        .map((a) => (
          <div key={a.id} className="axon-activity-row" data-error={!!a.error}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <span className="axon-activity-name">{a.actionName}</span>
              <div style={{ fontSize: 11.5, color: "var(--axon-muted)", marginTop: 2 }}>
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
