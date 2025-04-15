import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calculator, DollarSign, TrendingUp, Users, Settings, Percent,
  Clock
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { EXPENSE_CATEGORIES, REVENUE_CATEGORIES } from '@/stores/FinancialConstants';
import { CalculatorTabProps, ExpenseItem, RevenueItem } from '@/stores/FinancialField';
import { calculateAnnualAmount, getCategoryColor } from '@/stores/FinancialUtils';
import DynamicItem from '../dynamicItem';
import GrowthRateField from '../growthRateField';
import NumericField from '../numericField';
import YearSelector from '../yearSelection';


const CalculatorTab: React.FC<CalculatorTabProps> = ({
  initialCapital,
  setInitialCapital,
  taxRate,
  setTaxRate,
  inflationRate,
  setInflationRate,
  years,
  setYears,
  avgSalary,
  setAvgSalary,
  employeeCount,
  setEmployeeCount,
  salaryGrowth,
  setSalaryGrowth,
  expenses,
  setExpenses,
  revenues,
  setRevenues,
  projections,
  financialMetrics
}) => {
  // Sub tabs for calculator section
  const [calcSubTab, setCalcSubTab] = useState<string>('basic');
  
  // Add new expense
  const addExpense = (): void => {
    const newId = expenses.length > 0 ? Math.max(...expenses.map(e => e.id)) + 1 : 1;
    setExpenses([...expenses, { 
      id: newId, 
      name: 'New Expense', 
      amount: 1000, 
      growth: 2,
      frequency: 'monthly',
      category: 'Other'
    }]);
  };
  
  // Add new revenue
  const addRevenue = (): void => {
    const newId = revenues.length > 0 ? Math.max(...revenues.map(r => r.id)) + 1 : 1;
    setRevenues([...revenues, { 
      id: newId, 
      name: 'New Revenue', 
      amount: 1000, 
      growth: 5, 
      type: 'recurring',
      frequency: 'monthly',
      category: 'Other',
      clients: 1
    }]);
  };
  
  // Update expense
  const updateExpense = (updatedItem: ExpenseItem): void => {
    setExpenses(expenses.map(item => 
      item.id === updatedItem.id ? updatedItem : item
    ));
  };
  
  // Update revenue
  const updateRevenue = (updatedItem: RevenueItem): void => {
    setRevenues(revenues.map(item => 
      item.id === updatedItem.id ? updatedItem : item
    ));
  };
  
  // Delete expense
  const deleteExpense = (id: number): void => {
    setExpenses(expenses.filter(item => item.id !== id));
  };
  
  // Delete revenue
  const deleteRevenue = (id: number): void => {
    setRevenues(revenues.filter(item => item.id !== id));
  };
  
  return (
    <div className="backdrop-blur-lg bg-black bg-opacity-40 border border-red-900 p-8 shadow-[0_0_30px_rgba(0,0,0,0.3)]">
      <div className="text-xl font-bold text-white mb-2 flex items-center">
        <Calculator className="mr-2 text-red-500" size={20} />
        Financial Scenario Processor
      </div>
      <div className="text-sm text-red-400 mb-8 font-mono">Configure business parameters for quantum financial analysis</div>

      {/* Sub Tabs for Calculator */}
      <Tabs 
        value={calcSubTab} 
        onValueChange={setCalcSubTab}
        className="mb-6"
      >
        <TabsList className="p-1 bg-red-950/20 border border-red-900 mb-4">
          <TabsTrigger 
            value="basic" 
            className="px-4 py-2 data-[state=active]:bg-red-900/40"
          >
            <Settings size={14} className="mr-2" />
            Base Parameters
          </TabsTrigger>
          <TabsTrigger 
            value="expenses" 
            className="px-4 py-2 data-[state=active]:bg-red-900/40"
          >
            <DollarSign size={14} className="mr-2" />
            Expenses
          </TabsTrigger>
          <TabsTrigger 
            value="revenue" 
            className="px-4 py-2 data-[state=active]:bg-red-900/40"
          >
            <TrendingUp size={14} className="mr-2" />
            Revenue
          </TabsTrigger>
          <TabsTrigger 
            value="personnel" 
            className="px-4 py-2 data-[state=active]:bg-red-900/40"
          >
            <Users size={14} className="mr-2" />
            Personnel
          </TabsTrigger>
        </TabsList>
        
        {/* Base Parameters Tab */}
        <TabsContent value="basic" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <YearSelector years={years} setYears={setYears} />
              
              <NumericField 
                label="Initial Capital" 
                value={initialCapital} 
                onChange={setInitialCapital}
                icon={DollarSign}
                description="Starting investment amount"
                prefix="$"
                max={10000000}
                step={1000}
              />
              
              <GrowthRateField 
                label="Tax Rate" 
                value={taxRate} 
                onChange={setTaxRate}
                icon={Percent}
                description="Applied to annual profits"
                min={0}
                max={70}
              />
              
              <GrowthRateField 
                label="Inflation Rate" 
                value={inflationRate} 
                onChange={setInflationRate}
                icon={TrendingUp}
                description="Annual currency devaluation"
                min={0}
                max={20}
              />
            </div>
            
            <div className="bg-black/30 border border-red-900 p-6">
              <h3 className="text-lg font-medium text-white mb-6">Key Financial Metrics</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-red-400">Capital Runway:</span>
                  <span className="text-white font-mono">
                    {Math.floor(financialMetrics.runwayMonths)} months
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-red-400">Break-even Point:</span>
                  <span className="text-white font-mono">
                    {financialMetrics.breakEvenYear === null 
                      ? 'Not reached' 
                      : `Year ${financialMetrics.breakEvenYear}`}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-red-400">Projected ROI:</span>
                  <span className="text-white font-mono">
                    {financialMetrics.roi.toFixed(1)}%
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-red-400">Avg. Profit Margin:</span>
                  <span className="text-white font-mono">
                    {financialMetrics.profitMargin.toFixed(1)}%
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-red-400">Final Cash Position:</span>
                  <span className="text-white font-mono">
                    ${financialMetrics.finalCashFlow.toLocaleString()}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-red-400">Total Profit:</span>
                  <span className="text-white font-mono">
                    ${financialMetrics.totalProfit.toLocaleString()}
                  </span>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-red-900">
                <h4 className="text-red-400 mb-3">First Year Breakdown</h4>
                
                {projections.length > 1 && (
                  <div>
                    <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                      <div className="flex flex-col items-center p-2 border border-green-900 bg-green-900/10">
                        <span className="text-green-400">Revenue</span>
                        <span className="font-mono">${projections[1].totalRevenue.toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col items-center p-2 border border-red-900 bg-red-900/10">
                        <span className="text-red-400">Expenses</span>
                        <span className="font-mono">${projections[1].totalExpenses.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
        
        {/* Expenses Tab */}
        <TabsContent value="expenses" className="mt-0">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center">
                <DollarSign size={18} className="mr-2 text-red-500" />
                Expense Management
              </h3>
              <p className="text-sm text-red-400">Configure all your business expenses and operational costs</p>
            </div>
            
            <button 
              onClick={addExpense}
              className="bg-red-900/30 hover:bg-red-900/50 text-white px-4 py-2 border border-red-900 flex items-center"
            >
              + Add Expense
            </button>
          </div>
          
          {expenses.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-red-900 text-red-600">
              No expenses added yet. Click "Add Expense" to begin.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="max-h-[600px] overflow-y-auto pr-2">
                {expenses.map(expense => (
                  <DynamicItem 
                    key={expense.id} 
                    item={expense} 
                    onChange={updateExpense} 
                    onDelete={() => deleteExpense(expense.id)} 
                    type="expense"
                    categories={EXPENSE_CATEGORIES}
                  />
                ))}
              </div>
              
              <div className="bg-black/30 border border-red-900 p-6">
                <h3 className="text-lg font-medium text-white mb-6">Expense Summary</h3>
                
                <div className="mb-6">
                  <h4 className="text-red-400 mb-3">Total Annual Expenses</h4>
                  <div className="text-3xl font-bold text-white font-mono">
                    ${expenses.reduce(
                      (total, expense) => total + calculateAnnualAmount(expense), 
                      0
                    ).toLocaleString()}
                    <span className="text-sm text-red-400 ml-2">/ year</span>
                  </div>
                  <div className="text-sm text-red-400 mt-1">
                    + ${(avgSalary * employeeCount).toLocaleString()} in employee costs
                  </div>
                </div>
                
                <div className="mb-6">
                  <h4 className="text-red-400 mb-3">Expenses by Category</h4>
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(
                            expenses.reduce((acc, exp) => {
                              const cat = exp.category || 'Other';
                              acc[cat] = (acc[cat] || 0) + calculateAnnualAmount(exp);
                              return acc;
                            }, {} as Record<string, number>)
                          ).map(([category, value]) => ({
                            name: category,
                            value,
                            color: getCategoryColor(category, true)
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {Object.entries(
                            expenses.reduce((acc, exp) => {
                              const cat = exp.category || 'Other';
                              acc[cat] = (acc[cat] || 0) + calculateAnnualAmount(exp);
                              return acc;
                            }, {} as Record<string, number>)
                          ).map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={getCategoryColor(entry[0], true)} 
                            />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => `$${Number(value).toLocaleString()}`} 
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div className="mt-4 text-xs text-gray-500">
                  <p className="mb-1">Tips:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Group similar expenses into categories for better analysis</li>
                    <li>Set realistic growth rates based on industry averages</li>
                    <li>For recurring expenses, select the appropriate frequency</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
        
        {/* Revenue Tab */}
        <TabsContent value="revenue" className="mt-0">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center">
                <TrendingUp size={18} className="mr-2 text-red-500" />
                Revenue Streams
              </h3>
              <p className="text-sm text-red-400">Configure your business revenue sources and income streams</p>
            </div>
            
            <button 
              onClick={addRevenue}
              className="bg-red-900/30 hover:bg-red-900/50 text-white px-4 py-2 border border-red-900 flex items-center"
            >
              + Add Revenue
            </button>
          </div>
          
          {revenues.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-red-900 text-red-600">
              No revenue streams added yet. Click "Add Revenue" to begin.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="max-h-[600px] overflow-y-auto pr-2">
                {revenues.map(revenue => (
                  <DynamicItem 
                    key={revenue.id} 
                    item={revenue} 
                    onChange={updateRevenue} 
                    onDelete={() => deleteRevenue(revenue.id)} 
                    type="revenue"
                    categories={REVENUE_CATEGORIES}
                  />
                ))}
              </div>
              
              <div className="bg-black/30 border border-red-900 p-6">
                <h3 className="text-lg font-medium text-white mb-6">Revenue Summary</h3>
                
                <div className="mb-6">
                  <h4 className="text-red-400 mb-3">Total Annual Revenue</h4>
                  <div className="text-3xl font-bold text-white font-mono">
                    ${revenues.reduce(
                      (total, revenue) => total + calculateAnnualAmount(revenue), 
                      0
                    ).toLocaleString()}
                    <span className="text-sm text-red-400 ml-2">/ year</span>
                  </div>
                </div>
                
                <div className="mb-6">
                  <h4 className="text-red-400 mb-3">Revenue by Category</h4>
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(
                            revenues.reduce((acc, rev) => {
                              const cat = rev.category || 'Other';
                              acc[cat] = (acc[cat] || 0) + calculateAnnualAmount(rev);
                              return acc;
                            }, {} as Record<string, number>)
                          ).map(([category, value]) => ({
                            name: category,
                            value,
                            color: getCategoryColor(category, false)
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {Object.entries(
                            revenues.reduce((acc, rev) => {
                              const cat = rev.category || 'Other';
                              acc[cat] = (acc[cat] || 0) + calculateAnnualAmount(rev);
                              return acc;
                            }, {} as Record<string, number>)
                          ).map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={getCategoryColor(entry[0], false)} 
                            />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => `$${Number(value).toLocaleString()}`} 
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div className="mt-4 text-xs text-gray-500">
                  <p className="mb-1">Tips:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>For recurring revenue, be realistic about growth rates</li>
                    <li>Consider different frequency options for each revenue stream</li>
                    <li>For subscription models, estimate your client/user base</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
        
        {/* Personnel Tab */}
        <TabsContent value="personnel" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center mb-6">
                <Users size={18} className="mr-2 text-red-500" />
                Personnel Costs
              </h3>
              
              <NumericField 
                label="Average Salary" 
                value={avgSalary} 
                onChange={setAvgSalary}
                icon={DollarSign}
                description="Per employee annual amount"
                prefix="$"
                step={5000}
                max={1000000}
              />
              
              <NumericField 
                label="Employee Count" 
                value={employeeCount} 
                onChange={setEmployeeCount}
                icon={Users}
                description="Number of full-time employees"
                step={1}
                max={100}
              />
              
              <GrowthRateField 
                label="Salary Growth Rate" 
                value={salaryGrowth} 
                onChange={setSalaryGrowth}
                icon={TrendingUp}
                description="Annual salary increases"
                min={0}
                max={25}
              />
              
              <div className="mt-6 bg-black/30 border border-red-900 p-4">
                <h4 className="text-red-400 mb-3">Personnel Cost Calculation</h4>
                
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-gray-400">Base salary per employee:</span>
                  <span className="font-mono">${avgSalary.toLocaleString()}</span>
                </div>
                
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-gray-400">Number of employees:</span>
                  <span className="font-mono">× {employeeCount}</span>
                </div>
                
                <div className="flex justify-between items-center text-sm mb-2 pt-2 border-t border-red-900/50">
                  <span className="text-gray-400">Annual personnel cost:</span>
                  <span className="font-mono text-white">${(avgSalary * employeeCount).toLocaleString()}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-black/30 border border-red-900 p-6">
              <h3 className="text-lg font-medium text-white mb-6">Personnel Projections</h3>
              
              {projections.length > 0 && (
                <div>
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={projections.map(year => ({
                          year: year.year,
                          employeeCost: year.employeeCost,
                          percentOfExpenses: year.totalExpenses > 0 
                            ? (year.employeeCost / year.totalExpenses) * 100 
                            : 0
                        }))}
                        margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 10, 63, 0.15)" />
                        <XAxis 
                          dataKey="year" 
                          stroke="#ff0a3f80" 
                          tick={{ fill: '#ff0a3f', fontSize: 12 }}
                        />
                        <YAxis 
                          yAxisId="left"
                          stroke="#ff0a3f80" 
                          tick={{ fill: '#ff0a3f', fontSize: 12 }}
                          tickFormatter={(value) => `$${value / 1000}k`}
                        />
                        <YAxis 
                          yAxisId="right"
                          orientation="right"
                          stroke="#ff0a3f80" 
                          tick={{ fill: '#ff0a3f', fontSize: 12 }}
                          tickFormatter={(value) => `${value}%`}
                        />
                        <Tooltip 
                          formatter={(value, name) => {
                            if (name === 'employeeCost') return [`$${Number(value).toLocaleString()}`, 'Personnel Cost'];
                            if (name === 'percentOfExpenses') return [`${Number(value).toFixed(1)}%`, '% of Expenses'];
                            return [value, name];
                          }}
                        />
                        <Legend />
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="employeeCost" 
                          name="Personnel Cost" 
                          stroke="#ff5555" 
                          strokeWidth={2}
                          dot={{ fill: '#ff5555', r: 4 }}
                        />
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="percentOfExpenses" 
                          name="% of Expenses" 
                          stroke="#ffffff" 
                          strokeWidth={2}
                          dot={{ fill: '#ffffff', r: 4 }}
                          strokeDasharray="5 5"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="mt-6">
                    <h4 className="text-red-400 mb-3">Year-by-Year Personnel Costs</h4>
                    
                    <table className="w-full text-sm">
                      <thead className="text-xs border-b border-red-900">
                        <tr>
                          <th className="py-2 text-left">Year</th>
                          <th className="py-2 text-right">Cost</th>
                          <th className="py-2 text-right">% of Expenses</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projections.slice(1, 6).map(year => (
                          <tr key={year.year} className="border-b border-red-900/50">
                            <td className="py-2">Year {year.year}</td>
                            <td className="py-2 text-right font-mono">
                              ${year.employeeCost.toLocaleString()}
                            </td>
                            <td className="py-2 text-right font-mono">
                              {year.totalExpenses > 0 
                                ? ((year.employeeCost / year.totalExpenses) * 100).toFixed(1) 
                                : 0}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              <div className="mt-6 pt-4 border-t border-red-900/50 text-xs text-gray-500">
                <p>Industry benchmarks:</p>
                <ul className="list-disc pl-4 mt-1 space-y-1">
                  <li>Early-stage startups: 40-60% of expenses</li>
                  <li>Growth-stage tech: 30-40% of expenses</li>
                  <li>Mature companies: 15-30% of expenses</li>
                  <li>Average annual salary increase: 3-5%</li>
                </ul>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CalculatorTab;