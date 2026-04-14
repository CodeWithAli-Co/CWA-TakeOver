/**
 * InvoiceFormDialog.tsx — Modal for creating new invoices.
 *
 * Replaces the old slide-in Sheet panel with a centered modal dialog.
 * Two-column layout: client info on left, dynamic line items on right.
 *
 * Line items are unlimited — user can [+ Add Line] to add as many as needed.
 * Each line has name, qty, price, and live-computed total.
 * Stored in the new line_items JSON column. Also writes legacy item_1/2/3
 * columns for the first 3 items so old PDF preview code still works.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, X, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/shadcnComponents/dialog";
import { useClientStore } from "@/stores/invoiceStore";
import { InvoiceType, LineItem } from "@/stores/invoiceQuery";
import supabase from "@/MyComponents/supabase";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export const InvoiceFormDialog: React.FC<Props> = ({ open, onOpenChange, onCreated }) => {
  const { name, email } = useClientStore();

  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState(name);
  const [clientEmail, setClientEmail] = useState(email);
  const [clientLocation, setClientLocation] = useState("");
  const [note, setNote] = useState("");
  const [adjustment, setAdjustment] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [sender, setSender] = useState("CodeWithAli");
  const [bankAcc, setBankAcc] = useState("-");
  const [submitting, setSubmitting] = useState(false);

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { name: "", qty: 1, price: 0, total: 0 },
  ]);

  // Sync with selected client when dialog opens
  if (open && clientName === "" && name) {
    setClientName(name);
    setClientEmail(email);
  }

  const updateLine = (i: number, patch: Partial<LineItem>) => {
    setLineItems((prev) => prev.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, ...patch };
      updated.total = Number(updated.qty) * Number(updated.price);
      return updated;
    }));
  };

  const addLine = () => {
    setLineItems((prev) => [...prev, { name: "", qty: 1, price: 0, total: 0 }]);
  };

  const removeLine = (i: number) => {
    setLineItems((prev) => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);
  };

  const subtotal = lineItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const outcome = subtotal + Number(adjustment || 0) - Number(discount || 0);

  const reset = () => {
    setTitle("");
    setClientName(name);
    setClientEmail(email);
    setClientLocation("");
    setNote("");
    setAdjustment("0");
    setDiscount("0");
    setSender("CodeWithAli");
    setBankAcc("-");
    setLineItems([{ name: "", qty: 1, price: 0, total: 0 }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Build legacy item_1/2/3 fields from first 3 line items for backward compat
    const legacyFields: Record<string, any> = {};
    for (let i = 0; i < 3; i++) {
      const item = lineItems[i];
      const idx = i + 1;
      legacyFields[`item_${idx}`] = item?.name || "";
      legacyFields[`qty_${idx}`] = item?.qty || 0;
      legacyFields[`price_${idx}`] = item?.price || 0;
      legacyFields[`total_${idx}`] = item?.total || 0;
    }

    const payload: Omit<InvoiceType, "invoice_id"> = {
      invoice_title: title,
      client_name: clientName,
      client_email: clientEmail,
      client_location: clientLocation,
      ...legacyFields,
      line_items: lineItems.filter((l) => l.name),
      note,
      subtotal,
      adjustment: Number(adjustment),
      discount: Number(discount),
      sender,
      bank_account: bankAcc,
      outcome,
      creation_date: Date.now(),
      status: "pending",
    } as Omit<InvoiceType, "invoice_id">;

    const { error } = await supabase.from("invoices").insert(payload);
    setSubmitting(false);

    if (error) {
      console.error("Error creating invoice:", error);
      return;
    }

    reset();
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-white/[0.04]">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-semibold text-white/85">
            <div className="p-1.5 rounded-sm bg-red-500/[0.08]">
              <FileText className="h-3.5 w-3.5 text-red-400" />
            </div>
            New Invoice
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Title + sender row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-medium">
                Invoice Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Web design — March 2025"
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-sm text-[13px] text-white/80 placeholder:text-white/15 focus:outline-none focus:border-red-500/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-medium">
                Sender
              </label>
              <select
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-sm text-[13px] text-white/80 focus:outline-none focus:border-red-500/20 cursor-pointer"
              >
                <option value="CodeWithAli">CodeWithAli</option>
                <option value="Simplicity">Simplicity</option>
                <option value="Ali Alibrahimi">Ali Alibrahimi</option>
                <option value="Hanif Palm">Hanif Palm</option>
              </select>
            </div>
          </div>

          {/* Client info section */}
          <div>
            <p className="text-[10px] text-white/15 uppercase tracking-[0.15em] font-medium mb-3">
              Client Information
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] text-white/20">Client Name</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-sm text-[12px] text-white/70 focus:outline-none focus:border-red-500/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-white/20">Email</label>
                <input
                  type="email"
                  required
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-sm text-[12px] text-white/70 focus:outline-none focus:border-red-500/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-white/20">Location (optional)</label>
                <input
                  type="text"
                  value={clientLocation}
                  onChange={(e) => setClientLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-sm text-[12px] text-white/70 focus:outline-none focus:border-red-500/20"
                />
              </div>
            </div>
          </div>

          {/* Line items section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-white/15 uppercase tracking-[0.15em] font-medium">
                Line Items
              </p>
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1 px-2 py-1 bg-red-500/[0.08] hover:bg-red-500/[0.12] border border-red-500/15 text-red-400 text-[10px] rounded-sm transition-colors"
              >
                <Plus className="h-3 w-3" /> Add Line
              </button>
            </div>

            {/* Header row */}
            <div className="grid grid-cols-[2.5fr_0.6fr_0.8fr_0.8fr_24px] gap-2 px-2 pb-1 text-[10px] text-white/15 uppercase tracking-wider">
              <span>Description</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Price</span>
              <span className="text-right">Total</span>
              <span></span>
            </div>

            <AnimatePresence>
              <div className="space-y-1">
                {lineItems.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="grid grid-cols-[2.5fr_0.6fr_0.8fr_0.8fr_24px] gap-2 items-center"
                  >
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateLine(i, { name: e.target.value })}
                      placeholder="Item description"
                      className="px-2.5 py-1.5 bg-white/[0.02] border border-white/[0.06] rounded-sm text-[12px] text-white/70 placeholder:text-white/15 focus:outline-none focus:border-red-500/20"
                    />
                    <input
                      type="number"
                      value={item.qty}
                      onChange={(e) => updateLine(i, { qty: Number(e.target.value) })}
                      min={0}
                      className="px-2 py-1.5 bg-white/[0.02] border border-white/[0.06] rounded-sm text-[12px] text-white/70 text-right focus:outline-none focus:border-red-500/20"
                    />
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-red-500/40">$</span>
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) => updateLine(i, { price: Number(e.target.value) })}
                        min={0}
                        step="0.01"
                        className="w-full pl-5 pr-2 py-1.5 bg-white/[0.02] border border-white/[0.06] rounded-sm text-[12px] text-white/70 text-right focus:outline-none focus:border-red-500/20"
                      />
                    </div>
                    <div className="px-2 py-1.5 text-right text-[12px] text-red-400 font-medium">
                      ${item.total.toFixed(2)}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      disabled={lineItems.length === 1}
                      className="p-1 rounded-sm text-white/15 hover:text-red-400 hover:bg-red-500/[0.06] disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          </div>

          {/* Adjustments + notes */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-medium">
                Adjustment
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-red-500/40">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={adjustment}
                  onChange={(e) => setAdjustment(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-sm text-[13px] text-white/70 focus:outline-none focus:border-red-500/20"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-medium">
                Discount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-red-500/40">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-sm text-[13px] text-white/70 focus:outline-none focus:border-red-500/20"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-medium">
                Bank Account
              </label>
              <input
                type="text"
                value={bankAcc}
                onChange={(e) => setBankAcc(e.target.value)}
                className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-sm text-[13px] text-white/70 focus:outline-none focus:border-red-500/20"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-medium">
              Note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] rounded-sm text-[13px] text-white/70 placeholder:text-white/15 focus:outline-none focus:border-red-500/20 resize-none"
              placeholder="Optional payment terms, thank you message, etc."
            />
          </div>

          {/* Footer with totals + submit */}
          <div className="flex items-center justify-between pt-4 border-t border-white/[0.04]">
            <div className="space-y-0.5">
              <div className="flex items-center gap-4 text-[11px] text-white/30">
                <span>Subtotal: <span className="text-white/60">${subtotal.toFixed(2)}</span></span>
                <span>Adjust: <span className="text-white/60">${Number(adjustment).toFixed(2)}</span></span>
                <span>Discount: <span className="text-white/60">${Number(discount).toFixed(2)}</span></span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] text-white/20 uppercase tracking-wider">Total Due</span>
                <span className="text-2xl font-bold text-red-400 tracking-tight">
                  ${outcome.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] text-white/40 hover:text-white/70 text-[12px] rounded-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !title || lineItems.every((l) => !l.name)}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-[12px] font-medium rounded-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "Creating..." : "Create Invoice"}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
