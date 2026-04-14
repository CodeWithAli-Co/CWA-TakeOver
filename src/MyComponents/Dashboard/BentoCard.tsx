import { type ReactNode } from "react";
import { motion } from "framer-motion";

interface BentoCardProps {
  children: ReactNode;
  className?: string;
  /** col-span and row-span classes */
  span?: string;
  delay?: number;
  noPadding?: boolean;
}

export function BentoCard({
  children,
  className = "",
  span = "",
  delay = 0,
  noPadding = false,
}: BentoCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.3, ease: "easeOut" }}
      className={`bento-card rounded-lg border border-border bg-card overflow-hidden ${
        noPadding ? "" : "p-4"
      } ${span} ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function BentoLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
      {children}
    </span>
  );
}

export function BentoValue({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`text-xl font-bold text-foreground tabular-nums ${className}`}>
      {children}
    </span>
  );
}
