/**
 * swarmStore — Zustand store for the Axon Swarm control room.
 *
 * Holds three pieces of state every panel reads from:
 *   1. Per-agent live status (`agentStates`) — drives the orb colour,
 *      pulse cadence, and selection ring.
 *   2. The rolling event bus (`events`) — last 200 cross-agent signals,
 *      newest first. Persisted in memory only; once an event scrolls
 *      out of the buffer it's gone.
 *   3. Inter-agent messages (`bridges`) — short-lived (~2s) edges in the
 *      swarm graph that pulse when one agent pings another.
 *
 * The store is intentionally dumb. Real signal ingestion will write to
 * `pushEvent` / `setAgentStatus` from elsewhere (the Rust bus, the
 * existing webhook handlers, the chat draft engine, etc.). The
 * accompanying `swarmSimulator` mimics that traffic so the UI looks
 * alive in dev + demo modes.
 */

import { create } from "zustand";
import type { AgentId, AgentStatus } from "./agents";
import { AGENTS } from "./agents";

export type EventSeverity = "info" | "warn" | "critical";

export interface SwarmEvent {
  id: string;
  /** Which agent produced or owns this event. */
  agentId: AgentId;
  /** Capability id from the agent's `capabilities` array, e.g.
   *  "invoice.late". Used to map the event to a known action. */
  capability: string;
  /** Human-readable summary shown in the bus. */
  message: string;
  severity: EventSeverity;
  /** Unix ms timestamp. */
  at: number;
}

export interface AgentBridgeMessage {
  id: string;
  from: AgentId;
  to: AgentId;
  /** Short label shown along the edge briefly. */
  label: string;
  /** Unix ms — bridge auto-removes after BRIDGE_TTL ms. */
  at: number;
}

export interface AgentState {
  status: AgentStatus;
  lastEventAt: number | null;
  /** Rolling count of events emitted by this agent. */
  eventCount: number;
  /** Last error message if status === "error". */
  errorMessage: string | null;
}

const EVENT_BUFFER_SIZE = 200;
const BRIDGE_TTL_MS = 2_400;

interface SwarmStore {
  agentStates: Record<AgentId, AgentState>;
  events: SwarmEvent[];
  bridges: AgentBridgeMessage[];

  /** Set or update a single agent's status. */
  setAgentStatus: (id: AgentId, status: AgentStatus, errorMessage?: string | null) => void;
  /** Mute (or unmute) an agent's tier-1 alerts. */
  toggleMute: (id: AgentId) => void;

  /** Push a new event into the bus. Auto-trims to EVENT_BUFFER_SIZE. */
  pushEvent: (e: Omit<SwarmEvent, "id" | "at"> & { at?: number }) => void;
  /** Clear the event buffer (the "🗑 clear log" button in the UI). */
  clearEvents: () => void;

  /** Open a transient bridge between two agents — rendered as a
   *  pulsing edge in the swarm graph for ~2 seconds. */
  fireBridge: (b: Omit<AgentBridgeMessage, "id" | "at"> & { at?: number }) => void;
  /** Drop any bridges older than BRIDGE_TTL_MS. Called by an interval. */
  garbageCollectBridges: () => void;
}

function defaultAgentStates(): Record<AgentId, AgentState> {
  const out = {} as Record<AgentId, AgentState>;
  for (const a of AGENTS) {
    out[a.id] = {
      status: a.defaultStatus,
      lastEventAt: null,
      eventCount: 0,
      errorMessage: null,
    };
  }
  return out;
}

export const useSwarmStore = create<SwarmStore>((set, get) => ({
  agentStates: defaultAgentStates(),
  events: [],
  bridges: [],

  setAgentStatus: (id, status, errorMessage = null) =>
    set((s) => ({
      agentStates: {
        ...s.agentStates,
        [id]: {
          ...s.agentStates[id],
          status,
          errorMessage: status === "error" ? errorMessage : null,
        },
      },
    })),

  toggleMute: (id) =>
    set((s) => {
      const current = s.agentStates[id].status;
      const next = current === "muted" ? "watching" : "muted";
      return {
        agentStates: {
          ...s.agentStates,
          [id]: { ...s.agentStates[id], status: next },
        },
      };
    }),

  pushEvent: (e) => {
    const ev: SwarmEvent = {
      ...e,
      id: crypto.randomUUID(),
      at: e.at ?? Date.now(),
    };
    set((s) => {
      const events = [ev, ...s.events].slice(0, EVENT_BUFFER_SIZE);
      const prev = s.agentStates[ev.agentId];
      return {
        events,
        agentStates: {
          ...s.agentStates,
          [ev.agentId]: {
            ...prev,
            lastEventAt: ev.at,
            eventCount: prev.eventCount + 1,
          },
        },
      };
    });
  },

  clearEvents: () => set({ events: [] }),

  fireBridge: (b) => {
    const msg: AgentBridgeMessage = {
      ...b,
      id: crypto.randomUUID(),
      at: b.at ?? Date.now(),
    };
    set((s) => ({ bridges: [...s.bridges, msg] }));
    // Schedule its own cleanup so the caller doesn't need to remember.
    setTimeout(() => {
      set((s) => ({ bridges: s.bridges.filter((x) => x.id !== msg.id) }));
    }, BRIDGE_TTL_MS);
  },

  garbageCollectBridges: () => {
    const now = Date.now();
    const fresh = get().bridges.filter((b) => now - b.at < BRIDGE_TTL_MS);
    if (fresh.length !== get().bridges.length) set({ bridges: fresh });
  },
}));

/** Selector — total events across the swarm in the last 24h. Used
 *  by the header strip. */
export const selectTotalEvents24h = (s: SwarmStore): number => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return s.events.filter((e) => e.at >= cutoff).length;
};

/** Selector — count of critical-severity events in the buffer. */
export const selectCriticalCount = (s: SwarmStore): number =>
  s.events.filter((e) => e.severity === "critical").length;
