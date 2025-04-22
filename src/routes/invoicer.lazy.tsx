import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import Loader from "../MyComponents/Reusables/skeletonLoader";
import { Plus, RefreshCcw } from "lucide-react";
import EmailBtn from "@/MyComponents/Reusables/emailBtn";
import { motion } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useClientStore, useInvoiceStore } from "@/stores/invoiceStore";
import { Invoices } from "@/stores/invoiceQuery";
import { InvoiceForm } from "@/MyComponents/subForms/InvoiceForms/createInvoice";

function Invoicer() {
  const navigate = useNavigate();

  const { name } = useClientStore();
  const { setInvoiceID } = useInvoiceStore();
  const { data, error, isLoading, isFetching, refetch } = Invoices(name);
  if (isFetching) return <Loader />; // Need it for when switching client names
  if (isLoading) return <Loader />;
  if (error) {
    console.log("Error", error.message);
  }

  if (name === "") {
    return (
      <div className="p-2 w-full h-full">
        <span className="italic text-gray-400">Select a Client...</span>
      </div>
    );
  }

  if (data?.length === 0) {
    return (
      <div className="p-2 w-full h-full">
        {/* Header */}
        <section className="flex text-3xl items-center w-full mb-5 pl-2 font-semibold font-mono">
          {name}

          <button
            className="absolute right-0 mr-2 hover:rotate-180 transition-all duration-200"
            id="refresh-btn"
            onClick={() => refetch()}
          >
            <RefreshCcw
              className="hover:cursor-pointer bg-red-900 hover:scale-110 rounded-full text-black "
              size={29}
            />
          </button>

          {/* Sheet window for form input */}
          <Sheet>
            <SheetTrigger className="absolute right-0 mr-12 rounded-full p-1 bg-red-900 hover:scale-110 hover:cursor-pointer hover:rotate-45 transition-all duration-200">
              <Plus className="text-black hover:text-gray-800" size={20} />
            </SheetTrigger>
            <SheetContent className="text-white bg-black border-l-2 border-red-500 overflow-y-scroll">
              <SheetHeader className="select-none">
                <SheetTitle className="text-white">Create Invoice</SheetTitle>
                <SheetDescription className="text-gray-400 italic">
                  Create a new Invoice for the client lol
                </SheetDescription>
              </SheetHeader>

              <InvoiceForm />
            </SheetContent>
          </Sheet>
        </section>
        {/* <Separator /> */}
        <section className="flex justify-center items-center text-3xl w-full mb-5 font-semibold select-none">
          <h3 className="">Invoices</h3>
        </section>

        {/* Description */}
        <span className="italic text-gray-400 select-none">
          This Client has no Invoices...
        </span>
      </div>
    );
  }

  const handleNavigation = (invoiceId: number) => {
    setInvoiceID(invoiceId);
    setTimeout(() => {
      navigate({ to: "/middle" });
    }, 500);
  };

  return (
    <div className="p-2 w-full h-full">
      {/* Header */}
      <section className="flex text-3xl items-center w-full mb-5 pl-2 font-semibold font-mono">
        {data![0].client_name}

        <button
          className="absolute right-0 mr-2 hover:rotate-180 transition-all duration-200"
          id="refresh-btn"
          onClick={() => refetch()}
        >
          <RefreshCcw
            className="hover:cursor-pointer bg-red-900 hover:scale-110 rounded-full text-black "
            size={29}
          />
        </button>

        {/* Sheet window for form input */}
        <Sheet>
          <SheetTrigger className="absolute right-0 mr-12 rounded-full p-1 bg-red-900 hover:scale-110 hover:cursor-pointer hover:rotate-45 transition-all duration-200">
            <Plus className="text-black hover:text-gray-800" size={20} />
          </SheetTrigger>
          <SheetContent className="text-white bg-black border-l-2 border-red-500 overflow-y-scroll">
            <SheetHeader className="select-none">
              <SheetTitle className="text-white">Create Invoice</SheetTitle>
              <SheetDescription className="text-gray-400 italic">
                Create a new Invoice for the client lol
              </SheetDescription>
            </SheetHeader>

            <InvoiceForm />
          </SheetContent>
        </Sheet>
      </section>
      {/* <Separator /> */}
      <section className="flex justify-center items-center text-3xl w-full mb-5 font-semibold select-none">
        <h3 className="">Invoices</h3>
      </section>

      {/* Invoice Card */}
      <section className="flex flex-wrap justify-center gap-8">
        {data?.map((invoice) => (
          // Card
          <motion.section
            key={invoice.invoice_id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{
              scale: 1.03,
              boxShadow: "0 0 12px 2px rgba(185, 28, 28, 0.3)",
            }}
            transition={{ duration: 0.2 }}
            onClick={() => handleNavigation(invoice.invoice_id)}
            className="group relative w-[400px] h-[200px] bg-gradient-to-br from-black to-red-900 border border-red-900 hover:border-red-500 rounded-lg overflow-hidden cursor-pointer"
          >
            {/* Header / Title */}
            <div className="absolute top-0 left-0 right-0 bg-red-950/30 py-2 z-10">
              <h3 className="text-xl font-semibold text-amber-50 text-center">
                {invoice.invoice_title}
              </h3>
            </div>

            {/* Email Button */}
            <div className="absolute top-2 right-3 hidden group-hover:block z-20">
              <EmailBtn
                email={invoice.client_email}
                invoiceID={invoice.invoice_id}
                className="p-2 rounded-lg bg-red-900/20 text-black hover:bg-red-800/30 active:text-amber-300 cursor-pointer"
              />
            </div>

            {/* Stats */}
            <div className="flex flex-col h-full justify-end pb-6 px-6 pt-14 bg-black">
              <span className="font-mono text-xs text-amber-50/70">
                ID: #{invoice.invoice_id}
              </span>
              <span className="text-lg font-medium text-amber-50 mt-3">
                {invoice.client_name}
              </span>
              <span className="text-md font-mono font-semibold text-emerald-500 mt-3">
                ${invoice.outcome}
                <span className="text-emerald-500 animate-pulse [animation-duration:_1s]">
                  _
                </span>
              </span>
            </div>
          </motion.section>
        ))}
      </section>
    </div>
  );
}

export const Route = createLazyFileRoute("/invoicer")({
  component: Invoicer,
});
