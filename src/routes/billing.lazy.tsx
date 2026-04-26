import { createLazyFileRoute } from "@tanstack/react-router";
import {
  CreditCard,
  Download,
  CheckCircle2,
  Clock,
  XCircle,
  CalendarDays,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type InvoiceStatus = "paid" | "pending" | "failed";

interface Invoice {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: InvoiceStatus;
  downloadUrl: string;
}

// ── Static mock data ─────────────────────────────────────────────────────────

const currentPlan = {
  name: "Pro",
  price: 49,
  billingCycle: "monthly" as const,
  renewalDate: "August 1, 2025",
  features: ["Unlimited workspaces", "Priority support", "Advanced analytics", "SSO integration"],
};

const paymentMethod = {
  brand: "Visa",
  last4: "4242",
  expMonth: "09",
  expYear: "2027",
  cardholderName: "Alex Johnson",
};

const invoices: Invoice[] = [
  {
    id: "INV-2025-007",
    date: "Jul 1, 2025",
    description: "Pro Plan – July 2025",
    amount: 49.0,
    status: "paid",
    downloadUrl: "#",
  },
  {
    id: "INV-2025-006",
    date: "Jun 1, 2025",
    description: "Pro Plan – June 2025",
    amount: 49.0,
    status: "paid",
    downloadUrl: "#",
  },
  {
    id: "INV-2025-005",
    date: "May 1, 2025",
    description: "Pro Plan – May 2025",
    amount: 49.0,
    status: "paid",
    downloadUrl: "#",
  },
  {
    id: "INV-2025-004",
    date: "Apr 1, 2025",
    description: "Pro Plan – April 2025",
    amount: 49.0,
    status: "failed",
    downloadUrl: "#",
  },
  {
    id: "INV-2025-003",
    date: "Mar 1, 2025",
    description: "Pro Plan – March 2025",
    amount: 49.0,
    status: "paid",
    downloadUrl: "#",
  },
  {
    id: "INV-2025-002",
    date: "Feb 1, 2025",
    description: "Pro Plan – February 2025",
    amount: 49.0,
    status: "pending",
    downloadUrl: "#",
  },
  {
    id: "INV-2025-001",
    date: "Jan 1, 2025",
    description: "Pro Plan – January 2025",
    amount: 49.0,
    status: "paid",
    downloadUrl: "#",
  },
];

// ── Helper components ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const config: Record<
    InvoiceStatus,
    { label: string; icon: React.ReactNode; className: string }
  > = {
    paid: {
      label: "Paid",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    },
    pending: {
      label: "Pending",
      icon: <Clock className="h-3.5 w-3.5" />,
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    },
    failed: {
      label: "Failed",
      icon: <XCircle className="h-3.5 w-3.5" />,
      className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    },
  };

  const { label, icon, className } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {icon}
      {label}
    </span>
  );
}

function SectionCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-card text-card-foreground shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

// ── Page component ───────────────────────────────────────────────────────────

function BillingRoute() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your subscription, payment method, and download invoices.
        </p>
      </div>

      {/* ── Current plan ── */}
      <SectionCard>
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm">Current Plan</h2>
        </div>

        <div className="p-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          {/* Plan info */}
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{currentPlan.name}</span>
              <span className="rounded-full bg-primary/10 text-primary text-xs font-medium px-2.5 py-0.5">
                Active
              </span>
            </div>
            <p className="text-muted-foreground text-sm">
              <span className="text-foreground font-medium text-xl">
                ${currentPlan.price}
              </span>
              &nbsp;/ month
            </p>

            <div className="flex items-center gap-1.5 text-sm text-muted-foreground pt-1">
              <CalendarDays className="h-4 w-4" />
              <span>Renews on {currentPlan.renewalDate}</span>
            </div>
          </div>

          {/* Features list */}
          <ul className="space-y-2">
            {currentPlan.features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          {/* Actions */}
          <div className="flex flex-col gap-2 min-w-[140px]">
            <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              Upgrade Plan
            </button>
            <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">
              Cancel Plan
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ── Payment method ── */}
      <SectionCard>
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm">Payment Method</h2>
        </div>

        <div className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          {/* Card visual */}
          <div className="relative w-72 h-40 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 shadow-lg p-5 flex flex-col justify-between text-white select-none overflow-hidden">
            {/* Decorative circles */}
            <span className="absolute -top-6 -right-6 h-32 w-32 rounded-full bg-white/5" />
            <span className="absolute -bottom-8 -left-8 h-40 w-40 rounded-full bg-white/5" />

            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs font-semibold tracking-widest uppercase opacity-70">
                {paymentMethod.brand}
              </span>
              <CreditCard className="h-6 w-6 opacity-70" />
            </div>

            <div className="relative z-10 space-y-1">
              <p className="text-base tracking-[0.25em] font-mono">
                •••• •••• •••• {paymentMethod.last4}
              </p>
              <div className="flex items-center justify-between text-xs opacity-70">
                <span>{paymentMethod.cardholderName}</span>
                <span>
                  {paymentMethod.expMonth}/{paymentMethod.expYear}
                </span>
              </div>
            </div>
          </div>

          {/* Card meta & actions */}
          <div className="space-y-4">
            <div className="space-y-1 text-sm">
              <p className="font-medium">{paymentMethod.brand} ending in {paymentMethod.last4}</p>
              <p className="text-muted-foreground">
                Expires {paymentMethod.expMonth}/{paymentMethod.expYear}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors">
                <RefreshCw className="h-3.5 w-3.5" />
                Replace Card
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors">
                Remove
              </button>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Invoice history ── */}
      <SectionCard>
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm">Billing History</h2>
          <span className="text-xs text-muted-foreground">{invoices.length} invoices</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-6 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
                  Date
                </th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
                  Description
                </th>
                <th className="px-6 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">
                  Amount
                </th>
                <th className="px-6 py-3 text-center font-medium text-muted-foreground whitespace-nowrap">
                  Status
                </th>
                <th className="px-6 py-3 text-center font-medium text-muted-foreground whitespace-nowrap">
                  Download
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="hover:bg-muted/30 transition-colors"
                >
                  <td className="px-6 py-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {invoice.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                    {invoice.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{invoice.description}</td>
                  <td className="px-6 py-4 text-right font-medium tabular-nums whitespace-nowrap">
                    ${invoice.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <StatusBadge status={invoice.status} />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <a
                      href={invoice.downloadUrl}
                      aria-label={`Download ${invoice.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium border border-border hover:bg-accent transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing all {invoices.length} invoices</span>
          <span>All amounts in USD</span>
        </div>
      </SectionCard>
    </div>
  );
}

export const Route = createLazyFileRoute("/billing")({
  component: BillingRoute,
});

export default BillingRoute;
