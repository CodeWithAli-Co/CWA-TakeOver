import { SectionHeaderProps } from '@/stores/FinancialField';
import React from 'react';


// Section Header Component
const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title, subtitle }) => (
  <div className="mb-6">
    <div className="flex items-center text-lg font-bold text-white">
      {icon}
      <span className="ml-2">{title}</span>
    </div>
    {subtitle && <p className="text-sm text-red-400 font-mono mt-1">{subtitle}</p>}
  </div>
);

export default SectionHeader;