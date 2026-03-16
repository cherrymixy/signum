import OpenAI from 'openai';
import { IntentAnalysis, GapAnalysis, EncodingSuggestions, VisualScanResult } from '@/types';

const SYSTEM_PROMPT = `당신은 시각 커뮤니케이션 개선 전문가입니다.
Gap 분석 결과를 바탕으로, 각 Gap을 줄이기 위한 구체적인 시각적 수정 방향을 제안하세요.

각 제안은 수정 대상 시각 요소(visualElement)와 현재 문제(currentIssue)를 명시해야 합니다.

다음 JSON 형식으로 응답하세요:
{
  "suggestions": [
    {
      "area": "수정 영역 (컬러/구도/타이포그래피/오브젝트/톤 등)",
      "visualElement": "수정 대상 구체적 시각 요소 (예: '메인 배경 컬러', 'CTA 버튼')",
      "currentIssue": "현재 이 요소가 만드는 문제 (한 줄)",
      "suggestion": "구체적 수정 제안 (before → after 형태 권장)",
      "expectedImpact": "이 수정이 어떤 Gap을 어떻게 줄이는지",
      "tradeoff": "수정 시 발생할 수 있는 부작용이나 고려사항",
      "priority": "high/medium/low"
    }
  ],
  "summary": "전체 제안 방향 요약 한 줄"
}

한국어로 작성하세요. JSON만 반환하세요.`;

export interface EncodingSuggestionInput {
    intentAnalysis: IntentAnalysis;
    gapAnalysis: GapAnalysis;
    visualScan?: VisualScanResult;
    userContext?: string;
    platformContext?: string;
    profileContext?: string;
}

export async function runEncodingSuggestionAgent(
    openai: OpenAI,
    input: EncodingSuggestionInput,
    onToken?: (accumulated: string) => void,
): Promise<EncodingSuggestions> {
    const gapDescriptions = input.gapAnalysis.gaps
        .map((g, i) => `Gap ${i + 1} [${g.severity}/${g.dimension}]\n  시각요소: ${g.visualElement || '미지정'}\n  의도: "${g.intended}" → 해석: "${g.decoded}"\n  수정힌트: ${g.fixHint || g.cause}`)
        .join('\n');

    const visualText = input.visualScan
        ? `\n[현재 시각 신호]\n${input.visualScan.dominantSignals.slice(0, 3).map(s => `${s.element}: ${s.decoded}`).join('\n')}`
        : '';

    // 이미지 분석은 Intent/VisualScan/Gap 단계에서 완료됨 — 여기서는 텍스트 결과만 사용
    const userText = `[원본 의도]\n핵심 메시지: ${input.intentAnalysis.coreMessage}\n감성 톤: ${input.intentAnalysis.emotionalTone}\n\n[Gap 분석]\n일치도: ${input.gapAnalysis.overallAlignmentScore}/100\n핵심 발견: ${input.gapAnalysis.criticalFindings}\n\n${gapDescriptions}${visualText}${input.platformContext ? `\n\n[플랫폼 특성 — 이 플랫폼에 최적화된 제안 필요]\n${input.platformContext}` : ''}${input.profileContext ? `\n\n${input.profileContext}` : ''}\n\n각 Gap을 줄이기 위한 구체적인 시각적 수정 방향을 제안하세요.${input.userContext ? `\n\n[사용자 우선순위 지시]\n${input.userContext}` : ''}`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userText },
    ];

    let accumulated = '';
    const stream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
        stream: true,
    });
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
