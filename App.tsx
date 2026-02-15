
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StickerImage, UITheme, ToastState, ExtractionConfig } from './types';
import { generateSticker, generateStickerName, editSticker, analyzeBrief, constructTechnicalPrompt } from './services/geminiService';
import { upscaleImage } from './services/upscalerService';
import { Button } from './components/Button';
import { ImageCard } from './components/ImageCard';
import { PillSelector } from './components/PillSelector';
import { STYLE_CATEGORIES, TYPOGRAPHY_STYLES, getThemeForStyle } from './constants';
import { processSticker } from './utils/backgroundExtractor';
import { sliceGrid2x2 } from './utils/gridSlicing';
import { downloadSourceCode } from './utils/downloadHandler';
import { SourceExplorer } from './components/SourceExplorer';
import { RevisionStudio } from './components/RevisionStudio';
import { AlphaChannelStudio } from './components/AlphaChannelStudio';
import { SpriteCutter } from './components/SpriteCutter';
import { Toast } from './components/Toast';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const generateId = () => crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).substring(2);

const COSTS = { ANALYZE: 600, DRAFT: 2500, EDIT: 2000, UPSCALE: 8000 };

// Map art styles to appropriate default typography
const DEFAULT_TYPOGRAPHY_MAP: Record<string, string> = {
  "Studio Extraction": "Sans Serif Minimal",
  "Avatars & Portraits": "Rubber Hose Cartoon Text",
  "Paper-Kissed": "Typewriter Font",
  "Tattoo Parlor": "Vintage Americana Label",
  "Fine Art Masters": "Elegant Calligraphy",
  "Architecture & Design": "Swiss International Minimal",
  "Esoteric & Occult": "Gothic Blackletter",
  "Mixology & Beverages": "Neon Sign Text",
  "Music & Sound": "Heavy Metal Band Logo",
  "Street Art & Urban": "Graffiti Tagging",
  "Sci-Fi & Cybernetics": "Cyberpunk HUD Glitch",
  "Fantasy & RPG": "Gothic Blackletter",
  "Horror & Macabre": "Ransom Note Cutouts",
  "Animation & Cartoons": "Rubber Hose Cartoon Text",
  "Comics & Graphic Novels": "Comic Book Sound Effect",
  "Video Game Worlds": "Pixel Art 8-Bit Font",
  "Retro Nostalgia": "80s Neon Retrowave",
  "Abstract & Geometric": "Sans Serif Minimal",
  "Nature & Wildlife": "Organic Moss/Vine Text",
  "Food & Culinary": "Chalkboard Sketch",
  "Fashion & Style": "Elegant Calligraphy",
  "Vehicles & Transport": "Chrome Metal Liquid",
  "Professions & Hobbies": "Sans Serif Minimal",
  "Sports & Action": "Brutalist Bold",
  "Holidays & Seasons": "Elegant Calligraphy",
  "Cute & Kawaii": "Bubble Letters",
  "Materials & Textures": "Chrome Metal Liquid",
  "Typography & Lettering": "Graffiti Tagging"
};

const BriefPanel: React.FC<{
  userPrompt: string; setUserPrompt: (val: string) => void;
  activeCategory: string; setActiveCategory: (val: string) => void;
  selectedStyle: string; setSelectedStyle: (val: string) => void;
  typographyStyle: string; setTypographyStyle: (val: string) => void;
  isTypographyEnabled: boolean; setIsTypographyEnabled: (val: boolean) => void;
  textPlacement: string; setTextPlacement: (val: string) => void;
  customStyle: string; setCustomStyle: (val: string) => void;
  useBorder: boolean; setUseBorder: (val: boolean) => void;
  referenceImages: string[]; setReferenceImages: React.Dispatch<React.SetStateAction<string[]>>;
  referenceMode: 'style' | 'content' | 'both'; setReferenceMode: (val: 'style' | 'content' | 'both') => void;
  fidelity: 'low' | 'medium' | 'high'; setFidelity: (val: 'low' | 'medium' | 'high') => void;
  subjectGuidance: 'low' | 'balanced' | 'heavy'; setSubjectGuidance: (val: 'low' | 'balanced' | 'heavy') => void;
  onAnalyze: () => void; isAnalyzing: boolean;
  imageRole: 'reference' | 'subject'; setImageRole: (val: 'reference' | 'subject') => void;
  layoutMode: 'single' | 'sheet'; setLayoutMode: (val: 'single' | 'sheet') => void;
  onUpdatePrompt: () => void; isUpdatingPrompt: boolean;
  bgColor: string; setBgColor: (val: string) => void;
}> = (props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPhotosOpen, setIsPhotosOpen] = useState(true);

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCat = e.target.value;
    props.setActiveCategory(newCat);
    
    // Apply smart typography default ONLY if enabled
    if (props.isTypographyEnabled) {
        const smartDefault = DEFAULT_TYPOGRAPHY_MAP[newCat];
        if (smartDefault) {
            props.setTypographyStyle(smartDefault);
        }
    }

    if (STYLE_CATEGORIES[newCat]?.length > 0) {
      props.setSelectedStyle(STYLE_CATEGORIES[newCat][0].name);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (rev) => {
        const base64 = rev.target?.result as string;
        props.setReferenceImages(prev => [...prev, base64].slice(-3)); 
      };
      reader.readAsDataURL(file as Blob);
    });
  };

  return (
    <div className="h-full flex flex-col bg-[#252526] border-r border-[#3e3e42]">
      <div className="px-6 py-5 border-b border-[#3e3e42] flex items-center justify-between bg-[#1e1e1e]">
        <h2 className="text-base font-bold text-[#cccccc] uppercase tracking-wider">Project Brief</h2>
        <span className="text-xs text-[#555]">v4.7</span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-10">
        
        <div className="space-y-3 transition-all animate-in fade-in slide-in-from-left-2">
            <div className="flex justify-between items-end">
              <div className="flex flex-col">
                <label className="text-sm font-bold text-[#858585] uppercase tracking-widest">Client Request</label>
              </div>
              <button onClick={props.onAnalyze} disabled={props.isAnalyzing} className="text-xs bg-[#2d2d2d] text-[#007fd4] px-3 py-1.5 rounded-[2px] border border-[#3e3e42] flex items-center gap-2 cursor-pointer hover:bg-[#3e3e42] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {props.isAnalyzing ? (
                    <span className="flex items-center gap-1">
                      <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      THINKING
                    </span>
                  ) : '⚡ AUTO-COMPLETE BRIEF'}
              </button>
            </div>
          <textarea 
            value={props.userPrompt}
            onChange={e => props.setUserPrompt(e.target.value)}
            className="w-full h-48 bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] p-4 text-base font-mono focus:border-[#007fd4] outline-none resize-none leading-relaxed"
            placeholder="// Describe the sticker idea here... (e.g. 'A cybernetic cat eating ramen')"
          />
        </div>

        <div className="space-y-4 animate-in fade-in">
           <div className="flex flex-col gap-3">
              <label className="text-sm font-bold text-[#858585] uppercase tracking-widest">Layout Strategy</label>
              <div className="flex bg-[#1e1e1e] p-1 rounded-[4px] border border-[#3e3e42]">
                  <button 
                    onClick={() => props.setLayoutMode('single')} 
                    className={`flex-1 py-3 text-xs font-bold uppercase transition-all ${props.layoutMode === 'single' ? 'bg-[#37373d] text-white shadow-sm' : 'text-[#858585] hover:text-[#cccccc]'}`}
                  >
                    Single Asset
                  </button>
                  <button 
                    onClick={() => props.setLayoutMode('sheet')} 
                    className={`flex-1 py-3 text-xs font-bold uppercase transition-all ${props.layoutMode === 'sheet' ? 'bg-[#37373d] text-white shadow-sm' : 'text-[#858585] hover:text-[#cccccc]'}`}
                  >
                    2x2 Grid Sheet
                  </button>
              </div>
              <p className="text-xs text-[#555] italic leading-tight px-1">
                 Single mode optimizes for maximum detail on one subject. Sheet mode generates 4 variations for exploring concepts.
              </p>
           </div>
        </div>

        <div className="space-y-4 animate-in fade-in">
            <div className="flex justify-between items-center">
                 <label className="text-sm font-bold text-[#858585] uppercase tracking-widest">Art Style Selection</label>
                 <button 
                   onClick={props.onUpdatePrompt}
                   disabled={props.isUpdatingPrompt}
                   className={`text-[10px] font-bold border px-2 py-1 rounded transition-colors flex items-center gap-1 shadow-sm ${props.isUpdatingPrompt ? 'bg-[#222] text-[#555] border-transparent' : 'bg-[#333] text-[#ccc] border-[#3e3e42] hover:bg-[#444] hover:text-white'}`}
                 >
                   {props.isUpdatingPrompt ? 'SYNCING...' : '↺ APPLY TO PROMPT'}
                 </button>
            </div>
            
            {/* Background Selector */}
            <div className="flex flex-col gap-2 pb-2">
                 <label className="text-xs font-bold text-[#555] uppercase tracking-widest">Background Color</label>
                 <div className="flex bg-[#1e1e1e] p-1 rounded-[4px] border border-[#3e3e42]">
                      <button 
                        onClick={() => props.setBgColor('black')} 
                        className={`flex-1 py-1.5 text-[10px] font-bold uppercase transition-all ${props.bgColor === 'black' ? 'bg-[#333] text-white border border-[#555]' : 'text-[#555] hover:text-[#aaa]'}`}
                      >
                         Black
                      </button>
                      <button 
                        onClick={() => props.setBgColor('white')} 
                        className={`flex-1 py-1.5 text-[10px] font-bold uppercase transition-all ${props.bgColor === 'white' ? 'bg-[#e5e5e5] text-black border border-white' : 'text-[#555] hover:text-[#aaa]'}`}
                      >
                         White
                      </button>
                      <button 
                        onClick={() => props.setBgColor('transparent')} 
                        className={`flex-1 py-1.5 text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${props.bgColor === 'transparent' ? 'bg-checkered-dark text-white border border-[#555]' : 'text-[#555] hover:text-[#aaa]'}`}
                      >
                         <span className="w-2 h-2 bg-checkered rounded-full inline-block"></span>
                         Transp.
                      </button>
                 </div>
            </div>

            <div className="flex flex-col gap-3">
              <select value={props.activeCategory} onChange={handleCategoryChange} className="bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] h-12 px-3 text-base">
                {Object.keys(STYLE_CATEGORIES).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <select value={props.selectedStyle} onChange={(e) => props.setSelectedStyle(e.target.value)} className="bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] h-12 px-3 text-base">
                  {STYLE_CATEGORIES[props.activeCategory]?.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            
            {/* CUSTOM STYLE OVERRIDE AREA */}
            <div className="relative pt-2">
                <div className="flex justify-between items-center mb-1">
                   <label className={`text-xs font-bold uppercase tracking-widest ${props.customStyle ? 'text-[#D19A66]' : 'text-[#555]'}`}>
                      {props.customStyle ? '✨ Custom Style Override' : 'Style Override'}
                   </label>
                   {props.customStyle && (
                      <button onClick={() => props.setCustomStyle('')} className="text-[10px] text-[#858585] hover:text-white uppercase">
                        Clear
                      </button>
                   )}
                </div>
                <textarea 
                   value={props.customStyle}
                   onChange={(e) => props.setCustomStyle(e.target.value)}
                   placeholder="Optional: Describe a unique custom style to override the dropdowns above (e.g. 'Made of spaghetti')..."
                   className={`w-full h-20 bg-[#1e1e1e] border p-2 text-sm focus:border-[#007fd4] outline-none resize-none placeholder-[#333] transition-colors ${props.customStyle ? 'border-[#D19A66] text-[#D19A66]' : 'border-[#3e3e42] text-[#cccccc]'}`}
                />
            </div>

            <p className="text-xs text-[#555] italic leading-tight">
              Tip: "Subject Extraction" will attempt to clone your uploaded photo exactly. Other styles will use the photo as a loose reference.
            </p>
        </div>

        <div className="pt-5 border-t border-[#3e3e42]">
           <div className="flex justify-between items-center mb-4 cursor-pointer group" onClick={() => setIsPhotosOpen(!isPhotosOpen)}>
              <div className="flex items-center gap-2">
                  <span className={`text-[10px] text-[#555] transition-transform duration-200 ${isPhotosOpen ? 'rotate-90' : ''}`}>▶</span>
                  <label className="text-sm font-bold text-[#858585] uppercase tracking-widest cursor-pointer group-hover:text-[#ccc] transition-colors">Source Photos</label>
              </div>
              
              {isPhotosOpen ? (
                 <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} className="text-xs text-[#007fd4] px-2 py-1 hover:bg-[#2d2d2d] rounded">+ Import Reference</button>
              ) : (
                 props.referenceImages.length > 0 && <span className="text-[10px] font-bold text-[#007fd4] bg-[#007fd4]/10 px-2 py-0.5 rounded">{props.referenceImages.length} Active</span>
              )}
           </div>
           
           {isPhotosOpen && (
             <div className="space-y-5 animate-in slide-in-from-top-1 fade-in duration-200">
               <input type="file" ref={fileInputRef} hidden multiple accept="image/*" onChange={handleFileChange} />
               
               <div className="grid grid-cols-3 gap-4">
                 {props.referenceImages.map((img, idx) => (
                    <div key={idx} className="relative aspect-square border border-[#3e3e42] overflow-hidden group bg-black">
                       <img src={img} className="w-full h-full object-contain" />
                       <button onClick={() => props.setReferenceImages(prev => prev.filter((_, i) => i !== idx))} className="absolute inset-0 bg-red-900/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-xs font-bold">REMOVE</button>
                    </div>
                 ))}
                 {Array.from({ length: 3 - props.referenceImages.length }).map((_, i) => (
                    <div key={i} className="aspect-square bg-[#1e1e1e] border border-[#3e3e42] border-dashed flex items-center justify-center text-[#333] cursor-pointer hover:border-[#555] transition-colors" onClick={() => fileInputRef.current?.click()}>
                       <span className="text-2xl">+</span>
                    </div>
                 ))}
               </div>

               <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-[#555] uppercase tracking-widest">Image Influence Role</label>
                      <span className="text-[10px] text-[#444]">How strictly to follow the image</span>
                  </div>
                  <div className="flex gap-3">
                     <button onClick={() => props.setImageRole('reference')} className={`flex-1 py-2 text-xs font-bold uppercase rounded-[2px] border transition-all ${props.imageRole === 'reference' ? 'bg-[#37373d] text-white border-[#007fd4]' : 'bg-[#1e1e1e] text-[#555] border-[#3e3e42]'}`}>Loose Reference</button>
                     <button onClick={() => props.setImageRole('subject')} className={`flex-1 py-2 text-xs font-bold uppercase rounded-[2px] border transition-all ${props.imageRole === 'subject' ? 'bg-[#37373d] text-white border-[#007fd4]' : 'bg-[#1e1e1e] text-[#555] border-[#3e3e42]'}`}>Subject Lock</button>
                  </div>
               </div>
             </div>
           )}
        </div>
        
        {/* Typography Controls */}
        <div className="space-y-4 pt-5 border-t border-[#3e3e42]">
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <label className="text-sm font-bold text-[#858585] uppercase tracking-widest">Typography Fusion</label>
                    <span className="text-xs text-[#555]">Integrate text directly into geometry</span>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                       onClick={props.onUpdatePrompt}
                       disabled={props.isUpdatingPrompt}
                       className={`text-[10px] font-bold border px-2 py-1 rounded transition-colors flex items-center gap-1 shadow-sm ${props.isUpdatingPrompt ? 'bg-[#222] text-[#555] border-transparent' : 'bg-[#333] text-[#ccc] border-[#3e3e42] hover:bg-[#444] hover:text-white'}`}
                     >
                       {props.isUpdatingPrompt ? 'SYNCING...' : '↺ APPLY TO PROMPT'}
                     </button>
                    <button 
                      onClick={() => {
                         const newState = !props.isTypographyEnabled;
                         props.setIsTypographyEnabled(newState);
                         // If turning ON, apply a smart default based on category
                         if (newState) {
                            const smartDefault = DEFAULT_TYPOGRAPHY_MAP[props.activeCategory];
                            if (smartDefault) {
                               props.setTypographyStyle(smartDefault);
                            }
                         }
                      }} 
                      className={`w-10 h-5 rounded-full relative transition-colors ${props.isTypographyEnabled ? 'bg-[#007fd4]' : 'bg-[#333]'}`}
                    >
                        <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full transition-transform ${props.isTypographyEnabled ? 'translate-x-5' : 'translate-x-1'}`}></div>
                    </button>
                </div>
            </div>
            
            {props.isTypographyEnabled && (
                 <div className="animate-in fade-in slide-in-from-top-2 space-y-4">
                     <select 
                        value={props.typographyStyle} 
                        onChange={(e) => props.setTypographyStyle(e.target.value)} 
                        className="w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] h-12 px-3 text-base"
                     >
                        <option value="">Select Text Style...</option>
                        {TYPOGRAPHY_STYLES.map(t => <option key={t} value={t}>{t}</option>)}
                     </select>
                     
                     <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-[#858585] uppercase tracking-widest">Placement Strategy</label>
                        <select 
                           value={props.textPlacement}
                           onChange={(e) => props.setTextPlacement(e.target.value)}
                           className="w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] h-10 px-3 text-sm"
                        >
                           <option value="auto">⚡ Smart Integration (AI Decides)</option>
                           <option value="above">⬆️ Floating Above Subject</option>
                           <option value="below">⬇️ Floating Below Subject</option>
                           <option value="center">🎯 Overlaid Center (Badge Style)</option>
                           <option value="speech_bubble">💬 Inside Speech Bubble</option>
                           <option value="badge">🛡️ Curved Emblem Border</option>
                        </select>
                     </div>
                 </div>
            )}
        </div>

        <div className="space-y-4 pt-5 border-t border-[#3e3e42]">
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <label className="text-sm font-bold text-[#858585] uppercase tracking-widest">Die-Cut Border</label>
                    <span className="text-xs text-[#555]">Add a white sticker edge</span>
                </div>
                <button onClick={() => props.setUseBorder(!props.useBorder)} className={`w-10 h-5 rounded-full relative transition-colors ${props.useBorder ? 'bg-[#007fd4]' : 'bg-[#333]'}`}>
                    <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full transition-transform ${props.useBorder ? 'translate-x-5' : 'translate-x-1'}`}></div>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

const InspectorPanel: React.FC<{
  activeImage: StickerImage | null;
  draftPrompt: string;
  generatingState: string;
  isUpdatingDraft: boolean;
  onGenerate: (prompt: string) => void;
  onGenerateVariations: (prompt: string) => void;
  onRegenerate: (prompt: string, isGrid: boolean) => void;
  onDownload: () => void;
  onRemoveBackground: (opts: ExtractionConfig) => void;
  onSliceGrid: () => void;
  onOpenSlicer: () => void;
  onModifyDraft: (prompt: string) => void;
  onFinalize: () => void;
  onRequestRevision: () => void;
  extractionSettings: ExtractionConfig;
  setExtractionSettings: (val: ExtractionConfig) => void;
  onRename: (val: string) => void;
  onAutoName: () => Promise<void>;
  layoutMode: 'single' | 'sheet';
  onRevert: () => void;
}> = (props) => {
  const [technicalPrompt, setTechnicalPrompt] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [flash, setFlash] = useState(false);
  const prevDraftRef = useRef(props.draftPrompt);

  // Effect 1: Update when the active image changes (gallery selection)
  useEffect(() => {
    if (props.activeImage) {
      setTechnicalPrompt(props.activeImage.finalPrompt || props.activeImage.prompt || "");
    }
  }, [props.activeImage?.id]);

  // Effect 2: Update when the draft prompt changes (Auto button pressed or auto-sync)
  // Also triggers a visual flash to alert the user of the update.
  useEffect(() => {
    if (props.draftPrompt && props.draftPrompt !== prevDraftRef.current) {
        setTechnicalPrompt(props.draftPrompt);
        setFlash(true);
        const timer = setTimeout(() => setFlash(false), 800);
        prevDraftRef.current = props.draftPrompt;
        return () => clearTimeout(timer);
    }
  }, [props.draftPrompt]);

  const showInspector = props.activeImage || props.draftPrompt;

  // Visual logic for buttons
  const isSingleActive = props.layoutMode === 'single';
  const isSheetActive = props.layoutMode === 'sheet';

  // Check if current image can be reverted (is a cutout)
  const canRevert = !!(props.activeImage && props.activeImage.isCutout && props.activeImage.parentId);

  return (
    <div className="h-full flex flex-col bg-[#252526] border-l border-[#3e3e42]">
       <div className="px-6 py-5 border-b border-[#3e3e42] bg-[#1e1e1e]">
          <h2 className="text-base font-bold text-[#cccccc] uppercase tracking-wider">Asset Inspector</h2>
       </div>

       <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-10">
          <div className="flex gap-3 mb-4">
              <Button 
                variant={isSingleActive ? "primary" : "cloud"}
                className={`flex-[2] h-16 flex-col gap-1 shadow-lg transition-all ${!isSingleActive ? 'opacity-50 hover:opacity-100 grayscale' : ''}`}
                onClick={() => props.onGenerate(technicalPrompt)} 
                isLoading={props.generatingState === 'draft_single'}
                disabled={props.generatingState.startsWith('draft')}
              >
                <span className="font-bold text-sm">GENERATE ASSET</span>
                <span className="text-[10px] opacity-80 uppercase tracking-widest">{isSingleActive ? '● ACTIVE STRATEGY' : 'Single Mode'}</span>
              </Button>
              <Button 
                variant={isSheetActive ? "secondary" : "cloud"}
                className={`flex-1 h-16 flex-col gap-1 shadow-lg border-l border-[#3e3e42] transition-all ${!isSheetActive ? 'opacity-50 hover:opacity-100 grayscale' : ''}`}
                onClick={() => props.onGenerateVariations(technicalPrompt)} 
                isLoading={props.generatingState === 'draft_grid'}
                disabled={props.generatingState.startsWith('draft')}
              >
                <span className="font-bold text-sm">2x2 GRID</span>
                <span className="text-[10px] opacity-80 uppercase tracking-widest">{isSheetActive ? '● ACTIVE' : 'Variations'}</span>
              </Button>
          </div>

          {showInspector ? (
            <div className="space-y-8 animate-in fade-in">
               
               {/* Asset Identity Section - Only if Image exists */}
               {props.activeImage && (
                   <div className="space-y-3 pb-6 border-b border-[#3e3e42]">
                      <label className="text-xs font-bold text-[#858585] uppercase tracking-widest">Asset Identity</label>
                      <div className="flex gap-3">
                         <input 
                            type="text" 
                            value={props.activeImage.name}
                            onChange={(e) => props.onRename(e.target.value)}
                            className="flex-1 bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] h-10 px-4 text-sm focus:border-[#007fd4] outline-none placeholder-[#555]"
                            placeholder="Asset Name..."
                         />
                         <Button 
                            variant="cloud" 
                            className="w-28 h-10 text-xs"
                            onClick={async () => {
                               setIsRenaming(true);
                               await props.onAutoName();
                               setIsRenaming(false);
                            }}
                            isLoading={isRenaming}
                         >
                            🪄 AUTO NAME
                         </Button>
                      </div>
                   </div>
               )}

               {/* Technical Prompt Box - Always Visible if drafting */}
               <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <label className={`text-xs font-bold uppercase tracking-widest transition-colors duration-500 ${flash ? 'text-emerald-500' : 'text-[#858585]'}`}>
                         {flash ? '✓ TECHNICAL PROMPT UPDATED' : 'Technical Prompt (Engine Instruction)'}
                    </label>
                    <span className="text-[10px] text-[#555]">
                      {props.isUpdatingDraft ? 'SYNCING WITH CONTROLS...' : 'Edit this to fine-tune the output'}
                    </span>
                  </div>
                  <div className="relative">
                    <textarea 
                      value={technicalPrompt}
                      onChange={(e) => {
                        setTechnicalPrompt(e.target.value);
                        if (props.activeImage) {
                          props.onModifyDraft(e.target.value);
                        }
                      }}
                      className={`w-full h-96 border p-4 text-sm font-mono focus:border-[#007fd4] outline-none resize-none leading-relaxed transition-all duration-700
                        ${props.isUpdatingDraft ? 'opacity-50' : 'opacity-100'}
                        ${flash 
                           ? 'border-emerald-500 bg-emerald-500/10 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.15)]' 
                           : 'bg-[#1e1e1e] border-[#3e3e42] text-[#999]'
                        }
                      `}
                    />
                    {props.isUpdatingDraft && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                         <div className="bg-[#252526] border border-[#3e3e42] px-4 py-2 rounded shadow-xl flex items-center gap-3">
                            <div className="w-4 h-4 border-2 border-[#007fd4] border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-xs font-bold text-[#007fd4]">REWRITING...</span>
                         </div>
                      </div>
                    )}
                  </div>
                  {props.activeImage && (
                      <Button 
                        variant="cloud" 
                        className="w-full h-10 mt-3 text-xs border border-[#3e3e42] hover:border-[#007fd4] hover:text-[#007fd4] transition-all"
                        onClick={() => props.onRegenerate(technicalPrompt, props.activeImage?.isGrid ?? false)}
                        isLoading={props.generatingState.startsWith('draft')}
                      >
                        ▶ RERUN COMMAND WITH EDITS
                      </Button>
                  )}
               </div>

               {/* Actions - Only if activeImage */}
               {props.activeImage && (
                   <>
                       <div className="space-y-4 pt-6 border-t border-[#3e3e42]">
                          <Button variant="glow" onClick={props.onRequestRevision} className="w-full h-12 text-sm tracking-widest">REQUEST AI REVISION</Button>
                          <Button variant="accent" onClick={props.onFinalize} className="w-full h-16 flex-col gap-1" isLoading={props.generatingState === 'final'}>
                             <span className="font-bold text-sm">AI UPSCALE & REFINE (4K)</span>
                             <span className="text-[10px] opacity-80 uppercase tracking-widest">High Fidelity Restoration</span>
                          </Button>
                       </div>
                       
                       <div className="pt-6 border-t border-[#3e3e42] space-y-3">
                            {props.activeImage.isGrid && (
                                 <Button variant="cloud" onClick={props.onSliceGrid} className="w-full h-12 shadow-sm border border-[#007fd4]/30 text-[#007fd4] text-sm">
                                    ✂️ SLICE QUADRANTS (2x2)
                                 </Button>
                            )}
                            
                            <Button variant="cloud" onClick={props.onOpenSlicer} className="w-full h-12 shadow-sm bg-[#1e1e1e] border border-[#555] text-[#ccc] hover:text-white hover:border-[#aaa] text-sm">
                                ✂️ OPEN SMART SLICER
                            </Button>
                            
                            {props.activeImage.isGrid && (
                                <p className="text-xs text-[#555] text-center leading-relaxed">
                                    Tip: Use "Slice Quadrants" for perfect 2x2 grids, or "Smart Slicer" to detect custom object placements.
                                </p>
                            )}
                       </div>
        
                       <AlphaChannelStudio 
                          activeImage={props.activeImage}
                          settings={props.extractionSettings}
                          onSettingsChange={props.setExtractionSettings}
                          onExtract={props.onRemoveBackground}
                          onDownload={props.onDownload}
                          onRevert={props.onRevert}
                          canRevert={canRevert}
                       />
                   </>
               )}
            </div>
          ) : (
            <div className="h-96 flex flex-col items-center justify-center text-[#444] text-center p-10 grayscale opacity-40">
                <div className="text-7xl mb-6">🔮</div>
                <p className="text-sm font-mono uppercase tracking-widest leading-loose">System Ready.<br/>Enter prompt in Brief Panel<br/>or Select Reference.</p>
            </div>
          )}
       </div>
    </div>
  );
};

const App: React.FC = () => {
  // Safe default: prefer "Avatars & Portraits" over "Studio Extraction" to avoid confusion
  const DEFAULT_CAT = "Avatars & Portraits";
  const initialCategory = STYLE_CATEGORIES[DEFAULT_CAT] ? DEFAULT_CAT : Object.keys(STYLE_CATEGORIES)[0];
  
  const [userPrompt, setUserPrompt] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
  const [selectedStyle, setSelectedStyle] = useState(STYLE_CATEGORIES[initialCategory][0].name);
  const [typographyStyle, setTypographyStyle] = useState('');
  const [isTypographyEnabled, setIsTypographyEnabled] = useState(false);
  const [textPlacement, setTextPlacement] = useState('auto');
  const [customStyle, setCustomStyle] = useState('');
  const [useBorder, setUseBorder] = useState(false); // DEFAULT TO FALSE per user request
  const [generatingState, setGeneratingState] = useState<'idle' | 'draft_single' | 'draft_grid' | 'final' | 'edit' | 'analyze'>('idle');
  const [isUpdatingDraft, setIsUpdatingDraft] = useState(false);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [referenceMode, setReferenceMode] = useState<'style' | 'content' | 'both'>('both');
  const [fidelity, setFidelity] = useState<'low' | 'medium' | 'high'>('medium');
  const [subjectGuidance, setSubjectGuidance] = useState<'low' | 'balanced' | 'heavy'>('balanced');
  const [imageRole, setImageRole] = useState<'reference' | 'subject'>('reference');
  const [bgColor, setBgColor] = useState('black');
  
  // NEW EXTRACTION CONFIG STATE
  const [extractionSettings, setExtractionSettings] = useState<ExtractionConfig>({ 
    method: 'flood_fill', // Locked to Flood Fill
    tolerance: 20, // Default Balanced
    softness: 0, // Disabled
    erosion: 5, // Default Aggressive Cleanup
    smartFill: true, 
    borderWidth: 0, // Default to 0
    outputSize: 1024
  });

  const [images, setImages] = useState<StickerImage[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [isSlicing, setIsSlicing] = useState(false);
  const [showSourceExplorer, setShowSourceExplorer] = useState(false);
  const [showRevisionStudio, setShowRevisionStudio] = useState(false);
  const [showSpriteCutter, setShowSpriteCutter] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState("");
  const [layoutMode, setLayoutMode] = useState<'single' | 'sheet'>('single');
  const [toast, setToast] = useState<ToastState>({ visible: false, message: '', type: 'info' });

  const activeImage = images.find(img => img.id === activeImageId) || null;
  const initialMount = useRef(true);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ visible: true, message, type });
  };

  useEffect(() => {
    if (selectedStyle.includes("Subject Extraction")) {
      setImageRole('subject');
    }
  }, [selectedStyle]);

  // --- MANUAL SYNC FUNCTION ---
  // Replaces the auto-sync effect to give user manual control
  const handleUpdateDraft = async () => {
     if (!userPrompt && referenceImages.length === 0) return;
     setIsUpdatingDraft(true);
     try {
         const newPrompt = await constructTechnicalPrompt(
            userPrompt,
            customStyle || selectedStyle,
            referenceImages,
            useBorder,
            typographyStyle,
            isTypographyEnabled,
            textPlacement,
            imageRole,
            layoutMode === 'sheet',
            bgColor
         );
         setDraftPrompt(newPrompt);
         showToast("Technical prompt updated", 'success');
     } catch(e) {
         console.error("Manual sync failed", e);
         showToast("Failed to update prompt", 'error');
     } finally {
         setIsUpdatingDraft(false);
     }
  };


  const handleRename = (newName: string) => {
      if (!activeImage) return;
      setImages(prev => prev.map(img => img.id === activeImage.id ? { ...img, name: newName } : img));
  };

  const handleAutoName = async () => {
      if (!activeImage) return;
      try {
          const context = activeImage.finalPrompt || activeImage.prompt || "Sticker";
          const name = await generateStickerName(context);
          const cleanName = name.replace(/['"]/g, '').trim();
          handleRename(cleanName);
      } catch(e) {
          console.error(e);
      }
  };

  const handleAnalyze = async () => {
    if (!userPrompt && referenceImages.length === 0) {
        alert("Please provide a prompt or an image to analyze.");
        return;
    }
    
    setGeneratingState('analyze');
    try {
        const analysis = await analyzeBrief(userPrompt, referenceImages);
        
        let newCategory = activeCategory;
        let newStyle = selectedStyle;
        let newSubject = userPrompt;
        let newTypography = typographyStyle;
        let newPlacement = textPlacement;
        let typographyEnabledState = isTypographyEnabled; // Track local state

        // 1. Handle Categorization (List-Based)
        if (analysis.recommendedCategory && STYLE_CATEGORIES[analysis.recommendedCategory]) {
           newCategory = analysis.recommendedCategory;
           setActiveCategory(newCategory);
           
           const styles = STYLE_CATEGORIES[newCategory];
           const styleExists = styles.some(s => s.name === analysis.recommendedStyle);
           
           if (styleExists) {
              newStyle = analysis.recommendedStyle;
              setSelectedStyle(newStyle);
           } else if (styles.length > 0) {
              newStyle = styles[0].name;
              setSelectedStyle(newStyle);
           }
        }
        
        // 2. Handle Custom Style (Override)
        if (analysis.customStyleDescription) {
            setCustomStyle(analysis.customStyleDescription);
            // We can optionally show a toast about this override
            showToast("Custom style detected & applied!", 'success');
        } else {
            setCustomStyle(''); // Clear override if standard style is found
        }

        if (analysis.refinedSubject) {
             newSubject = analysis.refinedSubject;
             setUserPrompt(newSubject);
        }
           
        // Automatically enable typography ONLY if detected (via quotes) OR already enabled
        const hasQuotedText = /["']/.test(newSubject);
           
        if (analysis.recommendedTypographyStyle) {
               if (hasQuotedText || typographyEnabledState) {
                   typographyEnabledState = true;
                   setIsTypographyEnabled(true);
                   newTypography = analysis.recommendedTypographyStyle;
                   setTypographyStyle(newTypography);
                   
                   if (analysis.recommendedTextPlacement) {
                       newPlacement = analysis.recommendedTextPlacement;
                       setTextPlacement(newPlacement);
                   }
               }
        }

        // Generate the technical preview using the newly analyzed values
        // Note: We prioritize customStyleDescription if it exists
        const styleToUse = analysis.customStyleDescription || newStyle;

        const technicalPreview = await constructTechnicalPrompt(
            newSubject,
            styleToUse,
            referenceImages,
            useBorder,
            newTypography,
            typographyEnabledState,
            newPlacement,
            imageRole,
            layoutMode === 'sheet',
            bgColor
        );
        
        setDraftPrompt(technicalPreview);
        showToast("Brief analysis complete", 'success');

    } catch (e: any) {
        console.error("Auto-Analysis Error:", e);
        showToast("Analysis failed. Please try again.", 'error');
    } finally {
        setGeneratingState('idle');
    }
  };

  const handleGenerate = async (manualOverride?: string) => {
    if (!userPrompt && referenceImages.length === 0) return;
    
    // API KEY CHECK for Pro Model
    if (window.aistudio) {
        if (!await window.aistudio.hasSelectedApiKey()) {
            await window.aistudio.openSelectKey();
            // Proceed assuming success due to race condition handling instruction
        }
    }

    setGeneratingState('draft_single');
    showToast("Generating asset...", 'info');
    try {
        // Use manualOverride (from technical prompt box) if available
        const { url, finalPrompt } = await generateSticker(
            userPrompt, customStyle || selectedStyle, false, 1, 2, referenceImages,
            'both', 'medium', true, manualOverride, 'balanced', false, useBorder, typographyStyle, isTypographyEnabled,
            false, textPlacement, imageRole, bgColor
        );
        const newImg: StickerImage = { 
          id: generateId(), 
          url, 
          name: "Sticker Preview", 
          type: 'generated', 
          createdAt: Date.now(), 
          prompt: userPrompt, 
          finalPrompt, 
          style: customStyle || selectedStyle, 
          isPreview: true, 
          isGrid: false,
          referenceImages: [...referenceImages] 
        };
        setImages(prev => [newImg, ...prev]);
        setActiveImageId(newImg.id);
    } catch (e: any) { 
       alert(e); 
    } finally { setGeneratingState('idle'); }
  };
  
  const handleGenerateVariations = async (manualOverride?: string) => {
    if (!userPrompt && referenceImages.length === 0) return;

    // API KEY CHECK for Pro Model
    if (window.aistudio) {
        if (!await window.aistudio.hasSelectedApiKey()) {
            await window.aistudio.openSelectKey();
        }
    }

    setGeneratingState('draft_grid');
    showToast("Generating grid variations...", 'info');
    try {
        // Trigger 2x2 grid generation, using manualOverride if provided
        const { url, finalPrompt } = await generateSticker(
            userPrompt, customStyle || selectedStyle, false, 4, 2, referenceImages,
            'both', 'medium', true, manualOverride, 'balanced', false, useBorder, typographyStyle, isTypographyEnabled,
            true, // variationGrid = true
            textPlacement, imageRole, bgColor
        );
        const newImg: StickerImage = { 
          id: generateId(), 
          url, 
          name: "2x2 Variations", 
          type: 'generated', 
          createdAt: Date.now(), 
          prompt: userPrompt, 
          finalPrompt, 
          style: customStyle || selectedStyle, 
          isPreview: true,
          isGrid: true, // Mark as grid
          referenceImages: [...referenceImages] 
        };
        setImages(prev => [newImg, ...prev]);
        setActiveImageId(newImg.id);
    } catch (e: any) { alert(e); } finally { setGeneratingState('idle'); }
  };

  const handleRegenerate = async (manualPrompt: string, isGrid: boolean) => {
    if (!activeImage) return;

    // API KEY CHECK for Pro Model
    if (window.aistudio) {
        if (!await window.aistudio.hasSelectedApiKey()) {
            await window.aistudio.openSelectKey();
        }
    }

    setGeneratingState(isGrid ? 'draft_grid' : 'draft_single');
    showToast("Re-running generation command...", 'info');
    try {
        // Use manualPrompt to bypass prompt engineering, allowing exact prompt execution.
        const { url, finalPrompt } = await generateSticker(
            "", // User prompt ignored
            activeImage.style || selectedStyle, 
            false, 
            isGrid ? 4 : 1, 
            2, 
            activeImage.referenceImages || [],
            'both', 'medium', true, 
            manualPrompt, // Pass the edited text here
            'balanced', false, useBorder, typographyStyle, isTypographyEnabled,
            isGrid, // Maintain grid state
            textPlacement, imageRole, bgColor
        );
        
        const newImg: StickerImage = { 
          id: generateId(), 
          url, 
          name: isGrid ? "2x2 Remix" : "Sticker Remix", 
          type: 'generated', 
          createdAt: Date.now(), 
          prompt: activeImage.prompt, 
          finalPrompt, 
          style: activeImage.style, 
          isPreview: true, 
          isGrid: isGrid,
          referenceImages: activeImage.referenceImages 
        };
        setImages(prev => [newImg, ...prev]);
        setActiveImageId(newImg.id);
    } catch (e: any) { alert(e); } finally { setGeneratingState('idle'); }
  };

  // --- REWIRED UPSCALING LOGIC ---
  const handleFinalize = async () => {
    if (!activeImage) return;
    if (window.aistudio) {
        if (!await window.aistudio.hasSelectedApiKey()) {
            await window.aistudio.openSelectKey();
        }
    }
    setGeneratingState('final');
    showToast("Initializing AI Upscaler...", 'info');
    try {
        // Use the NEW dedicated upscaler service
        const basePrompt = activeImage.finalPrompt || activeImage.prompt || "Sticker";
        const upscaledUrl = await upscaleImage(activeImage.url, basePrompt, useBorder);

        const newImg: StickerImage = { 
            id: generateId(), 
            url: upscaledUrl, 
            name: "Final 4K Asset", 
            type: 'generated', 
            createdAt: Date.now(), 
            prompt: activeImage.prompt, 
            finalPrompt: activeImage.finalPrompt, 
            style: activeImage.style, 
            isPreview: false, 
            isGrid: false, 
            referenceImages: activeImage.referenceImages 
        };
        setImages(prev => [newImg, ...prev]);
        setActiveImageId(newImg.id);
        showToast("Upscaling Complete (4K)", 'success');
    } catch (e: any) { 
        console.error(e);
        showToast("Upscaling failed: " + e.message, 'error'); 
    } finally { setGeneratingState('idle'); }
  };

  const handleSliceGrid = async () => {
    if (!activeImage) return;
    setIsSlicing(true);
    showToast("Analyzing grid structure...", 'info');
    try {
       // Use the new advanced scanline slicer
       const sprites = await sliceGrid2x2(activeImage.url);
       
       const newStickers = sprites.map((s, i) => ({
          id: generateId(),
          url: s.url,
          name: `${activeImage.name} (Q${i+1})`,
          type: 'generated' as const,
          createdAt: Date.now(),
          prompt: activeImage.prompt,
          style: activeImage.style,
          isPreview: false,
          stickerCount: 1,
          isGrid: false,
          isCutout: true,
          parentId: activeImage.id
       }));
       
       setImages(prev => [...newStickers, ...prev]);
       if (newStickers.length > 0) setActiveImageId(newStickers[0].id);
       showToast(`Sliced into ${newStickers.length} assets`, 'success');
    } catch(e: any) {
       alert("Slicing failed: " + e);
    } finally {
       setIsSlicing(false);
    }
  };

  const handleRevert = () => {
     if (!activeImage || !activeImage.parentId) return;
     const parentId = activeImage.parentId;
     
     // Optional: remove current if strictly reverting
     // For now, just switch back to parent for safety history
     if (parentId) {
         setActiveImageId(parentId);
         showToast("Reverted to original", 'info');
     }
  };

  return (
    <div className="w-full h-full flex flex-col md:flex-row bg-[#1e1e1e] text-[#cccccc] font-sans overflow-hidden">
        {/* INCREASED WIDTH from 630px to 780px */}
        <div className="w-full md:w-[780px] shrink-0 h-full overflow-hidden">
            <BriefPanel 
               userPrompt={userPrompt} setUserPrompt={setUserPrompt}
               activeCategory={activeCategory} setActiveCategory={setActiveCategory}
               selectedStyle={selectedStyle} setSelectedStyle={setSelectedStyle}
               typographyStyle={typographyStyle} setTypographyStyle={setTypographyStyle}
               isTypographyEnabled={isTypographyEnabled} setIsTypographyEnabled={setIsTypographyEnabled}
               textPlacement={textPlacement} setTextPlacement={setTextPlacement}
               customStyle={customStyle} setCustomStyle={setCustomStyle}
               useBorder={useBorder} setUseBorder={setUseBorder}
               referenceImages={referenceImages} setReferenceImages={setReferenceImages}
               referenceMode={referenceMode} setReferenceMode={setReferenceMode}
               fidelity={fidelity} setFidelity={setFidelity}
               subjectGuidance={subjectGuidance} setSubjectGuidance={setSubjectGuidance}
               onAnalyze={() => handleAnalyze()} 
               isAnalyzing={generatingState === 'analyze'}
               imageRole={imageRole} setImageRole={setImageRole}
               layoutMode={layoutMode} setLayoutMode={setLayoutMode}
               onUpdatePrompt={handleUpdateDraft} isUpdatingPrompt={isUpdatingDraft}
               bgColor={bgColor} setBgColor={setBgColor}
            />
        </div>

        <div className="flex-1 flex flex-col min-w-0 relative">
            <div className="h-10 border-b border-[#3e3e42] flex items-center justify-between px-6 bg-[#252526] shrink-0">
                <h1 className="font-bold text-sm text-white tracking-widest uppercase">StickerGenie PRO</h1>
                <div className="flex gap-4">
                    <button onClick={() => setShowSourceExplorer(true)} className="text-xs uppercase text-[#555] hover:text-[#888]">Explorer</button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative flex items-center justify-center bg-grid-pattern">
                 {activeImage ? (
                    <div className="relative shadow-2xl animate-in zoom-in duration-300">
                       <img src={activeImage.url} className="max-w-[85%] max-h-[70vh] object-contain border border-[#3e3e42] bg-checkered-dark" />
                       {isSlicing && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-4 z-50">
                             <div className="w-12 h-12 border-4 border-[#007fd4] border-t-transparent rounded-full animate-spin"></div>
                             <span className="text-xs font-mono font-bold text-[#007fd4] tracking-widest uppercase animate-pulse">Processing...</span>
                          </div>
                       )}
                    </div>
                 ) : (
                    <div className="text-center opacity-10 select-none">
                       <div className="text-[10rem] font-mono font-bold tracking-tighter leading-none">IDLE</div>
                    </div>
                 )}
            </div>

            <div className="h-32 bg-[#252526] border-t border-[#3e3e42] overflow-x-auto flex items-center px-4 gap-4 shrink-0 custom-scrollbar">
                {images.map(img => <ImageCard key={img.id} image={img} isActive={activeImageId === img.id} onClick={() => setActiveImageId(img.id)} />)}
            </div>

            <div className={`h-8 flex items-center px-4 justify-between text-xs font-mono shrink-0 uppercase tracking-widest text-white bg-[#007fd4]`}>
                <span>PTR: {generatingState === 'idle' ? 'READY' : generatingState.toUpperCase()}</span>
                <span>MODE: CREATIVE PIPELINE</span>
            </div>
        </div>

        {/* INCREASED WIDTH from 570px to 700px */}
        <div className="w-full md:w-[700px] shrink-0 h-full border-l border-[#3e3e42] overflow-hidden bg-[#252526]">
            <InspectorPanel 
               activeImage={activeImage} generatingState={generatingState}
               draftPrompt={draftPrompt}
               isUpdatingDraft={isUpdatingDraft}
               onGenerate={handleGenerate} 
               onGenerateVariations={handleGenerateVariations}
               onRegenerate={handleRegenerate}
               onDownload={() => { 
                  if(activeImage) { 
                     const link = document.createElement('a'); 
                     link.href = activeImage.url; 
                     
                     let name = activeImage.name;
                     // Append prompt snippet to generic names only if name hasn't been customized by Auto Name
                     // A simple check is if it is one of the default names
                     if ((name === 'Sticker Preview' || name === 'Final Asset' || name === '2x2 Variations' || name === 'Sticker Remix') && activeImage.prompt) {
                         const promptSlug = activeImage.prompt.split(' ').slice(0, 3).join('_');
                         name = `${name}_${promptSlug}`;
                     }
          
                     const safeName = name
                        .replace(/[^a-z0-9\s-]/gi, '')
                        .trim()
                        .replace(/\s+/g, '_')
                        .toLowerCase();
                        
                     link.download = `${safeName || 'sticker'}.png`; 
                     link.click(); 
                  }
               }}
               onRemoveBackground={(settings) => {
                  if(!activeImage) return;
                  setIsSlicing(true);
                  showToast(`Removing background (${settings.method})...`, 'info');
                  
                  // NEW: Using the Advanced Background Extractor
                  processSticker(activeImage.url, settings).then(sprite => {
                      const n: StickerImage = { 
                          id: generateId(), 
                          url: sprite.url, 
                          name: `${activeImage.name} (Cutout)`, 
                          type: 'generated', 
                          createdAt: Date.now(),
                          prompt: activeImage.prompt,
                          style: activeImage.style,
                          isCutout: true, 
                          isGrid: false,
                          parentId: activeImage.id
                      };
                      setImages(p => [n, ...p]);
                      setActiveImageId(n.id);
                      showToast("Background extracted successfully", 'success');
                  }).catch(e => {
                      console.error(e);
                      showToast("Extraction failed: " + e.message, 'error');
                  }).finally(() => setIsSlicing(false));
               }} 
               onModifyDraft={(prompt) => {
                 if (activeImage) {
                   setImages(prev => prev.map(img => img.id === activeImage.id ? { ...img, finalPrompt: prompt } : img));
                 }
               }} 
               onFinalize={handleFinalize} onRequestRevision={() => setShowRevisionStudio(true)}
               onSliceGrid={handleSliceGrid}
               onOpenSlicer={() => setShowSpriteCutter(true)}
               extractionSettings={extractionSettings}
               setExtractionSettings={setExtractionSettings}
               onRename={handleRename}
               onAutoName={handleAutoName}
               layoutMode={layoutMode}
               onRevert={handleRevert}
            />
        </div>

        {showSourceExplorer && <SourceExplorer onClose={() => setShowSourceExplorer(false)} />}
        {showRevisionStudio && activeImage && <RevisionStudio originalImage={activeImage} onClose={() => setShowRevisionStudio(false)} onSave={(n) => { setImages(p => [n, ...p]); setActiveImageId(n.id); }} />}
        {showSpriteCutter && activeImage && (
            <SpriteCutter 
               sourceImage={activeImage}
               onClose={() => setShowSpriteCutter(false)}
               onAddSprites={(newSprites) => {
                   setImages(prev => [...newSprites, ...prev]);
                   if (newSprites.length > 0) setActiveImageId(newSprites[0].id);
                   showToast(`Added ${newSprites.length} cutouts from slicer`, 'success');
               }}
            />
        )}
        
        <Toast toast={toast} onClose={() => setToast({ ...toast, visible: false })} />
    </div>
  );
};

export default App;
