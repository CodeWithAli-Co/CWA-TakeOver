// Type definitions
export interface ExpenseItem {
    id: number;
    name: string;
    amount: number;
    frequency: 'monthly' | 'quarterly' | 'annually' | 'one-time';
    growth: number;
    category: string;
    yearlyAmount?: number;
  }
  
  export interface RevenueItem {
    id: number;
    name: string;
    amount: number;
    frequency: 'monthly' | 'quarterly' | 'annually' | 'one-time';
    growth: number;
    type: 'one-time' | 'recurring' | 'subscription';
    category: string;
    clients: number;
    yearlyAmount?: number;
  }
  
  export interface ExpenseBreakdown {
    [key: string]: number;
  }
  
  export interface RevenueBreakdown {
    [key: string]: number;
  }
  
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
    [key: string]: any; // For dynamic expense and revenue keys
  }
  
  export interface MonthlyMultiplierData {
    name: string;
    amount: number;
    months: number[];
    years: number[];
  }
  
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
    icon: React.ElementType;
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
    icon: React.ElementType;
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
    type: 'expense' | 'revenue';
    categories: string[];
  }
  
  export interface ScenarioManagerProps {
    loadScenario: (scenario: ScenarioData) => void;
    saveScenario: () => ScenarioData;
  }
  
  export interface CalculatorTabProps {
    initialCapital: number;
    setInitialCapital: (value: number) => void;
    taxRate: number;
    setTaxRate: (value: number) => void;
    inflationRate: number;
    setInflationRate: (value: number) => void;
    years: number;
    setYears: (value: number) => void;
    avgSalary: number;
    setAvgSalary: (value: number) => void;
    employeeCount: number;
    setEmployeeCount: (value: number) => void;
    salaryGrowth: number;
    setSalaryGrowth: (value: number) => void;
    expenses: ExpenseItem[];
    setExpenses: React.Dispatch<React.SetStateAction<ExpenseItem[]>>;
    revenues: RevenueItem[];
    setRevenues: React.Dispatch<React.SetStateAction<RevenueItem[]>>;
    projections: ProjectionData[];
    financialMetrics: FinancialMetrics;
  }
  
  export interface VisualizerTabProps {
    years: number;
    projections: ProjectionData[];
    financialMetrics: FinancialMetrics;
    expenses: ExpenseItem[];
    revenues: RevenueItem[];
  }
  
  export interface BasicParametersProps {
    initialCapital: number;
    setInitialCapital: (value: number) => void;
    taxRate: number;
    setTaxRate: (value: number) => void;
    inflationRate: number;
    setInflationRate: (value: number) => void;
    years: number;
    setYears: (value: number) => void;
    financialMetrics: FinancialMetrics;
    projections: ProjectionData[];
  }
  
  export interface ExpensesTabProps {
    expenses: ExpenseItem[];
    setExpenses: React.Dispatch<React.SetStateAction<ExpenseItem[]>>;
    avgSalary: number;
    employeeCount: number;
    calculateAnnualAmount: (item: ExpenseItem | RevenueItem) => number;
    getCategoryColor: (category: string, isExpense: boolean) => string;
  }
  
  export interface RevenueTabProps {
    revenues: RevenueItem[];
    setRevenues: React.Dispatch<React.SetStateAction<RevenueItem[]>>;
    calculateAnnualAmount: (item: ExpenseItem | RevenueItem) => number;
    getCategoryColor: (category: string, isExpense: boolean) => string;
  }
  
  export interface PersonnelTabProps {
    avgSalary: number;
    setAvgSalary: (value: number) => void;
    employeeCount: number;
    setEmployeeCount: (value: number) => void;
    salaryGrowth: number;
    setSalaryGrowth: (value: number) => void;
    projections: ProjectionData[];
  }