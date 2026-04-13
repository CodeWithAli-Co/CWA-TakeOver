/**
 * InvoicePreviewPane.tsx — Right pane PDF preview for the unified invoicer.
 *
 * Replaces the old /invoicePreview route + /middle intermediate route +
 * global myInv variable. Now reads invoice data directly from props and
 * renders the PDF inline via PDFViewer.
 */

import { PDFViewer } from "@react-pdf/renderer";
import { Download, X, Eye, FileText } from "lucide-react";
import { ClientInvoice, InvoiceType } from "@/stores/invoiceQuery";
import { Invoice, downloadInvoice } from "@/MyComponents/invoice";

interface Props {
  invoiceId: number | null;
  onClose: () => void;
}

export const InvoicePreviewPane: React.FC<Props> = ({ invoiceId, onClose }) => {
  // Conditional hook avoidance — pass 0 when null
  const { data, isLoading } = ClientInvoice(invoiceId || 0);
  const invoice: InvoiceType | undefined = data?.[0];

  if (!invoiceId) {
    return (
      <div className="bg-[#0a0a0a] border border-white/[0.04] rounded-sm h-full flex items-center justify-center">
        <div className="text-center max-w-xs">
          <Eye className="h-10 w-10 text-white/[0.06] mx-auto mb-3" />
          <p className="text-[14px] text-white/40 font-medium mb-1">
            Preview pane
          </p>
          <p className="text-[12px] text-white/20">
            Click an invoice to preview the PDF
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0a] border border-white/[0.04] rounded-sm h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-3 flex items-center justify-between border-b border-white/[0.04]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-sm bg-red-500/[0.08]">
            <FileText className="h-3.5 w-3.5 text-red-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-white/15 uppercase tracking-[0.15em] font-medium">
              Preview
            </p>
            {invoice && (
              <p className="text-[11px] text-white/50 truncate">
                #{invoice.invoice_id} · {invoice.invoice_title}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {invoice && (
            <button
              onClick={() => downloadInvoice(invoice, `invoice-${invoice.invoice_id}.pdf`)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-500/[0.08] hover:bg-red-500/[0.12] border border-red-500/15 text-red-400 text-[11px] rounded-sm transition-colors"
              title="Download PDF"
            >
              <Download className="h-3 w-3" /> Download
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-sm text-white/20 hover:text-white/50 hover:bg-white/[0.04] transition-colors"
            title="Close preview"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* PDF */}
      <div className="flex-1 bg-zinc-900">
        {isLoading || !invoice ? (
          <div className="h-full flex items-center justify-center">
            <div className="h-5 w-5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
          </div>
        ) : (
          <PDFViewer
            showToolbar={false}
            width="100%"
            height="100%"
            style={{ border: "none" }}
          >
            <Invoice invoice={invoice} />
          </PDFViewer>
        )}
      </div>
    </div>
  );
};
