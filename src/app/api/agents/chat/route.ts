import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'OPENAI_API_KEY가 설정되지 않았습니다.' }, { status: 500 });
    }

    try {
        const { question, analysisContext } = await request.json();

        if (!question?.trim()) {
            return NextResponse.json({ error: '질문을 입력해주세요.' }, { status: 400 });
        }

        const openai = new OpenAI({ apiKey });

        const res = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `당신은 시각 커뮤니케이션 전문가입니다. 사용자가 분석 결과에 대해 질문하면 분석 맥락을 바탕으로 명확하고 실용적으로 답변하세요.
한국어로 2-4문장으로 답변하세요.`,
                },
                {
                    role: 'user',
                    content: `[분석 맥락]\n${analysisContext || '(분석 맥락 없음)'}\n\n[질문]\n${question}`,
                },
            ],
            max_tokens: 400,
        });

        const answer = res.choices[0]?.message?.content || '답변을 생성하지 못했습니다.';
        return NextResponse.json({ success: true, answer });
    } catch (e: any) {
        console.error('[Chat] Error:', e);
        return NextResponse.json({ error: e.message || '답변 생성 중 오류' }, { status: 500 });
    }
}
