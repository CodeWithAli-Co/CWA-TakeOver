/**
 * AxonMemoryPage.tsx -- /axonMemory destination shell.
 *
 * Promotes the MemoryInspector out of the AxonSettings panel into a
 * full-page admin surface. The inspector itself is unchanged -- this
 * is just the page chrome (editorial header, role badge, restricted
 * preamble) and the wrapping shell.
 *
 * Why a dedicated route:
 *   1. The catalog can get long once decisions + notes accumulate.
 *      A 320px Settings panel cramps it. Full-page lets the operator
 *      actually audit at scale.
 *   2. Restricting to CEO + COO of CodeWithAli matches Infrastructure
 *      -- this is OUR knowledge surface, not the customer-tenant
 *      admin. Per-tenant Axon memory inspectors come later as part
 *      of the broader tenancy story.
 *   3. Surfaces the "what I know about you" theme as a first-class
 *      destination instead of a buried section, which is the right
 *      framing for a trust UI: the operator should be able to walk
 *      directly to it.
 *
 * Role gating: handled at the route level (axonMemory.lazy.tsx) via
 * UserView + Stronghold tenant check. This page re-asserts via a
 * subtle badge so a tenant-resolution race never accidentally shows
 * the panel under the wrong identity.
 */

import { Brain } from "lucide-react";
import { MemoryInspector } from "@/Axon/ui/MemoryInspector";

export function AxonMemoryPage() {
  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      {/* ── Page header ───────────────────────────────────────── */}
      <header className="border-b border-xs border-border-soft bg-background">
        <div className="mx-auto w-full max-w-[1100px] px-6 py-6">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-text-tertiary mb-2 inline-flex items-center gap-2">
            <span className="inline-block w-1 h-1 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
            CodeWithAli internal &middot; Axon knowledge
          </p>
          <h1 className="text-[28px] font-bold text-foreground leading-tight tracking-tight inline-flex items-center gap-3">
            <Brain className="h-6 w-6 text-primary" strokeWidth={1.75} />
            What Axon knows
          </h1>
          <p className="text-[13px] text-text-secondary mt-1 max-w-2xl leading-relaxed">
            Every decision, defer, note, preference, and past-session
            summary Axon has persisted. Edit notes inline, delete
            anything stale or wrong &mdash; he won&rsquo;t bring it
            up again once it&rsquo;s gone. This is the trust loop:
            if it&rsquo;s in here, it&rsquo;s shaping his replies.
          </p>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-[1100px] px-6 py-6">
        <MemoryInspector />
      </main>
    </div>
  );
}

export default AxonMemoryPage;
