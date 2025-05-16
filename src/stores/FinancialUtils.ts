import { EXPENSE_COLORS, REVENUE_COLORS } from "./FinancialConstants";
import { ExpenseItem, RevenueItem, ProjectionData, FinancialMetrics } from "./FinancialField";



// Calculate annual amount based on frequency
export const calculateAnnualAmount = (item: ExpenseItem | RevenueItem): number => {
  let base = item.amount;
  
  switch (item.frequency) {
    case 'monthly':
      base *= 12;
      break;
    case 'quarterly':
      base *= 4;
      break;
  }
  
  // For revenue items, multiply by clients if it's a subscription or recurring
  if ('clients' in item && (item.revenueType === 'subscription' || item.revenueType === 'recurring')) {
    base *= item.clients;
  }
  
  return base;
};

// Get color for expense/revenue categories
export const getCategoryColor = (category: string, isExpense: boolean): string => {
  if (isExpense) {
    return EXPENSE_COLORS[category] || '#ff0a3f';
  } else {
    return REVENUE_COLORS[category] || '#00ff9f';
  }
};

// Calculate financial projections
export const calculateProjections = (
  initialCapital: number,
  taxRate: number,
  inflationRate: number,
  years: number,
  avgSalary: number,
  employeeCount: number,
  salaryGrowth: number,
  expenses: ExpenseItem[],
  revenues: RevenueItem[]
): { projections: ProjectionData[], financialMetrics: FinancialMetrics } => {
  let yearlyData: ProjectionData[] = [];
  
  // Starting amounts
  let capital = initialCapital;
  let cumulativeProfit = 0;
  let cashFlow = initialCapital;
  
  // Calculate for each year
  for (let year = 0; year <= years; year++) {
    // Calculate employee costs with growth
    const employeeCost = avgSalary * employeeCount * Math.pow(1 + salaryGrowth / 100, year);
    
    // Calculate each expense with its own growth rate
    const yearlyExpenses = expenses.map(expense => {
      const baseAmount = calculateAnnualAmount(expense);
      return {
        ...expense,
        yearlyAmount: baseAmount * Math.pow(1 + expense.growth / 100, year)
      };
    });
    
    // Calculate each revenue with its own growth rate
    const yearlyRevenues = revenues.map(revenue => {
      const baseAmount = calculateAnnualAmount(revenue);
      
      // For recurring/subscription revenue, use compound growth 
      // For one-time revenue, use simple growth
      const growthFactor = revenue.revenueType === 'one-time' 
        ? (1 + (revenue.growth / 100) * year)
        : Math.pow(1 + revenue.growth / 100, year);
      
      return {
        ...revenue,
        yearlyAmount: baseAmount * growthFactor
      };
    });
    
    // Sum up totals
    const totalExpenses = yearlyExpenses.reduce((sum, exp) => sum + (exp.yearlyAmount || 0), 0) + employeeCost;
    const totalRevenue = yearlyRevenues.reduce((sum, rev) => sum + (rev.yearlyAmount || 0), 0);
    
    // Calculate profit before tax
    const profitBeforeTax = totalRevenue - totalExpenses;
    
    // Apply tax on positive profit
    const taxAmount = profitBeforeTax > 0 ? profitBeforeTax * (taxRate / 100) : 0;
    
    // Calculate net profit
    const netProfit = profitBeforeTax - taxAmount;
    
    // Adjust for inflation
    const inflationAdjustedProfit = netProfit / Math.pow(1 + inflationRate / 100, year);
    
    // Update cumulative values
    cumulativeProfit += netProfit;
    cashFlow = year === 0 ? initialCapital : cashFlow + netProfit;
    
    // Calculate ROI for this year
    const roi = initialCapital > 0 ? (cumulativeProfit / initialCapital) * 100 : 0;
    
    // Detailed breakdown
    const expenseBreakdown: Record<string, number> = {};
    yearlyExpenses.forEach(exp => {
      if (exp.yearlyAmount !== undefined) {
        expenseBreakdown[exp.name] = exp.yearlyAmount;
      }
    });
    expenseBreakdown['Employee Costs'] = employeeCost;
    
    const revenueBreakdown: Record<string, number> = {};
    yearlyRevenues.forEach(rev => {
      if (rev.yearlyAmount !== undefined) {
        revenueBreakdown[rev.name] = rev.yearlyAmount;
      }
    });
    
    // Category breakdowns
    const expenseCategories: Record<string, number> = {};
    yearlyExpenses.forEach(exp => {
      if (exp.yearlyAmount !== undefined) {
        const category = exp.category || 'Other';
        expenseCategories[category] = (expenseCategories[category] || 0) + exp.yearlyAmount;
      }
    });
    expenseCategories['Employee Costs'] = employeeCost;
    
    const revenueCategories: Record<string, number> = {};
    yearlyRevenues.forEach(rev => {
      if (rev.yearlyAmount !== undefined) {
        const category = rev.category || 'Other';
        revenueCategories[category] = (revenueCategories[category] || 0) + rev.yearlyAmount;
      }
    });
    
    // Store data for this year
    const yearData: ProjectionData = {
      year,
      totalRevenue,
      totalExpenses,
      employeeCost,
      profitBeforeTax,
      taxAmount,
      netProfit,
      inflationAdjustedProfit,
      cumulativeProfit,
      cashFlow,
      roi,
      expenses: expenseBreakdown,
      revenues: revenueBreakdown,
      expenseCategories,
      revenueCategories
    };
    
    // Add expense breakdowns as direct properties
    Object.keys(expenseBreakdown).forEach(key => {
      yearData[key] = expenseBreakdown[key];
    });
    
    // Add revenue breakdowns as direct properties
    Object.keys(revenueBreakdown).forEach(key => {
      yearData[key] = revenueBreakdown[key];
    });
    
    yearlyData.push(yearData);
  }
  
  // Calculate financial metrics
  let financialMetrics: FinancialMetrics = {
    cagr: 0,
    breakEvenYear: null,
    roi: 0,
    finalCashFlow: 0,
    totalProfit: 0,
    profitMargin: 0,
    employeeCostRatio: 0,
    runwayMonths: 0
  };
  
  if (yearlyData.length > 1) {
    const lastYearData = yearlyData[yearlyData.length - 1];
    const firstYearData = yearlyData[1]; // Year 1 (not 0)
    
    // Calculate CAGR (Compound Annual Growth Rate) for revenue
    const cagr = firstYearData.totalRevenue > 0 
      ? (Math.pow(lastYearData.totalRevenue / firstYearData.totalRevenue, 1 / (years - 1)) - 1) * 100
      : 0;
    
    // Break-even point (where cumulative profit becomes positive)
    let breakEvenYear: number | null = null;
    for (let i = 1; i < yearlyData.length; i++) {
      if (yearlyData[i].cumulativeProfit > 0 && (breakEvenYear === null || breakEvenYear > i)) {
        breakEvenYear = i;
      }
    }
    
    // Calculate ROI (Return on Investment)
    const roi = initialCapital > 0 ? (lastYearData.cumulativeProfit / initialCapital) * 100 : 0;
    
    // Calculate profit margin (average over the years)
    let totalProfitMargin = 0;
    let profitMarginYears = 0;
    for (let i = 1; i < yearlyData.length; i++) {
      if (yearlyData[i].totalRevenue > 0) {
        totalProfitMargin += (yearlyData[i].netProfit / yearlyData[i].totalRevenue) * 100;
        profitMarginYears++;
      }
    }
    const profitMargin = profitMarginYears > 0 ? totalProfitMargin / profitMarginYears : 0;
    
    // Calculate employee cost ratio (average over the years)
    let totalEmployeeCostRatio = 0;
    let employeeCostYears = 0;
    for (let i = 1; i < yearlyData.length; i++) {
      if (yearlyData[i].totalExpenses > 0) {
        totalEmployeeCostRatio += (yearlyData[i].employeeCost / yearlyData[i].totalExpenses) * 100;
        employeeCostYears++;
      }
    }
    const employeeCostRatio = employeeCostYears > 0 ? totalEmployeeCostRatio / employeeCostYears : 0;
    
    // Calculate runway (how many months current capital would last at current burn rate)
    const monthlyBurn = yearlyData[1].totalExpenses / 12;
    const runwayMonths = monthlyBurn > 0 ? initialCapital / monthlyBurn : 0;
    
    // Set calculated metrics
    financialMetrics = {
      cagr: isNaN(cagr) ? 0 : cagr,
      breakEvenYear,
      roi: isNaN(roi) ? 0 : roi,
      finalCashFlow: lastYearData.cashFlow,
      totalProfit: lastYearData.cumulativeProfit,
      profitMargin: isNaN(profitMargin) ? 0 : profitMargin,
      employeeCostRatio: isNaN(employeeCostRatio) ? 0 : employeeCostRatio,
      runwayMonths: isNaN(runwayMonths) ? 0 : runwayMonths
    };
  }
  
  return { projections: yearlyData, financialMetrics };
};