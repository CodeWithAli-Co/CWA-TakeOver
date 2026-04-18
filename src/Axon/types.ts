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
}

export const DEFAULT_SETTINGS: AxonSettings = {
  enabled: true,
  alwaysListening: false,
  wakeWord: "hey axon",
  pushToTalkShortcut: "Control+Space",
  preferredVoice: null,
  rate: 1.0,
  pitch: 0.9,
  volume: 1.0,
  elevenLabsVoiceId: null,
  enabledMonitors: [],
  confidenceThreshold: 0.65,
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

  // Actions
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setOrbPosition: (pos: { x: number; y: number }) => void;
  submitCommand: (text: string, modality?: "voice" | "text") => Promise<void>;
  startListening: () => void;
  stopListening: () => void;
  interrupt: () => void;
  updateSettings: (partial: Partial<AxonSettings>) => void;
  clearConversation: () => void;
  addAutomation: (a: Omit<Automation, "id" | "createdAt" | "_handle" | "nextFire">) => Automation;
  removeAutomation: (id: string) => void;
}
