/**
 * FinancialContext.tsx — Central state management for the financial system.
 *
 * Replaces the 14 useState hooks + 21 props drilling pattern from the old
 * financialField.tsx. Any component in the financial dashboard can call
 * useFinancialState() to read state, projections, metrics, and dispatch actions.
 *
 * Data sources (Supabase):
 *   - cwa_calculatorProps  → base parameters (capital, tax, inflation, etc.)
 *   - cwa_expenses         → dynamic expense items
 *   - cwa_revenues         → dynamic revenue items
 *
 * Projections are computed via calculateProjections() from FinancialUtils.ts
 * and recalculated automatically when any input changes.
 */

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import {
  ExpenseItem,
  RevenueItem,
  ProjectionData,
  FinancialMetrics,
} from "@/stores/FinancialField";
import { calculateProjections } from "@/stores/FinancialUtils";
import { companySupabase } from "@/MyComponents/supabase";

// ── State shape ──
interface FinancialState {
  initialCapital: number;
  taxRate: number;
  inflationRate: number;
  years: number;
  avgSalary: number;
  employeeCount: number;
  salaryGrowth: number;
  expenses: ExpenseItem[];
  revenues: RevenueItem[];
  isLoading: boolean;
}

// ── Actions ──
interface FinancialActions {
  setInitialCapital: (v: number) => void;
  setTaxRate: (v: number) => void;
  setInflationRate: (v: number) => void;
  setYears: (v: number) => void;
  setAvgSalary: (v: number) => void;
  setEmployeeCount: (v: number) => void;
  setSalaryGrowth: (v: number) => void;
  setExpenses: React.Dispatch<React.SetStateAction<ExpenseItem[]>>;
  setRevenues: React.Dispatch<React.SetStateAction<RevenueItem[]>>;
  addExpense: () => void;
  deleteExpense: (id: number) => void;
  updateExpense: (item: ExpenseItem) => void;
  addRevenue: () => void;
  deleteRevenue: (id: number) => void;
  updateRevenue: (item: RevenueItem) => void;
}

// ── Context value ──
interface FinancialContextValue {
  state: FinancialState;
  projections: ProjectionData[];
  metrics: FinancialMetrics;
  actions: FinancialActions;
}

const FinancialContext = createContext<FinancialContextValue | null>(null);

// ── Provider ──
export function FinancialProvider({ children }: { children: React.ReactNode }) {
  // Base parameters
  const [initialCapital, setInitialCapital] = useState(0);
  const [taxRate, setTaxRate] = useState(9);
  const [inflationRate, setInflationRate] = useState(3);
  const [years, setYears] = useState(1);

  // Personnel
  const [avgSalary, setAvgSalary] = useState(0);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [salaryGrowth, setSalaryGrowth] = useState(0);

  // Dynamic items
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [revenues, setRevenues] = useState<RevenueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Load from Supabase on mount ──
  useEffect(() => {
    async function loadData() {
      try {
        const [expRes, revRes, propsRes] = await Promise.all([
          companySupabase.from("cwa_expenses").select("*"),
          companySupabase.from("cwa_revenues").select("*"),
          companySupabase.from("cwa_calculatorProps").select("*"),
        ]);

        if (expRes.data) {
          setExpenses(
            expRes.data.map((e: any) => ({
              id: e.id,
              name: e.name,
              amount: e.amount,
              growth: e.growth,
              frequency: e.frequency,
              category: e.category,
              type: e.type || "expense",
            }))
          );
        }

        if (revRes.data) {
          setRevenues(
            revRes.data.map((r: any) => ({
              id: r.id,
              name: r.name,
              amount: r.amount,
              growth: r.growth,
              revenueType: r.revenueType,
              frequency: r.frequency,
              category: r.category,
              clients: r.clients,
              type: r.type || "revenue",
            }))
          );
        }

        if (propsRes.data && propsRes.data.length > 0) {
          const p = propsRes.data[0];
          setInitialCapital(p.initialCapital ?? 0);
          setTaxRate(p.taxRate ?? 9);
          setInflationRate(p.inflationRate ?? 3);
          setYears(p.years ?? 1);
          setAvgSalary(p.avgSalary ?? 0);
          setEmployeeCount(p.employeeCount ?? 0);
          setSalaryGrowth(p.salaryGrowth ?? 0);
        }
      } catch (err) {
        console.error("Error loading financial data:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  // ── Compute projections whenever inputs change ──
  const { projections, metrics } = useMemo(() => {
    if (isLoading) {
      return {
        projections: [] as ProjectionData[],
        metrics: {
          cagr: 0,
          breakEvenYear: null,
          roi: 0,
          finalCashFlow: 0,
          totalProfit: 0,
          profitMargin: 0,
          employeeCostRatio: 0,
          runwayMonths: 0,
        } as FinancialMetrics,
      };
    }

    const result = calculateProjections(
      initialCapital, taxRate, inflationRate, years,
      avgSalary, employeeCount, salaryGrowth,
      expenses, revenues
    );

    return {
      projections: result.projections,
      metrics: result.financialMetrics,
    };
  }, [
    initialCapital, taxRate, inflationRate, years,
    avgSalary, employeeCount, salaryGrowth,
    expenses, revenues, isLoading,
  ]);

  // ── Item CRUD actions ──
  const addExpense = () => {
    const newId = expenses.length > 0 ? Math.max(...expenses.map((e) => e.id)) + 1 : 1;
    setExpenses((prev) => [
      ...prev,
      { id: newId, name: "New Expense", amount: 1000, growth: 2, frequency: "monthly", category: "Other", type: "expense" },
    ]);
  };

  const deleteExpense = (id: number) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const updateExpense = (item: ExpenseItem) => {
    setExpenses((prev) => prev.map((e) => (e.id === item.id ? item : e)));
  };

  const addRevenue = () => {
    const newId = revenues.length > 0 ? Math.max(...revenues.map((r) => r.id)) + 1 : 1;
    setRevenues((prev) => [
      ...prev,
      { id: newId, name: "New Revenue", amount: 1000, growth: 5, revenueType: "recurring", frequency: "monthly", category: "Other", clients: 1, type: "revenue" },
    ]);
  };

  const deleteRevenue = (id: number) => {
    setRevenues((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRevenue = (item: RevenueItem) => {
    setRevenues((prev) => prev.map((r) => (r.id === item.id ? item : r)));
  };

  const value: FinancialContextValue = {
    state: {
      initialCapital, taxRate, inflationRate, years,
      avgSalary, employeeCount, salaryGrowth,
      expenses, revenues, isLoading,
    },
    projections,
    metrics,
    actions: {
      setInitialCapital, setTaxRate, setInflationRate, setYears,
      setAvgSalary, setEmployeeCount, setSalaryGrowth,
      setExpenses, setRevenues,
      addExpense, deleteExpense, updateExpense,
      addRevenue, deleteRevenue, updateRevenue,
    },
  };

  return (
    <FinancialContext.Provider value={value}>
      {children}
    </FinancialContext.Provider>
  );
}

// ── Hook ──
export function useFinancialState() {
  const ctx = useContext(FinancialContext);
  if (!ctx) throw new Error("useFinancialState must be used inside <FinancialProvider>");
  return ctx;
}
