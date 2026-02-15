
import { ProcessedSprite, ProcessorOptions, Rect } from '../types';

/**
 * SLICING ENGINE v2.0
 * Separates "Detection" (Finding bounds) from "Extraction" (Creating blobs).
 * This allows the UI to render overlays before committing to a cut.
 */

// --- HELPER: Load Image ---
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

// --- HELPER: Color Distance ---
const colorDist = (r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) => {
    return Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2));
};

// --- CORE: Detection Logic ---

export const detectSegments = async (imageSrc: string, options: ProcessorOptions): Promise<Rect[]> => {
    const img = await loadImage(imageSrc);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];
    
    ctx.drawImage(img, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (options.mode === 'grid') {
        const rects: Rect[] = [];

        // If Custom Grid is active (Interactive Mode), use specific cuts
        if (options.customGrid) {
            const xs = [0, ...options.customGrid.xLines.map(p => p * width), width].sort((a,b) => a-b);
            const ys = [0, ...options.customGrid.yLines.map(p => p * height), height].sort((a,b) => a-b);
            
            for (let r = 0; r < ys.length - 1; r++) {
                for (let c = 0; c < xs.length - 1; c++) {
                    const x1 = xs[c];
                    const x2 = xs[c+1];
                    const y1 = ys[r];
                    const y2 = ys[r+1];
                    rects.push({
                        x: Math.round(x1),
                        y: Math.round(y1),
                        w: Math.round(x2 - x1),
                        h: Math.round(y2 - y1)
                    });
                }
            }
        } else {
            // Fallback to standard even distribution
            const rows = Math.max(1, options.rows);
            const cols = Math.max(1, options.cols);
            const cellW = width / cols;
            const cellH = height / rows;
            
            for(let r=0; r<rows; r++) {
                for(let c=0; c<cols; c++) {
                    rects.push({ x: c * cellW, y: r * cellH, w: cellW, h: cellH });
                }
            }
        }
        return rects;
    } 
    
    // For Smart/Scanline, we need a binary map of "Content vs Background"
    const isContent = new Uint8Array(width * height);
    const tolerance = options.tolerance || 20;
    
    // Auto-detect background from corners (simplified)
    const bgR = data[0], bgG = data[1], bgB = data[2];
    
    for(let i=0; i<width*height; i++) {
        const r = data[i*4], g = data[i*4+1], b = data[i*4+2];
        if (colorDist(r,g,b, bgR,bgG,bgB) > tolerance * 3) {
            isContent[i] = 1;
        }
    }

    if (options.mode === 'smart') {
        // Connected Components
        const visited = new Uint8Array(width * height);
        const rects: Rect[] = [];
        const minArea = 400; // Ignore tiny specks

        for(let i=0; i<width*height; i++) {
            if (isContent[i] === 1 && visited[i] === 0) {
                // Flood fill this component
                let minX = i%width, maxX = i%width, minY = Math.floor(i/width), maxY = Math.floor(i/width);
                let count = 0;
                const stack = [i];
                visited[i] = 1;
                
                while(stack.length) {
                    const idx = stack.pop()!;
                    const x = idx%width;
                    const y = Math.floor(idx/width);
                    count++;
                    
                    if(x < minX) minX = x;
                    if(x > maxX) maxX = x;
                    if(y < minY) minY = y;
                    if(y > maxY) maxY = y;

                    const neighbors = [idx-1, idx+1, idx-width, idx+width];
                    for(const n of neighbors) {
                        if(n >= 0 && n < width*height && visited[n] === 0 && isContent[n] === 1) {
                            const nx = n%width;
                            // prevent wrap-around logic errors
                            if (Math.abs(nx - x) <= 1) { 
                                visited[n] = 1;
                                stack.push(n);
                            }
                        }
                    }
                }
                
                if (count > minArea) {
                    // Add padding
                    const pad = options.trim || 10;
                    rects.push({
                        x: Math.max(0, minX - pad),
                        y: Math.max(0, minY - pad),
                        w: Math.min(width, maxX + pad) - Math.max(0, minX - pad),
                        h: Math.min(height, maxY + pad) - Math.max(0, minY - pad)
                    });
                }
            }
        }
        return rects;
    }
    
    return [];
};

// --- CORE: Extraction Logic ---

export const sliceImage = async (
  imageSrc: string,
  options: ProcessorOptions
): Promise<ProcessedSprite[]> => {
    const rects = await detectSegments(imageSrc, options);
    const img = await loadImage(imageSrc);
    
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const sprites: ProcessedSprite[] = [];

    for (const rect of rects) {
        if (rect.w < 1 || rect.h < 1) continue;

        const sCanvas = document.createElement('canvas');
        sCanvas.width = rect.w;
        sCanvas.height = rect.h;
        const sCtx = sCanvas.getContext('2d');
        if (!sCtx) continue;

        // Draw Black Background first (to ensure clean cutout edges)
        sCtx.fillStyle = 'black';
        sCtx.fillRect(0,0,rect.w, rect.h);

        sCtx.drawImage(
            canvas,
            rect.x, rect.y, rect.w, rect.h,
            0, 0, rect.w, rect.h
        );

        const url = sCanvas.toDataURL('image/png');
        const blob = await new Promise<Blob | null>(r => sCanvas.toBlob(r, 'image/png'));
        
        if (blob) {
            sprites.push({
                id: crypto.randomUUID(),
                url,
                width: rect.w,
                height: rect.h,
                blob
            });
        }
    }
    
    return sprites;
};
