// ───────────────────────────────────────────────────────────────────
// AxonActivityHud — the live "what Axon is doing right now" surface.
//
// Docked to the orb (bottom-right, just above the input) — NOT the Mind
// Map, NOT inside the command drawer. It only appears for sessions YOU
// started by prompting the orb (kind === "conversation" with a real
// prompt); the autonomous background monitors (kind === "agent") never
// pop it. Each action shows as a clean step: running -> done/failed,
// with the result summary + any proof (ids / links) so you can SEE it
// actually landed. Collapses to a one-line pill between runs.
// ───────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Loader2, Check, X, Sparkles, ExternalLink, ChevronDown } from "lucide-react";
import { open as openShell } from "@tauri-apps/plugin-shell";
import { axonGraph, type GraphNode, type GraphSession } from "../engine/graphStore";

const FONT_UI = '"Hanken Grotesk", Inter, system-ui, sans-serif';
const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';
const SHOW_KINDS = new Set(["tool", "file", "error", "summary"]);

const goExternal = (u: string) => { openShell(u).catch(() => { try { window.open(u, "_blank"); } catch { /* */ } }); };
const humanize = (n: GraphNode) =>
  n.kind === "summary" ? "Summary"
  : n.kind === "file" ? `${(n.fileOp || "touch")} ${(n.filePath || n.label).split(/[\\/]/).slice(-1)[0]}`
  : (n.toolName || n.label).replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function proofsOf(result: unknown): Array<{ label: string; href?: string }> {
  if (!result || typeof result !== "object") return [];
  const r = result as Record<string, unknown>;
  const out: Array<{ label: string; href?: string }> = [];
  for (const k of ["url", "link", "href", "permalink", "html_url", "web_url", "issueUrl"]) {
    const v = r[k];
    if (typeof v === "string" && v.startsWith("http")) { out.push({ label: "Open", href: v }); break; }
  }
  for (const k of ["gmail_id", "thread_id", "issue_id", "id", "key", "number", "msg_id"]) {
    const v = r[k];
    if (v != null && (typeof v === "string" || typeof v === "number")) {
      out.push({ label: `${k.replace(/_?id$/i, "").replace(/_/g, " ") || "id"}: ${String(v).slice(0, 16)}` });
      break;
    }
  }
  return out.slice(0, 2);
}

function StepRow({ n }: { n: GraphNode }) {
  const proofs = n.kind === "tool" ? proofsOf((n.meta as any)?.result) : [];
  const icon =
    n.state === "running" ? <Loader2 size={14} className="animate-spin text-sky-400" />
    : n.state === "error" ? <X size={14} className="text-red-400" />
    : <Check size={14} className="text-emerald-400" />;
  return (
    <div className="flex items-start gap-2.5 px-3 py-2 border-b border-white/[0.05] last:border-0">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] text-zinc-100 truncate" style={{ fontFamily: FONT_UI }}>{humanize(n)}</span>
          {n.durationMs != null && n.state !== "running" && (
            <span className="ml-auto text-[10px] text-zinc-500 shrink-0" style={{ fontFamily: FONT_MONO }}>{Math.round(n.durationMs)}ms</span>
          )}
        </div>
        {(n.detail || n.error) && (
          <div className={`text-[11px] mt-0.5 [overflow-wrap:anywhere] line-clamp-2 ${n.state === "error" ? "text-red-300/80" : "text-zinc-400"}`} style={{ fontFamily: FONT_UI }}>
            {n.error || n.detail}
          </div>
        )}
        {proofs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {proofs.map((p, i) => p.href ? (
              <button key={i} onClick={() => goExternal(p.href!)} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20" style={{ fontFamily: FONT_MONO }}>
                {p.label} <ExternalLink size={9} />
              </button>
            ) : (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-300/90" style={{ fontFamily: FONT_MONO }}>{p.label}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AxonActivityHud() {
  const snap = useSyncExternalStore(axonGraph.subscribe, axonGraph.getState, axonGraph.getState);
  const session: GraphSession | undefined =
    snap.sessions.find((s) => s.id === snap.currentSessionId) ?? snap.sessions[snap.sessions.length - 1];

  // Only surface runs the operator kicked off by talking to the orb.
  // Conversation sessions carry the typed prompt; autonomous monitors
  // run as kind:"agent" and must stay invisible here.
  const isPrompted = !!session && session.kind === "conversation" && session.prompt.trim().length > 0;

  const [dismissed, setDismissed] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const lastIdRef = useRef<string | null>(null);
  // A fresh prompted run re-opens the panel (un-dismiss, expand).
  useEffect(() => {
    if (isPrompted && session && session.id !== lastIdRef.current) {
      lastIdRef.current = session.id;
      setDismissed(null);
      setCollapsed(false);
    }
  }, [isPrompted, session?.id]);

  if (!session || !isPrompted) return null;
  const steps = session.nodes.filter((n) => SHOW_KINDS.has(n.kind));
  if (steps.length === 0 && session.endedAt) return null;       // nothing happened
  if (dismissed === session.id) return null;

  const running = !session.endedAt;
  const failed = !!session.endedAt && (session.nodes[0]?.state === "error" || steps.some((n) => n.state === "error"));
  const doneCount = steps.filter((n) => n.state !== "running" && n.kind === "tool").length;
  const toolCount = steps.filter((n) => n.kind === "tool").length;
  const statusText = running ? `working · ${doneCount}/${Math.max(toolCount, doneCount)} done` : failed ? "finished with errors" : "completed";

  const dot = (
    <span className="relative flex h-2 w-2">
      {running && <span className="absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-60 animate-ping" />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${running ? "bg-sky-400" : failed ? "bg-red-400" : "bg-emerald-400"}`} />
    </span>
  );

  // ── Collapsed pill — one line, docked by the orb. Click to expand. ──
  if (collapsed) {
    return (
      <div className="fixed bottom-24 right-5 z-[9998] max-w-[calc(100vw-2.5rem)]" data-axon-hud>
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-full border border-white/10 shadow-2xl hover:border-white/20"
          style={{ background: "rgba(10,11,16,0.94)", backdropFilter: "blur(10px)" }}
        >
          {dot}
          <Sparkles size={12} className="text-zinc-300" />
          <span className="text-[12px] font-semibold text-zinc-100" style={{ fontFamily: FONT_UI }}>Axon</span>
          <span className="text-[11px] text-zinc-400 truncate max-w-[150px]" style={{ fontFamily: FONT_MONO }}>· {statusText}</span>
          <ChevronDown size={13} className="text-zinc-500 rotate-180" />
        </button>
      </div>
    );
  }

  // ── Expanded card — docked bottom-right, just above the orb/input. ──
  return (
    <div
      className="fixed bottom-24 right-5 z-[9998] w-[340px] max-w-[calc(100vw-2.5rem)] rounded-xl border border-white/10 shadow-2xl overflow-hidden"
      style={{ background: "rgba(10,11,16,0.94)", backdropFilter: "blur(10px)" }}
      data-axon-hud
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10">
        {dot}
        <Sparkles size={13} className="text-zinc-300" />
        <span className="text-[12px] font-semibold text-zinc-100" style={{ fontFamily: FONT_UI }}>Axon</span>
        <span className="text-[11px] text-zinc-400 truncate" style={{ fontFamily: FONT_MONO }}>· {statusText}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => setCollapsed(true)} title="Collapse" className="text-zinc-500 hover:text-zinc-200"><ChevronDown size={15} /></button>
          <button onClick={() => setDismissed(session.id)} title="Dismiss" className="text-zinc-500 hover:text-zinc-200"><X size={14} /></button>
        </div>
      </div>

      {session.nodes[0]?.detail && (
        <div className="px-3 py-2 border-b border-white/[0.06] text-[11.5px] text-zinc-400 line-clamp-2" style={{ fontFamily: FONT_UI }}>
          “{session.nodes[0].detail}”
        </div>
      )}

      <div className="max-h-[46vh] overflow-y-auto">
        {steps.length === 0 ? (
          <div className="px-3 py-4 text-[12px] text-zinc-500" style={{ fontFamily: FONT_UI }}>Thinking through the request…</div>
        ) : (
          steps.map((n) => <StepRow key={n.id} n={n} />)
        )}
      </div>

      {session.summary && !running && (
        <div className="px-3 py-2.5 border-t border-white/10 text-[11.5px] text-zinc-300 [overflow-wrap:anywhere]" style={{ fontFamily: FONT_UI }}>
          <span className={failed ? "text-red-400" : "text-emerald-400"}>{failed ? "✗" : "✓"}</span> {session.summary}
        </div>
      )}
    </div>
  );
}

export default AxonActivityHud;
