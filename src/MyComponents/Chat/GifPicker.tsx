/**
 * GifPicker.tsx — Tenor-powered GIF search popover.
 *
 * Uses Tenor's public v2 "search" + "featured" endpoints. The API key
 * is a Google-issued public one — free, no signup. If the caller wants
 * stricter limits they can set VITE_TENOR_KEY and this file will pick
 * it up.
 *
 * GIF URLs returned here are passed up to the composer which appends
 * them to the message body. MessageBubble's image extractor recognizes
 * tenor.com / giphy.com URLs and renders them inline.
 */

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Search, Loader2, Image as ImgIcon } from "lucide-react";

// Tenor's public demo key works without OAuth for low-volume use.
const TENOR_KEY = (import.meta as any).env?.VITE_TENOR_KEY || "LIVDSRZULELA";

interface TenorResult {
  id: string;
  title: string;
  media_formats?: {
    gif?: { url: string; dims: [number, number] };
    tinygif?: { url: string; dims: [number, number] };
    mediumgif?: { url: string; dims: [number, number] };
  };
  // v1-style fallback
  url?: string;
  media?: { gif?: { url: string }; tinygif?: { url: string } }[];
}

interface Props {
  onPick: (url: string) => void;
  onClose: () => void;
}

async function fetchTenor(query: string, limit = 24): Promise<TenorResult[]> {
  const base = query
    ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}`
    : "https://tenor.googleapis.com/v2/featured";
  const url = `${base}&key=${TENOR_KEY}&limit=${limit}&media_filter=tinygif,gif,mediumgif&contentfilter=medium`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = await r.json();
    return (j?.results ?? []) as TenorResult[];
  } catch {
    return [];
  }
}

function pickUrl(r: TenorResult, kind: "tinygif" | "gif" = "tinygif"): string | null {
  const mf = r.media_formats;
  if (mf) {
    return mf[kind]?.url ?? mf.gif?.url ?? mf.mediumgif?.url ?? null;
  }
  // v1 fallback shape
  const m = r.media?.[0];
  return m?.tinygif?.url ?? m?.gif?.url ?? null;
}

export function GifPicker({ onPick }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TenorResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastQueryRef = useRef("");

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
    // Initial featured load
    setLoading(true);
    fetchTenor("").then((r) => { setResults(r); setLoading(false); });
  }, []);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      const q = query.trim();
      if (q === lastQueryRef.current) return;
      lastQueryRef.current = q;
      setLoading(true);
      fetchTenor(q).then((r) => {
        if (lastQueryRef.current === q) {
          setResults(r);
          setLoading(false);
        }
      });
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.98 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="w-[380px] overflow-hidden rounded-xl border border-border/70 bg-popover/95 shadow-2xl backdrop-blur-md"
      style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.55)" }}
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <ImgIcon className="h-3.5 w-3.5 text-primary" />
        <span className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
          GIFs
        </span>
        <span className="ml-auto text-[9.5px] text-muted-foreground/70">
          powered by Tenor
        </span>
      </div>

      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search GIFs…"
            className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {loading && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground/60" />
          )}
        </div>
      </div>

      <div className="grid max-h-[380px] grid-cols-2 gap-1 overflow-y-auto px-2 pb-2">
        {results.length === 0 && !loading ? (
          <div className="col-span-2 py-10 text-center text-[11.5px] text-muted-foreground">
            No GIFs found.
          </div>
        ) : (
          results.map((r) => {
            const thumb = pickUrl(r, "tinygif");
            const full = pickUrl(r, "gif") ?? thumb;
            if (!thumb || !full) return null;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onPick(full)}
                className="relative overflow-hidden rounded-md border border-border/40 bg-background/30 transition hover:border-primary/40 hover:ring-1 hover:ring-primary/30"
                title={r.title}
              >
                <img
                  src={thumb}
                  alt={r.title || "gif"}
                  loading="lazy"
                  className="h-[120px] w-full object-cover"
                />
              </button>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
