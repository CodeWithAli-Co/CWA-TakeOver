import supabase from "@/MyComponents/supabase";
import { useQuery } from "@tanstack/react-query";

interface ClientType {
  id: number;
  name: string;
  /**
   * *Emails are `unique` in DB
   */
  email: string;
}
// Fetch All Clients
const fetchClients = async () => {
  const { data, error } = await supabase.from("clients").select("*");
  if (error) {
    console.error("Error fetching Clients:", error.message);
  }
  const res = data as ClientType[];
  return res;
};
export const Clients = () => {
  return useQuery({
    queryKey: ["clients"],
    queryFn: fetchClients,
    refetchInterval: 10000,
  });
};

type InvoiceStatus = "paid" | "pending";
export interface InvoiceType {
  status: InvoiceStatus;
  invoice_id: number;
  creation_date: number;
  invoice_title: string;
  client_name: string;
  client_email: string;
  client_location?: string;
  item_1: string;
  item_2?: string;
  item_3?: string;
  qty_1: number;
  qty_2?: number;
  qty_3?: number;
  price_1: number;
  price_2?: number;
  price_3?: number;
  total_1: number;
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
// Fetch all of Client's Invoices
const fetchInvoices = async (name: string) => {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("client_name", name);
  if (error) {
    console.error("Error fetching Invoices:", error.message);
  }

  const res = data as InvoiceType[];
  return res;
};
export const Invoices = (name: string) => {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: () => fetchInvoices(name),
    refetchOnWindowFocus: true,
    // enabled: queryState.active
  });
};

// Fetch Client's Invoice
const fetchInvoice = async (id: number) => {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("invoice_id", id);
  if (error) {
    console.error("Error fetching client's Invoice:", error.message);
  }
  const res = data as InvoiceType[];
  return res;
};
export const ClientInvoice = (id: number) => {
  return useQuery({
    queryKey: ["client-invoice"],
    queryFn: () => fetchInvoice(id),
    refetchOnWindowFocus: true,
  });
};
