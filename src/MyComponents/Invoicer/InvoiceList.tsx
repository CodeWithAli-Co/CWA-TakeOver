/**
 * InvoiceList.tsx — Middle pane of the unified invoicer page.
 *
 * Lists all invoices for the currently selected client (from invoiceStore).
 * Each row: title, ID, date, amount, status badge, actions (preview, email).
 * Clicking a row sets selectedInvoiceId in parent state to open preview pane.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, RefreshCcw, Eye, Mail, Inbox } from "lucide-react";
import { useClientStore } from "@/stores/invoiceStore";
import { Invoices, getLineItems, InvoiceType } from "@/stores/invoiceQuery";
import EmailBtn from "@/MyComponents/Reusables/emailBtn";

interface Props {
  selectedInvoiceId: number | null;
  onSelectInvoice: (id: number) => void;
  onCreateInvoice: () => void;
}

export const InvoiceList: React.FC<Props> = ({
  selectedInvoiceId,
  onSelectInvoice,
  onCreateInvoice,
}) => {
  const { name, email } = useClientStore();
  const { data: invoices = [], isLoading, refetch } = Invoices(name);
  const [searchQuery, setSearchQuery] = useState("");

  // Empty state — no client selected
  if (!name) {
    return (
      <div className="bg-[#0a0a0a] border border-white/[0.04] rounded-sm h-full flex items-center justify-center">
        <div className="text-center max-w-xs">
          <Inbox className="h-10 w-10 text-white/[0.06] mx-auto mb-3" />
          <p className="text-[14px] text-white/40 font-medium mb-1">
            Select a client
          </p>
          <p className="text-[12px] text-white/20">
            Pick someone from the left to view their invoices
          </p>
        </div>
      </div>
    );
  }

  const filtered = invoices.filter((inv) =>
    inv.invoice_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(inv.invoice_id).includes(searchQuery)
  );

  const totalValue = invoices.reduce((sum, inv) => sum + Number(inv.outcome || 0), 0);
  const paidValue = invoices.filter(i => i.status === "paid").reduce((sum, inv) => sum + Number(inv.outcome || 0), 0);

  return (
    <div className="bg-[#0a0a0a] border border-white/[0.04] rounded-sm h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-white/[0.04]">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-[16px] font-semibold text-white tracking-tight">{name}</h2>
            <p className="text-[11px] text-white/25 mt-0.5">{email}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => refetch()}
              className="p-1.5 rounded-sm bg-white/[0.02] text-white/20 hover:text-white/50 hover:bg-white/[0.04] transition-colors"
              title="Refresh"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onCreateInvoice}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/[0.1] hover:bg-red-500/[0.15] border border-red-500/20 text-red-400 text-[11px] font-medium rounded-sm transition-colors"
            >
              <Plus className="h-3 w-3" /> Create Invoice
            </button>
          </div>
        </div>

        {/* Quick stats strip */}
        <div className="flex items-center gap-4 text-[11px]">
          <span className="text-white/30">
            <span className="text-white/60 font-medium">{invoices.length}</span> invoices
          </span>
          <span className="text-white/15">·</span>
          <span className="text-white/30">
            <span className="text-emerald-400 font-medium">${paidValue.toLocaleString()}</span> paid
          </span>
          <span className="text-white/15">·</span>
          <span className="text-white/30">
            <span className="text-red-400 font-medium">${(totalValue - paidValue).toLocaleString()}</span> pending
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="px-5 py-2 border-b border-white/[0.04]">
        <input
          type="text"
          placeholder="Search invoices..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-1.5 bg-white/[0.02] border border-white/[0.04] rounded-sm text-[12px] text-white/60 placeholder:text-white/15 focus:outline-none focus:border-white/[0.08]"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 text-center">
            <div className="h-5 w-5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Inbox className="h-8 w-8 text-white/[0.06] mx-auto mb-2" />
            <p className="text-[13px] text-white/30 mb-1">
              {invoices.length === 0 ? "No invoices yet" : "No matches"}
            </p>
            {invoices.length === 0 && (
              <button
                onClick={onCreateInvoice}
                className="text-[11px] text-red-400 hover:text-red-300 mt-2"
              >
                Create your first invoice →
              </button>
            )}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filtered.map((invoice: InvoiceType, i) => {
              const isSelected = selectedInvoiceId === invoice.invoice_id;
              const itemCount = getLineItems(invoice).length;

              return (
                <motion.div
                  key={invoice.invoice_id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => onSelectInvoice(invoice.invoice_id)}
                  className={`group relative px-4 py-3 rounded-sm cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? "bg-red-500/[0.08] border border-red-500/15"
                      : "border border-transparent hover:bg-white/[0.02] hover:border-white/[0.04]"
                  }`}
                >
                  {/* Status accent bar */}
                  <div
                    className={`absolute left-0 top-3 bottom-3 w-[2px] ${
                      invoice.status === "paid" ? "bg-emerald-500" : "bg-red-500"
                    } ${isSelected ? "opacity-100" : "opacity-40"}`}
                  />

                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[13px] font-medium text-white/80 truncate">
                          {invoice.invoice_title}
                        </span>
                        <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${
                          invoice.status === "paid"
                            ? "bg-emerald-500/[0.08] text-emerald-400 border-emerald-500/15"
                            : "bg-red-500/[0.08] text-red-400 border-red-500/15"
                        }`}>
                          {invoice.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-white/30">
                        <span>#{invoice.invoice_id}</span>
                        <span>·</span>
                        <span>{itemCount} {itemCount === 1 ? "item" : "items"}</span>
                        {invoice.creation_date && (
                          <>
                            <span>·</span>
                            <span>{new Date(invoice.creation_date).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[14px] font-bold tracking-tight ${
                        invoice.status === "paid" ? "text-emerald-400" : "text-white/80"
                      }`}>
                        ${Number(invoice.outcome).toLocaleString()}
                      </span>

                      {/* Hover actions */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectInvoice(invoice.invoice_id);
                          }}
                          className="p-1.5 rounded-sm text-white/30 hover:text-white/70 hover:bg-white/[0.04]"
                          title="Preview"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <div onClick={(e) => e.stopPropagation()}>
                          <EmailBtn
                            email={invoice.client_email}
                            invoiceID={invoice.invoice_id}
                            className="p-1.5 rounded-sm text-white/30 hover:text-red-400 hover:bg-red-500/[0.06] flex items-center"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
