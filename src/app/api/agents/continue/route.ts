import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { SSEEmitter } from '@/lib/sseHelpers';
import { runRevisionContinuation, runDecodeContinuation } from '@/agents/continuationOrchestrator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'OPENAI_API_KEY가 설정되지 않았습니다.' }), { status: 500 });
    }

    let body: any;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: '잘못된 요청 형식입니다.' }), { status: 400 });
    }

    const { mode } = body;
    if (!mode) {
        return new Response(JSON.stringify({ error: 'mode가 필요합니다.' }), { status: 400 });
    }

    const stream = new ReadableStream({
        async start(controller) {
            const emitter = new SSEEmitter(controller);
            try {
                const openai = new OpenAI({ apiKey });
                if (mode === 'revision') {
                    await runRevisionContinuation(emitter, openai, {
                        intentResult: body.intentResult,
                        gapResult: body.gapResult,
                        visualScanResult: body.visualScanResult,
                        userContext: body.userContext || '',
                        nodeTypeCounts: body.nodeTypeCounts || {},
                    });
                } else if (mode === 'decode') {
                    await runDecodeContinuation(emitter, openai, {
                        intentResult: body.intentResult,
                        visualScanResult: body.visualScanResult,
                        imageBase64: body.imageBase64,
                        imageMimeType: body.imageMimeType,
                        targetPreset: body.targetPreset || 'general',
                        contextPreset: body.contextPreset || 'brand-ad',
                        perspectiveLabel: body.perspectiveLabel,
                        nodeTypeCounts: body.nodeTypeCounts || {},
                    });
                } else {
                    emitter.emit({ type: 'error', message: `알 수 없는 mode: ${mode}` });
                }
            } catch (e: any) {
                emitter.emit({ type: 'error', message: e.message || '연속 분석 중 오류' });
            } finally {
                emitter.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        },
    });
}
