import React from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp } from "lucide-react";
import {
  DynamicItemProps,
  ExpenseItem,
  RevenueItem,
} from "@/stores/FinancialField";

// Expense/Revenue item component with delete capability
const DynamicItem: React.FC<DynamicItemProps> = ({
  item,
  onChange,
  onDelete,
  type,
  categories,
}) => {
  const Icon = type === "expense" ? DollarSign : TrendingUp;
  const borderColor =
    type === "expense" ? "border-red-900" : "border-green-900";
  const bgColor = type === "expense" ? "bg-red-950/10" : "bg-green-950/10";

  // Calculate annual amount based on frequency
  const calculateAnnualAmount = (amount: number, frequency: string): number => {
    switch (frequency) {
      case "monthly":
        return amount * 12;
      case "quarterly":
        return amount * 4;
      case "annually":
        return amount;
      case "one-time":
        return amount;
      default:
        return amount;
    }
  };

  // Update item and recalculate annual amount
  const updateItem = (updates: Partial<ExpenseItem | RevenueItem>) => {
    const updatedItem = { ...item, ...updates };

    // If amount or frequency changed, recalculate
    if ("amount" in updates || "frequency" in updates) {
      const annual = calculateAnnualAmount(
        updatedItem.amount,
        updatedItem.frequency
      );
      // This is just for display - actual calculations use more complex logic
      onChange({ ...updatedItem, yearlyAmount: annual });
    } else {
      onChange(updatedItem);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mb-4 p-4 ${bgColor} border ${borderColor} relative`}
    >
      <button
        onClick={onDelete}
        className="absolute top-2 right-2 text-red-500 hover:text-red-300"
        aria-label="Delete item"
      >
        ×
      </button>

      <div className="mb-3">
        <label className="text-xs text-red-400">Name</label>
        <input
          type="text"
          value={item.name}
          onChange={(e) => updateItem({ name: e.target.value })}
          className="w-full bg-black border border-red-900 p-2 text-red-300 font-mono focus:outline-none focus:border-red-600"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-red-400">Amount ($)</label>
          <div className="flex">
            <span className="bg-red-900/20 border-y border-l border-red-900 px-2 flex items-center text-red-400">
              $
            </span>
            <input
              type="number"
              value={item.amount}
              onChange={(e) => updateItem({ amount: Number(e.target.value) })}
              min={0}
              className="flex-1 bg-black border-y border-r border-red-900 p-2 text-red-300 font-mono focus:outline-none focus:border-red-600"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-red-400">Annual Growth (%)</label>
          <div className="flex">
            <input
              type="number"
              value={item.growth}
              onChange={(e) => updateItem({ growth: Number(e.target.value) })}
              min={-100}
              max={100}
              step={0.5}
              className="flex-1 bg-black border border-red-900 p-2 text-red-300 font-mono focus:outline-none focus:border-red-600"
            />
            <span className="bg-red-900/20 border-y border-r border-red-900 px-2 flex items-center text-red-400">
              %
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <label className="text-xs text-red-400">Frequency</label>
          <select
            value={item.frequency}
            onChange={(e) =>
              updateItem({
                frequency: e.target.value as
                  | "monthly"
                  | "quarterly"
                  | "annually"
                  | "one-time",
              })
            }
            className="w-full bg-black border border-red-900 p-2 text-red-300 font-mono focus:outline-none focus:border-red-600"
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annually">Annually</option>
            <option value="one-time">One-time</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-red-400">Category</label>
          <select
            value={item.category}
            onChange={(e) => updateItem({ category: e.target.value })}
            className="w-full bg-black border border-red-900 p-2 text-red-300 font-mono focus:outline-none focus:border-red-600"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {type === "revenue" && "type" in item && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="text-xs text-red-400">Revenue Type</label>
            <select
              value={item.type}
              onChange={(e) =>
                updateItem({
                  revenueType: e.target.value as
                    | "one-time"
                    | "recurring"
                    | "subscription",
                })
              }
              className="w-full bg-black border border-red-900 p-2 text-red-300 font-mono focus:outline-none focus:border-red-600"
            >
              <option value="one-time">One-time</option>
              <option value="recurring">Recurring</option>
              <option value="subscription">Subscription</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-red-400">Est. Clients/Users</label>
            <input
              type="number"
              value={(item as RevenueItem).clients}
              onChange={(e) => updateItem({ clients: Number(e.target.value) })}
              min={0}
              className="w-full bg-black border border-red-900 p-2 text-red-300 font-mono focus:outline-none focus:border-red-600"
            />
          </div>
        </div>
      )}

      <div className="mt-3 text-xs text-right">
        <span className="text-gray-500">Annual equivalent:</span>
        <span className="text-red-400 ml-2 font-mono">
          ${calculateAnnualAmount(item.amount, item.frequency).toLocaleString()}
        </span>
      </div>
    </motion.div>
  );
};

export default DynamicItem;
