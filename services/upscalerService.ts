
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { MODEL_NAME } from "../constants";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const stripBase64Prefix = (base64: string): string => base64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
const getMimeType = (base64: string): string => {
    const match = base64.match(/^data:(image\/\w+);base64,/);
    return match ? match[1] : 'image/png';
};

const UPSCALER_SYSTEM_INSTRUCTION = `
You are an Advanced AI Image Restoration & Upscaling Engine.
Your task is to take the provided low-resolution input image and output a High-Fidelity 2K (2048x2048) version.

### 1. STRICT FIDELITY PROTOCOL
- **DO NOT** change the composition, pose, or subject identity.
- **DO NOT** add new objects or remove existing ones.
- **DO NOT** change the art style.
- You must act as a "Smart Photocopier" that enhances quality, not a creative artist.

### 2. ENHANCEMENT TASKS
- **Denoise**: Remove JPEG artifacts and grain.
- **Deblur**: Sharpen edges to look like vector art or high-res photography.
- **Texture Synthesis**: Hallucinate missing high-frequency details (e.g., paper grain, brush strokes) ONLY if they exist in the low-res version.
- **Color Correction**: Ensure blacks are deep #000000 and whites are pure #FFFFFF.

### 3. OUTPUT SPECIFICATIONS
- Resolution: 2048x2048.
- Background: Pure Black (unless input is different).
- Edges: crisp, anti-aliased, ready for die-cutting.
`;

export const upscaleImage = async (
    imageSrc: string, 
    originalPrompt: string,
    useBorder: boolean
): Promise<string> => {
    const ai = getAI();
    
    // We construct a prompt that reinforces the visual data provided
    const userPrompt = `
    Restore and upscale this image to 2048x2048.
    Context: ${originalPrompt || "A high quality sticker design"}.
    
    Constraint: Keep the image EXACTLY as it is, but make it look like a 2K render.
    ${useBorder ? "Ensure the white contour border is solid and crisp." : "Ensure the subject has clean edges against the black background."}
    `;

    const parts = [
        { text: userPrompt },
        { inlineData: { mimeType: getMimeType(imageSrc), data: stripBase64Prefix(imageSrc) } }
    ];

    try {
        const res = await ai.models.generateContent({
            model: MODEL_NAME, // Uses Gemini 3 Pro for maximum vision capability
            contents: [{ parts }],
            config: {
                systemInstruction: UPSCALER_SYSTEM_INSTRUCTION,
                temperature: 0.1, // CRITICAL: Near-zero temperature prevents hallucination
                topK: 1,         // Strict token selection
                topP: 0.8,
                imageConfig: {
                    aspectRatio: "1:1", // Force square for standard stickers
                    imageSize: "2K" // 2048x2048 resolution
                } as any
            }
        });

        const part = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (!part || !part.inlineData) throw new Error("Upscaling failed: No image returned from API");
        
        return `data:image/png;base64,${part.inlineData.data}`;
    } catch (error: any) {
        console.error("Upscaling Error:", error);
        throw new Error(error.message || "Upscaling failed");
    }
};
