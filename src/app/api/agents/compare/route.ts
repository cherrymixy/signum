import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { runVisualScanAgent } from '@/agents/visualScanAgent';
import { runGapAnalystAgent } from '@/agents/gapAnalystAgent';
import { getPlatformContext } from '@/lib/platformContexts';
import { IntentAnalysis } from '@/types';

/**
 * A/B 비교 분석 — 두 번째 이미지를 빠르게 스캔해 원본과 비교
 * VisualScan + GapAnalyst만 실행 (풀 파이프라인 없음)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            imageBase64B,
            imageMimeTypeB,
            intentAnalysis,
            originalScore,
            contextPreset,
        } = body as {
            imageBase64B: string;
            imageMimeTypeB: string;
            intentAnalysis: IntentAnalysis;
            originalScore: number;
            contextPreset?: string;
        };

        if (!imageBase64B || !intentAnalysis) {
            return NextResponse.json(
                { error: { message: '이미지 B 및 intentAnalysis가 필요합니다.' } },
                { status: 400 },
            );
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return NextResponse.json({ error: { message: 'API 키 없음' } }, { status: 500 });

        const openai = new OpenAI({ apiKey });
        const mimeType = imageMimeTypeB || 'image/jpeg';

        const [visualScanB, visualScanA] = await Promise.all([
            runVisualScanAgent(openai, {
                imageBase64: imageBase64B,
                imageMimeType: mimeType,
                intentAnalysis,
            }),
            // 비교를 위한 A 기준값은 이미 originalScore로 제공됨 — 여기서는 B만 분석
            Promise.resolve(null),
        ]);

        const platformContext = contextPreset ? getPlatformContext(contextPreset) : undefined;

        const gapResultB = await runGapAnalystAgent(openai, {
            intentAnalysis,
            visualScan: visualScanB,
            decodingResults: [],
            platformContext: platformContext || undefined,
        });

        const scoreB = gapResultB.overallAlignmentScore;
        const diff = scoreB - originalScore;
        const winner = diff > 5 ? 'B' : diff < -5 ? 'A' : 'tie';

        return NextResponse.json({
            success: true,
            data: {
                scoreA: originalScore,
                scoreB,
                diff,
                winner,
                visualScanB: {
                    overallImpression: visualScanB.overallImpression,
                    colorMood: visualScanB.colorMood,
                },
                criticalFindingsB: gapResultB.criticalFindings,
                highGapsB: gapResultB.gaps.filter(g => g.severity === 'high').length,
            },
        });
    } catch (error: any) {
        console.error('[Compare Agent] Error:', error);
        return NextResponse.json(
            { error: { message: error.message || '비교 분석 중 오류' } },
            { status: 500 },
        );
    }
}
