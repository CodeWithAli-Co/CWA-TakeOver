// ───────────────────────────────────────────────────────────────────
// MemoryInspector -- "what I know about you" UI.
//
// Operators can audit, edit, and delete every persisted memory entry.
// Surfaces the accumulation that Polish D's recall action queries
// against, so the operator can correct hallucinated facts or remove
// stale ones without going through the voice path.
//
// Mounted inside AxonSettings (Memory section) but lives in its own
// file because the catalog patterns are non-trivial and the component
// may graduate to a top-level Memory tab in CommandPanel later.
// ───────────────────────────────────────────────────────────────────

import { useState, useMemo, useCallback } from "react";
import {
  loadMemory,
  saveMemory,
  type PersistentMemory,
  type MemoryNote,
  type DecisionEntry,
  type DeferEntry,
  type SessionSummary,
  type OperatorProfile,
} from "../engine/memory";

type Channel = "decisions" | "defers" | "notes" | "preferences" | "sessions";

const CHANNEL_LABEL: Record<Channel, string> = {
  decisions: "Decisions",
  defers: "Deferred",
  notes: "Notes",
  preferences: "Preferences",
  sessions: "Past sessions",
};

const CHANNEL_TONE: Record<Channel, string> = {
  decisions: "hsl(140 60% 55%)",
  defers: "hsl(40 70% 60%)",
  notes: "hsl(210 70% 70%)",
  preferences: "hsl(280 60% 70%)",
  sessions: "hsl(0 0% 60%)",
};

function humanizeAgo(ms: number): string {
  if (ms <= 0) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  return `${w}w ago`;
}

// ── Knowledge-of-you digest ────────────────────────────────────────
//
// Summarizes what Axon has accumulated: counts per channel + most
// recent activity. Sits at the top so the operator gets the gestalt
// before drilling into individual entries.

function KnowledgeDigest({ mem }: { mem: PersistentMemory }) {
  const totalItems =
    mem.notes.length +
    mem.decisions.length +
    mem.defers.length +
    Object.keys(mem.prefs).length +
    mem.sessionSummaries.length;

  const mostRecent = useMemo(() => {
    const all: Array<{ ts: number; kind: string }> = [
      ...mem.notes.map((n) => ({ ts: n.ts, kind: "note" })),
      ...mem.decisions.map((d) => ({ ts: d.ts, kind: "decision" })),
      ...mem.defers.map((d) => ({ ts: d.ts, kind: "defer" })),
      ...mem.sessionSummaries.map((s) => ({ ts: s.ts, kind: "session recap" })),
    ];
    all.sort((a, b) => b.ts - a.ts);
    return all[0];
  }, [mem]);

  if (totalItems === 0) {
    return (
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 10,
          background: "hsl(0 0% 50% / 0.06)",
          border: "1px solid hsl(0 0% 50% / 0.15)",
          marginBottom: 14,
          fontSize: 12,
          lineHeight: 1.55,
          color: "var(--axon-muted)",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--axon-fg, inherit)" }}>
          Empty so far.
        </div>
        I&rsquo;ll start building up context as you save notes, make
        decisions, or set preferences. Try saying &ldquo;remember that
        I prefer async over meetings,&rdquo; or &ldquo;log that I&rsquo;m
        going with vendor B.&rdquo;
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 10,
        background: "hsl(210 30% 45% / 0.07)",
        border: "1px solid hsl(210 30% 45% / 0.2)",
        marginBottom: 14,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: "hsl(210 60% 75%)",
          marginBottom: 6,
        }}
      >
        WHAT I KNOW ABOUT YOU
      </div>
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.55,
          color: "var(--axon-fg, inherit)",
        }}
      >
        {totalItems} {totalItems === 1 ? "thing" : "things"} in memory
        &mdash; {mem.decisions.length} decision
        {mem.decisions.length === 1 ? "" : "s"}, {mem.defers.length} deferred,{" "}
        {mem.notes.length} note{mem.notes.length === 1 ? "" : "s"},{" "}
        {Object.keys(mem.prefs).length} preference
        {Object.keys(mem.prefs).length === 1 ? "" : "s"}.
      </div>
      {mostRecent && (
        <div
          style={{
            fontSize: 11.5,
            color: "var(--axon-muted)",
            marginTop: 6,
          }}
        >
          Most recent: {mostRecent.kind} from {humanizeAgo(Date.now() - mostRecent.ts)}.
        </div>
      )}
    </div>
  );
}

// ── Row primitives ─────────────────────────────────────────────────
//
// Each channel renders with the same shape: a tiny tone chip, the
// text, the timestamp, and a delete button. Editable channels (notes)
// get a click-to-edit affordance; decisions / defers / sessions stay
// read-only because they're historical record.

interface RowProps {
  channel: Channel;
  text: string;
  ts: number;
  editable?: boolean;
  onDelete: () => void;
  onEdit?: (next: string) => void;
}

function Row({ channel, text, ts, editable, onDelete, onEdit }: RowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== text && onEdit) onEdit(trimmed);
    setEditing(false);
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid hsl(0 0% 50% / 0.15)",
        background: "hsl(0 0% 100% / 0.02)",
        marginBottom: 6,
        alignItems: "flex-start",
      }}
    >
      <span
        style={{
          width: 4,
          alignSelf: "stretch",
          background: CHANNEL_TONE[channel],
          borderRadius: 2,
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setDraft(text);
                setEditing(false);
              } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                commit();
              }
            }}
            autoFocus
            style={{
              width: "100%",
              minHeight: 50,
              padding: 6,
              fontSize: 12,
              fontFamily: "inherit",
              lineHeight: 1.4,
              background: "var(--axon-bg, transparent)",
              color: "var(--axon-fg, inherit)",
              border: "1px solid hsl(210 60% 50% / 0.4)",
              borderRadius: 4,
              resize: "vertical",
            }}
          />
        ) : (
          <div
            onClick={editable ? () => setEditing(true) : undefined}
            style={{
              fontSize: 12,
              lineHeight: 1.45,
              color: "var(--axon-fg, inherit)",
              wordBreak: "break-word",
              cursor: editable ? "text" : "default",
            }}
            title={editable ? "Click to edit" : undefined}
          >
            {text}
          </div>
        )}
        {ts > 0 && (
          <div
            style={{
              fontSize: 10.5,
              color: "var(--axon-muted)",
              marginTop: 4,
              letterSpacing: "0.02em",
            }}
          >
            {humanizeAgo(Date.now() - ts)}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        style={{
          background: "transparent",
          border: "1px solid hsl(0 0% 50% / 0.25)",
          color: "var(--axon-muted)",
          padding: "3px 8px",
          fontSize: 10.5,
          borderRadius: 4,
          cursor: "pointer",
          flexShrink: 0,
          transition: "background 120ms ease, color 120ms ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "hsl(0 60% 50% / 0.15)";
          (e.currentTarget as HTMLButtonElement).style.color = "hsl(0 60% 80%)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--axon-muted)";
        }}
        title="Remove this memory entry"
      >
        Forget
      </button>
    </div>
  );
}

// ── Channel section ────────────────────────────────────────────────

function ChannelSection({
  channel,
  count,
  children,
  onClearAll,
}: {
  channel: Channel;
  count: number;
  children: React.ReactNode;
  onClearAll?: () => void;
}) {
  if (count === 0) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: CHANNEL_TONE[channel],
          }}
        >
          {CHANNEL_LABEL[channel].toUpperCase()} &middot; {count}
        </div>
        {onClearAll && (
          <button
            type="button"
            onClick={onClearAll}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--axon-muted)",
              fontSize: 10.5,
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
              opacity: 0.7,
            }}
            title={`Clear all ${CHANNEL_LABEL[channel].toLowerCase()}`}
          >
            clear all
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Top-level inspector ────────────────────────────────────────────

// ── Profile section ────────────────────────────────────────────────
//
// Surfaces the structured OperatorProfile (F.3). Distinct from the
// channel sections because profile fields are typed and not
// timestamped -- they're identity-level rather than event-level. The
// operator edits each field inline; arrays are comma-split on save.

const PROFILE_FIELDS: Array<{
  key: keyof OperatorProfile;
  label: string;
  array?: boolean;
  hint?: string;
}> = [
  { key: "partner_name", label: "Partner" },
  { key: "family", label: "Family", hint: "e.g. 'two kids, Lily (7) and Max (4)'" },
  { key: "location", label: "Location" },
  { key: "timezone", label: "Timezone" },
  { key: "workday_start", label: "Workday start", hint: "e.g. '8am'" },
  { key: "workday_end", label: "Workday end" },
  { key: "lunch_time", label: "Lunch" },
  { key: "focus_block", label: "Focus block", hint: "e.g. '9-11am Mon-Fri'" },
  { key: "exercise", label: "Exercise" },
  { key: "comm_style", label: "Comm style", hint: "'terse', 'detailed', 'no follow-ups'" },
  { key: "avoid_topics", label: "Avoid topics", array: true, hint: "comma-separated" },
  { key: "current_focus", label: "Current focus" },
  { key: "stressors", label: "Stressors", array: true, hint: "comma-separated" },
  { key: "wins", label: "Recent wins", array: true, hint: "comma-separated" },
];

function ProfileFieldRow({
  field,
  value,
  array,
  hint,
  onSave,
  onClear,
}: {
  field: string;
  value: string;
  array?: boolean;
  hint?: string;
  onSave: (next: string) => void;
  onClear: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const filled = value.length > 0;

  const commit = () => {
    if (draft.trim() !== value) onSave(draft.trim());
    setEditing(false);
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 6,
        border: "1px solid hsl(0 0% 50% / 0.12)",
        background: filled ? "hsl(0 0% 100% / 0.02)" : "transparent",
        marginBottom: 4,
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 110,
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: "var(--axon-muted)",
          flexShrink: 0,
        }}
      >
        {field}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setDraft(value);
                setEditing(false);
              }
            }}
            autoFocus
            placeholder={hint}
            style={{
              width: "100%",
              padding: "3px 6px",
              fontSize: 12,
              fontFamily: "inherit",
              background: "var(--axon-bg, transparent)",
              color: "var(--axon-fg, inherit)",
              border: "1px solid hsl(210 60% 50% / 0.4)",
              borderRadius: 3,
            }}
          />
        ) : (
          <div
            onClick={() => setEditing(true)}
            style={{
              fontSize: 12,
              lineHeight: 1.45,
              color: filled
                ? "var(--axon-fg, inherit)"
                : "var(--axon-muted)",
              fontStyle: filled ? "normal" : "italic",
              cursor: "text",
              wordBreak: "break-word",
              padding: "2px 0",
            }}
            title="Click to edit"
          >
            {filled ? value : hint ?? "Not set"}
          </div>
        )}
      </div>
      {filled && !editing && (
        <button
          type="button"
          onClick={onClear}
          style={{
            background: "transparent",
            border: "1px solid hsl(0 0% 50% / 0.2)",
            color: "var(--axon-muted)",
            padding: "2px 6px",
            fontSize: 10,
            borderRadius: 3,
            cursor: "pointer",
            flexShrink: 0,
          }}
          title="Clear this field"
        >
          clear
        </button>
      )}
      {array && filled && (
        <span
          style={{
            fontSize: 9.5,
            color: "var(--axon-muted)",
            opacity: 0.6,
            flexShrink: 0,
          }}
        >
          list
        </span>
      )}
    </div>
  );
}

function ProfileSection({
  profile,
  onUpdate,
}: {
  profile: OperatorProfile;
  onUpdate: (next: OperatorProfile) => void;
}) {
  const filledCount = PROFILE_FIELDS.reduce((n, f) => {
    const v = profile[f.key];
    if (Array.isArray(v)) return n + (v.length > 0 ? 1 : 0);
    return n + (v ? 1 : 0);
  }, 0);
  const extras = profile.extras ?? {};
  const totalFilled = filledCount + Object.keys(extras).length;

  return (
    <div style={{ marginBottom: 22 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "hsl(210 70% 70%)",
          }}
        >
          PROFILE &middot; {totalFilled}/{PROFILE_FIELDS.length + Object.keys(extras).length}
        </div>
      </div>

      <div style={{ fontSize: 11, color: "var(--axon-muted)", marginBottom: 10, lineHeight: 1.5 }}>
        Structured facts that get surfaced in conversation at the right
        moments &mdash; lunch time near lunch, partner only in personal
        contexts, current focus always. Click any field to edit.
      </div>

      {PROFILE_FIELDS.map((f) => {
        const raw = profile[f.key];
        const display = Array.isArray(raw)
          ? raw.join(", ")
          : typeof raw === "string"
            ? raw
            : "";
        return (
          <ProfileFieldRow
            key={String(f.key)}
            field={f.label}
            value={display}
            array={f.array}
            hint={f.hint}
            onSave={(next) => {
              const value = f.array
                ? next
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0)
                : next;
              onUpdate({ ...profile, [f.key]: value });
            }}
            onClear={() => {
              const cleared = { ...profile };
              delete cleared[f.key];
              onUpdate(cleared);
            }}
          />
        );
      })}

      {/* Extras section -- ad-hoc facts the operator set via
       *  set_profile_extra. Each is a key:value row with delete. */}
      {Object.keys(extras).length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: "var(--axon-muted)",
              marginBottom: 6,
            }}
          >
            EXTRAS
          </div>
          {Object.entries(extras).map(([key, value]) => (
            <ProfileFieldRow
              key={key}
              field={key}
              value={value}
              onSave={(next) =>
                onUpdate({
                  ...profile,
                  extras: { ...extras, [key]: next },
                })
              }
              onClear={() => {
                const nextExtras = { ...extras };
                delete nextExtras[key];
                onUpdate({ ...profile, extras: nextExtras });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function MemoryInspector() {
  // Re-load on each render -- this component is small + memory is
  // localStorage-backed so the reads are essentially free. Avoids
  // the staleness traps of holding a snapshot in state.
  const [version, setVersion] = useState(0);
  const mem = useMemo(() => loadMemory(), [version]);

  const persist = useCallback(
    (next: PersistentMemory) => {
      saveMemory(next);
      setVersion((v) => v + 1);
    },
    [],
  );

  // ── Mutators ──────────────────────────────────────────────────
  const deleteDecision = (id: string) =>
    persist({ ...mem, decisions: mem.decisions.filter((d) => d.id !== id) });
  const deleteDefer = (id: string) =>
    persist({ ...mem, defers: mem.defers.filter((d) => d.id !== id) });
  const deleteNote = (id: string) =>
    persist({ ...mem, notes: mem.notes.filter((n) => n.id !== id) });
  const deletePref = (key: string) => {
    const next = { ...mem.prefs };
    delete next[key];
    persist({ ...mem, prefs: next });
  };
  const deleteSession = (id: string) =>
    persist({
      ...mem,
      sessionSummaries: mem.sessionSummaries.filter((s) => s.id !== id),
    });

  const editNote = (id: string, next: string) =>
    persist({
      ...mem,
      notes: mem.notes.map((n: MemoryNote) =>
        n.id === id ? { ...n, text: next } : n,
      ),
    });

  const clearChannel = (channel: Channel) => {
    if (channel === "decisions") persist({ ...mem, decisions: [] });
    if (channel === "defers") persist({ ...mem, defers: [] });
    if (channel === "notes") persist({ ...mem, notes: [] });
    if (channel === "preferences") persist({ ...mem, prefs: {} });
    if (channel === "sessions") persist({ ...mem, sessionSummaries: [] });
  };

  // ── Profile mutators ──────────────────────────────────────────
  // ProfileSection edits the whole profile object at a time; this is
  // cleaner than threading per-field setters through. The persist()
  // call serializes the whole memory blob anyway, so there's no
  // efficiency loss.
  const updateProfile = (next: OperatorProfile) =>
    persist({ ...mem, profile: next });

  return (
    <div style={{ marginTop: 4 }}>
      <KnowledgeDigest mem={mem} />

      {/* Profile -- the F.3 structured "knows you" layer. Distinct
       *  visual treatment from the channel sections because these are
       *  typed identity fields, not timestamped events. */}
      <ProfileSection profile={mem.profile} onUpdate={updateProfile} />

      {/* Decisions -- read-only historical record. */}
      <ChannelSection
        channel="decisions"
        count={mem.decisions.length}
        onClearAll={() => clearChannel("decisions")}
      >
        {mem.decisions
          .slice()
          .reverse()
          .map((d: DecisionEntry) => (
            <Row
              key={d.id}
              channel="decisions"
              text={d.text}
              ts={d.ts}
              onDelete={() => deleteDecision(d.id)}
            />
          ))}
      </ChannelSection>

      {/* Defers -- read-only. */}
      <ChannelSection
        channel="defers"
        count={mem.defers.length}
        onClearAll={() => clearChannel("defers")}
      >
        {mem.defers
          .slice()
          .reverse()
          .map((d: DeferEntry) => (
            <Row
              key={d.id}
              channel="defers"
              text={d.text}
              ts={d.ts}
              onDelete={() => deleteDefer(d.id)}
            />
          ))}
      </ChannelSection>

      {/* Notes -- editable. */}
      <ChannelSection
        channel="notes"
        count={mem.notes.length}
        onClearAll={() => clearChannel("notes")}
      >
        {mem.notes
          .slice()
          .reverse()
          .map((n: MemoryNote) => (
            <Row
              key={n.id}
              channel="notes"
              text={n.text}
              ts={n.ts}
              editable
              onDelete={() => deleteNote(n.id)}
              onEdit={(next) => editNote(n.id, next)}
            />
          ))}
      </ChannelSection>

      {/* Preferences -- no ts, key:value shape. */}
      <ChannelSection
        channel="preferences"
        count={Object.keys(mem.prefs).length}
        onClearAll={() => clearChannel("preferences")}
      >
        {Object.entries(mem.prefs).map(([key, value]) => (
          <Row
            key={key}
            channel="preferences"
            text={`${key}: ${value}`}
            ts={0}
            onDelete={() => deletePref(key)}
          />
        ))}
      </ChannelSection>

      {/* Sessions -- read-only history. */}
      <ChannelSection
        channel="sessions"
        count={mem.sessionSummaries.length}
        onClearAll={() => clearChannel("sessions")}
      >
        {mem.sessionSummaries
          .slice()
          .reverse()
          .map((s: SessionSummary) => (
            <Row
              key={s.id}
              channel="sessions"
              text={s.summary}
              ts={s.ts}
              onDelete={() => deleteSession(s.id)}
            />
          ))}
      </ChannelSection>
    </div>
  );
}
