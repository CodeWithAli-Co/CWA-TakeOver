import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/shadcnComponents/card";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import { Button } from "@/components/ui/shadcnComponents/button";
import { Input } from "@/components/ui/shadcnComponents/input";

import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/shadcnComponents/collapsible";
import { motion } from "framer-motion";
import {
  Webhook,
  Plus,
  ChevronDown,
  Link2,
  XCircle,
  RefreshCw,
  Settings2,
  Link2Off,
  Linkedin,
  Globe,
} from "lucide-react";
import ToggleSwitch from "../Reusables/switchUI";

const IntegrationCard = ({
  title,
  icon: Icon,
  connected,
  lastSync,
  apiKey,
  webhookUrl,
}: {
  title: string;
  icon: any;
  connected: boolean;
  lastSync?: string;
  apiKey: string;
  webhookUrl: string;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEnabled, setIsEnabled] = useState(connected);

  return (
    <Card className="bg-zinc-950/10 rounded-xs border-red-900/30">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-900/20">
              <Icon className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <CardTitle className="text-amber-50">{title}</CardTitle>
              <CardDescription className="text-amber-50/70">
                {lastSync ? `Last synced: ${lastSync}` : "Not connected"}
              </CardDescription>
            </div>
          </div>
          {/* ToggleStylingLater */}
          <div className="flex items-center gap-3">
            <ToggleSwitch
              checked={true}
              onChange={(checked) => console.log("Switch toggled:", checked)}
            />

            <Badge
              variant="outline"
              className={`${
                isEnabled
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {isEnabled ? "Connected" : "Disconnected"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between text-amber-50/70 hover:text-amber-50 hover:bg-red-900/20"
            >
              Configuration
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isExpanded ? "transform rotate-180" : ""}`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm text-amber-50/70">API Key</label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={apiKey}
                  className="bg-zinc-950/10 rounded-xs border-red-900/30 text-amber-50"
                  readOnly
                />
                <Button
                  variant="outline"
                  className="border-red-900/30 text-amber-50 hover:bg-red-900/20"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-amber-50/70">Webhook URL</label>
              <div className="flex gap-2">
                <Input
                  value={webhookUrl}
                  className="bg-zinc-950/10 rounded-xs border-red-900/30 text-amber-50"
                  readOnly
                />
                <Button
                  variant="outline"
                  className="border-red-900/30 text-amber-50 hover:bg-red-900/20"
                >
                  <Link2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="pt-2 flex justify-between">
              <Button
                variant="outline"
                className="border-red-900/30 text-amber-50 hover:bg-red-900/20"
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Advanced Settings
              </Button>
              <Button
                variant="destructive"
                className="bg-red-900 hover:bg-red-800"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </div>
            <Link2Off className="h-4 w-4 mr-2" />
            Disconnect
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};

export const IntegrationsSettings = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-amber-50">Integrations</h2>
          <p className="text-sm text-amber-50/70">
            Configure and manage third-party integrations.
          </p>
        </div>
        <Button className="bg-red-900 hover:bg-red-800 text-amber-50">
          <Plus className="h-4 w-4 mr-2" />
          Add Integration
        </Button>
      </div>

      <div className="grid gap-6">
        <IntegrationCard
          title="LinkedIn Integration"
          icon={Linkedin}
          connected={true}
          lastSync="10 minutes ago"
          apiKey="li_sk_123456789"
          webhookUrl="https://api.example.com/webhooks/linkedin"
        />

        <IntegrationCard
          title="Indeed Integration"
          icon={Globe}
          connected={false}
          apiKey="indeed_sk_123456789"
          webhookUrl="https://api.example.com/webhooks/indeed"
        />

        <Card className="bg-zinc-950/10 rounded-xs border-red-900/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-amber-50">Active Webhooks</CardTitle>
              <Button
                variant="outline"
                className="border-red-900/30 text-amber-50 hover:bg-red-900/20"
              >
                <Webhook className="h-4 w-4 mr-2" />
                Add Webhook
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] pr-4">
              {[
                {
                  name: "Job Alert Webhook",
                  status: "active",
                  events: ["job.created", "job.updated"],
                },
                {
                  name: "Application Webhook",
                  status: "active",
                  events: ["application.submitted"],
                },
                {
                  name: "Profile Webhook",
                  status: "inactive",
                  events: ["profile.updated"],
                },
                {
                  name: "Message Webhook",
                  status: "active",
                  events: ["message.received"],
                },
              ].map((webhook, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center justify-between p-3 border-b border-red-900/20 last:border-0"
                >
                  <div>
                    <h3 className="text-sm font-medium text-amber-50">
                      {webhook.name}
                    </h3>
                    <div className="flex gap-2 mt-1">
                      {webhook.events.map((event, j) => (
                        <Badge
                          key={j}
                          variant="outline"
                          className="bg-red-900/20 text-red-400 text-xs"
                        >
                          {event}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      webhook.status === "active"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-red-500/20 text-red-400"
                    }
                  >
                    {webhook.status}
                  </Badge>
                </motion.div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
