
import React from 'react';
import { Button } from './Button';
import { StickerImage, ExtractionConfig } from '../types';

interface AlphaChannelStudioProps {
  activeImage: StickerImage | null;
  settings: ExtractionConfig;
  onSettingsChange: (settings: ExtractionConfig) => void;
  onExtract: (settings: ExtractionConfig) => void;
  onDownload: () => void;
  onRevert: () => void;
  canRevert: boolean;
}

export const AlphaChannelStudio: React.FC<AlphaChannelStudioProps> = ({
  activeImage,
  settings,
  onSettingsChange,
  onExtract,
  onDownload,
  onRevert,
  canRevert
}) => {
  if (!activeImage) return null;

  // Preset Handlers
  const setTolerance = (val: number) => onSettingsChange({ ...settings, tolerance: val });

  return (
    <div className="pt-4 border-t border-[#3e3e42] space-y-6 animate-in fade-in h-full overflow-y-auto custom-scrollbar pb-10">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <label className="text-[10px] font-bold text-[#858585] uppercase tracking-widest">Die-Cut Studio</label>
          <span className="text-[9px] text-[#555] mt-1">Background Removal</span>
        </div>
        {canRevert && (
          <button 
             onClick={onRevert}
             className="px-2 py-1 bg-red-900/30 text-red-400 border border-red-900/50 rounded text-[10px] uppercase font-bold hover:bg-red-900/50 transition-colors"
          >
             ↩ Undo Change
          </button>
        )}
      </div>

      {/* --- SECTION 1: EXTRACTION --- */}
      <div className="space-y-4 p-3 bg-[#1a1a1a] border border-[#333] rounded">
         <div className="flex justify-between items-center border-b border-[#333] pb-1 mb-2">
            <label className="text-[10px] font-bold text-[#007fd4] uppercase tracking-widest">1. Extraction Strategy</label>
            <span className="text-[9px] text-[#555]">Method</span>
         </div>

         {/* Method Selector */}
         <div className="flex bg-[#1e1e1e] p-[2px] rounded-[2px] border border-[#333] mb-4">
             <button
                onClick={() => onSettingsChange({ ...settings, method: 'flood_fill' })}
                className={`flex-1 py-1.5 text-[9px] font-bold uppercase transition-all ${settings.method === 'flood_fill' ? 'bg-[#37373d] text-white' : 'text-[#888] hover:text-[#ccc]'}`}
             >
                Contiguous
             </button>
             <button
                onClick={() => onSettingsChange({ ...settings, method: 'luma_key' })}
                className={`flex-1 py-1.5 text-[9px] font-bold uppercase transition-all ${settings.method === 'luma_key' ? 'bg-[#37373d] text-white' : 'text-[#888] hover:text-[#ccc]'}`}
             >
                Global Key
             </button>
         </div>
         <p className="text-[8px] text-[#666] italic mb-2 -mt-2 px-1">
             {settings.method === 'flood_fill' ? "Fills from outside. Preserves internal black details (eyes)." : "Removes ALL matching color. Perfect for lace, text, or donut holes."}
         </p>
         
         {/* Tolerance Presets */}
         <div className="space-y-2">
            <label className="text-[9px] font-bold uppercase text-[#858585]">Color Tolerance</label>
            <div className="grid grid-cols-3 gap-2">
               <button 
                  onClick={() => setTolerance(10)}
                  className={`py-2 text-[10px] font-bold uppercase rounded-[2px] border transition-all ${settings.tolerance === 10 ? 'bg-[#007fd4] text-white border-[#007fd4]' : 'bg-[#252526] text-[#888] border-[#3e3e42] hover:border-[#555]'}`}
               >
                  Strict
               </button>
               <button 
                  onClick={() => setTolerance(20)}
                  className={`py-2 text-[10px] font-bold uppercase rounded-[2px] border transition-all ${settings.tolerance === 20 ? 'bg-[#007fd4] text-white border-[#007fd4]' : 'bg-[#252526] text-[#888] border-[#3e3e42] hover:border-[#555]'}`}
               >
                  Balanced
               </button>
               <button 
                  onClick={() => setTolerance(40)}
                  className={`py-2 text-[10px] font-bold uppercase rounded-[2px] border transition-all ${settings.tolerance === 40 ? 'bg-[#007fd4] text-white border-[#007fd4]' : 'bg-[#252526] text-[#888] border-[#3e3e42] hover:border-[#555]'}`}
               >
                  Loose
               </button>
            </div>
         </div>

         {/* Erosion - Highlighted */}
         <div className="space-y-2 pt-2">
            <div className="flex justify-between text-[9px] font-bold uppercase text-[#D19A66]">
              <span>Edge Erosion (Halo Removal)</span>
              <span className="bg-[#333] text-[#D19A66] px-1.5 rounded">{settings.erosion}px</span>
            </div>
            <input 
              type="range" min="0" max="10" step="1" value={settings.erosion}
              onChange={e => onSettingsChange({...settings, erosion: parseInt(e.target.value)})}
              className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#D19A66]"
            />
            <p className="text-[8px] text-[#666]">
               Shrinks the mask to cut away dark fringes. Essential for clean stickers.
            </p>
         </div>

         {/* Smart Fill */}
         <div className="flex items-center gap-2 pt-1 border-t border-[#333] mt-3">
             <input 
               type="checkbox" 
               checked={settings.smartFill}
               onChange={e => onSettingsChange({...settings, smartFill: e.target.checked})}
               className="accent-[#007fd4]"
             />
             <div className="flex flex-col">
                <span className="text-[9px] font-bold text-[#aaa] uppercase">Fill Enclosed Holes</span>
                <span className="text-[8px] text-[#555]">
                    {settings.method === 'luma_key' && settings.smartFill 
                        ? "Warning: This might re-fill the holes you are trying to remove if they are enclosed." 
                        : "Prevents transparency in eyes or small details."}
                </span>
             </div>
         </div>
      </div>

      {/* --- SECTION 2: BORDER --- */}
      <div className="space-y-4 p-3 bg-[#1a1a1a] border border-[#333] rounded opacity-90 hover:opacity-100 transition-opacity">
         <label className="text-[10px] font-bold text-[#ccc] uppercase tracking-widest block mb-2 border-b border-[#333] pb-1">2. Sticker Border (Optional)</label>
         
         <div className="space-y-1">
            <div className="flex justify-between text-[9px] font-bold uppercase text-[#858585]">
              <span>White Border Thickness</span>
              <span className="text-[#ccc]">{settings.borderWidth}px</span>
            </div>
            <input 
              type="range" min="0" max="40" value={settings.borderWidth}
              onChange={e => onSettingsChange({...settings, borderWidth: parseInt(e.target.value)})}
              className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#ccc]"
            />
         </div>
      </div>

      <div className="pt-2 flex flex-col gap-3">
         <Button variant="cloud" onClick={() => onExtract(settings)} className="w-full h-12 shadow-sm border border-[#007fd4]/30 text-[#007fd4] tracking-widest text-[11px] font-bold">
           ⚡ EXTRACT SUBJECT
         </Button>
      
        <Button variant="primary" onClick={onDownload} className="w-full h-10 tracking-widest text-[10px] font-bold">
           DOWNLOAD PNG
        </Button>
      </div>
    </div>
  );
};
