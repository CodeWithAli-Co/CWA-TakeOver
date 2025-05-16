import { CooCeoCreds } from "@/MyComponents/CredFolders/cooCeoCreds";
import UserView from "@/MyComponents/Reusables/userView";
import { createLazyFileRoute } from "@tanstack/react-router";

export const DetailsFolders = () => {
  return (
    <section>
      <UserView userRole={["COO", "CEO"]}>
        <CooCeoCreds />
      </UserView>
    </section>
  );
};

export const Route = createLazyFileRoute("/detailFolders")({
  component: DetailsFolders,
});
