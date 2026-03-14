import OpenAI from 'openai';
import { IntentAnalysis, VisualScanResult } from '@/types';

const SYSTEM_PROMPT = `당신은 시각 기호학 전문가입니다. 이미지를 받아 시각적 요소들이 전달하는 신호를 객관적으로 분석하세요.
창작자의 의도와 무관하게, 이 이미지를 처음 보는 사람이 시각적 요소에서 무엇을 읽어내는지 분석합니다.

다음 JSON 형식으로 응답하세요:
{
  "overallImpression": "첫인상 한 줄 (10자 이내)",
  "dominantSignals": [
    {
      "element": "시각 요소 (예: '빨간색 메인 컬러', '비대칭 구도', '굵은 산세리프 폰트')",
      "decoded": "이 요소가 전달하는 시각적 신호",
      "emotion": "유발되는 감정",
      "strength": "strong/moderate/weak"
    }
  ],
  "colorMood": "색상 팔레트가 전달하는 무드 (한 줄)",
  "attentionFlow": "시선 흐름 설명 (어디서 시작해서 어디로)",
  "unintendedSignals": ["의도치 않게 전달될 수 있는 신호"]
}

dominantSignals는 3~5개 생성하세요. 한국어로 작성하세요. JSON만 반환하세요.`;

export interface VisualScanInput {
    imageBase64: string;
    imageMimeType: string;
    intentAnalysis: IntentAnalysis;
}

export async function runVisualScanAgent(
    openai: OpenAI,
    input: VisualScanInput,
    onToken?: (accumulated: string) => void,
): Promise<VisualScanResult> {
    const stream = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `[참고: 창작자 의도]\n핵심 메시지: ${input.intentAnalysis.coreMessage}\n(단, 이 의도와 무관하게 이미지의 시각적 신호를 객관적으로 분석하세요)`,
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

    if (!accumulated) throw new Error('Visual Scan Agent: 빈 응답');
    const result = JSON.parse(accumulated) as VisualScanResult;

    return {
        overallImpression: result.overallImpression || '',
        dominantSignals: Array.isArray(result.dominantSignals) ? result.dominantSignals : [],
        colorMood: result.colorMood || '',
        attentionFlow: result.attentionFlow || '',
        unintendedSignals: Array.isArray(result.unintendedSignals) ? result.unintendedSignals : [],
    };
}
