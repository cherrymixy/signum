import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { runGapAnalystAgent } from '@/agents/gapAnalystAgent';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { intentAnalysis, decodingResult, decodingResults } = body;

        if (!intentAnalysis) {
            return NextResponse.json(
                { error: { code: 'VALIDATION_ERROR', message: 'Intent 분석 결과가 필요합니다.' } },
                { status: 400 }
            );
        }
        const results = decodingResults ?? (decodingResult ? [decodingResult] : null);
        if (!results) {
            return NextResponse.json(
                { error: { code: 'VALIDATION_ERROR', message: 'Decoding 분석 결과가 필요합니다.' } },
                { status: 400 }
            );
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: { code: 'CONFIG_ERROR', message: 'OPENAI_API_KEY가 설정되지 않았습니다.' } },
                { status: 500 }
            );
        }

        const openai = new OpenAI({ apiKey });
        const result = await runGapAnalystAgent(openai, { intentAnalysis, decodingResults: results });

        return NextResponse.json({ success: true, data: result });
    } catch (error: any) {
        console.error('[Gap Analyst] Error:', error);
        return NextResponse.json(
            { error: { code: 'AGENT_ERROR', message: error.message || '분석 중 오류' } },
            { status: 500 }
        );
    }
}
