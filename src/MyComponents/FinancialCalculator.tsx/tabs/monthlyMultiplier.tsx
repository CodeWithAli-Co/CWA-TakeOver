import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/shadcnComponents/dropdown-menu';


// Simple expense/revenue item type
interface ProjectionItem {
  name: string;
  amount: number;
  type: 'expense' | 'revenue';
  months: number[];
  years: number[];
}

// Simple Monthly Projector Component
const SimpleProjector: React.FC = () => {
  const [items, setItems] = useState<ProjectionItem[]>([
    { 
      name: 'Website Subscription', 
      amount: 50, 
      type: 'expense',
      months: [], 
      years: [] 
    },
    { 
      name: 'Basic Plan Revenue', 
      amount: 129, 
      type: 'revenue',
      months: [], 
      years: [] 
    }
  ]);
  
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState(0);
  const [newType, setNewType] = useState<'expense' | 'revenue'>('expense');
  
  // Calculate the multiplier values for all months and years
  useEffect(() => {
    const updateItems = () => {
      setItems(prevItems => 
        prevItems.map(item => {
          const monthsData = Array.from({ length: 12 }, (_, i) => item.amount * (i + 1));
          const yearsData = Array.from({ length: 5 }, (_, i) => item.amount * 12 * (i + 1));
          
          return {
            ...item,
            months: monthsData,
            years: yearsData
          };
        })
      );
    };
    
    updateItems();
  }, [items.map(m => `${m.name}-${m.amount}`).join(',')]);
  
  // Add a new item
  const addItem = () => {
    if (newName && newAmount > 0) {
      const newItem = { 
        name: newName, 
        amount: newAmount,
        type: newType,
        months: [], 
        years: [] 
      };
      setItems([...items, newItem]);
      setNewName('');
      setNewAmount(0);
    }
  };
  
  // Delete an item
  const deleteItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };
  
  // Calculate net total (revenue - expenses)
  const calculateNet = () => {
    const totalExpenses = items
      .filter(item => item.type === 'expense')
      .reduce((sum, item) => sum + item.amount, 0);
    
    const totalRevenue = items
      .filter(item => item.type === 'revenue')
      .reduce((sum, item) => sum + item.amount, 0);
    
    return totalRevenue - totalExpenses;
  };
  
  // Generate chart data
  const chartData = [
    { month: 1, ...items.reduce((acc, item) => ({ ...acc, [item.name]: item.amount * 1 }), {}) },
    { month: 3, ...items.reduce((acc, item) => ({ ...acc, [item.name]: item.amount * 3 }), {}) },
    { month: 6, ...items.reduce((acc, item) => ({ ...acc, [item.name]: item.amount * 6 }), {}) },
    { month: 12, ...items.reduce((acc, item) => ({ ...acc, [item.name]: item.amount * 12 }), {}) },
    { month: 24, ...items.reduce((acc, item) => ({ ...acc, [item.name]: item.amount * 24 }), {}) },
    { month: 36, ...items.reduce((acc, item) => ({ ...acc, [item.name]: item.amount * 36 }), {}) },
    { month: 60, ...items.reduce((acc, item) => ({ ...acc, [item.name]: item.amount * 60 }), {}) }
  ];
  
  return (
    <div className="bg-black/40 border border-red-900 p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="mb-6">
            <h4 className="text-red-400 font-medium mb-3">Items</h4>
            
            {items.map((item, index) => (
              <div key={index} className={`bg-${item.type === 'expense' ? 'red' : 'green'}-950/10 border border-${item.type === 'expense' ? 'red' : 'green'}-900 p-3 mb-3 relative`}>
                <button 
                  onClick={() => deleteItem(index)}
                  className="absolute top-2 right-2 text-red-500 hover:text-red-300"
                >
                  ×
                </button>
                
                <div className="mb-2">
                  <label className={`text-xs text-${item.type === 'expense' ? 'red' : 'green'}-400`}>Name</label>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => {
                      const updated = [...items];
                      updated[index].name = e.target.value;
                      setItems(updated);
                    }}
                    className={`w-full bg-black border border-${item.type === 'expense' ? 'red' : 'green'}-900 p-2 text-${item.type === 'expense' ? 'red' : 'green'}-300 font-mono focus:outline-none focus:border-${item.type === 'expense' ? 'red' : 'green'}-600`}
                  />
                </div>
                
                <div>
                  <label className={`text-xs text-${item.type === 'expense' ? 'red' : 'green'}-400`}>
                    Monthly {item.type === 'expense' ? 'Amount' : 'Revenue'} ($)
                  </label>
                  <div className="flex">
                    <span className={`bg-${item.type === 'expense' ? 'red' : 'green'}-900/20 border-y border-l border-${item.type === 'expense' ? 'red' : 'green'}-900 px-2 flex items-center text-${item.type === 'expense' ? 'red' : 'green'}-400`}>$</span>
                    <input
                      type="number"
                      value={item.amount}
                      onChange={(e) => {
                        const updated = [...items];
                        updated[index].amount = Number(e.target.value);
                        setItems(updated);
                      }}
                      min={0}
                      className={`flex-1 bg-black border-y border-r border-${item.type === 'expense' ? 'red' : 'green'}-900 p-2 text-${item.type === 'expense' ? 'red' : 'green'}-300 font-mono focus:outline-none focus:border-${item.type === 'expense' ? 'red' : 'green'}-600`}
                    />
                  </div>
                </div>
              </div>
            ))}
            
            <div className="mt-4">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="col-span-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="New item name"
                    className="w-full bg-black border border-red-900 p-2 text-red-300 font-mono focus:outline-none focus:border-red-600"
                  />
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger className="bg-black border border-red-900 p-2 text-red-300 font-mono focus:outline-none focus:border-red-600 w-full text-left">
                    {newType === 'expense' ? 'Expense' : 'Revenue'}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-black border border-red-900">
                    <DropdownMenuItem 
                      className="text-red-300 hover:bg-red-900/20 focus:bg-red-900/20 cursor-pointer"
                      onClick={() => setNewType('expense')}
                    >
                      Expense
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-red-300 hover:bg-red-900/20 focus:bg-red-900/20 cursor-pointer"
                      onClick={() => setNewType('revenue')}
                    >
                      Revenue
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <div className="flex mb-3">
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
              
              <button
                onClick={addItem}
                disabled={!newName || newAmount <= 0}
                className="w-full bg-red-900/30 hover:bg-red-900/50 text-white py-2 border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Add Item
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-red-950/10 border border-red-900 p-3">
              <div className="text-xs text-red-400 mb-1">Total Expenses</div>
              <div className="text-xl font-bold text-white font-mono">
                ${items.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0)}
              </div>
              <div className="text-xs text-gray-500 mt-1">per month</div>
            </div>
            
            <div className="bg-green-950/10 border border-green-900 p-3">
              <div className="text-xs text-green-500 mb-1">Total Revenue</div>
              <div className="text-xl font-bold text-white font-mono">
                ${items.filter(item => item.type === 'revenue').reduce((sum, item) => sum + item.amount, 0)}
              </div>
              <div className="text-xs text-gray-500 mt-1">per month</div>
            </div>
            
            <div className={`${calculateNet() >= 0 ? 'bg-red-950/10 border border-red-900' : 'bg-red-950/10 border border-red-900'} p-3`}>
              <div className={`text-xs ${calculateNet() >= 0 ? 'text-red-400' : 'text-red-400'} mb-1`}>Net Total</div>
              <div className={`text-xl font-bold ${calculateNet() >= 0 ? 'text-red-400' : 'text-red-400'} font-mono`}>
                ${calculateNet()}
              </div>
              <div className="text-xs text-gray-500 mt-1">per month</div>
            </div>
          </div>
        </div>
        
        <div>
          {/* Combined Table */}
          <div className="mb-6">
            <h4 className="text-white font-medium mb-3">Financial Projection</h4>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs border-b border-red-900">
                  <tr>
                    <th className="py-2 text-red-300">Item</th>
                    <th className="py-2 text-red-300">6 Months</th>
                    <th className="py-2 text-red-300">1 Year</th>
                    <th className="py-2 text-red-300">3 Years</th>
                    <th className="py-2 text-red-300">5 Years</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Expense Items */}
                  {items.filter(item => item.type === 'expense').map((item, index) => (
                    <tr key={`expense-${index}`} className="border-b border-red-900/30">
                      <td className="py-2 text-red-300">{item.name}</td>
                      <td className="py-2 text-red-300">-${item.amount * 6}</td>
                      <td className="py-2 text-red-300">-${item.amount * 12}</td>
                      <td className="py-2 text-red-300">-${item.amount * 36}</td>
                      <td className="py-2 text-red-300">-${item.amount * 60}</td>
                    </tr>
                  ))}
                  
                  {/* Revenue Items */}
                  {items.filter(item => item.type === 'revenue').map((item, index) => (
                    <tr key={`revenue-${index}`} className="border-b border-green-900/30 ">
                      <td className="py-2 text-red-300">{item.name}</td>
                      <td className="py-2 text-red-300">${item.amount * 6}</td>
                      <td className="py-2 text-red-300">${item.amount * 12}</td>
                      <td className="py-2 text-red-300">${item.amount * 36}</td>
                      <td className="py-2 text-red-300">${item.amount * 60}</td>
                    </tr>
                  ))}
                  
                  {/* Net Total Row */}
                  {(() => {
                    const revenue6M = items.filter(item => item.type === 'revenue').reduce((sum, item) => sum + item.amount * 6, 0);
                    const expenses6M = items.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount * 6, 0);
                    const net6M = revenue6M - expenses6M;
                    
                    const revenue1Y = items.filter(item => item.type === 'revenue').reduce((sum, item) => sum + item.amount * 12, 0);
                    const expenses1Y = items.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount * 12, 0);
                    const net1Y = revenue1Y - expenses1Y;
                    
                    const revenue3Y = items.filter(item => item.type === 'revenue').reduce((sum, item) => sum + item.amount * 36, 0);
                    const expenses3Y = items.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount * 36, 0);
                    const net3Y = revenue3Y - expenses3Y;
                    
                    const revenue5Y = items.filter(item => item.type === 'revenue').reduce((sum, item) => sum + item.amount * 60, 0);
                    const expenses5Y = items.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount * 60, 0);
                    const net5Y = revenue5Y - expenses5Y;
                    
                    return (
                      <tr className="border-t-2 border-red-700 font-medium">
                        <td className="py-2 text-red-300">NET TOTAL</td>
                        <td className={`py-2 ${net6M >= 0 ? 'text-green-600/80' : 'text-red-300'}`}>
                          ${net6M}
                        </td>
                        <td className={`py-2 ${net1Y >= 0 ? 'text-green-600/80' : 'text-red-300'}`}>
                          ${net1Y}
                        </td>
                        <td className={`py-2 ${net3Y >= 0 ? 'text-green-600/80' : 'text-red-300'}`}>
                          ${net3Y}
                        </td>
                        <td className={`py-2 ${net5Y >= 0 ? 'text-green-600/80' : 'text-red-300'}`}>
                          ${net5Y}
                        </td>
                      </tr>
                    );
                  })()}
                  
                
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Visualization */}
          <div>
            <h4 className="text-red-400 font-medium mb-3 ">Visualization</h4>
            
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 10, 63, 0.15)" />
                  <XAxis 
                    dataKey="month" 
                    stroke="#ff0a3f80" 
                    tick={{ fill: '#ffffff', fontSize: 10 }}
                    label={{ value: 'Months', position: 'insideBottom', offset: -5, fill: '#ff0a3f' }}
                  />
                  <YAxis 
                    stroke="#ff0a3f80" 
                    tick={{ fill: '#ffffff', fontSize: 10 }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(0, 0, 0, 0.9)', 
                      borderColor: '#ff0a3f',
                      fontFamily: 'monospace'
                    }}
                    formatter={(value) => [`$${Number(value)}`, '']}
                  />
                  <Legend />
                  {items.map((item, index) => (
                    <Line 
                      key={index}
                      type="monotone" 
                      dataKey={item.name} 
                      stroke={item.type === 'expense' ? '#ff0a3f' : '#00e676'} 
                      dot={true}
                      
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleProjector;