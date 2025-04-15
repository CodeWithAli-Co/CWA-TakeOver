import { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, ComposedChart, Scatter,
  PieChart,
  Pie,
  Cell,
  ReferenceLine
} from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calculator, TrendingUp, DollarSign, Users, Server, Clock, 
  PieChart as PieChartIcon, Zap, Settings, Sliders, Calendar,
  FileText, BarChart2, HelpCircle, Percent, Download, Save, ArrowUpCircle,
  ChevronDown, ChevronRight, CircleDollarSign, Share2, Home, CreditCard, Briefcase
} from "lucide-react";
import { motion } from "framer-motion";

// Type definitions
interface ExpenseItem {
  id: number;
  name: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'annually' | 'one-time';
  growth: number;
  category: string;
  yearlyAmount?: number;
}

interface RevenueItem {
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

interface ExpenseBreakdown {
  [key: string]: number;
}

interface RevenueBreakdown {
  [key: string]: number;
}

interface ProjectionData {
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
  roi?: number;
  [key: string]: any; // For dynamic expense and revenue keys
}

interface MonthlyMultiplierData {
  name: string;
  amount: number;
  months: number[];
  years: number[];
}

interface FinancialMetrics {
  cagr: number;
  breakEvenYear: number | null;
  roi: number;
  finalCashFlow: number;
  totalProfit: number;
  profitMargin: number;
  employeeCostRatio: number;
  runwayMonths: number;
}

interface ScenarioData {
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

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

// Predefined expense categories
const EXPENSE_CATEGORIES = [
  'Technology', 'Office', 'Marketing', 'Legal', 'Administrative', 
  'Software', 'Hardware', 'Rent', 'Utilities', 'Insurance', 'Other'
];

// Predefined revenue categories
const REVENUE_CATEGORIES = [
  'Product Sales', 'Services', 'Consulting', 'Subscriptions', 
  'Licensing', 'Advertising', 'Partnerships', 'Other'
];

// Chart color palettes
const EXPENSE_COLORS = {
  'Technology': '#ff5252',
  'Office': '#ff7b52',
  'Marketing': '#ffa352',
  'Legal': '#ffcb52',
  'Administrative': '#ffe552',
  'Software': '#d6ff52',
  'Hardware': '#a3ff52',
  'Rent': '#52ff7b',
  'Utilities': '#52ffd6',
  'Insurance': '#52cbff',
  'Other': '#527bff',
  'Employee Costs': '#c952ff'
};

const REVENUE_COLORS = {
  'Product Sales': '#00e676',
  'Services': '#00e6aa',
  'Consulting': '#00e6e6',
  'Subscriptions': '#00aae6',
  'Licensing': '#0076e6',
  'Advertising': '#4300e6',
  'Partnerships': '#7600e6',
  'Other': '#aa00e6'
};

// Custom Tooltip component for financial charts
const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip bg-black bg-opacity-90 border border-red-700 p-3 shadow-lg text-xs font-mono">
        <p className="text-red-500 font-bold">{`Year: ${label}`}</p>
        {payload.map((entry, index) => (
          <p key={`item-${index}`} style={{ color: entry.color }}>
            {`${entry.name}: $${entry.value.toLocaleString()}`}
          </p>
        ))}
      </div>
    );
  }

  return null;
};

// Section Header Component
const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}> = ({ icon, title, subtitle }) => (
  <div className="mb-6">
    <div className="flex items-center text-lg font-bold text-white">
      {icon}
      <span className="ml-2">{title}</span>
    </div>
    {subtitle && <p className="text-sm text-red-400 font-mono mt-1">{subtitle}</p>}
  </div>
);

// Generic numerical input field
const NumericField: React.FC<{
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
}> = ({ 
  label, value, onChange, icon: Icon, description, 
  prefix = '', suffix = '', min = 0, max = 1000000000, step = 1,
  className = ''
}) => (
  <div className={`mb-4 ${className}`}>
    <label className="flex items-center text-sm text-red-400 mb-1 space-x-2">
      <Icon size={16} className="text-red-500" />
      <span>{label}</span>
    </label>
    {description && <p className="text-xs text-red-600 mb-2 ml-6">{description}</p>}
    <div className="flex">
      {prefix && (
        <span className="bg-red-900/20 border-y border-l border-red-900 px-2 flex items-center text-red-400">
          {prefix}
        </span>
      )}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="flex-1 bg-black border-y border-red-900 p-2 text-red-300 font-mono focus:outline-none focus:border-red-600"
      />
      {suffix && (
        <span className="bg-red-900/20 border-y border-r border-red-900 px-2 flex items-center text-red-400">
          {suffix}
        </span>
      )}
    </div>
  </div>
);

// Growth rate field with slider
const GrowthRateField: React.FC<{
  label: string;
  value: number;
  onChange: (value: number) => void;
  icon: React.ElementType;
  description?: string;
  min?: number;
  max?: number;
  className?: string;
}> = ({ 
  label, value, onChange, icon: Icon, description, min = -20, max = 50, className = ''
}) => (
  <div className={`mb-4 ${className}`}>
    <label className="flex items-center text-sm text-red-400 mb-1 space-x-2">
      <Icon size={16} className="text-red-500" />
      <span>{label}</span>
      <span className="ml-auto text-red-300 font-mono">{value}%</span>
    </label>
    {description && <p className="text-xs text-red-600 mb-2 ml-6">{description}</p>}
    <input
      type="range"
      min={min}
      max={max}
      step="0.5"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-red-500 bg-red-900/20 h-2 rounded-lg appearance-none cursor-pointer"
    />
    <div className="flex justify-between text-xs text-red-700 mt-1">
      <span>{min}%</span>
      <span>0%</span>
      <span>+{max}%</span>
    </div>
  </div>
);

// Year selector component
const YearSelector: React.FC<{
  years: number;
  setYears: (years: number) => void;
}> = ({ years, setYears }) => (
  <div className="mb-6 bg-red-950/20 p-4 border border-red-900">
    <label className="flex items-center text-sm text-red-400 mb-3 space-x-2">
      <Clock size={16} className="text-red-500" />
      <span>Projection Timeframe</span>
      <span className="ml-auto text-red-300 font-mono">{years} years</span>
    </label>
    <input
      type="range"
      min="1"
      max="20"
      value={years}
      onChange={(e) => setYears(Number(e.target.value))}
      className="w-full accent-red-500 bg-red-900/20 h-2 rounded-lg appearance-none cursor-pointer"
    />
    <div className="flex justify-between text-xs text-red-700 mt-1">
      <span>1yr</span>
      <span>5yrs</span>
      <span>10yrs</span>
      <span>20yrs</span>
    </div>
    
    <div className="flex mt-4 space-x-2">
      {[1, 3, 5, 10, 20].map(year => (
        <button
          key={year}
          onClick={() => setYears(year)}
          className={`px-3 py-1 text-xs font-mono border ${
            years === year 
              ? 'bg-red-900 text-white border-red-700' 
              : 'bg-black border-red-900 text-red-500 hover:bg-red-900/20'
          }`}
        >
          {year}yr
        </button>
      ))}
    </div>
  </div>
);

// Expense/Revenue item component with delete capability
const DynamicItem: React.FC<{
  item: ExpenseItem | RevenueItem;
  onChange: (item: ExpenseItem | RevenueItem) => void;
  onDelete: () => void;
  type: 'expense' | 'revenue';
  categories: string[];
}> = ({ item, onChange, onDelete, type, categories }) => {
  const Icon = type === 'expense' ? DollarSign : TrendingUp;
  const borderColor = type === 'expense' ? 'border-red-900' : 'border-green-900';
  const bgColor = type === 'expense' ? 'bg-red-950/10' : 'bg-green-950/10';
  
  // Calculate annual amount based on frequency
  const calculateAnnualAmount = (amount: number, frequency: string): number => {
    switch (frequency) {
      case 'monthly':
        return amount * 12;
      case 'quarterly':
        return amount * 4;
      case 'annually':
        return amount;
      case 'one-time':
        return amount;
      default:
        return amount;
    }
  };

  // Update item and recalculate annual amount
  const updateItem = (updates: Partial<ExpenseItem | RevenueItem>) => {
    const updatedItem = { ...item, ...updates };
    
    // If amount or frequency changed, recalculate
    if ('amount' in updates || 'frequency' in updates) {
      const annual = calculateAnnualAmount(
        updatedItem.amount,
        updatedItem.frequency
      );
      // This is just for display - actual calculations use more complex logic
      onChange({ ...updatedItem, yearlyAmount: annual });
    } else {
      onChange(updatedItem);
    }
  };
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mb-4 p-4 ${bgColor} border ${borderColor} relative`}
    >
      <button 
        onClick={onDelete} 
        className="absolute top-2 right-2 text-red-500 hover:text-red-300"
        aria-label="Delete item"
      >
        ×
      </button>
      
      <div className="mb-3">
        <label className="text-xs text-red-400">Name</label>
        <input
          type="text"
          value={item.name}
          onChange={(e) => updateItem({ name: e.target.value })}
          className="w-full bg-black border border-red-900 p-2 text-red-300 font-mono focus:outline-none focus:border-red-600"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-red-400">Amount ($)</label>
          <div className="flex">
            <span className="bg-red-900/20 border-y border-l border-red-900 px-2 flex items-center text-red-400">$</span>
            <input
              type="number"
              value={item.amount}
              onChange={(e) => updateItem({ amount: Number(e.target.value) })}
              min={0}
              className="flex-1 bg-black border-y border-r border-red-900 p-2 text-red-300 font-mono focus:outline-none focus:border-red-600"
            />
          </div>
        </div>
        
        <div>
          <label className="text-xs text-red-400">Annual Growth (%)</label>
          <div className="flex">
            <input
              type="number"
              value={item.growth}
              onChange={(e) => updateItem({ growth: Number(e.target.value) })}
              min={-100}
              max={100}
              step={0.5}
              className="flex-1 bg-black border border-red-900 p-2 text-red-300 font-mono focus:outline-none focus:border-red-600"
            />
            <span className="bg-red-900/20 border-y border-r border-red-900 px-2 flex items-center text-red-400">%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <label className="text-xs text-red-400">Frequency</label>
          <select
            value={item.frequency}
            onChange={(e) => updateItem({ frequency: e.target.value as 'monthly' | 'quarterly' | 'annually' | 'one-time' })}
            className="w-full bg-black border border-red-900 p-2 text-red-300 font-mono focus:outline-none focus:border-red-600"
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annually">Annually</option>
            <option value="one-time">One-time</option>
          </select>
        </div>
        
        <div>
          <label className="text-xs text-red-400">Category</label>
          <select
            value={item.category}
            onChange={(e) => updateItem({ category: e.target.value })}
            className="w-full bg-black border border-red-900 p-2 text-red-300 font-mono focus:outline-none focus:border-red-600"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {type === 'revenue' && 'type' in item && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="text-xs text-red-400">Revenue Type</label>
            <select
              value={item.type}
              onChange={(e) => updateItem({ type: e.target.value as 'one-time' | 'recurring' | 'subscription' })}
              className="w-full bg-black border border-red-900 p-2 text-red-300 font-mono focus:outline-none focus:border-red-600"
            >
              <option value="one-time">One-time</option>
              <option value="recurring">Recurring</option>
              <option value="subscription">Subscription</option>
            </select>
          </div>
          
          <div>
            <label className="text-xs text-red-400">Est. Clients/Users</label>
            <input
              type="number"
              value={(item as RevenueItem).clients}
              onChange={(e) => updateItem({ clients: Number(e.target.value) })}
              min={0}
              className="w-full bg-black border border-red-900 p-2 text-red-300 font-mono focus:outline-none focus:border-red-600"
            />
          </div>
        </div>
      )}

      <div className="mt-3 text-xs text-right">
        <span className="text-gray-500">Annual equivalent:</span> 
        <span className="text-red-400 ml-2 font-mono">
          ${calculateAnnualAmount(item.amount, item.frequency).toLocaleString()}
        </span>
      </div>
    </motion.div>
  );
};

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

// Financial Scenario Manager Component
const ScenarioManager: React.FC<{
  loadScenario: (scenario: ScenarioData) => void;
  saveScenario: () => ScenarioData;
}> = ({ loadScenario, saveScenario }) => {
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

export const FinancialProjector: React.FC = () => {
  // Main Navigation Tabs
  const [mainTab, setMainTab] = useState<string>('calculator');
  
  // Sub tabs for calculator section
  const [calcSubTab, setCalcSubTab] = useState<string>('basic');
  
  // Sub tabs for visualization section
  const [vizSubTab, setVizSubTab] = useState<string>('summary');
  
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
  
  // Calculate annual amount based on frequency
  const calculateAnnualAmount = (item: ExpenseItem | RevenueItem): number => {
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
    if ('clients' in item && (item.type === 'subscription' || item.type === 'recurring')) {
      base *= item.clients;
    }
    
    return base;
  };
  
  // Calculate projections when inputs change
  useEffect(() => {
    const calculateProjections = (): void => {
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
          const growthFactor = revenue.type === 'one-time' 
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
        const expenseBreakdown: ExpenseBreakdown = {};
        yearlyExpenses.forEach(exp => {
          if (exp.yearlyAmount !== undefined) {
            expenseBreakdown[exp.name] = exp.yearlyAmount;
          }
        });
        expenseBreakdown['Employee Costs'] = employeeCost;
        
        const revenueBreakdown: RevenueBreakdown = {};
        yearlyRevenues.forEach(rev => {
          if (rev.yearlyAmount !== undefined) {
            revenueBreakdown[rev.name] = rev.yearlyAmount;
          }
        });
        
        // Category breakdowns
        const expenseCategories: ExpenseBreakdown = {};
        yearlyExpenses.forEach(exp => {
          if (exp.yearlyAmount !== undefined) {
            const category = exp.category || 'Other';
            expenseCategories[category] = (expenseCategories[category] || 0) + exp.yearlyAmount;
          }
        });
        expenseCategories['Employee Costs'] = employeeCost;
        
        const revenueCategories: RevenueBreakdown = {};
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
      
      // Set projected data
      setProjections(yearlyData);
      
      // Calculate financial metrics
      if (yearlyData.length > 1) {
        const lastYearData = yearlyData[yearlyData.length - 1];
        const firstYearData = yearlyData[1]; // Year 1 (not 0)
        
        // Calculate CAGR (Compound Annual Growth Rate) for revenue
        const cagr = (Math.pow(lastYearData.totalRevenue / firstYearData.totalRevenue, 1 / (years - 1)) - 1) * 100;
        
        // Break-even point (where cumulative profit becomes positive)
        let breakEvenYear: number | null = null;
        for (let i = 1; i < yearlyData.length; i++) {
          if (yearlyData[i].cumulativeProfit > 0 && (breakEvenYear === null || breakEvenYear > i)) {
            breakEvenYear = i;
          }
        }
        
        // Calculate ROI (Return on Investment)
        const roi = (lastYearData.cumulativeProfit / initialCapital) * 100;
        
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
        setFinancialMetrics({
          cagr: isNaN(cagr) ? 0 : cagr,
          breakEvenYear,
          roi: isNaN(roi) ? 0 : roi,
          finalCashFlow: lastYearData.cashFlow,
          totalProfit: lastYearData.cumulativeProfit,
          profitMargin: isNaN(profitMargin) ? 0 : profitMargin,
          employeeCostRatio: isNaN(employeeCostRatio) ? 0 : employeeCostRatio,
          runwayMonths: isNaN(runwayMonths) ? 0 : runwayMonths
        });
      }
    };
    
    calculateProjections();
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
  
  // Get color for expense/revenue categories
  const getCategoryColor = (category: string, isExpense: boolean): string => {
    if (isExpense) {
      return EXPENSE_COLORS[category] || '#ff0a3f';
    } else {
      return REVENUE_COLORS[category] || '#00ff9f';
    }
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
                            <div className="h-40">
                              {/* <ResponsiveContainer width="100%" height="100%">
                        
<PieChart>
  <Pie
    data={pieData}
    cx="50%"
    cy="50%"
    labelLine={true}
    outerRadius={100}
    fill="#8884d8"
    dataKey="value"
    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
  >
   
  </Pie>
  <Tooltip />
</PieChart>
                              </ResponsiveContainer> */}
                            </div>
                            
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
                            + ${avgSalary * employeeCount.toLocaleString()} in employee costs
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
          </TabsContent>

          {/* Projections Visualizer Tab */}
          <TabsContent value="visualizer" className="mt-4">
            <div className="backdrop-blur-lg bg-black bg-opacity-40 border border-red-900 p-8 shadow-[0_0_30px_rgba(0,0,0,0.3)]">
              <div className="text-xl font-bold text-white mb-2 flex items-center">
                <PieChartIcon className="mr-2 text-red-500" size={20} />
                Financial Neural Network Analysis
              </div>
              <div className="text-sm text-red-400 mb-8 font-mono">Quantum probability matrix of business outcomes</div>

              {/* Sub Tabs for Visualizer */}
              <Tabs 
                value={vizSubTab} 
                onValueChange={setVizSubTab}
                className="mb-6"
              >
                <TabsList className="p-1 bg-red-950/20 border border-red-900 mb-4">
                  <TabsTrigger 
                    value="summary" 
                    className="px-4 py-2 data-[state=active]:bg-red-900/40"
                  >
                    <BarChart2 size={14} className="mr-2" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger 
                    value="cashflow" 
                    className="px-4 py-2 data-[state=active]:bg-red-900/40"
                  >
                    <DollarSign size={14} className="mr-2" />
                    Cash Flow
                  </TabsTrigger>
                  <TabsTrigger 
                    value="expenses" 
                    className="px-4 py-2 data-[state=active]:bg-red-900/40"
                  >
                    <CreditCard size={14} className="mr-2" />
                    Expenses
                  </TabsTrigger>
                  <TabsTrigger 
                    value="revenue" 
                    className="px-4 py-2 data-[state=active]:bg-red-900/40"
                  >
                    <Zap size={14} className="mr-2" />
                    Revenue
                  </TabsTrigger>
                  <TabsTrigger 
                    value="data" 
                    className="px-4 py-2 data-[state=active]:bg-red-900/40"
                  >
                    <Server size={14} className="mr-2" />
                    Data Table
                  </TabsTrigger>
                </TabsList>

                {/* Financial Metrics Summary - shown at the top of all tabs */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
                  <div className="backdrop-blur-sm bg-black bg-opacity-70 border border-red-900 p-4 text-center">
                    <div className="text-sm text-red-400 mb-1">Revenue CAGR</div>
                    <div className="text-2xl font-bold text-white">{financialMetrics.cagr?.toFixed(1)}%</div>
                  </div>
                  
                  <div className="backdrop-blur-sm bg-black bg-opacity-70 border border-red-900 p-4 text-center">
                    <div className="text-sm text-red-400 mb-1">Break Even</div>
                    <div className="text-2xl font-bold text-white">Year {financialMetrics.breakEvenYear || 'N/A'}</div>
                  </div>
                  
                  <div className="backdrop-blur-sm bg-black bg-opacity-70 border border-red-900 p-4 text-center">
                    <div className="text-sm text-red-400 mb-1">ROI</div>
                    <div className="text-2xl font-bold text-white">{financialMetrics.roi?.toFixed(1)}%</div>
                  </div>
                  
                  <div className="backdrop-blur-sm bg-black bg-opacity-70 border border-red-900 p-4 text-center">
                    <div className="text-sm text-red-400 mb-1">Final Cash Flow</div>
                    <div className="text-2xl font-bold text-white">${financialMetrics.finalCashFlow?.toLocaleString()}</div>
                  </div>
                  
                  <div className="backdrop-blur-sm bg-black bg-opacity-70 border border-red-900 p-4 text-center">
                    <div className="text-sm text-red-400 mb-1">Total Profit</div>
                    <div className="text-2xl font-bold text-white">${financialMetrics.totalProfit?.toLocaleString()}</div>
                  </div>
                </div>
                
                {/* Overview Tab */}
                <TabsContent value="summary" className="mt-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    {/* Revenue vs Expenses Chart */}
                    <div className="backdrop-blur-sm bg-black bg-opacity-70 border border-red-900 p-6">
                      <h3 className="text-lg font-bold text-white mb-6 flex items-center">
                        <TrendingUp size={18} className="mr-2 text-red-500" />
                        Revenue vs Expenses
                      </h3>
                      
                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart
                            data={projections}
                            margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 10, 63, 0.15)" />
                            <XAxis 
                              dataKey="year" 
                              stroke="#ff0a3f80" 
                              tickLine={false} 
                              axisLine={false} 
                              tick={{ fill: '#ff0a3f', fontSize: 12 }}
                            />
                            <YAxis 
                              stroke="#ff0a3f80" 
                              tickLine={false} 
                              axisLine={false} 
                              tick={{ fill: '#ff0a3f', fontSize: 12 }}
                              tickFormatter={(value) => `$${value / 1000}k`}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend 
                              wrapperStyle={{ color: '#ff0a3f', paddingTop: '15px' }} 
                              formatter={(value) => <span style={{ color: '#ff0a3f', fontFamily: 'monospace' }}>{value.toUpperCase()}</span>}
                            />
                            <Bar dataKey="totalRevenue" name="Revenue" fill="#00ff9f" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="totalExpenses" name="Expenses" fill="#ff0a3f" radius={[4, 4, 0, 0]} />
                            <Line type="monotone" dataKey="netProfit" name="Net Profit" stroke="#ffffff" strokeWidth={2} dot={{ fill: '#ffffff', r: 4 }} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    
                    {/* Profit Margin Trend */}
                    <div className="backdrop-blur-sm bg-black bg-opacity-70 border border-red-900 p-6">
                      <h3 className="text-lg font-bold text-white mb-6 flex items-center">
                        <Percent size={18} className="mr-2 text-red-500" />
                        Profit Margin Trend
                      </h3>
                      
                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={projections.map(year => ({
                              year: year.year,
                              profitMargin: year.totalRevenue > 0 
                                ? (year.netProfit / year.totalRevenue) * 100 
                                : 0
                            }))}
                            margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 10, 63, 0.15)" />
                            <XAxis 
                              dataKey="year" 
                              stroke="#ff0a3f80" 
                              tickLine={false} 
                              axisLine={false} 
                              tick={{ fill: '#ff0a3f', fontSize: 12 }}
                            />
                            <YAxis 
                              stroke="#ff0a3f80" 
                              tickLine={false} 
                              axisLine={false} 
                              tick={{ fill: '#ff0a3f', fontSize: 12 }}
                              tickFormatter={(value) => `${value}%`}
                            />
                            <Tooltip 
                              formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Profit Margin']}
                            />
                            <Legend />
                            <Line 
                              type="monotone" 
                              dataKey="profitMargin" 
                              name="Profit Margin" 
                              stroke="#00ff9f" 
                              strokeWidth={2}
                              dot={{ fill: '#00ff9f', r: 4 }}
                              activeDot={{ r: 8 }}
                            />
                            <ReferenceLine y={0} stroke="red" strokeDasharray="3 3" />
                            <ReferenceLine 
                              y={10} 
                              stroke="rgba(255, 255, 255, 0.3)" 
                              strokeDasharray="3 3" 
                              label={{ value: '10% - Break-even', position: 'right', fill: 'rgba(255, 255, 255, 0.5)' }} 
                            />
                            <ReferenceLine 
                              y={20} 
                              stroke="rgba(255, 255, 255, 0.3)" 
                              strokeDasharray="3 3" 
                              label={{ value: '20% - Healthy', position: 'right', fill: 'rgba(255, 255, 255, 0.5)' }} 
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                  
                  {/* Revenue and Expense Breakdown by Category */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="backdrop-blur-sm bg-black bg-opacity-70 border border-red-900 p-6">
                      <h3 className="text-lg font-bold text-white mb-6 flex items-center">
                        <Sliders size={18} className="mr-2 text-red-500" />
                        Expense Breakdown (Year {Math.min(years, 5)})
                      </h3>
                      
                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={projections[Math.min(years, 5)] ? 
                                Object.entries(projections[Math.min(years, 5)].expenseCategories || {})
                                  .map(([category, value]) => ({
                                    name: category,
                                    value,
                                    fill: getCategoryColor(category, true)
                                  })) : []
                              }
                              cx="50%"
                              cy="50%"
                              labelLine={true}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                              {projections[Math.min(years, 5)] ? 
                                Object.entries(projections[Math.min(years, 5)].expenseCategories || {})
                                  .map((entry, index) => (
                                    <Cell 
                                      key={`cell-${index}`} 
                                      fill={getCategoryColor(entry[0], true)} 
                                    />
                                  )) : null
                              }
                            </Pie>
                            <Tooltip 
                              formatter={(value) => `$${Number(value).toLocaleString()}`} 
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    
                    <div className="backdrop-blur-sm bg-black bg-opacity-70 border border-red-900 p-6">
                      <h3 className="text-lg font-bold text-white mb-6 flex items-center">
                        <Zap size={18} className="mr-2 text-red-500" />
                        Revenue Sources (Year {Math.min(years, 5)})
                      </h3>
                      
                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={projections[Math.min(years, 5)] ? 
                                Object.entries(projections[Math.min(years, 5)].revenueCategories || {})
                                  .map(([category, value]) => ({
                                    name: category,
                                    value,
                                    fill: getCategoryColor(category, false)
                                  })) : []
                              }
                              cx="50%"
                              cy="50%"
                              labelLine={true}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                              {projections[Math.min(years, 5)] ? 
                                Object.entries(projections[Math.min(years, 5)].revenueCategories || {})
                                  .map((entry, index) => (
                                    <Cell 
                                      key={`cell-${index}`} 
                                      fill={getCategoryColor(entry[0], false)} 
                                    />
                                  )) : null
                              }
                            </Pie>
                            <Tooltip 
                              formatter={(value) => `$${Number(value).toLocaleString()}`} 
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                {/* Cash Flow Tab */}
                <TabsContent value="cashflow" className="mt-0">
                  <div className="grid grid-cols-1 gap-8">
                    {/* Cash Flow Chart */}
                    <div className="backdrop-blur-sm bg-black bg-opacity-70 border border-red-900 p-6">
                      <h3 className="text-lg font-bold text-white mb-6 flex items-center">
                        <DollarSign size={18} className="mr-2 text-red-500" />
                        Cash Flow Projection
                      </h3>
                      
                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={projections}
                            margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 10, 63, 0.15)" />
                            <XAxis 
                              dataKey="year" 
                              stroke="#ff0a3f80" 
                              tickLine={false} 
                              axisLine={false} 
                              tick={{ fill: '#ff0a3f', fontSize: 12 }}
                            />
                            <YAxis 
                              stroke="#ff0a3f80" 
                              tickLine={false} 
                              axisLine={false} 
                              tick={{ fill: '#ff0a3f', fontSize: 12 }}
                              tickFormatter={(value) => `$${value / 1000}k`}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend 
                              wrapperStyle={{ color: '#ff0a3f', paddingTop: '15px' }} 
                              formatter={(value) => <span style={{ color: '#ff0a3f', fontFamily: 'monospace' }}>{value.toUpperCase()}</span>}
                            />
                            <Area type="monotone" dataKey="cashFlow" name="Cash Flow" stroke="#00ff9f" fill="url(#cashFlowGradient)" strokeWidth={2} />
                            <Area type="monotone" dataKey="cumulativeProfit" name="Cumulative Profit" stroke="#ff0a3f" fill="url(#profitGradient)" strokeWidth={2} />
                            <ReferenceLine y={0} stroke="white" strokeDasharray="3 3" />
                            <defs>
                              <linearGradient id="cashFlowGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#00ff9f" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#00ff9f" stopOpacity={0.1}/>
                              </linearGradient>
                              <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ff0a3f" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#ff0a3f" stopOpacity={0.1}/>
                              </linearGradient>
                            </defs>
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    
                    {/* Return on Investment Chart */}
                    <div className="backdrop-blur-sm bg-black bg-opacity-70 border border-red-900 p-6">
                      <h3 className="text-lg font-bold text-white mb-6 flex items-center">
                        <Share2 size={18} className="mr-2 text-red-500" />
                        Return on Investment
                      </h3>
                      
                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart
                            data={projections.map(year => ({
                              ...year,
                              investmentMultiple: year.cashFlow / initialCapital
                            }))}
                            margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 10, 63, 0.15)" />
                            <XAxis 
                              dataKey="year" 
                              stroke="#ff0a3f80" 
                              tickLine={false} 
                              axisLine={false} 
                              tick={{ fill: '#ff0a3f', fontSize: 12 }}
                            />
                            <YAxis 
                              yAxisId="left"
                              stroke="#ff0a3f80" 
                              tickLine={false} 
                              axisLine={false} 
                              tick={{ fill: '#ff0a3f', fontSize: 12 }}
                              tickFormatter={(value) => `${value}%`}
                            />
                            <YAxis 
                              yAxisId="right"
                              orientation="right"
                              stroke="#ff0a3f80" 
                              tickLine={false} 
                              axisLine={false} 
                              tick={{ fill: '#ff0a3f', fontSize: 12 }}
                              tickFormatter={(value) => `${value}x`}
                            />
                            <Tooltip />
                            <Legend />
                            <Bar 
                              yAxisId="left"
                              dataKey="roi" 
                              name="ROI %" 
                              fill="#00ff9f" 
                              radius={[4, 4, 0, 0]}
                            />
                            <Line 
                              yAxisId="right"
                              type="monotone" 
                              dataKey="investmentMultiple" 
                              name="Investment Multiple" 
                              stroke="#ffffff" 
                              dot={{ fill: '#ffffff', r: 4 }}
                            />
                            <ReferenceLine yAxisId="left" y={0} stroke="white" strokeDasharray="3 3" />
                            <ReferenceLine 
                              yAxisId="right" 
                              y={1} 
                              stroke="red" 
                              strokeDasharray="3 3" 
                              label={{ value: 'Break-even', position: 'right', fill: 'white' }} 
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                      
                      <div className="mt-6 grid grid-cols-2 gap-4">
                        <div className="bg-black/40 border border-red-900 p-4">
                          <h4 className="text-red-400 text-sm mb-2">Investment Metrics</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-xs text-gray-400">Initial investment:</span>
                              <span className="text-xs font-mono">${initialCapital.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-xs text-gray-400">Final value:</span>
                              <span className="text-xs font-mono">
                                ${financialMetrics.finalCashFlow.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-xs text-gray-400">Total profit:</span>
                              <span className="text-xs font-mono">
                                ${financialMetrics.totalProfit.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between border-t border-red-900 pt-2 mt-2">
                              <span className="text-xs text-gray-400">ROI:</span>
                              <span className="text-xs font-mono">
                                {financialMetrics.roi.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-black/40 border border-red-900 p-4">
                          <h4 className="text-red-400 text-sm mb-2">Performance</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-xs text-gray-400">Investment multiple:</span>
                              <span className="text-xs font-mono">
                                {(financialMetrics.finalCashFlow / initialCapital).toFixed(2)}x
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-xs text-gray-400">Annual return:</span>
                              <span className="text-xs font-mono">
                                {(Math.pow((financialMetrics.finalCashFlow / initialCapital), 1/years) - 1) * 100 > 0 
                                  ? ((Math.pow((financialMetrics.finalCashFlow / initialCapital), 1/years) - 1) * 100).toFixed(1) + '%'
                                  : 'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-xs text-gray-400">Break-even:</span>
                              <span className="text-xs font-mono">
                                {financialMetrics.breakEvenYear !== null 
                                  ? `Year ${financialMetrics.breakEvenYear}` 
                                  : 'Not reached'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                {/* Expenses Tab */}
                <TabsContent value="expenses" className="mt-0">
                  <div className="grid grid-cols-1 gap-8">
                    {/* Expense Breakdown Over Time */}
                    <div className="backdrop-blur-sm bg-black bg-opacity-70 border border-red-900 p-6">
                      <h3 className="text-lg font-bold text-white mb-6 flex items-center">
                        <Sliders size={18} className="mr-2 text-red-500" />
                        Expense Breakdown Over Time
                      </h3>
                      
                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={projections}
                            margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
                            stackOffset="expand"
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 10, 63, 0.15)" />
                            <XAxis 
                              dataKey="year" 
                              stroke="#ff0a3f80" 
                              tickLine={false} 
                              axisLine={false} 
                              tick={{ fill: '#ff0a3f', fontSize: 12 }}
                            />
                            <YAxis 
                              stroke="#ff0a3f80" 
                              tickLine={false} 
                              axisLine={false} 
                              tick={{ fill: '#ff0a3f', fontSize: 12 }}
                              tickFormatter={(value) => `$${value / 1000}k`}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend 
                              wrapperStyle={{ color: '#ff0a3f', paddingTop: '15px' }} 
                              formatter={(value) => <span style={{ color: '#ff0a3f', fontFamily: 'monospace' }}>{value}</span>}
                            />
                            {expenses.map(expense => (
                              <Bar 
                                key={expense.id}
                                dataKey={`expenses.${expense.name}`} 
                                name={expense.name} 
                                stackId="a"
                                fill={getCategoryColor(expense.category, true)} 
                              />
                            ))}
                            <Bar 
                              dataKey="employeeCost" 
                              name="Employee Costs" 
                              stackId="a"
                              fill="#ff5555" 
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    
                    {/* Expense Category Growth */}
                    <div className="backdrop-blur-sm bg-black bg-opacity-70 border border-red-900 p-6">
                      <h3 className="text-lg font-bold text-white mb-6 flex items-center">
                        <CreditCard size={18} className="mr-2 text-red-500" />
                        Expense Category Growth
                      </h3>
                      
                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 10, 63, 0.15)" />
                            <XAxis 
                              dataKey="year" 
                              type="number"
                              domain={[0, years]}
                              stroke="#ff0a3f80" 
                              tickLine={false} 
                              axisLine={false} 
                              tick={{ fill: '#ff0a3f', fontSize: 12 }}
                            />
                            <YAxis 
                              stroke="#ff0a3f80" 
                              tickLine={false} 
                              axisLine={false} 
                              tick={{ fill: '#ff0a3f', fontSize: 12 }}
                              tickFormatter={(value) => `$${value / 1000}k`}
                            />
                            <Tooltip />
                            <Legend />
                            
                            {/* Group expenses by category */}
                            {Object.keys(
                              projections.reduce((acc, year) => {
                                if (year.expenseCategories) {
                                  Object.keys(year.expenseCategories).forEach(cat => {
                                    acc[cat] = true;
                                  });
                                }
                                return acc;
                              }, {} as Record<string, boolean>)
                            ).map((category, index) => (
                              <Line 
                                key={category}
                                type="monotone" 
                                data={projections.map(year => ({
                                  year: year.year,
                                  value: year.expenseCategories ? year.expenseCategories[category] || 0 : 0
                                }))}
                                dataKey="value"
                                name={category}
                                stroke={getCategoryColor(category, true)}
                                strokeWidth={2}
                                dot={{ fill: getCategoryColor(category, true), r: 4 }}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    
                    {/* Expense Details Table */}
                    <div className="backdrop-blur-sm bg-black bg-opacity-70 border border-red-900 p-6">
                      <h3 className="text-lg font-bold text-white mb-6 flex items-center">
                        <Server size={18} className="mr-2 text-red-500" />
                        Detailed Expense Projections
                      </h3>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-red-400 border-b border-red-900">
                            <tr>
                              <th className="px-4 py-3">Expense Item</th>
                              <th className="px-4 py-3">Category</th>
                              <th className="px-4 py-3">Year 1</th>
                              <th className="px-4 py-3">Year 3</th>
                              <th className="px-4 py-3">Year 5</th>
                              <th className="px-4 py-3">Growth</th>
                            </tr>
                          </thead>
                          <tbody>
                            {expenses.map((expense) => (
                              <tr key={expense.id} className="border-b border-red-900/50 hover:bg-red-900/10">
                                <td className="px-4 py-3 font-medium">{expense.name}</td>
                                <td className="px-4 py-3">{expense.category}</td>
                                <td className="px-4 py-3">
                                  ${projections[1] && projections[1].expenses[expense.name] 
                                    ? projections[1].expenses[expense.name].toLocaleString() 
                                    : 'N/A'}
                                </td>
                                <td className="px-4 py-3">
                                  ${projections[3] && projections[3].expenses[expense.name] 
                                    ? projections[3].expenses[expense.name].toLocaleString() 
                                    : 'N/A'}
                                </td>
                                <td className="px-4 py-3">
                                  ${projections[5] && projections[5].expenses[expense.name] 
                                    ? projections[5].expenses[expense.name].toLocaleString() 
                                    : 'N/A'}
                                </td>
                                <td className="px-4 py-3 font-medium text-red-400">
                                  {expense.growth > 0 ? '+' : ''}{expense.growth}%
                                </td>
                              </tr>
                            ))}
                            <tr className="border-b-2 border-red-700 font-medium">
                              <td className="px-4 py-3">Employee Costs</td>
                              <td className="px-4 py-3">Personnel</td>
                              <td className="px-4 py-3">
                                ${projections[1] ? projections[1].employeeCost.toLocaleString() : 'N/A'}
                              </td>
                              <td className="px-4 py-3">
                                ${projections[3] ? projections[3].employeeCost.toLocaleString() : 'N/A'}
                              </td>
                              <td className="px-4 py-3">
                                ${projections[5] ? projections[5].employeeCost.toLocaleString() : 'N/A'}
                              </td>
                              <td className="px-4 py-3 font-medium text-red-400">
                                {salaryGrowth > 0 ? '+' : ''}{salaryGrowth}%
                              </td>
                            </tr>
                            <tr className="font-bold bg-red-900/10">
                              <td className="px-4 py-3">TOTAL EXPENSES</td>
                              <td className="px-4 py-3"></td>
                              <td className="px-4 py-3">
                                ${projections[1] ? projections[1].totalExpenses.toLocaleString() : 'N/A'}
                              </td>
                              <td className="px-4 py-3">
                                ${projections[3] ? projections[3].totalExpenses.toLocaleString() : 'N/A'}
                              </td>
                              <td className="px-4 py-3">
                                ${projections[5] ? projections[5].totalExpenses.toLocaleString() : 'N/A'}
                              </td>
                              <td className="px-4 py-3"></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                {/* Revenue Tab */}
                <TabsContent value="revenue" className="mt-0">
                  <div className="grid grid-cols-1 gap-8">
                    {/* Revenue Stream Analysis */}
                    <div className="backdrop-blur-sm bg-black bg-opacity-70 border border-red-900 p-6">
                      <h3 className="text-lg font-bold text-white mb-6 flex items-center">
                        <Zap size={18} className="mr-2 text-red-500" />
                        Revenue Stream Analysis
                      </h3>
                      
                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={projections}
                            margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 10, 63, 0.15)" />
                            <XAxis 
                              dataKey="year" 
                              stroke="#ff0a3f80" 
                              tickLine={false} 
                              axisLine={false} 
                              tick={{ fill: '#ff0a3f', fontSize: 12 }}
                            />
                            <YAxis 
                              stroke="#ff0a3f80" 
                              tickLine={false} 
                              axisLine={false} 
                              tick={{ fill: '#ff0a3f', fontSize: 12 }}
                              tickFormatter={(value) => `$${value / 1000}k`}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend 
                              wrapperStyle={{ color: '#ff0a3f', paddingTop: '15px' }} 
                              formatter={(value) => <span style={{ color: '#ff0a3f', fontFamily: 'monospace' }}>{value}</span>}
                            />
                            {revenues.map((revenue, index) => {
                              const gradientId = `revenueGradient${index}`;
                              const color = getCategoryColor(revenue.category, false);
                              return (
                                <Area 
                                  key={revenue.id}
                                  type="monotone" 
                                  dataKey={`revenues.${revenue.name}`} 
                                  name={revenue.name} 
                                  stroke={color}
                                  fill={`url(#${gradientId})`}
                                  strokeWidth={2}
                                />
                              );
                            })}
                            <defs>
                              {revenues.map((revenue, index) => {
                                const gradientId = `revenueGradient${index}`;
                                const color = getCategoryColor(revenue.category, false);
                                return (
                                  <linearGradient key={index} id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor={color} stopOpacity={0.1}/>
                                  </linearGradient>
                                );
                              })}
                            </defs>
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    
                    {/* Revenue Type Comparison */}
                    <div className="backdrop-blur-sm bg-black bg-opacity-70 border border-red-900 p-6">
                      <h3 className="text-lg font-bold text-white mb-6 flex items-center">
                        <Home size={18} className="mr-2 text-red-500" />
                        Revenue Type Comparison
                      </h3>
                      
                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={projections.map(year => {
                              // Group revenues by type
                              const types = { 'subscription': 0, 'recurring': 0, 'one-time': 0 };
                              revenues.forEach(rev => {
                                if (year.revenues[rev.name]) {
                                  types[rev.type] += year.revenues[rev.name];
                                }
                              });
                              return {
                                year: year.year,
                                ...types
                              };
                            })}
                            margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 10, 63, 0.15)" />
                            <XAxis 
                              dataKey="year" 
                              stroke="#ff0a3f80" 
                              tickLine={false} 
                              axisLine={false} 
                              tick={{ fill: '#ff0a3f', fontSize: 12 }}
                            />
                            <YAxis 
                              stroke="#ff0a3f80" 
                              tickLine={false} 
                              axisLine={false} 
                              tick={{ fill: '#ff0a3f', fontSize: 12 }}
                              tickFormatter={(value) => `$${value / 1000}k`}
                            />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="subscription" name="Subscription" fill="#00e676" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="recurring" name="Recurring" fill="#00aae6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="one-time" name="One-time" fill="#aa00e6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    
                    {/* Revenue Details Table */}
                    <div className="backdrop-blur-sm bg-black bg-opacity-70 border border-red-900 p-6">
                      <h3 className="text-lg font-bold text-white mb-6 flex items-center">
                        <Server size={18} className="mr-2 text-red-500" />
                        Detailed Revenue Projections
                      </h3>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-red-400 border-b border-red-900">
                            <tr>
                              <th className="px-4 py-3">Revenue Stream</th>
                              <th className="px-4 py-3">Category</th>
                              <th className="px-4 py-3">Type</th>
                              <th className="px-4 py-3">Year 1</th>
                              <th className="px-4 py-3">Year 3</th>
                              <th className="px-4 py-3">Year 5</th>
                              <th className="px-4 py-3">Growth</th>
                            </tr>
                          </thead>
                          <tbody>
                            {revenues.map((revenue) => (
                              <tr key={revenue.id} className="border-b border-red-900/50 hover:bg-red-900/10">
                                <td className="px-4 py-3 font-medium">{revenue.name}</td>
                                <td className="px-4 py-3">{revenue.category}</td>
                                <td className="px-4 py-3 capitalize">{revenue.type}</td>
                                <td className="px-4 py-3">
                                  ${projections[1] && projections[1].revenues[revenue.name] 
                                    ? projections[1].revenues[revenue.name].toLocaleString() 
                                    : 'N/A'}
                                </td>
                                <td className="px-4 py-3">
                                  ${projections[3] && projections[3].revenues[revenue.name] 
                                    ? projections[3].revenues[revenue.name].toLocaleString() 
                                    : 'N/A'}
                                </td>
                                <td className="px-4 py-3">
                                  ${projections[5] && projections[5].revenues[revenue.name] 
                                    ? projections[5].revenues[revenue.name].toLocaleString() 
                                    : 'N/A'}
                                </td>
                                <td className="px-4 py-3 font-medium text-green-400">
                                  {revenue.growth > 0 ? '+' : ''}{revenue.growth}%
                                </td>
                              </tr>
                            ))}
                            <tr className="font-bold bg-green-900/10">
                              <td className="px-4 py-3">TOTAL REVENUE</td>
                              <td className="px-4 py-3"></td>
                              <td className="px-4 py-3"></td>
                              <td className="px-4 py-3">
                                ${projections[1] ? projections[1].totalRevenue.toLocaleString() : 'N/A'}
                              </td>
                              <td className="px-4 py-3">
                                ${projections[3] ? projections[3].totalRevenue.toLocaleString() : 'N/A'}
                              </td>
                              <td className="px-4 py-3">
                                ${projections[5] ? projections[5].totalRevenue.toLocaleString() : 'N/A'}
                              </td>
                              <td className="px-4 py-3"></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                {/* Data Table Tab */}
                <TabsContent value="data" className="mt-0">
                  <div className="backdrop-blur-sm bg-black bg-opacity-70 border border-red-900 p-6">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center">
                      <Server size={18} className="mr-2 text-red-500" />
                      Quantum Financial Matrix
                    </h3>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-red-400 border-b border-red-900">
                          <tr>
                            <th className="px-4 py-3">Year</th>
                            <th className="px-4 py-3">Revenue</th>
                            <th className="px-4 py-3">Expenses</th>
                            <th className="px-4 py-3">Net Profit</th>
                            <th className="px-4 py-3">Cash Flow</th>
                            <th className="px-4 py-3">Profit Margin</th>
                            <th className="px-4 py-3">ROI</th>
                            <th className="px-4 py-3">Growth %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {projections.map((year, index) => {
                            // Skip year 0 (initial)
                            if (index === 0) return null;
                            
                            // Calculate growth percentage from previous year
                            const prevYear = projections[index - 1];
                            const growthPercent = prevYear.netProfit !== 0 
                              ? ((year.netProfit - prevYear.netProfit) / Math.abs(prevYear.netProfit)) * 100 
                              : 100;
                            
                            // Calculate profit margin
                            const profitMargin = year.totalRevenue > 0 
                              ? (year.netProfit / year.totalRevenue) * 100 
                              : 0;
                            
                            // Determine profit color
                            const profitColor = year.netProfit >= 0 ? 'text-green-500' : 'text-red-500';
                            const marginColor = profitMargin >= 0 ? 'text-green-500' : 'text-red-500';
                            const growthColor = growthPercent >= 0 ? 'text-green-500' : 'text-red-500';
                            
                            return (
                              <tr key={year.year} className="border-b border-red-900/50 hover:bg-red-900/10">
                                <td className="px-4 py-3 font-medium">Year {year.year}</td>
                                <td className="px-4 py-3">${year.totalRevenue.toLocaleString()}</td>
                                <td className="px-4 py-3">${year.totalExpenses.toLocaleString()}</td>
                                <td className={`px-4 py-3 font-medium ${profitColor}`}>${year.netProfit.toLocaleString()}</td>
                                <td className="px-4 py-3">${year.cashFlow.toLocaleString()}</td>
                                <td className={`px-4 py-3 ${marginColor}`}>
                                  {profitMargin.toFixed(1)}%
                                </td>
                                <td className="px-4 py-3">
                                  {year.roi ? year.roi.toFixed(1) + '%' : 'N/A'}
                                </td>
                                <td className={`px-4 py-3 font-medium ${growthColor}`}>
                                  {isFinite(growthPercent) ? growthPercent.toFixed(1) + '%' : 'N/A'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="mt-8 flex justify-end">
                      <button 
                        onClick={() => {
                          // Create CSV content
                          const headers = [
                            'Year', 'Revenue', 'Expenses', 'Net Profit', 
                            'Cash Flow', 'Profit Margin', 'ROI', 'Growth %'
                          ];
                          
                          const csvRows = [
                            headers.join(','),
                            ...projections.filter(year => year.year > 0).map(year => {
                              const prevYear = projections[projections.findIndex(p => p.year === year.year) - 1];
                              const growthPercent = prevYear && prevYear.netProfit !== 0 
                                ? ((year.netProfit - prevYear.netProfit) / Math.abs(prevYear.netProfit)) * 100 
                                : 0;
                              
                              const profitMargin = year.totalRevenue > 0 
                                ? (year.netProfit / year.totalRevenue) * 100 
                                : 0;
                                
                              return [
                                year.year,
                                year.totalRevenue,
                                year.totalExpenses,
                                year.netProfit,
                                year.cashFlow,
                                profitMargin.toFixed(1) + '%',
                                year.roi ? year.roi.toFixed(1) + '%' : 'N/A',
                                isFinite(growthPercent) ? growthPercent.toFixed(1) + '%' : 'N/A'
                              ].join(',');
                            })
                          ];
                          
                          const csvContent = csvRows.join('\n');
                          
                          // Create a download link
                          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.setAttribute('href', url);
                          link.setAttribute('download', 'financial_projections.csv');
                          link.style.visibility = 'hidden';
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="flex items-center px-4 py-2 bg-red-900/30 border border-red-900 hover:bg-red-900/50"
                      >
                        <Download size={14} className="mr-2" />
                        Export to CSV
                      </button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
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