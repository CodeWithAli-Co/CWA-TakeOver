import { useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/shadcnComponents/card";
import { Button } from "@/components/ui/shadcnComponents/button";
import { useAppStore } from "@/stores/store";
import { invoke } from "@tauri-apps/api/core";
import supabase from "@/MyComponents/supabase";
import { AddData } from "@/MyComponents/subForms/addForm";
import { EditData } from "@/MyComponents/subForms/editForm";
import { Eye, EyeOff, Edit2, Trash2 } from "lucide-react";
import {
  getPlatformIcon,
  platformStyles,
} from "@/MyComponents/Reusables/PlatformIcons";
import ToggleSwitch from "@/MyComponents/Reusables/switchUI";
import { CWACreds } from "@/stores/query";
import { Link } from "@tanstack/react-router";

// Type definitions
interface Credential {
  id: number;
  platform_name: string;
  acc_username: string;
  acc_email: string;
  acc_enc_password: string;
  acc_addinfo?: string;
  active: boolean;
  folder?: string;
}

export const CompanyCreds = ({ folder = "default" }: { folder?: string }) => {
  const { setDialog, setDisplayer, displayer, resetDisplayer } = useAppStore();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  // Track expanded state for each card
  const [expandedCards, setExpandedCards] = useState<number[]>([]);
  const [credID, setCredID] = useState(0);
  const [showDecPass, setShowDecPass] = useState("");

  const toggleCard = (id: number) => {
    // setExpandedCards([0]);
    setExpandedCards((prev) =>
      prev.includes(id) ? prev.filter((cardId) => cardId !== id) : [...prev, id]
    );
  };

  const showModal = (dialogDisplay: "addDialog" | "editDialog") => {
    document.startViewTransition(() => {
      dialogRef.current?.showModal();
    });
    setDisplayer(dialogDisplay);
    setDialog("shown");
  };

  const closeModal = () => {
    document.startViewTransition(() => {
      dialogRef.current?.close();
    });
    resetDisplayer();
    setDialog("closed");
  };

  // Reveal Password
  const getPassword = async (credID: number) => {
    const { data } = await supabase
      .from("cwa_creds")
      .select("id, acc_enc_password")
      .eq("id", credID);

    if (data && data[0]) {
      const decPassword = await invoke("decrypt", {
        keyStr: import.meta.env.VITE_ENCRYPTION_KEY,
        encryptedData: data[0].acc_enc_password,
      });
      setShowDecPass(decPassword as string);
    }
  };

  // Delete Data
  const DelData = async (rowID: number) => {
    const { data: result, error } = await supabase
      .from("cwa_creds")
      .delete()
      .eq("id", rowID)
      .select();

    if (error) {
      console.log("Error: ", error.message);
      return;
    }
    console.log(result);
  };

  // Display Table
  const {
    data: cwaCreds,
    isPending,
    error,
    refetch: refetchCreds,
  } = CWACreds(folder);

  if (isPending) return <div className="p-6">Loading...</div>;
  if (error) {
    console.log(error.message);
    return <div className="p-6">Error loading data</div>;
  }

  // Realtime channel
  supabase
    .channel("CWACreds")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "cwa_creds" },
      () => refetchCreds()
    )
    .subscribe();

  return (
    <div className="p-6 select-text bg-gradient-to-br from-[#010101] to-[#210000]">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold">Accounts</h2>
        <Button
          variant="default"
          className="bg-white text-black hover:bg-gray-100"
          onClick={() => showModal("addDialog")}
        >
          Add Account
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link to="/detailFolders" className="bg-white w-10 h-10"></Link>
        {cwaCreds?.map((cred: Credential) => {
          const isExpanded = expandedCards.includes(cred.id);
          const lowerPlatform = cred.platform_name.toLowerCase();
          const style = platformStyles[lowerPlatform] || platformStyles.default;

          return (
            <>
              {folder === "default" && (
                // Cred Card
                <Card
                  key={cred.id}
                  className={`bg-black border-zinc-800 transition-all duration-300 text-white/80 ${
                    isExpanded ? "min-h-[300px]" : "min-h-[180px]"
                  }`}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xl font-semibold">
                      <span className="capitalize">{cred.platform_name}</span>
                    </CardTitle>
                    <div
                      className={`h-12 w-12 rounded-full overflow-hidden flex items-center justify-center text-white bg-gradient-to-br ${style.gradient}`}
                      style={{ boxShadow: `0 0 10px ${style.shadowColor}` }}
                    >
                      {getPlatformIcon(cred.platform_name)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {cred.acc_username !== "" && (
                        <CardDescription className="text-sm text-zinc-400">
                          <span className="mr-1 font-semibold text-white/90">
                            Username:
                          </span>
                          <span className="select-text">
                            {cred.acc_username}
                          </span>
                        </CardDescription>
                      )}
                      <div
                        className={`space-y-2 overflow-hidden transition-all duration-300 ${
                          isExpanded
                            ? "max-h-[500px] opacity-100"
                            : "max-h-0 opacity-0"
                        }`}
                      >
                        <CardDescription className="text-sm text-zinc-400">
                          <span className="mr-1 font-semibold text-white/90">
                            Email:
                          </span>
                          <span className="select-text">{cred.acc_email}</span>
                        </CardDescription>
                        {showDecPass !== "" && (
                          <CardDescription className="text-sm text-zinc-400">
                            <span className="mr-1 font-semibold text-white/90">
                              Password:
                            </span>
                            <span className="select-text">
                              {showDecPass || cred.acc_enc_password}
                            </span>
                          </CardDescription>
                        )}
                        {cred.acc_addinfo && (
                          <CardDescription className="text-sm text-zinc-400">
                            <span className="mr-1 font-semibold text-white/90">
                              Additional Info:
                            </span>
                            {cred.acc_addinfo}
                          </CardDescription>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-4">
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-zinc-400 border-zinc-800 hover:bg-zinc-800"
                            onClick={() => {
                              setShowDecPass("");
                              setExpandedCards([0]);
                              toggleCard(cred.id);
                              if (!isExpanded) getPassword(cred.id);
                              if (expandedCards.includes(cred.id))
                                setExpandedCards([0]); // If array contains the same ID as before, hide it
                            }}
                          >
                            {isExpanded ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                            <span className="ml-2">
                              {isExpanded ? "Hide" : "Reveal"}
                            </span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-zinc-400 border-zinc-800 hover:bg-zinc-800"
                            onClick={() => {
                              showModal("editDialog");
                              setCredID(cred.id);
                            }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-zinc-400 border-zinc-800 hover:bg-zinc-800"
                            onClick={() => DelData(cred.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <ToggleSwitch
                          checked={true}
                          onChange={(checked) =>
                            console.log("Switch toggled:", checked)
                          }
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {folder === cred.folder && cred.folder !== "default" && (
                <Card
                  key={cred.id}
                  className={`bg-black border-zinc-800 transition-all duration-300 text-white/80 ${
                    isExpanded ? "min-h-[300px]" : "min-h-[180px]"
                  }`}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xl font-semibold">
                      <span className="capitalize">{cred.platform_name}</span>
                    </CardTitle>
                    <div
                      className={`h-12 w-12 rounded-full overflow-hidden flex items-center justify-center text-white bg-gradient-to-br ${style.gradient}`}
                      style={{ boxShadow: `0 0 10px ${style.shadowColor}` }}
                    >
                      {getPlatformIcon(cred.platform_name)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {cred.acc_username !== "" && (
                        <CardDescription className="text-sm text-zinc-400">
                          <span className="mr-1 font-semibold text-white/90">
                            Username:
                          </span>
                          <span className="select-text">
                            {cred.acc_username}
                          </span>
                        </CardDescription>
                      )}
                      <div
                        className={`space-y-2 overflow-hidden transition-all duration-300 ${
                          isExpanded
                            ? "max-h-[500px] opacity-100"
                            : "max-h-0 opacity-0"
                        }`}
                      >
                        <CardDescription className="text-sm text-zinc-400">
                          <span className="mr-1 font-semibold text-white/90">
                            Email:
                          </span>
                          <span className="select-text">{cred.acc_email}</span>
                        </CardDescription>
                        {showDecPass !== "" && (
                          <CardDescription className="text-sm text-zinc-400">
                            <span className="mr-1 font-semibold text-white/90">
                              Password:
                            </span>
                            <span className="select-text">
                              {showDecPass || cred.acc_enc_password}
                            </span>
                          </CardDescription>
                        )}
                        {cred.acc_addinfo && (
                          <CardDescription className="text-sm text-zinc-400">
                            <span className="mr-1 font-semibold text-white/90">
                              Additional Info:
                            </span>
                            {cred.acc_addinfo}
                          </CardDescription>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-4">
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-zinc-400 border-zinc-800 hover:bg-zinc-800"
                            onClick={() => {
                              setShowDecPass("");
                              setExpandedCards([0]);
                              toggleCard(cred.id);
                              if (!isExpanded) getPassword(cred.id);
                              if (expandedCards.includes(cred.id))
                                setExpandedCards([0]); // If array contains the same ID as before, hide it
                            }}
                          >
                            {isExpanded ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                            <span className="ml-2">
                              {isExpanded ? "Hide" : "Reveal"}
                            </span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-zinc-400 border-zinc-800 hover:bg-zinc-800"
                            onClick={() => {
                              showModal("editDialog");
                              setCredID(cred.id);
                            }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-zinc-400 border-zinc-800 hover:bg-zinc-800"
                            onClick={() => DelData(cred.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <ToggleSwitch
                          checked={true}
                          onChange={(checked) =>
                            console.log("Switch toggled:", checked)
                          }
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          );
        })}
      </div>

      <dialog ref={dialogRef}>
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-4 top-4"
          onClick={closeModal}
        >
          X
        </Button>
        {displayer === "editDialog" ? (
          <EditData rowID={credID} />
        ) : displayer === "addDialog" ? (
          <AddData />
        ) : (
          "Error Loading Dialog..."
        )}
      </dialog>
    </div>
  );
};
