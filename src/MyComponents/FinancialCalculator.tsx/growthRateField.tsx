import { GrowthRateFieldProps } from '@/stores/FinancialField';
import React from 'react';

// Growth rate field with slider
const GrowthRateField: React.FC<GrowthRateFieldProps> = ({ 
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

export default GrowthRateField;