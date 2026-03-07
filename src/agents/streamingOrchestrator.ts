import OpenAI from 'openai';
import { SSEEmitter, delay } from '@/lib/sseHelpers';
import { getNodePosition } from '@/lib/layoutEngine';
import {
    moveTo, fidget, wander, scan, revisit,
    grabFromToolbox, connectWithCursor,
} from '@/lib/cursorBehaviors';
import { runIntentAgent } from './intentAgent';
import { runDecodingAgent } from './decodingAgent';
import { runGapAnalystAgent } from './gapAnalystAgent';
import { runEncodingSuggestionAgent } from './encodingSuggestionAgent';
import { PipelineInput, CanvasNode, AgentId } from '@/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * API 호출과 동시에 에이전트 커서가 주변을 탐색하는 패턴
 * Promise.all로 API 호출 + wander를 동시 실행
 */
async function thinkWhileCalling<T>(
    emitter: SSEEmitter,
    agentId: AgentId,
    cursorPos: { x: number; y: number },
    interestPoints: { x: number; y: number }[],
    apiCall: () => Promise<T>,
): Promise<{ result: T; cursorPos: { x: number; y: number } }> {
    // wander는 API가 끝날 때까지 계속 (최대 15초)
    let wanderDone = false;
    let lastPos = { ...cursorPos };

    const wanderLoop = async () => {
        while (!wanderDone) {
            lastPos = await wander(emitter, agentId, lastPos, interestPoints, 2500);
            if (!wanderDone) {
                lastPos = await fidget(emitter, agentId, lastPos, 3, 10);
            }
        }
    };

    const [result] = await Promise.all([
        apiCall().then((r) => { wanderDone = true; return r; }),
        wanderLoop(),
    ]);

    return { result, cursorPos: lastPos };
}

// ═══════════════════════════════════════════
// 메인 파이프라인
// ═══════════════════════════════════════════

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

    // 생성된 노드 위치를 추적 (에이전트 탐색 용)
    const placedNodes: { x: number; y: number }[] = [];

    // ─── 이미지 입력 노드 ───
    const imageNodeId = uuidv4();
    const imagePos = getNodePosition('imageInput');
    placedNodes.push(imagePos);
    emitter.emit({
        type: 'node:create',
        node: {
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
        },
    });
    await delay(400);

    let prevNodeId = imageNodeId;
    let prevNodePos = imagePos;
    let cursor = { x: imagePos.x + 120, y: imagePos.y + 50 };

    try {
        // ═══════════════════════════════════════════
        // Step 1: Intent Agent — 💡
        // ═══════════════════════════════════════════
        const intentPos = getNodePosition('intentAnalysis');

        emitter.emit({ type: 'agent:status', agentId: 'intent', status: 'thinking', message: '이미지를 살펴보고 있습니다...' });

        // 이미지 노드 주변을 탐색하며 API 호출
        const intentOut = await thinkWhileCalling(
            emitter, 'intent', cursor,
            [imagePos, { x: imagePos.x + 180, y: imagePos.y }, { x: imagePos.x, y: imagePos.y + 100 }],
            () => runIntentAgent(openai, {
                imageBase64: input.imageBase64,
                imageMimeType: input.imageMimeType,
                intentText: input.intentText,
            }),
        );
        cursor = intentOut.cursorPos;

        // 분석 완료 → 도구상자에서 노드 가져오기
        emitter.emit({ type: 'agent:status', agentId: 'intent', status: 'creating', message: '의도 분석 노드를 가져옵니다' });
        const intentDrop = { x: intentPos.x + 20, y: intentPos.y + 15 };
        cursor = await grabFromToolbox(emitter, 'intent', 'intentAnalysis', cursor, intentDrop);

        const intentNodeId = uuidv4();
        emitter.emit({
            type: 'node:create',
            node: {
                id: intentNodeId, type: 'intentAnalysis', position: intentPos,
                data: { agentId: 'intent', title: '의도 분석', content: intentOut.result, createdAt: Date.now(), status: 'active' },
            },
        });
        placedNodes.push(intentPos);
        await delay(180);

        // 연결 + 결과 확인 (소스↔새노드 왔다갔다)
        cursor = await connectWithCursor(emitter, 'intent', cursor, prevNodePos, intentPos, {
            id: uuidv4(), source: prevNodeId, target: intentNodeId, animated: true,
        });
        cursor = await revisit(emitter, 'intent', cursor, prevNodePos, intentPos);

        emitter.emit({ type: 'agent:status', agentId: 'intent', status: 'idle' });
        prevNodeId = intentNodeId;
        prevNodePos = intentPos;

        // ═══════════════════════════════════════════
        // Step 2: Decoder Agent — 👁️
        // ═══════════════════════════════════════════
        cursor = { x: intentPos.x + 140, y: intentPos.y + 30 };
        emitter.emit({ type: 'agent:status', agentId: 'decoder', status: 'thinking', message: '타겟 관점에서 해석을 생성합니다...' });

        // 기존 노드들 훑어보며 API 호출
        const decodingOut = await thinkWhileCalling(
            emitter, 'decoder', cursor,
            [...placedNodes, { x: intentPos.x + 200, y: intentPos.y - 50 }],
            () => runDecodingAgent(openai, {
                imageBase64: input.imageBase64,
                imageMimeType: input.imageMimeType,
                intentAnalysis: intentOut.result,
                targetPreset: input.targetPreset,
                contextPreset: input.contextPreset,
            }),
        );
        cursor = decodingOut.cursorPos;

        const hypothesisNodeIds: string[] = [];
        const hypothesisPositions: { x: number; y: number }[] = [];

        for (let i = 0; i < decodingOut.result.hypotheses.length; i++) {
            const h = decodingOut.result.hypotheses[i];
            const hPos = getNodePosition('decodingHypothesis', i);
            hypothesisPositions.push(hPos);

            emitter.emit({ type: 'agent:status', agentId: 'decoder', status: 'creating', message: `가설 ${i + 1} 노드를 배치합니다` });
            const hDrop = { x: hPos.x + 20, y: hPos.y + 15 };
            cursor = await grabFromToolbox(emitter, 'decoder', 'decodingHypothesis', cursor, hDrop);

            const hNodeId = uuidv4();
            hypothesisNodeIds.push(hNodeId);

            emitter.emit({
                type: 'node:create',
                node: {
                    id: hNodeId, type: 'decodingHypothesis', position: hPos,
                    data: { agentId: 'decoder', title: `가설 ${i + 1} (${(h.probability * 100).toFixed(0)}%)`, content: h, createdAt: Date.now(), status: 'active' },
                },
            });
            placedNodes.push(hPos);
            await delay(100);

            cursor = await connectWithCursor(emitter, 'decoder', cursor, prevNodePos, hPos, {
                id: uuidv4(), source: prevNodeId, target: hNodeId, animated: true,
            });

            // 가설 배치 후 이전 가설도 다시 확인 (비교하는 느낌)
            if (i > 0) {
                cursor = await revisit(emitter, 'decoder', cursor, hypothesisPositions[i - 1], hPos);
            }
        }
        emitter.emit({ type: 'agent:status', agentId: 'decoder', status: 'idle' });

        // ═══════════════════════════════════════════
        // Step 3: Gap Analyst Agent — ⚡
        // ═══════════════════════════════════════════
        const gapPos = getNodePosition('gapAnalysis');
        emitter.emit({ type: 'agent:status', agentId: 'gap', status: 'thinking', message: '의도-해석 차이를 분석합니다...' });

        // 의도 노드와 가설 노드들 사이를 왔다갔다 하며 비교 분석
        const gapOut = await thinkWhileCalling(
            emitter, 'gap', cursor,
            [intentPos, ...hypothesisPositions, imagePos],
            () => runGapAnalystAgent(openai, {
                intentAnalysis: intentOut.result,
                decodingResult: decodingOut.result,
            }),
        );
        cursor = gapOut.cursorPos;

        // 기존 노드들 빠르게 스캔 후 Gap 노드 배치
        cursor = await scan(emitter, 'gap', cursor, [intentPos, ...hypothesisPositions]);

        emitter.emit({ type: 'agent:status', agentId: 'gap', status: 'creating', message: 'Gap 분석 노드를 배치합니다' });
        cursor = await grabFromToolbox(emitter, 'gap', 'gapAnalysis', cursor, { x: gapPos.x + 20, y: gapPos.y + 15 });

        const gapNodeId = uuidv4();
        emitter.emit({
            type: 'node:create',
            node: {
                id: gapNodeId, type: 'gapAnalysis', position: gapPos,
                data: { agentId: 'gap', title: `Gap 분석 (일치도 ${gapOut.result.overallAlignmentScore}%)`, content: gapOut.result, createdAt: Date.now(), status: 'active' },
            },
        });
        placedNodes.push(gapPos);
        await delay(180);

        // 각 가설에서 Gap으로 연결
        for (let i = 0; i < hypothesisNodeIds.length; i++) {
            cursor = await connectWithCursor(emitter, 'gap', cursor, hypothesisPositions[i], gapPos, {
                id: uuidv4(), source: hypothesisNodeIds[i], target: gapNodeId, animated: true,
            });
        }

        // Gap 노드와 의도 노드를 비교 확인
        cursor = await revisit(emitter, 'gap', cursor, intentPos, gapPos);
        emitter.emit({ type: 'agent:status', agentId: 'gap', status: 'idle' });

        // ═══════════════════════════════════════════
        // Step 4: Revision Agent — 🔧
        // ═══════════════════════════════════════════
        const revisionPos = getNodePosition('revisionProposal');
        emitter.emit({ type: 'agent:status', agentId: 'revision', status: 'thinking', message: '수정 방향을 고민합니다...' });

        // Gap 분석, 의도 분석, 원본 이미지를 돌아보며 수정안 생성
        const revOut = await thinkWhileCalling(
            emitter, 'revision', cursor,
            [gapPos, intentPos, imagePos, ...hypothesisPositions.slice(0, 2)],
            () => runEncodingSuggestionAgent(openai, {
                imageBase64: input.imageBase64,
                imageMimeType: input.imageMimeType,
                intentAnalysis: intentOut.result,
                gapAnalysis: gapOut.result,
            }),
        );
        cursor = revOut.cursorPos;

        // 수정안 노드 배치
        emitter.emit({ type: 'agent:status', agentId: 'revision', status: 'creating', message: '수정 제안 노드를 배치합니다' });
        cursor = await grabFromToolbox(emitter, 'revision', 'revisionProposal', cursor, { x: revisionPos.x + 20, y: revisionPos.y + 15 });

        const revisionNodeId = uuidv4();
        const proposalId = uuidv4();
        emitter.emit({
            type: 'node:create',
            node: {
                id: revisionNodeId, type: 'revisionProposal', position: revisionPos,
                data: { agentId: 'revision', title: '수정 제안', content: { ...revOut.result, proposalId }, createdAt: Date.now(), status: 'creating' },
            },
        });
        placedNodes.push(revisionPos);
        await delay(180);

        cursor = await connectWithCursor(emitter, 'revision', cursor, gapPos, revisionPos, {
            id: uuidv4(), source: gapNodeId, target: revisionNodeId, animated: true,
        });

        // 최종 확인: 원본 이미지 → Gap → 수정안 흐름 빠르게 훑기
        cursor = await scan(emitter, 'revision', cursor, [imagePos, gapPos, revisionPos]);

        emitter.emit({ type: 'agent:status', agentId: 'revision', status: 'waitingApproval', message: '사용자 승인을 기다립니다...' });
        emitter.emit({ type: 'approval:request', proposalId, suggestions: revOut.result.suggestions });

        emitter.emit({
            type: 'pipeline:done',
            summary: `일치도 ${gapOut.result.overallAlignmentScore}% | Gap ${gapOut.result.gaps.length}개 발견 | 제안 ${revOut.result.suggestions.length}개 생성`,
        });

    } catch (error: any) {
        emitter.emit({ type: 'error', message: error.message || '파이프라인 실행 중 오류' });
    } finally {
        emitter.close();
    }
}
