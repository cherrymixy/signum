import { NextRequest, NextResponse } from 'next/server';
import { runPipeline } from '@/agents/orchestrator';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { imageBase64, imageMimeType, intentText, targetPreset, contextPreset } = body;

        if (!imageBase64 || !imageMimeType) {
            return NextResponse.json(
                { error: { code: 'VALIDATION_ERROR', message: '이미지 데이터가 필요합니다.' } },
                { status: 400 }
            );
        }
        if (!intentText?.trim()) {
            return NextResponse.json(
                { error: { code: 'VALIDATION_ERROR', message: '의도 텍스트를 입력해주세요.' } },
                { status: 400 }
            );
        }
        if (!targetPreset || !contextPreset) {
            return NextResponse.json(
                { error: { code: 'VALIDATION_ERROR', message: '타겟과 컨텍스트를 선택해주세요.' } },
                { status: 400 }
            );
        }

        const result = await runPipeline({
            imageBase64, imageMimeType, intentText, targetPreset, contextPreset,
        });

        return NextResponse.json({ success: true, data: result });
    } catch (error: any) {
        console.error('[Pipeline] Error:', error);
        return NextResponse.json(
            { error: { code: 'PIPELINE_ERROR', message: error.message || '파이프라인 실행 중 오류' } },
            { status: 500 }
        );
    }
}
