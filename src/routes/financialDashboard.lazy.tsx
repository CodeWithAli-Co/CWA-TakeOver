import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Line, LineChart } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { RefreshCcw, TrendingUp, DollarSign, AlertCircle, Zap, Database, ShieldAlert, Gauge, Calculator, PieChart as PieChartIcon } from "lucide-react";
import { motion } from "framer-motion";
import { createLazyFileRoute } from '@tanstack/react-router';
import '../assets/statsCard.css'; // Import the statsCard.css file
import GradientText from '@/MyComponents/Reusables/gradientText';
import { useClientStore } from '@/stores/invoiceStore';
import { Invoices } from '@/stores/invoiceQuery';
import { FinancialProjector } from '@/MyComponents/FinancialCalculator.tsx/financialField';


// Type definition for invoice data
interface Invoice {
  invoice_id: string;
  invoice_title: string;
  client_name: string;
  outcome: string;
  status: string;
}

export const FinancialDashboard = () => {
  const { name } = useClientStore();
  const { data, isLoading, refetch } = Invoices(name);
  // const [timeframe, setTimeframe] = useState("month");
  
  // If no data or still loading, show placeholder
  if (isLoading || !data) {
    return (
      <div className="flex justify-center items-center h-screen bg-black">
        <div className="p-8 text-red-500 flex flex-col items-center">
          <div className="w-20 h-20 border-4 border-t-transparent border-red-600 rounded-full animate-spin mb-4"></div>
          <div className="text-xl font-mono tracking-wider">INITIALIZING DATA PROTOCOLS</div>
        </div>
      </div>
    );
  }
  
  // Calculate financial metrics
  const totalInvoiced = data.reduce((sum, invoice) => sum + (Number(invoice.outcome) || 0), 0);
  const paidInvoices = data.filter(invoice => invoice.status === "paid");
  const totalPaid = paidInvoices.reduce((sum, invoice) => sum + (Number(invoice.outcome) || 0), 0);
  const percentPaid = totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0;
  
  // Calculate growth rate - new metric replacing Outstanding
  const lastMonthAmount = 3800; // This would normally be calculated from actual data
  const currentMonthAmount = 4200; // This would normally be calculated from actual data
  const growthRate = ((currentMonthAmount - lastMonthAmount) / lastMonthAmount) * 100;
  
  // Generate monthly data
  const monthlyData = [
    { name: 'Jan', income: 4000, expenses: 2400, profit: 1600 },
    { name: 'Feb', income: 3000, expenses: 1398, profit: 1602 },
    { name: 'Mar', income: 2000, expenses: 1800, profit: 200 },
    { name: 'Apr', income: 2780, expenses: 1908, profit: 872 },
    { name: 'May', income: 1890, expenses: 1400, profit: 490 },
    { name: 'Jun', income: 2390, expenses: 1800, profit: 590 },
  ];
  
  // Pie chart data for income sources
  const pieData = [
    { name: 'Design Work', value: 400 },
    { name: 'Development', value: 300 },
    { name: 'Consulting', value: 300 },
    { name: 'Other', value: 200 },
  ];
  
  const COLORS = ['#ff0a3f', '#ff305a', '#ff0050', '#e6194b'];
  
  return (
    <div className="min-h-screen bg-black text-gray-300 relative overflow-hidden dark-mode">
      {/* Background Grid Pattern */}
      <div 
        className="absolute inset-0 z-0 opacity-10" 
        style={{
          backgroundImage: `linear-gradient(#ff0a3f80 1px, transparent 1px), linear-gradient(90deg, #ff0a3f80 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      ></div>

      {/* Header */}
      <div className="relative z-10 bg-black bg-opacity-70 backdrop-blur-sm border-b border-red-900">
        <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter text-white">
            <GradientText children = {"Finance"} />
            Prince
            </h1>
            <p className="text-red-500 font-mono text-xs tracking-widest">CYBERNETIC FINANCIAL INTERFACE v2.5</p>
          </div>
          <button
            onClick={() => refetch()}
            className="p-3 bg-red-900 bg-opacity-30 border border-red-700 rounded hover:bg-red-800 hover:bg-opacity-50 transition-colors duration-300 text-red-500 flex items-center gap-2"
          >
            <RefreshCcw size={18} className="text-black" />
            <span className="text-xs font-mono tracking-wider text-black">SYNC</span>
          </button>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        {/* Stats Grid using the special CSS */}
        <div className="stats-grid" style={{ marginTop: '-40px', marginBottom: '60px' }}>
          <div className="stat-card">
            <div className="absolute top-3 left-3 text-red-400 opacity-70">
              <DollarSign size={24} />
            </div>
            <div className="stat-label">Total Invoiced</div>
            <div className="stat-value">${totalInvoiced.toFixed(2)}</div>
          </div>
          
          <div className="stat-card">
            <div className="absolute top-3 left-3 text-red-400 opacity-70">
              <Gauge size={24} />
            </div>
            <div className="stat-label">Growth Rate</div>
            <div className="stat-value">+{growthRate.toFixed(1)}%</div>
          </div>
          
          <div className="stat-card">
            <div className="absolute top-3 left-3 text-red-400 opacity-70">
              <ShieldAlert size={24} />
            </div>
            <div className="stat-label">Collection Rate</div>
            <div className="stat-value">{percentPaid.toFixed(1)}%</div>
          </div>
        </div>
        
        {/* Charts Section */}
        <div className="mb-16 mt-12">
          <Tabs defaultValue="income" className="w-full">
            <div className="flex justify-between items-center mb-8">
              <TabsList className="p-1 bg-black bg-opacity-50 backdrop-blur-sm border border-red-900 rounded-none">
                <TabsTrigger 
                  value="income" 
                  className="px-6 py-2 rounded-none data-[state=active]:bg-red-900 data-[state=active]:text-white data-[state=active]:shadow-[0_0_10px_rgba(255,10,63,0.5)] transition-all duration-300"
                >
                  <Zap size={16} className="mr-2" />
                  INCOME
                </TabsTrigger>
                <TabsTrigger 
                  value="expenses" 
                  className="px-6 py-2 rounded-none data-[state=active]:bg-red-900 data-[state=active]:text-white data-[state=active]:shadow-[0_0_10px_rgba(255,10,63,0.5)] transition-all duration-300"
                >
                  <TrendingUp size={16} className="mr-2" />
                  EXPENSES
                </TabsTrigger>
                <TabsTrigger 
                  value="sources" 
                  className="px-6 py-2 rounded-none data-[state=active]:bg-red-900 data-[state=active]:text-white data-[state=active]:shadow-[0_0_10px_rgba(255,10,63,0.5)] transition-all duration-300"
                >
                  <AlertCircle size={16} className="mr-2" />
                  SOURCES
                </TabsTrigger>
                <TabsTrigger 
                  value="calculator" 
                  className="px-6 py-2 rounded-none data-[state=active]:bg-red-900 data-[state=active]:text-white data-[state=active]:shadow-[0_0_10px_rgba(255,10,63,0.5)] transition-all duration-300"
                >
                  <Calculator size={16} className="mr-2" />
                  PROJECTOR
                </TabsTrigger>
              </TabsList>
              
              <div className="text-xs text-red-500 font-mono border border-red-900 px-3 py-1">
                SYSTEM TIME: {new Date().toLocaleTimeString()}
              </div>
            </div>
            
            <TabsContent value="income" className="mt-0">
              <div className="backdrop-blur-lg bg-black bg-opacity-40 border border-red-900 p-8 shadow-[0_0_30px_rgba(0,0,0,0.3)]">
                <div className="text-xl font-bold text-white mb-2 flex items-center">
                  <Zap className="mr-2 text-red-500" size={20} />
                  Income Flow Analysis
                </div>
                <div className="text-sm text-red-400 mb-8 font-mono">Neural mapping of revenue streams - 6 month analysis</div>
                <div className="h-80 w-full px-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={monthlyData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 10, 63, 0.15)" />
                      <XAxis 
                        dataKey="name" 
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
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(0, 0, 0, 0.9)', 
                          borderColor: '#ff0a3f', 
                          boxShadow: '0 0 20px rgba(255, 10, 63, 0.3)',
                          backdropFilter: 'blur(4px)',
                          fontFamily: 'monospace',
                          padding: '10px'
                        }}
                        itemStyle={{ color: '#fff' }}
                        formatter={(value) => [`${value}`, '']}
                        labelFormatter={(label) => `PERIOD: ${label}`}
                        separator=""
                        itemSorter={() => -1}
                      />
                      <Legend 
                        wrapperStyle={{ color: '#ff0a3f', paddingTop: '15px' }} 
                        formatter={(value) => <span style={{ color: '#ff0a3f', fontFamily: 'monospace' }}>{value.toUpperCase()}</span>}
                      />
                      <Bar 
                        dataKey="income" 
                        fill="#ff0a3f" 
                        radius={[4, 4, 0, 0]}
                        barSize={60}
                        background={{ fill: 'rgba(255, 10, 63, 0.05)' }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="expenses" className="mt-0">
              <div className="backdrop-blur-lg bg-black bg-opacity-40 border border-red-900 p-8 shadow-[0_0_30px_rgba(0,0,0,0.3)]">
                <div className="text-xl font-bold text-white mb-2 flex items-center">
                  <TrendingUp className="mr-2 text-red-500" size={20} />
                  Expense Pattern Recognition
                </div>
                <div className="text-sm text-red-400 mb-8 font-mono">Algorithmic analysis of resource allocation</div>
                <div className="h-80 w-full px-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={monthlyData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 10, 63, 0.15)" />
                      <XAxis 
                        dataKey="name" 
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
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(0, 0, 0, 0.9)', 
                          borderColor: '#ff0a3f', 
                          boxShadow: '0 0 20px rgba(255, 10, 63, 0.3)',
                          backdropFilter: 'blur(4px)',
                          fontFamily: 'monospace'
                        }}
                        itemStyle={{ color: '#fff' }}
                        formatter={(value) => [`${value}`, '']}
                        labelFormatter={(label) => `PERIOD: ${label}`}
                      />
                      <Legend 
                        wrapperStyle={{ color: '#ff0a3f', paddingTop: '15px' }} 
                        formatter={(value) => <span style={{ color: '#ff0a3f', fontFamily: 'monospace' }}>{value.toUpperCase()}</span>}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="expenses" 
                        stroke="#304ffe" 
                        strokeWidth={3}
                        dot={{ fill: '#304ffe', stroke: '#304ffe', strokeWidth: 2, r: 6 }}
                        activeDot={{ fill: '#304ffe', stroke: '#fff', strokeWidth: 2, r: 8 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="profit" 
                        stroke="#ff0a3f" 
                        strokeWidth={3}
                        dot={{ fill: '#ff0a3f', stroke: '#ff0a3f', strokeWidth: 2, r: 6 }}
                        activeDot={{ fill: '#ff0a3f', stroke: '#fff', strokeWidth: 2, r: 8 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="sources" className="mt-0">
              <div className="backdrop-blur-lg bg-black bg-opacity-40 border border-red-900 p-8 shadow-[0_0_30px_rgba(0,0,0,0.3)]">
                <div className="text-xl font-bold text-white mb-2 flex items-center">
                  <AlertCircle className="mr-2 text-red-500" size={20} />
                  Revenue Source Distribution
                </div>
                <div className="text-sm text-red-400 mb-8 font-mono">Quantum analysis of capital influx origins</div>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
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
                        labelStyle={{ fill: '#fff', fontSize: 12, fontFamily: 'monospace' }}
                      >
                        {pieData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={COLORS[index % COLORS.length]} 
                            stroke="rgba(0,0,0,0.5)"
                            strokeWidth={1}
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(0, 0, 0, 0.9)', 
                          borderColor: '#ff0a3f', 
                          boxShadow: '0 0 20px rgba(255, 10, 63, 0.3)',
                          backdropFilter: 'blur(4px)',
                          fontFamily: 'monospace'
                        }}
                        itemStyle={{ color: '#fff' }}
                        formatter={(value) => [`${value}`, '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </TabsContent>
            
            {/* New Financial Projector Tab */}
            <TabsContent value="calculator" className="mt-0">
              <FinancialProjector />
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Recent Transactions Section */}
        <div className="backdrop-blur-lg bg-black bg-opacity-40 border border-red-900 p-8 shadow-[0_0_30px_rgba(0,0,0,0.3)] mb-12">
          <div className="flex justify-between items-center mb-8">
            <div>
              <div className="text-xl font-bold text-white flex items-center">
                <Database className="mr-2 text-red-500" size={20} />
                Transaction Log
              </div>
              <div className="text-sm text-red-400 font-mono">Latest financial activity matrix</div>
            </div>
            <div className="text-xs text-red-500 border border-red-900 px-3 py-1 font-mono">
              ENTRIES: {data.length}
            </div>
          </div>
          
          <div className="space-y-4">
            {data.slice(0, 5).map((invoice: Invoice, idx: number) => (
              <motion.div
                key={invoice.invoice_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="relative backdrop-blur-md bg-gradient-to-r from-black to-red-950 bg-opacity-70 p-5 border-l-2 border-red-600 overflow-hidden group"
              >
                {/* Glow effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-red-900 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                
                <div className="flex justify-between items-center relative z-10">
                  <div>
                    <p className="font-medium text-white text-lg">{invoice.invoice_title}</p>
                    <p className="text-xs text-red-400 font-mono mt-1">{invoice.client_name}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-lg ${invoice.status === 'paid' ? 'text-green-500' : 'text-red-500'}`}>
                      ${Number(invoice.outcome).toFixed(2)}
                    </p>
                    <p className={`text-xs px-2 py-0.5 inline-block font-mono mt-1 ${
                      invoice.status === 'paid' 
                        ? 'text-green-400 border border-green-800' 
                        : 'text-red-400 border border-red-800'
                    }`}>
                      {invoice.status === 'paid' ? 'COMPLETE' : 'PENDING'}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          
          <div className="mt-8 flex justify-end">
            <button className="bg-red-900 bg-opacity-30 text-black text-sm px-4 py-2 border-2 hover:border-red-950  hover:bg-opacity-50 transition-colors duration-300 flex items-center gap-2 font-mono">
              ACCESS FULL LOGS
              <Zap size={14} />
            </button>
          </div>
        </div>
        
        {/* Footer */}
        <div className="text-xs text-red-900 text-center py-6 font-mono border-t border-red-900 mt-16">
          <div className="flex justify-center space-x-4">
            <GradientText children = {"FinancePrince"} />
           
            <span>•</span>
            <span className="text-red-700">SECURITY LEVEL: Prince </span>
            <span>•</span>
            <span className="text-red-700">v2.5.9</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Route = createLazyFileRoute('/financialDashboard')({
  component: FinancialDashboard,
});