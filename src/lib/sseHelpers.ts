/**
 * SSE 헬퍼 유틸리티
 * Server-Sent Events를 위한 인코딩/스트림 유틸리티
 */

import { SSEEvent } from '@/types';

/**
 * SSE 이벤트를 문자열로 인코딩
 */
export function encodeSSEEvent(event: SSEEvent): string {
    return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * SSE 이벤트를 보낼 수 있는 스트림 컨트롤러 래퍼
 */
export class SSEEmitter {
    private controller: ReadableStreamDefaultController<Uint8Array>;
    private encoder = new TextEncoder();

    constructor(controller: ReadableStreamDefaultController<Uint8Array>) {
        this.controller = controller;
    }

    emit(event: SSEEvent) {
        try {
            this.controller.enqueue(this.encoder.encode(encodeSSEEvent(event)));
        } catch {
            // 스트림이 이미 닫힌 경우 무시
        }
    }

    close() {
        try {
            this.controller.close();
        } catch {
            // 이미 닫힌 경우 무시
        }
    }
}

/**
 * 딜레이 유틸리티 (에이전트 동작 사이 자연스러운 간격)
 */
export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
