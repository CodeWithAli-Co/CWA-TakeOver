import { createLazyFileRoute } from "@tanstack/react-router";
import { CompanyCreds } from "@/MyComponents/CredFolders/defaultCreds";

function Details() {
  return (
    <>
      <CompanyCreds />
    </>
  );
}

export const Route = createLazyFileRoute("/details")({
  component: Details,
});
