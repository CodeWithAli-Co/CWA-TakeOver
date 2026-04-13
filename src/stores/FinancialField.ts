/**
 * FinancialField.ts — Type definitions for the financial system.
 *
 * Contains all shared interfaces consumed by:
 *   - FinancialContext.tsx     (state shape)
 *   - FinancialModeler.tsx     (input form)
 *   - FinancialProjections.tsx (visualizer)
 *   - FinancialComponents.tsx  (UI primitives)
 *   - FinancialUtils.ts        (calculation engine)
 */

// ── Item shapes ──
export interface ExpenseItem {
  id: number;
  name: string;
  amount: number;
  frequency: "monthly" | "quarterly" | "annually" | "one-time";
  growth: number;
  category: string;
  yearlyAmount?: number;
  type: "expense" | "revenue";
}

export interface RevenueItem {
  id: number;
  name: string;
  amount: number;
  frequency: "monthly" | "quarterly" | "annually" | "one-time";
  growth: number;
  revenueType: "one-time" | "recurring" | "subscription";
  category: string;
  clients: number;
  yearlyAmount?: number;
  type: "expense" | "revenue";
}

// ── Breakdown maps ──
export interface ExpenseBreakdown {
  [key: string]: number;
}

export interface RevenueBreakdown {
  [key: string]: number;
}

// ── Per-year projection result ──
export interface ProjectionData {
  year: number;
  totalRevenue: number;
  totalExpenses: number;
  employeeCost: number;
  profitBeforeTax: number;
  taxAmount: number;
  netProfit: number;
  inflationAdjustedProfit: number;
  cumulativeProfit: number;
  cashFlow: number;
  expenses: ExpenseBreakdown;
  revenues: RevenueBreakdown;
  expenseCategories?: ExpenseBreakdown;
  revenueCategories?: RevenueBreakdown;
  roi?: number;
  [key: string]: any; // dynamic expense/revenue keys
}

// ── Aggregated metrics across all years ──
export interface FinancialMetrics {
  cagr: number;
  breakEvenYear: number | null;
  roi: number;
  finalCashFlow: number;
  totalProfit: number;
  profitMargin: number;
  employeeCostRatio: number;
  runwayMonths: number;
}

// ── Scenario snapshot (currently unused — kept for future ScenarioManager) ──
export interface ScenarioData {
  id: string;
  name: string;
  description: string;
  date: string;
  initialCapital: number;
  taxRate: number;
  inflationRate: number;
  years: number;
  avgSalary: number;
  employeeCount: number;
  salaryGrowth: number;
  expenses: ExpenseItem[];
  revenues: RevenueItem[];
}

// ── UI component prop shapes ──
export interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

export interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}

export interface NumericFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  icon?: React.ElementType;
  description?: string;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export interface GrowthRateFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  icon?: React.ElementType;
  description?: string;
  min?: number;
  max?: number;
  className?: string;
}

export interface YearSelectorProps {
  years: number;
  setYears: (years: number) => void;
}

export interface DynamicItemProps {
  item: ExpenseItem | RevenueItem;
  onChange: (item: ExpenseItem | RevenueItem) => void;
  onDelete: () => void;
  type: "expense" | "revenue";
  categories: string[];
}
