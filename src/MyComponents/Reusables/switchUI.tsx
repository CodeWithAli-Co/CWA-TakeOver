import React, { useState } from 'react';

interface ToggleSwitchProps {
  id?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  className?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  id = 'toggle-switch',
  checked = false,
  onChange,
  className = '',
}) => {
  const [isChecked, setIsChecked] = useState(checked);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newChecked = e.target.checked;
    setIsChecked(newChecked);
    onChange?.(newChecked);
  };

  return (
    <label 
      htmlFor={id} 
      className={`flex items-center justify-center h-14 ${className}`}
    >
      <div 
        className="relative h-full w-[115px] bg-[#252532] rounded-[165px] shadow-[inset_0px_5px_10px_0px_#16151c,_0px_3px_6px_-2px_#403f4e] border border-[#32303e] p-[6px] box-border cursor-pointer"
      >
        <input
          id={id}
          type="checkbox"
          checked={isChecked}
          onChange={handleChange}
          className="opacity-0 appearance-none absolute"
        />
        
        {/* Toggle button */}
        <div 
          className={`absolute h-[42px] w-[42px] bg-gradient-to-b from-[#3b3a4e] to-[#272733] rounded-full shadow-[inset_0px_5px_4px_0px_#424151,_0px_4px_15px_0px_#0f0e17] z-10 transition-all duration-300 ease-in
          ${isChecked ? 'left-[60px]' : 'left-[6px]'}`}
        />
        
        {/* Indicator */}
        <div 
          className={`absolute h-[25px] w-[25px] top-1/2 -translate-y-1/2 rounded-full box-border transition-all duration-1000
          ${isChecked 
            ? 'border-[3px] border-[#60d480] left-[10px] opacity-100' 
            : 'border-[3px] border-[#ef565f] right-[10px] opacity-100'
          }`}
        />
      </div>
    </label>
  );
};

export default ToggleSwitch;