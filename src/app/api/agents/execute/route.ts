import { NextRequest, NextResponse } from 'next/server';
import { runExecutorAgent } from '@/agents/executorAgent';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { imageBase64, imageMimeType, suggestions, intentSummary } = body;

        if (!imageBase64 || !imageMimeType) {
            return NextResponse.json(
                { error: { code: 'VALIDATION_ERROR', message: '이미지 데이터가 필요합니다.' } },
                { status: 400 }
            );
        }
        if (!suggestions || suggestions.length === 0) {
            return NextResponse.json(
                { error: { code: 'VALIDATION_ERROR', message: '수정 제안이 필요합니다.' } },
                { status: 400 }
            );
        }

        const result = await runExecutorAgent({
            imageBase64,
            imageMimeType,
            suggestions,
            intentSummary: intentSummary || '',
        });

        return NextResponse.json({ success: true, data: result });
    } catch (error: any) {
        console.error('[Executor Agent] Error:', error);
        return NextResponse.json(
            { error: { code: 'EXECUTOR_ERROR', message: error.message || '이미지 생성 중 오류' } },
            { status: 500 }
        );
    }
}
