import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/shadcnComponents/card";
import { Button } from "@/components/ui/shadcnComponents/button";
import { invoke } from "@tauri-apps/api/core";
import supabase from "@/MyComponents/supabase";
import { AddData } from "@/MyComponents/subForms/addForm";
import { EditData } from "@/MyComponents/subForms/editForm";
import { ChevronRight, Eye, EyeOff, Folder, Trash2 } from "lucide-react";
import {
  getPlatformIcon,
  platformStyles,
} from "@/MyComponents/Reusables/PlatformIcons";
import ToggleSwitch from "@/MyComponents/Reusables/switchUI";
import { CWACreds } from "@/stores/query";
import { Link } from "@tanstack/react-router";
import UserView from "../Reusables/userView";

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

export const CompanyCreds = ({
  folder = "default",
}: {
  folder?: string;
  className?: string;
}) => {
  // Track expanded state for each card
  const [expandedCards, setExpandedCards] = useState<number[]>([]);
  const [showDecPass, setShowDecPass] = useState("");

  const toggleCard = (id: number) => {
    // setExpandedCards([0]);
    setExpandedCards((prev) =>
      prev.includes(id) ? prev.filter((cardId) => cardId !== id) : [...prev, id]
    );
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
    <div className="p-6 select-text bg-black min-h-screen">
      <div className="flex justify-between items-center mb-8">
        {/* Only for CEO and COO for now */}
        <UserView userRole={["CEO", "COO"]}>
          <Link
            to="/detailFolders"
            className="bg-red-950/20 flex justify-center items-center border p-2 pr-5 border-red-950 hover:bg-red-950 text-white group hover:text-black"
          >
            <Folder className="h-4 w-4 text-white" />
            <ChevronRight className="h-4 w-5 text-white group-hover:text-black " />

            <span className="text-bold font-26"> CCC </span>
            {/* {folder} */}
          </Link>
        </UserView>
        <h2 className="text-3xl font-bold">Accounts</h2>
        <AddData />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                  className={`bg-zinc-950 high-dpi:bg-zinc-950/20 rounded-xs  border-zinc-800 transition-all duration-300 text-white/80 ${
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
                          <EditData rowID={cred.id} />
                          <UserView userRole={["CEO", "COO"]}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-zinc-400 border-zinc-800 hover:bg-zinc-800"
                              onClick={() => DelData(cred.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </UserView>
                        </div>
                        <ToggleSwitch
                          checked={cred.active}
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
                  className={` bg-zinc-950 high-dpi:bg-zinc-950/20 rounded-xs border-zinc-800 transition-all duration-300 text-white/80 ${
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
                          <EditData rowID={cred.id} />
                          <UserView userRole={["CEO", "COO"]}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-zinc-400 border-zinc-800 hover:bg-zinc-800"
                              onClick={() => DelData(cred.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </UserView>
                        </div>
                        <ToggleSwitch
                          checked={cred.active}
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
    </div>
  );
};
