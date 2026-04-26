import React from "react";

const CreditCardIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
    <line x1="6" y1="15" x2="10" y2="15" />
  </svg>
);

type InvoiceStatus = "Paid" | "Pending" | "Refunded";

interface BillingRow {
  date: string;
  description: string;
  amount: string;
  status: InvoiceStatus;
}

const billingHistory: BillingRow[] = [
  { date: "Jun 14, 2025", description: "Pro Plan – Monthly", amount: "$149.00", status: "Paid" },
  { date: "May 14, 2025", description: "Pro Plan – Monthly", amount: "$149.00", status: "Paid" },
  { date: "Apr 14, 2025", description: "Pro Plan – Monthly", amount: "$149.00", status: "Paid" },
  { date: "Mar 14, 2025", description: "Pro Plan – Monthly", amount: "$149.00", status: "Pending" },
  { date: "Feb 14, 2025", description: "Pro Plan – Monthly", amount: "$149.00", status: "Paid" },
  { date: "Jan 14, 2025", description: "Add-on: Extra Seats (x3)", amount: "$45.00", status: "Refunded" },
];

const statusStyles: Record<InvoiceStatus, string> = {
  Paid: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  Pending: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  Refunded: "bg-rose-500/15 text-rose-400 border border-rose-500/30",
};

const StatusBadge: React.FC<{ status: InvoiceStatus }> = ({ status }) => (
  <span
    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[status]}`}
  >
    {status}
  </span>
);

const Divider: React.FC = () => (
  <div className="border-t border-slate-700/60 my-8" />
);

const BillingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 max-w-6xl mx-auto">
      {/* ── Page Header ── */}
      <div className="mb-8">
        <span className="text-xs font-bold tracking-widest text-indigo-400 uppercase">
          CWA
        </span>
        <h1 className="mt-2 text-3xl font-bold text-white tracking-tight">
          Billing &amp; Subscription
        </h1>
        <p className="mt-1 text-slate-400 text-sm">
          Manage your plan, payment method, and review your invoice history.
        </p>
      </div>

      {/* ── Summary Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {/* Card 1 */}
        <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">
            Current Monthly Spend
          </p>
          <p className="text-3xl font-bold text-white">$149.00</p>
          <p className="text-xs text-slate-500 mt-1">Billed on the 14th</p>
        </div>

        {/* Card 2 */}
        <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">
            Invoices This Year
          </p>
          <p className="text-3xl font-bold text-white">11</p>
          <p className="text-xs text-slate-500 mt-1">Since Jan 1, 2025</p>
        </div>

        {/* Card 3 */}
        <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">
            Next Invoice Due
          </p>
          <p className="text-3xl font-bold text-white">Jul 14, 2025</p>
          <p className="text-xs text-slate-500 mt-1">Auto-charged to Visa ••4242</p>
        </div>
      </div>

      <Divider />

      {/* ── Current Plan Card ── */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-lg mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-lg font-semibold text-white">Current Plan</h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Active
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-10 gap-y-3">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Plan</p>
                <p className="text-white font-medium">Pro</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Cycle</p>
                <p className="text-white font-medium">Monthly</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Price</p>
                <p className="text-white font-medium">$149 / mo</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Next Renewal</p>
                <p className="text-white font-medium">July 14, 2025</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <button className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl px-5 py-2 font-medium hover:opacity-90 transition text-sm">
              Upgrade Plan
            </button>
            <button className="border border-slate-600 text-slate-300 rounded-xl px-5 py-2 font-medium hover:bg-slate-700 transition text-sm">
              Manage Plan
            </button>
          </div>
        </div>
      </div>

      {/* ── Payment Method Card ── */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-lg mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Payment Method</h2>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-700/60 border border-slate-600 shrink-0">
              <CreditCardIcon className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <p className="text-white font-medium">Visa ending in 4242</p>
              <p className="text-slate-400 text-sm">Expires 08 / 26</p>
            </div>
          </div>
          <button className="text-indigo-400 hover:text-indigo-300 text-sm font-medium underline underline-offset-2 transition self-start sm:self-auto">
            Update Card
          </button>
        </div>
      </div>

      <Divider />

      {/* ── Billing History Table ── */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Billing History</h2>
          <p className="text-slate-400 text-sm mt-0.5">All invoices and charges for your account.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-700/50 text-slate-400 uppercase text-xs tracking-wider">
                <th className="text-left px-6 py-3 font-medium">Date</th>
                <th className="text-left px-6 py-3 font-medium">Description</th>
                <th className="text-left px-6 py-3 font-medium">Amount</th>
                <th className="text-left px-6 py-3 font-medium">Status</th>
                <th className="text-left px-6 py-3 font-medium">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {billingHistory.map((row, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-slate-700/30 transition-colors duration-150"
                >
                  <td className="px-6 py-4 text-slate-300 whitespace-nowrap">
                    {row.date}
                  </td>
                  <td className="px-6 py-4 text-white font-medium whitespace-nowrap">
                    {row.description}
                  </td>
                  <td className="px-6 py-4 text-slate-300 whitespace-nowrap">
                    {row.amount}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-6 py-4">
                    <button className="border border-slate-600 text-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-slate-700 transition">
                      ↓ PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 border-t border-slate-700 bg-slate-800/40">
          <p className="text-xs text-slate-500">
            Showing 6 of 11 invoices for 2025.{" "}
            <button className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition">
              View all invoices
            </button>
          </p>
        </div>
      </div>

      {/* ── Footer ── */}
      <p className="mt-10 text-center text-xs text-slate-600">
        CodeWithAli © {new Date().getFullYear()} · Questions? Contact{" "}
        <span className="text-indigo-500">billing@codewithali.com</span>
      </p>
    </div>
  );
};

export default BillingPage;
