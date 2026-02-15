
import React, { useEffect } from 'react';
import { ToastState } from '../types';

interface ToastProps {
  toast: ToastState;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.visible, onClose]);

  if (!toast.visible) return null;

  const bgColors = {
    success: 'bg-[#10b981] text-white border-[#059669]',
    error: 'bg-[#ef4444] text-white border-[#b91c1c]',
    info: 'bg-[#007fd4] text-white border-[#005a9e]'
  };

  const icons = {
    success: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  };

  return (
    <div className={`fixed bottom-6 right-6 z-[999] pl-3 pr-4 py-3 rounded-md shadow-2xl border flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 font-sans ${bgColors[toast.type]}`}>
       <div className="shrink-0">
         {icons[toast.type]}
       </div>
       <div className="flex flex-col">
         <span className="font-bold text-xs uppercase tracking-wider opacity-90">{toast.type}</span>
         <span className="font-semibold text-sm tracking-tight">{toast.message}</span>
       </div>
    </div>
  );
};
