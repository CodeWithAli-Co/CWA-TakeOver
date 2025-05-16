import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Download, ArrowUpCircle } from 'lucide-react';
import { ScenarioData, ScenarioManagerProps } from '@/stores/FinancialField';
import SectionHeader from '../sectionHeader';
import supabase from '@/MyComponents/supabase';
import { message } from '@tauri-apps/plugin-dialog';
import { ActiveUser } from '@/stores/query';

// Financial Scenario Manager Component
const ScenarioManager: React.FC<ScenarioManagerProps> = ({ loadScenario, saveScenario }) => {
  const [scenarios, setScenarios] = useState<ScenarioData[]>([]);
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioDesc, setScenarioDesc] = useState('');
  
  // Get the active user
  const { data: activeUser } = ActiveUser();
  const currentUser = activeUser?.[0];
  
  // Load saved scenarios on component mount
  useEffect(() => {
    const loadSavedScenarios = async () => {
      if (!currentUser) return;
      
      try {
        // Fetch all scenarios for the current user
        const { data, error } = await supabase
          .from('financial_scenarios')
          .select(`
            id, 
            name, 
            description, 
            created_at, 
            initial_capital, 
            tax_rate, 
            inflation_rate, 
            years, 
            avg_salary, 
            employee_count, 
            salary_growth
          `)
          .eq('user_id', currentUser.supa_id)
          .order('created_at', { ascending: false });
          
        if (error) {
          console.error('Error fetching scenarios:', error);
          return;
        }
        
        // For each scenario, get the associated expenses and revenues
        const scenariosWithDetails = await Promise.all(data.map(async (scenario) => {
          // Get expenses
          const { data: expenses, error: expensesError } = await supabase
            .from('financial_expenses')
            .select('*')
            .eq('scenario_id', scenario.id);
            
          if (expensesError) {
            console.error('Error fetching expenses:', expensesError);
            return null;
          }
          
          // Get revenues
          const { data: revenues, error: revenuesError } = await supabase
            .from('financial_revenues')
            .select('*')
            .eq('scenario_id', scenario.id);
            
          if (revenuesError) {
            console.error('Error fetching revenues:', revenuesError);
            return null;
          }
          
          // Convert to the expected format
          return {
            id: scenario.id,
            name: scenario.name,
            description: scenario.description,
            date: scenario.created_at,
            initialCapital: scenario.initial_capital,
            taxRate: scenario.tax_rate,
            inflationRate: scenario.inflation_rate,
            years: scenario.years,
            avgSalary: scenario.avg_salary,
            employeeCount: scenario.employee_count,
            salaryGrowth: scenario.salary_growth,
            expenses: expenses.map(e => ({
              id: e.id,
              name: e.name,
              amount: e.amount,
              growth: e.growth,
              frequency: e.frequency,
              category: e.category
            })),
            revenues: revenues.map(r => ({
              id: r.id,
              name: r.name,
              amount: r.amount,
              growth: r.growth,
              type: r.type,
              frequency: r.frequency,
              category: r.category,
              clients: r.clients
            }))
          };
        }));
        
        // Filter out any null results from errors
        const validScenarios = scenariosWithDetails.filter(s => s !== null) as ScenarioData[];
        setScenarios(validScenarios);
      } catch (err) {
        console.error('Error in loadSavedScenarios:', err);
      }
    };
    
    loadSavedScenarios();
    
    // Set up real-time subscription for scenarios
    const scenarioSubscription = supabase
      .channel('financial_scenarios_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'financial_scenarios' },
        () => loadSavedScenarios()
      )
      .subscribe();
      
    return () => {
      scenarioSubscription.unsubscribe();
    };
  }, [currentUser]);
  
  // Save current scenario
  const handleSaveScenario = async () => {
    if (!scenarioName || !currentUser) return;
    
    try {
      const newScenario = await saveScenario();
      
      // Insert the scenario into the financial_scenarios table
      const { data: scenarioData, error: scenarioError } = await supabase
        .from('financial_scenarios')
        .insert({
          user_id: currentUser.supa_id,
          name: scenarioName,
          description: scenarioDesc,
          created_at: new Date().toISOString(),
          last_accessed: new Date().toISOString(),
          initial_capital: newScenario.initialCapital,
          tax_rate: newScenario.taxRate,
          inflation_rate: newScenario.inflationRate,
          years: newScenario.years,
          avg_salary: newScenario.avgSalary,
          employee_count: newScenario.employeeCount,
          salary_growth: newScenario.salaryGrowth
        })
        .select()
        .single();
        
      if (scenarioError) {
        console.error('Error saving scenario:', scenarioError);
        await message('Error saving scenario: ' + scenarioError.message, {
          title: 'Save Error',
          kind: 'error'
        });
        return;
      }
      
      // Insert expenses
      if (newScenario.expenses.length > 0) {
        const expensesData = newScenario.expenses.map(expense => ({
          scenario_id: scenarioData.id,
          name: expense.name,
          amount: expense.amount,
          growth: expense.growth,
          frequency: expense.frequency,
          category: expense.category
        }));
        
        const { error: expensesError } = await supabase
          .from('financial_expenses')
          .insert(expensesData);
          
        if (expensesError) {
          console.error('Error saving expenses:', expensesError);
        }
      }
      
      // Insert revenues
      if (newScenario.revenues.length > 0) {
        const revenuesData = newScenario.revenues.map(revenue => ({
          scenario_id: scenarioData.id,
          name: revenue.name,
          amount: revenue.amount,
          growth: revenue.growth,
          type: revenue.type,
          frequency: revenue.frequency,
          category: revenue.category,
          clients: revenue.clients
        }));
        
        const { error: revenuesError } = await supabase
          .from('financial_revenues')
          .insert(revenuesData);
          
        if (revenuesError) {
          console.error('Error saving revenues:', revenuesError);
        }
      }
      
      // Reset form fields
      setScenarioName('');
      setScenarioDesc('');
      
      // Show success message
      await message('Scenario saved successfully', {
        title: 'Success',
        kind: 'info'
      });
    } catch (err) {
      console.error('Error in handleSaveScenario:', err);
      await message('An unexpected error occurred while saving', {
        title: 'Error',
        kind: 'error'
      });
    }
  };
  
  // Delete a scenario
  const deleteScenario = async (id: string) => {
    try {
      // First delete related expenses and revenues (due to foreign key constraints)
      const { error: expensesError } = await supabase
        .from('financial_expenses')
        .delete()
        .eq('scenario_id', id);
        
      if (expensesError) {
        console.error('Error deleting expenses:', expensesError);
      }
      
      const { error: revenuesError } = await supabase
        .from('financial_revenues')
        .delete()
        .eq('scenario_id', id);
        
      if (revenuesError) {
        console.error('Error deleting revenues:', revenuesError);
      }
      
      // Then delete the scenario
      const { error: scenarioError } = await supabase
        .from('financial_scenarios')
        .delete()
        .eq('id', id);
        
      if (scenarioError) {
        console.error('Error deleting scenario:', scenarioError);
        await message('Error deleting scenario: ' + scenarioError.message, {
          title: 'Delete Error',
          kind: 'error'
        });
        return;
      }
      
      // Update local state
      setScenarios(scenarios.filter(s => s.id !== id));
      
      // Show success message
      await message('Scenario deleted successfully', {
        title: 'Success',
        kind: 'info'
      });
    } catch (err) {
      console.error('Error in deleteScenario:', err);
      await message('An unexpected error occurred while deleting', {
        title: 'Error',
        kind: 'error'
      });
    }
  };
  
  // Export scenarios to JSON file
  const exportScenarios = () => {
    const dataStr = JSON.stringify(scenarios, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'finance_scenarios.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };
  
  // Import scenarios from JSON file
  const importScenarios = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string) as ScenarioData[];
        if (Array.isArray(importedData)) {
          // Insert each imported scenario
          for (const scenario of importedData) {
            // Insert the scenario first
            const { data: scenarioData, error: scenarioError } = await supabase
              .from('financial_scenarios')
              .insert({
                user_id: currentUser.supa_id,
                name: scenario.name,
                description: scenario.description,
                created_at: new Date().toISOString(),
                last_accessed: new Date().toISOString(),
                initial_capital: scenario.initialCapital,
                tax_rate: scenario.taxRate,
                inflation_rate: scenario.inflationRate,
                years: scenario.years,
                avg_salary: scenario.avgSalary,
                employee_count: scenario.employeeCount,
                salary_growth: scenario.salaryGrowth
              })
              .select()
              .single();
              
            if (scenarioError) {
              console.error('Error importing scenario:', scenarioError);
              continue;
            }
            
            // Insert expenses
            if (scenario.expenses.length > 0) {
              const expensesData = scenario.expenses.map(expense => ({
                scenario_id: scenarioData.id,
                name: expense.name,
                amount: expense.amount,
                growth: expense.growth,
                frequency: expense.frequency,
                category: expense.category
              }));
              
              await supabase
                .from('financial_expenses')
                .insert(expensesData);
            }
            
            // Insert revenues
            if (scenario.revenues.length > 0) {
              const revenuesData = scenario.revenues.map(revenue => ({
                scenario_id: scenarioData.id,
                name: revenue.name,
                amount: revenue.amount,
                growth: revenue.growth,
                type: revenue.type,
                frequency: revenue.frequency,
                category: revenue.category,
                clients: revenue.clients
              }));
              
              await supabase
                .from('financial_revenues')
                .insert(revenuesData);
            }
          }
          
          // Show success message
          await message('Scenarios imported successfully', {
            title: 'Success',
            kind: 'info'
          });
        }
      } catch (error) {
        console.error('Error importing scenarios:', error);
        await message('Error importing scenarios', {
          title: 'Import Error',
          kind: 'error'
        });
      }
    };
    reader.readAsText(file);
    
    // Reset the input
    e.target.value = '';
  };
  
  return (
    <div className="bg-black/40 border border-red-900 p-6">
      <SectionHeader
        icon={<Save className="text-red-500" size={18} />}
        title="Scenario Manager"
        subtitle="Save, load, and compare different financial scenarios"
      />
      
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-red-950/10 border border-red-900 p-4">
          <h4 className="text-red-400 font-medium mb-3">Save Current Scenario</h4>
          
          <div className="mb-3">
            <label className="text-xs text-red-400 mb-1 block">Scenario Name</label>
            <input
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="e.g., Optimistic Growth Plan"
              className="w-full bg-black border border-red-900 p-2 text-red-300 font-mono focus:outline-none focus:border-red-600"
            />
          </div>
          
          <div className="mb-3">
            <label className="text-xs text-red-400 mb-1 block">Description (optional)</label>
            <textarea
              value={scenarioDesc}
              onChange={(e) => setScenarioDesc(e.target.value)}
              placeholder="Add notes about this scenario..."
              rows={2}
              className="w-full bg-black border border-red-900 p-2 text-red-300 font-mono focus:outline-none focus:border-red-600"
            />
          </div>
          
          <button
            onClick={handleSaveScenario}
            disabled={!scenarioName}
            className="w-full bg-red-900/30 hover:bg-red-900/50 text-white py-2 border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Scenario
          </button>
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-red-400 font-medium">Saved Scenarios</h4>
            
            <div className="flex space-x-2">
              <button
                onClick={exportScenarios}
                disabled={scenarios.length === 0}
                className="bg-red-900/30 hover:bg-red-900/50 text-white px-3 py-1 text-xs border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <Download size={12} className="mr-1" />
                Export
              </button>
              
              <label className="bg-red-900/30 hover:bg-red-900/50 text-white px-3 py-1 text-xs border border-red-900 cursor-pointer flex items-center">
                <ArrowUpCircle size={12} className="mr-1" />
                Import
                <input
                  type="file"
                  accept=".json"
                  onChange={importScenarios}
                  className="hidden"
                />
              </label>
            </div>
          </div>
          
          {scenarios.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-red-900 text-red-600">
              No scenarios saved yet
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
              {scenarios.map((scenario) => (
                <motion.div
                  key={scenario.id}
                  className="bg-black border border-red-900 p-3 hover:bg-red-950/10"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-medium text-white">{scenario.name}</h5>
                      <p className="text-xs text-red-400 mt-1">{new Date(scenario.date).toLocaleDateString()}</p>
                      {scenario.description && (
                        <p className="text-xs text-gray-500 mt-1">{scenario.description}</p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="inline-block text-xs bg-red-900/20 border border-red-900 px-2 py-0.5">
                          ${scenario.initialCapital.toLocaleString()} Capital
                        </span>
                        <span className="inline-block text-xs bg-red-900/20 border border-red-900 px-2 py-0.5">
                          {scenario.years} Year{scenario.years !== 1 ? 's' : ''}
                        </span>
                        <span className="inline-block text-xs bg-red-900/20 border border-red-900 px-2 py-0.5">
                          {scenario.expenses.length} Expense{scenario.expenses.length !== 1 ? 's' : ''}
                        </span>
                        <span className="inline-block text-xs bg-red-900/20 border border-red-900 px-2 py-0.5">
                          {scenario.revenues.length} Revenue{scenario.revenues.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex">
                      <button
                        onClick={() => loadScenario(scenario)}
                        className="text-xs bg-black hover:bg-red-900/30 border border-red-900 px-2 py-1 mr-2"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => deleteScenario(scenario.id)}
                        className="text-xs text-red-500 hover:text-red-300"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScenarioManager;