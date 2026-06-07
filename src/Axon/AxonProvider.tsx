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
import { setSimulationModeFlag } from "./engine/simulationFlag";
import {
  subscribeEnsemblePhase,
  type EnsemblePhase,
} from "./engine/ensemblePhase";
import {
  configureVisionLoop,
  startVisionLoop,
  stopVisionLoop,
} from "./engine/visionLoop";
import {
  configureFsWatcher,
  startFsWatcher,
  stopFsWatcher,
} from "./engine/fsWatcher";
import { configureDiary, startDiary, stopDiary } from "./engine/diary";

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
import { _bindVoicePrintAccessors } from "./actions/voiceauth";
import { _bindVoiceAccessors } from "./actions/voice";
import { _bindCodegenAccessors } from "./actions/code";
import { _bindProjectAccessors } from "./actions/projects";
import { _bindAgentAccessors } from "./actions/agent";
import { _bindEnsembleAccessors } from "./actions/ensemble";
import { _bindSleepAccessors } from "./actions/sleep";
import { _bindThemeAccessors } from "./actions/theme";
import { useThemeMode } from "@/stores/themeModeStore";
import { runTurn } from "./engine/brain";
import { handleDirectDisrespect } from "./engine/loyaltyMonitor";
import { getPersonalityTurnPayload } from "./personality/settings";
import { postProcessReply } from "./personality/postProcess";
import {
  VoiceInput,
  ensureMicPermission,
  isVoiceInputSupported,
  type VoiceState,
} from "./engine/voiceInput";
import { VoiceOutput } from "./engine/voiceOutput";
import { MONITORS } from "./engine/monitors";
import {
  loadMemory,
  saveMemory,
  appendSessionSummary,
} from "./engine/memory";
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

/**
 * Maps a mood tag from the personality engine\'s classifier to an
 * ElevenLabs v3 audio tag. Returns an empty string for neutral /
 * focused / undefined — those moods don\'t want explicit tonal
 * coloring (focused especially: a tag would impose a register the
 * user didn\'t ask for). Sad uses [sorrowful] because that\'s the
 * companion-friendly variant in the v3 palette per docs.
 */
function moodToTagPrefix(mood: string | undefined): string {
  switch (mood) {
    case "excited":    return "[excited] ";
    case "frustrated": return "[frustrated] ";
    case "tired":      return "[tired] ";
    case "sad":        return "[sorrowful] ";
    case "focused":
    case "neutral":
    default:           return "";
  }
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
  const [simulationMode, setSimulationModeState] = useState(false);
  const setSimulationMode = useCallback((on: boolean) => {
    setSimulationModeState(on);
    setSimulationModeFlag(on);
  }, []);

  // Ensemble phase — set by the engine as it cycles through Architect →
  // Engineer → Critic. We mirror the module-level signal into React
  // state so the Orb (and any other reactive surface) can render
  // role-specific colors and animations live.
  const [ensemblePhase, setEnsemblePhaseState] = useState<EnsemblePhase>(null);
  useEffect(() => {
    return subscribeEnsemblePhase((p) => setEnsemblePhaseState(p));
  }, []);

  // Continuous-vision loop. The loop module owns the timer + screenshot
  // + Anthropic call. We just give it an "isBusy" check (so it skips
  // ambient pings while Axon is mid-task) and toggle start/stop based
  // on the operator's settings flag.
  const statusRef = useRef<AxonStatus>("idle");
  statusRef.current = status;
  useEffect(() => {
    configureVisionLoop({
      isBusy: () => {
        const s = statusRef.current;
        return (
          s === "coding" ||
          s === "executing" ||
          s === "processing" ||
          s === "speaking"
        );
      },
    });
  }, []);
  // Toggle the loop on/off whenever the operator flips the setting.
  useEffect(() => {
    if (settings.continuousVision && settings.enabled) {
      startVisionLoop();
    } else {
      stopVisionLoop();
    }
    return () => stopVisionLoop();
  }, [settings.continuousVision, settings.enabled]);

  // ── Filesystem watcher (Week 5.2) ────────────────────────────────
  // Watches the active project's source tree for changes made outside
  // Axon (saving in VS Code, pulling a branch, etc.). The module owns
  // the Tauri fs subscription + per-path debounce; this effect just
  // toggles it based on the operator's setting and rebinds when the
  // active project changes.
  const activeProjectPath = useMemo(() => {
    const proj = settings.projects.find((p) => p.id === settings.activeProjectId);
    return proj?.path ?? null;
  }, [settings.projects, settings.activeProjectId]);
  useEffect(() => {
    configureFsWatcher({ activeRoot: () => activeProjectPath });
  }, [activeProjectPath]);
  useEffect(() => {
    if (settings.fsWatcher && settings.enabled && activeProjectPath) {
      void startFsWatcher();
    } else {
      stopFsWatcher();
    }
    return () => stopFsWatcher();
  }, [settings.fsWatcher, settings.enabled, activeProjectPath]);

  // ── Axon Diary (Week 6.1) ────────────────────────────────────────
  // Writes a Markdown reflection to the active project on every
  // session end. Same shape as the watcher / vision wiring: configure
  // the module with an active-project getter + enabled flag, then
  // start/stop the subscription. Default ON because the diary is a
  // free history log — it costs nothing if no sessions run.
  useEffect(() => {
    configureDiary({
      activeProjectPath: () => activeProjectPath,
      enabled: settings.diary && !!activeProjectPath,
    });
    if (settings.diary && settings.enabled) {
      startDiary();
    } else {
      stopDiary();
    }
    return () => stopDiary();
  }, [settings.diary, settings.enabled, activeProjectPath]);

  // CEO auto-enable for continuous vision + FS watcher. Default OFF
  // for everyone else (employees don't need to burn tokens watching a
  // Tasks page, and watcher events can be noisy on heavy refactors).
  // The CEO is different — he's running the business, both signals
  // are worth the cost. Auto-enable fires ONCE per setting per user
  // (per-supa-id localStorage flag). If the CEO turns either off
  // afterward, his choice sticks across reloads — we don't fight him.
  useEffect(() => {
    const supaId = user?.supa_id;
    const role = user?.role;
    if (!supaId || !role) return;
    if (role !== "CEO") return;

    type AutoFlag = {
      key: string;
      patch: () => Partial<AxonSettings>;
      already: (s: AxonSettings) => boolean;
    };
    const flags: AutoFlag[] = [
      {
        key: `cwa-axon-vision-auto-on-v1-${supaId}`,
        patch: () => ({ continuousVision: true }),
        already: (s) => s.continuousVision,
      },
      {
        key: `cwa-axon-fswatcher-auto-on-v1-${supaId}`,
        patch: () => ({ fsWatcher: true }),
        already: (s) => s.fsWatcher,
      },
    ];
    const toApply: AutoFlag[] = [];
    for (const f of flags) {
      let alreadyAutoEnabled = false;
      try {
        alreadyAutoEnabled = window.localStorage.getItem(f.key) === "1";
      } catch {
        // Private mode etc — bail on this flag.
        continue;
      }
      if (alreadyAutoEnabled) continue;
      // Stamp first so a re-render of this effect can't double-enable.
      try { window.localStorage.setItem(f.key, "1"); } catch { /* ignore */ }
      toApply.push(f);
    }
    if (toApply.length === 0) return;
    setSettings((prev) => {
      let next = prev;
      for (const f of toApply) {
        if (!f.already(next)) next = { ...next, ...f.patch() };
      }
      return next === prev ? prev : next;
    });
  }, [user?.supa_id, user?.role]);

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
      setStatus: (s) => setStatus(s),
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
      // Mute the mic for the entire turn — brain reasoning + tool calls +
      // TTS playback. Without this, background noise (or Axon's own voice
      // bleeding through echo cancellation) creates interim transcripts
      // while the orb is processing, and the early-dispatch path re-fires
      // the same command. Symptom: Axon repeats "let me find the file
      // first" multiple times. The voice output's onStart/onEnd will
      // keep this state during speech; the finally below restores it if
      // no TTS was queued (e.g. silent action). Interrupt phrases still
      // work — they're checked before the muted gate in handleFinal.
      voiceInRef.current?.setMuted(true);
      let queuedSpeech = false;
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
      // Voice-print gate: if enrolled and the gate is on, build the
      // verifier descriptor here so the executor can snapshot the
      // speaker before any mutating action.
      const gate =
        settingsRef.current.voicePrintGate && settingsRef.current.voicePrint
          ? {
              vector: settingsRef.current.voicePrint,
              threshold: settingsRef.current.voicePrintThreshold,
            }
          : undefined;
      // Personality engine payload — LIVE-reads the
      // axon:settings:personalityEnabled flag every turn so flips
      // are picked up without reload. When flag is false, returns
      // {} and brain.ts emits the 1-block cached system unchanged.
      const personalityPayload = getPersonalityTurnPayload({
        userName: op?.username,
        latestUserMessage: clean,
      });

      // First-sentence flag for postProcessReply — banned-opener
      // stripping + opening-fingerprint tracker only fire on the
      // first sentence of a streamed reply.
      let isFirstSentence = true;

      let res: Awaited<ReturnType<typeof runTurn>>;
      try {
        res = await runTurn(clean, conversationRef.current, ctx, {
          confidence,
          summary: summaryRef.current,
          visionMode: settingsRef.current.visionMode,
          voicePrintGate: gate,
          ...personalityPayload,
          onSentence: (s) => {
            // Skip empty-after-sanitize fragments (pure markdown/bullets).
            const meaningful = s.replace(/[*_`|#~\-•>]/g, "").trim();
            if (meaningful.length < 2) return;

            // Run the post-processor: strips banned openers on the
            // first sentence, preserves v3-supported audio tags
            // ([laughs], [sighs], etc.) so ElevenLabs renders them,
            // converts [pause] to <break time="0.4s" /> inline per
            // v3 docs.
            const processed = postProcessReply({
              text: s,
              trackOpenings: true,
              isFirstSentence,
            });
            // Mood-to-tag bridge: on the FIRST sentence of a reply,
            // prepend a v3 audio tag matching the detected mood so
            // ElevenLabs colours the delivery. Subsequent sentences
            // inherit the tonal frame naturally — tagging every
            // sentence would sound melodramatic.
            const moodPrefix = isFirstSentence
              ? moodToTagPrefix(personalityPayload.personalityContext?.recentMoodSignal)
              : "";
            isFirstSentence = false;

            // v3 returns voiceChunks of length 1 (pause split moved
            // to inline <break>). Loop preserved for back-compat
            // with future routing where v2/Flash might still split.
            const chunks = moodPrefix && processed.voiceChunks.length > 0
              ? [moodPrefix + processed.voiceChunks[0], ...processed.voiceChunks.slice(1)]
              : processed.voiceChunks;
            for (const chunk of chunks) {
              if (chunk.length < 2) continue;
              spokeAny = true;
              queuedSpeech = true;
              lastSpokenTextRef.current = chunk;
              voiceOutRef.current?.queueSentence(chunk);
            }
          },
        });
      } catch (e) {
        // Always unmute on error — otherwise the mic stays dead until
        // the next manual push-to-talk. Re-throw so the inFlightRef
        // catch sees it.
        if (!queuedSpeech) voiceInRef.current?.setMuted(false);
        setStatus("idle");
        throw e;
      }

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
        queuedSpeech = true;
      }

      // Unmute the mic if no TTS was actually queued. When TTS DID get
      // queued, the voiceOutput onEnd callback will unmute on our behalf
      // once playback finishes.
      if (!queuedSpeech) {
        voiceInRef.current?.setMuted(false);
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

  // (Voice-print accessor binding lives later in the file, after
  // updateSettings is declared — TDZ safety.)

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
        // Tightened from 1400 — we now have early-dispatch + final-dedup,
        // so a long cooldown only adds perceived latency.
        dispatchCooldownMs: 700,
        // Silence-before-dispatch is user-tuneable now. 650ms used to be
        // the default; operators reported it cut them off mid-pause, so
        // settings.endOfTurnMs defaults to 1200ms and is exposed as a
        // slider in Settings. Hot-swappable via the live-config patch
        // useEffect below — no recognizer restart on change.
        earlyDispatchSilenceMs: settings.endOfTurnMs ?? 1200,
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
            // Orb reflects voice state when idle-ish — but never overwrite
            // a "busy" status (the brain is mid-flight).
            if (
              cur === "speaking" ||
              cur === "processing" ||
              cur === "executing" ||
              cur === "coding"
            ) {
              return cur;
            }
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
      // Live-tune the end-of-turn silence threshold without restarting
      // the recognizer. Settings -> Voice -> "Pause before Axon
      // responds" slider feeds straight into this.
      earlyDispatchSilenceMs: settings.endOfTurnMs ?? 1200,
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
    settings.endOfTurnMs,
  ]);

  // ── voice output wiring ─────────────────────────────────────────
  useEffect(() => {
    voiceOutRef.current = new VoiceOutput(
      {
        voicePresetId: settings.voicePresetId,
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
    settings.voicePresetId,
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
  //
  // Proactive utterance pipeline. Each enabled monitor polls on its
  // own interval, and when its check() returns a non-null alert
  // string, we'd LIKE to speak it. But three guards have to fire
  // in order or Axon ends up talking over the operator:
  //
  //   1. proactiveMode gate -- "off" silences every monitor regardless
  //      of which ones are enabled. (enabledMonitors says WHICH
  //      monitors run; proactiveMode says whether their output
  //      reaches the voice channel.)
  //
  //   2. forceSleep gate -- when the operator has explicitly muted
  //      Axon, proactive alerts must respect that too.
  //
  //   3. Status gate -- monitors NEVER speak while Axon is
  //      listening / processing / speaking / executing / coding.
  //      Before today's fix, monitors called voiceOut.speak()
  //      unconditionally and would talk straight over a mid-sentence
  //      user transcription. Now we drop on conflict. (Acceptable
  //      because monitors run on their own intervals -- skip one
  //      tick, next tick re-fires when the conflict clears.)
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
          if (!alert) return;

          // Guard 1: proactive volume.
          if (settings.proactiveMode === "off") return;

          // Guard 2: hard mute.
          if (settings.forceSleep) return;

          // Guard 3: don't barge in on an in-flight turn. Skipping
          // is correct -- the next interval will re-fire when Axon
          // is idle and the alert remains true.
          const cur = statusRef.current;
          if (
            cur === "listening" ||
            cur === "speaking" ||
            cur === "processing" ||
            cur === "executing" ||
            cur === "coding"
          ) {
            return;
          }

          appendTurn({
            id: newId("t"),
            role: "axon",
            text: `Heads up — ${alert}`,
            modality: "voice",
            timestamp: Date.now(),
          });
          voiceOutRef.current?.speak(`Heads up. ${alert}`);
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
    settings.proactiveMode,
    settings.forceSleep,
    buildActionContext,
    appendTurn,
  ]);

  // ── Keyboard shortcuts ─────────────────────────────────────────
  // Cmd/Ctrl+J     → toggle panel  (was Cmd/Ctrl+K; collided with
  //                  the global command palette which owns ⌘K)
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

      // Cmd/Ctrl+J — toggle panel (works even while typing in inputs).
      // Moved off ⌘K to share the keyboard cleanly with the global
      // CommandPalette: ⌘K opens "jump anywhere", ⌘J opens AXON.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setPanelOpen((v) => !v);
        return;
      }

      // Cmd/Ctrl+Shift+A — toggle Axon's mute state.
      //
      // Toggles the forceSleep setting (the same flag the "stand down"
      // voice phrase flips). When ON, Axon is fully dormant: no wake-
      // word matching, no monitor speech, no proactive utterances --
      // the orb's status pill reflects this so the operator always
      // knows whether Axon is hot or muted. The shortcut is reserved
      // for parity with the voice command, NOT a kill-switch for the
      // whole assistant: use Settings -> Enabled to disable Axon
      // entirely.
      //
      // NOTE: inlined setSettings + persistSettings instead of the
      // top-level updateSettings helper to avoid a temporal-dead-zone
      // ref -- updateSettings is declared further down in the
      // component, and React reads useEffect dep arrays at render
      // time (not handler-invocation time). Same reason the
      // voicePrint accessor block has the same workaround.
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "a"
      ) {
        e.preventDefault();
        const nextForceSleep = !settings.forceSleep;
        setSettings((prev) => {
          const next = { ...prev, forceSleep: nextForceSleep };
          persistSettings(next);
          return next;
        });
        // Verbal ack so the operator knows the toggle landed even when
        // the orb isn't visible. Mirrors the speakLocal call in the
        // voice-driven "stand down" / "wake up" intent path.
        speakLocal(nextForceSleep ? "Standing down." : "Back online.");
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
  }, [
    isAdmin,
    settings.enabled,
    settings.pushToTalkShortcut,
    settings.forceSleep,
    // setSettings is stable (React state setter), persistSettings is
    // module-scope -- neither needs to be in the dep list. speakLocal
    // is a useCallback declared above so it's safe to reference here.
    speakLocal,
  ]);

  // ── Conversation summarization ─────────────────────────────────
  // When the turn count exceeds SUMMARY_TRIGGER_TURNS, background-summarize
  // the older half and keep the last SUMMARY_KEEP_RECENT verbatim. Each
  // successful summarization is also written to persistent memory as a
  // session-summary entry — that's how AXON gets continuity across
  // reloads ("you've been working on X for the last few days").
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
        // Persist this batch as a session summary for cross-reload memory.
        try {
          const cur = loadMemory();
          saveMemory(appendSessionSummary(cur, result));
        } catch {
          /* memory persist is best-effort */
        }
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
  //
  // Dedupe is TOPIC-based, not path-based: the overdue-task nag appears
  // on both "/" and "/task", and bouncing between pages used to make
  // AXON repeat it endlessly. We now key each observation to a topic
  // (e.g. all "N overdue task(s)" lines → topic "overdue") and suppress
  // a topic if it was spoken within its cooldown. The overdue nag gets
  // a long cooldown so AXON mentions it at most once every few hours.
  const lastObservationAtRef = useRef(0);
  const lastObservedPathRef = useRef<string | null>(null);
  const spokenTopicsRef = useRef<Map<string, number>>(new Map());

  // Cooldowns per topic (ms). Anything not listed uses DEFAULT.
  const TOPIC_COOLDOWN_DEFAULT = 30 * 60 * 1000;   // 30 min for generic lines
  const TOPIC_COOLDOWN_OVERDUE = Infinity;          // once per session — never repeats until restart

  function topicOf(line: string): { key: string; cooldown: number } {
    const lower = line.toLowerCase();
    if (lower.includes("overdue task")) {
      return { key: "overdue", cooldown: TOPIC_COOLDOWN_OVERDUE };
    }
    if (lower.includes("meeting") || lower.includes("calendar")) {
      return { key: "calendar", cooldown: TOPIC_COOLDOWN_DEFAULT };
    }
    // Default: the exact line is its own topic.
    return { key: `line:${line}`, cooldown: TOPIC_COOLDOWN_DEFAULT };
  }

  useEffect(() => {
    if (!isAdmin || !settings.enabled || !settings.proactiveRouteObservations) return;
    const path = location.pathname;
    if (!path || path === lastObservedPathRef.current) return;

    const now = Date.now();
    if (now - lastObservationAtRef.current < ROUTE_OBSERVATION_MIN_INTERVAL_MS) return;

    // Don't narrate while AXON is mid-speech or mid-processing.
    if (voiceOutRef.current?.isSpeaking()) return;

    lastObservedPathRef.current = path;

    observeRoute(path, activeCompanyRef.current).then((line) => {
      if (!line) return;

      // Topic-level dedupe — suppress if we've said this topic recently.
      const { key, cooldown } = topicOf(line);
      const lastSaid = spokenTopicsRef.current.get(key) ?? 0;
      if (Date.now() - lastSaid < cooldown) return;

      // Commit timestamps only when we actually speak.
      spokenTopicsRef.current.set(key, Date.now());
      lastObservationAtRef.current = Date.now();

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

  // Voice-print accessor binding — placed after updateSettings to avoid
  // the temporal-dead-zone reference that const+useEffect would create
  // earlier in the function body. Re-binds whenever updateSettings
  // changes (which is once, but defensive).
  useEffect(() => {
    _bindVoicePrintAccessors(
      () => ({
        voicePrint: settingsRef.current.voicePrint,
        voicePrintThreshold: settingsRef.current.voicePrintThreshold,
        voicePrintGate: settingsRef.current.voicePrintGate,
      }),
      (partial) => updateSettings(partial),
    );
    _bindVoiceAccessors(
      (presetId) => updateSettings({ voicePresetId: presetId }),
      () => settingsRef.current.voicePresetId ?? null,
    );
    _bindCodegenAccessors(
      () => {
        const s = settingsRef.current;
        // Active project wins, with codegenWorkspace as legacy fallback.
        if (s.activeProjectId) {
          const proj = (s.projects ?? []).find((p) => p.id === s.activeProjectId);
          if (proj) return proj.path;
        }
        return s.codegenWorkspace ?? null;
      },
      (workspace) => updateSettings({ codegenWorkspace: workspace }),
    );
    _bindProjectAccessors(
      () => settingsRef.current,
      (patch) => updateSettings(patch),
    );
    _bindAgentAccessors(() => settingsRef.current);
    _bindEnsembleAccessors(() => {
      const s = settingsRef.current;
      return s.projects.find((p) => p.id === s.activeProjectId) ?? null;
    });
    _bindSleepAccessors(
      () => ({ forceSleep: settingsRef.current.forceSleep }),
      (partial) => updateSettings(partial),
    );
    // Theme accessors — Axon's set_theme / toggle_theme actions
    // call through these to drive the themeMode store the same
    // way the Profile → Appearance toggle does. Reading the
    // store directly avoids prop-drilling + keeps the action
    // file decoupled from React.
    _bindThemeAccessors(
      () => useThemeMode.getState().mode,
      (mode) => useThemeMode.getState().setMode(mode),
    );
  }, [updateSettings]);

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
      simulationMode,
      setSimulationMode,
      ensemblePhase,
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
      simulationMode,
      setSimulationMode,
      ensemblePhase,
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
/**
 * Same as useAxon() but returns null instead of throwing when the
 * component renders outside the provider. Useful for widgets that
 * may be embedded in trees that don't (or don't yet) include
 * <AxonProvider> — e.g. the home dashboard's AxonCoachCard, which
 * mounts before AxonProvider in some routing configurations.
 *
 * Consumers should null-check and gracefully degrade the action
 * paths (typically to a window-event Cmd+K fallback or a no-op).
 */
export function useOptionalAxon(): AxonContextValue | null {
  return useContext(AxonContext);
}
export function useAxonConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useAxonConfirm must be used inside <AxonProvider>");
  return ctx;
}
