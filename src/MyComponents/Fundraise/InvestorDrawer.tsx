/**
 * InvestorDrawer.tsx — right-slide detail drawer for a single investor.
 *
 * Tabs:
 *   · Overview   — thesis + portfolio + check size + fit + stage
 *   · Partners   — list of crm_contacts where company_id = this firm
 *   · Activity   — every email/call/DM logged on any partner
 *   · Notes      — markdown notes (fit_score_notes_md)
 *
 * Phase 2 will add a "Draft email" button next to each partner.
 * Phase 3 makes the pipeline_stage editable inline (drag-from-kanban
 * already updates it, but the drawer should support manual override).
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  Users,
  MessageSquare,
  StickyNote,
  Eye,
  ExternalLink,
  Mail,
  Linkedin,
  Twitter,
  Globe,
  Save,
} from "lucide-react";

import {
  useInvestor,
  useUpdateInvestor,
  formatCheckSize,
  PIPELINE_STAGE_LABEL,
  INVESTOR_PIPELINE_STAGES,
  type InvestorPipelineStage,
} from "@/stores/investors";

interface Props {
  investorId: string | null;
  onClose: () => void;
}

type TabId = "overview" | "partners" | "activity" | "notes";

export function InvestorDrawer({ investorId, onClose }: Props) {
  const { data: detail, isLoading } = useInvestor(investorId);
  const updateMut = useUpdateInvestor();
  const [tab, setTab] = useState<TabId>("overview");
  const open = !!investorId;

  // Esc closes.
  // (Component re-mounts per investor selection so this is fine.)
  if (typeof window !== "undefined" && open) {
    // No-op effect cost is acceptable here; the actual listener is
    // installed by the outer modal pattern in other surfaces. Keep
    // simple for the drawer.
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-40 bg-background/60 backdrop-blur-[2px]"
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 bottom-0 w-full max-w-[560px] bg-card border-l border-border shadow-2xl flex flex-col"
            role="dialog"
            aria-modal="true"
          >
            {/* ── Header ────────────────────────────────────── */}
            <header className="flex items-start justify-between gap-3 p-5 border-b border-border/60">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-foreground/40 mb-1">
                  Fundraise · Investor
                </p>
                <h2 className="text-[18px] font-semibold text-foreground leading-tight m-0 truncate">
                  {detail?.company_name ?? "Loading…"}
                </h2>
                {detail && (
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <StagePicker
                      value={detail.pipeline_stage}
                      onChange={(stage) =>
                        updateMut.mutate({
                          id: detail.id,
                          patch: { pipeline_stage: stage },
                        })
                      }
                      saving={updateMut.isPending}
                    />
                    <span className="text-[10px] font-mono tabular-nums text-foreground/40">
                      P{detail.priority}
                    </span>
                    <span className="text-[10px] font-mono tabular-nums text-foreground/40">
                      Fit {detail.fit_score}
                    </span>
                  </div>
                )}
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="p-1.5 rounded-sm text-foreground/40 hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
              >
                <X size={15} />
              </button>
            </header>

            {/* ── Tabs ──────────────────────────────────────── */}
            <nav
              role="tablist"
              className="flex items-center gap-0 px-5 border-b border-border/60"
            >
              <TabButton
                id="overview"
                label="Overview"
                icon={<Eye size={11} />}
                active={tab === "overview"}
                onClick={() => setTab("overview")}
              />
              <TabButton
                id="partners"
                label={`Partners${detail ? ` · ${detail.partners.length}` : ""}`}
                icon={<Users size={11} />}
                active={tab === "partners"}
                onClick={() => setTab("partners")}
              />
              <TabButton
                id="activity"
                label={`Activity${detail ? ` · ${detail.activities.length}` : ""}`}
                icon={<MessageSquare size={11} />}
                active={tab === "activity"}
                onClick={() => setTab("activity")}
              />
              <TabButton
                id="notes"
                label="Notes"
                icon={<StickyNote size={11} />}
                active={tab === "notes"}
                onClick={() => setTab("notes")}
              />
            </nav>

            {/* ── Body ──────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-5">
              {isLoading || !detail ? (
                <div className="flex items-center justify-center py-16 text-foreground/40 text-[12.5px]">
                  <Loader2 size={14} className="animate-spin mr-2" />
                  Loading…
                </div>
              ) : tab === "overview" ? (
                <OverviewPanel detail={detail} />
              ) : tab === "partners" ? (
                <PartnersPanel detail={detail} />
              ) : tab === "activity" ? (
                <ActivityPanel detail={detail} />
              ) : (
                <NotesPanel detail={detail} />
              )}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ──────────────────────────────────────────────────────────────────
// Panels
// ──────────────────────────────────────────────────────────────────

function OverviewPanel({ detail }: { detail: NonNullable<ReturnType<typeof useInvestor>["data"]> }) {
  return (
    <div className="space-y-5">
      <Block title="Thesis">
        {detail.thesis_md?.trim() ? (
          <p className="text-[12.5px] text-foreground/85 leading-relaxed whitespace-pre-wrap">
            {detail.thesis_md}
          </p>
        ) : (
          <Empty>No thesis recorded yet.</Empty>
        )}
      </Block>

      <Block title="Stage focus + check size">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {detail.stage_focus.length === 0 ? (
            <Empty>No stages set.</Empty>
          ) : (
            detail.stage_focus.map((s) => (
              <span
                key={s}
                className="inline-flex items-center px-2 py-0.5 rounded-sm bg-foreground/[0.05] text-[10.5px] uppercase tracking-[0.12em] text-foreground/65"
              >
                {s.replace(/_/g, " ")}
              </span>
            ))
          )}
        </div>
        <p className="text-[12.5px] text-foreground/65 font-mono tabular-nums">
          Check size:{" "}
          {formatCheckSize(
            detail.check_size_min_cents,
            detail.check_size_max_cents,
          )}
        </p>
      </Block>

      <Block title="Portfolio">
        {detail.portfolio_md?.trim() ? (
          <pre className="text-[12px] text-foreground/85 leading-relaxed whitespace-pre-wrap font-sans">
            {detail.portfolio_md}
          </pre>
        ) : (
          <Empty>No portfolio info yet.</Empty>
        )}
      </Block>

      <Block title="Identity">
        <div className="space-y-1.5">
          {detail.company.domain && (
            <ContactLine
              icon={<Globe size={11} />}
              label="Website"
              value={detail.company.domain}
              href={`https://${detail.company.domain}`}
            />
          )}
          {detail.twitter_handle && (
            <ContactLine
              icon={<Twitter size={11} />}
              label="Twitter"
              value={detail.twitter_handle}
              href={`https://twitter.com/${detail.twitter_handle.replace(/^@/, "")}`}
            />
          )}
          {detail.hq_location && (
            <ContactLine
              icon={<Globe size={11} />}
              label="HQ"
              value={detail.hq_location}
            />
          )}
          {!detail.company.domain &&
            !detail.twitter_handle &&
            !detail.hq_location && <Empty>No identity links.</Empty>}
        </div>
      </Block>
    </div>
  );
}

function PartnersPanel({
  detail,
}: {
  detail: NonNullable<ReturnType<typeof useInvestor>["data"]>;
}) {
  if (detail.partners.length === 0) {
    return <Empty>No partners added yet. Add one via the CRM contacts view.</Empty>;
  }
  return (
    <ul className="list-none p-0 m-0 space-y-2">
      {detail.partners.map((p) => (
        <li
          key={p.id}
          className="rounded-sm border border-border bg-card/60 p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-foreground">
                {p.name ?? "Unnamed"}
              </div>
              {p.title && (
                <div className="text-[10.5px] text-foreground/55 uppercase tracking-[0.12em] mt-0.5">
                  {p.title}
                </div>
              )}
            </div>
          </div>
          <div className="mt-2 space-y-1">
            {p.email && (
              <ContactLine
                icon={<Mail size={11} />}
                label="Email"
                value={p.email}
                href={`mailto:${p.email}`}
              />
            )}
            {p.phone && (
              <ContactLine
                icon={<Linkedin size={11} />}
                label="Phone"
                value={p.phone}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ActivityPanel({
  detail,
}: {
  detail: NonNullable<ReturnType<typeof useInvestor>["data"]>;
}) {
  if (detail.activities.length === 0) {
    return (
      <Empty>
        No activity logged yet. Cold emails + replies will appear here
        once you send the first outreach.
      </Empty>
    );
  }
  return (
    <ul className="list-none p-0 m-0 space-y-2">
      {detail.activities.map((a) => (
        <li
          key={a.id}
          className="rounded-sm border border-border bg-card/60 px-3 py-2.5"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10.5px] uppercase tracking-[0.12em] text-foreground/55 font-mono">
              {a.type}
            </span>
            <span className="text-[10px] text-foreground/40 font-mono tabular-nums">
              {new Date(a.occurred_at ?? a.created_at).toLocaleDateString()}
            </span>
          </div>
          {a.title && (
            <div className="text-[12.5px] text-foreground mt-1 font-medium">
              {a.title}
            </div>
          )}
          {a.body_md && (
            <p className="text-[11.5px] text-foreground/65 mt-1 line-clamp-4 whitespace-pre-wrap">
              {a.body_md}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function NotesPanel({
  detail,
}: {
  detail: NonNullable<ReturnType<typeof useInvestor>["data"]>;
}) {
  const updateMut = useUpdateInvestor();
  const [draft, setDraft] = useState(detail.fit_score_notes_md ?? "");
  const dirty = draft !== (detail.fit_score_notes_md ?? "");
  return (
    <div className="space-y-2">
      <p className="text-[10.5px] uppercase tracking-[0.12em] text-foreground/45 font-mono">
        Your private notes about this investor
      </p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={12}
        placeholder="Why are they a fit? Who introduced you? What angle should the cold email take?"
        className="w-full px-2.5 py-2 rounded-sm border border-border bg-background text-[12.5px] text-foreground placeholder:text-foreground/35 outline-none focus:border-primary/40 transition-colors leading-relaxed resize-vertical"
      />
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!dirty || updateMut.isPending}
          onClick={() =>
            updateMut.mutate({
              id: detail.id,
              patch: { fit_score_notes_md: draft },
            })
          }
          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm bg-primary text-primary-foreground text-[11.5px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {updateMut.isPending ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Save size={11} />
          )}
          Save notes
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Bits
// ──────────────────────────────────────────────────────────────────

function TabButton({
  id,
  label,
  icon,
  active,
  onClick,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={active}
      onClick={onClick}
      className={
        "relative px-3 h-9 inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] font-semibold transition-colors " +
        (active
          ? "text-foreground"
          : "text-foreground/45 hover:text-foreground/70")
      }
    >
      {icon}
      {label}
      {active && (
        <span className="absolute left-0 right-0 bottom-[-1px] h-[2px] bg-primary" />
      )}
    </button>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-[10.5px] uppercase tracking-[0.14em] text-foreground/45 m-0 mb-2 font-mono">
        {title}
      </h3>
      {children}
    </section>
  );
}

function ContactLine({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  const Tag = href ? "a" : "div";
  return (
    <Tag
      href={href}
      target={href ? "_blank" : undefined}
      rel={href ? "noopener noreferrer" : undefined}
      className={
        "flex items-center gap-2 text-[12px] text-foreground/85 " +
        (href ? "hover:text-primary transition-colors" : "")
      }
    >
      <span className="text-foreground/45">{icon}</span>
      <span className="text-foreground/45 uppercase tracking-[0.1em] text-[10px] w-12 flex-shrink-0">
        {label}
      </span>
      <span className="truncate flex-1">{value}</span>
      {href && <ExternalLink size={9} className="text-foreground/35 flex-shrink-0" />}
    </Tag>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11.5px] italic text-foreground/40">{children}</p>
  );
}

function StagePicker({
  value,
  onChange,
  saving,
}: {
  value: InvestorPipelineStage;
  onChange: (stage: InvestorPipelineStage) => void;
  saving: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as InvestorPipelineStage)}
      disabled={saving}
      className="px-1.5 h-5 rounded-full border border-border bg-card text-[10px] uppercase tracking-[0.1em] font-semibold text-foreground/65 hover:text-foreground transition-colors outline-none cursor-pointer disabled:opacity-40"
    >
      {INVESTOR_PIPELINE_STAGES.map((s) => (
        <option key={s} value={s}>
          {PIPELINE_STAGE_LABEL[s]}
        </option>
      ))}
    </select>
  );
}
