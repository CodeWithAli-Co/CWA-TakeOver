// ───────────────────────────────────────────────────────────────────
// Command Panel v2 — glass UI, voice-state chip, smarter composer.
// ───────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { useAxon } from "../AxonProvider";
import { useCompanyFilter } from "@/stores/store";
import { ANTHROPIC_API_KEY } from "../config";
import { AxonSettingsPane } from "./AxonSettings";
import { quicksFor } from "./quickCommandsMap";
import { listAudit, type AuditEntry } from "../engine/auditLog";
import { MindMap } from "./MindMap";

type Tab = "conversation" | "mind" | "activity" | "audit" | "settings";

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
    callMode,
    setCallMode,
    simulationMode,
    setSimulationMode,
    settings,
    updateSettings,
  } = useAxon();
  const { activeCompany } = useCompanyFilter();
  const loc = useLocation();

  const [tab, setTab] = useState<Tab>("conversation");
  const [draft, setDraft] = useState("");
  const [mindFullScreen, setMindFullScreen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Esc closes the full-screen Mind Map without exiting the tab.
  useEffect(() => {
    if (!mindFullScreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMindFullScreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mindFullScreen]);

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

  const quicks = quicksFor(loc.pathname, activeCompany);

  return (
    <>
    {/* Full-screen Mind Map portal — escapes the panel when maximized
        so the canvas owns the whole viewport. Esc closes; the
        keydown listener above wires that up. */}
    {tab === "mind" && mindFullScreen && (
      <MindMap fullScreen />
    )}
    <aside className="axon-panel" data-open={panelOpen} aria-hidden={!panelOpen}>
      <header className="axon-panel-header">
        {/* Row 1 — identity (title + status), voice chip, close button */}
        <div>
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
            <button
              className="axon-btn axon-btn--close"
              onClick={closePanel}
              aria-label="Close"
              title="Close panel"
            >
              ×
            </button>
          </div>
        </div>

        {/* Row 2 — toggle pills + transient actions */}
        <div>
          {/* Call-mode toggle — click flips the flag locally. Voice-wise
              the operator can also say "start a call" / "hang up". */}
          <button
            className="axon-btn"
            onClick={() => setCallMode(!callMode)}
            title={callMode ? "Exit call mode" : "Enter call mode"}
            data-active={callMode}
            style={callMode ? { color: "rgb(248, 113, 113)" } : undefined}
          >
            {callMode ? "📞 On Call" : "📞 Call"}
          </button>
          {/* Simulation toggle — when ON, every mutating tool call (file
              writes, modifies, scaffolds) returns a fake success without
              actually running. The Mind Map shows the proposed plan with
              a SIM pill so the operator can review before flipping back
              off and re-running for real. Engine reads via getSimulation
              Mode(); this button is the operator-facing switch. */}
          <button
            className="axon-btn"
            onClick={() => setSimulationMode(!simulationMode)}
            title={
              simulationMode
                ? "Simulation ON — file ops are dry-runs"
                : "Enable simulation mode (dry-run all mutations)"
            }
            data-active={simulationMode}
            style={simulationMode ? { color: "rgb(252, 211, 77)" } : undefined}
          >
            SIM
          </button>
          {/* Continuous-vision toggle. When ON, Axon takes a screenshot
              every ~30s and posts a 1-sentence read of the screen as
              a vision node on the Mind Map. Skips automatically while
              he's mid-task. Wired to the persisted setting so it
              survives reloads. */}
          <button
            className="axon-btn"
            onClick={() => updateSettings({ continuousVision: !settings.continuousVision })}
            title={
              settings.continuousVision
                ? "Vision ON — ambient screenshots every 30s"
                : "Enable ambient screen vision (every 30s)"
            }
            data-active={settings.continuousVision}
            style={
              settings.continuousVision
                ? { color: "rgb(56, 189, 248)" }
                : undefined
            }
          >
            👁 {settings.continuousVision ? "Seeing" : "Eyes"}
          </button>
          {/* FS watcher — when ON, Axon notices when you edit files
              outside the agent (saving in VS Code, pulling a branch).
              Each external edit lands as a 📝 thought on the Mind
              Map and fires an "axon:file-modified" CustomEvent that
              future "want me to update related types?" toasts can
              hook into. */}
          <button
            className="axon-btn"
            onClick={() => updateSettings({ fsWatcher: !settings.fsWatcher })}
            title={
              settings.fsWatcher
                ? "FS watcher ON — external edits surface on the Mind Map"
                : "Enable filesystem watcher (active project)"
            }
            data-active={settings.fsWatcher}
            style={settings.fsWatcher ? { color: "rgb(134, 239, 172)" } : undefined}
          >
            📝 FS
          </button>
          {/* Diary — when ON, every session ends with a markdown
              reflection written to docs/diary/YYYY-MM-DD/. Foundation
              for Axon's long-term memory. Default ON because empty
              sessions don't write anything, so the cost is zero. */}
          <button
            className="axon-btn"
            onClick={() => updateSettings({ diary: !settings.diary })}
            title={
              settings.diary
                ? "Diary ON — sessions write markdown to docs/diary/"
                : "Enable session diary (markdown reflections)"
            }
            data-active={settings.diary}
            style={settings.diary ? { color: "rgb(165, 180, 252)" } : undefined}
          >
            📔 Log
          </button>

          {/* Spacer pushes Stop / Clear to the end of the row so
              transient actions live separately from persistent toggles. */}
          <div style={{ flex: 1 }} />

          <button className="axon-btn" onClick={interrupt} title="Stop speaking">
            Stop
          </button>
          <button className="axon-btn" onClick={clearConversation} title="Clear session">
            Clear
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
            data-active={tab === "mind"}
            onClick={() => setTab("mind")}
            title="Live Mind Map — see Axon's thinking in real time"
          >
            Mind
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
            data-active={tab === "audit"}
            onClick={() => setTab("audit")}
          >
            Audit
          </button>
          <button
            className="axon-tab"
            data-active={tab === "settings"}
            onClick={() => setTab("settings")}
          >
            Settings
          </button>

          {/* Maximize / restore — only visible on the Mind tab. */}
          {tab === "mind" && (
            <button
              className="axon-mindmap-maximize"
              data-active={mindFullScreen}
              onClick={() => setMindFullScreen((v) => !v)}
              title={mindFullScreen ? "Exit full screen (Esc)" : "Open full screen"}
              aria-label={mindFullScreen ? "Exit full screen" : "Open full screen"}
            >
              {mindFullScreen ? "⤡" : "⤢"}
            </button>
          )}
        </div>

        <div ref={scrollRef} className="axon-pane">
          {tab === "conversation" && <ConversationPane />}
          {tab === "mind" && !mindFullScreen && <MindMap />}
          {tab === "activity" && <ActivityPane />}
          {tab === "audit" && <AuditPane />}
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
    </>
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

function AuditPane() {
  const [rows, setRows] = useState<AuditEntry[]>(() => listAudit({ limit: 100 }));
  useEffect(() => {
    // Refresh on mount + every 5s while the tab is visible.
    const id = window.setInterval(() => setRows(listAudit({ limit: 100 })), 5000);
    return () => clearInterval(id);
  }, []);
  if (rows.length === 0) {
    return (
      <div style={{ color: "var(--axon-muted)", fontSize: 12.5, padding: 12, lineHeight: 1.55 }}>
        No mutating actions yet. The audit log is persistent — it survives reloads. Every
        create, update, or delete AXON makes lands here with the operator, company, and
        timestamp.
      </div>
    );
  }
  return (
    <>
      {rows.map((r) => (
        <div
          key={r.id}
          className="axon-activity-row"
          data-error={!r.success}
          style={{ opacity: r.undone ? 0.5 : 1 }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <span className="axon-activity-name">
              {r.actionName}
              {r.dryRun && <span style={{ color: "var(--axon-muted)", marginLeft: 8, fontSize: 10 }}>dry-run</span>}
              {r.undone && <span style={{ color: "var(--axon-muted)", marginLeft: 8, fontSize: 10 }}>undone</span>}
            </span>
            <div style={{ fontSize: 11.5, color: "var(--axon-muted)", marginTop: 2 }}>
              {r.summary}
              {r.error ? ` — ${r.error}` : ""}
            </div>
            <div style={{ fontSize: 10, color: "var(--axon-muted)", marginTop: 2, opacity: 0.7 }}>
              {r.operator} · {r.activeCompany}
            </div>
          </div>
          <span className="axon-activity-time">
            {new Date(r.timestamp).toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      ))}
    </>
  );
}
