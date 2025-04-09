import React, { useState, useEffect } from 'react';

interface ToggleSwitchProps {
  id?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  activeState?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  id,
  checked = false,
  onChange,
  className = '',
  size = 'md',
  activeState
}) => {
  const [isChecked, setIsChecked] = useState(checked);
  
  useEffect(() => {
    if (activeState !== undefined) {
      setIsChecked(activeState);
    }
  }, [activeState]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newChecked = e.target.checked;
    setIsChecked(newChecked);
    onChange?.(newChecked);
  };

// Size variants
const sizeStyles = {
    xs: {
      wrapper: 'h-5',
      container: 'w-[45px]',
      toggle: 'h-[16px] w-[16px]',
      togglePositions: 'left-[23px] left-[4px]',
      indicator: 'h-[10px] w-[10px]',
      borderWidth: 'border-[2px]',
      padding: 'p-[4px]',
      shadow: 'shadow-[inset_0px_2px_4px_0px_#16151c,_0px_2px_3px_-1px_#403f4e]',
      toggleShadow: 'shadow-[inset_0px_2px_2px_0px_#424151,_0px_2px_5px_0px_#0f0e17]'
    },
    sm: {
      wrapper: 'h-6',
      container: 'w-[55px]',
      toggle: 'h-[20px] w-[20px]',
      togglePositions: 'left-[28px] left-[4px]',
      indicator: 'h-[12px] w-[12px]',
      borderWidth: 'border-[2px]',
      padding: 'p-[4px]',
      shadow: 'shadow-[inset_0px_3px_6px_0px_#16151c,_0px_2px_4px_-1px_#403f4e]',
      toggleShadow: 'shadow-[inset_0px_3px_3px_0px_#424151,_0px_3px_8px_0px_#0f0e17]'
    },
    md: {
      wrapper: 'h-8',
      container: 'w-[68px]',
      toggle: 'h-[24px] w-[24px]',
      togglePositions: 'left-[37px] left-[5px]',
      indicator: 'h-[16px] w-[16px]',
      borderWidth: 'border-[2px]',
      padding: 'p-[5px]',
      shadow: 'shadow-[inset_0px_4px_8px_0px_#16151c,_0px_3px_5px_-2px_#403f4e]',
      toggleShadow: 'shadow-[inset_0px_4px_3px_0px_#424151,_0px_3px_10px_0px_#0f0e17]'
    },
    lg: {
      wrapper: 'h-10',
      container: 'w-[85px]',
      toggle: 'h-[32px] w-[32px]',
      togglePositions: 'left-[46px] left-[5px]',
      indicator: 'h-[20px] w-[20px]',
      borderWidth: 'border-[3px]',
      padding: 'p-[5px]',
      shadow: 'shadow-[inset_0px_5px_10px_0px_#16151c,_0px_3px_6px_-2px_#403f4e]',
      toggleShadow: 'shadow-[inset_0px_5px_4px_0px_#424151,_0px_4px_15px_0px_#0f0e17]'
    }
  }[size];

  const uniqueId = id || `toggle-switch-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <label 
      htmlFor={uniqueId} 
      className={`flex items-center justify-center ${sizeStyles.wrapper} ${className}`}
    >
      <div 
        className={`relative h-full ${sizeStyles.container} bg-[#252532] rounded-full ${sizeStyles.shadow} border border-[#32303e] ${sizeStyles.padding} box-border cursor-pointer flex items-center`}
      >
        <input
          id={uniqueId}
          type="checkbox"
          checked={isChecked}
          onChange={handleChange}
          className="opacity-0 appearance-none absolute"
        />
        
        {/* Toggle button */}
        <div 
          className={`absolute ${sizeStyles.toggle} bg-gradient-to-b from-[#3b3a4e] to-[#272733] rounded-full ${sizeStyles.toggleShadow} z-10 transition-all duration-300 ease-in
          ${isChecked ? sizeStyles.togglePositions.split(' ')[0] : sizeStyles.togglePositions.split(' ')[1]}`}
        />
        
        {/* Indicator - FIXED: Added flex centering and adjusted positioning */}
        <div 
          className={`absolute ${sizeStyles.indicator} flex items-center justify-center rounded-full box-border transition-all duration-1000
          ${isChecked 
            ? `${sizeStyles.borderWidth} border-[#60d480] left-[10px] top-[50%] -translate-y-1/2` 
            : `${sizeStyles.borderWidth} border-[#ef565f] right-[10px] top-[50%] -translate-y-1/2`
          }`}
        />
      </div>
    </label>
  );
};

export default ToggleSwitch;