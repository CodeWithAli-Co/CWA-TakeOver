// ───────────────────────────────────────────────────────────────────
// AxonProvider v2 — sovereign context with state machine + auto-greet.
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
  AUTO_GREET_DELAY_MS,
  AXON_ALLOWED_ROLES,
  AXON_SETTINGS_KEY,
  MAX_CONVERSATION_TURNS,
  NARRATION_DELAY_MS,
  RESUME_ACKS,
  SLEEP_ACKS,
  WAKE_ACKS,
} from "./config";
import { registerAllActions } from "./actions";
import { _bindAutomationExecutor, _getLiveAutomations } from "./actions/automations";
import { runTurn } from "./engine/brain";
import {
  VoiceInput,
  ensureMicPermission,
  isVoiceInputSupported,
  type VoiceState,
} from "./engine/voiceInput";
import { VoiceOutput } from "./engine/voiceOutput";
import { MONITORS } from "./engine/monitors";

registerAllActions();

// ── Persistence ──────────────────────────────────────────────────
function loadPersistedSettings(): AxonSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(AXON_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
function persistSettings(s: AxonSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AXON_SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

// ── Confirmation queue ──────────────────────────────────────────
interface ConfirmRequest {
  id: string;
  message: string;
  resolve: (ok: boolean) => void;
}

const AxonContext = createContext<AxonContextValue | null>(null);
interface ConfirmContextValue {
  pending: ConfirmRequest | null;
  answer: (id: string, ok: boolean) => void;
}
const ConfirmContext = createContext<ConfirmContextValue | null>(null);

// ── Helpers ─────────────────────────────────────────────────────
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─────────────────────────────────────────────────────────────────
export function AxonProvider({ children }: { children: React.ReactNode }) {
  const { data: userRows } = ActiveUser();
  const user = userRows?.[0];
  const { activeCompany, setActiveCompany } = useCompanyFilter();
  const navigate = useNavigate();
  const location = useLocation();

  // ── state ──────────────────────────────────────────────────────
  const [status, setStatus] = useState<AxonStatus>("idle");
  const [voiceState, setVoiceState] = useState<VoiceState>("standby");
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
    return !!role && (AXON_ALLOWED_ROLES as readonly string[]).includes(role);
  }, [user?.role]);

  // refs for engine layers
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
  const voiceStateRef = useRef<VoiceState>(voiceState);
  voiceStateRef.current = voiceState;

  const voiceInRef = useRef<VoiceInput | null>(null);
  const voiceOutRef = useRef<VoiceOutput | null>(null);
  const greetedRef = useRef(false);

  // orb default position
  useEffect(() => {
    if (orbPosition.y === 0) {
      setOrbPosition({
        x: Math.max(24, window.innerWidth - 104),
        y: Math.max(24, window.innerHeight - 120),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── conversation/activity helpers ───────────────────────────────
  const appendTurn = useCallback((turn: ConversationTurn) => {
    setConversation((prev) => {
      const next = [...prev, turn];
      if (next.length > MAX_CONVERSATION_TURNS)
        next.splice(0, next.length - MAX_CONVERSATION_TURNS);
      return next;
    });
  }, []);

  const appendActivity = useCallback(
    (entry: Omit<ExecutedAction, "id" | "timestamp">) => {
      setActivity((prev) => [
        ...prev,
        { ...entry, id: newId("a"), timestamp: Date.now() },
      ]);
    },
    []
  );

  // ── confirmation ─────────────────────────────────────────────────
  const requestConfirmation = useCallback(
    (message: string) =>
      new Promise<boolean>((resolve) => {
        setPendingConfirm({ id: newId("c"), message, resolve });
      }),
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

  // ── action context ──────────────────────────────────────────────
  const buildActionContext = useCallback((): ActionContext | null => {
    const op = operatorRef.current;
    if (!op) return null;
    return {
      operator: op,
      activeCompany: activeCompanyRef.current,
      currentPath: pathRef.current,
      navigate: (to: string) => navigate({ to: to as any }),
      setActiveCompany: (c) => setActiveCompany(c),
      speak: (text: string) => voiceOutRef.current?.speak(text),
      note: (text: string) =>
        appendTurn({
          id: newId("t"),
          role: "system",
          text,
          modality: "system",
          timestamp: Date.now(),
        }),
      logActivity: appendActivity,
      requestConfirmation,
    };
  }, [navigate, setActiveCompany, appendActivity, appendTurn, requestConfirmation]);

  // ── core: submit a command ──────────────────────────────────────
  const submitCommand = useCallback(
    async (text: string, modality: "voice" | "text" = "text") => {
      const clean = text.trim();
      if (!clean) return;
      const ctx = buildActionContext();
      if (!ctx) return;

      appendTurn({
        id: newId("t"),
        role: "user",
        text: clean,
        modality,
        timestamp: Date.now(),
      });

      setStatus("processing");
      voiceOutRef.current?.interrupt();

      // Stream sentences into TTS as they arrive — speech starts fast.
      let spokeAny = false;
      const res = await runTurn(clean, conversationRef.current, ctx, {
        onSentence: (s) => {
          // Skip empty-after-sanitize fragments (pure markdown/bullets).
          const meaningful = s.replace(/[*_`|#~\-•>]/g, "").trim();
          if (meaningful.length < 2) return;
          spokeAny = true;
          voiceOutRef.current?.queueSentence(s);
        },
      });

      appendTurn({
        id: newId("t"),
        role: "axon",
        text: res.assistantText,
        modality: "voice",
        timestamp: Date.now(),
        actions: res.actions,
      });

      if (res.detail) {
        appendTurn({
          id: newId("t"),
          role: "system",
          text: res.detail,
          modality: "system",
          timestamp: Date.now(),
        });
      }

      // Fallback for fallbackText / very-short replies that didn't trip
      // the sentence streamer (e.g. missing API key).
      if (!spokeAny && res.assistantText) {
        setTimeout(() => {
          voiceOutRef.current?.speak(res.assistantText);
        }, NARRATION_DELAY_MS);
      }
    },
    [appendTurn, buildActionContext]
  );

  // automation executor hookup
  useEffect(() => {
    _bindAutomationExecutor(async (command) => {
      await submitCommand(command, "text");
    });
  }, [submitCommand]);

  // live automation poll
  useEffect(() => {
    const t = window.setInterval(() => setAutomations(_getLiveAutomations()), 2000);
    return () => clearInterval(t);
  }, []);

  // ── speak without going through the brain (used for wake/sleep acks) ──
  const speakLocal = useCallback((text: string, roleLabel: "axon" | "system" = "axon") => {
    appendTurn({
      id: newId("t"),
      role: roleLabel,
      text,
      modality: roleLabel === "axon" ? "voice" : "system",
      timestamp: Date.now(),
    });
    setStatus("speaking");
    voiceOutRef.current?.speak(text).then(() => setStatus("idle")).catch(() => setStatus("idle"));
  }, [appendTurn]);

  // ── voice input wiring ──────────────────────────────────────────
  useEffect(() => {
    if (!settings.enabled || !isAdmin) {
      voiceInRef.current?.stop();
      return;
    }
    if (!isVoiceInputSupported()) {
      console.warn("[AXON] Web Speech Recognition is not available in this WebView.");
      return;
    }

    let cancelled = false;

    // Explicitly request mic permission BEFORE starting recognition.
    // In Tauri WebView, if the user has never been prompted, recognition.start()
    // may silently fail. getUserMedia reliably triggers the permission dialog.
    if (settings.alwaysListening) {
      ensureMicPermission().then((result) => {
        if (cancelled) return;
        if (result !== "granted") {
          console.warn(`[AXON] Mic permission: ${result}. Push-to-talk still works.`);
          appendTurn({
            id: newId("t"),
            role: "system",
            text:
              result === "denied"
                ? "Microphone access was denied — voice activation is off. Grant mic permission in your OS settings, or use Ctrl+Space as a fallback."
                : "Microphone is unavailable in this environment — Ctrl+Space still works.",
            modality: "system",
            timestamp: Date.now(),
          });
        }
      });
    }

    const vi = new VoiceInput(
      {
        wakeWord: settings.wakeWord,
        sleepPhrases: settings.sleepPhrases,
        resumePhrases: settings.resumePhrases,
        dispatchCooldownMs: 1400,
      },
      {
        onStart: () => {
          // Only show "listening" visually when armed — keeps the orb honest.
          if (voiceStateRef.current === "armed") setStatus("listening");
        },
        onStop: () => setLiveTranscript(""),
        onTranscript: (t) => setLiveTranscript(t),
        onStateChange: (s) => {
          setVoiceState(s);
          setStatus((cur) => {
            // Orb reflects voice state when idle-ish.
            if (cur === "speaking" || cur === "processing") return cur;
            return s === "armed" ? "listening" : "idle";
          });
        },
        onAudioLevel: (lvl) => setAudioLevel(lvl),
        onIntent: (intent) => {
          setLiveTranscript("");
          if (intent.kind === "wake") {
            speakLocal(pick(WAKE_ACKS));
            return;
          }
          if (intent.kind === "sleep") {
            speakLocal(pick(SLEEP_ACKS));
            // Move into dormant; continuous mic stays on but only resume words act.
            vi.setState("dormant");
            return;
          }
          if (intent.kind === "resume") {
            speakLocal(pick(RESUME_ACKS));
            vi.setState("standby");
            return;
          }
          if (intent.kind === "command") {
            submitCommand(intent.text, "voice");
          }
        },
        onError: (msg) => console.warn("[AXON] voice input:", msg),
      }
    );
    voiceInRef.current = vi;
    if (settings.alwaysListening) vi.start();
    return () => {
      cancelled = true;
      vi.stop();
      voiceInRef.current = null;
    };
  }, [
    isAdmin,
    settings.enabled,
    settings.alwaysListening,
    settings.wakeWord,
    settings.sleepPhrases,
    settings.resumePhrases,
    speakLocal,
    submitCommand,
    appendTurn,
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
        onStart: () => {
          // Mute recognition while AXON speaks — kill the self-listening loop.
          voiceInRef.current?.setMuted(true);
          setStatus("speaking");
        },
        onEnd: () => {
          voiceInRef.current?.setMuted(false);
          setStatus("idle");
        },
        onError: (msg) => {
          voiceInRef.current?.setMuted(false);
          console.warn("[AXON] voice output:", msg);
        },
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

  // ── auto-greet on first mount ───────────────────────────────────
  // Direct local greeting — no brain round-trip. Guaranteed to fire and
  // speak even if the API is down. Fires ONCE per session, regardless of
  // any dependency churn.
  useEffect(() => {
    if (greetedRef.current) return;
    if (!isAdmin || !settings.enabled || !settings.autoGreet) return;
    const op = operatorRef.current;
    if (!op) return;

    greetedRef.current = true;

    const firstName = (op.username || "").split(/[\s.]/)[0] || op.username || "";
    const greetings = [
      `Welcome back${firstName ? ", " + firstName : ""}. Standing by.`,
      `Hey${firstName ? ", " + firstName : ""}. Ready when you are.`,
      `Good to see you${firstName ? ", " + firstName : ""}. Say the word.`,
      `I'm here${firstName ? ", " + firstName : ""}. What's the move?`,
    ];
    const line = greetings[Math.floor(Math.random() * greetings.length)];

    // NOTE: deliberately NOT returning a cleanup that clears this timer.
    // If a dependency changes during the 1.6s window, the greet still fires.
    window.setTimeout(() => {
      appendTurn({
        id: newId("t"),
        role: "axon",
        text: line,
        modality: "voice",
        timestamp: Date.now(),
      });
      voiceOutRef.current?.speak(line);
    }, AUTO_GREET_DELAY_MS);
  }, [isAdmin, settings.enabled, settings.autoGreet, appendTurn]);

  // ── monitors ────────────────────────────────────────────────────
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
              id: newId("t"),
              role: "axon",
              text: `Heads up — ${alert}`,
              modality: "system",
              timestamp: Date.now(),
            });
            voiceOutRef.current?.speak(`Heads up. ${alert}`);
          }
        } catch (e) {
          console.warn("[AXON] monitor:", e);
        }
      };
      const t = window.setInterval(fire, m.intervalMs);
      cancels.push(() => clearInterval(t));
    }
    return () => cancels.forEach((c) => c());
  }, [
    isAdmin,
    settings.enabled,
    settings.enabledMonitors,
    buildActionContext,
    appendTurn,
  ]);

  // ── PTT fallback (still supported) ──────────────────────────────
  useEffect(() => {
    if (!isAdmin || !settings.enabled) return;
    const handler = (e: KeyboardEvent) => {
      const needCtrl = settings.pushToTalkShortcut.toLowerCase().includes("control");
      const needSpace = settings.pushToTalkShortcut.toLowerCase().includes("space");
      if (needCtrl && !e.ctrlKey) return;
      if (needSpace && e.code !== "Space") return;
      // Don't steal typing.
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      e.preventDefault();
      voiceInRef.current?.pushToTalk();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isAdmin, settings.enabled, settings.pushToTalkShortcut]);

  // ── public ops ──────────────────────────────────────────────────
  const updateSettings = useCallback((patch: Partial<AxonSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persistSettings(next);
      return next;
    });
  }, []);
  const startListening = useCallback(() => voiceInRef.current?.pushToTalk(), []);
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
  const addAutomation: AxonContextValue["addAutomation"] = useCallback((a) => ({
    ...a,
    id: newId("auto"),
    createdAt: Date.now(),
    nextFire: Date.now() + a.intervalMs,
  }), []);
  const removeAutomation = useCallback((_id: string) => {}, []);

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
      voiceState,
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
      voiceState,
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
