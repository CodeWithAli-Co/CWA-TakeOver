/**
 * RegistryItemCard — single gallery tile for a registry item.
 * Shows cover (or placeholder glyph), name, kind badge, company
 * chip, install count, and last-published timestamp.
 */

import { Component as CompIcon, Package, Download, Clock, Building2, Globe2 } from "lucide-react";
import type { RegistryItemWithLatest } from "./types";

interface Props {
  item: RegistryItemWithLatest;
  onClick: () => void;
}

const KIND_STYLES: Record<string, { Icon: typeof Package; label: string; chipClass: string; accentClass: string }> = {
  component: {
    Icon: CompIcon,
    label: "Component",
    chipClass: "bg-blue-500/15 text-blue-300 border-blue-400/30",
    accentClass: "from-blue-500/15 to-blue-500/5",
  },
  template: {
    Icon: Package,
    label: "Template",
    chipClass: "bg-purple-500/15 text-purple-300 border-purple-400/30",
    accentClass: "from-purple-500/15 to-purple-500/5",
  },
};

const COMPANY_STYLES: Record<string, { label: string; className: string; Icon: typeof Building2 }> = {
  cwa:        { label: "CWA",        className: "bg-red-500/10 text-red-300 border-red-400/30",         Icon: Building2 },
  simplicity: { label: "Simplicity", className: "bg-emerald-500/10 text-emerald-300 border-emerald-400/30", Icon: Building2 },
  shared:     { label: "Shared",     className: "bg-zinc-500/10 text-zinc-300 border-zinc-400/20",      Icon: Globe2 },
};

export function RegistryItemCard({ item, onClick }: Props) {
  const kindSpec = KIND_STYLES[item.kind];
  const companySpec = COMPANY_STYLES[item.company];
  const KindIcon = kindSpec.Icon;
  const CompanyIcon = companySpec.Icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5"
    >
      {/* Cover */}
      <div
        className={`relative flex h-28 items-center justify-center overflow-hidden bg-gradient-to-br ${kindSpec.accentClass}`}
      >
        {item.coverUrl ? (
          <img
            src={item.coverUrl}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <KindIcon className="h-10 w-10 text-foreground/30" />
        )}
        {/* Kind chip over the cover */}
        <span
          className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider backdrop-blur-sm ${kindSpec.chipClass}`}
        >
          <KindIcon className="h-2.5 w-2.5" />
          {kindSpec.label}
        </span>
        {/* Version badge */}
        {item.latestVersionStr && (
          <span className="absolute right-2 top-2 rounded-full border border-white/15 bg-black/40 px-1.5 py-0.5 text-[9.5px] font-semibold text-white/90 backdrop-blur-sm">
            v{item.latestVersionStr}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-[13.5px] font-semibold text-foreground">
            {item.name}
          </h3>
          <span
            className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9.5px] font-semibold ${companySpec.className}`}
            title={`Scope: ${companySpec.label}`}
          >
            <CompanyIcon className="h-2.5 w-2.5" />
            {companySpec.label}
          </span>
        </div>

        <p className="line-clamp-2 min-h-[30px] text-[11.5px] text-muted-foreground leading-snug">
          {item.description || <em className="italic opacity-60">No description</em>}
        </p>

        {/* Tags */}
        {item.tags.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded bg-muted/70 px-1.5 py-0.5 text-[9.5px] font-medium text-muted-foreground"
              >
                {t}
              </span>
            ))}
            {item.tags.length > 3 && (
              <span className="text-[9.5px] text-muted-foreground/70">
                +{item.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer — install count + published-at */}
        <div className="mt-auto flex items-center justify-between pt-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Download className="h-2.5 w-2.5" />
            {item.installCount} {item.installCount === 1 ? "install" : "installs"}
          </span>
          {item.latestPublishedAt && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {formatRelative(item.latestPublishedAt)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// Compact "3d ago" / "2mo ago" formatter — no external dep.
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const s = Math.max(1, Math.floor(diffMs / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(mo / 12);
  return `${y}y ago`;
}
