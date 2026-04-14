import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "@/stores/store";
import supabase from "../supabase";
import { Database } from "lucide-react";

const STORAGE_LIMIT = 500;
const TIER = "Free";

export const StorageUsageChart = () => {
  const { DBUsed, setDBSize } = useAppStore();

  useEffect(() => {
    async function getDBUsage() {
      const { data, error } = await supabase.rpc("get_dbsize");
      if (error) { console.log("Error getting DB Size:", error.message); return; }
      let size: string = data.toString();
      if (size.includes(" MB")) size = size.replace(" MB", "").trim();
      else if (size.includes(" GB")) size = size.replace(" GB", "").trim();
      setDBSize(Number(size));
    }
    getDBUsage();
  }, []);

  const [width, setWidth] = useState(0);
  const percentage = (DBUsed / STORAGE_LIMIT) * 100;

  const formatStorage = (value: number) => {
    if (value >= STORAGE_LIMIT) return `${(value / STORAGE_LIMIT).toFixed(1)}GB`;
    return `${Math.round(value)}MB`;
  };

  const formatStorageLimit = (limit: number) => {
    if (limit >= 1000) return `${(limit / 1000).toFixed(1)}GB`;
    return `${Math.round(limit)}MB`;
  };

  setTimeout(() => setWidth(percentage), 500);

  return (
    <div className="bg-card border border-border rounded-sm h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-sm bg-muted/40 border border-border">
            <Database className="h-4 w-4 text-primary/70" />
          </div>
          <span className="text-[11px] text-muted-foreground/60 uppercase tracking-[0.15em] font-medium">
            Storage
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground/40 font-medium">{percentage.toFixed(1)}%</span>
      </div>

      <div className="px-6 pb-6 space-y-5">
        {/* Usage numbers */}
        <div>
          <div className="text-2xl font-bold text-foreground tracking-tight">
            {formatStorage(DBUsed)}
          </div>
          <p className="text-[11px] text-muted-foreground/40 mt-0.5">
            of {formatStorageLimit(STORAGE_LIMIT)} · {formatStorage(STORAGE_LIMIT - DBUsed)} free
          </p>
        </div>

        {/* Bar */}
        <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: `${width}%` }}
            transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
            className="h-full bg-gradient-to-r from-red-600 to-red-500 rounded-full relative"
          >
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "200%" }}
              transition={{ duration: 2, ease: "easeInOut", delay: 1.5, repeat: Infinity, repeatDelay: 6 }}
              className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12"
            />
          </motion.div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
            <span className="text-[11px] text-muted-foreground/40">Database</span>
          </div>
          <span className="text-[11px] text-muted-foreground/30">{TIER} tier</span>
        </div>
      </div>
    </div>
  );
};
