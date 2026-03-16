import OpenAI from 'openai';

const SYSTEM_PROMPT = `당신은 시각 커뮤니케이션 전문가입니다. 창작자의 의도 텍스트가 얼마나 구체적이고 명확한지 평가하세요.

다음 JSON 형식으로 응답하세요:
{
  "score": 0~100,
  "questions": ["질문1", "질문2"]
}

평가 기준 (score):
- 80~100: 매우 구체적 — 타겟, 감성 톤, 기대 반응이 명확
- 60~79: 충분히 구체적
- 40~59: 추가 정보가 있으면 분석 품질이 크게 향상됨
- 0~39: 모호하여 질문 필수

score < 60일 때만 questions에 2~3개의 핵심 질문을 채우세요. 나머지는 빈 배열 [].
질문은 분석에 직접 도움이 되는 것으로: 타겟 오디언스, 기대 감정 반응, 플랫폼 맥락, 행동 유도 목표 중심.
JSON만 반환하세요.`;

export interface ClarificationResult {
    score: number;
    questions: string[];
}

export async function runClarificationAgent(
    openai: OpenAI,
    input: { intentText: string; imageBase64: string; imageMimeType: string },
): Promise<ClarificationResult> {
    try {
        const res = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image_url',
                            image_url: { url: `data:${input.imageMimeType};base64,${input.imageBase64}` },
                        },
                        {
                            type: 'text',
                            text: `창작자의 의도: "${input.intentText}"\n\n이 의도의 명확성을 평가하고, 필요하면 분석에 도움될 질문을 생성하세요.`,
                        },
                    ],
                },
            ],
            max_tokens: 400,
            response_format: { type: 'json_object' },
        });

        const content = res.choices[0]?.message?.content;
        if (!content) return { score: 100, questions: [] };

        const parsed = JSON.parse(content) as ClarificationResult;
        return {
            score: typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : 100,
            questions: Array.isArray(parsed.questions) ? parsed.questions.slice(0, 3) : [],
        };
    } catch {
        // 실패 시 분석 중단하지 않음
        return { score: 100, questions: [] };
    }
}
