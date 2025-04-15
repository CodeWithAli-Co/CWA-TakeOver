import { useQuery } from "@tanstack/react-query";
import Database from "@tauri-apps/plugin-sql";
// when using `"withGlobalTauri": true`, you may use
// const Database = window.__TAURI__.sql;

// Placing the db 'await' outside of everything makes the whole app wait until it connects to DB successfully

interface ClientType {
  id: number;
  name: string;
  email: string;
}
type ClientRes = {
  fullRes: ClientType[];
};
// Fetch Active User with Avatar
const fetchClients = async () => {
  const db = await Database.load(import.meta.env.VITE_NEON_DB_URL);
  const res: any = await db.select("SELECT * FROM clients");
  const result: ClientRes = { fullRes: res };
  return result.fullRes;
};
export const Clients = () => {
  return useQuery({
    queryKey: ["clients"],
    queryFn: fetchClients,
    refetchInterval: 10000,
  });
};


export interface InvoiceType {
  status: string;
  invoice_id: number;
  creation_date: string;
  invoice_title: string;
  client_name: string;
  client_email: string;
  client_location?: string;
  item_1: string;
  item_2?: string;
  item_3?: string;
  qty_1: string;
  qty_2?: string;
  qty_3?: string;
  price_1: string;
  price_2?: string;
  price_3?: string;
  total_1: string;
  total_2?: string;
  total_3?: string;
  note?: string;
  subtotal: string;
  adjustment?: string;
  sender: string;
  outcome: string;
  bank_account?: string;
  discount?: string;
}
type InvoiceRes = {
  fullRes: InvoiceType[];
};
// Fetch all of Client's Invoices
const fetchInvoices = async (name: string) => {
  const db = await Database.load(import.meta.env.VITE_NEON_DB_URL);
  const res: any = await db.select("SELECT * FROM invoices WHERE client_name = $1", [name]);
  const result: InvoiceRes = { fullRes: res };
  // console.log("Result:", res)
  return result.fullRes;
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
  const db = await Database.load(import.meta.env.VITE_NEON_DB_URL);
  const res: any = await db.select("SELECT * FROM invoices WHERE invoice_id = $1", [id]);
  const result: InvoiceRes = { fullRes: res };
  // console.log("Result:", res)
  return result.fullRes;
};
export const ClientInvoice = (id: number) => {
  return useQuery({
    queryKey: ["client-invoice"],
    queryFn: () => fetchInvoice(id),
    refetchOnWindowFocus: true,
  });
};
