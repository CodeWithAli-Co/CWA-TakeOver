import { createLazyFileRoute } from "@tanstack/react-router";
import { JSX } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/stores/store";
import { CWACreds } from "../stores/query";
import { invoke } from "@tauri-apps/api/core";
import { useRef, useState } from "react";
import supabase from "@/MyComponents/supabase";
import { AddData } from "@/MyComponents/subForms/addForm";
import { EditData } from "@/MyComponents/subForms/editForm";
import { 
  Eye, 
  EyeOff, 
  Edit2, 
  Trash2, 
  Plus,
  Github, 
  Globe,
  Twitter,
  Linkedin,
  Facebook,
  Mail,
  Store,
  FileCode2
} from "lucide-react";

// Platform icon mapping
const platformIcons: { [key: string]: React.ComponentType<any> } = {
  github: Github,
  twitter: Twitter,
  linkedin: Linkedin,
  facebook: Facebook,
  gmail: Mail,
  upwork: Globe,
  fiverr: Store,
  patreon: Store,
  dev: FileCode2,
  default: Globe
};
const platformStyles: Record<string, {
  color: string;
  gradient: string;
  shadowColor: string;
}> = {
  github: {
    color: '#000000',
    gradient: 'from-[#238636] to-[#2EA043]',
    shadowColor: '#000000'
  },
  twitter: {
    color: '#1DA1F2',
    gradient: 'from-[#1A8CD8] to-[#1DA1F2]',
    shadowColor: 'rgba(29, 161, 242, 0.5)'
  },
  linkedin: {
    color: '#0A66C2',
    gradient: 'from-[#0077B5] to-[#0A66C2]',
    shadowColor: 'rgba(10, 102, 194, 0.5)'
  },
  facebook: {
    color: '#4267B2',
    gradient: 'from-[#385898] to-[#4267B2]',
    shadowColor: 'rgba(53, 90, 166, 0.5)'
  },
  gmail: {
    color: '#EA4335',
    gradient: 'from-[#DB4437] to-[#EA4335]',
    shadowColor: 'rgba(234, 67, 53, 0.5)'
  },
  upwork: {
    color: '#14A800',
    gradient: 'from-[#108A00] to-[#14A800]',
    shadowColor: 'rgba(20, 168, 0, 0.5)'
  },
  default: {
    color: '#7C3AED',
    gradient: 'from-[#6D28D9] to-[#7C3AED]',
    shadowColor: 'rgba(124, 58, 237, 0.5)'
  }
};



// Type definitions
interface Credential {
  id: number;
  platform_name: string;
  acc_username: string;
  acc_email: string;
  acc_enc_password: string;
  acc_addinfo?: string;
  active: boolean;
}

function Details() {
  const { setDialog, dialog, setDisplayer, displayer, resetDisplayer } = useAppStore();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  // Track expanded state for each card
  const [expandedCards, setExpandedCards] = useState<number[]>([]);

  const toggleCard = (id: number) => {
    setExpandedCards(prev => 
      prev.includes(id) 
        ? prev.filter(cardId => cardId !== id)
        : [...prev, id]
    );
  };
  const getPlatformIcon = (platformName: string): JSX.Element => {
    const lowerPlatform = platformName.toLowerCase();
    const IconComponent = platformIcons[lowerPlatform] || platformIcons.default;
    const style = platformStyles[lowerPlatform] || platformStyles.default;

    return <IconComponent style={{ color: style.color }} />;
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
      console.log(decPassword);
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
  const { data: cwaCreds, isPending, error } = CWACreds();

  if (isPending) return <div className="p-6">Loading...</div>;
  if (error) {
    console.log(error.message);
    return <div className="p-6">Error loading data</div>;
  }

  return (
    <div className="p-6">
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
        {cwaCreds?.map((cred: Credential) => {
          const isExpanded = expandedCards.includes(cred.id);
          
          return (
            <Card 
              key={cred.id} 
              className={`bg-zinc-950 border-zinc-800 transition-all duration-300 ${
                isExpanded ? 'min-h-[300px]' : 'min-h-[180px]'
              }`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-semibold">
                  {cred.platform_name}
                </CardTitle>
                <div className="h-12 w-12 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center text-white">
                  {getPlatformIcon(cred.platform_name)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <CardDescription className="text-sm text-zinc-400">
                    Username: {cred.acc_username}
                  </CardDescription>

                  <div className={`space-y-2 overflow-hidden transition-all duration-300 ${
                    isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                  }`}>
                    <CardDescription className="text-sm text-zinc-400">
                      Email: {cred.acc_email}
                    </CardDescription>
                    <CardDescription className="text-sm text-zinc-400">
                      Password: {cred.acc_enc_password}
                    </CardDescription>
                    {cred.acc_addinfo && (
                      <CardDescription className="text-sm text-zinc-400">
                        Additional Info: {cred.acc_addinfo}
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
                          toggleCard(cred.id);
                          if (!isExpanded) getPassword(cred.id);
                        }}
                      >
                        {isExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        <span className="ml-2">{isExpanded ? 'Hide' : 'Reveal'}</span>
                      </Button>
                      <Button 
                        variant="outline"
                        size="sm"
                        className="text-zinc-400 border-zinc-800 hover:bg-zinc-800"
                        onClick={() => showModal("editDialog")}
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
                    <Switch
                      checked={cred.active}
                      className="data-[state=checked]:bg-zinc-700"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <dialog ref={dialogRef} className="dialog">
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-4 top-4"
          onClick={closeModal}
        >
          X
        </Button>
        {displayer === "editDialog" ? (
          <EditData rowID={cwaCreds[0]?.id} />
        ) : displayer === "addDialog" ? (
          <AddData />
        ) : (
          "Error Loading Dialog..."
        )}
      </dialog>
    </div>
  );
}

export const Route = createLazyFileRoute('/details')({
  component: Details
});