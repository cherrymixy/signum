'use client';

import { useCallback } from 'react';
import { useAgentCanvasStore } from '@/stores/agentCanvasStore';
import { SSEEvent } from '@/types';

export function useContinuationStream() {
    const startContinuation = useAgentCanvasStore((s) => s.startContinuation);
    const endContinuation = useAgentCanvasStore((s) => s.endContinuation);
    const handleSSEEvent = useAgentCanvasStore((s) => s.handleSSEEvent);

    const stream = useCallback(async (body: object) => {
        startContinuation();

        try {
            const response = await fetch('/api/agents/continue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok || !response.body) {
                endContinuation('error');
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data: ')) continue;
                    try {
                        const event: SSEEvent = JSON.parse(trimmed.slice(6));
                        // pipeline:done and error are handled locally, not forwarded to main handleSSEEvent
                        if (event.type === 'pipeline:done') {
                            endContinuation('done');
                        } else if (event.type === 'error') {
                            endContinuation('error');
                        } else {
                            handleSSEEvent(event);
                        }
                    } catch {
                        // ignore parse errors
                    }
                }
            }

            const currentContinuationStatus = useAgentCanvasStore.getState().continuationStatus;
            if (currentContinuationStatus === 'running') {
                endContinuation('done');
            }
        } catch (e: any) {
            endContinuation('error');
        }
    }, [startContinuation, endContinuation, handleSSEEvent]);

    return { stream };
}
