import OpenAI from 'openai';
import { IntentAnalysis, GapAnalysis, EncodingSuggestions } from '@/types';

const SYSTEM_PROMPT = `당신은 시각 커뮤니케이션 개선 전문가입니다. 의도-해석 Gap 분석 결과를 바탕으로 이미지의 인코딩을 개선하는 구체적 방향을 제안하는 역할을 합니다.

Gap 분석 결과와 원본 의도를 참고하여, 실행 가능한 수정 제안을 생성하세요.

다음 JSON 형식으로 응답하세요:

{
  "suggestions": [
    {
      "area": "수정 영역 (컬러, 구도, 타이포그래피, 오브젝트, 톤 등)",
      "suggestion": "구체적 수정 제안",
      "expectedImpact": "이 수정이 Gap을 어떻게 줄이는지",
      "tradeoff": "수정 시 발생할 수 있는 부작용이나 고려사항",
      "priority": "high/medium/low"
    }
  ],
  "summary": "전체 제안 방향 요약 한 줄"
}

우선순위 기준:
- high: 핵심 Gap을 직접 해결하는 수정
- medium: 보조적 개선
- low: 선택적 개선

한국어로 작성하세요. JSON만 반환하세요.`;

export interface EncodingSuggestionInput {
    imageBase64: string;
    imageMimeType: string;
    intentAnalysis: IntentAnalysis;
    gapAnalysis: GapAnalysis;
    userContext?: string; // 체크포인트에서 수집한 사용자 우선순위 지시
}

export async function runEncodingSuggestionAgent(
    openai: OpenAI,
    input: EncodingSuggestionInput,
    onToken?: (accumulated: string) => void,
): Promise<EncodingSuggestions> {
    const gapDescriptions = input.gapAnalysis.gaps
        .map((g, i) => `Gap ${i + 1} [${g.severity}]: ${g.dimension} — 의도: "${g.intended}" vs 해석: "${g.decoded}" (원인: ${g.cause})`)
        .join('\n');

    const stream = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `[원본 의도]
핵심 메시지: ${input.intentAnalysis.coreMessage}
감성 톤: ${input.intentAnalysis.emotionalTone}

[Gap 분석 결과]
전체 일치도: ${input.gapAnalysis.overallAlignmentScore}/100
핵심 발견: ${input.gapAnalysis.criticalFindings}

${gapDescriptions}

위 Gap을 줄이기 위한 구체적인 시각적 수정 방향을 제안하세요.${input.userContext ? `\n\n[사용자 우선순위 지시 — 이 방향으로 제안을 구성해주세요]\n${input.userContext}` : ''}`,
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

    if (!accumulated) throw new Error('Encoding Suggestion Agent: 빈 응답');
    const result = JSON.parse(accumulated) as EncodingSuggestions;

    return {
        suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
        summary: result.summary || '',
    };
}
