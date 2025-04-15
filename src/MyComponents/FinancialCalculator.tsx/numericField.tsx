import { NumericFieldProps } from '@/stores/FinancialField';
import React from 'react';


// Generic numerical input field
const NumericField: React.FC<NumericFieldProps> = ({ 
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

export default NumericField;