import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "@tanstack/react-form";
import { Loader2, Send } from "lucide-react";
import { useClientStore } from "@/stores/invoiceStore";
import supabase from "@/MyComponents/supabase";
import { InvoiceType } from "@/stores/invoiceQuery";

export const InvoiceForm = () => {
  const { name, email } = useClientStore();

  const form = useForm({
    defaultValues: {
      title: "",
      clientName: `${name}`,
      clientEmail: `${email}`,
      clientLocation: "",
      item1: "",
      item2: "",
      item3: "",
      qty1: "",
      qty2: "",
      qty3: "",
      price1: "",
      price2: "",
      price3: "",
      note: "",
      adjustment: "",
      sender: "CodeWithAli",
      bankAcc: "-",
      discount: ""
    },
    onSubmit: async ({ value }) => {
      const Total1 = Number(value.qty1) * Number(value.price1);
      const Total2 = Number(value.qty2) * Number(value.price2);
      const Total3 = Number(value.qty3) * Number(value.price3);
      const Subtotal = Total1 + Total2 + Total3;
      const Outcome = (Subtotal + Number(value.adjustment)) - Number(value.discount);
      await supabase.from("invoices").insert({
        invoice_title: value.title,
        client_name: value.clientName,
        client_email: value.clientEmail,
        client_location: value.clientLocation,
        item_1: value.item1,
        item_2: value.item2,
        item_3: value.item3,
        qty_1: Number(value.qty1),
        qty_2: Number(value.qty2),
        qty_3: Number(value.qty3),
        price_1: Number(value.price1),
        price_2: Number(value.price2),
        price_3: Number(value.price3),
        total_1: Total1,
        total_2: Total2,
        total_3: Total3,
        note: value.note,
        subtotal: Subtotal,
        adjustment: Number(value.adjustment),
        sender: value.sender,
        outcome: Outcome,
        bank_account: value.bankAcc,
        discount: Number(value.discount),
        creation_date: Date.now(),
        status: "pending", // Later add btn to say that invoice has been paid and we'll update the value to 'paid' ?ali
      } as Omit<InvoiceType, 'invoice_id'>)

      form.reset();
    },
  });

  return (
    <>
     <div className="p-8 md:p-10 bg-gradient-to-b from-black to-red-950/60 rounded-xl">
     {/* <h1 className="text-outline text-4xl font-bold">Outlined Black Text</h1> */}

        <div className="grid grid-cols-1 gap-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-6"
          >
            <div>
              <form.Field
                name="title"
                children={(field) => {
                  return (
                    <>
                      <label
                        htmlFor={field.name}
                        className="block text-amber-50 font-medium mb-2 tracking-tight"
                      >
                        Title
                      </label>
                      <input
                        name={field.name}
                        autoComplete="off"
                        required
                        className="bg-black border border-red-800/60 rounded-lg pl-2 text-white focus:border-red-950/30 h-12 text-base w-full"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </>
                  );
                }}
              />
              <br />
              <form.Field
                name="clientName"
                children={(field) => {
                  return (
                    <>
                      <label
                        htmlFor={field.name}
                        className="block text-amber-50 tracking-tight font-medium mb-2"
                      >
                        Client Name
                      </label>
                      <input
                        name={field.name}
                        autoComplete="off"
                        required
                        className="bg-black border  border-red-800/60 rounded-lg pl-2 text-white focus:border-red-600 h-12 text-base w-full"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </>
                  );
                }}
              />
              <br />
              <form.Field
                name="clientEmail"
                children={(field) => {
                  return (
                    <>
                      <label
                        htmlFor={field.name}
                        className="block text-amber-50 font-medium mb-2"
                      >
                        Email
                      </label>
                      <input
                        name={field.name}
                        autoComplete="off"
                        required
                        className="bg-black border border-red-800/60 rounded-lg pl-2 text-white focus:border-red-600 h-12 text-base w-full"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </>
                  );
                }}
              />
              <br />
              <form.Field
                name="clientLocation"
                children={(field) => {
                  return (
                    <>
                      <label
                        htmlFor={field.name}
                        className="block text-amber-50 font-medium mb-2"
                      >
                        Location
                      </label>
                      <input
                        name={field.name}
                        autoComplete="off"
                        className="bg-black border border-red-800/60 rounded-lg pl-2 text-white focus:border-red-600 h-12 text-base w-full"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </>
                  );
                }}
              />
              <br />
              <form.Field
                name="item1"
                children={(field) => {
                  return (
                    <>
                      <label
                        htmlFor={field.name}
                        className="block text-amber-50 font-medium mb-2"
                      >
                       Service 1
                      </label>
                      <input
                        name={field.name}
                        autoComplete="off"
                        required
                        className="bg-black border border-red-800/60 rounded-lg pl-2 text-white focus:border-red-600 h-12 text-base w-full"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </>
                  );
                }}
              />
              <br />
              <form.Field
                name="item2"
                children={(field) => {
                  return (
                    <>
                      <label
                        htmlFor={field.name}
                        className="block text-amber-50 font-medium mb-2"
                      >
                       Service 2
                      </label>
                      <input
                        name={field.name}
                        autoComplete="off"
                        className="bg-black border border-red-800/60 rounded-lg pl-2 text-white focus:border-red-600 h-12 text-base w-full"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </>
                  );
                }}
              />
              <br />
              <form.Field
                name="item3"
                children={(field) => {
                  return (
                    <>
                      <label
                        htmlFor={field.name}
                        className="block text-amber-50 font-medium mb-2"
                      >
                      Service 3
                      </label>
                      <input
                        name={field.name}
                        autoComplete="off"
                        className="bg-black border border-red-800/60 rounded-lg pl-2 text-white focus:border-red-600 h-12 text-base w-full"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </>
                  );
                }}
              />
              <br />
              <form.Field
                name="qty1"
                children={(field) => {
                  return (
                    <>
                      <label
                        htmlFor={field.name}
                        className="block text-amber-50 font-medium mb-2"
                      >
                        Qty 1
                      </label>
                      <input
                        name={field.name}
                        autoComplete="off"
                        required
                        className="bg-black border border-red-800/60 rounded-lg pl-2 text-white focus:border-red-600 h-12 text-base w-full"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </>
                  );
                }}
              />
              <br />
              <form.Field
                name="qty2"
                children={(field) => {
                  return (
                    <>
                      <label
                        htmlFor={field.name}
                        className="block text-amber-50 font-medium mb-2"
                      >
                        Qty 2
                      </label>
                      <input
                        name={field.name}
                        autoComplete="off"
                        className="bg-black border border-red-800/60 rounded-lg pl-2 text-white focus:border-red-600 h-12 text-base w-full"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </>
                  );
                }}
              />
              <br />
              <form.Field
                name="qty3"
                children={(field) => {
                  return (
                    <>
                      <label
                        htmlFor={field.name}
                        className="block text-amber-50 font-medium mb-2"
                      >
                        Qty 3
                      </label>
                      <input
                        name={field.name}
                        autoComplete="off"
                        className="bg-black border border-red-800/60 rounded-lg pl-2 text-white focus:border-red-600 h-12 text-base w-full"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </>
                  );
                }}
              />
              <br />
              <form.Field
                name="price1"
                children={(field) => {
                  return (
                    <>
                      <label
                        htmlFor={field.name}
                        className="block text-amber-50 font-medium mb-2"
                      >
                        Price 1
                      </label>
                      <input
                        name={field.name}
                        autoComplete="off"
                        required
                        className="bg-black border border-red-800/60 rounded-lg pl-2 text-white focus:border-red-600 h-12 text-base w-full"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </>
                  );
                }}
              />
              <br />
              <form.Field
                name="price2"
                children={(field) => {
                  return (
                    <>
                      <label
                        htmlFor={field.name}
                        className="block text-amber-50 font-medium mb-2"
                      >
                        Price 2
                      </label>
                      <input
                        name={field.name}
                        autoComplete="off"
                        className="bg-black border border-red-800/60 rounded-lg pl-2 text-white focus:border-red-600 h-12 text-base w-full"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </>
                  );
                }}
              />
              <br />
              <form.Field
                name="price3"
                children={(field) => {
                  return (
                    <>
                      <label
                        htmlFor={field.name}
                        className="block text-amber-50 font-medium mb-2"
                      >
                        Price 3
                      </label>
                      <input
                        name={field.name}
                        autoComplete="off"
                        className="bg-black border border-red-800/60 rounded-lg pl-2 text-white focus:border-red-600 h-12 text-base w-full"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </>
                  );
                }}
              />
              <br />
              <form.Field
                name="note"
                children={(field) => {
                  return (
                    <>
                      <label
                        htmlFor={field.name}
                        className="block text-amber-50 font-medium mb-2"
                      >
                        Note
                      </label>
                      <Textarea
                        name={field.name}
                        value={field.state.value}
                        className="bg-black border border-red-800/60 text-white focus:ring-red-900 h-40 text-base w-full resize-none"
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </>
                  );
                }}
              />
              <br />
              <form.Field
                name="adjustment"
                children={(field) => {
                  return (
                    <>
                      <label
                        htmlFor={field.name}
                        className="block text-amber-50 font-medium mb-2"
                      >
                       Adjustment
                      </label>
                      <input
                        name={field.name}
                        autoComplete="off"
                        className="bg-black border border-red-800/60 rounded-lg pl-2 text-white focus:border-red-600 h-12 text-base w-full"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </>
                  );
                }}
              />
              <br />
              <form.Field
                name="discount"
                children={(field) => {
                  return (
                    <>
                      <label
                        htmlFor={field.name}
                        className="block text-amber-50 font-medium mb-2"
                      >
                       Discount
                      </label>
                      <input
                        name={field.name}
                        autoComplete="off"
                        className="bg-black border border-red-800/60 rounded-lg pl-2 text-white focus:border-red-600 h-12 text-base w-full"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </>
                  );
                }}
              />
              <br />
              <form.Field
                name="sender"
                children={(field) => {
                  return (
                    <>
                      <label
                        htmlFor={field.name}
                        className="block text-amber-50 font-medium mb-2"
                      >
                        Sender
                      </label>
                      <select
                        name={field.name}
                        className="w-full bg-black border border-red-800/40 text-white focus:border-red-600 rounded-md h-12 text-base px-3"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      >
                        <option value="" className="bg-black">
                          Select Sender
                        </option>
                        <option value="CodeWithAli" className="bg-black">
                          CodeWithAli
                        </option>
                        <option value="Ali Alibrahimi" className="bg-black">
                          Ali Alibrahimi
                        </option>
                        <option value="Hanif Palm" className="bg-black">
                          Hanif Palm
                        </option>
                      </select>
                    </>
                  );
                }}
              />
              <br />
              <form.Field
                name="bankAcc"
                children={(field) => {
                  return (
                    <>
                      <label
                        htmlFor={field.name}
                        className="block text-amber-50 font-medium mb-2"
                      >
                       Bank Account
                      </label>
                      <input
                        name={field.name}
                        autoComplete="off"
                        className="bg-black border border-red-800/60 rounded-lg pl-2 text-white focus:border-red-600 h-12 text-base w-full"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </>
                  );
                }}
              />
              <br />
            </div>
            <form.Subscribe
              selector={(state) => [state.canSubmit]}
              children={([canSubmit]) => (
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 
                text-white border border-red-700/40 shadow-lg shadow-black  px-10 py-6 texg font-medium"
                >
                  {!canSubmit ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-5 w-5" />
                      Add Invoice
                    </>
                  )}
                </Button>
              )}
            />
          </form>
        </div>
      </div>
    </>
  );
};
