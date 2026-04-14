/**
 * React Query hooks for Simplicity's Supabase database.
 * These pull live data from the Simplicity Funds database tables.
 */
import { useQuery } from "@tanstack/react-query";
import { simplicitySupabase } from "./simplicityClient";

// ── Users ────────────────────────────────────────────────────────────
export interface SimplicityUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  plan: string;
  supa_id: string | null;
  isActive: boolean | null;
  last_login_at: number | null;
  joined_at: string;
  savings_rate: number | null;
  two_fa_enabled: boolean | null;
  role: string | null;
}

export function useSimplicityUsers() {
  return useQuery({
    queryKey: ["simplicity", "users"],
    queryFn: async () => {
      const { data, error } = await simplicitySupabase
        .from("users")
        .select("id, first_name, last_name, email, plan, supa_id, isActive, last_login_at, joined_at, savings_rate, two_fa_enabled, role")
        .order("id", { ascending: false });
      if (error) throw error;
      return (data || []) as SimplicityUser[];
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// ── Expenses (aggregated) ────────────────────────────────────────────
export interface SimplicityExpense {
  id: number;
  name: string;
  amount: number;
  category: { name: string; subscription_category?: string } | null;
  date: number;
  user_id: string;
  is_recurring: boolean;
  frequency: string;
}

export function useSimplicityExpenses() {
  return useQuery({
    queryKey: ["simplicity", "expenses"],
    queryFn: async () => {
      const { data, error } = await simplicitySupabase
        .from("expenses")
        .select("id, name, amount, category, date, user_id, is_recurring, frequency")
        .order("date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as SimplicityExpense[];
    },
    staleTime: 1000 * 60 * 2,
  });
}

// ── Income Sources ───────────────────────────────────────────────────
export interface SimplicityIncomeSource {
  id: number;
  user_id: string | null;
  job_name: string | null;
  amount: number | null;
  frequency: string | null;
  is_active: boolean | null;
}

export function useSimplicityIncomeSources() {
  return useQuery({
    queryKey: ["simplicity", "income_sources"],
    queryFn: async () => {
      const { data, error } = await simplicitySupabase
        .from("income_source")
        .select("id, user_id, job_name, amount, frequency, is_active")
        .order("id", { ascending: false });
      if (error) throw error;
      return (data || []) as SimplicityIncomeSource[];
    },
    staleTime: 1000 * 60 * 2,
  });
}

// ── Bank Accounts ────────────────────────────────────────────────────
export function useSimplicityBankAccounts() {
  return useQuery({
    queryKey: ["simplicity", "bank_accounts"],
    queryFn: async () => {
      const { data, error } = await simplicitySupabase
        .from("bank_accs")
        .select("id, name, type, balance, bank_name, is_active, user_id, plaid_account_id")
        .order("id", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 2,
  });
}

// ── Cashflow ─────────────────────────────────────────────────────────
export function useSimplicityCashflow() {
  return useQuery({
    queryKey: ["simplicity", "cashflow"],
    queryFn: async () => {
      const { data, error } = await simplicitySupabase
        .from("cashflow")
        .select("id, category, date, amount, type, user_id")
        .order("date", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 2,
  });
}

// ── Financial Details ────────────────────────────────────────────────
export function useSimplicityFinancialDetails() {
  return useQuery({
    queryKey: ["simplicity", "financial_details"],
    queryFn: async () => {
      const { data, error } = await simplicitySupabase
        .from("financial_details")
        .select("id, total_monthly_income, total_monthly_expense, user_id, projected_monthly_income");
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 2,
  });
}

// ── Stripe Subscriptions ─────────────────────────────────────────────
export function useSimplicitySubscriptions() {
  return useQuery({
    queryKey: ["simplicity", "stripe_subscriptions"],
    queryFn: async () => {
      const { data, error } = await simplicitySupabase
        .from("stripe_subscriptions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 2,
  });
}

// ── User Feedbacks ───────────────────────────────────────────────────
export function useSimplicityFeedbacks() {
  return useQuery({
    queryKey: ["simplicity", "feedbacks"],
    queryFn: async () => {
      const { data, error } = await simplicitySupabase
        .from("user_feedbacks")
        .select("*")
        .order("id", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ── Aggregate Metrics (computed from above queries) ──────────────────
export function useSimplicityMetrics() {
  const users = useSimplicityUsers();
  const expenses = useSimplicityExpenses();
  const bankAccounts = useSimplicityBankAccounts();

  const totalUsers = users.data?.length ?? 0;
  const activeUsers = users.data?.filter((u) => u.isActive)?.length ?? 0;
  const rippleUsers = users.data?.filter((u) => u.plan === "Ripple" || u.plan === "free" || !u.plan)?.length ?? 0;
  const tideUsers = users.data?.filter((u) => u.plan === "Tide" || u.plan === "premium")?.length ?? 0;
  const totalExpenses = expenses.data?.length ?? 0;
  const totalExpenseAmount = expenses.data?.reduce((s, e) => s + Math.abs(e.amount), 0) ?? 0;
  const totalBankAccounts = bankAccounts.data?.length ?? 0;
  const uniqueUsersWithExpenses = new Set(expenses.data?.map((e) => e.user_id)).size;

  return {
    totalUsers,
    activeUsers,
    rippleUsers,
    tideUsers,
    totalExpenses,
    totalExpenseAmount,
    totalBankAccounts,
    uniqueUsersWithExpenses,
    isLoading: users.isLoading || expenses.isLoading || bankAccounts.isLoading,
    isError: users.isError || expenses.isError || bankAccounts.isError,
  };
}
