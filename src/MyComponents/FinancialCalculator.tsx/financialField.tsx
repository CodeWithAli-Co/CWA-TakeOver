import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, PieChart as PieChartIcon, Sliders, FileText } from "lucide-react";
import { ExpenseItem, RevenueItem, ProjectionData, FinancialMetrics, ScenarioData } from '@/stores/FinancialField';
import { calculateProjections } from '@/stores/FinancialUtils';
import CalculatorTab from './tabs/calculatorTab';
import MonthlyMultiplier from './tabs/monthlyMultiplier';
import ScenarioManager from './tabs/ScenarioManager';
import VisualizerTab from './tabs/VisualizerTab';

// Import types


export const FinancialField: React.FC = () => {
  // Main Navigation Tabs
  const [mainTab, setMainTab] = useState<string>('calculator');
  
  // Basic financials
  const [initialCapital, setInitialCapital] = useState<number>(50000);
  const [taxRate, setTaxRate] = useState<number>(25);
  const [inflationRate, setInflationRate] = useState<number>(2.5);
  const [years, setYears] = useState<number>(5);
  
  // Employee costs
  const [avgSalary, setAvgSalary] = useState<number>(60000);
  const [employeeCount, setEmployeeCount] = useState<number>(3);
  const [salaryGrowth, setSalaryGrowth] = useState<number>(3);
  
  // Dynamic expenses
  const [expenses, setExpenses] = useState<ExpenseItem[]>([
    { id: 1, name: 'Website Hosting', amount: 1200, growth: 5, frequency: 'annually', category: 'Technology' },
    { id: 2, name: 'Software Subscriptions', amount: 300, growth: 10, frequency: 'monthly', category: 'Software' },
    { id: 3, name: 'Office Space', amount: 2000, growth: 3, frequency: 'monthly', category: 'Rent' }
  ]);
  
  // Revenue streams
  const [revenues, setRevenues] = useState<RevenueItem[]>([
    { id: 1, name: 'Basic Plan', amount: 29, growth: 15, type: 'subscription', frequency: 'monthly', category: 'Subscriptions', clients: 100 },
    { id: 2, name: 'Premium Plan', amount: 79, growth: 20, type: 'subscription', frequency: 'monthly', category: 'Subscriptions', clients: 50 },
    { id: 3, name: 'Consulting', amount: 5000, growth: 5, type: 'one-time', frequency: 'quarterly', category: 'Services', clients: 7 }
  ]);
  
  // Computed financial projections
  const [projections, setProjections] = useState<ProjectionData[]>([]);
  const [financialMetrics, setFinancialMetrics] = useState<FinancialMetrics>({
    cagr: 0,
    breakEvenYear: null,
    roi: 0,
    finalCashFlow: 0,
    totalProfit: 0,
    profitMargin: 0,
    employeeCostRatio: 0,
    runwayMonths: 0
  });
  
  // Calculate projections when inputs change
  useEffect(() => {
    const { projections: calculatedProjections, financialMetrics: calculatedMetrics } = calculateProjections(
      initialCapital,
      taxRate,
      inflationRate,
      years,
      avgSalary,
      employeeCount,
      salaryGrowth,
      expenses,
      revenues
    );
    
    setProjections(calculatedProjections);
    setFinancialMetrics(calculatedMetrics);
  }, [
    initialCapital, taxRate, inflationRate, years,
    avgSalary, employeeCount, salaryGrowth,
    expenses, revenues
  ]);
  
  // Save the current scenario
  const saveCurrentScenario = (): ScenarioData => {
    return {
      id: '', // Will be filled by ScenarioManager
      name: '',
      description: '',
      date: new Date().toISOString(),
      initialCapital,
      taxRate,
      inflationRate,
      years,
      avgSalary,
      employeeCount,
      salaryGrowth,
      expenses,
      revenues
    };
  };
  
  // Load a saved scenario
  const loadScenario = (scenario: ScenarioData): void => {
    setInitialCapital(scenario.initialCapital);
    setTaxRate(scenario.taxRate);
    setInflationRate(scenario.inflationRate);
    setYears(scenario.years);
    setAvgSalary(scenario.avgSalary);
    setEmployeeCount(scenario.employeeCount);
    setSalaryGrowth(scenario.salaryGrowth);
    setExpenses(scenario.expenses);
    setRevenues(scenario.revenues);
    
    // Switch to the calculator tab
    setMainTab('calculator');
  };

  return (
    <div className="min-h-screen bg-black text-gray-300 relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Main Navigation Tabs */}
        <Tabs 
          value={mainTab} 
          onValueChange={setMainTab}
          className="w-full"
        >
          <TabsList className="p-1 bg-black bg-opacity-50 backdrop-blur-sm border border-red-900 rounded-none mb-6 w-full">
            <TabsTrigger 
              value="calculator" 
              className="px-6 py-3 rounded-none data-[state=active]:bg-red-900 data-[state=active]:text-white data-[state=active]:shadow-[0_0_10px_rgba(255,10,63,0.5)] transition-all duration-300"
            >
              <Calculator size={16} className="mr-2" />
              FINANCIAL MODELER
            </TabsTrigger>
            <TabsTrigger 
              value="visualizer" 
              className="px-6 py-3 rounded-none data-[state=active]:bg-red-900 data-[state=active]:text-white data-[state=active]:shadow-[0_0_10px_rgba(255,10,63,0.5)] transition-all duration-300"
            >
              <PieChartIcon size={16} className="mr-2" />
              PROJECTIONS
            </TabsTrigger>
            <TabsTrigger 
              value="tools" 
              className="px-6 py-3 rounded-none data-[state=active]:bg-red-900 data-[state=active]:text-white data-[state=active]:shadow-[0_0_10px_rgba(255,10,63,0.5)] transition-all duration-300"
            >
              <Sliders size={16} className="mr-2" />
              FINANCIAL TOOLS
            </TabsTrigger>
            <TabsTrigger 
              value="scenarios" 
              className="px-6 py-3 rounded-none data-[state=active]:bg-red-900 data-[state=active]:text-white data-[state=active]:shadow-[0_0_10px_rgba(255,10,63,0.5)] transition-all duration-300"
            >
              <FileText size={16} className="mr-2" />
              SCENARIOS
            </TabsTrigger>
          </TabsList>

          {/* Financial Calculator Tab */}
          <TabsContent value="calculator" className="mt-4">
            <CalculatorTab
              initialCapital={initialCapital}
              setInitialCapital={setInitialCapital}
              taxRate={taxRate}
              setTaxRate={setTaxRate}
              inflationRate={inflationRate}
              setInflationRate={setInflationRate}
              years={years}
              setYears={setYears}
              avgSalary={avgSalary}
              setAvgSalary={setAvgSalary}
              employeeCount={employeeCount}
              setEmployeeCount={setEmployeeCount}
              salaryGrowth={salaryGrowth}
              setSalaryGrowth={setSalaryGrowth}
              expenses={expenses}
              setExpenses={setExpenses}
              revenues={revenues}
              setRevenues={setRevenues}
              projections={projections}
              financialMetrics={financialMetrics}
            />
          </TabsContent>

          {/* Projections Visualizer Tab */}
          <TabsContent value="visualizer" className="mt-4">
            <VisualizerTab
              years={years}
              projections={projections}
              financialMetrics={financialMetrics}
              expenses={expenses}
              revenues={revenues}
            />
          </TabsContent>

          {/* Financial Tools Tab */}
          <TabsContent value="tools" className="mt-4">
            <MonthlyMultiplier />
          </TabsContent>
          
          {/* Scenario Manager Tab */}
          <TabsContent value="scenarios" className="mt-4">
            <ScenarioManager 
              loadScenario={loadScenario}
              saveScenario={saveCurrentScenario}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default FinancialField;