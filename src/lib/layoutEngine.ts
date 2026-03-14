/**
 * 순차적 노드 배치 엔진
 * 
 * 핵심 에이전트는 좌→우 열 배치, 자율 노드는 마지막 노드 아래에 순차 배치.
 * 모든 노드가 겹치지 않도록 충돌 검사 수행.
 */

import { CanvasNodeType, CanvasNode } from '@/types';

// 기본 배치 상수
const COL_WIDTH = 420;
const BASE_X = 80;
const BASE_Y = 80;
const NODE_W = 360;          // 노드 예상 너비 (max-w-[360px] 기준)

// 노드 타입별 예상 높이 (실제 컴포넌트 기준)
const NODE_HEIGHT: Partial<Record<CanvasNodeType, number>> = {
    imageInput: 220,
    intentAnalysis: 340,
    visualScan: 340,
    decodingHypothesis: 290,
    gapAnalysis: 420,
    revisionProposal: 360,
    execution: 420,
    evaluation: 220,
    insight: 170,
    question: 150,
    comparison: 260,
    annotation: 170,
    summary: 300,
};
const DEFAULT_NODE_H = 280;
const ROW_GAP = 60;          // 노드 간 세로 여백 (높이와 별도)

// 핵심 에이전트 노드의 고정 열 번호
const AGENT_COLUMN: Partial<Record<CanvasNodeType, number>> = {
    imageInput: 0,
    intentAnalysis: 1,
    visualScan: 1,
    decodingHypothesis: 2,
    gapAnalysis: 3,
    revisionProposal: 4,
    execution: 5,
    evaluation: 5,
};

// 자율 노드의 고정 열 — 핵심 에이전트 열 오른쪽 끝 다음
const AUTONOMOUS_COLUMN = 6;

function getNodeHeight(nodeType: CanvasNodeType): number {
    return NODE_HEIGHT[nodeType] ?? DEFAULT_NODE_H;
}

/**
 * 핵심 에이전트 노드 위치 계산
 * 같은 타입의 기존 노드 수에 따라 아래로 배치
 */
export function getNodePosition(
    nodeType: CanvasNodeType,
    existingNodesOfSameType: number = 0
): { x: number; y: number } {
    const col = AGENT_COLUMN[nodeType] ?? 3;
    const h = getNodeHeight(nodeType);
    return {
        x: BASE_X + col * COL_WIDTH,
        y: BASE_Y + existingNodesOfSameType * (h + ROW_GAP),
    };
}

/**
 * 동적 배치: 기존 노드 기반으로 겹치지 않는 위치 계산
 */
export function getNextPosition(
    existingNodes: CanvasNode[],
    newNodeType: CanvasNodeType,
    _nearNodeId?: string,
): { x: number; y: number } {
    // 핵심 에이전트 노드 → 고정 열 배치 (같은 열에 있는 노드 수 기준으로 행 결정)
    if (AGENT_COLUMN[newNodeType] !== undefined) {
        const col = AGENT_COLUMN[newNodeType]!;
        const sameColCount = existingNodes.filter(n => AGENT_COLUMN[n.type] === col).length;
        return getNodePosition(newNodeType, sameColCount);
    }

    // 자율 노드 → 마지막 핵심 노드의 열에서 아래에 순차 배치
    // 자율 노드끼리는 마지막 노드 아래로 쌓임
    const autonomousTypes: CanvasNodeType[] = ['insight', 'question', 'comparison', 'annotation', 'summary'];
    const existingAutonomous = existingNodes.filter(n => autonomousTypes.includes(n.type));

    // 마지막 핵심 노드 (가장 오른쪽에 있는 것) 찾기
    const coreNodes = existingNodes.filter(n => AGENT_COLUMN[n.type] !== undefined);
    const lastCoreNode = coreNodes[coreNodes.length - 1];

    let baseX: number;
    let baseY: number;

    if (lastCoreNode) {
        // 마지막 핵심 노드의 오른쪽 열에 배치
        const lastCol = AGENT_COLUMN[lastCoreNode.type] ?? 3;
        baseX = BASE_X + (lastCol + 1) * COL_WIDTH;
        baseY = BASE_Y;
    } else {
        baseX = BASE_X + AUTONOMOUS_COLUMN * COL_WIDTH;
        baseY = BASE_Y;
    }

    // 같은 열에 이미 자율 노드가 있으면 아래로 쌓기
    const autonomousH = getNodeHeight(newNodeType);
    const candidate = {
        x: baseX,
        y: baseY + existingAutonomous.length * (autonomousH + ROW_GAP),
    };

    return resolveCollision(existingNodes, candidate, newNodeType);
}

/**
 * 충돌 회피: 기존 노드와 겹치면 아래로 밀어냄
 */
function resolveCollision(
    existingNodes: CanvasNode[],
    candidate: { x: number; y: number },
    nodeType?: CanvasNodeType,
): { x: number; y: number } {
    let pos = { ...candidate };
    const h = nodeType ? getNodeHeight(nodeType) : DEFAULT_NODE_H;
    let maxAttempts = 20;

    while (maxAttempts-- > 0) {
        const collision = existingNodes.some(n => {
            const nh = getNodeHeight(n.type);
            return (
                Math.abs(n.position.x - pos.x) < NODE_W &&
                pos.y < n.position.y + nh + ROW_GAP &&
                pos.y + h > n.position.y - ROW_GAP
            );
        });
        if (!collision) break;
        pos.y += h + ROW_GAP;
    }

    return pos;
}

/**
 * 에이전트 커서의 목표 위치 (노드 위치 기준)
 */
export function getCursorTargetPosition(
    nodeType: CanvasNodeType,
    existingNodesOfSameType: number = 0
): { x: number; y: number } {
    const pos = getNodePosition(nodeType, existingNodesOfSameType);
    return { x: pos.x + 20, y: pos.y - 40 };
}

export function resetLayout() {
    // No-op — 이전 호환용
}
