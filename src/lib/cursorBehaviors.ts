/**
 * 에이전트 커서의 유기적 움직임 패턴
 * 
 * 사람처럼 자연스러운 커서 행동:
 * - API 대기 중 주변 탐색 (wandering)
 * - 기존 노드 재방문 (revisiting)
 * - 작업 전 기존 결과 확인 (scanning)
 * - 미세한 떨림 (fidget)
 */

import { SSEEmitter, delay } from '@/lib/sseHelpers';
import { AgentId } from '@/types';

// ─── Helper ───

function rand(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

/** Bézier 곡선 웨이포인트 */
function bezierPath(
    from: { x: number; y: number },
    to: { x: number; y: number },
    steps: number = 4,
): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const cx = from.x + dx * 0.5 + rand(-30, 30);
    const cy = from.y + dy * 0.5 - Math.abs(dx) * 0.08 + rand(-20, 20);

    for (let i = 1; i <= steps; i++) {
        const t = i / (steps + 1);
        const x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * cx + t * t * to.x + rand(-3, 3);
        const y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * cy + t * t * to.y + rand(-3, 3);
        points.push({ x: Math.round(x), y: Math.round(y) });
    }
    points.push({ x: to.x, y: to.y });
    return points;
}

// ─── Core Movement ───

/**
 * 자연스럽게 커서 이동 (Bézier + ease-in-out)
 */
export async function moveTo(
    emitter: SSEEmitter,
    agentId: AgentId,
    from: { x: number; y: number },
    to: { x: number; y: number },
    durationMs: number = 400,
): Promise<{ x: number; y: number }> {
    const waypoints = bezierPath(from, to);
    const n = waypoints.length;
    for (let i = 0; i < n; i++) {
        emitter.emit({ type: 'cursor:move', agentId, x: waypoints[i].x, y: waypoints[i].y });
        // ease-in-out: 양 끝 느리게
        const t = i / (n - 1);
        const ease = 0.5 - 0.5 * Math.cos(Math.PI * t);
        const segMs = Math.max(30, Math.round(ease * durationMs / n * 2));
        await delay(segMs);
    }
    return to;
}

/**
 * fidget — 현재 위치 근처에서 미세하게 떨리는 움직임
 * 사람이 마우스를 잡고 있을 때의 미세한 흔들림
 */
export async function fidget(
    emitter: SSEEmitter,
    agentId: AgentId,
    center: { x: number; y: number },
    count: number = 3,
    amplitude: number = 8,
): Promise<{ x: number; y: number }> {
    let pos = { ...center };
    for (let i = 0; i < count; i++) {
        const x = Math.round(center.x + rand(-amplitude, amplitude));
        const y = Math.round(center.y + rand(-amplitude, amplitude));
        emitter.emit({ type: 'cursor:move', agentId, x, y });
        pos = { x, y };
        await delay(Math.round(rand(80, 180)));
    }
    return pos;
}

/**
 * wander — 여러 관심 지점 사이를 자연스럽게 돌아다님
 * API 대기 중 에이전트가 주변을 탐색하는 행동
 */
export async function wander(
    emitter: SSEEmitter,
    agentId: AgentId,
    currentPos: { x: number; y: number },
    interestPoints: { x: number; y: number }[],
    durationMs: number = 2000,
): Promise<{ x: number; y: number }> {
    if (interestPoints.length === 0) {
        return await fidget(emitter, agentId, currentPos, 6, 15);
    }

    let pos = { ...currentPos };
    const startTime = Date.now();

    while (Date.now() - startTime < durationMs) {
        // 랜덤 관심 지점 선택
        const target = pick(interestPoints);
        // 정확히 그 위치가 아닌, 약간 옆에서 "보는" 위치
        const lookAt = {
            x: target.x + Math.round(rand(-30, 60)),
            y: target.y + Math.round(rand(-25, 25)),
        };
        pos = await moveTo(emitter, agentId, pos, lookAt, 300);
        // 잠시 멈추며 "확인"
        await delay(Math.round(rand(150, 400)));
        // fidget
        pos = await fidget(emitter, agentId, pos, 2, 5);
    }
    return pos;
}

/**
 * scan — 기존 노드들을 훑어보는 행동
 * 새 작업 전에 기존 결과를 확인하는 느낌
 */
export async function scan(
    emitter: SSEEmitter,
    agentId: AgentId,
    currentPos: { x: number; y: number },
    nodePositions: { x: number; y: number }[],
): Promise<{ x: number; y: number }> {
    let pos = { ...currentPos };
    // 노드 1~2개만 빠르게 훑기
    const toScan = nodePositions.slice(-3).filter(() => Math.random() > 0.3);
    for (const np of toScan) {
        const lookAt = { x: np.x + 80, y: np.y + 20 };
        pos = await moveTo(emitter, agentId, pos, lookAt, 250);
        await delay(Math.round(rand(100, 250)));
    }
    return pos;
}

/**
 * revisit — 작업 후 방금 만든 노드와 소스 노드를 왔다 갔다 확인
 */
export async function revisit(
    emitter: SSEEmitter,
    agentId: AgentId,
    currentPos: { x: number; y: number },
    nodeA: { x: number; y: number },
    nodeB: { x: number; y: number },
): Promise<{ x: number; y: number }> {
    let pos = { ...currentPos };

    // 소스 노드 확인
    pos = await moveTo(emitter, agentId, pos, { x: nodeA.x + 60, y: nodeA.y + 25 }, 280);
    pos = await fidget(emitter, agentId, pos, 2, 4);
    await delay(Math.round(rand(100, 200)));

    // 새 노드 확인
    pos = await moveTo(emitter, agentId, pos, { x: nodeB.x + 60, y: nodeB.y + 25 }, 280);
    pos = await fidget(emitter, agentId, pos, 2, 4);

    return pos;
}

/**
 * grabFromToolbox — 도구상자에서 노드를 가져오는 전체 시퀀스
 */
const TOOLBOX_X = 45;
const TOOLBOX_SLOT_Y: Record<string, number> = {
    intentAnalysis: 62,
    decodingHypothesis: 86,
    gapAnalysis: 110,
    revisionProposal: 134,
    execution: 158,
    evaluation: 182,
};

export async function grabFromToolbox(
    emitter: SSEEmitter,
    agentId: AgentId,
    nodeType: string,
    currentPos: { x: number; y: number },
    dropTarget: { x: number; y: number },
): Promise<{ x: number; y: number }> {
    const slotY = TOOLBOX_SLOT_Y[nodeType] || 100;
    const toolboxTarget = { x: TOOLBOX_X, y: slotY };

    // 1. 도구상자까지 이동 (약간 멈칫하며)
    let pos = await moveTo(emitter, agentId, currentPos, toolboxTarget, 350);
    await delay(Math.round(rand(120, 220)));

    // 2. Grab
    emitter.emit({ type: 'cursor:grab', agentId, nodeType: nodeType as any });
    await delay(Math.round(rand(180, 280)));

    // 3. carry + 이동
    emitter.emit({ type: 'agent:status', agentId, status: 'carrying', message: '노드를 배치합니다' });
    pos = await moveTo(emitter, agentId, pos, dropTarget, 500);

    // 4. drop 전 미세 조정 — 사람처럼 정확한 위치 찾기
    pos = await fidget(emitter, agentId, pos, 2, 6);
    await delay(Math.round(rand(80, 160)));

    // 5. Drop
    emitter.emit({ type: 'cursor:drop', agentId });
    await delay(100);

    return pos;
}

/**
 * connectWithCursor — 두 노드를 연결할 때 커서가 source→target 이동
 */
export async function connectWithCursor(
    emitter: SSEEmitter,
    agentId: AgentId,
    currentPos: { x: number; y: number },
    sourcePos: { x: number; y: number },
    targetPos: { x: number; y: number },
    edge: { id: string; source: string; target: string; animated: boolean },
): Promise<{ x: number; y: number }> {
    const from = { x: sourcePos.x + 150, y: sourcePos.y + 40 };
    const to = { x: targetPos.x + 10, y: targetPos.y + 40 };

    // source 쪽으로 이동
    let pos = await moveTo(emitter, agentId, currentPos, from, 250);
    emitter.emit({ type: 'cursor:connect', agentId, fromX: from.x, fromY: from.y, toX: to.x, toY: to.y });
    await delay(80);

    // target 쪽으로 이동 (선 긋기)
    pos = await moveTo(emitter, agentId, pos, to, 300);
    await delay(60);
    emitter.emit({ type: 'edge:create', edge });
    await delay(80);

    return pos;
}
