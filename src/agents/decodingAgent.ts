import OpenAI from 'openai';
import { IntentAnalysis, DecodingHypothesisSet, DecodingPerspective, VisualScanResult } from '@/types';

const PERSPECTIVE_PROMPTS: Record<DecodingPerspective, string> = {
    target: `당신은 지정된 타겟 페르소나의 관점에서 이미지를 해석하는 전문가입니다.
해당 타겟의 경험, 가치관, 감성 필터를 통해 이 이미지를 어떻게 받아들일지 해석 가설을 생성하세요.`,

    critical: `당신은 이미지의 잠재적 오해와 부정적 수용 가능성을 찾는 비판적 독자입니다.
이 이미지에서 의도와 다르게 해석될 수 있는 부분, 불쾌하거나 혼란스러울 수 있는 신호를 중심으로 분석하세요.`,

    intuitive: `당신은 이 이미지를 처음 1~2초 동안 보는 사람의 즉각적 인상을 분석합니다.
이론이나 맥락 없이, 순수한 감각적 반응과 첫인상을 중심으로 해석 가설을 생성하세요.`,
};

const BASE_FORMAT = `
시각 신호 정보가 제공되면 해석에 적극 반영하세요.

다음 JSON 형식으로 응답하세요:
{
  "targetPersona": "해석 주체 설명",
  "context": "게시 컨텍스트가 해석에 미치는 영향",
  "hypotheses": [
    {
      "interpretation": "이 관점에서 이미지를 어떻게 해석할지",
      "probability": 0.0~1.0,
      "reasoning": "왜 이렇게 해석하는지 (구체적 시각 요소 기반)",
      "emotionalResponse": "예상되는 감정 반응"
    }
  ],
  "dominantInterpretation": "가장 우세한 해석 요약 (한 줄)"
}

가설은 2~3개 생성하세요. 확률 합이 1.0이 되도록 하세요. 한국어로 작성하세요. JSON만 반환하세요.`;

export interface DecodingAgentInput {
    imageBase64: string;
    imageMimeType: string;
    intentAnalysis: IntentAnalysis;
    visualScan?: VisualScanResult;
    targetPreset: string;
    contextPreset: string;
    perspective: DecodingPerspective;
}

export async function runDecodingAgent(
    openai: OpenAI,
    input: DecodingAgentInput,
    onToken?: (accumulated: string) => void,
): Promise<DecodingHypothesisSet> {
    const systemPrompt = PERSPECTIVE_PROMPTS[input.perspective] + BASE_FORMAT;

    const visualText = input.visualScan
        ? `\n[시각 신호 분석]\n첫인상: ${input.visualScan.overallImpression}\n색상 무드: ${input.visualScan.colorMood}\n주요 신호: ${input.visualScan.dominantSignals.slice(0, 3).map(s => `${s.element} → "${s.decoded}"`).join(', ')}`
        : '';

    const stream = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `[창작자 의도]\n핵심 메시지: ${input.intentAnalysis.coreMessage}\n감성 톤: ${input.intentAnalysis.emotionalTone}\n행동 유도: ${input.intentAnalysis.callToAction}${visualText}\n\n[분석 조건]\n타겟: ${input.targetPreset}\n플랫폼: ${input.contextPreset}\n\n이 관점에서 이미지를 해석하세요.`,
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
        perspective: input.perspective,
        targetPersona: result.targetPersona || '',
        context: result.context || '',
        hypotheses: Array.isArray(result.hypotheses) ? result.hypotheses : [],
        dominantInterpretation: result.dominantInterpretation || '',
    };
}
