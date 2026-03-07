import OpenAI from 'openai';
import { SSEEmitter, delay } from '@/lib/sseHelpers';
import { getNodePosition, getCursorTargetPosition } from '@/lib/layoutEngine';
import { runIntentAgent } from './intentAgent';
import { runDecodingAgent } from './decodingAgent';
import { runGapAnalystAgent } from './gapAnalystAgent';
import { runEncodingSuggestionAgent } from './encodingSuggestionAgent';
import { PipelineInput, CanvasNode } from '@/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * SSE 기반 Orchestrator
 * 에이전트 파이프라인을 실행하며 각 단계를 SSE 이벤트로 스트리밍
 */
export async function runStreamingPipeline(
    input: PipelineInput,
    emitter: SSEEmitter
) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        emitter.emit({ type: 'error', message: 'OPENAI_API_KEY가 설정되지 않았습니다.' });
        emitter.close();
        return;
    }

    const openai = new OpenAI({ apiKey });

    // 이미지 입력 노드 생성
    const imageNodeId = uuidv4();
    const imageNode: CanvasNode = {
        id: imageNodeId,
        type: 'imageInput',
        position: getNodePosition('imageInput'),
        data: {
            title: '이미지 입력',
            content: {
                intentText: input.intentText,
                targetPreset: input.targetPreset,
                contextPreset: input.contextPreset,
                hasImage: true,
            },
            createdAt: Date.now(),
            status: 'active',
        },
    };
    emitter.emit({ type: 'node:create', node: imageNode });
    await delay(300);

    let prevNodeId = imageNodeId;

    try {
        // ─── Step 1: Intent Agent ───
        const intentPos = getCursorTargetPosition('intentAnalysis');
        emitter.emit({ type: 'cursor:move', agentId: 'intent', x: intentPos.x, y: intentPos.y });
        emitter.emit({ type: 'agent:status', agentId: 'intent', status: 'thinking', message: '창작 의도를 분석하고 있습니다...' });
        await delay(500);

        const intentResult = await runIntentAgent(openai, {
            imageBase64: input.imageBase64,
            imageMimeType: input.imageMimeType,
            intentText: input.intentText,
        });

        emitter.emit({ type: 'agent:status', agentId: 'intent', status: 'creating', message: '의도 분석 노드를 생성합니다' });
        await delay(300);

        const intentNodeId = uuidv4();
        const intentNode: CanvasNode = {
            id: intentNodeId,
            type: 'intentAnalysis',
            position: getNodePosition('intentAnalysis'),
            data: {
                agentId: 'intent',
                title: '의도 분석',
                content: intentResult,
                createdAt: Date.now(),
                status: 'active',
            },
        };
        emitter.emit({ type: 'node:create', node: intentNode });
        await delay(200);

        emitter.emit({ type: 'agent:status', agentId: 'intent', status: 'connecting' });
        emitter.emit({ type: 'edge:create', edge: { id: uuidv4(), source: prevNodeId, target: intentNodeId, animated: true } });
        await delay(300);

        emitter.emit({ type: 'agent:status', agentId: 'intent', status: 'idle' });
        prevNodeId = intentNodeId;

        // ─── Step 2: Decoding Agent ───
        const decodingPos = getCursorTargetPosition('decodingHypothesis');
        emitter.emit({ type: 'cursor:move', agentId: 'decoder', x: decodingPos.x, y: decodingPos.y });
        emitter.emit({ type: 'agent:status', agentId: 'decoder', status: 'thinking', message: '타겟 관점에서 해석 가설을 생성합니다...' });
        await delay(500);

        const decodingResult = await runDecodingAgent(openai, {
            imageBase64: input.imageBase64,
            imageMimeType: input.imageMimeType,
            intentAnalysis: intentResult,
            targetPreset: input.targetPreset,
            contextPreset: input.contextPreset,
        });

        emitter.emit({ type: 'agent:status', agentId: 'decoder', status: 'creating', message: '해석 가설 노드를 생성합니다' });
        await delay(300);

        // 가설 각각을 노드로 생성
        const hypothesisNodeIds: string[] = [];
        for (let i = 0; i < decodingResult.hypotheses.length; i++) {
            const h = decodingResult.hypotheses[i];
            const hNodeId = uuidv4();
            hypothesisNodeIds.push(hNodeId);

            const hNode: CanvasNode = {
                id: hNodeId,
                type: 'decodingHypothesis',
                position: getNodePosition('decodingHypothesis', i),
                data: {
                    agentId: 'decoder',
                    title: `가설 ${i + 1} (${(h.probability * 100).toFixed(0)}%)`,
                    content: h,
                    createdAt: Date.now(),
                    status: 'active',
                },
            };
            emitter.emit({ type: 'node:create', node: hNode });
            await delay(150);

            emitter.emit({ type: 'edge:create', edge: { id: uuidv4(), source: prevNodeId, target: hNodeId, animated: true } });
            await delay(100);
        }

        emitter.emit({ type: 'agent:status', agentId: 'decoder', status: 'idle' });

        // ─── Step 3: Gap Analyst Agent ───
        const gapPos = getCursorTargetPosition('gapAnalysis');
        emitter.emit({ type: 'cursor:move', agentId: 'gap', x: gapPos.x, y: gapPos.y });
        emitter.emit({ type: 'agent:status', agentId: 'gap', status: 'thinking', message: '의도-해석 차이를 분석합니다...' });
        await delay(500);

        const gapResult = await runGapAnalystAgent(openai, {
            intentAnalysis: intentResult,
            decodingResult: decodingResult,
        });

        emitter.emit({ type: 'agent:status', agentId: 'gap', status: 'creating', message: 'Gap 분석 노드를 생성합니다' });
        await delay(300);

        const gapNodeId = uuidv4();
        const gapNode: CanvasNode = {
            id: gapNodeId,
            type: 'gapAnalysis',
            position: getNodePosition('gapAnalysis'),
            data: {
                agentId: 'gap',
                title: `Gap 분석 (일치도 ${gapResult.overallAlignmentScore}%)`,
                content: gapResult,
                createdAt: Date.now(),
                status: 'active',
            },
        };
        emitter.emit({ type: 'node:create', node: gapNode });
        await delay(200);

        // 각 가설 노드에서 Gap 노드로 연결
        for (const hId of hypothesisNodeIds) {
            emitter.emit({ type: 'edge:create', edge: { id: uuidv4(), source: hId, target: gapNodeId, animated: true } });
            await delay(100);
        }

        emitter.emit({ type: 'agent:status', agentId: 'gap', status: 'idle' });

        // ─── Step 4: Revision Agent ───
        const revisionPos = getCursorTargetPosition('revisionProposal');
        emitter.emit({ type: 'cursor:move', agentId: 'revision', x: revisionPos.x, y: revisionPos.y });
        emitter.emit({ type: 'agent:status', agentId: 'revision', status: 'thinking', message: '수정 방향을 제안합니다...' });
        await delay(500);

        const suggestionResult = await runEncodingSuggestionAgent(openai, {
            imageBase64: input.imageBase64,
            imageMimeType: input.imageMimeType,
            intentAnalysis: intentResult,
            gapAnalysis: gapResult,
        });

        emitter.emit({ type: 'agent:status', agentId: 'revision', status: 'creating', message: '수정 제안 노드를 생성합니다' });
        await delay(300);

        const revisionNodeId = uuidv4();
        const proposalId = uuidv4();
        const revisionNode: CanvasNode = {
            id: revisionNodeId,
            type: 'revisionProposal',
            position: getNodePosition('revisionProposal'),
            data: {
                agentId: 'revision',
                title: '수정 제안',
                content: { ...suggestionResult, proposalId },
                createdAt: Date.now(),
                status: 'creating',
            },
        };
        emitter.emit({ type: 'node:create', node: revisionNode });
        await delay(200);

        emitter.emit({ type: 'edge:create', edge: { id: uuidv4(), source: gapNodeId, target: revisionNodeId, animated: true } });
        await delay(200);

        // 승인 요청
        emitter.emit({ type: 'agent:status', agentId: 'revision', status: 'waitingApproval', message: '사용자 승인을 기다립니다...' });
        emitter.emit({ type: 'approval:request', proposalId, suggestions: suggestionResult.suggestions });

        // 파이프라인 완료 (승인 대기 상태)
        emitter.emit({
            type: 'pipeline:done',
            summary: `일치도 ${gapResult.overallAlignmentScore}% | Gap ${gapResult.gaps.length}개 발견 | 제안 ${suggestionResult.suggestions.length}개 생성`,
        });

    } catch (error: any) {
        emitter.emit({ type: 'error', message: error.message || '파이프라인 실행 중 오류' });
    } finally {
        emitter.close();
    }
}
