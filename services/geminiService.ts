
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, GenerateContentResponse, Type } from "@google/genai";
import { STICKER_OPTIMIZER_PROMPT, MODEL_NAME, FAST_IMAGE_MODEL_NAME, TEXT_MODEL_NAME, FAST_TEXT_MODEL_NAME, STYLE_CATEGORIES, TYPOGRAPHY_STYLES } from "../constants";

const stripBase64Prefix = (base64: string): string => base64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
const getMimeType = (base64: string): string => {
    const match = base64.match(/^data:(image\/\w+);base64,/);
    return match ? match[1] : 'image/png';
};

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const callWithRetry = async <T>(fn: () => Promise<T>, retries = 3): Promise<T> => {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error: any) {
            const errorMessage = error?.message || "";
            
            if (errorMessage.includes("Requested entity was not found") || error?.status === 404) {
              throw new Error("API_KEY_INVALID");
            }
            
            if (errorMessage.includes("429") || error?.status === 429) {
              if (i < retries - 1) {
                await new Promise(r => setTimeout(r, 4000));
                continue;
              }
              throw new Error("Quota Exceeded: Too many requests. Please wait a moment.");
            }

            if (errorMessage.includes("SAFETY") || errorMessage.includes("HARM_CATEGORY")) {
              throw new Error("Content Blocked: The request was flagged by safety filters. Please adjust your prompt.");
            }
            
            if (errorMessage.includes("Transient") || errorMessage.includes("503") || errorMessage.includes("500") || errorMessage.includes("Overloaded")) {
               if (i < retries - 1) {
                  await new Promise(r => setTimeout(r, 2000));
                  continue;
               }
            }

            if (i === retries - 1) {
              throw new Error(errorMessage || "Generation Failed. Please try again.");
            }
        }
    }
    throw new Error("Connection Failure.");
};

export interface BriefAnalysis {
  recommendedCategory: string;
  recommendedStyle: string;
  customStyleDescription?: string; // New field for custom styles
  reasoning: string;
  refinedSubject: string;
  recommendedTypographyStyle?: string;
  recommendedTextPlacement?: string;
}

export const analyzeBrief = async (prompt: string, referenceImages: string[] = []): Promise<BriefAnalysis> => {
    const ai = getAI();
    const styleContext = Object.entries(STYLE_CATEGORIES).map(([cat, styles]) => {
        return `${cat}: [${styles.map(s => s.name).join(', ')}]`;
    }).join('\n');
    
    const typoContext = TYPOGRAPHY_STYLES.join(', ');
    const placementContext = "auto, above, below, center, speech_bubble, badge";

    const promptText = `
    You are the Configuration Engine for a Sticker Design Studio.
    Analyze the user's request: "${prompt}"
    
    TASK 1: CATEGORIZATION
    Select the ONE Category and ONE Sub-Style from the provided list that best matches the intent.
    
    TASK 2: CUSTOM STYLE DETECTION (HYBRID MODE)
    - Does the user's request imply a specific art style that is NOT well-represented in the provided list? (e.g. "made of spaghetti", "origami", "circuit board texture", "embroidery").
    - IF YES: Generate a 'customStyleDescription' that describes this unique visual style vividly.
    - IF NO: Leave 'customStyleDescription' empty.
    
    TASK 3: TYPOGRAPHY
    If the style or request implies text/typography, select the most appropriate Typography Style and Text Placement.
    
    CONTEXT DATA:
    Styles:
    ${styleContext}
    
    Typography Styles:
    [${typoContext}]
    
    Text Placement Options:
    [${placementContext}]

    CRITICAL INSTRUCTION FOR 'refinedSubject':
    - You must output a cleaned-up version of the user's prompt.
    - **PRESERVATION RULE**: If the user's input contains text inside quotes (e.g., 'Hello', "Cool"), you MUST include that EXACT quoted text in the 'refinedSubject'.
    - DO NOT remove quoted text.
    - If no text is quoted, just describe the visual subject.

    Constraint: "recommendedCategory" and "recommendedStyle" MUST exist in the Context Data.
    Constraint: "recommendedTypographyStyle" MUST be from the provided list (or null).
    Constraint: "recommendedTextPlacement" MUST be from the provided list (or null).
    `;

    const parts: any[] = [{ text: promptText }];
    referenceImages.forEach((img) => {
        parts.push({ inlineData: { mimeType: getMimeType(img), data: stripBase64Prefix(img) } });
    });

    const res = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: FAST_TEXT_MODEL_NAME,
        contents: [{ parts }],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    recommendedCategory: { type: Type.STRING },
                    recommendedStyle: { type: Type.STRING },
                    customStyleDescription: { type: Type.STRING, description: "Optional. Only use if the user requests a style not in the presets." },
                    reasoning: { type: Type.STRING },
                    refinedSubject: { type: Type.STRING },
                    recommendedTypographyStyle: { type: Type.STRING },
                    recommendedTextPlacement: { type: Type.STRING }
                },
                required: ["recommendedCategory", "recommendedStyle", "refinedSubject"]
            }
        }
    }));

    if (!res.text) throw new Error("Analysis failed");
    return JSON.parse(res.text);
};

const analyzeSubjectFeatures = async (image: string): Promise<string> => {
    const ai = getAI();
    const prompt = `
    Analyze this image for a "High-Fidelity Subject Replication" task.
    Describe the subject's identity features with EXTREME PRECISION.
    Focus on:
    - Face: Exact jawline, eye shape, nose structure, age markers.
    - Hair: Exact length, texture, color gradients, and styling.
    - Distinctive Details: Specific glasses, jewelry, moles, or patterns.
    Output a single, information-dense paragraph focused ONLY on identifying traits.
    `;
    
    const parts = [
        { text: prompt },
        { inlineData: { mimeType: getMimeType(image), data: stripBase64Prefix(image) } }
    ];
    
    const res = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: FAST_TEXT_MODEL_NAME,
        contents: [{ parts }]
    }));
    
    return res.text || "The subject from the provided photo.";
};

// Helper: Extracts quoted text to prevent "Semantic Echo" (Text Bleed)
const extractTextContent = (input: string): { cleanPrompt: string; extractedText: string } => {
    // Capture text inside quotes, handling both ' and "
    const textRegex = /["']([^"']+)["']/;
    const match = input.match(textRegex);
    
    if (match && match[1]) {
        // We replace the specific quoted content with a generic placeholder.
        // E.g. "A cat saying 'Hello World'" -> "A cat saying generic text"
        // This stops the [Subject] engine from trying to draw the letters "Hello World" as physical objects.
        const clean = input.replace(match[0], "generic text content"); 
        return { cleanPrompt: clean, extractedText: match[1] };
    }
    return { cleanPrompt: input, extractedText: "" };
};

// Generates the technical prompt string WITHOUT generating the image
export const constructTechnicalPrompt = async (
    prompt: string, 
    style: string, 
    referenceImages: string[] = [],
    useBorder: boolean = true,
    typographyStyle?: string,
    isTypographyEnabled: boolean = false, 
    textPlacement: string = 'auto',
    imageRole: 'reference' | 'subject' = 'reference',
    isGrid: boolean = false,
    bgColor: string = 'black'
): Promise<string> => {
    const ai = getAI();
    const textModel = FAST_TEXT_MODEL_NAME;
    
    // IMPORTANT: Only enable extraction mode if style matches AND we actually have images.
    const isExtraction = style.includes("Subject Extraction") && referenceImages.length > 0;
    
    // LOOKUP THE FULL STYLE DESCRIPTION
    let fullStyleDescription = style;
    
    // If it's a known preset, get the description. If it's custom, it IS the description.
    let isPreset = false;
    for (const catStyles of Object.values(STYLE_CATEGORIES)) {
        const found = catStyles.find(s => s.name === style);
        if (found) {
            fullStyleDescription = `${found.name}: ${found.description}`;
            isPreset = true;
            break;
        }
    }

    // 1. Text Bleed Prevention Strategy
    // If typography is enabled, we strip the text from the subject prompt to avoid it appearing twice.
    const { cleanPrompt, extractedText } = extractTextContent(prompt);
    const subjectPromptToUse = (isTypographyEnabled && extractedText) ? cleanPrompt : prompt;

    // --- BORDER / LAYOUT TERMINOLOGY LOGIC ---
    // If borders are off, we strictly avoid the word "sticker" in structural descriptions
    // to prevent the AI from adding a white outline "sticker effect".
    const assetTerm = useBorder ? "sticker illustration" : "borderless die-cut design";
    const sheetTerm = useBorder ? "sticker sheet" : "grid layout";

    let layoutInstruction = isGrid 
        ? `2x2 GRID SHEET. Generative Requirement: Create 4 DISTINCTLY DIFFERENT variations. Vary the perspective, pose, expression, or composition for each of the 4 items. Do NOT repeat the exact same image.` 
        : `SINGLE. Centered.`;
    
    let layoutClause = isGrid 
        ? `A ${sheetTerm} featuring 4 unique and distinct design variations` 
        : "A single";

    let compositionInstruction = isGrid
        ? "arranged in a balanced 2x2 grid layout"
        : "perfectly centered composition";
        
    let objectClause = isGrid 
        ? "showing diversity in pose and angle" 
        : "single object";

    let extraGuidance = "";
    let featuresDescription = "";

    if ((imageRole === 'subject' || isExtraction) && referenceImages.length > 0) {
         featuresDescription = await analyzeSubjectFeatures(referenceImages[0]);
         extraGuidance += `
         SUBJECT IDENTITY LOCK (STRICT):
         The subject is a SPECIFIC IDENTITY: "${featuresDescription}"
         - DO NOT EXAGGERATE. Maintain exact facial proportions and likeness.
         - Redraw this SPECIFIC figure.
         - Ensure the identity is 100% recognizable.
         `;
    }

    // Determine Background Rule based on user selection
    let bgRule = "isolated on a pure black background";
    let bgConstraint = "**BACKGROUND**: SOLID BLACK.";
    
    if (bgColor === 'white') {
        bgRule = "isolated on a pure white background";
        bgConstraint = "**BACKGROUND**: SOLID WHITE.";
    } else if (bgColor === 'transparent') {
        // AI cannot generate transparency directly. We force black for best extraction keying.
        bgRule = "isolated on a pure black background (for transparency keying)";
        bgConstraint = "**BACKGROUND**: SOLID BLACK.";
    }

    const borderInstruction = useBorder 
      ? `Add a clean, thick, solid white die-cut sticker border around the subject.` 
      : `STRICTLY NO BORDER. The subject should be edgeless on the background. Do not draw a white outline.`;
      
    // COMBINE STYLE NAME + DESCRIPTION + TYPOGRAPHY
    const combinedStyle = typographyStyle 
        ? `${fullStyleDescription} with ${typographyStyle} typography` 
        : fullStyleDescription;
    
    // Text Placement Logic
    let placementInstruction = "";
    if (isTypographyEnabled && typographyStyle) {
        // Use extracted text if available, otherwise generic fallback
        const textRef = extractedText ? `the specific text "${extractedText}"` : "the typography";
        
        switch(textPlacement) {
            case 'above': 
                placementInstruction = `Typography Placement: ${textRef} FLOATING ABOVE the main subject. Distinct separation between text and art.`; 
                break;
            case 'below': 
                placementInstruction = `Typography Placement: ${textRef} FLOATING BELOW the main subject. Distinct separation between text and art.`; 
                break;
            case 'speech_bubble': 
                placementInstruction = `Typography Placement: ${textRef} contained strictly inside a SPEECH BUBBLE or THOUGHT CLOUD emanating from the subject.`; 
                break;
            case 'badge': 
                placementInstruction = `Typography Placement: ${textRef} curved around the edges in a BADGE or EMBLEM layout.`; 
                break;
            case 'center': 
                placementInstruction = `The typography (${textRef}) is the CENTRAL SUBJECT. The visual elements are secondary and integrated into the font strokes.`; 
                break;
            case 'auto': default: 
                placementInstruction = `Typography Placement: ${textRef} ARTISTICALLY FUSED and INTEGRATED into the subject's geometry and structure.`; 
                break;
        }

        // Add Negative Constraint to prevent "Double Text" and "Content Drift"
        placementInstruction += `\nCONSTRAINT: Render the text string EXACTLY ONCE. The text content "${extractedText}" is immutable. Do not alter spelling. Do not repeat the text in the background.`;
    }

    // UPDATED: We use [Rendering] instead of [Lighting]
    // We strictly look for ART MEDIUM keywords (ink, vector, oil) and avoid lighting keywords unless 3D.
    let promptTemplate = STICKER_OPTIMIZER_PROMPT
        .replace(/\[Format\]/g, layoutInstruction)
        .replace(/\[LayoutClause\]/g, layoutClause)
        .replace(/\[AssetType\]/g, assetTerm)
        .replace(/\[ObjectClause\]/g, objectClause)
        .replace(/\[Composition\]/g, compositionInstruction)
        .replace(/\[Rendering\]/g, "Select the specific art medium and texture keywords (e.g. 'stipple engraving', 'gouache paint', 'vector curves') that match the [StyleDescription]. Do NOT describe lighting unless the style is 3D.")
        .replace(/\[BackgroundRule\]/g, bgRule)
        .replace(/\[Subject\]/g, isExtraction ? "The main figure in the attached photo" : (subjectPromptToUse || "A high-fidelity sticker"))
        .replace(/\[Style\]/g, isExtraction ? "High-fidelity realistic subject replication" : combinedStyle);
    
    promptTemplate += `\n\n${bgConstraint}\n${borderInstruction}\n${extraGuidance}\n${placementInstruction}`;

    const optimizationParts: any[] = [{ 
        text: "Refine this prompt for maximum fidelity. PRESERVE the Subject's Pose and Composition. APPLY the Style as a texture/rendering technique only. Do NOT render the name of the style as visible text." 
    }];
    
    referenceImages.forEach((img) => {
        optimizationParts.push({ inlineData: { mimeType: getMimeType(img), data: stripBase64Prefix(img) } });
    });

    const refinedRes = await callWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: textModel,
        contents: [{ parts: optimizationParts }],
        config: { systemInstruction: promptTemplate }
    }));
    
    return refinedRes.text || prompt;
};

export const generateSticker = async (
    prompt: string, 
    style: string, 
    isSheet: boolean, 
    stickerCount: number,
    borderThickness: number,
    referenceImages: string[] = [],
    referenceMode: 'style' | 'content' | 'both' = 'both',
    fidelity: 'low' | 'medium' | 'high' = 'medium',
    isPreview: boolean = false,
    manualPrompt?: string,
    subjectGuidance: 'low' | 'balanced' | 'heavy' = 'balanced',
    doAnalysis: boolean = false,
    useBorder: boolean = true,
    typographyStyle?: string,
    isTypographyEnabled: boolean = false, 
    variationGrid: boolean = false,
    textPlacement: string = 'auto',
    imageRole: 'reference' | 'subject' = 'reference',
    bgColor: string = 'black'
): Promise<{ url: string; finalPrompt: string }> => {
    const ai = getAI();
    const imageModel = isPreview ? FAST_IMAGE_MODEL_NAME : MODEL_NAME;
    let refined = manualPrompt || "";

    if (!refined) {
        // Use the shared prompt construction logic, passing the grid intent
        refined = await constructTechnicalPrompt(
            prompt, style, referenceImages, useBorder, typographyStyle, isTypographyEnabled, textPlacement, imageRole, variationGrid, bgColor
        );
    }

    const imageGenerationParts: any[] = [{ text: refined }];
    referenceImages.forEach((img) => {
        imageGenerationParts.push({ inlineData: { mimeType: getMimeType(img), data: stripBase64Prefix(img) } });
    });
    
    // Map fidelity enum to temperature for generation config
    // High fidelity = Lower temperature (Less random, more strict adherence)
    let temperature = 1.0; 
    if (fidelity === 'high') temperature = 0.4;
    else if (fidelity === 'medium') temperature = 0.8;
    else temperature = 1.2;

    const res = await callWithRetry<GenerateContentResponse>(async () => {
        return await ai.models.generateContent({
            model: imageModel,
            contents: [{ parts: imageGenerationParts }],
            config: { 
                temperature, 
                imageConfig: { aspectRatio: (isSheet && !variationGrid) ? "3:4" : "1:1" } as any 
            }
        });
    });

    const part = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!part || !part.inlineData) throw new Error("No image generated");
    
    return { url: `data:image/png;base64,${part.inlineData.data}`, finalPrompt: refined };
};

export const generateStickerName = async (prompt: string): Promise<string> => {
    const ai = getAI();
    const res = await ai.models.generateContent({
        model: FAST_TEXT_MODEL_NAME, 
        contents: [{ parts: [{ text: `2-word name for: ${prompt}` }] }],
        config: { systemInstruction: "Output ONLY 2 words." }
    });
    return res.text?.trim() || "Sticker";
};

export const editSticker = async (img: string, instr: string, sev: string, ratio: string) => {
    const ai = getAI();
    const prompt = `Edit this: ${instr}. Keep black background.`;
    const res = await ai.models.generateContent({
        model: FAST_IMAGE_MODEL_NAME,
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: getMimeType(img), data: stripBase64Prefix(img) } }] }]
    });
    const part = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    return { url: `data:image/png;base64,${part?.inlineData?.data}` };
};
