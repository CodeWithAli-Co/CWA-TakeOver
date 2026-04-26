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
  Zap,
  Star,
  TrendingUp,
  DollarSign,
  ReceiptText,
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
  billingCycle: "Monthly",
  renewalDate: "August 1, 2025",
  features: [
    "Unlimited workspaces",
    "Priority support",
    "Advanced analytics",
    "SSO integration",
    "Custom domains",
    "API access",
  ],
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
      className:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    },
    pending: {
      label: "Pending",
      icon: <Clock className="h-3.5 w-3.5" />,
      className:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
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

function SectionHeader({
  icon,
  title,
  trailing,
}: {
  icon: React.ReactNode;
  title: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      {trailing}
    </div>
  );
}

// ── Page component ───────────────────────────────────────────────────────────

function BillingRoute() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Billing
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your subscription, payment method, and download invoices.
        </p>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Current Monthly Spend */}
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Current Monthly Spend
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <DollarSign className="h-4 w-4 text-primary" />
            </span>
          </div>
          <p className="text-3xl font-bold text-foreground">$49.00</p>
          <p className="text-xs text-muted-foreground">Pro Plan · Billed monthly</p>
        </div>

        {/* Invoices This Year */}
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Invoices This Year
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <ReceiptText className="h-4 w-4 text-primary" />
            </span>
          </div>
          <p className="text-3xl font-bold text-foreground">7</p>
          <p className="text-xs text-muted-foreground">6 paid · 1 failed</p>
        </div>

        {/* Next Payment Date */}
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Next Payment Date
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <CalendarDays className="h-4 w-4 text-primary" />
            </span>
          </div>
          <p className="text-3xl font-bold text-foreground">Aug 1</p>
          <p className="text-xs text-muted-foreground">2025 · Auto-renews</p>
        </div>
      </div>

      {/* ── Current Plan ── */}
      <SectionCard>
        <SectionHeader
          icon={<ShieldCheck className="h-4 w-4" />}
          title="Current Plan"
        />

        <div className="p-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          {/* Plan info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="text-3xl font-bold text-foreground">
                {currentPlan.name}
              </span>
              <span className="inline-flex rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2.5 py-0.5 text-xs font-medium">
                Active
              </span>
            </div>

            <p className="text-muted-foreground text-sm">
              <span className="text-foreground font-semibold text-2xl">
                ${currentPlan.price}
              </span>
              &nbsp;/ month
            </p>

            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>Billing cycle: {currentPlan.billingCycle}</span>
            </div>

            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              <span>Renews on {currentPlan.renewalDate}</span>
            </div>
          </div>

          {/* Features list */}
          <ul className="space-y-2">
            {currentPlan.features.map((f) => (
              <li
                key={f}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          {/* Actions */}
          <div className="flex flex-col gap-2 min-w-[148px]">
            <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Zap className="h-3.5 w-3.5" />
              Upgrade Plan
            </button>
            <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">
              Manage Plan
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ── Payment Method ── */}
      <SectionCard>
        <SectionHeader
          icon={<CreditCard className="h-4 w-4" />}
          title="Payment Method"
        />

        <div className="p-6 flex flex-col sm:flex-row sm:items-center gap-8">
          {/* Credit card widget */}
          <div className="relative w-72 h-40 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 shadow-lg p-5 flex flex-col justify-between text-white select-none overflow-hidden shrink-0">
            {/* Decorative circles */}
            <span className="absolute -top-6 -right-6 h-32 w-32 rounded-full bg-white/5 pointer-events-none" />
            <span className="absolute top-4 right-10 h-20 w-20 rounded-full bg-white/5 pointer-events-none" />
            <span className="absolute -bottom-8 -left-8 h-40 w-40 rounded-full bg-white/5 pointer-events-none" />

            {/* Top row */}
            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs font-bold tracking-widest uppercase opacity-80">
                {paymentMethod.brand}
              </span>
              <CreditCard className="h-6 w-6 opacity-60" />
            </div>

            {/* Card number & holder */}
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
              <p className="font-semibold text-foreground">
                {paymentMethod.brand} ending in {paymentMethod.last4}
              </p>
              <p className="text-muted-foreground">
                Expires {paymentMethod.expMonth}/{paymentMethod.expYear}
              </p>
              <p className="text-muted-foreground">{paymentMethod.cardholderName}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent transition-colors">
                <RefreshCw className="h-3.5 w-3.5" />
                Replace Card
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors">
                Remove
              </button>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Invoice History ── */}
      <SectionCard>
        <SectionHeader
          icon={<ReceiptText className="h-4 w-4" />}
          title="Invoice History"
          trailing={
            <span className="text-xs text-muted-foreground">
              {invoices.length} invoices
            </span>
          }
        />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-6 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
                  Invoice ID
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
                  <td className="px-6 py-4 whitespace-nowrap text-foreground">
                    {invoice.description}
                  </td>
                  <td className="px-6 py-4 text-right font-medium tabular-nums whitespace-nowrap text-foreground">
                    ${invoice.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <StatusBadge status={invoice.status} />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <a
                      href={invoice.downloadUrl}
                      aria-label={`Download ${invoice.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium border border-border bg-card hover:bg-accent transition-colors text-foreground"
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

        {/* Table footer */}
        <div className="px-6 py-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing all {invoices.length} invoices</span>
          <span>All amounts in USD</span>
        </div>
      </SectionCard>

      {/* ── Upgrade / Manage Plan CTA Banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white p-8">
        {/* Decorative blobs */}
        <span className="pointer-events-none absolute -top-10 -right-10 h-48 w-48 rounded-full bg-white/5" />
        <span className="pointer-events-none absolute -bottom-12 -left-12 h-56 w-56 rounded-full bg-white/5" />
        <span className="pointer-events-none absolute top-6 right-32 h-24 w-24 rounded-full bg-white/5" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          {/* Copy */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-300" />
              <span className="text-xs font-semibold uppercase tracking-widest text-white/70">
                CWA Pro
              </span>
            </div>
            <h3 className="text-2xl font-bold leading-tight">
              Scale with CWA Pro
            </h3>
            <p className="text-sm text-white/75 max-w-md">
              Unlock unlimited team seats, advanced analytics dashboards, priority
              SLA support, and enterprise-grade SSO — everything you need to grow
              without limits.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-white/90 transition-colors shadow-md">
              <Zap className="h-4 w-4" />
              Upgrade to Business
            </button>
            <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-colors backdrop-blur-sm">
              Talk to Sales
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createLazyFileRoute("/billing")({
  component: BillingRoute,
});

export default BillingRoute;
