
import { ExtractionConfig, ProcessedSprite } from '../types';

/**
 * StickerGenie Extractor v5.0 (Flood Fill & Erode Only)
 * 
 * Simplified Pipeline:
 * 1. Flood Fill (from corners) -> Binary Mask
 * 2. Smart Fill (Fill internal holes)
 * 3. Erosion (Physically shrink mask to remove black halos)
 * 4. Crop to Subject
 * 5. Optional White Border (Dilate)
 */

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

// --- ALGORITHMS ---

const generateFloodFillMask = (
  data: Uint8ClampedArray, 
  w: number, 
  h: number, 
  tolerance: number
): Uint8Array => {
  const mask = new Uint8Array(w * h); // 0 = Background, 1 = Foreground
  const visited = new Uint8Array(w * h);
  
  // Start from all 4 corners to catch background even if it's not contiguous
  const stack: number[] = [0, w-1, (h-1)*w, (h*w)-1];
  stack.forEach(i => visited[i] = 1);

  // Background color reference (Top Left)
  const bgR = data[0], bgG = data[1], bgB = data[2];
  
  // Tolerance calculation (Euclidean distance squared)
  // Max distance is roughly 441. Tolerance 0-100 maps to this.
  const t = tolerance * 4.42; 
  const threshSq = t * t;

  while (stack.length) {
    const i = stack.pop()!;
    mask[i] = 0; // Visited via flood fill = Background
    
    const x = i % w;
    const neighbors = [i-1, i+1, i-w, i+w];

    for (const n of neighbors) {
        if (n >= 0 && n < w*h) {
            const nx = n % w;
            if (Math.abs(nx - x) > 1) continue; // Wrap guard

            if (visited[n] === 0) {
                const r = data[n*4], g = data[n*4+1], b = data[n*4+2];
                const dist = (r-bgR)**2 + (g-bgG)**2 + (b-bgB)**2;
                
                if (dist <= threshSq) {
                    visited[n] = 1;
                    stack.push(n);
                }
            }
        }
    }
  }
  
  // Invert: Visited nodes are Background (0). Everything else is Foreground (1).
  for(let i=0; i<mask.length; i++) mask[i] = visited[i] === 1 ? 0 : 1;
  
  return mask;
};

const generateGlobalMask = (
  data: Uint8ClampedArray, 
  w: number, 
  h: number, 
  tolerance: number
): Uint8Array => {
  const mask = new Uint8Array(w * h);
  
  // Background color reference (Top Left)
  const bgR = data[0], bgG = data[1], bgB = data[2];
  
  const t = tolerance * 4.42; 
  const threshSq = t * t;

  for (let i = 0; i < w * h; i++) {
      const r = data[i*4], g = data[i*4+1], b = data[i*4+2];
      const dist = (r-bgR)**2 + (g-bgG)**2 + (b-bgB)**2;
      
      // If matches background, it's 0. Else 1.
      mask[i] = dist <= threshSq ? 0 : 1;
  }
  return mask;
};

// Shrink the mask (Erosion) to remove halos
const erode = (mask: Uint8Array, w: number, h: number, passes: number) => {
    if (passes <= 0) return mask;
    let curr = new Uint8Array(mask);
    let next = new Uint8Array(mask);
    
    for(let p=0; p<passes; p++) {
        for(let i=0; i<mask.length; i++) {
            if (curr[i] === 1) {
                // If ANY neighbor is 0 (Background), I become 0
                // This effectively peels off one layer of pixels from the edge
                const n = [i-1, i+1, i-w, i+w];
                let erase = false;
                for(const idx of n) {
                   if (idx >= 0 && idx < mask.length && curr[idx] === 0) {
                       erase = true; break;
                   }
                }
                if(erase) next[i] = 0;
            }
        }
        curr.set(next);
    }
    return curr;
};

// Grow the mask (Dilation) for the white border
const dilate = (mask: Uint8Array, w: number, h: number, passes: number) => {
    if (passes <= 0) return mask;
    let curr = new Uint8Array(mask);
    let next = new Uint8Array(mask);

    for(let p=0; p<passes; p++) {
        for(let i=0; i<mask.length; i++) {
            if(curr[i] === 0) {
                // If ANY neighbor is 1 (Foreground), I become 1
                const n = [i-1, i+1, i-w, i+w];
                for(const idx of n) {
                    if(idx>=0 && idx<mask.length && curr[idx]===1) {
                        next[i] = 1; break;
                    }
                }
            }
        }
        curr.set(next);
    }
    return curr;
};

const fillInternalHoles = (mask: Uint8Array, w: number, h: number) => {
    const visited = new Uint8Array(w*h);
    const stack: number[] = [];
    
    // Seed edges - anything reachable from edge is TRUE background
    for(let x=0; x<w; x++) {
        if(mask[x]===0) { stack.push(x); visited[x]=1; }
        const b = (h-1)*w + x;
        if(mask[b]===0) { stack.push(b); visited[b]=1; }
    }
    for(let y=0; y<h; y++) {
        const l = y*w;
        if(mask[l]===0) { stack.push(l); visited[l]=1; }
        const r = y*w + w-1;
        if(mask[r]===0) { stack.push(r); visited[r]=1; }
    }

    while(stack.length) {
        const i = stack.pop()!;
        const neighbors = [i-1, i+1, i-w, i+w];
        const x = i % w;
        for(const n of neighbors) {
            if(n>=0 && n<mask.length && visited[n]===0 && mask[n]===0) {
                 const nx = n%w;
                 if(Math.abs(nx-x)<=1) {
                     visited[n]=1; stack.push(n);
                 }
            }
        }
    }

    // Anything that was 0 (Background) but NOT visited is a hole. Fill it.
    for(let i=0; i<mask.length; i++) {
        if(mask[i]===0 && visited[i]===0) mask[i] = 1;
    }
};

// --- MAIN PROCESS ---

export const processSticker = async (imageSrc: string, config: ExtractionConfig): Promise<ProcessedSprite> => {
    const img = await loadImage(imageSrc);
    const w = img.width;
    const h = img.height;

    // 1. Get Source Data
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const srcData = ctx.getImageData(0, 0, w, h);

    // 2. Generate Binary Mask
    let mask: Uint8Array;
    
    if (config.method === 'luma_key') {
        // Global Color Key (Removes inner voids)
        mask = generateGlobalMask(srcData.data, w, h, config.tolerance);
    } else {
        // Flood Fill (Contiguous - Preserves inner details)
        mask = generateFloodFillMask(srcData.data, w, h, config.tolerance);
    }
    
    // 3. Smart Fill (Preserve Eyes/Details)
    if (config.smartFill) fillInternalHoles(mask, w, h);
    
    // 4. EROSION (Crucial step to remove black halos)
    // We shrink the mask by 'config.erosion' pixels.
    if (config.erosion > 0) mask = erode(mask, w, h, config.erosion);

    // 5. Determine Crop Bounds
    let minX=w, maxX=0, minY=h, maxY=0;
    let hasPixels = false;
    for(let i=0; i<mask.length; i++) {
        if(mask[i] === 1) {
            const x = i%w; const y = Math.floor(i/w);
            if(x<minX) minX=x; if(x>maxX) maxX=x;
            if(y<minY) minY=y; if(y>maxY) maxY=y;
            hasPixels = true;
        }
    }
    
    if (!hasPixels) throw new Error("No subject detected. Try 'Loose' tolerance?");

    // 6. Setup Output Dimensions
    const sw = maxX - minX + 1;
    const sh = maxY - minY + 1;
    const maxDim = Math.max(sw, sh);
    const padding = Math.max(config.borderWidth + 20, 40);
    const finalSize = maxDim + (padding * 2);

    const outC = document.createElement('canvas');
    outC.width = finalSize; outC.height = finalSize;
    const outCtx = outC.getContext('2d')!;

    const offX = Math.floor((finalSize - sw) / 2);
    const offY = Math.floor((finalSize - sh) / 2);

    // 7. Generate White Border (Optional)
    if (config.borderWidth > 0) {
        // Create a buffer for the border
        const borderBuf = new Uint8Array(finalSize * finalSize);
        // Place the cropped mask into the center
        for(let y=0; y<sh; y++) {
            for(let x=0; x<sw; x++) {
                const globalIdx = (minY+y)*w + (minX+x);
                if (mask[globalIdx] === 1) {
                    borderBuf[(offY+y)*finalSize + (offX+x)] = 1;
                }
            }
        }
        
        // Dilate it
        const dilated = dilate(borderBuf, finalSize, finalSize, config.borderWidth);
        
        // Draw White Pixels
        const bDat = outCtx.createImageData(finalSize, finalSize);
        for(let i=0; i<dilated.length; i++) {
            if(dilated[i]===1) {
                bDat.data[i*4] = 255;
                bDat.data[i*4+1] = 255;
                bDat.data[i*4+2] = 255;
                bDat.data[i*4+3] = 255;
            }
        }
        outCtx.putImageData(bDat, 0, 0);
    }

    // 8. Composite Subject (Draw cropped pixels on top)
    // We strictly follow the binary mask here. No feathering.
    const finalOutData = outCtx.getImageData(0,0,finalSize,finalSize); 

    for(let y=0; y<sh; y++) {
        for(let x=0; x<sw; x++) {
            const srcIdx = ((minY+y)*w + (minX+x));
            const dstIdx = ((offY+y)*finalSize + (offX+x)) * 4;
            
            if (mask[srcIdx] === 1) {
                // If mask says FG, copy pixel exactly
                // Note: The source image might have anti-aliasing against black.
                // Erosion helps chop that off.
                finalOutData.data[dstIdx] = srcData.data[srcIdx*4];
                finalOutData.data[dstIdx+1] = srcData.data[srcIdx*4+1];
                finalOutData.data[dstIdx+2] = srcData.data[srcIdx*4+2];
                finalOutData.data[dstIdx+3] = 255; // Force opaque
            }
        }
    }
    outCtx.putImageData(finalOutData, 0, 0);

    const url = outC.toDataURL('image/png');
    const blob = await new Promise<Blob | null>(r => outC.toBlob(r, 'image/png'));

    return {
        id: crypto.randomUUID(),
        url,
        width: finalSize,
        height: finalSize,
        blob: blob!
    };
};
