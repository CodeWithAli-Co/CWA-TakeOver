import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart2, DollarSign, Zap, Server, PieChart as PieChartIcon, 
  Sliders, Percent, Home, CreditCard, Share2, Download, Clock, CircleDollarSign,
  TrendingUp
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, ComposedChart, Scatter, PieChart, Pie, Cell, ReferenceLine
} from 'recharts';
import { VisualizerTabProps } from '@/stores/FinancialField';
import { getCategoryColor } from '@/stores/FinancialUtils';
import CustomTooltip from '../customToolTip';


const VisualizerTab: React.FC<VisualizerTabProps> = ({
  years,
  projections,
  financialMetrics,
  expenses,
  revenues
}) => {
  // Sub tabs for visualization section
  const [vizSubTab, setVizSubTab] = useState<string>('summary');

  return (
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
            <div className="text-sm text-red-400 mb-1">Final Cash Position</div>
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
                      investmentMultiple: financialMetrics.finalCashFlow / (projections[0]?.cashFlow || 1)
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
                      <span className="text-xs font-mono">${projections[0]?.cashFlow.toLocaleString()}</span>
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
                        {(financialMetrics.finalCashFlow / (projections[0]?.cashFlow || 1)).toFixed(2)}x
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-400">Annual return:</span>
                      <span className="text-xs font-mono">
                        {(Math.pow((financialMetrics.finalCashFlow / (projections[0]?.cashFlow || 1)), 1/years) - 1) * 100 > 0 
                          ? ((Math.pow((financialMetrics.finalCashFlow / (projections[0]?.cashFlow || 1)), 1/years) - 1) * 100).toFixed(1) + '%'
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
                        +0%
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
  );
};

export default VisualizerTab;