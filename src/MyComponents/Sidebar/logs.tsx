import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  GitCommit,
  Github,
  Linkedin,
  CalendarIcon,
  Briefcase,
  Network,
  Globe,
  AlertCircle
} from "lucide-react";

import { Badge } from "@/components/ui/shadcnComponents/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/shadcnComponents/tabs";
import { Card } from "@/components/ui/shadcnComponents/card";
import { invoke } from "@tauri-apps/api/tauri";
import GitHubWebhookComponent from "../Webhooks/GithubHook";

// Import webhook components
// import GitHubWebhookComponent from "./webhooks/GitHubWebhookComponent";

function ModLogsPage() {
  const [activeTab, setActiveTab] = useState("github");
  const [webhookStatus, setWebhookStatus] = useState({
    connected: false,
    serverUrl: "",
  });

  // Set up webhook server URL
  const setupWebhookServer = async () => {
    try {
      const url = await invoke<string>("get_webhook_server_url");
      setWebhookStatus({
        connected: true,
        serverUrl: url,
      });
    } catch (err) {
      console.error("Failed to get webhook server URL:", err);
    }
  };

  // Render the appropriate component based on active tab
  const renderActiveComponent = () => {
    switch (activeTab) {
      case "github":
        return <GitHubWebhookComponent />;
      case "linkedin":
        return <div className="text-white text-center py-8">LinkedIn webhook component coming soon</div>;
      case "calendly":
        return <div className="text-white text-center py-8">Calendly webhook component coming soon</div>;
      case "upwork":
        return <div className="text-white text-center py-8">Upwork webhook component coming soon</div>;
      case "indeed":
        return <div className="text-white text-center py-8">Indeed webhook component coming soon</div>;
      case "hostinger":
        return <div className="text-white text-center py-8">Hostinger webhook component coming soon</div>;
      default:
        return <div className="text-white text-center py-8">Select a service to view webhook data</div>;
    }
  };

  return (
    <div className="min-h-screen bg-black/95">
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 bg-black/80 backdrop-blur-md border-b border-red-950/40 z-50">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <GitCommit className="h-6 w-6 mr-2 text-red-500" />
              <h1 className="text-xl font-bold text-white">Mod Logs</h1>
              <Badge className="ml-3 bg-red-900/60 border border-red-800 text-red-100">Admin Only</Badge>
            </div>
            
            {/* Webhook Status Indicator */}
            <div className="flex items-center">
              {webhookStatus.connected ? (
                <Badge className="bg-green-800/60 border border-green-700 text-green-100 flex items-center">
                  <span className="w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse"></span>
                  Webhook Server Connected
                </Badge>
              ) : (
                <Badge 
                  className="bg-red-900/60 border border-red-800 text-red-100 flex items-center cursor-pointer"
                  onClick={setupWebhookServer}
                >
                  <AlertCircle className="w-4 h-4 mr-1" />
                  Webhook Server Disconnected
                </Badge>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-5xl pt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Service Selector Tabs */}
          <Tabs 
            value={activeTab} 
            onValueChange={setActiveTab}
            className="mb-6"
          >
            <TabsList className="h-12 bg-black/40 p-1 text-red-200/60 border border-red-950/20 flex-nowrap overflow-x-auto">
              <TabsTrigger 
                value="github" 
                className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 hover:text-red-200 transition-colors duration-200 flex items-center gap-2"
              >
                <Github className="h-4 w-4" />
                <span>GitHub</span>
              </TabsTrigger>
              <TabsTrigger 
                value="linkedin" 
                className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 hover:text-red-200 transition-colors duration-200 flex items-center gap-2"
              >
                <Linkedin className="h-4 w-4" />
                <span>LinkedIn</span>
              </TabsTrigger>
              <TabsTrigger 
                value="calendly" 
                className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 hover:text-red-200 transition-colors duration-200 flex items-center gap-2"
              >
                <CalendarIcon className="h-4 w-4" />
                <span>Calendly</span>
              </TabsTrigger>
              <TabsTrigger 
                value="upwork" 
                className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 hover:text-red-200 transition-colors duration-200 flex items-center gap-2"
              >
                <Briefcase className="h-4 w-4" />
                <span>Upwork</span>
              </TabsTrigger>
              <TabsTrigger 
                value="indeed" 
                className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 hover:text-red-200 transition-colors duration-200 flex items-center gap-2"
              >
                <Network className="h-4 w-4" />
                <span>Indeed</span>
              </TabsTrigger>
              <TabsTrigger 
                value="hostinger" 
                className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 hover:text-red-200 transition-colors duration-200 flex items-center gap-2"
              >
                <Globe className="h-4 w-4" />
                <span>Hostinger</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Display webhook setup instructions if not connected */}
          {!webhookStatus.connected && (
            <Card className="mb-4 p-4 bg-black/60 border-red-950/30">
              <div className="text-white">
                <h3 className="text-lg font-medium mb-2">Webhook Setup Required</h3>
                <p className="mb-4">To receive live updates from GitHub, you need to set up a webhook server:</p>
                <ol className="list-decimal pl-6 space-y-2">
                  <li>Install webhook server dependencies: <code className="bg-gray-800 px-2 py-1 rounded">npm install express body-parser cors</code></li>
                  <li>Start the webhook server: <code className="bg-gray-800 px-2 py-1 rounded">node webhook-server.js</code></li>
                  <li>Use ngrok to expose your server: <code className="bg-gray-800 px-2 py-1 rounded">ngrok http 3000</code></li>
                  <li>Configure GitHub webhooks with the ngrok URL</li>
                </ol>
                <button 
                  className="mt-4 bg-red-900 hover:bg-red-800 text-white px-4 py-2 rounded"
                  onClick={setupWebhookServer}
                >
                  Connect to Webhook Server
                </button>
              </div>
            </Card>
          )}

          {/* Render the active webhook component */}
          {renderActiveComponent()}
        </motion.div>
      </div>
    </div>
  );
}

export default ModLogsPage;