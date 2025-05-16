import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calculator,
  PieChart as PieChartIcon,
  Sliders,
  FileText,
} from "lucide-react";
import {
  ExpenseItem,
  RevenueItem,
  ProjectionData,
  FinancialMetrics,
  ScenarioData,
} from "@/stores/FinancialField";
import { calculateProjections } from "@/stores/FinancialUtils";
import CalculatorTab from "./tabs/calculatorTab";
import MonthlyMultiplier from "./tabs/monthlyMultiplier";
import ScenarioManager from "./tabs/ScenarioManager";
import VisualizerTab from "./tabs/VisualizerTab";
import supabase from "@/MyComponents/supabase";
import { ActiveUser } from "@/stores/query";

export const FinancialField: React.FC = () => {
  // Main Navigation Tabs
  const [mainTab, setMainTab] = useState<string>("calculator");

  // Scenario 'Mode' State
  const [activateScenario, setActivateScenario] = useState(false);

  // Basic financials
  const [initialCapital, setInitialCapital] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(9);
  const [inflationRate, setInflationRate] = useState<number>(3);
  const [years, setYears] = useState<number>(1);

  // Employee costs
  const [avgSalary, setAvgSalary] = useState<number>(0);
  const [employeeCount, setEmployeeCount] = useState<number>(0);
  const [salaryGrowth, setSalaryGrowth] = useState<number>(0);

  // Dynamic expenses
  const [expenses, setExpenses] = useState<ExpenseItem[]>([
    {
      id: 1,
      name: "Website Hosting",
      amount: 1200,
      growth: 5,
      frequency: "annually",
      category: "Technology",
      type: "expense",
    },
  ]);

  // Revenue streams
  const [revenues, setRevenues] = useState<RevenueItem[]>([
    {
      id: 1,
      name: "Basic Plan",
      amount: 29,
      growth: 15,
      revenueType: "subscription",
      frequency: "monthly",
      category: "Subscriptions",
      clients: 100,
      type: "revenue",
    },
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
    runwayMonths: 0,
  });

  // Get the active user
  const { data: activeUser } = ActiveUser();
  const currentUser = activeUser?.[0];

  useEffect(() => {
    const loadValues = async () => {
      try {
        // Load expenses and revenues from the related tables
        const { data: expenseData, error: expenseError } = await supabase
          .from("cwa_expenses")
          .select("*");

        if (expenseError)
          console.error("Error loading expenses:", expenseError);
        else
          setExpenses(
            expenseData.map((e) => ({
              id: e.id,
              name: e.name,
              amount: e.amount,
              growth: e.growth,
              frequency: e.frequency,
              category: e.category,
              type: e.type,
            }))
          );

        const { data: revenueData, error: revenueError } = await supabase
          .from("cwa_revenues")
          .select("*");

        if (revenueError)
          console.error("Error loading revenues:", revenueError);
        else
          setRevenues(
            revenueData.map((r) => ({
              id: r.id,
              name: r.name,
              amount: r.amount,
              growth: r.growth,
              revenueType: r.revenueType,
              frequency: r.frequency,
              category: r.category,
              clients: r.clients,
              type: r.type,
            }))
          );
      } catch (err) {
        console.error("Error in loadLastActiveScenario:", err);
      }
    };

    loadValues();
  }, []);

  // Load the last active scenario when component mounts
  // useEffect(() => {
  //   const loadLastActiveScenario = async () => {
  //     if (!currentUser) return;

  //     try {
  //       // Fetch the most recently accessed scenario
  //       const { data, error } = await supabase
  //         .from("financial_scenarios")
  //         .select("*")
  //         .eq("user_id", currentUser.supa_id)
  //         .order("last_accessed", { ascending: false })
  //         .limit(1);

  //       if (error) {
  //         console.error("Error loading last scenario:", error);
  //         return;
  //       }

  //       // If a scenario exists, load it
  //       if (data && data.length > 0) {
  //         const scenario = data[0];
  //         setInitialCapital(scenario.initial_capital);
  //         setTaxRate(scenario.tax_rate);
  //         setInflationRate(scenario.inflation_rate);
  //         setYears(scenario.years);
  //         setAvgSalary(scenario.avg_salary);
  //         setEmployeeCount(scenario.employee_count);
  //         setSalaryGrowth(scenario.salary_growth);

  //         // Load expenses and revenues from the related tables
  //         const { data: expenseData, error: expenseError } = await supabase
  //           .from("financial_expenses")
  //           .select("*")
  //           .eq("scenario_id", scenario.id);

  //         if (expenseError)
  //           console.error("Error loading expenses:", expenseError);
  //         else
  //           setExpenses(
  //             expenseData.map((e) => ({
  //               id: e.id,
  //               name: e.name,
  //               amount: e.amount,
  //               growth: e.growth,
  //               frequency: e.frequency,
  //               category: e.category,
  //             }))
  //           );

  //         const { data: revenueData, error: revenueError } = await supabase
  //           .from("financial_revenues")
  //           .select("*")
  //           .eq("scenario_id", scenario.id);

  //         if (revenueError)
  //           console.error("Error loading revenues:", revenueError);
  //         else
  //           setRevenues(
  //             revenueData.map((r) => ({
  //               id: r.id,
  //               name: r.name,
  //               amount: r.amount,
  //               growth: r.growth,
  //               type: r.type,
  //               frequency: r.frequency,
  //               category: r.category,
  //               clients: r.clients,
  //             }))
  //           );
  //       }
  //     } catch (err) {
  //       console.error("Error in loadLastActiveScenario:", err);
  //     }
  //   };

  //   loadLastActiveScenario();
  // }, [activateScenario]);

  // Calculate projections when inputs change
  useEffect(() => {
    const loadCalcProps = async () => {
      const { data: calcData, error: calcError } = await supabase
        .from("cwa_calculatorProps")
        .select("*");
      if (calcError)
        console.log("Error fetching from CalcProps table", calcError.message);

      const {
        projections: calculatedProjections,
        financialMetrics: calculatedMetrics,
      } = calculateProjections(
        initialCapital,
        calcData![0].taxRate,
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
      console.log({ calcData })
    };
    loadCalcProps();
  }, [
    initialCapital,
    taxRate,
    inflationRate,
    years,
    avgSalary,
    employeeCount,
    salaryGrowth,
    expenses,
    revenues,
  ]);

  // Save the current scenario
  const saveCurrentScenario = (): ScenarioData => {
    const scenarioData = {
      id: "", // Will be filled by ScenarioManager
      name: "",
      description: "",
      date: new Date().toISOString(),
      initialCapital,
      taxRate,
      inflationRate,
      years,
      avgSalary,
      employeeCount,
      salaryGrowth,
      expenses,
      revenues,
    };

    return scenarioData;
  };

  // Load a saved scenario
  const loadScenario = (scenario: ScenarioData): void => {
    // Fetch scenarios data
    setActivateScenario(true);

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
    setMainTab("calculator");
  };

  return (
    <div className="min-h-screen bg-black text-gray-300 relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Main Navigation Tabs */}
        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
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
            {/* <TabsTrigger
              value="scenarios"
              className="px-6 py-3 rounded-none data-[state=active]:bg-red-900 data-[state=active]:text-white data-[state=active]:shadow-[0_0_10px_rgba(255,10,63,0.5)] transition-all duration-300"
            >
              <FileText size={16} className="mr-2" />
              SCENARIOS
            </TabsTrigger> */}
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
          {/* <TabsContent value="scenarios" className="mt-4">
            <ScenarioManager
              loadScenario={loadScenario}
              saveScenario={saveCurrentScenario}
            />
          </TabsContent> */}
        </Tabs>
      </div>
    </div>
  );
};

export default FinancialField;
