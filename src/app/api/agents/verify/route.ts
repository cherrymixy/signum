import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { runVisualScanAgent } from '@/agents/visualScanAgent';
import { runGapAnalystAgent } from '@/agents/gapAnalystAgent';
import { IntentAnalysis } from '@/types';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { generatedImageBase64, generatedImageMimeType, intentAnalysis, originalScore } = body as {
            generatedImageBase64: string;
            generatedImageMimeType: string;
            intentAnalysis: IntentAnalysis;
            originalScore: number;
        };

        if (!generatedImageBase64 || !intentAnalysis) {
            return NextResponse.json(
                { error: { message: 'generatedImageBase64 및 intentAnalysis가 필요합니다.' } },
                { status: 400 },
            );
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return NextResponse.json({ error: { message: 'API 키 없음' } }, { status: 500 });

        const openai = new OpenAI({ apiKey });
        const mimeType = generatedImageMimeType || 'image/png';

        // 수정된 이미지에 대한 시각 신호 스캔
        const visualScan = await runVisualScanAgent(openai, {
            imageBase64: generatedImageBase64,
            imageMimeType: mimeType,
            intentAnalysis,
        });

        // 수정된 이미지에 대한 Gap 재분석 (decoding 없이 visual 기반 단순 검증)
        const gapResult = await runGapAnalystAgent(openai, {
            intentAnalysis,
            visualScan,
            decodingResults: [],
        });

        const newScore = gapResult.overallAlignmentScore;
        const improvement = newScore - (originalScore || 0);

        return NextResponse.json({
            success: true,
            data: {
                newScore,
                originalScore: originalScore || 0,
                improvement,
                criticalFindings: gapResult.criticalFindings,
            },
        });
    } catch (error: any) {
        console.error('[Verify Agent] Error:', error);
        return NextResponse.json(
            { error: { message: error.message || '검증 중 오류' } },
            { status: 500 },
        );
    }
}
