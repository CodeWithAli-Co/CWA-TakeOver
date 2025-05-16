import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, CircleDollarSign, BarChart3, Boxes } from "lucide-react";
import supabase from "../supabase";

// Enhanced Stat Card with animations
const StatCard = ({
  icon: Icon,
  label,
  value,
  change,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  change?: number;
}) => (
  <motion.div
    whileHover={{ scale: 1.0 }}
    className="bg-black/40 border border-red-900/30 rounded-lg p-4 hover:border-red-800/50 transition-colors"
  >
    <div className="flex items-center justify-between">
      <motion.div
        whileHover={{ scale: 1.1 }}
        className="p-2 rounded-lg bg-red-900/20"
      >
        <Icon className="h-4 w-4 text-red-500" />
      </motion.div>
      {change && (
        <span
          className={`text-xs ${change > 0 ? "text-emerald-400" : "text-red-400"}`}
        >
          {change > 0 ? "+" : ""}
          {change}%
        </span>
      )}
    </div>
    <div className="mt-3">
      <div className="text-2xl font-bold text-amber-50">{value}</div>
      <div className="text-sm text-amber-50/70">{label}</div>
    </div>
  </motion.div>
);

const CompanyStats =  () => {
  const [initialCapital, setInitialCapital] = useState("");
  const [appUsers, setAppUsers]  = useState('')

  useEffect(() => {
    async function Stat() {
      const { data : revenue, error : revenueError } = await supabase
        .from("cwa_calculatorProps")  
        .select("initialCapital")
        .single();
     
        const { data : userCount, error : userCountError} = await supabase
        .from("app_users")
        .select("id")
        

      if (revenueError)
        console.log(
          "there was an error grabbing the initialCapital",
          revenueError.message
        
        );

      if (userCountError)
        
        console.log("could not count the users within the database to vsCode", userCountError.message);
    
      setInitialCapital(revenue?.initialCapital);
      setAppUsers( userCount!.length as unknown as string)
     
      
     
    }

    Stat();
  }, []);

  return (
    <>
      {/* Stats Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard icon={Users} label="Total Users" value={appUsers} change={300} />
        <StatCard
          icon={CircleDollarSign}
          label="Revenue"
          value={`$${initialCapital}`}
        />
        <StatCard icon={BarChart3} label="Subscription" value="$46" />
        <StatCard icon={Boxes} label="Active Bots" value="1" />
      </motion.div>
    </>
  );
};

export default CompanyStats;
