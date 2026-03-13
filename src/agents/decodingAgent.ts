import OpenAI from 'openai';
import { IntentAnalysis, DecodingHypothesisSet } from '@/types';

const SYSTEM_PROMPT = `당신은 수용자 심리 분석 전문가입니다. 특정 타겟 페르소나의 관점에서 이미지를 해석하는 역할을 합니다.

창작자의 구조화된 의도와 함께 이미지를 받아, 지정된 타겟 관점에서 해석 가설을 생성하세요.

다음 JSON 형식으로 응답하세요:

{
  "targetPersona": "타겟 페르소나 설명",
  "context": "게시 컨텍스트 설명",
  "hypotheses": [
    {
      "interpretation": "이 타겟이 이미지를 어떻게 해석할지",
      "probability": 0.0~1.0,
      "reasoning": "왜 이렇게 해석할 가능성이 높은지",
      "emotionalResponse": "예상되는 감정 반응"
    }
  ],
  "dominantInterpretation": "가장 우세한 해석 요약"
}

가설은 3~5개 생성하세요. 확률 합이 1.0이 되도록 하세요. 한국어로 작성하세요. JSON만 반환하세요.`;

export interface DecodingAgentInput {
    imageBase64: string;
    imageMimeType: string;
    intentAnalysis: IntentAnalysis;
    targetPreset: string;
    contextPreset: string;
}

export async function runDecodingAgent(
    openai: OpenAI,
    input: DecodingAgentInput,
    onToken?: (accumulated: string) => void,
): Promise<DecodingHypothesisSet> {
    const stream = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `[창작자 의도 분석]
핵심 메시지: ${input.intentAnalysis.coreMessage}
감성 톤: ${input.intentAnalysis.emotionalTone}
행동 유도: ${input.intentAnalysis.callToAction}
암묵적 가정: ${input.intentAnalysis.implicitAssumptions.join(', ')}

[분석 조건]
타겟: ${input.targetPreset}
컨텍스트: ${input.contextPreset}

이 타겟의 관점에서 이미지를 해석하세요.`,
                    },
                    {
                        type: 'image_url',
                        image_url: { url: `data:${input.imageMimeType};base64,${input.imageBase64}` },
                    },
                ],
            },
        ],
        max_tokens: 3000,
        response_format: { type: 'json_object' },
        stream: true,
    });

    let accumulated = '';
    for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
            accumulated += delta;
            onToken?.(accumulated);
        }
    }

    if (!accumulated) throw new Error('Decoding Agent: 빈 응답');
    const result = JSON.parse(accumulated) as DecodingHypothesisSet;

    return {
        targetPersona: result.targetPersona || '',
        context: result.context || '',
        hypotheses: Array.isArray(result.hypotheses) ? result.hypotheses : [],
        dominantInterpretation: result.dominantInterpretation || '',
    };
}
