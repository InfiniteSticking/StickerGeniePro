
import React from 'react';
import { downloadFile } from '../utils/fileDownloader';

interface FileDefinition {
  path: string;
  category: string;
  content: string;
}

interface SourceExplorerProps {
  onClose: () => void;
}

export const SourceExplorer: React.FC<SourceExplorerProps> = ({ onClose }) => {
  const files: FileDefinition[] = [
    { 
      path: 'index.html', 
      category: 'Root', 
      content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <title>StickerGenie</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
      :root { --app-height: 100dvh; }
      body {
        font-family: 'Nunito', sans-serif;
        background-color: #f8faff; 
        color: #1e293b; 
        margin: 0; padding: 0;
        min-height: var(--app-height);
        width: 100vw; overflow-x: hidden;
      }
      h1, h2, h3, button { font-family: 'Fredoka', sans-serif; }
      .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #ddd6fe; border-radius: 99px; }
      .bg-pattern-dots {
        background-color: #f8faff;
        background-image: radial-gradient(#e0e7ff 2px, transparent 2px);
        background-size: 32px 32px;
      }
      .bg-checkered {
        background-image: linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%);
        background-size: 20px 20px;
        background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
      }
    </style>
  <script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@^19.2.3",
    "react-dom/": "https://esm.sh/react-dom@^19.2.3/",
    "react/": "https://esm.sh/react@^19.2.3/",
    "@google/genai": "https://esm.sh/@google/genai@^1.33.0",
    "jszip": "https://esm.sh/jszip@3.10.1"
  }
}
</script>
</head>
  <body class="bg-[#f8faff] text-slate-800 antialiased selection:bg-indigo-100">
    <div id="root"></div>
  </body>
</html>` 
    },
    { 
      path: 'types.ts', 
      category: 'Logic', 
      content: `export interface StickerImage {
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
  referenceImages?: string[];
  referenceMode?: 'style' | 'content' | 'both';
  stickerCount?: number;
}
export interface ProcessedSprite { id: string; url: string; width: number; height: number; blob: Blob; }
export interface ProcessorOptions { mode: 'smart' | 'grid'; tolerance: number; erosion: number; rows: number; cols: number; }
export interface ToastState { message: string; type: 'success' | 'error' | 'info'; visible: boolean; }
export interface UITheme {
  id: string;
  bgApp: string; bgPattern?: string; bgPanel: string; bgPaper: string;
  textMain: string; textMuted: string;
  accentPrimary: string; accentSecondary: string;
  border: string; borderDashed: string; selectionBorder: string; selectionRing: string;
  radiusLg: string; radiusMd: string; radiusSm: string;
  shadow: string; fontFamily: string; buttonGhost: string; iconColor: string;
}` 
    },
    { 
      path: 'utils/slicingUtil.ts', 
      category: 'Utilities', 
      content: `import { ProcessedSprite, ProcessorOptions } from '../types';

interface ExtendedProcessorOptions extends ProcessorOptions {
  customBgColor?: string;
  preserveCanvas?: boolean; 
}

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

const isMatch = (r: number, g: number, b: number, bgR: number, bgG: number, bgB: number, tolerance: number): boolean => {
  const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
  return diff <= tolerance;
};

export const sliceImage = async (imageSrc: string, options: ExtendedProcessorOptions): Promise<ProcessedSprite[]> => {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get canvas context');
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { width, height, data } = imageData;

  if (options.mode === 'grid') return sliceGrid(img, options.rows, options.cols);

  let bgR = data[0], bgG = data[1], bgB = data[2];
  if (options.customBgColor) {
    const rgb = hexToRgb(options.customBgColor);
    if (rgb) { bgR = rgb.r; bgG = rgb.g; bgB = rgb.b; }
  }

  const isBackground = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const tolerance = options.tolerance * 3;
  const queue: number[] = [0]; visited[0] = 1; isBackground[0] = 1;
  const dx = [0, 0, -1, 1], dy = [-1, 1, 0, 0];
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const x = idx % width, y = Math.floor(idx / width);
    for (let i = 0; i < 4; i++) {
      const nx = x + dx[i], ny = y + dy[i];
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nIdx = ny * width + nx;
        if (!visited[nIdx]) {
          const r = data[nIdx * 4], g = data[nIdx * 4 + 1], b = data[nIdx * 4 + 2];
          if (isMatch(r, g, b, bgR, bgG, bgB, tolerance)) {
            visited[nIdx] = 1; isBackground[nIdx] = 1; queue.push(nIdx);
          }
        }
      }
    }
  }

  if (options.erosion > 0) {
    for (let e = 0; e < options.erosion; e++) {
      const toMarkAsBackground: number[] = [];
      for (let i = 0; i < width * height; i++) {
        if (isBackground[i] === 0) {
          const x = i % width, y = Math.floor(i / width);
          let touchesBg = false;
          if (x > 0 && isBackground[i - 1] === 1) touchesBg = true;
          else if (x < width - 1 && isBackground[i + 1] === 1) touchesBg = true;
          else if (y > 0 && isBackground[i - width] === 1) touchesBg = true;
          else if (y < height - 1 && isBackground[i + width] === 1) touchesBg = true;
          if (touchesBg) toMarkAsBackground.push(i);
        }
      }
      for (const idx of toMarkAsBackground) isBackground[idx] = 1;
    }
  }

  const sprites: ProcessedSprite[] = [];
  if (options.preserveCanvas) {
    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = width; spriteCanvas.height = height;
    const spriteCtx = spriteCanvas.getContext('2d');
    if (spriteCtx) {
      const spriteImageData = spriteCtx.createImageData(width, height);
      for (let i = 0; i < width * height; i++) {
        const tIdx = i * 4;
        if (isBackground[i] === 1) spriteImageData.data[tIdx + 3] = 0;
        else {
          spriteImageData.data[tIdx] = data[tIdx]; spriteImageData.data[tIdx+1] = data[tIdx+1];
          spriteImageData.data[tIdx+2] = data[tIdx+2]; spriteImageData.data[tIdx+3] = 255;
        }
      }
      spriteCtx.putImageData(spriteImageData, 0, 0);
      const url = spriteCanvas.toDataURL('image/png');
      const blob = await new Promise<Blob | null>((r) => spriteCanvas.toBlob(r, 'image/png'));
      if (blob) sprites.push({ id: crypto.randomUUID(), url, width, height, blob });
    }
    return sprites;
  }
  return sprites;
};` 
    },
    { 
      path: 'services/geminiService.ts', 
      category: 'Services', 
      content: `import { GoogleGenAI, HarmCategory, HarmBlockThreshold, GenerateContentResponse } from "@google/genai";
import { STICKER_OPTIMIZER_PROMPT, MODEL_NAME, FAST_IMAGE_MODEL_NAME, TEXT_MODEL_NAME, FAST_TEXT_MODEL_NAME } from "../constants";

const stripBase64Prefix = (base64: string): string => base64.replace(/^data:image\\/(png|jpeg|jpg|webp);base64,/, "");
const getMimeType = (base64: string): string => {
    const match = base64.match(/^data:(image\\/\\w+);base64,/);
    return match ? match[1] : 'image/png';
};
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });
const callWithRetry = async <T>(fn: () => Promise<T>, retries = 3): Promise<T> => {
    for (let i = 0; i < retries; i++) {
        try { return await fn(); }
        catch (error: any) {
            if (i === retries - 1) throw error;
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    throw new Error("Failed");
};

export const generateSticker = async (prompt: string, style: string, isSheet: boolean, count: number, border: number, refs: string[] = []) => {
    const ai = getAI();
    const model = FAST_IMAGE_MODEL_NAME;
    const contents = [{ parts: [{ text: \`\${prompt}, \${style} sticker style, solid black background\` }] }];
    const res = await ai.models.generateContent({ model, contents });
    const part = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!part) throw new Error("No image");
    return { url: \`data:image/png;base64,\${part.inlineData.data}\`, finalPrompt: prompt };
};
export const generateStickerName = async (prompt: string) => "Mystic Sticker";` 
    },
    { path: 'constants.ts', category: 'Logic', content: `export const MODEL_NAME = 'gemini-3-pro-image-preview';\nexport const FAST_IMAGE_MODEL_NAME = 'gemini-2.5-flash-image';\nexport const STYLE_CATEGORIES = { "Cute": ["Kawaii"] };` },
    { path: 'metadata.json', category: 'Root', content: `{\n  "name": "StickerGenie",\n  "description": "AI-powered sticker studio.",\n  "requestFramePermissions": []\n}` }
  ];

  const categories = Array.from(new Set(files.map(f => f.category)));

  return (
    <div className="fixed inset-0 z-[400] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl max-h-[80vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-display text-slate-800">Source Manifest</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Download individual codebase files</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {categories.map(cat => (
            <div key={cat} className="space-y-3">
              <h3 className="text-[11px] font-bold text-indigo-500 uppercase tracking-[0.2em] ml-2">{cat}</h3>
              <div className="grid gap-2">
                {files.filter(f => f.category === cat).map(file => (
                  <div key={file.path} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-200 transition-colors">
                    <span className="text-xs font-mono text-slate-600 truncate mr-4">{file.path}</span>
                    <button onClick={() => downloadFile(file.path, file.content)} className="shrink-0 px-4 py-2 bg-white text-indigo-600 border border-indigo-100 rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-sm hover:bg-indigo-600 hover:text-white transition-all">Download</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};