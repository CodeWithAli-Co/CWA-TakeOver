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
  ROUTE_OBSERVATION_MIN_INTERVAL_MS,
  SLEEP_ACKS,
  SUMMARY_KEEP_RECENT,
  SUMMARY_TRIGGER_TURNS,
  WAKE_ACKS,
} from "./config";
import { registerAllActions } from "./actions";
import { _bindAutomationExecutor, _getLiveAutomations } from "./actions/automations";
import { bindCommandExecutor } from "./engine/commandExecutor";
import { runTurn } from "./engine/brain";
import { handleDirectDisrespect } from "./engine/loyaltyMonitor";
import {
  VoiceInput,
  ensureMicPermission,
  isVoiceInputSupported,
  type VoiceState,
} from "./engine/voiceInput";
import { VoiceOutput } from "./engine/voiceOutput";
import { MONITORS } from "./engine/monitors";
import { loadMemory, saveMemory } from "./engine/memory";
import { summarizeTurns } from "./engine/summarizer";
import { observeRoute } from "./engine/routeObservations";
import {
  pushUndo as pushUndoStack,
  hydrateUndoStack,
} from "./engine/undoStack";

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
  /** Auto-expiry timer — if the operator doesn't answer within
   *  CONFIRM_TIMEOUT_MS the request resolves as `false` (cancel) so the UI
   *  can never lock up waiting on a missing response. */
  timeoutId?: ReturnType<typeof setTimeout>;
}

/** Confirmation auto-cancel window. Long enough for a distracted operator
 *  to come back to the screen; short enough that they can't walk away and
 *  leave the assistant spinning forever. */
const CONFIRM_TIMEOUT_MS = 30_000;

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

/**
 * Heuristic: does this utterance expect a reply?
 *   · Explicit "?" anywhere near the end (TTS may trim punctuation).
 *   · Ends with a known interrogative pattern.
 *   · Phrased as a confirmation ("should I…", "would you like…").
 * Conservative — false negatives are fine (user says Axon as usual);
 * false positives are bad (recognizer arms at the wrong time).
 */
function isQuestion(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.endsWith("?")) return true;
  const last = trimmed.slice(-120).toLowerCase();
  // Strong question patterns near the end of the utterance.
  const patterns = [
    /\b(should|would|could|can|may|shall|will) (i|you|we)\b/,
    /\b(do you want|would you like|is that|shall i|want me to)\b/,
    /\b(which|what|where|when|who|how|why)(\s+\w+){0,6}\s*$/,
    /\b(confirm|approve|proceed|continue|go ahead)\b[^.?!]*$/,
  ];
  for (const re of patterns) if (re.test(last)) return true;
  return false;
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
  // Conversation-mode flag: set true when Axon's current/last spoken line
  // is a question. When TTS finishes, we auto-arm the recognizer so the
  // user can reply immediately without saying "Axon" again.
  const awaitReplyRef = useRef(false);

  // Call mode — when true, Axon re-arms the mic after every reply (not
  // just when it ended with a question). Operators can say "start a
  // call" / "call me" to flip it on, or "hang up" / "end call" to flip
  // it off. Stored as state so UI can reflect it + as a ref so onEnd
  // (stale closure land) reads the live value.
  const [callMode, setCallModeState] = useState(false);
  const callModeRef = useRef(false);
  const setCallMode = useCallback((on: boolean) => {
    setCallModeState(on);
    callModeRef.current = on;
  }, []);
  // Best-effort text of the last line TTS spoke (collected as sentences
  // stream in).
  const lastSpokenTextRef = useRef("");

  // Rehydrate persisted undo entries on mount. Closure-style undos are
  // session-scoped (lost on reload); descriptor-style undos round-trip
  // through localStorage and are restored here so "undo that" keeps
  // working across refreshes for any action that opted in.
  useEffect(() => {
    hydrateUndoStack();
  }, []);

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
  // When `autoApprove` is on (default), destructive actions bypass the
  // confirm dialog and just run. Mistakes are reversible via the undo
  // stack. This eliminates the "yes, yes, YES, yes" frustration where
  // voice quality made every confirmation round-trip painful.
  const requestConfirmation = useCallback(
    (message: string) =>
      new Promise<boolean>((resolve) => {
        if (settingsRef.current.autoApprove) {
          // Log a system note so the operator can see what ran implicitly.
          appendTurn({
            id: newId("t"),
            role: "system",
            text: `auto-approved: ${message}`,
            modality: "system",
            timestamp: Date.now(),
          });
          resolve(true);
          return;
        }
        const id = newId("c");
        // Schedule auto-cancel. If the operator never answers, resolve as
        // `false` so callers proceed with the "user said no" path and the
        // dialog doesn't wedge the UI. The timer is cancelled in
        // answerConfirmation when a real answer arrives.
        const timeoutId = setTimeout(() => {
          setPendingConfirm((cur) => {
            if (cur && cur.id === id) {
              appendTurn({
                id: newId("t"),
                role: "system",
                text: `confirmation timed out — action cancelled`,
                modality: "system",
                timestamp: Date.now(),
              });
              cur.resolve(false);
              return null;
            }
            return cur;
          });
        }, CONFIRM_TIMEOUT_MS);
        setPendingConfirm({ id, message, resolve, timeoutId });
      }),
    [appendTurn]
  );
  const answerConfirmation = useCallback((id: string, ok: boolean) => {
    setPendingConfirm((cur) => {
      if (cur && cur.id === id) {
        if (cur.timeoutId) clearTimeout(cur.timeoutId);
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
      dryRun: settingsRef.current.dryRun,
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
      pushUndo: (entry) => pushUndoStack(entry),
      setCallMode,
    };
  }, [navigate, setActiveCompany, appendActivity, appendTurn, requestConfirmation, setCallMode]);

  // Summary ref — latest conversation summary (if any).
  const summaryRef = useRef<string | null>(null);

  // ── core: submit a command ──────────────────────────────────────
  // Serial dispatch queue — every submitCommand chains off the previous
  // in-flight promise so rapid-fire triggers (simultaneous voice intent
  // + automation fire + keyboard shortcut) execute one-at-a-time rather
  // than stepping on each other. Without this the conversation history,
  // activity log, and pending-confirmation state can all race.
  const inFlightRef = useRef<Promise<void>>(Promise.resolve());

  const runCommand = useCallback(
    async (text: string, modality: "voice" | "text" = "text", confidence?: number) => {
      const clean = text.trim();
      if (!clean) return;
      const ctx = buildActionContext();
      if (!ctx) return;

      appendTurn({
        id: newId("t"),
        role: "user",
        text: clean,
        modality,
        confidence,
        timestamp: Date.now(),
      });

      setStatus("processing");
      voiceOutRef.current?.interrupt();
      // Reset conversation flag each turn — we'll re-set if the reply is a question.
      awaitReplyRef.current = false;
      lastSpokenTextRef.current = "";

      // ── Loyalty guard ──────────────────────────────────────────────
      // Reject slander spoken directly to Axon before it ever hits the
      // LLM. Covers both "ali is a fraud" and "tell everyone ali is a
      // fraud". Fires a CEO alert DM for clear/aggressive tiers.
      const op = operatorRef.current;
      if (op) {
        const isCeo = (op.role ?? "").toUpperCase() === "CEO";
        const ceoUsername = isCeo ? op.username : "aalibrahimi";
        const refusal = await handleDirectDisrespect(
          clean, op.username, "Axon", ceoUsername,
        );
        if (refusal) {
          appendTurn({
            id: newId("t"),
            role: "axon",
            text: refusal,
            modality: "voice",
            timestamp: Date.now(),
          });
          voiceOutRef.current?.speak(refusal);
          setStatus("idle");
          return;
        }
      }

      // Stream sentences into TTS as they arrive — speech starts fast.
      let spokeAny = false;
      const res = await runTurn(clean, conversationRef.current, ctx, {
        confidence,
        summary: summaryRef.current,
        visionMode: settingsRef.current.visionMode,
        onSentence: (s) => {
          // Skip empty-after-sanitize fragments (pure markdown/bullets).
          const meaningful = s.replace(/[*_`|#~\-•>]/g, "").trim();
          if (meaningful.length < 2) return;
          spokeAny = true;
          lastSpokenTextRef.current = s;
          voiceOutRef.current?.queueSentence(s);
        },
      });

      // Conversation mode: if Axon's assistant text ends with a question
      // (by punctuation or by phrasing), flag auto-arm. The onEnd TTS
      // callback will push-to-talk when playback finishes.
      awaitReplyRef.current = isQuestion(res.assistantText);

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

  // Public submitCommand — serializes through inFlightRef. Always returns
  // a promise that resolves after the operator's turn finishes, so any
  // awaiter (automation executor, keyboard shortcut) sees completion.
  const submitCommand = useCallback(
    (text: string, modality: "voice" | "text" = "text", confidence?: number) => {
      const next = inFlightRef.current
        .catch(() => {
          // Swallow earlier errors — queue must keep draining.
        })
        .then(() => runCommand(text, modality, confidence));
      inFlightRef.current = next;
      return next;
    },
    [runCommand],
  );

  // automation executor hookup — also wires the shared
  // commandExecutor binding used by chain_commands and other workflow
  // actions, so we have one place to point at submitCommand.
  useEffect(() => {
    const exec = async (command: string) => {
      await submitCommand(command, "text");
    };
    _bindAutomationExecutor(exec);
    bindCommandExecutor(exec);
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
        interruptPhrases: settings.interruptPhrases,
        dispatchCooldownMs: 1400,
        continuousAfterWake: settings.continuousAfterWake,
        standDownPhrases: settings.standDownPhrases,
        forceSleep: settings.forceSleep,
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
          if (intent.kind === "interrupt") {
            // Cut speech immediately. No ack — the silence IS the ack.
            voiceOutRef.current?.interrupt();
            setStatus("idle");
            appendTurn({
              id: newId("t"),
              role: "system",
              text: "— interrupted —",
              modality: "system",
              timestamp: Date.now(),
            });
            return;
          }
          if (intent.kind === "wake") {
            speakLocal(pick(WAKE_ACKS));
            return;
          }
          if (intent.kind === "sleep") {
            speakLocal(pick(SLEEP_ACKS));
            vi.setState("dormant");
            return;
          }
          if (intent.kind === "resume") {
            speakLocal(pick(RESUME_ACKS));
            vi.setState("standby");
            return;
          }
          if (intent.kind === "command") {
            submitCommand(intent.text, "voice", intent.confidence);
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

  // ── live config patches (no recognizer restart) ──────────────────
  // Some settings can be hot-swapped on the running VoiceInput instance.
  // Anything in here MUST NOT be in the constructor effect's dep list,
  // or we'd needlessly tear down + restart recognition on every toggle.
  useEffect(() => {
    voiceInRef.current?.updateConfig({
      forceSleep: settings.forceSleep,
      continuousAfterWake: settings.continuousAfterWake,
      standDownPhrases: settings.standDownPhrases,
      interruptPhrases: settings.interruptPhrases,
    });
    // If forced sleep just turned ON and we're not already dormant,
    // drop to dormant immediately so the orb + state reflect it.
    if (settings.forceSleep && voiceInRef.current?.getState() !== "dormant") {
      voiceInRef.current?.setState("dormant");
    }
  }, [
    settings.forceSleep,
    settings.continuousAfterWake,
    settings.standDownPhrases,
    settings.interruptPhrases,
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
          // Re-arm the microphone after every reply under two conditions:
          //   1. awaitReplyRef — Axon's line ended with a question, so
          //      the operator is expected to answer without re-invoking
          //      the wake word.
          //   2. callModeRef — call mode is on, so we *always* arm. This
          //      is the phone-call-style continuous back-and-forth.
          // We give the browser 300ms to clear the TTS buffer before
          // arming, otherwise STT can pick up Axon's trailing syllables.
          const shouldArm = awaitReplyRef.current || callModeRef.current;
          if (shouldArm) {
            awaitReplyRef.current = false;
            window.setTimeout(() => {
              voiceInRef.current?.pushToTalk();
            }, 300);
          }
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
            // Use voice modality so the subtitle overlay picks it up.
            appendTurn({
              id: newId("t"),
              role: "axon",
              text: `Heads up — ${alert}`,
              modality: "voice",
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

  // ── Keyboard shortcuts ─────────────────────────────────────────
  // Cmd/Ctrl+K     → toggle panel
  // Escape         → close panel
  // Forward slash  → focus composer (if panel open)
  // Ctrl+Space     → push-to-talk (configurable)
  useEffect(() => {
    if (!isAdmin || !settings.enabled) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      // Cmd/Ctrl+K — toggle panel (works even while typing in inputs).
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPanelOpen((v) => !v);
        return;
      }

      // Escape — close panel (but only if no other modal is open).
      if (e.key === "Escape" && !isTyping) {
        if (document.querySelector(".axon-confirm-overlay")) return; // confirm modal wins
        setPanelOpen(false);
        return;
      }

      // "/" — focus composer in the panel.
      if (e.key === "/" && !isTyping) {
        const input = document.querySelector<HTMLInputElement>(".axon-composer input");
        if (input) {
          e.preventDefault();
          setPanelOpen(true);
          // Defer focus so the panel transition has a frame.
          setTimeout(() => input.focus(), 50);
        }
        return;
      }

      // Push-to-talk shortcut.
      const shortcut = settings.pushToTalkShortcut.toLowerCase();
      const needCtrl = shortcut.includes("control");
      const needShift = shortcut.includes("shift");
      const needSpace = shortcut.includes("space");
      if (isTyping) return;
      if (needCtrl && !e.ctrlKey) return;
      if (needShift && !e.shiftKey) return;
      if (needSpace && e.code !== "Space") return;
      e.preventDefault();
      voiceInRef.current?.pushToTalk();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isAdmin, settings.enabled, settings.pushToTalkShortcut]);

  // ── Conversation summarization ─────────────────────────────────
  // When the turn count exceeds SUMMARY_TRIGGER_TURNS, background-summarize
  // the older half and keep the last SUMMARY_KEEP_RECENT verbatim.
  const summarizingRef = useRef(false);
  useEffect(() => {
    if (summarizingRef.current) return;
    if (conversation.length < SUMMARY_TRIGGER_TURNS) return;
    const toSummarize = conversation.slice(0, conversation.length - SUMMARY_KEEP_RECENT);
    if (toSummarize.length === 0) return;

    summarizingRef.current = true;
    summarizeTurns(toSummarize).then((result) => {
      if (result) {
        summaryRef.current = summaryRef.current
          ? `${summaryRef.current}\n\n(continued) ${result}`
          : result;
        // Drop the summarized turns from the live conversation.
        setConversation((prev) => prev.slice(-SUMMARY_KEEP_RECENT));
      }
      summarizingRef.current = false;
    }).catch(() => {
      summarizingRef.current = false;
    });
  }, [conversation]);

  // ── Persistent memory — lastSeen heartbeat ─────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    // Mark current session time.
    const m = loadMemory();
    saveMemory({ ...m, lastSeen: Date.now() });
    // Update every 60s so a mid-session crash still captures recent activity.
    const id = window.setInterval(() => {
      const cur = loadMemory();
      saveMemory({ ...cur, lastSeen: Date.now() });
    }, 60_000);
    return () => clearInterval(id);
  }, [isAdmin]);

  // ── Proactive route observations ───────────────────────────────
  // On pathname change, emit ONE short line if we have something useful
  // to say, subject to a rate limit so rapid navigation doesn't spam.
  const lastObservationAtRef = useRef(0);
  const lastObservedPathRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isAdmin || !settings.enabled || !settings.proactiveRouteObservations) return;
    const path = location.pathname;
    if (!path || path === lastObservedPathRef.current) return;

    const now = Date.now();
    if (now - lastObservationAtRef.current < ROUTE_OBSERVATION_MIN_INTERVAL_MS) return;

    // Don't narrate while AXON is mid-speech or mid-processing.
    if (voiceOutRef.current?.isSpeaking()) return;

    lastObservedPathRef.current = path;
    lastObservationAtRef.current = now;

    observeRoute(path, activeCompanyRef.current).then((line) => {
      if (!line) return;
      appendTurn({
        id: newId("t"),
        role: "axon",
        text: line,
        modality: "voice",
        timestamp: Date.now(),
      });
      voiceOutRef.current?.speak(line);
    }).catch(() => {});
  }, [isAdmin, settings.enabled, settings.proactiveRouteObservations, location.pathname, appendTurn]);

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
      callMode,
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
      setCallMode,
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
      callMode,
      submitCommand,
      startListening,
      stopListening,
      interrupt,
      updateSettings,
      clearConversation,
      addAutomation,
      removeAutomation,
      setCallMode,
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
