# Takeover Observatory

The whole system on one screen. Drop this folder into `cwa_manager/src/admin/observatory/`
and route it — every store, wire, table, route, risk, and what-if becomes visible,
clickable, and explained.

```
observatory/
├── Observatory.tsx          ← the shell (tabs, masthead, theme)
├── data/
│   └── manifest.ts          ← THE SOURCE OF TRUTH — everything renders from here
├── lib/
│   └── scoring.ts           ← posture score, severity rollups, coverage meters
├── components/
│   └── ui.tsx               ← design tokens + shared atoms (Badge, Modal, ScoreRing)
└── tabs/
    ├── OverviewTab.tsx      ← bento situation report
    ├── SystemMapTab.tsx     ← interactive architecture map (animated data flow)
    ├── SecurityTab.tsx      ← threat board (filter by severity/component)
    ├── DataApiTab.tsx       ← data registry + API route registry
    └── ScenariosTab.tsx     ← RAG-style what-if engine (Redis vs localStorage, etc.)
```

## 1 · Install

No new dependencies. React + TypeScript only; all styling is scoped CSS injected
under `.obs-root` (it will not fight your Tailwind/global theme). Fonts load from
Google Fonts — already your stack (Newsreader / Hanken Grotesk / JetBrains Mono).

```tsx
// wherever your admin routes live
import Observatory from "@/admin/observatory/Observatory";

<Route path="/admin/observatory" element={<Observatory />} />
```

Gate it: this page is a map of your weaknesses. Put it behind your admin role
check, and keep it out of any build that ships to customers.

## 2 · How it works

The UI is a pure function of `data/manifest.ts`. Six collections drive everything:

| Collection  | Drives                                        |
| ----------- | --------------------------------------------- |
| `nodes`     | System Map boxes, Overview verdicts           |
| `edges`     | Map wires, encryption coverage meter          |
| `assets`    | Data Registry, "exposed client-side" cell     |
| `apis`      | API Routes table, auth coverage meter         |
| `findings`  | Threat Board, posture score, node risk badges |
| `scenarios` | What-if engine, "recommended moves" cell      |

Add a row to a collection and it appears everywhere it's relevant — including
cross-links (a finding shows the scenarios that fix it; a node shows the data
resting in it; a scenario retrieves evidence from the threat board).

The current manifest is **ground truth**, generated on 2026-06-09 from a direct
audit of both repos (cwa_manager + takeover_b2b). Every node, wire, asset,
route, and finding cites a real file path; where the repo couldn't confirm
something (e.g. live RLS policies not present in local migrations) it is marked
partial/unconfirmed rather than guessed. The Overview footer shows the green
"regenerated" stamp (it only turns amber if `generatedBy` says "seed"). Re-run
the audit below after big merges to keep it honest:

## 3 · Regenerating the manifest (the important part)

You and Hanif should never maintain this file by hand. Run this in Claude Code
from the repo root (ideally a workspace containing both `cwa_manager` and
`takeover_b2b`):

```
Read src/admin/observatory/data/manifest.ts and learn its TypeScript schema
(SystemNode, SystemEdge, DataAsset, ApiRoute, Finding, Scenario).

Then audit this repository and REWRITE the seed data in that file so it reflects
reality. Specifically:

1. NODES — enumerate the real components: the React app, TanStack Query setup,
   every client-side storage mechanism actually used (grep for localStorage,
   sessionStorage, IndexedDB, persistQueryClient, tauri-plugin-store), the Rust
   core (list the actual #[tauri::command] functions), takeover_b2b, Supabase,
   each MCP/SaaS integration found in the code, and external APIs (Anthropic,
   ElevenLabs, Stripe). Keep planned nodes (server, Redis) marked planned:true.
   Set real `paths` for each node. Assign verdicts honestly.

2. EDGES — trace the real call paths: which client code calls Supabase directly
   vs through takeover_b2b, what the Rust core calls, where webhooks come in.
   Set encrypted/authenticated truthfully per wire.

3. ASSETS — inventory every kind of data we persist or cache: every Supabase
   table (read supabase/migrations), every localStorage key actually written,
   what TanStack caches, files the Rust core writes. For each: sensitivity,
   every storedIn location with real table names, and rls status — check each
   table's policies in the migrations and mark full/partial/none honestly.

4. APIS — enumerate every route in takeover_b2b (walk the router files) plus
   client-direct Supabase access. Record real method, path, auth middleware
   present or absent, upstream, and what each reads/writes.

5. FINDINGS — verify or refute each seeded finding with evidence (file + line),
   update status, and ADD anything new you discover: secrets in the client
   bundle, unauthenticated routes, missing webhook verification, RLS gaps,
   logged credentials, over-broad OAuth scopes, unsafe Tauri capabilities.
   Severity must reflect real exploitability, not vibes.

6. SCENARIOS — update the impacts[].files arrays of the existing scenarios to
   point at the real files a migration would touch.

Rules: keep the schema exactly as-is; set generatedAt to today and generatedBy
to "claude-code repo scan"; do not soften findings to be polite; cite evidence
paths so a human can verify every claim. Output only the rewritten manifest.ts.
```

Re-run it after big merges, or wire it into CI as a weekly job. The Overview
footer turns amber whenever the manifest still says "seed data."

## 4 · Reading the tabs

- **Overview** — the 30-second answer to "are we okay?": posture ring, the three
  riskiest components, sensitive data resting client-side, coverage meters, and
  the moves the scenario engine currently recommends. Every cell deep-links.
- **System Map** — the signature surface. Pulses animate along every live wire;
  red wires are unencrypted at rest, dashed ones are planned infra. Hover a node
  to trace its connections; click any node or wire for the full dossier
  (tech, paths, resting data, open findings, connected wires).
- **Threat Board** — every weakness as a card: severity, the component it lives
  in, and fix-effort. The modal gives risk → evidence → fix → effort, plus the
  scenarios that would move the finding.
- **Data & APIs** — two registries. Data: every asset, its sensitivity, every
  place it rests (table names included), RLS status. APIs: every route, its
  auth, upstream, and what it reads/writes. This is the "what goes where" tab.
- **Scenarios** — pick a what-if ("Redis sessions instead of localStorage") and
  the engine answers with retrieved evidence from its own map and threat board,
  delta gauges across security/perf/complexity/cost, the blast radius (every
  node + the files in the diff), and an ordered migration plan.

## 5 · Extending

- **New scenario**: append to `manifest.scenarios` — the picker, gauges,
  retrieval panel, and blast radius render automatically.
- **Live wiring later**: the manifest schema is deliberately serializable. When
  the Node server lands, serve it as JSON from an admin endpoint and fetch it
  in `Observatory.tsx` instead of importing — the Observatory becomes live.
- **Axon integration**: the scenario `retrieval` arrays are prompt-ready. Feed
  the manifest + a question to Claude via takeover_b2b and you have a real RAG
  loop over your own architecture — the Observatory asking itself questions.
