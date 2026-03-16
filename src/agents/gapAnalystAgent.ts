import OpenAI from 'openai';
import { IntentAnalysis, DecodingHypothesisSet, GapAnalysis, VisualScanResult } from '@/types';

const SYSTEM_PROMPT = `당신은 시각 커뮤니케이션 Gap 분석 전문가입니다.
창작자 의도, 시각 신호 분석, 복수의 수용자 해석 관점을 종합하여 Gap을 식별하세요.

각 Gap은 반드시 특정 시각 요소(visualElement)와 연결되어야 하며, 해결 방향(fixHint)을 포함해야 합니다.

다음 JSON 형식으로 응답하세요:
{
  "gaps": [
    {
      "dimension": "차이 발생 차원 (메시지/감성/행동유도/신뢰 중 하나)",
      "visualElement": "이 gap을 유발하는 구체적 시각 요소 (예: '파란색 배경', '작은 CTA 버튼')",
      "intended": "창작자가 의도한 것",
      "decoded": "수용자가 실제로 해석하는 것 (복수 관점 종합)",
      "severity": "high/medium/low",
      "cause": "이 차이가 발생하는 근본 원인",
      "fixHint": "이 gap을 줄이기 위한 핵심 시각적 수정 방향 (한 줄)",
      "confidence": 0~100,
      "bbox": {"x": 0~1, "y": 0~1, "w": 0~1, "h": 0~1}
    }
  ],
  "overallAlignmentScore": 0~100,
  "criticalFindings": "핵심 발견 요약 한 줄"
}

confidence: 이 Gap 판단의 신뢰도 — 시각적 근거가 명확하면 높게(70~100), 해석에 의존적이면 낮게(30~60).
bbox: gap을 유발하는 요소의 이미지 내 대략적 위치 (정규화 0~1 좌표). 전체 이미지에 걸친 경우 생략.

심각도: high=의도 역전/부정 반응, medium=약화/왜곡, low=뉘앙스 차이
한국어로 작성하세요. JSON만 반환하세요.`;

export interface GapAnalystInput {
    intentAnalysis: IntentAnalysis;
    visualScan?: VisualScanResult;
    decodingResults: DecodingHypothesisSet[];
    userContext?: string;
    platformContext?: string;
    profileContext?: string;
}

export async function runGapAnalystAgent(
    openai: OpenAI,
    input: GapAnalystInput,
    onToken?: (accumulated: string) => void,
): Promise<GapAnalysis> {
    const perspectiveLabels: Record<string, string> = {
        target: '타겟 관점',
        critical: '비판적 관점',
        intuitive: '직관적 관점',
    };

    const decodingText = input.decodingResults.map((dr, i) => {
        const label = dr.perspective ? (perspectiveLabels[dr.perspective] || `관점 ${i + 1}`) : `관점 ${i + 1}`;
        const top2 = dr.hypotheses.slice(0, 2).map(h => `  · (${(h.probability * 100).toFixed(0)}%) ${h.interpretation} → ${h.emotionalResponse}`).join('\n');
        return `[${label}] ${dr.dominantInterpretation}\n${top2}`;
    }).join('\n\n');

    const visualText = input.visualScan
        ? `\n[시각 신호]\n첫인상: ${input.visualScan.overallImpression} | 색상: ${input.visualScan.colorMood}\n신호: ${input.visualScan.dominantSignals.map(s => `${s.element}(${s.strength})→${s.decoded}`).join(', ')}\n미의도 신호: ${input.visualScan.unintendedSignals.join(', ') || '없음'}`
        : '';

    const stream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: `[창작자 의도]\n핵심 메시지: ${input.intentAnalysis.coreMessage}\n감성 톤: ${input.intentAnalysis.emotionalTone}\n행동 유도: ${input.intentAnalysis.callToAction}\n암묵적 가정: ${input.intentAnalysis.implicitAssumptions.join(', ')}${visualText}\n\n[수용자 해석 관점들]\n${decodingText}${input.platformContext ? `\n\n[플랫폼 특성]\n${input.platformContext}` : ''}${input.profileContext ? `\n\n${input.profileContext}` : ''}\n\n위 분석을 종합하여 Gap을 식별하세요. 각 Gap은 구체적 시각 요소와 연결하고, 이미지 내 위치를 bbox로 추정하세요.${input.userContext ? `\n\n[사용자 지시]\n${input.userContext}` : ''}`,
            },
        ],
        max_tokens: 2500,
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
        gaps: Array.isArray(result.gaps) ? result.gaps.map(g => ({
            ...g,
            confidence: typeof g.confidence === 'number' ? Math.max(0, Math.min(100, g.confidence)) : undefined,
            bbox: g.bbox && typeof g.bbox.x === 'number' ? {
                x: Math.max(0, Math.min(1, g.bbox.x)),
                y: Math.max(0, Math.min(1, g.bbox.y)),
                w: Math.max(0, Math.min(1, g.bbox.w)),
                h: Math.max(0, Math.min(1, g.bbox.h)),
            } : undefined,
        })) : [],
        overallAlignmentScore: typeof result.overallAlignmentScore === 'number' ? result.overallAlignmentScore : 0,
        criticalFindings: result.criticalFindings || '',
    };
}
