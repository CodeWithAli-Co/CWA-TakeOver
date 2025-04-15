import { CustomTooltipProps } from '@/stores/FinancialField';
import React from 'react';


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

export default CustomTooltip;