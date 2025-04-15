import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Download, ArrowUpCircle } from 'lucide-react';
import { ScenarioData, ScenarioManagerProps } from '@/stores/FinancialField';
import SectionHeader from '../sectionHeader';


// Financial Scenario Manager Component
const ScenarioManager: React.FC<ScenarioManagerProps> = ({ loadScenario, saveScenario }) => {
  const [scenarios, setScenarios] = useState<ScenarioData[]>([]);
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioDesc, setScenarioDesc] = useState('');
  
  // Load saved scenarios on component mount
  useEffect(() => {
    const savedScenarios = localStorage.getItem('financePrince_scenarios');
    if (savedScenarios) {
      try {
        setScenarios(JSON.parse(savedScenarios));
      } catch (e) {
        console.error('Error loading scenarios:', e);
      }
    }
  }, []);
  
  // Save scenarios to localStorage when updated
  useEffect(() => {
    if (scenarios.length > 0) {
      localStorage.setItem('financePrince_scenarios', JSON.stringify(scenarios));
    }
  }, [scenarios]);
  
  // Save current scenario
  const handleSaveScenario = () => {
    if (!scenarioName) return;
    
    const newScenario = saveScenario();
    newScenario.name = scenarioName;
    newScenario.description = scenarioDesc;
    newScenario.date = new Date().toISOString();
    
    // Check if this is an update to existing scenario
    const existingIndex = scenarios.findIndex(s => s.id === newScenario.id);
    
    if (existingIndex >= 0) {
      // Update existing
      const updatedScenarios = [...scenarios];
      updatedScenarios[existingIndex] = newScenario;
      setScenarios(updatedScenarios);
    } else {
      // Add new with unique ID
      newScenario.id = Date.now().toString();
      setScenarios([...scenarios, newScenario]);
    }
    
    setScenarioName('');
    setScenarioDesc('');
  };
  
  // Delete a scenario
  const deleteScenario = (id: string) => {
    setScenarios(scenarios.filter(s => s.id !== id));
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
  const importScenarios = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (Array.isArray(importedData)) {
          setScenarios([...scenarios, ...importedData]);
        }
      } catch (error) {
        console.error('Error importing scenarios:', error);
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