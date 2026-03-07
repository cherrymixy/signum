import { GoogleGenerativeAI } from '@google/generative-ai';
import { SuggestionItem } from '@/types';

export interface ExecutorAgentInput {
    imageBase64: string;
    imageMimeType: string;
    suggestions: SuggestionItem[];
    intentSummary: string;
}

export interface ExecutorAgentResult {
    generatedImageBase64: string;
    generatedImageMimeType: string;
    description: string;
}

/**
 * Executor Agent — Gemini를 사용하여 수정안을 반영한 이미지를 생성
 */
export async function runExecutorAgent(
    input: ExecutorAgentInput
): Promise<ExecutorAgentResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-preview-04-17',
        generationConfig: {
            responseModalities: ['Text', 'Image'],
        } as any,
    });

    const suggestionsText = input.suggestions
        .map((s, i) => `${i + 1}. [${s.area}] ${s.suggestion} (기대 효과: ${s.expectedImpact})`)
        .join('\n');

    const prompt = `You are an expert image editor. Edit the provided image based on the following modification suggestions to better convey the creator's intent.

Creator's Intent: ${input.intentSummary}

Modification Suggestions:
${suggestionsText}

Please apply these suggestions to edit the image. Keep the core composition but adjust according to the suggestions above. Return the edited image.`;

    const result = await model.generateContent([
        {
            inlineData: {
                mimeType: input.imageMimeType,
                data: input.imageBase64,
            },
        },
        { text: prompt },
    ]);

    const response = result.response;
    const parts = response.candidates?.[0]?.content?.parts;

    if (!parts) throw new Error('Gemini 응답이 비어있습니다.');

    let generatedImageBase64 = '';
    let generatedImageMimeType = 'image/png';
    let description = '';

    for (const part of parts) {
        if (part.inlineData) {
            generatedImageBase64 = part.inlineData.data;
            generatedImageMimeType = part.inlineData.mimeType || 'image/png';
        }
        if (part.text) {
            description = part.text;
        }
    }

    if (!generatedImageBase64) {
        throw new Error('이미지가 생성되지 않았습니다. 다시 시도해주세요.');
    }

    return {
        generatedImageBase64,
        generatedImageMimeType,
        description,
    };
}
