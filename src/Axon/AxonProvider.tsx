// ───────────────────────────────────────────────────────────────────
// AxonProvider — the sovereign context.
// Wires together: state, voice in, voice out, brain, executor, monitors.
// Exposes a single hook (`useAxon`) for UI layers.
// ───────────────────────────────────────────────────────────────────

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";

import { ActiveUser } from "@/stores/query";
import { useCompanyFilter, type CompanyFilter } from "@/stores/store";

import type {
  ActionContext,
  AxonContextValue,
  AxonSettings,
  AxonStatus,
  Automation,
  ConversationTurn,
  ExecutedAction,
  OperatorContext,
} from "./types";
import { DEFAULT_SETTINGS } from "./types";
import {
  AXON_ALLOWED_ROLES,
  AXON_SETTINGS_KEY,
  MAX_CONVERSATION_TURNS,
  NARRATION_DELAY_MS,
} from "./config";
import { registerAllActions } from "./actions";
import { _bindAutomationExecutor, _getLiveAutomations } from "./actions/automations";
import { runTurn } from "./engine/brain";
import { VoiceInput, isVoiceInputSupported } from "./engine/voiceInput";
import { VoiceOutput } from "./engine/voiceOutput";
import { MONITORS } from "./engine/monitors";

// ── Register actions at module load ───────────────────────────────
registerAllActions();

// ── Helper: persisted settings ─────────────────────────────────────
function loadPersistedSettings(): AxonSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(AXON_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function persistSettings(s: AxonSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AXON_SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

// ── Confirmation queue ─────────────────────────────────────────────
interface ConfirmRequest {
  id: string;
  message: string;
  resolve: (ok: boolean) => void;
}

const AxonContext = createContext<AxonContextValue | null>(null);

// Extra slice exposed to ConfirmDialog via its own hook.
interface ConfirmContextValue {
  pending: ConfirmRequest | null;
  answer: (id: string, ok: boolean) => void;
}
const ConfirmContext = createContext<ConfirmContextValue | null>(null);

// ──────────────────────────────────────────────────────────────────
export function AxonProvider({ children }: { children: React.ReactNode }) {
  const { data: userRows } = ActiveUser();
  const user = userRows?.[0];
  const { activeCompany, setActiveCompany } = useCompanyFilter();
  const navigate = useNavigate();
  const location = useLocation();

  // ── state ──────────────────────────────────────────────────────
  const [status, setStatus] = useState<AxonStatus>("idle");
  const [settings, setSettings] = useState<AxonSettings>(loadPersistedSettings);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [activity, setActivity] = useState<ExecutedAction[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [orbPosition, setOrbPosition] = useState({ x: 24, y: 0 });
  const [liveTranscript, setLiveTranscript] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [pendingConfirm, setPendingConfirm] = useState<ConfirmRequest | null>(null);
  const [automations, setAutomations] = useState<Automation[]>([]);

  const isAdmin = useMemo(() => {
    const role = user?.role;
    if (!role) return false;
    return (AXON_ALLOWED_ROLES as readonly string[]).includes(role);
  }, [user?.role]);

  // Always-current refs for the engine layers.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const activeCompanyRef = useRef<CompanyFilter>(activeCompany);
  activeCompanyRef.current = activeCompany;
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;
  const operatorRef = useRef<OperatorContext | null>(null);
  operatorRef.current = user
    ? { username: user.username, role: user.role, supa_id: user.supa_id }
    : null;
  const conversationRef = useRef<ConversationTurn[]>([]);
  conversationRef.current = conversation;

  // ── voice I/O instances ───────────────────────────────────────
  const voiceInRef = useRef<VoiceInput | null>(null);
  const voiceOutRef = useRef<VoiceOutput | null>(null);

  // orb bottom-right default position after first layout.
  useEffect(() => {
    if (orbPosition.y === 0) {
      setOrbPosition({
        x: Math.max(24, window.innerWidth - 104),
        y: Math.max(24, window.innerHeight - 104),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── conversation + activity helpers ─────────────────────────────
  const appendTurn = useCallback((turn: ConversationTurn) => {
    setConversation((prev) => {
      const next = [...prev, turn];
      if (next.length > MAX_CONVERSATION_TURNS) next.splice(0, next.length - MAX_CONVERSATION_TURNS);
      return next;
    });
  }, []);

  const appendActivity = useCallback((entry: Omit<ExecutedAction, "id" | "timestamp">) => {
    setActivity((prev) => [
      ...prev,
      {
        ...entry,
        id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  // ── confirmation flow ───────────────────────────────────────────
  const requestConfirmation = useCallback(
    (message: string): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        const id = `c-${Date.now()}`;
        setPendingConfirm({ id, message, resolve });
      });
    },
    []
  );

  const answerConfirmation = useCallback((id: string, ok: boolean) => {
    setPendingConfirm((cur) => {
      if (cur && cur.id === id) {
        cur.resolve(ok);
        return null;
      }
      return cur;
    });
  }, []);

  // ── core: assemble ActionContext on the fly ─────────────────────
  const buildActionContext = useCallback((): ActionContext | null => {
    const op = operatorRef.current;
    if (!op) return null;
    return {
      operator: op,
      activeCompany: activeCompanyRef.current,
      currentPath: pathRef.current,
      navigate: (to: string) => navigate({ to: to as any }),
      setActiveCompany: (c) => setActiveCompany(c),
      speak: (text: string) => {
        voiceOutRef.current?.speak(text);
      },
      note: (text: string) =>
        appendTurn({
          id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: "system",
          text,
          modality: "system",
          timestamp: Date.now(),
        }),
      logActivity: appendActivity,
      requestConfirmation,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, setActiveCompany, appendActivity, appendTurn, requestConfirmation]);

  // ── command dispatcher — the whole funnel ───────────────────────
  const submitCommand = useCallback(
    async (text: string, modality: "voice" | "text" = "text") => {
      const clean = text.trim();
      if (!clean) return;
      const ctx = buildActionContext();
      if (!ctx) return;

      appendTurn({
        id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: "user",
        text: clean,
        modality,
        timestamp: Date.now(),
      });

      setStatus("processing");
      voiceOutRef.current?.interrupt(); // stop any speaking

      const res = await runTurn(clean, conversationRef.current, ctx);

      const assistantTurn: ConversationTurn = {
        id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: "axon",
        text: res.assistantText,
        modality: "voice",
        timestamp: Date.now(),
        actions: res.actions,
      };
      appendTurn(assistantTurn);

      // Give the UI a breath before speaking so it feels intentional.
      setTimeout(() => {
        setStatus("speaking");
        voiceOutRef.current
          ?.speak(res.assistantText)
          .then(() => setStatus("idle"))
          .catch(() => setStatus("idle"));
      }, NARRATION_DELAY_MS);
    },
    [appendTurn, buildActionContext]
  );

  // ── bind automation executor (avoid circular import at module load) ─
  useEffect(() => {
    _bindAutomationExecutor(async (command, modality) => {
      await submitCommand(command, modality);
    });
  }, [submitCommand]);

  // Poll live automation list into React state.
  useEffect(() => {
    const t = window.setInterval(() => {
      setAutomations(_getLiveAutomations());
    }, 2000);
    return () => clearInterval(t);
  }, []);

  // ── voice input wiring ─────────────────────────────────────────
  useEffect(() => {
    if (!settings.enabled || !isAdmin) {
      voiceInRef.current?.stop();
      return;
    }
    if (!isVoiceInputSupported()) return;

    const vi = new VoiceInput(
      { wakeWord: settings.wakeWord, continuous: settings.alwaysListening },
      {
        onStart: () => setStatus((s) => (s === "idle" ? "listening" : s)),
        onStop: () => setLiveTranscript(""),
        onTranscript: (t, _f) => setLiveTranscript(t),
        onWake: () => {
          setStatus("listening");
          voiceOutRef.current?.interrupt();
        },
        onCommand: (t, confidence) => {
          setLiveTranscript("");
          if (settings.alwaysListening) setStatus("processing");
          // Low confidence + first-word command => ignore unless wake intent was clear.
          if (confidence < settings.confidenceThreshold && t.length < 6) return;
          submitCommand(t, "voice");
        },
        onAudioLevel: (lvl) => setAudioLevel(lvl),
        onError: (msg) => console.warn("[AXON] voice input:", msg),
      }
    );
    voiceInRef.current = vi;
    if (settings.alwaysListening) vi.start();
    return () => {
      vi.stop();
      voiceInRef.current = null;
    };
  }, [
    isAdmin,
    settings.enabled,
    settings.alwaysListening,
    settings.wakeWord,
    settings.confidenceThreshold,
    submitCommand,
  ]);

  // ── voice output wiring ─────────────────────────────────────────
  useEffect(() => {
    voiceOutRef.current = new VoiceOutput(
      {
        preferredVoice: settings.preferredVoice,
        rate: settings.rate,
        pitch: settings.pitch,
        volume: settings.volume,
        elevenLabsVoiceId: settings.elevenLabsVoiceId,
      },
      {
        onStart: () => setStatus("speaking"),
        onEnd: () => setStatus("idle"),
        onError: (msg) => console.warn("[AXON] voice output:", msg),
      }
    );
    return () => {
      voiceOutRef.current?.interrupt();
      voiceOutRef.current = null;
    };
  }, [
    settings.preferredVoice,
    settings.rate,
    settings.pitch,
    settings.volume,
    settings.elevenLabsVoiceId,
  ]);

  // ── monitors polling ───────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin || !settings.enabled || settings.enabledMonitors.length === 0) return;
    const ctx = buildActionContext();
    if (!ctx) return;

    const cancels: Array<() => void> = [];
    for (const mId of settings.enabledMonitors) {
      const m = MONITORS.find((x) => x.id === mId);
      if (!m) continue;
      const fire = async () => {
        try {
          const alert = await m.check(ctx);
          if (alert) {
            appendTurn({
              id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              role: "axon",
              text: `[${m.label}] ${alert}`,
              modality: "system",
              timestamp: Date.now(),
            });
            voiceOutRef.current?.speak(alert);
          }
        } catch (e) {
          console.warn("[AXON] monitor error:", e);
        }
      };
      const t = window.setInterval(fire, m.intervalMs);
      cancels.push(() => clearInterval(t));
    }
    return () => cancels.forEach((c) => c());
  }, [isAdmin, settings.enabled, settings.enabledMonitors, buildActionContext, appendTurn]);

  // ── push-to-talk global shortcut ───────────────────────────────
  useEffect(() => {
    if (!isAdmin || !settings.enabled) return;
    const handler = (e: KeyboardEvent) => {
      const needCtrl = settings.pushToTalkShortcut.toLowerCase().includes("control");
      const needSpace = settings.pushToTalkShortcut.toLowerCase().includes("space");
      if (needCtrl && !e.ctrlKey) return;
      if (needSpace && e.code !== "Space") return;
      e.preventDefault();
      voiceInRef.current?.pushToTalk((text) => {
        submitCommand(text, "voice");
      });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isAdmin, settings.enabled, settings.pushToTalkShortcut, submitCommand]);

  // ── public ops ─────────────────────────────────────────────────
  const updateSettings = useCallback((patch: Partial<AxonSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persistSettings(next);
      return next;
    });
  }, []);

  const startListening = useCallback(() => {
    voiceInRef.current?.pushToTalk((text, _c) => submitCommand(text, "voice"));
  }, [submitCommand]);

  const stopListening = useCallback(() => {
    voiceInRef.current?.stop();
    setStatus("idle");
  }, []);

  const interrupt = useCallback(() => {
    voiceOutRef.current?.interrupt();
    setStatus("idle");
  }, []);

  const clearConversation = useCallback(() => {
    setConversation([]);
    setActivity([]);
  }, []);

  const addAutomation: AxonContextValue["addAutomation"] = useCallback((a) => {
    const full: Automation = {
      ...a,
      id: `auto-${Date.now().toString(36)}`,
      createdAt: Date.now(),
      nextFire: Date.now() + a.intervalMs,
    };
    // The real scheduling is owned by the schedule_automation action.
    // This helper exists for programmatic/UI-added automations.
    return full;
  }, []);

  const removeAutomation = useCallback((_id: string) => {
    // UI-level cancel should go through the `cancel_automation` action.
  }, []);

  const value: AxonContextValue = useMemo(
    () => ({
      status,
      settings,
      conversation,
      activity,
      automations,
      panelOpen,
      orbPosition,
      liveTranscript,
      audioLevel,
      isAdmin,
      openPanel: () => setPanelOpen(true),
      closePanel: () => setPanelOpen(false),
      togglePanel: () => setPanelOpen((v) => !v),
      setOrbPosition,
      submitCommand,
      startListening,
      stopListening,
      interrupt,
      updateSettings,
      clearConversation,
      addAutomation,
      removeAutomation,
    }),
    [
      status,
      settings,
      conversation,
      activity,
      automations,
      panelOpen,
      orbPosition,
      liveTranscript,
      audioLevel,
      isAdmin,
      submitCommand,
      startListening,
      stopListening,
      interrupt,
      updateSettings,
      clearConversation,
      addAutomation,
      removeAutomation,
    ]
  );

  const confirmValue: ConfirmContextValue = useMemo(
    () => ({ pending: pendingConfirm, answer: answerConfirmation }),
    [pendingConfirm, answerConfirmation]
  );

  return (
    <AxonContext.Provider value={value}>
      <ConfirmContext.Provider value={confirmValue}>{children}</ConfirmContext.Provider>
    </AxonContext.Provider>
  );
}

export function useAxon(): AxonContextValue {
  const ctx = useContext(AxonContext);
  if (!ctx) throw new Error("useAxon must be used inside <AxonProvider>");
  return ctx;
}

export function useAxonConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useAxonConfirm must be used inside <AxonProvider>");
  return ctx;
}
