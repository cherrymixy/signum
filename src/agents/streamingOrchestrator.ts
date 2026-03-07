import OpenAI from 'openai';
import { SSEEmitter, delay } from '@/lib/sseHelpers';
import { getNodePosition } from '@/lib/layoutEngine';
import { runIntentAgent } from './intentAgent';
import { runDecodingAgent } from './decodingAgent';
import { runGapAnalystAgent } from './gapAnalystAgent';
import { runEncodingSuggestionAgent } from './encodingSuggestionAgent';
import { PipelineInput, CanvasNode, CanvasNodeType, AgentId } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// ─── 도구상자 슬롯 위치 (아이콘별 Y 오프셋) ───
const TOOLBOX_X = 45;
const TOOLBOX_SLOT_Y: Record<string, number> = {
    intentAnalysis: 62,
    decodingHypothesis: 86,
    gapAnalysis: 110,
    revisionProposal: 134,
    execution: 158,
    evaluation: 182,
};

// ─── 자연스러운 커서 이동 유틸 ───

/** 랜덤 jitter — 사람처럼 약간의 흔들림 */
function jitter(amplitude: number): number {
    return (Math.random() - 0.5) * amplitude;
}

/**
 * 곡선 웨이포인트 경로 생성 (Bézier-like)
 * 시작→끝 사이에 중간점 2~3개를 곡선으로 배치
 */
function generateNaturalPath(
    from: { x: number; y: number },
    to: { x: number; y: number },
    steps: number = 4,
): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    // 곡선 방향: 살짝 위로 휘는 아크
    const curveOffsetX = dy * 0.15 + jitter(20);
    const curveOffsetY = -Math.abs(dx) * 0.1 + jitter(15);

    for (let i = 1; i <= steps; i++) {
        const t = i / (steps + 1);
        // Quadratic Bézier (control point = midpoint + offset)
        const cx = from.x + dx * 0.5 + curveOffsetX;
        const cy = from.y + dy * 0.5 + curveOffsetY;
        const x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * cx + t * t * to.x + jitter(5);
        const y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * cy + t * t * to.y + jitter(5);
        points.push({ x: Math.round(x), y: Math.round(y) });
    }
    // 최종 정확한 목표 좌표
    points.push({ x: to.x, y: to.y });
    return points;
}

/**
 * 웨이포인트 경로를 따라 커서 이동 (가감속)
 * 처음/끝은 느리게, 중간은 빠르게 — 사람 손 움직임 모사
 */
async function moveCursorNaturally(
    emitter: SSEEmitter,
    agentId: AgentId,
    from: { x: number; y: number },
    to: { x: number; y: number },
    totalMs: number = 450,
) {
    const waypoints = generateNaturalPath(from, to);
    const n = waypoints.length;
    // ease-in-out 타이밍: 양 끝 느리게
    const timings: number[] = [];
    for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        // sine ease-in-out
        const w = 0.5 - 0.5 * Math.cos(Math.PI * t);
        timings.push(w);
    }
    const totalWeight = timings.reduce((a, b) => a + b, 0);

    for (let i = 0; i < n; i++) {
        emitter.emit({ type: 'cursor:move', agentId, x: waypoints[i].x, y: waypoints[i].y });
        const segmentTime = Math.max(40, Math.round((timings[i] / totalWeight) * totalMs));
        await delay(segmentTime);
    }
}

/**
 * 에이전트가 도구상자에서 노드를 가져오는 시퀀스 (자연스러운 버전)
 * 
 * 1. 현재 위치 → 도구상자 아이콘으로 자연스럽게 이동
 * 2. 잠깐 멈춤 (아이콘 위에서 hover)
 * 3. Grab
 * 4. 노드를 들고 목표 위치까지 자연스럽게 이동
 * 5. 목표 위치에서 잠깐 멈춤 (배치 확인)
 * 6. Drop — 커서의 정확한 좌표에 노드 생성
 */
async function grabAndPlace(
    emitter: SSEEmitter,
    agentId: AgentId,
    nodeType: CanvasNodeType,
    cursorFrom: { x: number; y: number },
    dropTarget: { x: number; y: number },
) {
    const toolboxTarget = {
        x: TOOLBOX_X,
        y: TOOLBOX_SLOT_Y[nodeType] || 100,
    };

    // 1. 도구상자까지 자연스럽게 이동
    await moveCursorNaturally(emitter, agentId, cursorFrom, toolboxTarget, 400);

    // 2. hover 멈춤
    await delay(180);

    // 3. Grab
    emitter.emit({ type: 'cursor:grab', agentId, nodeType });
    await delay(250);

    // 4. carrying 상태로 목표 위치까지 이동 (노드 들고)
    emitter.emit({ type: 'agent:status', agentId, status: 'carrying', message: `노드를 배치합니다` });
    await moveCursorNaturally(emitter, agentId, toolboxTarget, dropTarget, 550);

    // 5. 배치 확인 멈춤
    await delay(150);

    // 6. Drop
    emitter.emit({ type: 'cursor:drop', agentId });
    await delay(120);
}

/**
 * 에이전트가 두 노드를 연결 — source 쪽에서 target 쪽까지 커서 이동 후 엣지 생성
 */
async function connectNodes(
    emitter: SSEEmitter,
    agentId: AgentId,
    sourcePos: { x: number; y: number },
    targetPos: { x: number; y: number },
    edge: { id: string; source: string; target: string; animated: boolean },
) {
    const from = { x: sourcePos.x + 150, y: sourcePos.y + 40 };
    const to = { x: targetPos.x + 10, y: targetPos.y + 40 };

    // 커서를 source → target으로 자연스럽게 이동
    emitter.emit({ type: 'cursor:connect', agentId, fromX: from.x, fromY: from.y, toX: to.x, toY: to.y });
    await moveCursorNaturally(emitter, agentId, from, to, 350);
    await delay(80);
    emitter.emit({ type: 'edge:create', edge });
    await delay(100);
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

    // ─── 이미지 입력 노드 ───
    const imageNodeId = uuidv4();
    const imagePos = getNodePosition('imageInput');
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
    // 에이전트 커서 현재 위치 추적
    let cursorPos = { x: imagePos.x + 120, y: imagePos.y + 60 };

    try {
        // ═══════════════════════════════════════════
        // Step 1: Intent Agent — 💡
        // ═══════════════════════════════════════════
        const intentPos = getNodePosition('intentAnalysis');

        // 이미지 노드 근처로 자연스럽게 이동하며 분석 시작
        emitter.emit({ type: 'agent:status', agentId: 'intent', status: 'thinking', message: '창작 의도를 분석하고 있습니다...' });
        await moveCursorNaturally(emitter, 'intent', cursorPos, { x: imagePos.x + 100, y: imagePos.y + 30 }, 350);
        cursorPos = { x: imagePos.x + 100, y: imagePos.y + 30 };

        const intentResult = await runIntentAgent(openai, {
            imageBase64: input.imageBase64,
            imageMimeType: input.imageMimeType,
            intentText: input.intentText,
        });

        // 도구상자에서 노드 가져와 배치
        const intentDrop = { x: intentPos.x + 20, y: intentPos.y + 15 };
        await grabAndPlace(emitter, 'intent', 'intentAnalysis', cursorPos, intentDrop);
        cursorPos = intentDrop;

        const intentNodeId = uuidv4();
        emitter.emit({
            type: 'node:create',
            node: {
                id: intentNodeId,
                type: 'intentAnalysis',
                position: intentPos,
                data: { agentId: 'intent', title: '의도 분석', content: intentResult, createdAt: Date.now(), status: 'active' },
            },
        });
        await delay(200);

        await connectNodes(emitter, 'intent', prevNodePos, intentPos, {
            id: uuidv4(), source: prevNodeId, target: intentNodeId, animated: true,
        });
        emitter.emit({ type: 'agent:status', agentId: 'intent', status: 'idle' });
        prevNodeId = intentNodeId;
        prevNodePos = intentPos;

        // ═══════════════════════════════════════════
        // Step 2: Decoding Agent — 👁️
        // ═══════════════════════════════════════════
        cursorPos = { x: intentPos.x + 140, y: intentPos.y + 30 };
        emitter.emit({ type: 'agent:status', agentId: 'decoder', status: 'thinking', message: '타겟 관점에서 해석 가설을 생성합니다...' });
        await moveCursorNaturally(emitter, 'decoder', { x: TOOLBOX_X, y: TOOLBOX_SLOT_Y['decodingHypothesis'] }, { x: intentPos.x + 120, y: intentPos.y + 20 }, 300);

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
            const hDrop = { x: hPos.x + 20, y: hPos.y + 15 };

            await grabAndPlace(emitter, 'decoder', 'decodingHypothesis', cursorPos, hDrop);
            cursorPos = hDrop;

            const hNodeId = uuidv4();
            hypothesisNodeIds.push(hNodeId);

            emitter.emit({
                type: 'node:create',
                node: {
                    id: hNodeId,
                    type: 'decodingHypothesis',
                    position: hPos,
                    data: { agentId: 'decoder', title: `가설 ${i + 1} (${(h.probability * 100).toFixed(0)}%)`, content: h, createdAt: Date.now(), status: 'active' },
                },
            });
            await delay(120);

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
        await moveCursorNaturally(emitter, 'gap', cursorPos, { x: hypothesisPositions[0]?.x + 100 || 500, y: hypothesisPositions[0]?.y || 100 }, 350);
        cursorPos = { x: hypothesisPositions[0]?.x + 100 || 500, y: hypothesisPositions[0]?.y || 100 };

        const gapResult = await runGapAnalystAgent(openai, {
            intentAnalysis: intentResult,
            decodingResult: decodingResult,
        });

        const gapDrop = { x: gapPos.x + 20, y: gapPos.y + 15 };
        await grabAndPlace(emitter, 'gap', 'gapAnalysis', cursorPos, gapDrop);
        cursorPos = gapDrop;

        const gapNodeId = uuidv4();
        emitter.emit({
            type: 'node:create',
            node: {
                id: gapNodeId,
                type: 'gapAnalysis',
                position: gapPos,
                data: { agentId: 'gap', title: `Gap 분석 (일치도 ${gapResult.overallAlignmentScore}%)`, content: gapResult, createdAt: Date.now(), status: 'active' },
            },
        });
        await delay(200);

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
        await moveCursorNaturally(emitter, 'revision', cursorPos, { x: gapPos.x + 100, y: gapPos.y + 20 }, 350);
        cursorPos = { x: gapPos.x + 100, y: gapPos.y + 20 };

        const suggestionResult = await runEncodingSuggestionAgent(openai, {
            imageBase64: input.imageBase64,
            imageMimeType: input.imageMimeType,
            intentAnalysis: intentResult,
            gapAnalysis: gapResult,
        });

        const revDrop = { x: revisionPos.x + 20, y: revisionPos.y + 15 };
        await grabAndPlace(emitter, 'revision', 'revisionProposal', cursorPos, revDrop);
        cursorPos = revDrop;

        const revisionNodeId = uuidv4();
        const proposalId = uuidv4();
        emitter.emit({
            type: 'node:create',
            node: {
                id: revisionNodeId,
                type: 'revisionProposal',
                position: revisionPos,
                data: { agentId: 'revision', title: '수정 제안', content: { ...suggestionResult, proposalId }, createdAt: Date.now(), status: 'creating' },
            },
        });
        await delay(200);

        await connectNodes(emitter, 'revision', gapPos, revisionPos, {
            id: uuidv4(), source: gapNodeId, target: revisionNodeId, animated: true,
        });

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
