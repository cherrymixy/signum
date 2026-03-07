import { NextRequest } from 'next/server';
import { runStreamingPipeline } from '@/agents/streamingOrchestrator';
import { SSEEmitter } from '@/lib/sseHelpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { imageBase64, imageMimeType, intentText, targetPreset, contextPreset } = body;

    // Validation
    if (!imageBase64 || !imageMimeType) {
        return new Response(JSON.stringify({ error: '이미지 데이터가 필요합니다.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    if (!intentText?.trim()) {
        return new Response(JSON.stringify({ error: '의도 텍스트를 입력해주세요.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const stream = new ReadableStream({
        start(controller) {
            const emitter = new SSEEmitter(controller);

            runStreamingPipeline(
                { imageBase64, imageMimeType, intentText, targetPreset, contextPreset },
                emitter
            );
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
        },
    });
}
