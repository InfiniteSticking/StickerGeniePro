
import React from 'react';
import { UITheme } from '../types';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'glow' | 'accent' | 'cloud' | 'custom';
  isLoading?: boolean;
  theme?: UITheme;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading, 
  className = '', 
  disabled,
  theme,
  ...props 
}) => {
  // Hardcoded radius-sm for engineering look
  const radius = 'rounded-[2px]';
  
  const baseStyles = `px-3 py-1.5 ${radius} font-medium text-xs uppercase tracking-wide transition-all duration-100 flex items-center justify-center gap-2 focus:outline-none focus:ring-1 focus:ring-[#007fd4] focus:ring-offset-1 focus:ring-offset-[#1e1e1e] disabled:opacity-50 disabled:cursor-not-allowed transform active:translate-y-[1px]`;
  
  const variants = {
    primary: "bg-[#007fd4] text-white hover:bg-[#006ca0] border border-transparent shadow-sm",
    accent: "bg-[#569CD6] text-[#1e1e1e] hover:bg-[#4E8CC2]",
    cloud: "bg-[#2d2d2d] text-[#cccccc] border border-[#3e3e42] hover:bg-[#3e3e42]",
    glow: "bg-[#007fd4] text-white shadow-[0_0_10px_rgba(0,127,212,0.3)] hover:brightness-110",
    secondary: "bg-[#D19A66] text-[#1e1e1e] hover:bg-[#c18a56]",
    danger: "bg-[#3c1f1f] text-[#f85149] border border-[#f85149] hover:bg-[#5c2323]",
    ghost: "bg-transparent text-[#858585] hover:text-[#cccccc] hover:bg-[#2d2d2d]",
    custom: ""
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Processing...</span>
        </>
      ) : children}
    </button>
  );
};
