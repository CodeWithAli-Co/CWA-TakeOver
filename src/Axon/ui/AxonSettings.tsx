// ───────────────────────────────────────────────────────────────────
// Settings pane — rendered inside the panel as a tab.
// ───────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useAxon } from "../AxonProvider";
import { getAvailableVoices } from "../engine/voiceOutput";
import { MONITORS } from "../engine/monitors";

export function AxonSettingsPane() {
  const { settings, updateSettings, automations } = useAxon();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    getAvailableVoices().then(setVoices);
  }, []);

  return (
    <div style={{ padding: 4 }}>
      {/* Master */}
      <div className="axon-settings-group">
        <label className="axon-settings-label">MASTER</label>
        <div className="axon-settings-row">
          <span>AXON enabled</span>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => updateSettings({ enabled: e.target.checked })}
          />
        </div>
        <div className="axon-settings-row">
          <span>Always-on listening</span>
          <input
            type="checkbox"
            checked={settings.alwaysListening}
            onChange={(e) => updateSettings({ alwaysListening: e.target.checked })}
          />
        </div>
      </div>

      {/* Wake word + shortcut */}
      <div className="axon-settings-group">
        <label className="axon-settings-label">WAKE WORD & SHORTCUT</label>
        <label className="axon-settings-label" style={{ fontSize: 10 }}>Wake word</label>
        <input
          className="axon-settings-input"
          value={settings.wakeWord}
          onChange={(e) => updateSettings({ wakeWord: e.target.value })}
        />
        <div style={{ height: 8 }} />
        <label className="axon-settings-label" style={{ fontSize: 10 }}>Push-to-talk shortcut</label>
        <input
          className="axon-settings-input"
          value={settings.pushToTalkShortcut}
          onChange={(e) => updateSettings({ pushToTalkShortcut: e.target.value })}
          placeholder="e.g. Control+Space"
        />
      </div>

      {/* Voice */}
      <div className="axon-settings-group">
        <label className="axon-settings-label">VOICE</label>
        <label className="axon-settings-label" style={{ fontSize: 10 }}>Preferred voice</label>
        <select
          className="axon-settings-select"
          value={settings.preferredVoice ?? ""}
          onChange={(e) =>
            updateSettings({ preferredVoice: e.target.value || null })
          }
        >
          <option value="">Auto — best deep male voice</option>
          {voices.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name} · {v.lang}
            </option>
          ))}
        </select>

        <div style={{ height: 10 }} />
        <label className="axon-settings-label" style={{ fontSize: 10 }}>
          Rate {settings.rate.toFixed(2)}
        </label>
        <input
          className="axon-settings-range"
          type="range"
          min="0.5"
          max="1.6"
          step="0.05"
          value={settings.rate}
          onChange={(e) => updateSettings({ rate: Number(e.target.value) })}
        />

        <label className="axon-settings-label" style={{ fontSize: 10 }}>
          Pitch {settings.pitch.toFixed(2)}
        </label>
        <input
          className="axon-settings-range"
          type="range"
          min="0.4"
          max="1.6"
          step="0.05"
          value={settings.pitch}
          onChange={(e) => updateSettings({ pitch: Number(e.target.value) })}
        />

        <label className="axon-settings-label" style={{ fontSize: 10 }}>
          Volume {settings.volume.toFixed(2)}
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

        <div style={{ height: 12 }} />
        <label className="axon-settings-label" style={{ fontSize: 10 }}>
          ElevenLabs voice id (optional)
        </label>
        <input
          className="axon-settings-input"
          value={settings.elevenLabsVoiceId ?? ""}
          placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
          onChange={(e) =>
            updateSettings({ elevenLabsVoiceId: e.target.value || null })
          }
        />
        <div style={{ fontSize: 11, color: "var(--axon-muted)", marginTop: 4 }}>
          Requires <code>VITE_ELEVENLABS_API_KEY</code> in env.
        </div>
      </div>

      {/* Monitors */}
      <div className="axon-settings-group">
        <label className="axon-settings-label">ANOMALY MONITORS</label>
        {MONITORS.map((m) => {
          const on = settings.enabledMonitors.includes(m.id);
          return (
            <div key={m.id} className="axon-settings-row">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>{m.label}</div>
                <div style={{ fontSize: 11, color: "var(--axon-muted)" }}>
                  {m.description}
                </div>
              </div>
              <input
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
        <label className="axon-settings-label">ACTIVE AUTOMATIONS (session)</label>
        {automations.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--axon-muted)" }}>
            None scheduled. Ask AXON: "schedule a reminder in 5 minutes".
          </div>
        ) : (
          automations.map((a) => (
            <div key={a.id} className="axon-activity-row">
              <div>
                <div>{a.description}</div>
                <div style={{ fontSize: 10, color: "var(--axon-muted)" }}>
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
          VOICE CONFIDENCE THRESHOLD {settings.confidenceThreshold.toFixed(2)}
        </label>
        <input
          className="axon-settings-range"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.confidenceThreshold}
          onChange={(e) =>
            updateSettings({ confidenceThreshold: Number(e.target.value) })
          }
        />
        <div style={{ fontSize: 11, color: "var(--axon-muted)" }}>
          Transcripts below this score will be treated as tentative.
        </div>
      </div>
    </div>
  );
}
