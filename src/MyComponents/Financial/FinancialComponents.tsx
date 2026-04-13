/**
 * FinancialComponents.tsx — Shared UI primitives for the financial system.
 *
 * Consolidates 6 previously separate files:
 *   - NumericField    (number input with icon, prefix/suffix)
 *   - GrowthRateField (percentage slider)
 *   - YearSelector    (year range picker with quick buttons)
 *   - SectionHeader   (icon + title + subtitle)
 *   - CustomTooltip   (Recharts tooltip styled for Void theme)
 *   - DynamicItem     (expense/revenue row editor)
 *
 * All components follow the Void design language:
 *   bg-[#0a0a0a], border-white/[0.04], rounded-sm, red-500 accents.
 */

import React from "react";
import { Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import {
  NumericFieldProps,
  GrowthRateFieldProps,
  YearSelectorProps,
  SectionHeaderProps,
  CustomTooltipProps,
  DynamicItemProps,
  ExpenseItem,
  RevenueItem,
} from "@/stores/FinancialField";

// ═══════════════════════════════════════════
// NumericField — number input with optional icon, prefix ($), suffix (%)
// ═══════════════════════════════════════════
export const NumericField: React.FC<NumericFieldProps> = ({
  label, value, onChange, icon: Icon, description,
  prefix, suffix, min, max, step = 1,
}) => (
  <div className="space-y-1.5">
    <label className="flex items-center gap-1.5 text-[11px] text-white/25 uppercase tracking-[0.12em] font-medium">
      {Icon && <Icon className="h-3 w-3 text-red-500/50" />}
      {label}
    </label>
    <div className="relative flex items-center">
      {prefix && (
        <span className="absolute left-3 text-[12px] text-red-500/50 font-medium">{prefix}</span>
      )}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className={`w-full ${prefix ? "pl-7" : "pl-3"} ${suffix ? "pr-8" : "pr-3"} py-2 bg-white/[0.02] border border-white/[0.06] text-white/80 rounded-sm text-[13px] focus:border-red-500/20 focus:outline-none transition-colors`}
      />
      {suffix && (
        <span className="absolute right-3 text-[12px] text-white/20">{suffix}</span>
      )}
    </div>
    {description && (
      <p className="text-[11px] text-white/15">{description}</p>
    )}
  </div>
);

// ═══════════════════════════════════════════
// GrowthRateField — percentage range slider
// ═══════════════════════════════════════════
export const GrowthRateField: React.FC<GrowthRateFieldProps> = ({
  label, value, onChange, icon: Icon, description,
  min = -20, max = 50,
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <label className="flex items-center gap-1.5 text-[11px] text-white/25 uppercase tracking-[0.12em] font-medium">
        {Icon && <Icon className="h-3 w-3 text-red-500/50" />}
        {label}
      </label>
      <span className="text-[13px] text-red-400 font-medium">{value}%</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-1 bg-white/[0.06] rounded-full appearance-none cursor-pointer accent-red-500"
    />
    <div className="flex justify-between text-[10px] text-white/10">
      <span>{min}%</span>
      <span>0%</span>
      <span>{max}%</span>
    </div>
    {description && <p className="text-[11px] text-white/15">{description}</p>}
  </div>
);

// ═══════════════════════════════════════════
// YearSelector — year range with quick-select buttons
// ═══════════════════════════════════════════
export const YearSelector: React.FC<YearSelectorProps> = ({ years, setYears }) => {
  const quickYears = [1, 3, 5, 10, 20];
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-white/25 uppercase tracking-[0.12em] font-medium">
          Projection Period
        </label>
        <span className="text-[13px] text-red-400 font-medium">{years} year{years !== 1 ? "s" : ""}</span>
      </div>
      <input
        type="range"
        min={1}
        max={20}
        value={years}
        onChange={(e) => setYears(Number(e.target.value))}
        className="w-full h-1 bg-white/[0.06] rounded-full appearance-none cursor-pointer accent-red-500"
      />
      <div className="flex gap-1.5">
        {quickYears.map((y) => (
          <button
            key={y}
            onClick={() => setYears(y)}
            className={`flex-1 py-1 text-[11px] rounded-sm border transition-colors ${
              years === y
                ? "bg-red-500/[0.1] text-red-400 border-red-500/20"
                : "bg-white/[0.02] text-white/25 border-white/[0.04] hover:text-white/40"
            }`}
          >
            {y}yr
          </button>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
// SectionHeader — icon + title with optional subtitle
// ═══════════════════════════════════════════
export const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title, subtitle }) => (
  <div className="flex items-center gap-2 mb-4">
    <span className="text-red-500/70">{icon}</span>
    <div>
      <h3 className="text-[14px] font-semibold text-white/80">{title}</h3>
      {subtitle && <p className="text-[11px] text-white/25">{subtitle}</p>}
    </div>
  </div>
);

// ═══════════════════════════════════════════
// CustomTooltip — Recharts tooltip for Void theme
// ═══════════════════════════════════════════
export const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-[#0a0a0a] border border-white/[0.08] rounded-sm px-3 py-2 shadow-xl">
      <p className="text-[11px] text-red-400 font-medium mb-1">Year {label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-[12px] text-white/60" style={{ color: entry.color }}>
          {entry.name}: ${Number(entry.value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════
// DynamicItem — editable expense or revenue row
// ═══════════════════════════════════════════

const calculateAnnualDisplay = (item: ExpenseItem | RevenueItem): number => {
  let base = item.amount;
  switch (item.frequency) {
    case "monthly": base *= 12; break;
    case "quarterly": base *= 4; break;
  }
  if ("clients" in item && (item.revenueType === "subscription" || item.revenueType === "recurring")) {
    base *= item.clients;
  }
  return base;
};

export const DynamicItem: React.FC<DynamicItemProps> = ({
  item, onChange, onDelete, type, categories,
}) => {
  const annual = calculateAnnualDisplay(item);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="bg-white/[0.015] border border-white/[0.04] rounded-sm p-4 space-y-3 group"
    >
      <div className="flex items-center justify-between">
        {/* Name input */}
        <input
          type="text"
          value={item.name}
          onChange={(e) => onChange({ ...item, name: e.target.value })}
          className="bg-transparent text-[13px] text-white/70 font-medium border-none focus:outline-none w-48"
          placeholder="Item name"
        />
        <div className="flex items-center gap-3">
          {/* Annual display */}
          <span className="text-[11px] text-red-400/70">
            ${annual.toLocaleString()}/yr
          </span>
          {/* Delete */}
          <button
            onClick={onDelete}
            className="p-1 rounded-sm text-white/10 hover:text-red-400/70 hover:bg-red-500/[0.06] transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {/* Amount */}
        <div>
          <label className="text-[10px] text-white/15 uppercase tracking-wider">Amount</label>
          <div className="relative mt-1">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-red-500/40">$</span>
            <input
              type="number"
              value={item.amount}
              onChange={(e) => onChange({ ...item, amount: Number(e.target.value) })}
              className="w-full pl-6 pr-2 py-1.5 bg-white/[0.02] border border-white/[0.06] text-white/60 rounded-sm text-[12px] focus:border-red-500/20 focus:outline-none"
            />
          </div>
        </div>

        {/* Growth */}
        <div>
          <label className="text-[10px] text-white/15 uppercase tracking-wider">Growth</label>
          <div className="relative mt-1">
            <input
              type="number"
              value={item.growth}
              onChange={(e) => onChange({ ...item, growth: Number(e.target.value) })}
              className="w-full pl-2 pr-6 py-1.5 bg-white/[0.02] border border-white/[0.06] text-white/60 rounded-sm text-[12px] focus:border-red-500/20 focus:outline-none"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-white/15">%</span>
          </div>
        </div>

        {/* Frequency */}
        <div>
          <label className="text-[10px] text-white/15 uppercase tracking-wider">Frequency</label>
          <select
            value={item.frequency}
            onChange={(e) => onChange({ ...item, frequency: e.target.value as any })}
            className="w-full mt-1 px-2 py-1.5 bg-white/[0.02] border border-white/[0.06] text-white/50 rounded-sm text-[12px] focus:border-red-500/20 focus:outline-none appearance-none cursor-pointer"
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annually">Annually</option>
            <option value="one-time">One-time</option>
          </select>
        </div>

        {/* Category */}
        <div>
          <label className="text-[10px] text-white/15 uppercase tracking-wider">Category</label>
          <select
            value={item.category}
            onChange={(e) => onChange({ ...item, category: e.target.value })}
            className="w-full mt-1 px-2 py-1.5 bg-white/[0.02] border border-white/[0.06] text-white/50 rounded-sm text-[12px] focus:border-red-500/20 focus:outline-none appearance-none cursor-pointer"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Revenue-specific fields */}
      {type === "revenue" && "clients" in item && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-white/15 uppercase tracking-wider">Revenue Type</label>
            <select
              value={(item as RevenueItem).revenueType}
              onChange={(e) => onChange({ ...item, revenueType: e.target.value as any })}
              className="w-full mt-1 px-2 py-1.5 bg-white/[0.02] border border-white/[0.06] text-white/50 rounded-sm text-[12px] focus:border-red-500/20 focus:outline-none appearance-none cursor-pointer"
            >
              <option value="one-time">One-time</option>
              <option value="recurring">Recurring</option>
              <option value="subscription">Subscription</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-white/15 uppercase tracking-wider">Clients</label>
            <input
              type="number"
              value={(item as RevenueItem).clients}
              onChange={(e) => onChange({ ...item, clients: Number(e.target.value) })}
              min={0}
              className="w-full mt-1 px-2 py-1.5 bg-white/[0.02] border border-white/[0.06] text-white/60 rounded-sm text-[12px] focus:border-red-500/20 focus:outline-none"
            />
          </div>
        </div>
      )}
    </motion.div>
  );
};
