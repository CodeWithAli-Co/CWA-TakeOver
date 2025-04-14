import { Badge } from "@/components/ui/shadcnComponents/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/shadcnComponents/card";
import { motion } from "framer-motion";
import { Globe, AlertCircle, Bot, Webhook } from "lucide-react";

const ApiWebhooks = () => {
  return (
    <>
      {/* API Health & Webhooks */}
      <Card className="bg-black/40 border-red-900/30 lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-amber-50">API & Webhook Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-4 rounded-lg bg-black/60 border border-red-900/30"
            >
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <Globe className="h-4 w-4 text-emerald-500" />
                </div>
                <Badge
                  variant="outline"
                  className="bg-emerald-500/20 text-emerald-400"
                >
                  Healthy
                </Badge>
              </div>
              <h3 className="text-sm font-medium text-amber-50 mt-2">
                Indeed API
              </h3>
              <p className="text-xs text-amber-50/70 mt-1">98.5% uptime</p>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-4 rounded-lg bg-black/60 border border-red-900/30"
            >
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </div>
                <Badge variant="outline" className="bg-red-500/20 text-red-400">
                  Issues
                </Badge>
              </div>
              <h3 className="text-sm font-medium text-amber-50 mt-2">
                LinkedIn API
              </h3>
              <p className="text-xs text-amber-50/70 mt-1">
                Rate limit reached
              </p>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-4 rounded-lg bg-black/60 border border-red-900/30"
            >
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <Bot className="h-4 w-4 text-amber-500" />
                </div>
                <Badge
                  variant="outline"
                  className="bg-amber-500/20 text-amber-400"
                >
                  Processing
                </Badge>
              </div>
              <h3 className="text-sm font-medium text-amber-50 mt-2">
                Bot Performance
              </h3>
              <p className="text-xs text-amber-50/70 mt-1">85% success rate</p>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-4 rounded-lg bg-black/60 border border-red-900/30"
            >
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <Webhook className="h-4 w-4 text-emerald-500" />
                </div>
                <Badge
                  variant="outline"
                  className="bg-emerald-500/20 text-emerald-400"
                >
                  Connected
                </Badge>
              </div>
              <h3 className="text-sm font-medium text-amber-50 mt-2">
                Webhooks
              </h3>
              <p className="text-xs text-amber-50/70 mt-1">
                All endpoints active
              </p>
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default ApiWebhooks;
