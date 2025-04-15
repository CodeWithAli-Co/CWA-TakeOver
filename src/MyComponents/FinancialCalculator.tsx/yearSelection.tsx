import React from 'react';
import { Clock } from 'lucide-react';
import { YearSelectorProps } from '@/stores/FinancialField';


// Year selector component
const YearSelector: React.FC<YearSelectorProps> = ({ years, setYears }) => (
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

export default YearSelector;