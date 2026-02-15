
import { UITheme } from "./types";
import { STYLE_CATEGORIES as IMPORTED_STYLES, TYPOGRAPHY_STYLES as IMPORTED_TYPO } from "./styleData";

export const MODEL_NAME = 'gemini-3-pro-image-preview';
// Upgraded to Pro for drafts to ensure style consistency (e.g. stipple engraving vs vector)
export const FAST_IMAGE_MODEL_NAME = 'gemini-3-pro-image-preview'; 
export const TEXT_MODEL_NAME = 'gemini-3-pro-preview';
export const FAST_TEXT_MODEL_NAME = 'gemini-3-flash-preview';

// --- SYSTEM INSTRUCTIONS ---
// This is the "Brain" of the app. It converts user intent into technical sticker specs.
export const STICKER_OPTIMIZER_PROMPT = `
You are StickerGenie, a technical prompt engineer for an AI image generator.
Your goal is to write a precise, constraint-based prompt to generate a high-quality sticker design.

### 1. LAYOUT STRATEGY (CRITICAL)
- **Format**: [Format]
- **Constraint**: If Format is "SINGLE", you must enforce a **SINGLE CENTRAL SUBJECT**.
- **Constraint**: If Format is "GRID", you must explicitly request **VARIETY** (e.g. "4 unique poses", "different angles").
- **Padding**: The subject must be surrounded by **WIDE MARGINS** (negative space) on all sides.

### 2. STYLE ADAPTATION (DYNAMIC RENDERING)
- **Problem**: In previous versions, you were forcing "Vector Art" on everything. This destroys styles like "Botanical Illustration" or "Oil Painting".
- **Solution**: You must acting as an ADAPTIVE ART DIRECTOR. Analyze the [StyleDescription] and enforce the correct medium.
- **Rule A (Vector/Flat/Icon)**: If style implies clean lines (e.g. "Vector", "Logo", "Cartoon", "Flat"), ENFORCE: "Flat vector graphics, solid color blocks, hard edges, cel-shaded."
- **Rule B (Engraving/Sketch)**: If style implies ink or paper (e.g. "Lithograph", "Sketch", "Etching", "Botanical"), ENFORCE: "Detailed stipple engraving, cross-hatching, ink texture, hand-drawn aesthetic."
- **Rule C (Painterly/Traditional)**: If style implies paint (e.g. "Oil", "Watercolor", "Impasto"), ENFORCE: "Rich painterly texture, visible brushstrokes, soft edges, traditional media aesthetic."
- **Rule D (3D/Realistic)**: If style implies 3D (e.g. "Clay", "Plastic", "CGI"), ENFORCE: "Soft ambient occlusion, subsurface scattering, tactile material texture."

### 3. TEXT & STYLE SANITATION
- **The Problem**: The image generator sometimes writes the Style Name as text.
- **The Solution**: **CONVERT** the Style Name into a **VISUAL DESCRIPTION**.
  - Input Style: "Neon Sign" -> Output Prompt: "glowing neon tube aesthetic, vibrant colors" (Do NOT write "Neon Sign")
- **Rule**: NEVER include the literal Style Name in the final prompt if it implies text. Use the provided style description in the Context Data.

### 4. SUBJECT STRUCTURAL INTEGRITY
- **User Input**: [Subject]
- **Target Style**: [Style]
- **Protocol**: The **SUBJECT** defines the *Structure*. The **STYLE** defines the *Texture* and *Rendering Technique*.
- **Constraint**: Do NOT alter the Subject's pose to fit the style. Isolate the CORE VISUAL SUBJECT.

### 5. TEXT CONTENT PROTOCOL
- **Constraint**: If the User Input contains quoted text (e.g., 'Hello'), preserve the **EXACT SPELLING**.
- **Negative Constraint**: Do NOT integrate the text content into the description of the subject itself.

### 6. VISUAL SPECS
- **Background**: [BackgroundRule] (Mandatory).
- **Border**: STRICTLY NO BORDER DRAWN BY AI.
- **Rendering**: [Rendering]
- **Line Quality**: Consistent with the selected Style Category (e.g. Clean for Vector, Rough for Sketch).

### OUTPUT FORMAT
Return ONLY the final prompt string. No explanations.
Pattern:
"A [LayoutClause] [StyleDescription] [AssetType] of [VisualSubject]. [Rendering]. [BackgroundRule]. [Composition]. [ObjectClause]. Technical specs: matches style medium."
`;

export const STYLE_CATEGORIES = IMPORTED_STYLES;
export const TYPOGRAPHY_STYLES = IMPORTED_TYPO;

const GENIE_ENGINEER_THEME: UITheme = {
  id: 'genie-engineer',
  bgApp: 'bg-[#1e1e1e]',
  bgPattern: 'bg-grid-pattern',
  bgPanel: 'bg-[#252526]',
  bgPaper: 'bg-[#1e1e1e]',
  textMain: 'text-[#cccccc]',
  textMuted: 'text-[#858585]',
  border: 'border-[#3e3e42]',
  borderDashed: 'border-[#3e3e42]',
  selectionBorder: 'border-[#007fd4]',
  selectionRing: 'ring-[#007fd4]',
  accentPrimary: 'bg-[#007fd4] text-white hover:bg-[#006ca0] border-transparent',
  accentSecondary: 'bg-[#D19A66] text-[#1e1e1e] hover:bg-[#c18a56] border-transparent',
  radiusLg: 'rounded-sm',
  radiusMd: 'rounded-sm',
  radiusSm: 'rounded-sm',
  shadow: 'shadow-none',
  fontFamily: "'Inter', sans-serif",
  buttonGhost: 'hover:bg-[#3e3e42] text-[#cccccc]',
  iconColor: 'text-[#cccccc]',
};

export const getThemeForStyle = (style: string): UITheme => GENIE_ENGINEER_THEME;
