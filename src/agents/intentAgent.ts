import OpenAI from 'openai';
import { IntentAnalysis } from '@/types';

const SYSTEM_PROMPT = `당신은 시각 커뮤니케이션 전문가입니다. 창작자가 이미지를 통해 전달하려는 의도를 구조화하는 역할을 합니다.

입력으로 이미지와 창작자의 의도 텍스트를 받아, 다음 JSON 형식으로 분석하세요:

{
  "coreMessage": "핵심 메시지 — 이 이미지가 전달하려는 주요 내용",
  "emotionalTone": "감성 톤 — 이미지가 유발하려는 감정",
  "callToAction": "행동 유도 — 수용자에게 기대하는 반응이나 행동",
  "implicitAssumptions": ["암묵적 가정 1", "암묵적 가정 2", ...],
  "summary": "의도 요약 한 줄"
}

모든 필드를 한국어로 작성하세요. JSON만 반환하세요.`;

export interface IntentAgentInput {
    imageBase64: string;
    imageMimeType: string;
    intentText: string;
}

export async function runIntentAgent(
    openai: OpenAI,
    input: IntentAgentInput
): Promise<IntentAnalysis> {
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `창작자의 의도: ${input.intentText}\n\n이 의도를 구조적으로 분석해주세요.`,
                    },
                    {
                        type: 'image_url',
                        image_url: { url: `data:${input.imageMimeType};base64,${input.imageBase64}` },
                    },
                ],
            },
        ],
        max_tokens: 2000,
        response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Intent Agent: 빈 응답');

    const result = JSON.parse(content) as IntentAnalysis;

    return {
        coreMessage: result.coreMessage || '',
        emotionalTone: result.emotionalTone || '',
        callToAction: result.callToAction || '',
        implicitAssumptions: Array.isArray(result.implicitAssumptions) ? result.implicitAssumptions : [],
        summary: result.summary || '',
    };
}
