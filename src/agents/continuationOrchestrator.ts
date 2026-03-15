import OpenAI from 'openai';
import { SSEEmitter, delay } from '@/lib/sseHelpers';
import { getNodePosition } from '@/lib/layoutEngine';
import { runEncodingSuggestionAgent } from './encodingSuggestionAgent';
import { runDecodingAgent } from './decodingAgent';
import {
    IntentAnalysis, GapAnalysis, VisualScanResult,
    CanvasNode,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';

export interface RevisionContinuationParams {
    intentResult: IntentAnalysis;
    gapResult: GapAnalysis;
    visualScanResult?: VisualScanResult;
    userContext: string;
    nodeTypeCounts: Record<string, number>;
}

export async function runRevisionContinuation(
    emitter: SSEEmitter,
    openai: OpenAI,
    params: RevisionContinuationParams,
) {
    const { intentResult, gapResult, visualScanResult, userContext, nodeTypeCounts } = params;
    const existingCount = nodeTypeCounts['revisionProposal'] ?? 0;
    const pos = getNodePosition('revisionProposal', existingCount);
    const nodeId = uuidv4();
    const proposalId = uuidv4();

    emitter.emit({ type: 'agent:status', agentId: 'revision', status: 'thinking', message: '새 수정 방향을 분석합니다...' });
    await delay(200);

    // Simple cursor move to drop target
    emitter.emit({ type: 'cursor:grab', agentId: 'revision', nodeType: 'revisionProposal' });
    await delay(200);
    emitter.emit({ type: 'cursor:move', agentId: 'revision', x: pos.x + 20, y: pos.y + 15 });
    await delay(300);
    emitter.emit({ type: 'cursor:drop', agentId: 'revision' });
    await delay(100);

    const node: CanvasNode = {
        id: nodeId,
        type: 'revisionProposal',
        position: pos,
        data: {
            agentId: 'revision',
            title: '수정 제안 (재생성)',
            content: null,
            streamingText: '',
            createdAt: Date.now(),
            status: 'streaming',
        },
    };
    emitter.emit({ type: 'node:create', node });
    await delay(100);

    const result = await runEncodingSuggestionAgent(openai, {
        intentAnalysis: intentResult,
        gapAnalysis: gapResult,
        visualScan: visualScanResult,
        userContext: userContext || undefined,
    }, (text) => emitter.emit({ type: 'node:update', nodeId, data: { streamingText: text } }));

    emitter.emit({ type: 'node:update', nodeId, data: { content: { ...result, proposalId }, streamingText: undefined, status: 'creating' } });
    emitter.emit({ type: 'agent:status', agentId: 'revision', status: 'waitingApproval', message: '사용자 승인을 기다립니다...' });
    emitter.emit({ type: 'approval:request', proposalId, suggestions: result.suggestions });
    await delay(200);

    emitter.emit({ type: 'pipeline:done', summary: '수정 방향이 재생성되었습니다.' });
}

export interface DecodeContinuationParams {
    intentResult: IntentAnalysis;
    visualScanResult?: VisualScanResult;
    imageBase64: string;
    imageMimeType: string;
    targetPreset: string;
    contextPreset: string;
    perspectiveLabel: string;
    nodeTypeCounts: Record<string, number>;
}

export async function runDecodeContinuation(
    emitter: SSEEmitter,
    openai: OpenAI,
    params: DecodeContinuationParams,
) {
    const { intentResult, visualScanResult, imageBase64, imageMimeType, targetPreset, contextPreset, perspectiveLabel, nodeTypeCounts } = params;
    const existingCount = nodeTypeCounts['decodingHypothesis'] ?? 0;
    const pos = getNodePosition('decodingHypothesis', existingCount);
    const nodeId = uuidv4();

    emitter.emit({ type: 'agent:status', agentId: 'decoder', status: 'thinking', message: `${perspectiveLabel} 관점으로 재해석합니다...` });
    await delay(200);

    emitter.emit({ type: 'cursor:grab', agentId: 'decoder', nodeType: 'decodingHypothesis' });
    await delay(200);
    emitter.emit({ type: 'cursor:move', agentId: 'decoder', x: pos.x + 20, y: pos.y + 15 });
    await delay(300);
    emitter.emit({ type: 'cursor:drop', agentId: 'decoder' });
    await delay(100);

    const node: CanvasNode = {
        id: nodeId,
        type: 'decodingHypothesis',
        position: pos,
        data: {
            agentId: 'decoder',
            title: `${perspectiveLabel} 관점`,
            content: null,
            streamingText: '',
            createdAt: Date.now(),
            status: 'streaming',
        },
    };
    emitter.emit({ type: 'node:create', node });
    await delay(100);

    const result = await runDecodingAgent(openai, {
        imageBase64,
        imageMimeType,
        intentAnalysis: intentResult,
        visualScan: visualScanResult,
        targetPreset: perspectiveLabel,
        contextPreset,
        perspective: 'target',
    }, (text) => emitter.emit({ type: 'node:update', nodeId, data: { streamingText: text } }));

    const dominant = result.hypotheses.sort((a, b) => b.probability - a.probability)[0];
    emitter.emit({ type: 'node:update', nodeId, data: { title: `${perspectiveLabel} 관점`, content: dominant, streamingText: undefined, status: 'active' } });
    emitter.emit({ type: 'agent:status', agentId: 'decoder', status: 'idle' });
    await delay(200);

    emitter.emit({ type: 'pipeline:done', summary: `${perspectiveLabel} 관점이 추가되었습니다.` });
}
