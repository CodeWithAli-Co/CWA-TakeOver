import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/shadcnComponents/card";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import { useEffect } from "react";
import { useState } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "@/stores/store";
import supabase from "../supabase";

// Free tier limit is 500MB
const STORAGE_LIMIT = 500;
// Tier of Supabase
const TIER = "Free";

interface StorageData {
  used: number;
  limit: number;
  percentage: number;
}

// Mock data - replace with actual Supabase data
export const StorageUsageChart = () => {
  const { DBUsed, setDBSize } = useAppStore();
  useEffect(() => {
    async function getDBUsage() {
      const { data, error } = await supabase.rpc("get_dbsize");
      if (error) {
        console.log("Error getting DB Size: ", error.message);
      }
      let size: string = data.toString();
      if (size.includes(" MB")) {
        size = size.replace(" MB", "").trim();
      } else if (size.includes(" GB")) {
        size = size.replace(" GB", "").trim();
      }
      let newSize = Number(size);
      setDBSize(newSize);
    }

    // async function getDiskUsage() {
    //   const { data, error } = await supabase.rpc('get_disksize')
    //   if (error) {
    //     console.log('Error getting Disk Size: ', error.message)
    //   }
    //   let diskSize: string = data
    //   // if (diskSize.includes(' MB')) {
    //   //   diskSize = diskSize.replace(' MB', '').trim();
    //   // } else if (diskSize.includes(' GB')) {
    //   //   diskSize = diskSize.replace(' GB', '').trim();
    //   // }

    //   console.log('Disk Size', diskSize)
    // }

    getDBUsage();
    // getDiskUsage();
  }, []);

  const [width, setWidth] = useState(0);
  const storageData: StorageData = {
    used: DBUsed, // Example value, replace with actual data
    limit: STORAGE_LIMIT,
    percentage: (DBUsed / STORAGE_LIMIT) * 100, // Example calculation
  };

  // Format to show appropriate units (MB/GB)
  const formatStorage = (value: number) => {
    if (value >= STORAGE_LIMIT) {
      return `${(value / STORAGE_LIMIT).toFixed(1)}GB`;
    }
    return `${Math.round(value)}MB`;
  };

  // Format to show appropriate units (MB/GB) for Limit
  const formatStorageLimit = (limit: number) => {
    if (limit >= 1000) {
      return `${(limit / 1000).toFixed(1)}GB`;
    }
    return `${Math.round(limit)}MB`;
  };

  // Using setTimeout so states are up-to-date
  setTimeout(() => {
    // Animate the width from 0 to the actual percentage
    setWidth(storageData.percentage);
  }, 500);
  // animation for the bar loadidng

  return (
    <Card className="bg-zinc-950/20 border-red-900/30 rounded-xs">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-amber-50">Storage Usage</CardTitle>
          <Badge
            variant="outline"
            className="bg-red-950/50 text-red-400 border-red-900/50"
          >
            {storageData.percentage.toFixed(1)}% Used
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Usage Display */}
          <div className="flex justify-between text-sm">
            <span className="text-amber-50/70">
              {formatStorage(storageData.used)} of{" "}
              {formatStorageLimit(storageData.limit)}
            </span>
            <span className="text-amber-50/70">
              {formatStorage(STORAGE_LIMIT - storageData.used)} remaining
            </span>
          </div>

          {/* Animated Progress Bar */}
          <div className="h-8 w-full bg-black/60 rounded-lg border border-red-900/30 p-1">
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: `${width}%` }}
              transition={{
                duration: 1.5,
                ease: "easeOut",
                delay: 0.2,
              }}
              className="h-full bg-gradient-to-r from-red-900 to-red-800 rounded relative overflow-hidden"
            >
              {/* Shine effect */}
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "200%" }}
                transition={{
                  duration: 2,
                  ease: "easeInOut",
                  delay: 1,
                  repeat: Infinity,
                  repeatDelay: 5,
                }}
                className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/5 to-transparent transform -skew-x-12"
              />
              <div className="absolute inset-0 bg-black/10" />
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
            </motion.div>
          </div>

          {/* Threshold Indicators */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-red-900" />
                <span className="text-amber-50/50">DB Storage</span>
              </div>
              {/* <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-red-800" />
                <span className="text-amber-50/50">50%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-red-700" />
                <span className="text-amber-50/50">100%</span>
              </div> */}
            </div>
            <span className="text-amber-50/50">{`${TIER} Tier Limit`}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Removed conflicting local useState function declaration
