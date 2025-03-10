import React from 'react';
import { RefreshCw } from 'lucide-react';

// StatCard Component
export const StatCard: React.FC<{
  title: string;
  value: number;
  total: number;
  icon: React.ReactNode;
  color: string;
}> = ({ title, value, total, icon, color }) => {
  const percentage = Math.round((value / total) * 100);

  return (
    <div className={`bg-${color}-900/20 border border-${color}-900/30 rounded-lg p-4 w-40`}>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm text-white">{title}</h3>
        {icon}
      </div>
      <div className="text-white font-bold text-xl">
        {value} <span className="text-xs text-gray-400">/ {total}</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
        <div 
          className={`bg-${color}-600 h-1.5 rounded-full`} 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

// Loading State Component
export const LoadingState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
      <RefreshCw className="animate-spin text-red-500 mb-4" size={48} />
      <p className="text-lg">Loading Schedule...</p>
    </div>
  );
};

// Error State Component
export const ErrorState: React.FC<{ retry: () => void }> = ({ retry }) => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
      <div className="text-center">
        <h2 className="text-2xl text-red-500 mb-4">Error Loading Schedule</h2>
        <p className="mb-6">Unable to retrieve schedule data. Please try again.</p>
        <button 
          onClick={retry}
          className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-md"
        >
          Retry
        </button>
      </div>
    </div>
  );
};