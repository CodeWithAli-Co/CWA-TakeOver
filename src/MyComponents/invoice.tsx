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
import { myInv } from "../routes/middle.lazy";
import { Download } from "lucide-react";
// import { ClientInvoice } from '../stores/query';
// import download_logo from '../../../../resources/download.svg';

const styles = StyleSheet.create({
  // Document & Page Styles
  page: { 
    backgroundColor: "white", 
    padding: 40,
    fontFamily: "Helvetica",
  },
  
  // Header Styles
  headerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  headerContent: {
    flexDirection: "column",
    width: "60%",
  },
  headerLine: {
    borderBottomColor: "#cc0000",
    borderBottomWidth: 5,
    borderBottomStyle: "solid",
    width: "100%",
    marginBottom: 20,
  },
  companyName: { 
    color: "#cc0000", 
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
  },
  contactInfo: { 
    color: "#555555", 
    fontSize: 10,
    marginBottom: 3,
  },
  avatar: { 
    width: 100,
    height: 100,
  },
  
  // Invoice Title Section
  titleSection: {
    marginBottom: 30,
  },
  invoiceTitle: { 
    fontSize: 32, 
    fontFamily: "Helvetica-Bold",
    marginBottom: 5,
  },
  invoiceDate: {
    fontSize: 14,
    color: "#cc0000",
    fontFamily: "Helvetica-Bold",
  },
  
  // Client Info Section
  infoSection: { 
    marginBottom: 30,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoBlock: { 
    flexDirection: "column", 
    marginBottom: 15,
    width: "30%",
  },
  infoHeader: {
    fontSize: 12,
    color: "#333333",
    fontFamily: "Helvetica-Bold",
    marginBottom: 5,
  },
  infoContent: { 
    color: "#555555", 
    fontSize: 10,
    lineHeight: 1.5,
  },
  
  // Divider
  divider: {
    borderBottomColor: "#dddddd",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    width: "100%",
    marginVertical: 20,
  },
  
  // Table Styles
  tableSection: {
    marginBottom: 30,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    padding: 8,
    borderBottomWidth: 2,
    borderBottomColor: "#cc0000",
    borderBottomStyle: "solid",
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
    borderBottomStyle: "solid",
    padding: 8,
    minHeight: 30,
    alignItems: "center",
  },
  tableRowAlt: {
    backgroundColor: "#f9f9f9",
  },
  // Column width definitions for table
  descriptionCol: { width: "45%" },
  qtyCol: { width: "15%", textAlign: "center" },
  priceCol: { width: "20%", textAlign: "right" },
  totalCol: { width: "20%", textAlign: "right" },
  tableText: { 
    fontSize: 10,
    color: "#333333",
  },
  
  // Notes & Summary Section
  notesSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  notes: {
    width: "60%",
    flexDirection: "column",
  },
  notesHeader: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#cc0000",
    marginBottom: 5,
  },
  notesContent: {
    fontSize: 9,
    color: "#555555",
    lineHeight: 1.5,
  },
  summarySection: {
    width: "35%",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 10,
    color: "#cc0000",
  },
  summaryValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
  },
  
  // Footer Styles
  footer: {
    marginTop: 40,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 10, 
    color: "#555555",
  },
  totalAmount: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
  },
  paymentInfo: {
    marginTop: 10,
    fontSize: 9,
    color: "#777777",
  },
});

/**
 * Invoice Component
 * Generates a PDF invoice document with client details, line items, and totals
 * @returns {React.Component} PDF Document component
 */
export const Invoice = () => {
  // Format currency helper
  const formatCurrency = (amount : any) => {
    return parseFloat(amount).toFixed(2);
  };

  return (
    <>
      <Document
        author="CodeWithAli"
        creator="CodeWithAli"
        producer="CodeWithAli"
      >
        <Page size="A4" style={styles.page}>
          {/* Header Section - Company Info & Logo */}
          <View style={styles.headerSection}>
            <View style={styles.headerContent}>
              <View style={styles.headerLine} />
              <Text style={styles.companyName}>CodeWithAli</Text>
              <Text style={styles.contactInfo}>Phone: +1 (408) 690 4009</Text>
              <Text style={styles.contactInfo}>Email: unfold@codewithali.com</Text>
              <Text style={styles.contactInfo}>Web: codewithali.com</Text>
            </View>
            
            {/* Company Logo/Avatar */}
            <Image src="/codewithali_circle.png" style={styles.avatar} />
          </View>

          {/* Invoice Title Section */}
          <View style={styles.titleSection}>
            <Text style={styles.invoiceTitle}>Invoice</Text>
            <Text style={styles.invoiceDate}>
              Submitted on {myInv.creation_date}
            </Text>
          </View>

          {/* Client & Invoice Info Section */}
          <View style={styles.infoSection}>
            <View style={styles.infoBlock}>
              <Text style={styles.infoHeader}>Invoice for</Text>
              <Text style={styles.infoContent}>{myInv.client_name}</Text>
              <Text style={styles.infoContent}>{myInv.client_location}</Text>
            </View>

            <View style={styles.infoBlock}>
              <Text style={styles.infoHeader}>Project</Text>
              <Text style={styles.infoContent}>{myInv.invoice_title}</Text>
            </View>

            <View style={styles.infoBlock}>
              <Text style={styles.infoHeader}>Invoice Details</Text>
              <Text style={styles.infoContent}>Invoice #: {myInv.invoice_id}</Text>
              <Text style={styles.infoContent}>Due Date: {myInv.creation_date}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Table Section - Line Items */}
          <View style={styles.tableSection}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.descriptionCol]}>Description</Text>
              <Text style={[styles.tableHeaderText, styles.qtyCol]}>Qty</Text>
              <Text style={[styles.tableHeaderText, styles.priceCol]}>Unit Price</Text>
              <Text style={[styles.tableHeaderText, styles.totalCol]}>Total</Text>
            </View>

            {/* Table Rows - Line Items */}
            <View style={styles.tableRow}>
              <Text style={[styles.tableText, styles.descriptionCol]}>{myInv.item_1}</Text>
              <Text style={[styles.tableText, styles.qtyCol]}>{myInv.qty_1}</Text>
              <Text style={[styles.tableText, styles.priceCol]}>${formatCurrency(myInv.price_1)}</Text>
              <Text style={[styles.tableText, styles.totalCol]}>${formatCurrency(myInv.total_1)}</Text>
            </View>

            <View style={[styles.tableRow, styles.tableRowAlt]}>
              <Text style={[styles.tableText, styles.descriptionCol]}>{myInv.item_2}</Text>
              <Text style={[styles.tableText, styles.qtyCol]}>{myInv.qty_2}</Text>
              <Text style={[styles.tableText, styles.priceCol]}>${formatCurrency(myInv.price_2)}</Text>
              <Text style={[styles.tableText, styles.totalCol]}>${formatCurrency(myInv.total_2)}</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.tableText, styles.descriptionCol]}>{myInv.item_3}</Text>
              <Text style={[styles.tableText, styles.qtyCol]}>{myInv.qty_3}</Text>
              <Text style={[styles.tableText, styles.priceCol]}>${formatCurrency(myInv.price_3)}</Text>
              <Text style={[styles.tableText, styles.totalCol]}>${formatCurrency(myInv.total_3)}</Text>
            </View>

            {/* Additional items could be rendered conditionally as follows:
            {myInv.item_4 && (
              <View style={[styles.tableRow, styles.tableRowAlt]}>
                <Text style={[styles.tableText, styles.descriptionCol]}>{myInv.item_4}</Text>
                <Text style={[styles.tableText, styles.qtyCol]}>{myInv.qty_4}</Text>
                <Text style={[styles.tableText, styles.priceCol]}>${formatCurrency(myInv.price_4)}</Text>
                <Text style={[styles.tableText, styles.totalCol]}>${formatCurrency(myInv.total_4)}</Text>
              </View>
            )} */}
          </View>

          <View style={styles.divider} />

          {/* Notes & Summary Section */}
          <View style={styles.notesSection}>
            <View style={styles.notes}>
              <Text style={styles.notesHeader}>Notes:</Text>
              <Text style={styles.notesContent}>{myInv.note}</Text>
              
              <View style={{ marginTop: 15 }}>
                <Text style={styles.notesHeader}>Payment Information:</Text>
                <Text style={styles.notesContent}>
                  Bank Account: {myInv.bank_account || '-'}
                </Text>
                <Text style={styles.notesContent}>
                  Please include invoice number in the payment reference.
                </Text>
              </View>
            </View>

            <View style={styles.summarySection}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal:</Text>
                <Text style={styles.summaryValue}>${formatCurrency(myInv.subtotal)}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Adjustments:</Text>
                <Text style={styles.summaryValue}>${formatCurrency(myInv.adjustment)}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Discount:</Text>
                <Text style={styles.summaryValue}>${formatCurrency(myInv.discount)}</Text>
              </View>

              <View style={[styles.divider, { marginVertical: 10 }]} />

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { fontSize: 14 }]}>Total Due:</Text>
                <Text style={[styles.summaryValue, { fontSize: 14 }]}>${formatCurrency(myInv.outcome)}</Text>
              </View>
            </View>
          </View>

          {/* Footer Section */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>{myInv.sender}</Text>
            <View>
              <Text style={styles.totalAmount}>${formatCurrency(myInv.outcome)}</Text>
              <Text style={styles.paymentInfo}>Due upon receipt</Text>
            </View>
          </View>
        </Page>
      </Document>
    </>
  );
};

/**
 * Download Invoice Function
 * Creates and triggers download of the invoice PDF
 */
export const downloadInvoice = async (filename: string = "cwa-invoice2051316.pdf") => {
  try {
    // Create the PDF using react-pdf's `pdf` method
    const pdfBlob = await pdf(<Invoice />).toBlob();

    // Create a link element
    const link = document.createElement("a");

    // Create a URL for the blob
    const url = URL.createObjectURL(pdfBlob);

    // Set the link's download attribute to the desired filename
    link.href = url;
    link.download = filename; // Name of the PDF file

    // Trigger the download
    link.click();

    // Clean up the object URL
    URL.revokeObjectURL(url);
    
    console.log("Invoice downloaded successfully");
  } catch (error) {
    console.error("Error downloading invoice:", error);
  }
};

/**
 * Invoice Renderer Component
 * Displays the PDF viewer with the invoice and download button
 * @returns {React.Component} Component with PDF viewer and download button
 */
export const InvoiceRenderer = ({ invoiceName }: { invoiceName?: string }) => {
  // Commented out code for database storage (kept for reference)
  // const savePdfToDB = async () => {
  //   // Create the PDF using react-pdf's `pdf` method
  //   const pdfBlob = await pdf(<Invoice />).toBlob();
  //
  //   // IMPORTANT: Need to pass arraybuffer through IPC instead of Blob bc Blob will lose its 'prototype' and arrayBuffer method wont work in main process after.
  //   // Need to move this to its rightful location
  //   const arraybuffer = await pdfBlob.arrayBuffer();
  //   // api 'addInvoice' is deprecated
  //   await window.api.writeInvoice(arraybuffer)
  // };

  return (
    <>
      {/* Conditional rendering based on invoice availability */}
      {myInv === undefined ? (
        <div className="flex flex-col items-center justify-center h-full">
          <h3 className="text-lg text-gray-400 italic">
            No Invoice to Preview
          </h3>
          <p className="text-sm text-gray-300 mt-2">
            Please create an invoice first
          </p>
        </div>
      ) : (
        <div className="relative h-screen">
          {/* Download button with enhanced styling */}
          <div 
            onClick={() => downloadInvoice(invoiceName)} 
            className="absolute right-5 top-5 flex justify-center items-center p-2 rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 transition-colors cursor-pointer z-10"
            title="Download Invoice"
          >
            <Download size={20} />
          </div>
          
          {/* PDF Viewer */}
          <PDFViewer
            showToolbar={false}
            width={"100%"}
            height={"100%"}
            style={{ 
              border: "none",
              borderRadius: "4px",
            }}
          >
            <Invoice />
          </PDFViewer>
        </div>
      )}
    </>
  );
};