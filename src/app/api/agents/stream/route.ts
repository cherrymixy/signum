import { NextRequest } from 'next/server';
import { runStreamingPipeline } from '@/agents/streamingOrchestrator';
import { SSEEmitter } from '@/lib/sseHelpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5분 — 자율 오케스트레이터는 긴 실행 가능

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
        async start(controller) {
            const emitter = new SSEEmitter(controller);

            // 즉시 heartbeat — 클라이언트에게 연결 성공을 알림
            emitter.emit({
                type: 'agent:status',
                agentId: 'orchestrator',
                status: 'thinking',
                message: '연결됨, 파이프라인 시작...',
            });

            try {
                await runStreamingPipeline(
                    { imageBase64, imageMimeType, intentText, targetPreset, contextPreset },
                    emitter
                );
            } catch (err: any) {
                emitter.emit({ type: 'error', message: err?.message || '파이프라인 오류' });
            } finally {
                emitter.close();
            }
        },
        cancel() {
            // 클라이언트가 연결을 끊으면 별도 정리 불필요 (finally에서 close)
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
