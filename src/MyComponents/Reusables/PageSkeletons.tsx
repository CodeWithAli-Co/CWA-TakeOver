/**
 * PageSkeletons.tsx — Reusable skeleton blocks used everywhere a page
 * is still loading. Keeps the app from flashing blank white/black
 * areas during route chunks or data suspense.
 *
 * Primitive:
 *   Shimmer — a subtle animate-pulse wrapped in a muted rounded bg.
 *
 * Composites:
 *   DashboardSkeleton — generic 12-col grid with cards (home/index pages)
 *   TableSkeleton     — header row + N body rows (employee, invoice lists)
 *   ChatSkeleton      — sidebar + message feed mock (chat route pendings)
 *   FormSkeleton      — label/input stacks (settings, forms)
 *   SplitSkeleton     — two-pane (list + detail)
 *   PageSkeleton      — default chunky loader used by <Suspense> fallback
 */

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Shimmer({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn(
        "relative overflow-hidden rounded-md bg-muted/40",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/5 before:to-transparent",
        className,
      )}
    />
  );
}

// Default "something is loading" fallback for Suspense boundaries.
export function PageSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen w-full bg-background overflow-hidden"
    >
      {/* Header bar */}
      <div className="px-8 pt-7 pb-4 flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Shimmer className="h-7 w-64" />
          <Shimmer className="h-3 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Shimmer className="h-9 w-9 rounded-full" />
          <Shimmer className="h-9 w-9 rounded-full" />
          <Shimmer className="h-9 w-24 rounded-md" />
        </div>
      </div>

      {/* Body: 12-col grid */}
      <div className="px-8 pb-10 grid grid-cols-12 gap-4">
        <Shimmer className="col-span-12 h-28 rounded-lg" />
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-3">
          <Shimmer className="h-44 rounded-lg" />
          <Shimmer className="h-24 rounded-lg" />
        </div>
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-3">
          <Shimmer className="h-32 rounded-lg" />
          <Shimmer className="h-56 rounded-lg" />
        </div>
        <Shimmer className="col-span-6 lg:col-span-4 h-36 rounded-lg" />
        <Shimmer className="col-span-6 lg:col-span-4 h-36 rounded-lg" />
        <Shimmer className="col-span-12 lg:col-span-4 h-36 rounded-lg" />
      </div>
    </motion.div>
  );
}

export function DashboardSkeleton() {
  return <PageSkeleton />;
}

export function ChatSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex h-[100dvh] w-full bg-background"
    >
      {/* Sidebar */}
      <div className="flex w-[260px] flex-col gap-2 border-r border-border p-3">
        <Shimmer className="h-8 w-full" />
        <Shimmer className="h-4 w-24" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Shimmer key={i} className="h-7 w-full" />
        ))}
      </div>

      {/* Main chat */}
      <div className="flex-1 flex flex-col">
        {/* header */}
        <div className="flex items-center gap-3 border-b border-border p-4">
          <Shimmer className="h-8 w-8 rounded-full" />
          <Shimmer className="h-5 w-40" />
          <Shimmer className="ml-auto h-8 w-24 rounded-md" />
        </div>
        {/* messages */}
        <div className="flex-1 space-y-3 overflow-hidden p-5">
          {[72, 120, 88, 160, 104, 140, 64, 110].map((w, i) => (
            <div
              key={i}
              className={`flex items-end gap-2 ${i % 3 === 0 ? "flex-row-reverse" : ""}`}
            >
              <Shimmer className="h-8 w-8 rounded-full" />
              <div className="flex flex-col gap-1">
                <Shimmer className="h-3 w-24" />
                <Shimmer className={`h-8 rounded-lg`} style={{ width: w }} />
              </div>
            </div>
          ))}
        </div>
        {/* composer */}
        <div className="border-t border-border p-4">
          <Shimmer className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </motion.div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="px-8 pt-8 pb-10"
    >
      <Shimmer className="h-7 w-48 mb-6" />
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-6 gap-3 border-b border-border bg-muted/20 px-4 py-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Shimmer key={i} className="h-3 w-full" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-6 gap-3 border-b border-border/60 px-4 py-3 last:border-0"
          >
            {Array.from({ length: 6 }).map((__, j) => (
              <Shimmer key={j} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function SplitSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex h-[100dvh] w-full"
    >
      <div className="w-[280px] border-r border-border p-3 space-y-2">
        <Shimmer className="h-8 w-full" />
        {Array.from({ length: 10 }).map((_, i) => (
          <Shimmer key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
      <div className="flex-1 p-8 space-y-4">
        <Shimmer className="h-7 w-60" />
        <Shimmer className="h-3 w-40" />
        <Shimmer className="h-48 w-full rounded-lg" />
        <div className="grid grid-cols-3 gap-3">
          <Shimmer className="h-24 rounded-lg" />
          <Shimmer className="h-24 rounded-lg" />
          <Shimmer className="h-24 rounded-lg" />
        </div>
      </div>
    </motion.div>
  );
}

export function FormSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="max-w-3xl mx-auto px-8 pt-8 pb-10 space-y-5"
    >
      <Shimmer className="h-7 w-48" />
      <Shimmer className="h-3 w-72" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Shimmer className="h-3 w-24" />
          <Shimmer className="h-10 w-full rounded-md" />
        </div>
      ))}
      <Shimmer className="h-10 w-32 rounded-md" />
    </motion.div>
  );
}

export function RoadmapSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen bg-background p-6 space-y-4"
    >
      {/* TopBar mock */}
      <div className="flex items-center gap-2">
        <Shimmer className="h-8 w-40" />
        <Shimmer className="h-8 w-24" />
        <Shimmer className="h-8 w-24" />
        <Shimmer className="ml-auto h-8 w-60" />
      </div>
      {/* Grid of nodes */}
      <div className="grid grid-cols-6 gap-4">
        {Array.from({ length: 24 }).map((_, i) => (
          <Shimmer key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    </motion.div>
  );
}
