import { InvoiceRenderer } from "@/MyComponents/invoice";
import { createLazyFileRoute } from "@tanstack/react-router";

function InvoicePreview() {
  return (
    <div className="h-full w-full">
      <InvoiceRenderer invoiceName="invoice.pdf" />
    </div>
  );
}

export const Route = createLazyFileRoute("/invoicePreview")({
  component: InvoicePreview,
});
