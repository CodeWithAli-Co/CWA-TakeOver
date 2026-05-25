/**
 * invoice.tsx — PDF invoice generation using react-pdf.
 *
 * Generates a clean, professional PDF for an invoice. Supports both the
 * new dynamic line_items column AND legacy item_1/2/3 columns via the
 * getLineItems() helper from invoiceQuery.ts.
 *
 * Exports:
 *   - Invoice({ invoice })           — PDF Document component (takes invoice prop)
 *   - downloadInvoice(invoice, name) — generates blob and triggers download
 *   - InvoiceRenderer({ invoice })   — embedded PDFViewer (kept for legacy /invoicePreview if needed)
 */

import {
  Document,
  Page,
  PDFViewer,
  Text,
  StyleSheet,
  View,
  pdf,
  Image,
} from "@react-pdf/renderer";
import { Download } from "lucide-react";
import { FormatDate } from "./Reusables/dateFormatter";
import { InvoiceType, getLineItems } from "@/stores/invoiceQuery";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "white",
    padding: 40,
    fontFamily: "Helvetica",
  },
  headerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  headerContent: { flexDirection: "column", width: "60%" },
  headerLine: {
    borderBottomColor: "#cc0000",
    borderBottomWidth: 5,
    width: "100%",
    marginBottom: 20,
  },
  companyName: {
    color: "#cc0000",
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
  },
  contactInfo: { color: "#555555", fontSize: 10, marginBottom: 3 },
  avatar: { width: 100, height: 100 },
  titleSection: { marginBottom: 30 },
  invoiceTitle: { fontSize: 32, fontFamily: "Helvetica-Bold", marginBottom: 5 },
  invoiceDate: { fontSize: 14, color: "#cc0000", fontFamily: "Helvetica-Bold" },
  infoSection: {
    marginBottom: 30,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoBlock: { flexDirection: "column", marginBottom: 15, width: "30%" },
  infoHeader: {
    fontSize: 12,
    color: "#333333",
    fontFamily: "Helvetica-Bold",
    marginBottom: 5,
  },
  infoContent: { color: "#555555", fontSize: 10, lineHeight: 1.5 },
  divider: {
    borderBottomColor: "#dddddd",
    borderBottomWidth: 1,
    width: "100%",
    marginVertical: 20,
  },
  tableSection: { marginBottom: 30 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    padding: 8,
    borderBottomWidth: 2,
    borderBottomColor: "#cc0000",
    marginBottom: 5,
  },
  tableHeaderText: {
    color: "#cc0000",
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
    padding: 8,
    minHeight: 30,
    alignItems: "center",
  },
  tableRowAlt: { backgroundColor: "#f9f9f9" },
  descriptionCol: { width: "45%" },
  qtyCol: { width: "15%", textAlign: "center" },
  priceCol: { width: "20%", textAlign: "right" },
  totalCol: { width: "20%", textAlign: "right" },
  tableText: { fontSize: 10, color: "#333333" },
  notesSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  notes: { width: "60%", flexDirection: "column" },
  notesHeader: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#cc0000",
    marginBottom: 5,
  },
  notesContent: { fontSize: 9, color: "#555555", lineHeight: 1.5 },
  summarySection: { width: "35%" },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  summaryLabel: { fontSize: 10, color: "#cc0000" },
  summaryValue: { fontSize: 10, fontFamily: "Helvetica-Bold", textAlign: "right" },
  footer: {
    marginTop: 40,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 10, color: "#555555" },
  totalAmount: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  paymentInfo: { marginTop: 10, fontSize: 9, color: "#777777" },
});

const formatCurrency = (amount: any) => Number(amount || 0).toFixed(2);

interface InvoiceProps {
  invoice: InvoiceType;
}

/**
 * Invoice — generates the PDF Document.
 * Uses getLineItems() helper which handles both new line_items column and
 * legacy item_1/2/3 fields automatically.
 */
export const Invoice: React.FC<InvoiceProps> = ({ invoice }) => {
  const lineItems = getLineItems(invoice);

  return (
    <Document author="CodeWithAli" creator="CodeWithAli" producer="CodeWithAli">
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerSection}>
          <View style={styles.headerContent}>
            <View style={styles.headerLine} />
            <Text style={styles.companyName}>{invoice.sender || "CodeWithAli"}</Text>
            <Text style={styles.contactInfo}>Phone: +1 (408) 690 4009</Text>
            <Text style={styles.contactInfo}>Email: unfold@codewithali.com</Text>
            <Text style={styles.contactInfo}>Web: codewithali.com</Text>
          </View>
          <Image src="/codewithali_circle.png" style={styles.avatar} />
        </View>

        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.invoiceTitle}>Invoice</Text>
          <Text style={styles.invoiceDate}>
            Submitted on {FormatDate(invoice.creation_date)}
          </Text>
        </View>

        {/* Client + Project info */}
        <View style={styles.infoSection}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoHeader}>Invoice for</Text>
            <Text style={styles.infoContent}>{invoice.client_name}</Text>
            {invoice.client_location && (
              <Text style={styles.infoContent}>{invoice.client_location}</Text>
            )}
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoHeader}>Project</Text>
            <Text style={styles.infoContent}>{invoice.invoice_title}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoHeader}>Invoice Details</Text>
            <Text style={styles.infoContent}>Invoice #: {invoice.invoice_id}</Text>
            <Text style={styles.infoContent}>
              Date: {FormatDate(invoice.creation_date)}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Line items table — dynamic */}
        <View style={styles.tableSection}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.descriptionCol]}>Description</Text>
            <Text style={[styles.tableHeaderText, styles.qtyCol]}>Qty</Text>
            <Text style={[styles.tableHeaderText, styles.priceCol]}>Unit Price</Text>
            <Text style={[styles.tableHeaderText, styles.totalCol]}>Total</Text>
          </View>

          {lineItems.map((item, i) => (
            <View
              key={i}
              style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text style={[styles.tableText, styles.descriptionCol]}>{item.name}</Text>
              <Text style={[styles.tableText, styles.qtyCol]}>{item.qty}</Text>
              <Text style={[styles.tableText, styles.priceCol]}>
                ${formatCurrency(item.price)}
              </Text>
              <Text style={[styles.tableText, styles.totalCol]}>
                ${formatCurrency(item.total)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Notes + summary */}
        <View style={styles.notesSection}>
          <View style={styles.notes}>
            {invoice.note && (
              <>
                <Text style={styles.notesHeader}>Notes:</Text>
                <Text style={styles.notesContent}>{invoice.note}</Text>
              </>
            )}
            <View style={{ marginTop: invoice.note ? 15 : 0 }}>
              <Text style={styles.notesHeader}>Payment Information:</Text>
              <Text style={styles.notesContent}>
                Bank Account: {invoice.bank_account || "-"}
              </Text>
              <Text style={styles.notesContent}>
                Please include invoice number in the payment reference.
              </Text>
            </View>
          </View>

          <View style={styles.summarySection}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryValue}>${formatCurrency(invoice.subtotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Adjustments:</Text>
              <Text style={styles.summaryValue}>${formatCurrency(invoice.adjustment)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount:</Text>
              <Text style={styles.summaryValue}>${formatCurrency(invoice.discount)}</Text>
            </View>
            <View style={[styles.divider, { marginVertical: 10 }]} />
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { fontSize: 14 }]}>Total Due:</Text>
              <Text style={[styles.summaryValue, { fontSize: 14 }]}>
                ${formatCurrency(invoice.outcome)}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{invoice.sender}</Text>
          <View>
            <Text style={styles.totalAmount}>${formatCurrency(invoice.outcome)}</Text>
            <Text style={styles.paymentInfo}>Due upon receipt</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

/**
 * downloadInvoice — generates PDF blob from invoice and triggers download.
 */
export const downloadInvoice = async (
  invoice: InvoiceType,
  filename: string = "invoice.pdf"
) => {
  try {
    const pdfBlob = await pdf(<Invoice invoice={invoice} />).toBlob();
    const link = document.createElement("a");
    const url = URL.createObjectURL(pdfBlob);
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading invoice:", error);
  }
};

/**
 * InvoiceRenderer — kept for backward compatibility with /invoicePreview route.
 * New code should use InvoicePreviewPane instead.
 */
export const InvoiceRenderer: React.FC<{
  invoice?: InvoiceType;
  invoiceName?: string;
}> = ({ invoice, invoiceName }) => {
  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h3 className="text-lg text-muted-foreground/70 italic">No Invoice to Preview</h3>
        <p className="text-sm text-muted-foreground mt-2">Please create an invoice first</p>
      </div>
    );
  }

  return (
    <div className="relative h-screen">
      <div
        onClick={() => downloadInvoice(invoice, invoiceName || "invoice.pdf")}
        className="absolute right-5 top-5 flex justify-center items-center p-2 rounded-sm bg-red-500 text-primary-foreground shadow-md hover:bg-primary transition-colors cursor-pointer z-10"
        title="Download Invoice"
      >
        <Download size={20} />
      </div>
      <PDFViewer
        showToolbar={false}
        width="100%"
        height="100%"
        style={{ border: "none" }}
      >
        <Invoice invoice={invoice} />
      </PDFViewer>
    </div>
  );
};
