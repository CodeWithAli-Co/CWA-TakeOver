import { create } from "zustand";

// Client Details
interface ClientState {
  id: number;
  name: string;
  setName: (name: string) => void
  email: string
  setEmail: (email: string) => void
}
export const useClientStore = create<ClientState>()((set) => ({
  id: 1,
  name: "",
  setName: (name: string) => set({ name }),
  email: "",
  setEmail: (email: string) => set({ email })
}))


// Invoice ID store for PDF
interface InvoiceState {
  invoiceID: number,
  setInvoiceID: (invoiceID: number) => void
}
export const useInvoiceStore = create<InvoiceState>()((set) => ({
  invoiceID: 0,
  setInvoiceID: (invoiceID: number) => set({ invoiceID }),
}))
