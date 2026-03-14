import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { runDecodingAgent } from '@/agents/decodingAgent';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { imageBase64, imageMimeType, intentAnalysis, targetPreset, contextPreset } = body;

        if (!imageBase64 || !imageMimeType) {
            return NextResponse.json(
                { error: { code: 'VALIDATION_ERROR', message: '이미지 데이터가 필요합니다.' } },
                { status: 400 }
            );
        }
        if (!intentAnalysis) {
            return NextResponse.json(
                { error: { code: 'VALIDATION_ERROR', message: 'Intent 분석 결과가 필요합니다.' } },
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
        const result = await runDecodingAgent(openai, {
            imageBase64, imageMimeType, intentAnalysis, targetPreset, contextPreset, perspective: 'target',
        });

        return NextResponse.json({ success: true, data: result });
    } catch (error: any) {
        console.error('[Decoding Agent] Error:', error);
        return NextResponse.json(
            { error: { code: 'AGENT_ERROR', message: error.message || '분석 중 오류' } },
            { status: 500 }
        );
    }
}
