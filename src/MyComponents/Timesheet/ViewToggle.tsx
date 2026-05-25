/**
 * ViewToggle.tsx — Me / Team / Person three-way segmented control.
 *
 * Mirrors the editorial language used elsewhere (Tracker, Mono): low-key
 * border, active mode is filled with primary tint. The Person tab does
 * not pick a person — the parent surfaces a separate dropdown for that.
 */

import { User, Users, UserSearch } from "lucide-react";

export type ViewMode = "me" | "team" | "person";

const MODES: { id: ViewMode; label: string; icon: typeof User }[] = [
  { id: "me",     label: "Me",     icon: User },
  { id: "team",   label: "Team",   icon: Users },
  { id: "person", label: "Person", icon: UserSearch },
];

interface Props {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}

export function ViewToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex items-center rounded-md border border-border bg-card overflow-hidden">
      {MODES.map((m, i) => {
        const isActive = value === m.id;
        const Icon = m.icon;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            data-active={isActive}
            aria-pressed={isActive}
            className={[
              "inline-flex items-center gap-1.5 h-8 px-3 text-[11.5px] font-bold uppercase tracking-wider transition-colors",
              isActive
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary",
              i > 0 ? "border-l border-border" : "",
            ].join(" ")}
          >
            <Icon className="w-3 h-3" />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
