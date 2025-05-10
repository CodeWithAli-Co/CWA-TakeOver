import SkeletonLoader from "@/MyComponents/Reusables/skeletonLoader";
import { ClientInvoice, InvoiceType } from "@/stores/invoiceQuery";
import { useInvoiceStore } from "@/stores/invoiceStore";
import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { open, writeTextFile, BaseDirectory } from "@tauri-apps/plugin-fs";

export let myInv: InvoiceType;

const Middle = () => {
  const navigate = useNavigate();
  const { invoiceID } = useInvoiceStore();
  const { data, isLoading, isFetching } = ClientInvoice(invoiceID);
  if (isLoading || isFetching) {
    return;
  }

  async function Write() {
    const contents = JSON.stringify(data![0]);
    await writeTextFile("invoiceStats.json", contents, {
      baseDir: BaseDirectory.AppLocalData,
    });
  }
  Write();

  async function ReadInvJson() {
    const file = await open("invoiceStats.json", {
      read: true,
      baseDir: BaseDirectory.AppLocalData,
    });

    const stat = await file.stat();
    const buf = new Uint8Array(stat.size);
    await file.read(buf);
    const textContents = new TextDecoder().decode(buf);
    console.log("Read File in PDF:", textContents);
    const newJson = JSON.parse(textContents);
    await file.close();
    return newJson;
  }
  // ReadInvJson();
  ReadInvJson().then((res) => {
    myInv = res;
    console.log("Read (res) INV in PDF:", myInv);
    navigate({ to: "/invoicePreview" });
  });
  console.log("Read INV in PDF:", myInv);

  return <SkeletonLoader />;
};

export const Route = createLazyFileRoute("/middle")({
  component: Middle,
});
