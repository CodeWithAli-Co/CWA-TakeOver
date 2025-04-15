import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Plus } from "lucide-react";
import { useClientStore } from "@/stores/invoiceStore";
import { Clients as fetchClients, Invoices } from "@/stores/invoiceQuery";
import { AddClient } from "@/MyComponents/subForms/InvoiceForms/addClient";

// import Loader from "./Reusables/loader";

function InvoiceClients() {
  const navigate = useNavigate();

  const { setName, setEmail, name } = useClientStore();
  const { data: clients, error }: any = fetchClients();
  const { refetch } = Invoices(name);
  // if (isLoading) return <Loader />;
  if (error) {
    console.log("Error:", error.message);
  }

  if (clients?.length === 0) {
    return (
      <>
        <div className="h-screen w-full border-r-2 border-red-500">
          <section className="flex justify-center mt-1">
            <h3 className="text-xl font-semibold select-none">Clients</h3>
            {/* Sheet window to add client */}
            <Sheet>
              <SheetTrigger className="absolute left-0 ml-2 mt-1 hover:cursor-pointer hover:rotate-45 transition-all duration-200">
                <Plus className="text-red-500 hover:text-amber-200" />
              </SheetTrigger>
              <SheetContent
                side="left"
                className="text-white bg-black border-r-2 border-red-500 overflow-y-scroll"
              >
                <SheetHeader className="select-none">
                  <SheetTitle className="text-white">Add Client</SheetTitle>
                  <SheetDescription className="text-gray-400 italic">
                    Add a new Client
                  </SheetDescription>
                </SheetHeader>

                <AddClient />
              </SheetContent>
            </Sheet>
          </section>
          <h3 className="italic text-gray-400">No Clients</h3>
        </div>
      </>
    );
  }

  const changeName = (name: string, email: string) => {
    setName(name);
    setEmail(email);
    navigate({ to: "/invoicer" });
    setTimeout(() => {
      refetch();
    }, 200);
  };
  return (
    <>
      <div className="h-screen w-full border-r-2 border-red-500 flex flex-col bg-black text-white ">
        <section className="flex justify-between items-center px-6 py-4 border-b border-redd-900/30">
          <h3 className="text-2xl font-bold select-none tracking-tight">
            Clients
          </h3>

          {/* Sheet window to add client */}
          <Sheet>
            <SheetTrigger className="rounded-full p-2 bg-red-900/20 hover:bg-red-950/20 hover:scale-110 left-0 ml-2 mt-1 hover:cursor-pointer hover:rotate-45 transition-all duration-200">
              <Plus className="text-red-500 hover:text-red-400" size={20} />
            </SheetTrigger>
            <SheetContent
              side="left"
              className="text-white bg-black border-r-2 border-red-500 overflow-y-scroll"
            >
              <SheetHeader className="select-none">
                <SheetTitle className="text-white">Add Client</SheetTitle>
                <SheetDescription className="text-gray-400 italic">
                  Add a new Client.
                </SheetDescription>
              </SheetHeader>

              <AddClient />
            </SheetContent>
          </Sheet>
        </section>

        {/* Client list but Ali versionified */}
        <div className="flex-1 overflow-y-auto px-4">
          {/* <hr className="w-40 text-red-400" /> */}

          {/* styling for the cards */}
          <div className="space-y-2 py-5 w-[1050px]">
            {clients?.map((client: any) => (
              <div
                key={client.id}
                onClick={() => changeName(client.name, client.email)}
                className="group relative px-4 py-3 rounded-md bg-red-950/20 hover:bg-red-900/20 border-l-2 border-transparent hover:border-red-500 transition-all duration-200 ease-in-out cursor pointer "
              >
                {/* Animation for the indicatourr  */}
                <div className="Absolute left-0 top-0 h-full w-0 bg-red-500/10 group-hover:w-full transition-all duration-500 ease-in-out" />
                {/*  */}
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center">
                    <div className="w-1 h-1 bg-red-500 rounded-full mr-3 group-hover:scale-150 transition-all duration-30 "></div>
                    <span className="text-lg font-medium  select-none group:hover:text-red-400 transition-colors duration-200">
                      -
                    </span>{" "}
                    {client.name}
                  </div>
                {/* Fancy little email trick suprise for blazey */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <span className="text-xs text-gray-400">{client.email}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* <section
          className={`grid grid-rows-${clients?.length} h-max overflow-clip wrap-anywhere mx-100`}
        >
        </section> */}
        </div>
      </div>
    </>
  );
}

export const Route = createLazyFileRoute("/invoiceClients")({
  component: InvoiceClients,
});
