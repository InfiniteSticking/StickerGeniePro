
import React from 'react';

interface PillSelectorProps {
  options: { value: string, label: string }[];
  currentValue: string;
  onChange: (val: any) => void;
  label: string;
  helpText?: string;
}

export const PillSelector: React.FC<PillSelectorProps> = ({ 
  options, 
  currentValue, 
  onChange, 
  label,
  helpText
}) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between">
      <label className="text-xs font-bold uppercase text-[#858585] tracking-widest">{label}</label>
    </div>
    <div className="flex bg-[#1e1e1e] p-[2px] rounded-[2px] border border-[#3e3e42] overflow-hidden">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-2 py-1.5 text-xs font-medium transition-all ${
            currentValue === opt.value 
              ? 'bg-[#37373d] text-white shadow-sm' 
              : 'text-[#858585] hover:text-[#cccccc] hover:bg-[#252526]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
    {helpText && <p className="text-xs text-[#858585] mt-1 italic">{helpText}</p>}
  </div>
);
