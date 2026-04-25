// ───────────────────────────────────────────────────────────────────
// AXON — Command Intelligence System
// Shared types for the context, engine, actions, and UI.
// ───────────────────────────────────────────────────────────────────

import type { CompanyFilter } from "@/stores/store";

/** High-level runtime state of AXON — drives the orb + status bar. */
export type AxonStatus =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "executing"
  | "error";

/** Role of a conversation turn. */
export type TurnRole = "user" | "axon" | "system";

/** A single transcript entry — voice OR text, unified. */
export interface ConversationTurn {
  id: string;
  role: TurnRole;
  /** The rendered text. For voice user turns, this is the transcript. */
  text: string;
  /** Optional — confidence score 0..1 for voice-transcribed turns. */
  confidence?: number;
  /** Input modality — voice vs typed. */
  modality: "voice" | "text" | "system";
  /** Epoch ms. */
  timestamp: number;
  /** Optional structured tool-uses that happened in this assistant turn. */
  actions?: ExecutedAction[];
}

/** Log of an action AXON actually performed. */
export interface ExecutedAction {
  id: string;
  actionName: string;
  params: Record<string, unknown>;
  /** Human-readable summary of what happened. */
  summary: string;
  /** Raw result returned from the action. */
  result?: unknown;
  error?: string;
  timestamp: number;
  /** Whether the action required confirmation and was confirmed. */
  confirmed?: boolean;
}

// ── Action registry ────────────────────────────────────────────────

export interface AxonAction<TInput = Record<string, unknown>, TResult = unknown> {
  /** Unique action name. Sent to Claude as tool name — keep snake_case. */
  name: string;
  /** One-line description for Claude's tool definition. */
  description: string;
  /** JSON-schema-lite input definition. */
  input_schema: {
    type: "object";
    properties: Record<string, JsonSchemaProperty>;
    required?: string[];
  };
  /** If true, AXON will prompt for confirmation before running (unless operator pre-confirmed in the command). */
  requiresConfirmation?: boolean;
  /** Roles allowed to invoke. Defaults to admin-equivalent. */
  allowedRoles?: string[];
  /** Whether the action modifies data (for logging + UI treatment). */
  mutating?: boolean;
  /** The handler. Runs with the full AXON runtime context. */
  handler: (input: TInput, ctx: ActionContext) => Promise<AxonActionResult<TResult>>;
}

export interface JsonSchemaProperty {
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
}

export interface AxonActionResult<T = unknown> {
  /** Short natural-language summary for the activity feed + Claude follow-up. */
  summary: string;
  /** Structured payload for Claude's follow-up turn. */
  data?: T;
  /** If true, AXON won't try to narrate further — action has spoken for itself. */
  silent?: boolean;
}

/** Runtime context passed to every action handler. */
export interface ActionContext {
  operator: OperatorContext;
  activeCompany: CompanyFilter;
  currentPath: string;
  /** When true, mutating actions should describe the action without performing it. */
  dryRun: boolean;
  /** Navigate wrapper — thin adapter over TanStack Router. */
  navigate: (to: string) => void;
  /** Switch the active company — wraps useCompanyFilter. */
  setActiveCompany: (c: CompanyFilter) => void;
  /** Speak something immediately (AXON-initiated, no round trip). */
  speak: (text: string) => void;
  /** Append a system note to the conversation (visible, not spoken). */
  note: (text: string) => void;
  /** Append a user-visible activity entry. */
  logActivity: (entry: Omit<ExecutedAction, "id" | "timestamp">) => void;
  /** Ask the operator for a yes/no confirmation. Resolves with the answer. */
  requestConfirmation: (message: string) => Promise<boolean>;
  /** Register a reversible-action entry. AXON can then run undo_last.
   *
   *  Two flavors:
   *   - Closure-style: `{ undo: async () => { ... } }` — session-scoped,
   *     lost on reload. Fine for volatile state but won't persist.
   *   - Descriptor-style: `{ descriptor: { kind, payload } }` — the kind
   *     must match a handler registered with `registerUndoHandler`; the
   *     payload must be JSON-safe. These entries survive page reloads.
   *
   *  Prefer descriptor-style for any action whose undo is meaningful
   *  across sessions (DB writes, deletes, status changes, etc).
   */
  pushUndo: (entry: {
    actionName: string;
    label: string;
    undo?: () => Promise<string>;
    descriptor?: { kind: string; payload: Record<string, unknown> };
  }) => void;
  /** Toggle call mode. When on, Axon re-arms the microphone after each
   *  reply so the operator can keep talking without re-invoking the
   *  wake word — a phone-conversation-style flow. */
  setCallMode?: (on: boolean) => void;
}

export interface OperatorContext {
  username: string;
  role: string;
  supa_id: string;
}

// ── Settings ───────────────────────────────────────────────────────

export interface AxonSettings {
  /** Master on/off. */
  enabled: boolean;
  /** Always-on microphone listening for wake word. */
  alwaysListening: boolean;
  /** Wake phrase — matched case-insensitive. */
  wakeWord: string;
  /** Phrases that move AXON from active to dormant. */
  sleepPhrases: string[];
  /** Phrases that move AXON from dormant back to standby. */
  resumePhrases: string[];
  /** Phrases that cut AXON off mid-speech. */
  interruptPhrases: string[];
  /** Speak a proactive greeting on first mount per session. */
  autoGreet: boolean;
  /** Emit a short observation when the operator navigates. */
  proactiveRouteObservations: boolean;
  /** Vision mode — off / auto (on visual-intent keywords) / always capture. */
  visionMode: "off" | "auto" | "always";
  /** Dry-run: mutating actions report what they would do without doing it. */
  dryRun: boolean;
  /** Voice identity enrollment vector (mean MFCC-ish features). null = disabled. */
  voicePrint: number[] | null;
  /** Cosine-similarity threshold for voice identity; below this → reject. */
  voicePrintThreshold: number;
  /** When true and `voicePrint` is set, mutating actions verify the
   *  speaker's voice against the enrolled print before running. Adds
   *  ~1.5s of latency per gated action (mic snapshot + comparison). */
  voicePrintGate: boolean;
  /** Push-to-talk keyboard shortcut. */
  pushToTalkShortcut: string;
  /** Preferred synthesis voice name. */
  preferredVoice: string | null;
  /** Speech rate 0.5 – 2.0. */
  rate: number;
  /** Speech pitch 0 – 2. */
  pitch: number;
  /** Speech volume 0 – 1. */
  volume: number;
  /** ElevenLabs voice id — if set + env key is present, used instead of Web Speech. */
  elevenLabsVoiceId: string | null;
  /** Which monitors are active. */
  enabledMonitors: string[];
  /** Low-confidence voice threshold for confirming before acting. */
  confidenceThreshold: number;
  /**
   * When true, destructive actions (marked requiresConfirmation) run
   * without popping the confirm dialog. The operator trusts Axon and
   * relies on the undo stack to reverse mistakes. Default: true.
   */
  autoApprove: boolean;
  /**
   * Continuous-listen mode: once woken, Axon keeps accepting commands
   * without needing the wake word again — until the operator says a
   * stand-down phrase. Default: true.
   */
  continuousAfterWake: boolean;
  /**
   * Phrases that exit continuous mode ("stand down", "at ease", etc.).
   */
  standDownPhrases: string[];
  /**
   * Forced sleep — overrides everything. When true, Axon is fully dormant:
   * no wake-word matching, no resume phrases, no proactive speech, no
   * command dispatch. Must be toggled off via the Settings UI to use
   * Axon again. Use when you need guaranteed silence.
   */
  forceSleep: boolean;
}

export const DEFAULT_SETTINGS: AxonSettings = {
  enabled: true,
  // Default ON — pure-voice operation, no button-pressing required.
  alwaysListening: true,
  wakeWord: "hey axon",
  sleepPhrases: ["axon go to sleep", "axon stop listening", "axon standby", "axon go quiet", "goodbye axon"],
  resumePhrases: ["axon wake up", "axon activate", "hey axon wake up", "axon come back"],
  interruptPhrases: ["stop", "shut up", "quiet", "cancel", "never mind", "hold on", "wait"],
  autoGreet: true,
  proactiveRouteObservations: true,
  visionMode: "auto",
  dryRun: false,
  voicePrint: null,
  voicePrintThreshold: 0.7,
  voicePrintGate: false,
  pushToTalkShortcut: "Control+Space",
  preferredVoice: null,
  rate: 1.02,
  pitch: 0.95,
  volume: 1.0,
  elevenLabsVoiceId: null,
  enabledMonitors: [],
  confidenceThreshold: 0.55,
  autoApprove: true,
  continuousAfterWake: true,
  standDownPhrases: [
    "stand down",
    "that's all",
    "that will be all",
    "thanks axon",
    "at ease",
  ],
  forceSleep: false,
};

// ── Automations ────────────────────────────────────────────────────

export interface Automation {
  id: string;
  /** Free-text description of what the automation does. */
  description: string;
  /** Cron-like string OR a simple interval spec. Session-scoped: interval ms. */
  intervalMs: number;
  /** The command AXON should execute when the interval fires. */
  command: string;
  /** Epoch ms of next scheduled fire. */
  nextFire: number;
  /** Created at. */
  createdAt: number;
  /** One-off reminder vs recurring. */
  kind: "recurring" | "reminder";
  /** The internal setTimeout / setInterval handle — runtime only. */
  _handle?: number;
}

// ── Monitors (anomaly detection) ───────────────────────────────────

export interface Monitor {
  id: string;
  label: string;
  description: string;
  /** Polling period. */
  intervalMs: number;
  /** Returns null when healthy, or an alert string when tripped. */
  check: (ctx: ActionContext) => Promise<string | null>;
}

// ── Provider API ───────────────────────────────────────────────────

export interface AxonContextValue {
  status: AxonStatus;
  settings: AxonSettings;
  conversation: ConversationTurn[];
  activity: ExecutedAction[];
  automations: Automation[];
  panelOpen: boolean;
  orbPosition: { x: number; y: number };
  liveTranscript: string;
  audioLevel: number;
  isAdmin: boolean;
  voiceState: "dormant" | "standby" | "armed";
  /** Call mode — when true, Axon re-arms the mic after every TTS reply
   *  so the operator can keep talking without re-invoking the wake word.
   *  Feels like a phone conversation rather than single-shot commands. */
  callMode: boolean;

  // Actions
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setOrbPosition: (pos: { x: number; y: number }) => void;
  submitCommand: (text: string, modality?: "voice" | "text", confidence?: number) => Promise<void>;
  startListening: () => void;
  stopListening: () => void;
  interrupt: () => void;
  updateSettings: (partial: Partial<AxonSettings>) => void;
  clearConversation: () => void;
  addAutomation: (a: Omit<Automation, "id" | "createdAt" | "_handle" | "nextFire">) => Automation;
  removeAutomation: (id: string) => void;
  /** Turn call mode on or off. Exposed so voice actions + UI controls
   *  can toggle it without having to touch private state. */
  setCallMode: (on: boolean) => void;
}
