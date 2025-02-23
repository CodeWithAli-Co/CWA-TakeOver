import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useEffect } from "react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Free tier limit is 1GB = 1024 MB
const STORAGE_LIMIT = 1024;

interface StorageData {
  used: number;
  limit: number;
  percentage: number;
}

// Mock data - replace with actual Supabase data
export const StorageUsageChart = () => {
    const [width, setWidth] = useState(0);
    const storageData: StorageData = {
      used: 512, // Example value, replace with actual data
      limit: STORAGE_LIMIT,
      percentage: (512 / STORAGE_LIMIT) * 100, // Example calculation
    };
  
    // Format to show appropriate units (MB/GB)
    const formatStorage = (value: number) => {
      if (value >= 1024) {
        return `${(value / 1024).toFixed(1)}GB`;
      }
      return `${Math.round(value)}MB`;
    };
  
    useEffect(() => {
      // Animate the width from 0 to the actual percentage
      setWidth(storageData.percentage);
    }, []);
// animation for the bar loadidng


  return (
    
    <Card className="bg-black/40 border-red-900/30">
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
              {formatStorage(storageData.used)} of {formatStorage(storageData.limit)}
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
                delay: 0.2
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
                  repeatDelay: 5
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
                <span className="text-amber-50/50">0%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-red-800" />
                <span className="text-amber-50/50">50%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-red-700" />
                <span className="text-amber-50/50">100%</span>
              </div>
            </div>
            <span className="text-amber-50/50">Free Tier Limit</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Removed conflicting local useState function declaration
