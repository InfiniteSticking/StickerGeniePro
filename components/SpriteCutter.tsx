
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProcessedSprite, ProcessorOptions, StickerImage, Rect } from '../types';
import { sliceImage, detectSegments } from '../utils/slicingUtil';
import { Button } from './Button';

interface SpriteCutterProps {
  sourceImage: StickerImage;
  onClose: () => void;
  onAddSprites: (sprites: StickerImage[]) => void;
}

export const SpriteCutter: React.FC<SpriteCutterProps> = ({ sourceImage, onClose, onAddSprites }) => {
  const [mode, setMode] = useState<'smart' | 'grid'>('smart');
  
  // Grid State
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  
  // Custom Manual Lines (Normalized 0-1)
  const [xLines, setXLines] = useState<number[]>([0.5]); // Vertical dividers
  const [yLines, setYLines] = useState<number[]>([0.5]); // Horizontal dividers

  // Smart State
  const [tolerance, setTolerance] = useState(20);
  const [trim, setTrim] = useState(10);

  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedRects, setDetectedRects] = useState<Rect[]>([]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Interaction State
  const [dragging, setDragging] = useState<{ type: 'x' | 'y', index: number } | null>(null);
  const [hoveredLine, setHoveredLine] = useState<{ type: 'x' | 'y', index: number } | null>(null);

  // --- Initialize Grid Lines on Row/Col Change ---
  useEffect(() => {
    // Only reset lines if the count doesn't match the current lines + 1
    if (xLines.length !== cols - 1) {
        const newX = [];
        for (let i = 1; i < cols; i++) newX.push(i / cols);
        setXLines(newX);
    }
    if (yLines.length !== rows - 1) {
        const newY = [];
        for (let i = 1; i < rows; i++) newY.push(i / rows);
        setYLines(newY);
    }
  }, [rows, cols]);

  // --- Real-time Detection Loop ---
  useEffect(() => {
    let active = true;
    const runDetection = async () => {
        if (!sourceImage.url) return;
        
        const options: ProcessorOptions = {
            mode,
            tolerance,
            erosion: 0,
            rows,
            cols,
            trim,
            customGrid: mode === 'grid' ? { xLines, yLines } : undefined
        };

        const rects = await detectSegments(sourceImage.url, options);
        if (active) setDetectedRects(rects);
    };
    // Fast debounce for grid dragging, slower for smart mode
    const delay = mode === 'grid' ? 10 : 300;
    const timer = setTimeout(runDetection, delay);
    return () => { active = false; clearTimeout(timer); };
  }, [mode, tolerance, trim, rows, cols, xLines, yLines, sourceImage.url]);

  // --- Canvas Rendering ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = sourceImage.url;
    
    img.onload = () => {
        if (!containerRef.current) return;
        const containerW = containerRef.current.clientWidth;
        const containerH = containerRef.current.clientHeight;
        
        const scale = Math.min(containerW / img.width, containerH / img.height) * 0.9;
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        
        canvas.width = drawW;
        canvas.height = drawH;
        
        // 1. Draw Image
        ctx.drawImage(img, 0, 0, drawW, drawH);
        
        // 2. Dim Background (Visual cut preview)
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0,0,drawW,drawH);
        
        // 3. Clear detected rects (Show bright content)
        detectedRects.forEach(r => {
            const rx = r.x * scale;
            const ry = r.y * scale;
            const rw = r.w * scale;
            const rh = r.h * scale;
            
            ctx.clearRect(rx, ry, rw, rh);
            ctx.drawImage(img, r.x, r.y, r.w, r.h, rx, ry, rw, rh);
            
            // Smart Mode: Simple border
            if (mode === 'smart') {
                ctx.strokeStyle = '#007fd4';
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.strokeRect(rx, ry, rw, rh);
                
                // Label
                ctx.fillStyle = '#007fd4';
                ctx.fillRect(rx, ry, 24, 16);
                ctx.fillStyle = 'white';
                ctx.font = 'bold 10px monospace';
                ctx.fillText(`#`, rx + 4, ry + 12);
            }
        });

        // 4. Draw INTERACTIVE GRID LINES (Manual Mode Only)
        if (mode === 'grid') {
            ctx.setLineDash([]);
            
            // Vertical Lines (Cyan)
            xLines.forEach((xPos, i) => {
                const pixelX = xPos * drawW;
                const isHovered = hoveredLine?.type === 'x' && hoveredLine?.index === i;
                const isDragging = dragging?.type === 'x' && dragging?.index === i;
                
                ctx.beginPath();
                ctx.moveTo(pixelX, 0);
                ctx.lineTo(pixelX, drawH);
                ctx.strokeStyle = (isHovered || isDragging) ? '#FFFFFF' : '#00FFFF';
                ctx.lineWidth = (isHovered || isDragging) ? 3 : 1;
                ctx.stroke();
                
                // Handle
                ctx.fillStyle = '#00FFFF';
                ctx.beginPath();
                ctx.arc(pixelX, drawH / 2, 4, 0, Math.PI * 2);
                ctx.fill();
            });

            // Horizontal Lines (Magenta)
            yLines.forEach((yPos, i) => {
                const pixelY = yPos * drawH;
                const isHovered = hoveredLine?.type === 'y' && hoveredLine?.index === i;
                const isDragging = dragging?.type === 'y' && dragging?.index === i;

                ctx.beginPath();
                ctx.moveTo(0, pixelY);
                ctx.lineTo(drawW, pixelY);
                ctx.strokeStyle = (isHovered || isDragging) ? '#FFFFFF' : '#FF00FF';
                ctx.lineWidth = (isHovered || isDragging) ? 3 : 1;
                ctx.stroke();
                
                // Handle
                ctx.fillStyle = '#FF00FF';
                ctx.beginPath();
                ctx.arc(drawW / 2, pixelY, 4, 0, Math.PI * 2);
                ctx.fill();
            });
        }
    };
  }, [detectedRects, sourceImage.url, mode, xLines, yLines, hoveredLine, dragging]);

  // Re-draw when dependencies change
  useEffect(() => {
      requestAnimationFrame(draw);
  }, [draw]);

  // --- Interaction Handlers ---

  const handleMouseDown = (e: React.MouseEvent) => {
      if (mode !== 'grid' || !hoveredLine) return;
      setDragging(hoveredLine);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (mode !== 'grid') return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const normX = Math.max(0, Math.min(1, x / canvas.width));
      const normY = Math.max(0, Math.min(1, y / canvas.height));

      if (dragging) {
          // Update Line Position
          if (dragging.type === 'x') {
              setXLines(prev => {
                  const next = [...prev];
                  next[dragging.index] = normX;
                  return next.sort((a,b) => a-b);
              });
          } else {
              setYLines(prev => {
                  const next = [...prev];
                  next[dragging.index] = normY;
                  return next.sort((a,b) => a-b);
              });
          }
      } else {
          // Hover Detection
          const HIT_DIST = 10;
          let found = null;
          
          // Check Vertical
          for(let i=0; i<xLines.length; i++) {
              if (Math.abs((xLines[i] * canvas.width) - x) < HIT_DIST) {
                  found = { type: 'x', index: i } as const;
              }
          }
          // Check Horizontal (overwrite vertical if closer, usually)
          for(let i=0; i<yLines.length; i++) {
              if (Math.abs((yLines[i] * canvas.height) - y) < HIT_DIST) {
                  found = { type: 'y', index: i } as const;
              }
          }
          setHoveredLine(found);
      }
  };

  const handleMouseUp = () => {
      setDragging(null);
  };

  const handleSlice = async () => {
    setIsProcessing(true);
    try {
      const options: ProcessorOptions = {
        mode,
        tolerance,
        erosion: 0,
        rows,
        cols,
        trim,
        customGrid: mode === 'grid' ? { xLines, yLines } : undefined
      };

      const sprites = await sliceImage(sourceImage.url, options);
      
      const newStickers: StickerImage[] = sprites.map((s, i) => ({
        id: crypto.randomUUID(),
        url: s.url,
        name: `${sourceImage.name.replace('Sheet', '')} #${i + 1}`,
        type: 'generated',
        createdAt: Date.now(),
        isPreview: false,
        style: sourceImage.style,
        prompt: sourceImage.prompt,
        isCutout: true,
        isDeepCutout: false,
        parentId: sourceImage.id
      }));
      
      onAddSprites(newStickers);
      onClose();
    } catch (e) {
      alert("Error slicing: " + e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-[#0e0e0e]/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-6xl h-[85vh] bg-[#1e1e1e] border border-[#3e3e42] shadow-2xl flex flex-col overflow-hidden rounded-sm animate-fade-in">
        
        {/* Header */}
        <div className="h-14 border-b border-[#3e3e42] bg-[#252526] px-6 flex items-center justify-between shrink-0">
           <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#D19A66]"></div>
              <h2 className="font-mono text-sm font-bold text-[#cccccc] tracking-wider uppercase">Slicing Engine v2.0</h2>
           </div>
           <button onClick={onClose} className="text-[#858585] hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
           </button>
        </div>

        <div className="flex-1 flex min-h-0">
           
           {/* Left: Interactive Canvas */}
           <div ref={containerRef} className="flex-1 bg-[#121212] relative flex items-center justify-center border-r border-[#3e3e42] p-8 overflow-hidden select-none">
               {/* Grid Background */}
               <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none"></div>
               
               <canvas 
                  ref={canvasRef} 
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className={`shadow-2xl border border-[#3e3e42] ${hoveredLine ? (hoveredLine.type === 'x' ? 'cursor-col-resize' : 'cursor-row-resize') : 'cursor-default'}`} 
               />
               
               <div className="absolute bottom-6 left-6 text-xs font-mono text-[#555] pointer-events-none">
                  DETECTED SEGMENTS: <span className="text-[#007fd4] font-bold">{detectedRects.length}</span>
                  {mode === 'grid' && <span className="ml-2 text-[#00FFFF] opacity-70">(DRAG LINES TO ADJUST)</span>}
               </div>
           </div>

           {/* Right: Control Deck */}
           <div className="w-80 bg-[#252526] flex flex-col shrink-0">
              <div className="p-6 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
                  
                  {/* Mode Selector */}
                  <div className="space-y-3">
                     <label className="text-xs font-bold text-[#858585] uppercase tracking-widest">Slicing Logic</label>
                     <div className="flex bg-[#1e1e1e] p-1 rounded-[2px] border border-[#3e3e42]">
                        <button 
                           onClick={() => setMode('smart')}
                           className={`flex-1 py-2 text-[10px] font-bold uppercase transition-all ${mode === 'smart' ? 'bg-[#37373d] text-white shadow-sm' : 'text-[#555] hover:text-[#ccc]'}`}
                        >
                           ✨ Smart
                        </button>
                        <button 
                           onClick={() => setMode('grid')}
                           className={`flex-1 py-2 text-[10px] font-bold uppercase transition-all ${mode === 'grid' ? 'bg-[#37373d] text-white shadow-sm' : 'text-[#555] hover:text-[#ccc]'}`}
                        >
                           ⊞ Grid
                        </button>
                     </div>
                     <p className="text-[10px] text-[#555] leading-tight">
                        {mode === 'smart' ? "Auto-detects separate objects using color difference." : "Use Drag-and-Drop lines to manually separate stickers."}
                     </p>
                  </div>

                  {/* Mode Specific Controls */}
                  {mode === 'smart' ? (
                      <div className="space-y-6 animate-in fade-in">
                          <div className="space-y-2">
                             <div className="flex justify-between text-xs text-[#ccc]">
                                <span className="font-bold">Tolerance</span>
                                <span className="font-mono">{tolerance}</span>
                             </div>
                             <input 
                                type="range" min="5" max="100" value={tolerance}
                                onChange={e => setTolerance(parseInt(e.target.value))}
                                className="w-full h-1 bg-[#1e1e1e] rounded-lg appearance-none cursor-pointer accent-[#007fd4]"
                             />
                          </div>
                          
                          <div className="space-y-2">
                             <div className="flex justify-between text-xs text-[#ccc]">
                                <span className="font-bold">Padding (Trim)</span>
                                <span className="font-mono">{trim}px</span>
                             </div>
                             <input 
                                type="range" min="0" max="50" value={trim}
                                onChange={e => setTrim(parseInt(e.target.value))}
                                className="w-full h-1 bg-[#1e1e1e] rounded-lg appearance-none cursor-pointer accent-[#007fd4]"
                             />
                          </div>
                      </div>
                  ) : (
                      <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                          <div className="space-y-2">
                             <label className="text-xs font-bold text-[#858585]">ROWS (Y)</label>
                             <input 
                                type="number" min="1" max="10" value={rows}
                                onChange={e => setRows(Math.max(1, parseInt(e.target.value)))}
                                className="w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] h-10 px-3 text-center font-mono focus:border-[#007fd4] outline-none"
                             />
                          </div>
                          <div className="space-y-2">
                             <label className="text-xs font-bold text-[#858585]">COLS (X)</label>
                             <input 
                                type="number" min="1" max="10" value={cols}
                                onChange={e => setCols(Math.max(1, parseInt(e.target.value)))}
                                className="w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] h-10 px-3 text-center font-mono focus:border-[#007fd4] outline-none"
                             />
                          </div>
                      </div>
                  )}

                  {/* Info Box */}
                  <div className="p-3 border border-[#3e3e42] bg-[#1e1e1e] rounded-sm">
                      <div className="flex items-center gap-2 mb-2">
                         <span className="text-lg">💡</span>
                         <span className="text-[10px] font-bold text-[#ccc] uppercase">
                            {mode === 'grid' ? "Interactive Mode" : "Auto Detection"}
                         </span>
                      </div>
                      <p className="text-[10px] text-[#858585] leading-relaxed">
                         {mode === 'grid' 
                            ? "Drag the CYAN (Vertical) and MAGENTA (Horizontal) lines on the canvas to perfectly frame your stickers." 
                            : "Adjust tolerance if the red boxes aren't catching all items. Best for white/black backgrounds."}
                      </p>
                  </div>

              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-[#3e3e42] bg-[#1e1e1e] space-y-2">
                 <Button 
                    variant="primary" 
                    className="w-full h-12 text-xs font-bold tracking-widest" 
                    onClick={handleSlice}
                    isLoading={isProcessing}
                    disabled={detectedRects.length === 0}
                 >
                    SLICE & EXTRACT ({detectedRects.length})
                 </Button>
                 <Button variant="ghost" className="w-full h-8 text-[10px]" onClick={onClose}>CANCEL OPERATION</Button>
              </div>
           </div>

        </div>
      </div>
    </div>
  );
};
