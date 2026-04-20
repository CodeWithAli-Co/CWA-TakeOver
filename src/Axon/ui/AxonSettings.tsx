// ───────────────────────────────────────────────────────────────────
// Settings pane v2 — cleaner typography, proper toggles, new fields.
// ───────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useAxon } from "../AxonProvider";
import { getAvailableVoices } from "../engine/voiceOutput";
import { MONITORS } from "../engine/monitors";
import { enrollVoice } from "../engine/voicePrint";

export function AxonSettingsPane() {
  const { settings, updateSettings, automations } = useAxon();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollStatus, setEnrollStatus] = useState<string | null>(null);

  useEffect(() => {
    getAvailableVoices().then(setVoices);
  }, []);

  const doEnroll = async () => {
    setEnrolling(true);
    setEnrollStatus("Recording — speak naturally for 5 seconds…");
    try {
      const vec = await enrollVoice();
      if (!vec) {
        setEnrollStatus("Couldn't enroll — check mic permission and try again.");
      } else {
        updateSettings({ voicePrint: vec });
        setEnrollStatus("Enrolled. AXON will prefer your voice now.");
      }
    } catch (e) {
      setEnrollStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setEnrolling(false);
      setTimeout(() => setEnrollStatus(null), 6000);
    }
  };

  return (
    <div style={{ padding: 2 }}>
      {/* Master */}
      <div className="axon-settings-group">
        <label className="axon-settings-label">Master</label>
        <div className="axon-settings-row">
          <span>AXON enabled</span>
          <input
            className="axon-switch"
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => updateSettings({ enabled: e.target.checked })}
          />
        </div>
        <div className="axon-settings-row">
          <span>Always-on listening</span>
          <input
            className="axon-switch"
            type="checkbox"
            checked={settings.alwaysListening}
            onChange={(e) => updateSettings({ alwaysListening: e.target.checked })}
          />
        </div>
        <div className="axon-settings-row">
          <span>Auto-greet on open</span>
          <input
            className="axon-switch"
            type="checkbox"
            checked={settings.autoGreet}
            onChange={(e) => updateSettings({ autoGreet: e.target.checked })}
          />
        </div>
        <div className="axon-settings-row">
          <span>Dry-run mode</span>
          <input
            className="axon-switch"
            type="checkbox"
            checked={settings.dryRun}
            onChange={(e) => updateSettings({ dryRun: e.target.checked })}
          />
        </div>
        <div style={{ fontSize: 11, color: "var(--axon-muted)", marginTop: -4, marginBottom: 8 }}>
          When on, mutating actions report what they'd do without doing it.
        </div>

        {/* Forced-sleep kill switch — overrides wake word + resume phrases */}
        <div
          className="axon-settings-row"
          style={{
            borderRadius: 8,
            padding: "10px 12px",
            marginTop: 6,
            background: settings.forceSleep
              ? "hsl(210 40% 55% / 0.12)"
              : "transparent",
            border: `1px solid ${settings.forceSleep ? "hsl(210 40% 55% / 0.35)" : "hsl(0 0% 50% / 0.15)"}`,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 3 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13 }}>
                {settings.forceSleep ? "😴 Forced sleep" : "Forced sleep"}
              </span>
              {settings.forceSleep && (
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: "hsl(210 60% 72%)",
                    padding: "1px 6px",
                    borderRadius: 4,
                    background: "hsl(210 40% 55% / 0.18)",
                  }}
                >
                  ACTIVE
                </span>
              )}
            </span>
            <span style={{ fontSize: 11, color: "var(--axon-muted)", lineHeight: 1.45 }}>
              Total silence. Wake words, resume phrases, and proactive speech
              are all ignored until you toggle this off. Use when you need
              guaranteed quiet.
            </span>
          </div>
          <input
            className="axon-switch"
            type="checkbox"
            checked={!!settings.forceSleep}
            onChange={(e) => updateSettings({ forceSleep: e.target.checked })}
          />
        </div>
      </div>

      {/* Autonomy — how much Axon does on its own vs. asking permission */}
      <div className="axon-settings-group">
        <label className="axon-settings-label">Autonomy</label>

        <div className="axon-settings-row">
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <span>Auto-approve destructive actions</span>
            <span style={{ fontSize: 11, color: "var(--axon-muted)" }}>
              Skip the "are you sure?" dialog. Mistakes reversed via undo.
            </span>
          </div>
          <input
            className="axon-switch"
            type="checkbox"
            checked={settings.autoApprove !== false}
            onChange={(e) => updateSettings({ autoApprove: e.target.checked })}
          />
        </div>

        <div
          className="axon-settings-row"
          style={{
            borderRadius: 8,
            padding: "8px 10px",
            background: settings.autoApprove !== false
              ? "hsl(0 72% 51% / 0.08)"
              : "var(--axon-muted-bg, transparent)",
            border: `1px solid ${settings.autoApprove !== false ? "hsl(0 72% 51% / 0.25)" : "transparent"}`,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: settings.autoApprove !== false ? "hsl(0 72% 68%)" : "var(--axon-muted)" }}>
              {settings.autoApprove !== false ? "🔴 LIVE FIRE" : "ASK FIRST"}
            </span>
            <span style={{ fontSize: 11, color: "var(--axon-muted)", lineHeight: 1.4 }}>
              {settings.autoApprove !== false
                ? "Axon acts on first interpretation. Say 'undo that' to reverse."
                : "Axon pauses for confirmation before every destructive action."}
            </span>
          </div>
        </div>

        <div className="axon-settings-row" style={{ marginTop: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <span>Continuous listen mode</span>
            <span style={{ fontSize: 11, color: "var(--axon-muted)" }}>
              After the wake word, stay armed until you say "stand down".
            </span>
          </div>
          <input
            className="axon-switch"
            type="checkbox"
            checked={settings.continuousAfterWake !== false}
            onChange={(e) =>
              updateSettings({ continuousAfterWake: e.target.checked })
            }
          />
        </div>

        <div style={{ fontSize: 10.5, color: "var(--axon-muted)", marginTop: 2, marginBottom: 4 }}>
          Stand-down phrases:{" "}
          <span style={{ fontFamily: "monospace" }}>
            {(settings.standDownPhrases ?? []).join(" · ")}
          </span>
        </div>
      </div>

      {/* Vision */}
      <div className="axon-settings-group">
        <label className="axon-settings-label">Vision</label>
        <label className="axon-settings-label" style={{ fontSize: 9.5, opacity: 0.7 }}>
          When to capture a screenshot for Claude
        </label>
        <select
          className="axon-settings-select"
          value={settings.visionMode}
          onChange={(e) =>
            updateSettings({ visionMode: e.target.value as "off" | "auto" | "always" })
          }
        >
          <option value="off">Off — never capture</option>
          <option value="auto">Auto — when the question implies vision</option>
          <option value="always">Always — every turn</option>
        </select>
        <div className="axon-hint">
          Requires <code>html2canvas</code>. Install with{" "}
          <code>bun add html2canvas</code>. Without it AXON falls back to text-only.
        </div>
      </div>

      {/* Voice identity */}
      <div className="axon-settings-group">
        <label className="axon-settings-label">Voice identity</label>
        <div style={{ fontSize: 12, color: "var(--axon-muted)", marginBottom: 10, lineHeight: 1.5 }}>
          Enroll your voice so AXON prefers yours. Best-effort filter —
          stops most other voices from activating, but not a security measure.
        </div>
        <div className="axon-settings-row">
          <button
            className="axon-btn"
            onClick={doEnroll}
            disabled={enrolling}
            style={{ width: "100%" }}
          >
            {enrolling ? "Enrolling…" : settings.voicePrint ? "Re-enroll voice" : "Enroll your voice (5s)"}
          </button>
        </div>
        {settings.voicePrint && (
          <div className="axon-settings-row">
            <button
              className="axon-btn"
              onClick={() => updateSettings({ voicePrint: null })}
              style={{ width: "100%" }}
            >
              Clear enrollment
            </button>
          </div>
        )}
        {settings.voicePrint && (
          <>
            <label className="axon-settings-label" style={{ fontSize: 9.5, opacity: 0.7, marginTop: 8 }}>
              Match threshold · {settings.voicePrintThreshold.toFixed(2)}
            </label>
            <input
              className="axon-settings-range"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.voicePrintThreshold}
              onChange={(e) =>
                updateSettings({ voicePrintThreshold: Number(e.target.value) })
              }
            />
          </>
        )}
        {enrollStatus && (
          <div className="axon-hint">{enrollStatus}</div>
        )}
      </div>

      {/* Wake / sleep */}
      <div className="axon-settings-group">
        <label className="axon-settings-label">Wake / Sleep</label>
        <label className="axon-settings-label" style={{ fontSize: 9.5, opacity: 0.7 }}>
          Wake word
        </label>
        <input
          className="axon-settings-input"
          value={settings.wakeWord}
          onChange={(e) => updateSettings({ wakeWord: e.target.value })}
        />
        <div style={{ height: 10 }} />
        <label className="axon-settings-label" style={{ fontSize: 9.5, opacity: 0.7 }}>
          Sleep phrases (comma-separated)
        </label>
        <input
          className="axon-settings-input"
          value={settings.sleepPhrases.join(", ")}
          onChange={(e) =>
            updateSettings({
              sleepPhrases: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
        <div style={{ height: 10 }} />
        <label className="axon-settings-label" style={{ fontSize: 9.5, opacity: 0.7 }}>
          Resume phrases (comma-separated)
        </label>
        <input
          className="axon-settings-input"
          value={settings.resumePhrases.join(", ")}
          onChange={(e) =>
            updateSettings({
              resumePhrases: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
        <div style={{ height: 10 }} />
        <label className="axon-settings-label" style={{ fontSize: 9.5, opacity: 0.7 }}>
          Push-to-talk shortcut
        </label>
        <input
          className="axon-settings-input"
          value={settings.pushToTalkShortcut}
          onChange={(e) => updateSettings({ pushToTalkShortcut: e.target.value })}
          placeholder="e.g. Control+Space"
        />
      </div>

      {/* Voice */}
      <div className="axon-settings-group">
        <label className="axon-settings-label">Voice</label>
        <label className="axon-settings-label" style={{ fontSize: 9.5, opacity: 0.7 }}>
          Preferred voice
        </label>
        <select
          className="axon-settings-select"
          value={settings.preferredVoice ?? ""}
          onChange={(e) => updateSettings({ preferredVoice: e.target.value || null })}
        >
          <option value="">Auto — best deep voice available</option>
          {voices.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name} · {v.lang}
            </option>
          ))}
        </select>

        <div style={{ height: 12 }} />
        <label className="axon-settings-label" style={{ fontSize: 9.5, opacity: 0.7 }}>
          Rate · {settings.rate.toFixed(2)}
        </label>
        <input
          className="axon-settings-range"
          type="range"
          min="0.5"
          max="1.6"
          step="0.02"
          value={settings.rate}
          onChange={(e) => updateSettings({ rate: Number(e.target.value) })}
        />
        <label className="axon-settings-label" style={{ fontSize: 9.5, opacity: 0.7 }}>
          Pitch · {settings.pitch.toFixed(2)}
        </label>
        <input
          className="axon-settings-range"
          type="range"
          min="0.4"
          max="1.6"
          step="0.02"
          value={settings.pitch}
          onChange={(e) => updateSettings({ pitch: Number(e.target.value) })}
        />
        <label className="axon-settings-label" style={{ fontSize: 9.5, opacity: 0.7 }}>
          Volume · {settings.volume.toFixed(2)}
        </label>
        <input
          className="axon-settings-range"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.volume}
          onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
        />

        <div style={{ height: 14 }} />
        <label className="axon-settings-label" style={{ fontSize: 9.5, opacity: 0.7 }}>
          ElevenLabs voice id (optional)
        </label>
        <input
          className="axon-settings-input"
          value={settings.elevenLabsVoiceId ?? ""}
          placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
          onChange={(e) => updateSettings({ elevenLabsVoiceId: e.target.value || null })}
        />
        <div className="axon-hint">
          Needs <code>VITE_ELEVENLABS_API_KEY</code> in your env. Voice id goes here.
        </div>
      </div>

      {/* Monitors */}
      <div className="axon-settings-group">
        <label className="axon-settings-label">Anomaly monitors</label>
        {MONITORS.map((m) => {
          const on = settings.enabledMonitors.includes(m.id);
          return (
            <div key={m.id} className="axon-settings-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13 }}>{m.label}</div>
                <div style={{ fontSize: 11, color: "var(--axon-muted)", marginTop: 2 }}>
                  {m.description}
                </div>
              </div>
              <input
                className="axon-switch"
                type="checkbox"
                checked={on}
                onChange={(e) =>
                  updateSettings({
                    enabledMonitors: e.target.checked
                      ? [...settings.enabledMonitors, m.id]
                      : settings.enabledMonitors.filter((id) => id !== m.id),
                  })
                }
              />
            </div>
          );
        })}
      </div>

      {/* Automations */}
      <div className="axon-settings-group">
        <label className="axon-settings-label">Active automations (session)</label>
        {automations.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--axon-muted)" }}>
            None scheduled. Say: "Axon, remind me to check the finance dashboard in 30 minutes."
          </div>
        ) : (
          automations.map((a) => (
            <div key={a.id} className="axon-activity-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>{a.description}</div>
                <div style={{ fontSize: 10, color: "var(--axon-muted)", marginTop: 2 }}>
                  {a.kind} · every {Math.round(a.intervalMs / 1000)}s
                </div>
              </div>
              <span className="axon-activity-time">{a.id.slice(-6)}</span>
            </div>
          ))
        )}
      </div>

      {/* Confidence */}
      <div className="axon-settings-group">
        <label className="axon-settings-label">
          Voice confidence threshold · {settings.confidenceThreshold.toFixed(2)}
        </label>
        <input
          className="axon-settings-range"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.confidenceThreshold}
          onChange={(e) => updateSettings({ confidenceThreshold: Number(e.target.value) })}
        />
        <div style={{ fontSize: 11, color: "var(--axon-muted)", marginTop: 4 }}>
          Transcripts below this score are treated as tentative.
        </div>
      </div>
    </div>
  );
}
