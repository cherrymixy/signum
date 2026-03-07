import OpenAI from 'openai';
import { SSEEmitter, delay } from '@/lib/sseHelpers';
import { getNodePosition, getCursorTargetPosition } from '@/lib/layoutEngine';
import { runIntentAgent } from './intentAgent';
import { runDecodingAgent } from './decodingAgent';
import { runGapAnalystAgent } from './gapAnalystAgent';
import { runEncodingSuggestionAgent } from './encodingSuggestionAgent';
import { PipelineInput, CanvasNode, CanvasNodeType, AgentId } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// 도구상자 위치 (캔버스 좌측 상단)
const TOOLBOX_X = 30;
const TOOLBOX_Y = 30;

/**
 * 에이전트가 도구상자에서 노드를 가져오는 시퀀스
 */
async function grabAndPlace(
    emitter: SSEEmitter,
    agentId: AgentId,
    nodeType: CanvasNodeType,
    targetX: number,
    targetY: number,
) {
    // 1. 도구상자로 커서 이동
    emitter.emit({ type: 'cursor:move', agentId, x: TOOLBOX_X + 20, y: TOOLBOX_Y + 40 });
    await delay(400);

    // 2. 노드 타입 grab
    emitter.emit({ type: 'cursor:grab', agentId, nodeType });
    await delay(300);

    // 3. 목표 위치로 이동 (carrying 상태)
    emitter.emit({ type: 'agent:status', agentId, status: 'carrying', message: `${nodeType} 노드를 배치합니다` });
    emitter.emit({ type: 'cursor:move', agentId, x: targetX, y: targetY });
    await delay(500);

    // 4. 드롭
    emitter.emit({ type: 'cursor:drop', agentId });
    await delay(200);
}

/**
 * 에이전트가 두 노드를 연결하는 시퀀스
 */
async function connectNodes(
    emitter: SSEEmitter,
    agentId: AgentId,
    sourcePos: { x: number; y: number },
    targetPos: { x: number; y: number },
    edge: { id: string; source: string; target: string; animated: boolean },
) {
    emitter.emit({
        type: 'cursor:connect',
        agentId,
        fromX: sourcePos.x + 120,
        fromY: sourcePos.y + 30,
        toX: targetPos.x - 10,
        toY: targetPos.y + 30,
    });
    await delay(350);
    emitter.emit({ type: 'edge:create', edge });
    await delay(150);
}

/**
 * SSE 기반 Orchestrator
 * 에이전트가 도구상자에서 노드를 가져와 캔버스에 배치하는 과정을 시각화
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

    // ─── 이미지 입력 노드 (자동 배치) ───
    const imageNodeId = uuidv4();
    const imagePos = getNodePosition('imageInput');
    const imageNode: CanvasNode = {
        id: imageNodeId,
        type: 'imageInput',
        position: imagePos,
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
    await delay(400);

    let prevNodeId = imageNodeId;
    let prevNodePos = imagePos;

    try {
        // ═══════════════════════════════════════════
        // Step 1: Intent Agent — 💡 도구상자에서 노드를 가져옴
        // ═══════════════════════════════════════════
        const intentPos = getNodePosition('intentAnalysis');

        emitter.emit({ type: 'agent:status', agentId: 'intent', status: 'thinking', message: '창작 의도를 분석하고 있습니다...' });
        emitter.emit({ type: 'cursor:move', agentId: 'intent', x: imagePos.x + 100, y: imagePos.y });
        await delay(400);

        const intentResult = await runIntentAgent(openai, {
            imageBase64: input.imageBase64,
            imageMimeType: input.imageMimeType,
            intentText: input.intentText,
        });

        // 도구상자에서 노드 가져오기
        await grabAndPlace(emitter, 'intent', 'intentAnalysis', intentPos.x + 20, intentPos.y - 20);

        // 노드 생성
        const intentNodeId = uuidv4();
        const intentNode: CanvasNode = {
            id: intentNodeId,
            type: 'intentAnalysis',
            position: intentPos,
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

        // 연결
        await connectNodes(emitter, 'intent', prevNodePos, intentPos, {
            id: uuidv4(), source: prevNodeId, target: intentNodeId, animated: true,
        });

        emitter.emit({ type: 'agent:status', agentId: 'intent', status: 'idle' });
        prevNodeId = intentNodeId;
        prevNodePos = intentPos;

        // ═══════════════════════════════════════════
        // Step 2: Decoding Agent — 👁️ 가설 노드 여러개 생성
        // ═══════════════════════════════════════════
        emitter.emit({ type: 'agent:status', agentId: 'decoder', status: 'thinking', message: '타겟 관점에서 해석 가설을 생성합니다...' });
        emitter.emit({ type: 'cursor:move', agentId: 'decoder', x: intentPos.x + 100, y: intentPos.y });
        await delay(400);

        const decodingResult = await runDecodingAgent(openai, {
            imageBase64: input.imageBase64,
            imageMimeType: input.imageMimeType,
            intentAnalysis: intentResult,
            targetPreset: input.targetPreset,
            contextPreset: input.contextPreset,
        });

        const hypothesisNodeIds: string[] = [];
        const hypothesisPositions: { x: number; y: number }[] = [];

        for (let i = 0; i < decodingResult.hypotheses.length; i++) {
            const h = decodingResult.hypotheses[i];
            const hPos = getNodePosition('decodingHypothesis', i);
            hypothesisPositions.push(hPos);

            // 각 가설마다 도구상자에서 가져오기
            await grabAndPlace(emitter, 'decoder', 'decodingHypothesis', hPos.x + 20, hPos.y - 20);

            const hNodeId = uuidv4();
            hypothesisNodeIds.push(hNodeId);

            emitter.emit({
                type: 'node:create',
                node: {
                    id: hNodeId,
                    type: 'decodingHypothesis',
                    position: hPos,
                    data: {
                        agentId: 'decoder',
                        title: `가설 ${i + 1} (${(h.probability * 100).toFixed(0)}%)`,
                        content: h,
                        createdAt: Date.now(),
                        status: 'active',
                    },
                },
            });
            await delay(150);

            // 연결
            await connectNodes(emitter, 'decoder', prevNodePos, hPos, {
                id: uuidv4(), source: prevNodeId, target: hNodeId, animated: true,
            });
        }

        emitter.emit({ type: 'agent:status', agentId: 'decoder', status: 'idle' });

        // ═══════════════════════════════════════════
        // Step 3: Gap Analyst Agent — ⚡
        // ═══════════════════════════════════════════
        const gapPos = getNodePosition('gapAnalysis');

        emitter.emit({ type: 'agent:status', agentId: 'gap', status: 'thinking', message: '의도-해석 차이를 분석합니다...' });
        emitter.emit({ type: 'cursor:move', agentId: 'gap', x: hypothesisPositions[0]?.x || 500, y: hypothesisPositions[0]?.y || 100 });
        await delay(400);

        const gapResult = await runGapAnalystAgent(openai, {
            intentAnalysis: intentResult,
            decodingResult: decodingResult,
        });

        // 도구상자에서 가져오기
        await grabAndPlace(emitter, 'gap', 'gapAnalysis', gapPos.x + 20, gapPos.y - 20);

        const gapNodeId = uuidv4();
        emitter.emit({
            type: 'node:create',
            node: {
                id: gapNodeId,
                type: 'gapAnalysis',
                position: gapPos,
                data: {
                    agentId: 'gap',
                    title: `Gap 분석 (일치도 ${gapResult.overallAlignmentScore}%)`,
                    content: gapResult,
                    createdAt: Date.now(),
                    status: 'active',
                },
            },
        });
        await delay(200);

        // 각 가설에서 Gap으로 연결
        for (let i = 0; i < hypothesisNodeIds.length; i++) {
            await connectNodes(emitter, 'gap', hypothesisPositions[i], gapPos, {
                id: uuidv4(), source: hypothesisNodeIds[i], target: gapNodeId, animated: true,
            });
        }

        emitter.emit({ type: 'agent:status', agentId: 'gap', status: 'idle' });

        // ═══════════════════════════════════════════
        // Step 4: Revision Agent — 🔧
        // ═══════════════════════════════════════════
        const revisionPos = getNodePosition('revisionProposal');

        emitter.emit({ type: 'agent:status', agentId: 'revision', status: 'thinking', message: '수정 방향을 제안합니다...' });
        emitter.emit({ type: 'cursor:move', agentId: 'revision', x: gapPos.x + 100, y: gapPos.y });
        await delay(400);

        const suggestionResult = await runEncodingSuggestionAgent(openai, {
            imageBase64: input.imageBase64,
            imageMimeType: input.imageMimeType,
            intentAnalysis: intentResult,
            gapAnalysis: gapResult,
        });

        // 도구상자에서 가져오기
        await grabAndPlace(emitter, 'revision', 'revisionProposal', revisionPos.x + 20, revisionPos.y - 20);

        const revisionNodeId = uuidv4();
        const proposalId = uuidv4();
        emitter.emit({
            type: 'node:create',
            node: {
                id: revisionNodeId,
                type: 'revisionProposal',
                position: revisionPos,
                data: {
                    agentId: 'revision',
                    title: '수정 제안',
                    content: { ...suggestionResult, proposalId },
                    createdAt: Date.now(),
                    status: 'creating',
                },
            },
        });
        await delay(200);

        // 연결
        await connectNodes(emitter, 'revision', gapPos, revisionPos, {
            id: uuidv4(), source: gapNodeId, target: revisionNodeId, animated: true,
        });

        // 승인 요청
        emitter.emit({ type: 'agent:status', agentId: 'revision', status: 'waitingApproval', message: '사용자 승인을 기다립니다...' });
        emitter.emit({ type: 'approval:request', proposalId, suggestions: suggestionResult.suggestions });

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
