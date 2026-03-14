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

/** 직선 이동 (중간 웨이포인트 1개) */
function bezierPath(
    from: { x: number; y: number },
    to: { x: number; y: number },
): { x: number; y: number }[] {
    const mid = {
        x: Math.round((from.x + to.x) / 2),
        y: Math.round((from.y + to.y) / 2),
    };
    return [mid, { x: to.x, y: to.y }];
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
    const segMs = Math.max(40, Math.round(durationMs / waypoints.length));
    for (const wp of waypoints) {
        emitter.emit({ type: 'cursor:move', agentId, x: wp.x, y: wp.y });
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
    // 진폭/횟수를 절반으로 제한해 과도한 떨림 방지
    const clampedCount = Math.min(count, 2);
    const clampedAmp = Math.min(amplitude, 4);
    for (let i = 0; i < clampedCount; i++) {
        const x = Math.round(center.x + rand(-clampedAmp, clampedAmp));
        const y = Math.round(center.y + rand(-clampedAmp, clampedAmp));
        emitter.emit({ type: 'cursor:move', agentId, x, y });
        await delay(120);
    }
    return center;
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
    if (interestPoints.length === 0) return currentPos;

    // 최대 1개 포인트만 방문
    const target = pick(interestPoints);
    const pos = await moveTo(emitter, agentId, currentPos, target, Math.min(durationMs, 400));
    await delay(100);
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
    // 마지막 노드 한 개만 빠르게 방문
    const last = nodePositions[nodePositions.length - 1];
    if (!last) return currentPos;
    return moveTo(emitter, agentId, currentPos, { x: last.x + 80, y: last.y + 20 }, 200);
}

/**
 * revisit — 작업 후 방금 만든 노드와 소스 노드를 왔다 갔다 확인
 */
export async function revisit(
    emitter: SSEEmitter,
    agentId: AgentId,
    currentPos: { x: number; y: number },
    _nodeA: { x: number; y: number },
    nodeB: { x: number; y: number },
): Promise<{ x: number; y: number }> {
    // 새 노드 위치만 한 번 방문
    return moveTo(emitter, agentId, currentPos, { x: nodeB.x + 60, y: nodeB.y + 25 }, 250);
}

/**
 * grabFromToolbox — 노드를 가져와 목표 위치에 배치하는 시퀀스
 *
 * 실제 toolbox DOM 좌표를 방문하는 대신, 현재 위치에서 잠깐 준비 동작 후
 * 목표 위치로 이동한다. (toolbox는 DOM 고정 위치라 flow 좌표계와 맞지 않음)
 */
export async function grabFromToolbox(
    emitter: SSEEmitter,
    agentId: AgentId,
    nodeType: string,
    currentPos: { x: number; y: number },
    dropTarget: { x: number; y: number },
): Promise<{ x: number; y: number }> {
    let pos = { ...currentPos };

    // 1. 잠깐 멈추며 준비
    pos = await fidget(emitter, agentId, pos, 2, 8);
    await delay(Math.round(rand(100, 180)));

    // 2. Grab
    emitter.emit({ type: 'cursor:grab', agentId, nodeType: nodeType as any });
    await delay(Math.round(rand(150, 250)));

    // 3. 목표 위치로 이동 (노드를 들고)
    emitter.emit({ type: 'agent:status', agentId, status: 'carrying', message: '노드를 배치합니다' });
    pos = await moveTo(emitter, agentId, pos, dropTarget, 500);

    // 4. drop 전 미세 조정 — 사람처럼 정확한 위치 찾기
    pos = await fidget(emitter, agentId, pos, 2, 4);
    await delay(Math.round(rand(60, 120)));

    // 5. Drop
    emitter.emit({ type: 'cursor:drop', agentId });
    await delay(80);

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
