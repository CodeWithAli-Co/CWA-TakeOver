import { companySupabase } from "@/routes/index.lazy";
import { useQuery } from "@tanstack/react-query";
import { useCompanyFilter } from "./store";

interface ClientType {
  id: number;
  name: string;
  /**
   * *Emails are `unique` in DB
   */
  email: string;
  company?: string;
}
// Fetch All Clients — scoped by company
const fetchClients = async (company: string) => {
  let query = companySupabase.from("clients").select("*");
  if (company !== "all") {
    const label = company === "simplicityFunds" ? "simplicity" : "CodeWithAli";
    query = query.eq("company", label);
  }
  const { data, error } = await query;
  if (error) {
    console.error("Error fetching Clients:", error.message);
  }
  const res = data as ClientType[];
  return res;
};
export const Clients = () => {
  const { activeCompany } = useCompanyFilter();
  return useQuery({
    queryKey: ["clients", activeCompany],
    queryFn: () => fetchClients(activeCompany),
    refetchInterval: 10000,
  });
};

type InvoiceStatus = "paid" | "pending";

// Single line item — used in the new dynamic line_items JSON column
export interface LineItem {
  name: string;
  qty: number;
  price: number;
  total: number;
}

export interface InvoiceType {
  status: InvoiceStatus;
  invoice_id: number;
  creation_date: number;
  invoice_title: string;
  client_name: string;
  client_email: string;
  client_location?: string;
  // Dynamic line items (preferred — added in 2025 schema migration)
  line_items?: LineItem[];
  // Legacy fixed-3 columns (kept for backward compatibility — old invoices read from these)
  item_1?: string;
  item_2?: string;
  item_3?: string;
  qty_1?: number;
  qty_2?: number;
  qty_3?: number;
  price_1?: number;
  price_2?: number;
  price_3?: number;
  total_1?: number;
  total_2?: number;
  total_3?: number;
  note?: string;
  subtotal: number;
  adjustment?: number;
  sender: string;
  outcome: number;
  bank_account?: string;
  /**
   * Discount is in USD amount
   */
  discount?: number;
}

// Helper — normalize invoice to always return line items array
// (handles both new line_items column and legacy item_1/2/3 fields)
export function getLineItems(inv: InvoiceType): LineItem[] {
  if (inv.line_items && inv.line_items.length > 0) return inv.line_items;
  const items: LineItem[] = [];
  for (let i = 1; i <= 3; i++) {
    const name = (inv as any)[`item_${i}`];
    if (name) {
      items.push({
        name,
        qty: (inv as any)[`qty_${i}`] || 0,
        price: (inv as any)[`price_${i}`] || 0,
        total: (inv as any)[`total_${i}`] || 0,
      });
    }
  }
  return items;
}
// Fetch all of Client's Invoices — scoped by company
const fetchInvoices = async (name: string, company: string) => {
  let query = companySupabase
    .from("invoices")
    .select("*")
    .eq("client_name", name);
  if (company !== "all") {
    const label = company === "simplicityFunds" ? "simplicity" : "CodeWithAli";
    query = query.eq("company", label);
  }
  const { data, error } = await query;
  if (error) {
    console.error("Error fetching Invoices:", error.message);
  }

  const res = data as InvoiceType[];
  return res;
};
export const Invoices = (name: string) => {
  const { activeCompany } = useCompanyFilter();
  return useQuery({
    queryKey: ["invoices", name, activeCompany],
    queryFn: () => fetchInvoices(name, activeCompany),
    refetchOnWindowFocus: true,
  });
};

// Fetch ALL invoices (no client filter) — used by financial dashboard — scoped by company
const fetchAllInvoices = async (company: string) => {
  let query = companySupabase
    .from("invoices")
    .select("*")
    .order("creation_date", { ascending: false });
  if (company !== "all") {
    const label = company === "simplicityFunds" ? "simplicity" : "CodeWithAli";
    query = query.eq("company", label);
  }
  const { data, error } = await query;
  if (error) {
    console.error("Error fetching all Invoices:", error.message);
  }
  return (data as InvoiceType[]) || [];
};
export const AllInvoices = () => {
  const { activeCompany } = useCompanyFilter();
  return useQuery({
    queryKey: ["all-invoices", activeCompany],
    queryFn: () => fetchAllInvoices(activeCompany),
    refetchOnWindowFocus: true,
  });
};

// Fetch Client's Invoice — scoped by company
const fetchInvoice = async (id: number, company: string) => {
  let query = companySupabase
    .from("invoices")
    .select("*")
    .eq("invoice_id", id);
  if (company !== "all") {
    const label = company === "simplicityFunds" ? "simplicity" : "CodeWithAli";
    query = query.eq("company", label);
  }
  const { data, error } = await query;
  if (error) {
    console.error("Error fetching client's Invoice:", error.message);
  }
  const res = data as InvoiceType[];
  return res;
};
export const ClientInvoice = (id: number) => {
  const { activeCompany } = useCompanyFilter();
  return useQuery({
    queryKey: ["client-invoice", id, activeCompany],
    queryFn: () => fetchInvoice(id, activeCompany),
    refetchOnWindowFocus: true,
  });
};
