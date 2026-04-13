/**
 * invoicer.lazy.tsx — Unified invoicer page.
 *
 * Replaces 4 old routes (invoiceClients, invoicer, middle, invoicePreview)
 * with a single 3-pane layout:
 *
 *   ┌──────────┬───────────────┬──────────────┐
 *   │ Clients  │ Invoices      │ Preview      │
 *   │          │ for selected  │ (collapsible)│
 *   │ + add    │ client        │              │
 *   └──────────┴───────────────┴──────────────┘
 */

import { useState } from "react";
import { createLazyFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Receipt } from "lucide-react";
import { ClientSidebar } from "@/MyComponents/Invoicer/ClientSidebar";
import { InvoiceList } from "@/MyComponents/Invoicer/InvoiceList";
import { InvoiceFormDialog } from "@/MyComponents/Invoicer/InvoiceFormDialog";
import { InvoicePreviewPane } from "@/MyComponents/Invoicer/InvoicePreviewPane";
import { useClientStore } from "@/stores/invoiceStore";
import { Invoices } from "@/stores/invoiceQuery";

function Invoicer() {
  const { name } = useClientStore();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { refetch } = Invoices(name);

  return (
    <div className="min-h-screen bg-black overflow-hidden flex flex-col">
      {/* Page header */}
      <div className="px-8 pt-6 pb-3 flex items-end justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-sm bg-red-500/[0.08] border border-red-500/15">
            <Receipt className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-[24px] font-bold text-white tracking-tight">Invoicer</h1>
            <p className="text-[12px] text-white/20 mt-0.5">
              Create, send, and track client invoices
            </p>
          </div>
        </div>
      </div>

      {/* 3-pane grid */}
      <div className="flex-1 px-6 pb-6 grid gap-3 overflow-hidden"
           style={{
             gridTemplateColumns: selectedInvoiceId
               ? "260px minmax(0, 1fr) 480px"
               : "260px minmax(0, 1fr)",
             transition: "grid-template-columns 300ms ease",
           }}>
        {/* Clients pane */}
        <ClientSidebar />

        {/* Invoice list pane */}
        <InvoiceList
          selectedInvoiceId={selectedInvoiceId}
          onSelectInvoice={(id) => setSelectedInvoiceId(id)}
          onCreateInvoice={() => setShowCreateForm(true)}
        />

        {/* Preview pane (slides in when invoice is selected) */}
        <AnimatePresence mode="wait">
          {selectedInvoiceId && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <InvoicePreviewPane
                invoiceId={selectedInvoiceId}
                onClose={() => setSelectedInvoiceId(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Create invoice modal */}
      <InvoiceFormDialog
        open={showCreateForm}
        onOpenChange={setShowCreateForm}
        onCreated={() => refetch()}
      />
    </div>
  );
}

export const Route = createLazyFileRoute("/invoicer")({
  component: Invoicer,
});
