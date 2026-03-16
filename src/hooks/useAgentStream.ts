'use client';

import { useCallback, useRef } from 'react';
import { useAgentCanvasStore } from '@/stores/agentCanvasStore';
import { SSEEvent } from '@/types';

/**
 * SSE 스트리밍 연결 훅
 * /api/agents/stream에 연결하여 에이전트 이벤트를 실시간으로 수신
 */
export function useAgentStream() {
    // store 전체 구독 제거 — 내부에서 getState() 직접 사용
    const abortRef = useRef<AbortController | null>(null);

    const startStream = useCallback(async () => {
        const { input, startPipeline, handleSSEEvent } = useAgentCanvasStore.getState();

        if (!input.imageBase64 || !input.intentText?.trim()) {
            return;
        }

        // 이전 스트림 중단
        abortRef.current?.abort();
        const abortController = new AbortController();
        abortRef.current = abortController;

        // 파이프라인 시작 (캔버스 리셋)
        startPipeline();

        try {
            const response = await fetch('/api/agents/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageBase64: input.imageBase64,
                    imageMimeType: input.imageMimeType,
                    intentText: input.intentText,
                    targetPreset: input.targetPreset,
                    contextPreset: input.contextPreset,
                    profileContext: input.profileContext,
                }),
                signal: abortController.signal,
            });

            if (!response.ok) {
                let errorMsg = '스트림 연결 실패';
                try {
                    const error = await response.json();
                    errorMsg = error.error || errorMsg;
                } catch {
                    const text = await response.text().catch(() => '');
                    errorMsg = text || `HTTP ${response.status}`;
                }
                handleSSEEvent({ type: 'error', message: errorMsg });
                return;
            }

            const reader = response.body?.getReader();
            if (!reader) {
                handleSSEEvent({ type: 'error', message: '스트림을 읽을 수 없습니다' });
                return;
            }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // SSE 이벤트 파싱 (data: {...}\n\n 형식)
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || ''; // 마지막 불완전한 청크 보존

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data: ')) continue;

                    try {
                        const json = trimmed.slice(6); // 'data: ' 제거
                        const event: SSEEvent = JSON.parse(json);
                        handleSSEEvent(event);
                    } catch {
                        // 파싱 실패 무시
                    }
                }
            }

            // 스트림이 pipeline:done 이벤트 없이 종료된 경우 상태 복구
            const currentStatus = useAgentCanvasStore.getState().pipelineStatus;
            if (currentStatus === 'running') {
                handleSSEEvent({ type: 'error', message: '스트림이 예기치 않게 종료되었습니다' });
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                handleSSEEvent({ type: 'error', message: error.message || '스트림 오류' });
            }
        }
    }, []);

    const stopStream = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;
    }, []);

    return { startStream, stopStream };
}
