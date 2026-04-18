/**
 * MentionPicker.tsx — Popover that appears while typing @ in the composer.
 *
 * Filters `members` by the current query, supports arrow/enter/escape, and
 * calls onPick with the selected username.
 */

import { useEffect, useRef } from "react";
import { AtSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  members: string[];
  query: string;
  activeIndex: number;
  onPick: (username: string) => void;
  onSetIndex: (idx: number) => void;
}

export function MentionPicker({
  members, query, activeIndex, onPick, onSetIndex,
}: Props) {
  const filtered = members
    .filter((m) => m.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-mention-idx="${activeIndex}"]`,
    );
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (filtered.length === 0) {
    return (
      <div className="w-[240px] rounded-md border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground">
        No members matching “{query}”
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className="max-h-60 w-[240px] overflow-y-auto rounded-md border border-border bg-card py-1"
      style={{ boxShadow: "0 12px 32px rgba(0,0,0,0.5)" }}
    >
      <div className="px-3 py-1 font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
        People
      </div>
      {filtered.map((name, i) => {
        const active = i === activeIndex;
        return (
          <button
            key={name}
            type="button"
            data-mention-idx={i}
            onClick={() => onPick(name)}
            onMouseEnter={() => onSetIndex(i)}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] transition-colors",
              active
                ? "bg-muted text-foreground"
                : "text-foreground/85 hover:bg-muted/60",
            )}
          >
            <AtSign className="h-3 w-3 text-primary" />
            <span className="truncate">{name}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Given the text + caret position, find any unclosed `@xxx` token being
 *  typed and return its query (without `@`) + the index it started at. */
export function detectMentionQuery(
  text: string,
  caret: number,
): { query: string; startIndex: number } | null {
  // Walk backwards from caret until we hit whitespace or the start.
  let i = caret - 1;
  while (i >= 0) {
    const c = text[i]!;
    if (c === "@") {
      // Must be preceded by whitespace, newline, or start-of-string
      const prev = i === 0 ? "" : text[i - 1]!;
      if (i === 0 || /\s/.test(prev)) {
        return { query: text.slice(i + 1, caret), startIndex: i };
      }
      return null;
    }
    if (/\s/.test(c)) return null;
    i--;
  }
  return null;
}
