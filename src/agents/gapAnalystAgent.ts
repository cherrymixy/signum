import OpenAI from 'openai';
import { IntentAnalysis, DecodingHypothesisSet, GapAnalysis } from '@/types';

const SYSTEM_PROMPT = `당신은 커뮤니케이션 Gap 분석 전문가입니다. 창작자의 의도와 수용자의 예상 해석 사이의 차이를 분석하는 역할을 합니다.

창작자의 구조화된 의도와 수용자 관점 해석 가설을 비교하여 Gap을 식별하세요.

다음 JSON 형식으로 응답하세요:

{
  "gaps": [
    {
      "dimension": "차이 발생 차원 (메시지/감성/행동유도 중 하나)",
      "intended": "창작자가 의도한 것",
      "decoded": "수용자가 해석할 가능성이 높은 것",
      "severity": "high/medium/low",
      "cause": "이 차이가 발생하는 원인"
    }
  ],
  "overallAlignmentScore": 0~100,
  "criticalFindings": "핵심 발견 요약 한 줄"
}

심각도 기준:
- high: 의도와 정반대로 해석될 위험
- medium: 의도가 약화되거나 왜곡될 가능성
- low: 미세한 뉘앙스 차이

한국어로 작성하세요. JSON만 반환하세요.`;

export interface GapAnalystInput {
    intentAnalysis: IntentAnalysis;
    decodingResult: DecodingHypothesisSet;
    userContext?: string; // 체크포인트에서 수집한 사용자 지시
}

export async function runGapAnalystAgent(
    openai: OpenAI,
    input: GapAnalystInput,
    onToken?: (accumulated: string) => void,
): Promise<GapAnalysis> {
    const stream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: `[창작자 의도]
핵심 메시지: ${input.intentAnalysis.coreMessage}
감성 톤: ${input.intentAnalysis.emotionalTone}
행동 유도: ${input.intentAnalysis.callToAction}
암묵적 가정: ${input.intentAnalysis.implicitAssumptions.join(', ')}

[수용자 해석 가설]
타겟: ${input.decodingResult.targetPersona}
컨텍스트: ${input.decodingResult.context}
우세 해석: ${input.decodingResult.dominantInterpretation}
${input.decodingResult.hypotheses.map((h, i) => `가설 ${i + 1} (${(h.probability * 100).toFixed(0)}%): ${h.interpretation} — 감정 반응: ${h.emotionalResponse}`).join('\n')}

위 의도와 해석을 비교하여 Gap을 분석하세요.${input.userContext ? `\n\n[사용자 지시 — 이 방향으로 분석해주세요]\n${input.userContext}` : ''}`,
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

    if (!accumulated) throw new Error('Gap Analyst Agent: 빈 응답');
    const result = JSON.parse(accumulated) as GapAnalysis;

    return {
        gaps: Array.isArray(result.gaps) ? result.gaps : [],
        overallAlignmentScore: typeof result.overallAlignmentScore === 'number' ? result.overallAlignmentScore : 0,
        criticalFindings: result.criticalFindings || '',
    };
}
