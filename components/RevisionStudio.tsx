
import React, { useState } from 'react';
import { StickerImage } from '../types';
import { editSticker } from '../services/geminiService';
import { Button } from './Button';

interface RevisionStudioProps {
  originalImage: StickerImage;
  onClose: () => void;
  onSave: (newImage: StickerImage, overwrite: boolean) => void;
}

export const RevisionStudio: React.FC<RevisionStudioProps> = ({ originalImage, onClose, onSave }) => {
  const [instruction, setInstruction] = useState('');
  const [severity, setSeverity] = useState<'touchup' | 'recolor' | 'remix'>('touchup');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  const handleGenerate = async () => {
    if (!instruction) return;
    setIsProcessing(true);
    try {
      // Determine aspect ratio based on original image dimensions
      // Or default to 1:1 if unknown. For now, assuming square or standard sticker size.
      const ratio = originalImage.name.includes('Sheet') ? '3:4' : '1:1';
      
      const result = await editSticker(originalImage.url, instruction, severity, ratio);
      setGeneratedImage(result.url);
    } catch (e: any) {
      alert("Revision failed: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinish = (overwrite: boolean) => {
    if (!generatedImage) return;
    
    const newAsset: StickerImage = {
        id: crypto.randomUUID(),
        url: generatedImage,
        name: overwrite ? originalImage.name : `${originalImage.name} (Rev)`,
        type: 'generated',
        createdAt: Date.now(),
        prompt: originalImage.prompt,
        finalPrompt: originalImage.finalPrompt,
        style: originalImage.style,
        isPreview: originalImage.isPreview,
        stickerCount: originalImage.stickerCount,
        parentId: overwrite ? undefined : originalImage.id
    };
    
    onSave(newAsset, overwrite);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[500] bg-[#0e0e0e]/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl h-[85vh] bg-[#1e1e1e] border border-[#3e3e42] shadow-2xl flex flex-col overflow-hidden animate-fade-in rounded-sm">
        
        {/* Header - Ticket Style */}
        <div className="h-14 border-b border-[#3e3e42] bg-[#252526] px-6 flex items-center justify-between shrink-0">
           <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#007fd4]"></div>
              <h2 className="font-mono text-sm font-bold text-[#cccccc] tracking-wider uppercase">Revision Ticket #{originalImage.id.slice(0,6).toUpperCase()}</h2>
           </div>
           <button onClick={onClose} className="text-[#858585] hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
           </button>
        </div>

        <div className="flex-1 flex min-h-0">
           
           {/* Left: Canvas Area */}
           <div className="flex-1 bg-[#121212] relative flex items-center justify-center border-r border-[#3e3e42] p-8">
               <div className="relative w-full h-full flex items-center justify-center">
                  
                  {/* Background Grid */}
                  <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none"></div>

                  {/* Image Container */}
                  <div className="relative max-w-full max-h-full aspect-square border border-[#3e3e42] shadow-lg bg-checkered-dark group">
                      {/* Comparison Logic */}
                      <img 
                        src={showOriginal || !generatedImage ? originalImage.url : generatedImage} 
                        className="w-full h-full object-contain"
                      />
                      
                      {/* Diff Badge */}
                      {generatedImage && (
                          <div className="absolute top-4 left-4 flex gap-2">
                             <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${showOriginal ? 'bg-[#D19A66] text-black' : 'bg-[#007fd4] text-white'}`}>
                                {showOriginal ? 'ORIGINAL' : 'REVISION'}
                             </span>
                          </div>
                      )}
                  </div>
                  
                  {/* Compare Button Floating */}
                  {generatedImage && (
                    <button 
                       onMouseDown={() => setShowOriginal(true)}
                       onMouseUp={() => setShowOriginal(false)}
                       onMouseLeave={() => setShowOriginal(false)}
                       className="absolute bottom-6 bg-[#2d2d2d] text-[#cccccc] border border-[#3e3e42] px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-[#3e3e42] active:scale-95 transition-all shadow-xl z-20"
                    >
                       Press & Hold to Compare
                    </button>
                  )}
               </div>
           </div>

           {/* Right: Controls */}
           <div className="w-80 bg-[#252526] flex flex-col shrink-0">
              <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                  
                  {/* Instructions */}
                  <div className="space-y-2">
                     <label className="text-xs font-bold text-[#858585] uppercase tracking-widest">Client Feedback</label>
                     <textarea 
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        placeholder="e.g. 'Remove the sunglasses', 'Make the red hat blue', 'Fix the distorted hand'..."
                        className="w-full h-32 bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] p-3 text-sm focus:border-[#007fd4] outline-none resize-none placeholder-[#555]"
                     />
                  </div>

                  {/* Severity/Fidelity */}
                  <div className="space-y-3">
                     <label className="text-xs font-bold text-[#858585] uppercase tracking-widest">Revision Severity</label>
                     <div className="flex flex-col gap-2">
                        <button 
                           onClick={() => setSeverity('touchup')}
                           className={`p-3 text-left border transition-all ${severity === 'touchup' ? 'bg-[#007fd4]/10 border-[#007fd4]' : 'bg-[#1e1e1e] border-[#3e3e42] hover:border-[#555]'}`}
                        >
                           <div className={`text-xs font-bold mb-0.5 ${severity === 'touchup' ? 'text-[#007fd4]' : 'text-[#cccccc]'}`}>TOUCH UP (High Fidelity)</div>
                           <div className="text-[10px] text-[#858585] leading-tight">Fix artifacts or small details. Keeps 95% of pixels identical.</div>
                        </button>
                        
                        <button 
                           onClick={() => setSeverity('recolor')}
                           className={`p-3 text-left border transition-all ${severity === 'recolor' ? 'bg-[#007fd4]/10 border-[#007fd4]' : 'bg-[#1e1e1e] border-[#3e3e42] hover:border-[#555]'}`}
                        >
                           <div className={`text-xs font-bold mb-0.5 ${severity === 'recolor' ? 'text-[#007fd4]' : 'text-[#cccccc]'}`}>RECOLOR / MATERIAL</div>
                           <div className="text-[10px] text-[#858585] leading-tight">Change colors or textures. Keeps the exact shape and pose.</div>
                        </button>

                        <button 
                           onClick={() => setSeverity('remix')}
                           className={`p-3 text-left border transition-all ${severity === 'remix' ? 'bg-[#007fd4]/10 border-[#007fd4]' : 'bg-[#1e1e1e] border-[#3e3e42] hover:border-[#555]'}`}
                        >
                           <div className={`text-xs font-bold mb-0.5 ${severity === 'remix' ? 'text-[#007fd4]' : 'text-[#cccccc]'}`}>REMIX (Low Fidelity)</div>
                           <div className="text-[10px] text-[#858585] leading-tight">Alter pose, add objects, or reimagine the composition.</div>
                        </button>
                     </div>
                  </div>

                  {/* Generate Button */}
                  <Button 
                    variant="primary" 
                    className="w-full h-12" 
                    onClick={handleGenerate} 
                    isLoading={isProcessing}
                    disabled={!instruction}
                  >
                     {generatedImage ? 'REGENERATE PREVIEW' : 'RUN REVISION'}
                  </Button>

              </div>

              {/* Footer Actions */}
              {generatedImage && (
                 <div className="p-4 border-t border-[#3e3e42] bg-[#1e1e1e] space-y-2">
                    <Button variant="secondary" className="w-full h-10" onClick={() => handleFinish(false)}>SAVE AS COPY</Button>
                    <button 
                       onClick={() => handleFinish(true)}
                       className="w-full h-8 text-[10px] text-[#858585] uppercase tracking-wider hover:text-[#cccccc] underline decoration-dotted"
                    >
                       Overwrite Original
                    </button>
                 </div>
              )}
           </div>

        </div>
      </div>
    </div>
  );
};
