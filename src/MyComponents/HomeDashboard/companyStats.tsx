import React from "react";
import { motion } from "framer-motion";
import { Users, CircleDollarSign, BarChart3, Boxes } from "lucide-react";

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

const CompanyStats = () => {
  return (
    <>
      {/* Stats Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard icon={Users} label="Total Users" value="5" change={300} />
        <StatCard
          icon={CircleDollarSign}
          label="Revenue"
          value="$1.025,90"
        />
        <StatCard icon={BarChart3} label="Subscription" value="$46" />
        <StatCard icon={Boxes} label="Active Bots" value="1" />
      </motion.div>
    </>
  );
};

export default CompanyStats;
