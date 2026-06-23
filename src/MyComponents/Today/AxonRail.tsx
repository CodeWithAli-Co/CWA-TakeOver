// ───────────────────────────────────────────────────────────────────
// AxonRail — the right column. Axon as a primary, persistent surface
// rather than a corner panel: its current read, quick action chips, and
// an "ask Axon anything" input at the bottom. Reuses the live Axon
// engine via useOptionalAxon (null for non-permitted users → calm
// placeholder).
// ───────────────────────────────────────────────────────────────────
import { useState } from "react";
import { Sparkles, ArrowUp } from "lucide-react";
import { useOptionalAxon } from "@/Axon/AxonProvider";

const CHIPS = [
  "Brief me on today",
  "What deals are stalling?",
  "Summarize the pipeline",
  "What's our runway?",
];

export const AXON_RAIL_INPUT_ID = "axon-rail-input";

export function AxonRail() {
  const axon = useOptionalAxon();
  const [draft, setDraft] = useState("");

  const send = (text: string) => {
    const t = text.trim();
    if (!t || !axon) return;
    setDraft("");
    void axon.submitCommand(t, "text");
  };

  const turns = axon?.conversation ?? [];
  const lastAxon = [...turns].reverse().find((t) => t.role === "axon");

  return (
    <aside
      className="h-full flex flex-col shrink-0 w-[360px] border-l border-white/[0.06]"
      style={{ background: "#0B0B0E" }}
    >
      <div className="px-5 pt-5 pb-4 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-[#E2435B] opacity-50 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#E2435B]" />
        </span>
        <span className="text-[13px] font-semibold tracking-tight text-zinc-100">Axon</span>
        <span className="text-[11px] text-zinc-500 ml-1">{axon ? "watching the operation" : "standby"}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: "thin" }}>
        <div
          className="rounded-lg p-4 mb-4"
          style={{ background: "#16161A" }}
        >
          <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-600 mb-2">Axon's read</div>
          <p className="text-[12.5px] text-zinc-300 leading-relaxed [overflow-wrap:anywhere]">
            {lastAxon?.text
              ? lastAxon.text
              : "I'm watching deals, tasks and the calendar. Ask me anything, or tap a card and I'll act on it."}
          </p>
        </div>

        {turns.length > 0 && (
          <div className="space-y-3 pb-4">
            {turns.slice(-8).map((t, i) => (
              <div key={i} className={t.role === "user" ? "text-right" : "text-left"}>
                <span
                  className="inline-block max-w-[88%] text-[12.5px] leading-relaxed rounded-lg px-3 py-2 [overflow-wrap:anywhere]"
                  style={
                    t.role === "user"
                      ? { background: "#1F1F25", color: "#E4E4E7" }
                      : t.role === "system"
                        ? { color: "#71717A", fontStyle: "italic" }
                        : { background: "transparent", color: "#D4D4D8" }
                  }
                >
                  {t.text}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-5 pt-2 pb-3">
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              disabled={!axon}
              onClick={() => send(c)}
              className="text-[11px] px-2.5 py-1 rounded-full transition-colors disabled:opacity-40"
              style={{ background: "#1A1A1F", color: "#A1A1AA" }}
            >
              {c}
            </button>
          ))}
        </div>
        <div
          className="flex items-center gap-2 rounded-lg px-3 h-10"
          style={{ background: "#16161A", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <Sparkles size={14} className="text-[#E2435B]/80 shrink-0" strokeWidth={1.75} />
          <input
            id={AXON_RAIL_INPUT_ID}
            value={draft}
            disabled={!axon}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send(draft);
            }}
            placeholder={axon ? "Ask Axon anything…" : "Axon unavailable for your role"}
            className="flex-1 bg-transparent outline-none text-[13px] text-zinc-100 placeholder:text-zinc-600"
          />
          <button
            type="button"
            disabled={!axon || !draft.trim()}
            onClick={() => send(draft)}
            className="h-6 w-6 rounded-md flex items-center justify-center disabled:opacity-30"
            style={{ background: "#E2435B" }}
            aria-label="Send to Axon"
          >
            <ArrowUp size={14} className="text-white" strokeWidth={2} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default AxonRail;
