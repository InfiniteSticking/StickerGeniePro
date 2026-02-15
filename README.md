# StickerGenie 🧞‍♂️

StickerGenie is an AI-powered sticker production studio. It transforms text descriptions into high-fidelity, die-cut sticker assets. It features a "Draft-to-Final" workflow, using Gemini 2.5 Flash for rapid prototyping and Gemini 3 Pro for final 4K asset generation.

## 🚀 Features

- **The Forge**: Prototyping panel with support for reference images, style presets, and custom overrides.
- **Image Vault**: Upload up to 3 reference images to guide the AI's "Deep Visual Reasoning".
- **Studio Stage**: A professional canvas for upscaling, background removal, and asset management.
- **Slicing Engine**: Computer-vision powered background removal and grid-slicing for sticker sheets.
- **Source Manifest**: A built-in developer tool to browse and download every project file individually.

## 🛠️ Technical Stack

- **Framework**: React 19 + Tailwind CSS
- **AI**: Google Gemini API (@google/genai)
- **Image Processing**: Canvas API for flood-fill silhouette detection.
- **Bundling**: JSZip for project exports.

## 🧠 Core Logic: Slicing Engine (`utils/slicingUtil.ts`)

This is the heartbeat of the background removal tool. It uses a recursive flood-fill algorithm with support for RGB tolerance and erosion (mask shrinking) to eliminate dark "fringes" around generated stickers.

```typescript
import { ProcessedSprite, ProcessorOptions } from '../types';

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

  if (options.mode === 'grid') {
    return sliceGrid(img, options.rows, options.cols);
  }

  let bgR = data[0], bgG = data[1], bgB = data[2];
  if (options.customBgColor) {
    const rgb = hexToRgb(options.customBgColor);
    if (rgb) { bgR = rgb.r; bgG = rgb.g; bgB = rgb.b; }
  }

  const isBackground = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const tolerance = options.tolerance * 3;
  const queue: number[] = [0]; 
  visited[0] = 1;
  isBackground[0] = 1;
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
        if (isBackground[i] === 1) { spriteImageData.data[tIdx + 3] = 0; }
        else {
          spriteImageData.data[tIdx] = data[tIdx];
          spriteImageData.data[tIdx+1] = data[tIdx+1];
          spriteImageData.data[tIdx+2] = data[tIdx+2];
          spriteImageData.data[tIdx+3] = 255;
        }
      }
      spriteCtx.putImageData(spriteImageData, 0, 0);
      const url = spriteCanvas.toDataURL('image/png');
      const blob = await new Promise<Blob | null>((r) => spriteCanvas.toBlob(r, 'image/png'));
      if (blob) sprites.push({ id: crypto.randomUUID(), url, width, height, blob });
    }
    return sprites;
  }
  // (Individual object cropping logic...)
  return sprites;
};
```

## 📜 Usage Instructions

1. **Connect**: Click "Connect Portal" to use your Google AI Studio API key.
2. **Draft**: Enter a description (e.g., "Neon Samurai Cat") and click "Summon Draft".
3. **Refine**: Use the side panel to adjust the prompt iteratively.
4. **Ascend**: Once the draft is perfect, click "Finalize Render" to generate the 4K asset.
5. **Export**: Use "Banish Background" to create a transparent PNG for printing.
