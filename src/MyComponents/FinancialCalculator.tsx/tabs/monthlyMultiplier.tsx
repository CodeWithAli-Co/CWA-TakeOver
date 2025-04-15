import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MonthlyMultiplierData } from '@/stores/FinancialField';
import SectionHeader from '../sectionHeader';

// Monthly to Annual Calculator Component
const MonthlyMultiplier: React.FC = () => {
  const [multipliers, setMultipliers] = useState<MonthlyMultiplierData[]>([
    { name: 'Website Subscription', amount: 50, months: [], years: [] }
  ]);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState(0);
  
  // Calculate the multiplier values for all months and years
  useEffect(() => {
    const updateMultipliers = () => {
      setMultipliers(prevMultipliers => 
        prevMultipliers.map(item => {
          const monthsData = Array.from({ length: 12 }, (_, i) => item.amount * (i + 1));
          const yearsData = Array.from({ length: 10 }, (_, i) => item.amount * 12 * (i + 1));
          
          return {
            ...item,
            months: monthsData,
            years: yearsData
          };
        })
      );
    };
    
    updateMultipliers();
  }, [multipliers.map(m => m.amount).join(',')]); // Recalculate when amounts change
  
  // Add a new multiplier
  const addMultiplier = () => {
    if (newName && newAmount > 0) {
      const newItem = { 
        name: newName, 
        amount: newAmount,
        months: [], 
        years: [] 
      };
      setMultipliers([...multipliers, newItem]);
      setNewName('');
      setNewAmount(0);
    }
  };
  
  // Update an existing multiplier
  const updateMultiplier = (index: number, updates: Partial<MonthlyMultiplierData>) => {
    const updatedItems = [...multipliers];
    updatedItems[index] = { ...updatedItems[index], ...updates };
    setMultipliers(updatedItems);
  };
  
  // Delete a multiplier
  const deleteMultiplier = (index: number) => {
    setMultipliers(multipliers.filter((_, i) => i !== index));
  };
  
  return (
    <div className="bg-black/40 border border-red-900 p-6">
      <SectionHeader
        icon={<Calendar className="text-red-500" size={18} />}
        title="Monthly Cost Projector"
        subtitle="Calculate how monthly expenses accumulate over time"
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="mb-6">
            <h4 className="text-red-400 font-medium mb-3">Expenses</h4>
            
            {multipliers.map((item, index) => (
              <div key={index} className="bg-red-950/10 border border-red-900 p-3 mb-3 relative">
                <button 
                  onClick={() => deleteMultiplier(index)}
                  className="absolute top-2 right-2 text-red-500 hover:text-red-300"
                >
                  ×
                </button>
                
                <div className="mb-2">
                  <label className="text-xs text-red-400">Name</label>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateMultiplier(index, { name: e.target.value })}
                    className="w-full bg-black border border-red-900 p-2 text-red-300 font-mono focus:outline-none focus:border-red-600"
                  />
                </div>
                
                <div>
                  <label className="text-xs text-red-400">Monthly Amount ($)</label>
                  <div className="flex">
                    <span className="bg-red-900/20 border-y border-l border-red-900 px-2 flex items-center text-red-400">$</span>
                    <input
                      type="number"
                      value={item.amount}
                      onChange={(e) => updateMultiplier(index, { amount: Number(e.target.value) })}
                      min={0}
                      className="flex-1 bg-black border-y border-r border-red-900 p-2 text-red-300 font-mono focus:outline-none focus:border-red-600"
                    />
                  </div>
                </div>
              </div>
            ))}
            
            <div className="mt-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New expense name"
                  className="bg-black border border-red-900 p-2 text-red-300 font-mono focus:outline-none focus:border-red-600"
                />
                
                <div className="flex">
                  <span className="bg-red-900/20 border-y border-l border-red-900 px-2 flex items-center text-red-400">$</span>
                  <input
                    type="number"
                    value={newAmount || ''}
                    onChange={(e) => setNewAmount(Number(e.target.value))}
                    min={0}
                    placeholder="Amount"
                    className="flex-1 bg-black border-y border-r border-red-900 p-2 text-red-300 font-mono focus:outline-none focus:border-red-600"
                  />
                </div>
              </div>
              
              <button
                onClick={addMultiplier}
                disabled={!newName || newAmount <= 0}
                className="w-full bg-red-900/30 hover:bg-red-900/50 text-white py-2 border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Add Expense
              </button>
            </div>
          </div>
        </div>
        
        <div className="bg-black/30 border border-red-900 p-4">
          <h4 className="text-red-400 font-medium mb-3">Accumulated Costs</h4>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-red-300">
              <thead className="text-xs border-b border-red-900">
                <tr>
                  <th className="py-2">Item</th>
                  <th className="py-2">Monthly</th>
                  <th className="py-2">6 Months</th>
                  <th className="py-2">1 Year</th>
                  <th className="py-2">3 Years</th>
                  <th className="py-2">5 Years</th>
                </tr>
              </thead>
              <tbody>
                {multipliers.map((item, index) => (
                  <tr key={index} className="border-b border-red-900/50">
                    <td className="py-2">{item.name}</td>
                    <td className="py-2">${item.amount}</td>
                    <td className="py-2">${(item.amount * 6).toLocaleString()}</td>
                    <td className="py-2">${(item.amount * 12).toLocaleString()}</td>
                    <td className="py-2">${(item.amount * 36).toLocaleString()}</td>
                    <td className="py-2">${(item.amount * 60).toLocaleString()}</td>
                  </tr>
                ))}
                
                {multipliers.length > 1 && (
                  <tr className="border-t-2 border-red-700 font-medium">
                    <td className="py-2">TOTAL</td>
                    <td className="py-2">
                      ${multipliers.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}
                    </td>
                    <td className="py-2">
                      ${multipliers.reduce((sum, item) => sum + item.amount * 6, 0).toLocaleString()}
                    </td>
                    <td className="py-2">
                      ${multipliers.reduce((sum, item) => sum + item.amount * 12, 0).toLocaleString()}
                    </td>
                    <td className="py-2">
                      ${multipliers.reduce((sum, item) => sum + item.amount * 36, 0).toLocaleString()}
                    </td>
                    <td className="py-2">
                      ${multipliers.reduce((sum, item) => sum + item.amount * 60, 0).toLocaleString()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {multipliers.length > 0 && (
            <div className="mt-4">
              <h5 className="text-xs text-red-400 mb-2">Visualization</h5>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[
                      { month: 1, ...multipliers.reduce((acc, item) => ({ ...acc, [item.name]: item.amount * 1, total: (acc.total || 0) + item.amount * 1 }), {}) },
                      { month: 3, ...multipliers.reduce((acc, item) => ({ ...acc, [item.name]: item.amount * 3, total: (acc.total || 0) + item.amount * 3 }), {}) },
                      { month: 6, ...multipliers.reduce((acc, item) => ({ ...acc, [item.name]: item.amount * 6, total: (acc.total || 0) + item.amount * 6 }), {}) },
                      { month: 12, ...multipliers.reduce((acc, item) => ({ ...acc, [item.name]: item.amount * 12, total: (acc.total || 0) + item.amount * 12 }), {}) },
                      { month: 24, ...multipliers.reduce((acc, item) => ({ ...acc, [item.name]: item.amount * 24, total: (acc.total || 0) + item.amount * 24 }), {}) },
                      { month: 36, ...multipliers.reduce((acc, item) => ({ ...acc, [item.name]: item.amount * 36, total: (acc.total || 0) + item.amount * 36 }), {}) },
                      { month: 60, ...multipliers.reduce((acc, item) => ({ ...acc, [item.name]: item.amount * 60, total: (acc.total || 0) + item.amount * 60 }), {}) }
                    ]}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 10, 63, 0.15)" />
                    <XAxis 
                      dataKey="month" 
                      stroke="#ff0a3f80" 
                      tick={{ fill: '#ff0a3f', fontSize: 10 }}
                      label={{ value: 'Months', position: 'insideBottom', offset: -5, fill: '#ff0a3f' }}
                    />
                    <YAxis 
                      stroke="#ff0a3f80" 
                      tick={{ fill: '#ff0a3f', fontSize: 10 }}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(0, 0, 0, 0.9)', 
                        borderColor: '#ff0a3f',
                        fontFamily: 'monospace'
                      }}
                    />
                    <Legend />
                    {multipliers.map((item, index) => (
                      <Line 
                        key={index}
                        type="monotone" 
                        dataKey={item.name} 
                        stroke={`hsl(${index * 30}, 80%, 60%)`} 
                        dot={true}
                      />
                    ))}
                    {multipliers.length > 1 && (
                      <Line 
                        type="monotone" 
                        dataKey="total" 
                        stroke="#ffffff" 
                        strokeWidth={2}
                        dot={true}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonthlyMultiplier;