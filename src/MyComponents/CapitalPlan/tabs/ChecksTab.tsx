/**
 * ChecksTab.tsx — Investor CRM (Phase 2 stub).
 *
 * Will become a kanban pipeline: Lead → Intro → Meeting → Diligence →
 * Verbal → Term Sheet → Signed → Wired. Per-investor drawer with
 * touchpoint log, AXON-drafted follow-ups, and hooks for Gmail /
 * Calendly MCP integration.
 *
 * Phase 1 ships this placeholder so the page compiles. Phase 2 builds
 * the actual CRM.
 */

import { Users, Mail, Calendar, Sparkles } from "lucide-react";
import type { CapitalPlanData } from "../CapitalPlan.queries";

export function ChecksTab({
  plan: _plan, selectedRoundId: _selectedRoundId,
}: {
  plan: CapitalPlanData;
  selectedRoundId: string | null;
}) {
  return (
    <ComingSoon
      icon={<Users className="h-5 w-5" />}
      title="Investor CRM"
      subtitle="Phase 2"
      bullets={[
        { icon: Users,    text: "Pipeline kanban: Lead → Intro → Meeting → Diligence → Verbal → Term Sheet → Signed → Wired" },
        { icon: Mail,     text: "Per-investor drawer with touchpoint log + next-step reminders" },
        { icon: Sparkles, text: "AXON-drafted follow-up emails" },
        { icon: Calendar, text: "Hooks for Gmail + Calendly MCP (auto-capture meetings, send emails)" },
      ]}
    />
  );
}

function ComingSoon({ icon, title, subtitle, bullets }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  bullets: { icon: typeof Users; text: string }[];
}) {
  return (
    <div className="border border-dashed border-border rounded-sm p-10 bg-card/20">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <span className="p-2 rounded-sm bg-primary/10 text-primary">{icon}</span>
          <div>
            <h3 className="text-[15px] font-bold text-foreground tracking-tight">{title}</h3>
            <p className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/80 font-semibold mt-0.5">{subtitle}</p>
          </div>
        </div>
        <ul className="space-y-2.5 mt-5">
          {bullets.map((b, i) => {
            const Icon = b.icon;
            return (
              <li key={i} className="flex items-start gap-2.5 text-[12.5px] text-muted-foreground leading-relaxed">
                <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground/60 shrink-0" />
                <span>{b.text}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export { ComingSoon };
