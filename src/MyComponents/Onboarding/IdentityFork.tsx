/**
 * IdentityFork.tsx — first screen of the onboarding wizard.
 *
 * Asks the user how they're joining Takeover. Two giant cards:
 *   · Founder      — running a company, new account
 *   · Employee     — joining an existing team (needs invite)
 *
 * The choice routes them into one of two flows. Employees
 * without a pre-provisioned row land on a hard-block screen
 * (we don't support self-serve company joining per the design
 * decision).
 */

import { motion } from "framer-motion";
import { Building2, Users2, ArrowRight } from "lucide-react";

export type IdentityChoice = "founder" | "employee";

interface Props {
  onPick: (choice: IdentityChoice) => void;
}

export function IdentityFork({ onPick }: Props) {
  return (
    <div className="w-full max-w-3xl mx-auto px-6 py-10">
      {/* Hero */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-10"
      >
        <div className="inline-flex items-center gap-2 mb-3">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
          </span>
          <span className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-text-tertiary">
            Step 1 of a few
          </span>
        </div>
        <h1
          className="font-bold text-foreground leading-[0.95] mb-3"
          style={{
            fontFamily:
              "var(--ed-font-display, Inter), system-ui, sans-serif",
            fontSize: "clamp(28px, 3.2vw, 40px)",
            letterSpacing: "-0.03em",
          }}
        >
          Welcome to Takeover<span className="text-primary">.</span>
        </h1>
        <p className="text-[13.5px] text-text-tertiary max-w-md mx-auto leading-relaxed">
          One question first — it'll set up the rest of your experience.
        </p>
      </motion.header>

      {/* Two-card chooser */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ChoiceCard
          icon={Building2}
          label="I run a company"
          tagline="Set up Takeover for your team."
          bullets={[
            "Create your workspace",
            "Pick the modules you need",
            "Invite your team",
          ]}
          delay={0.1}
          onClick={() => onPick("founder")}
        />
        <ChoiceCard
          icon={Users2}
          label="I'm joining a team"
          tagline="Use an invite from your admin."
          bullets={[
            "Confirm your role + profile",
            "Land in your team's workspace",
            "Pre-configured by your admin",
          ]}
          delay={0.2}
          onClick={() => onPick("employee")}
        />
      </div>

      <p className="text-center text-[11px] text-text-tertiary/70 mt-8">
        You can change this later in Settings.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ChoiceCard
// ─────────────────────────────────────────────────────────────────

function ChoiceCard({
  icon: Icon,
  label,
  tagline,
  bullets,
  delay,
  onClick,
}: {
  icon: typeof Building2;
  label: string;
  tagline: string;
  bullets: string[];
  delay: number;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      className="group relative text-left rounded-2xl border-xs border-border-soft bg-foreground/[0.03] hover:bg-foreground/[0.05] hover:border-primary/30 transition-colors p-6 overflow-hidden"
    >
      {/* Soft primary wash that brightens on hover. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-0 group-hover:opacity-[0.06] transition-opacity pointer-events-none"
        style={{
          background:
            "radial-gradient(60% 90% at 0% 0%, hsl(var(--primary)) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div className="w-10 h-10 rounded-xl bg-primary/12 border border-primary/25 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" strokeWidth={2.2} />
          </div>
          <ArrowRight className="h-4 w-4 text-text-tertiary group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>

        <div>
          <h3 className="text-[16px] font-bold text-foreground tracking-[-0.01em] leading-tight">
            {label}
          </h3>
          <p className="text-[12.5px] text-text-tertiary mt-1 leading-relaxed">
            {tagline}
          </p>
        </div>

        <ul className="space-y-1.5 pt-1 border-t border-xs border-border/15">
          {bullets.map((b) => (
            <li
              key={b}
              className="text-[11.5px] text-text-secondary flex items-start gap-2 pt-1.5 first:pt-2"
            >
              <span className="text-primary/60 mt-0.5">·</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.button>
  );
}
