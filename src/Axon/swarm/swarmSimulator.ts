/**
 * swarmSimulator — Fake-traffic generator for the swarm control room.
 *
 * Until the real backend signal bus is wired up, this loop emits a
 * realistic stream of events + bridge messages so the page looks
 * alive in dev and in YC-application demos. Every event carries a
 * real capability id from the agent registry, so the UX matches what
 * production traffic will look like.
 *
 * Wire-up: call `startSwarmSimulator()` once on the page's mount;
 * call the returned `stop()` on unmount.
 */

import { AGENTS, type AgentId } from "./agents";
import {
  useSwarmStore,
  type EventSeverity,
} from "./swarmStore";

interface TemplatedEvent {
  agentId: AgentId;
  capability: string;
  messages: string[];
  severity: EventSeverity;
  /** Weight in the random picker. Higher = more frequent. */
  weight: number;
  /** If set, fires a bridge to this agent at the same time. */
  bridgeTo?: AgentId;
  /** Label drawn on the bridge edge. */
  bridgeLabel?: string;
}

const TEMPLATES: TemplatedEvent[] = [
  // ── Finance ──────────────────────────────────────────────────
  {
    agentId: "finance", capability: "invoice.late",
    messages: [
      "Helix Bio invoice 8 days late · $4,500",
      "Anchor Capital invoice 4 days late · $12,000",
      "Northwind Energy invoice 2 days late · $7,200",
    ],
    severity: "warn", weight: 3,
    bridgeTo: "customer", bridgeLabel: "late→risk score",
  },
  {
    agentId: "finance", capability: "runway.project",
    messages: ["Runway recalculated · 14.2 months at current burn"],
    severity: "info", weight: 2,
  },
  {
    agentId: "finance", capability: "anomaly.spend",
    messages: [
      "AWS spend +47% w/w · investigating",
      "Stripe fees +23% over trailing mean",
    ],
    severity: "critical", weight: 1,
    bridgeTo: "engineering", bridgeLabel: "cost-deploy?",
  },
  {
    agentId: "finance", capability: "tx.classify",
    messages: [
      "12 transactions auto-categorised",
      "Stripe fee posted · $284 · COGS",
    ],
    severity: "info", weight: 4,
  },

  // ── Customer ─────────────────────────────────────────────────
  {
    agentId: "customer", capability: "ticket.intake",
    messages: [
      "Support ticket #4421 · urgency=high · Polaris",
      "Support ticket #4420 · urgency=med · Anchor",
    ],
    severity: "warn", weight: 3,
  },
  {
    agentId: "customer", capability: "sentiment.scan",
    messages: [
      "Helix Slack thread reads negative · 0.31 score",
      "Anchor renewal call positive · 0.82",
    ],
    severity: "warn", weight: 2,
  },
  {
    agentId: "customer", capability: "churn.signal",
    messages: ["Polaris churn risk score raised to 0.71"],
    severity: "critical", weight: 1,
    bridgeTo: "communications", bridgeLabel: "draft outreach",
  },
  {
    agentId: "customer", capability: "renewal.calendar",
    messages: [
      "Helix renewal in 30 days · $48k ACV",
      "Anchor renewal in 60 days · $96k ACV",
    ],
    severity: "info", weight: 2,
  },

  // ── Engineering ──────────────────────────────────────────────
  {
    agentId: "engineering", capability: "pr.wait",
    messages: [
      "hanif/auth-refactor · awaiting review · 4h 22m",
      "sem/folder-upload · awaiting review · 2h 11m",
    ],
    severity: "warn", weight: 4,
  },
  {
    agentId: "engineering", capability: "ci.failure",
    messages: [
      "CI failure · test-finance-edge.ts · flaky (3/10 retries pass)",
      "Build broke on main · 13s ago",
    ],
    severity: "critical", weight: 1,
  },
  {
    agentId: "engineering", capability: "uptime.alert",
    messages: ["api.takeover.com latency p95 spiked to 1.4s"],
    severity: "warn", weight: 2,
    bridgeTo: "finance", bridgeLabel: "infra cost?",
  },
  {
    agentId: "engineering", capability: "deploy.window",
    messages: [
      "Deploy v0.84.2 to prod · 2 services",
      "Vercel preview ready · #1209",
    ],
    severity: "info", weight: 3,
  },

  // ── Calendar ─────────────────────────────────────────────────
  {
    agentId: "calendar", capability: "prep.brief",
    messages: [
      "Brief ready · Helix QBR · 14:00",
      "Brief ready · YC partner intro · 11:30",
    ],
    severity: "info", weight: 3,
    bridgeTo: "customer", bridgeLabel: "context",
  },
  {
    agentId: "calendar", capability: "conflict.detect",
    messages: ["Conflict · Hanif double-booked 15:00–16:00"],
    severity: "warn", weight: 1,
  },
  {
    agentId: "calendar", capability: "recap.draft",
    messages: ["Recap drafted · standup · 4 action items"],
    severity: "info", weight: 2,
  },

  // ── Communications ───────────────────────────────────────────
  {
    agentId: "communications", capability: "draft.reply",
    messages: [
      "Drafted reply · helix@bio.com re: pricing",
      "Drafted reply · sem@codewithali.com re: SOW",
    ],
    severity: "info", weight: 3,
  },
  {
    agentId: "communications", capability: "open.loop",
    messages: [
      "Open loop · 4 days · 'I'll send Hanif the metrics deck'",
      "Open loop · 2 days · 'will circle back on contract'",
    ],
    severity: "warn", weight: 2,
  },
  {
    agentId: "communications", capability: "mention.dedupe",
    messages: ["4 Slack pings deduped into 1 notification"],
    severity: "info", weight: 2,
  },

  // ── Recruitment ──────────────────────────────────────────────
  {
    agentId: "recruitment", capability: "feedback.nudge",
    messages: ["Nudge · Ali · interview feedback for Mira pending 26h"],
    severity: "warn", weight: 1,
  },
  {
    agentId: "recruitment", capability: "stage.advance",
    messages: ["Mira → onsite · all interviewers rated advance"],
    severity: "info", weight: 1,
  },

  // ── Filesystem ───────────────────────────────────────────────
  {
    agentId: "filesystem", capability: "contract.expiry",
    messages: [
      "Hosting agreement expires in 30 days",
      "Polaris MSA renews in 14 days",
    ],
    severity: "warn", weight: 1,
    bridgeTo: "finance", bridgeLabel: "renewal cost",
  },
  {
    agentId: "filesystem", capability: "doc.stale",
    messages: ["3 docs stale · 90+ days · onboarding/*"],
    severity: "info", weight: 2,
  },
];

/** Weighted random pick from the templates. */
function pickTemplate(): TemplatedEvent {
  const total = TEMPLATES.reduce((sum, t) => sum + t.weight, 0);
  let n = Math.random() * total;
  for (const t of TEMPLATES) {
    n -= t.weight;
    if (n <= 0) return t;
  }
  return TEMPLATES[0]!;
}

/** Briefly elevate the source agent's status so the orb pulses. */
function nudgeStatus(agentId: AgentId, severity: EventSeverity) {
  const store = useSwarmStore.getState();
  const next =
    severity === "critical" ? "alerting"
    : severity === "warn"    ? "thinking"
    : "acting";

  // Don't override a muted agent's mute.
  if (store.agentStates[agentId].status === "muted") return;

  store.setAgentStatus(agentId, next);
  // Settle back to watching after a beat.
  setTimeout(() => {
    const after = useSwarmStore.getState().agentStates[agentId].status;
    if (after === next) {
      useSwarmStore.getState().setAgentStatus(
        agentId,
        AGENTS.find((a) => a.id === agentId)!.defaultStatus,
      );
    }
  }, 2_000);
}

/**
 * Start the simulator. Returns a `stop()` to call on unmount.
 * Defaults to 1 event every 2–5s plus a steady garbage-collection
 * tick for stale bridges.
 */
export function startSwarmSimulator(): () => void {
  const store = useSwarmStore.getState();

  const tickEvent = () => {
    const t = pickTemplate();
    const msg = t.messages[Math.floor(Math.random() * t.messages.length)]!;

    store.pushEvent({
      agentId: t.agentId,
      capability: t.capability,
      message: msg,
      severity: t.severity,
    });
    nudgeStatus(t.agentId, t.severity);

    // ~40% of the time, also fire the bridge if defined.
    if (t.bridgeTo && Math.random() < 0.4) {
      setTimeout(() => {
        store.fireBridge({
          from: t.agentId,
          to: t.bridgeTo!,
          label: t.bridgeLabel ?? "",
        });
      }, 400);
    }
  };

  const tickGc = () => store.garbageCollectBridges();

  // Stagger initial events so the page doesn't load empty.
  const startup = setTimeout(() => {
    tickEvent();
    setTimeout(tickEvent, 600);
    setTimeout(tickEvent, 1_400);
  }, 250);

  // Main loop — 1 event every 2.0–5.0s.
  let eventTimer: ReturnType<typeof setTimeout> | null = null;
  const loopEvent = () => {
    tickEvent();
    eventTimer = setTimeout(loopEvent, 2_000 + Math.random() * 3_000);
  };
  eventTimer = setTimeout(loopEvent, 2_000);

  // Bridge GC ticks once a second.
  const gcTimer = setInterval(tickGc, 1_000);

  return () => {
    clearTimeout(startup);
    if (eventTimer) clearTimeout(eventTimer);
    clearInterval(gcTimer);
  };
}
