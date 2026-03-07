import OpenAI from 'openai';
import { SuggestionItem, IntentAnalysis, GapAnalysis } from '@/types';

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
 * Executor Agent — OpenAI DALL-E 3로 수정안을 반영한 이미지 생성
 * 
 * 1. GPT-4o-mini로 수정안을 바탕으로 상세한 이미지 생성 프롬프트 작성
 * 2. DALL-E 3로 이미지 생성
 */
export async function runExecutorAgent(
    input: ExecutorAgentInput
): Promise<ExecutorAgentResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');

    const openai = new OpenAI({ apiKey });

    const suggestionsText = input.suggestions
        .map((s, i) => `${i + 1}. [${s.area}] ${s.suggestion} (기대 효과: ${s.expectedImpact})`)
        .join('\n');

    // Step 1: GPT-4o-mini로 원본 이미지를 분석하고 수정안 반영한 DALL-E 프롬프트 생성
    const promptResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: `You are an expert at writing DALL-E 3 image generation prompts. Given an original image and modification suggestions, create a detailed prompt that describes what the MODIFIED image should look like. The prompt should incorporate all the suggestions while maintaining the core composition of the original. Write in English. Be very specific about visual details, colors, composition, lighting, and mood. Output ONLY the prompt, nothing else.`,
            },
            {
                role: 'user',
                content: [
                    {
                        type: 'image_url',
                        image_url: { url: `data:${input.imageMimeType};base64,${input.imageBase64}` },
                    },
                    {
                        type: 'text',
                        text: `Creator's Intent: ${input.intentSummary}\n\nModification Suggestions:\n${suggestionsText}\n\nBased on the original image above and these modification suggestions, write a detailed DALL-E 3 prompt that describes the modified version of this image.`,
                    },
                ],
            },
        ],
        max_tokens: 1000,
    });

    const dallePrompt = promptResponse.choices[0]?.message?.content;
    if (!dallePrompt) throw new Error('이미지 프롬프트 생성 실패');

    // Step 2: DALL-E 3로 이미지 생성
    const imageResponse = await openai.images.generate({
        model: 'dall-e-3',
        prompt: dallePrompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
        quality: 'standard',
    });

    const imageData = imageResponse.data?.[0];
    if (!imageData?.b64_json) throw new Error('이미지 생성 실패');

    return {
        generatedImageBase64: imageData.b64_json,
        generatedImageMimeType: 'image/png',
        description: dallePrompt,
    };
}
