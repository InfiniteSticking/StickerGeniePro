
export interface StickerImage {
  id: string;
  url: string; 
  name: string;
  type: 'uploaded' | 'generated';
  createdAt: number;
  prompt?: string;
  finalPrompt?: string;
  style?: string;
  parentId?: string;
  isPreview?: boolean;
  isCutout?: boolean;
  isDeepCutout?: boolean; 
  hasBorder?: boolean; 
  referenceImages?: string[];
  referenceMode?: 'style' | 'content' | 'both';
  stickerCount?: number;
  isGrid?: boolean; 
}

export interface ProcessedSprite {
  id: string;
  url: string;
  width: number;
  height: number;
  blob: Blob;
}

export interface ProcessorOptions {
  mode: 'smart' | 'grid';
  tolerance: number;
  erosion: number;
  rows: number;
  cols: number;
  banishBorder?: boolean; 
  removeHoles?: boolean; 
  borderWidth?: number; 
  borderColor?: string; 
  trim?: number; 
  cropToSubject?: boolean;
  customBgColor?: string;
  preserveCanvas?: boolean;
  keepBackground?: boolean;
  customGrid?: {
    xLines: number[]; // Normalized 0-1 positions
    yLines: number[]; // Normalized 0-1 positions
  };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ExtractionMethod = 'flood_fill' | 'luma_key' | 'lab_difference';

export interface ExtractionConfig {
  method: ExtractionMethod;
  tolerance: number;      // 0-100
  softness: number;       // 0-10 px
  erosion: number;        // 0-10 px (Replaces defringe)
  smartFill: boolean;
  borderWidth: number;    // 0-50 px
  outputSize: number;     // e.g. 1024
}

export interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
  visible: boolean;
}

export interface UITheme {
  id: string;
  bgApp: string;
  bgPattern?: string;    
  bgPanel: string;
  bgPaper: string;
  textMain: string;
  textMuted: string;
  accentPrimary: string;
  accentSecondary: string;
  border: string;        
  borderDashed: string;
  selectionBorder: string;
  selectionRing: string;
  radiusLg: string;      
  radiusMd: string;      
  radiusSm: string;      
  shadow: string;        
  fontFamily: string;    
  buttonGhost: string;
  iconColor: string;
}
