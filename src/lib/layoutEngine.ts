/**
 * 동적 노드 배치 엔진
 * 오케스트레이터가 자율적으로 노드를 생성할 때 이전 노드 위치를 기반으로
 * 적절한 위치를 계산합니다.
 */

import { CanvasNodeType, CanvasNode } from '@/types';

const COLUMN_WIDTH = 340;
const ROW_HEIGHT = 180;
const BASE_X = 100;
const BASE_Y = 100;

// 노드 타입별 선호 열 (기본 에이전트 노드)
const PREFERRED_COLUMN: Partial<Record<CanvasNodeType, number>> = {
    imageInput: 0,
    intentAnalysis: 1,
    decodingHypothesis: 2,
    gapAnalysis: 3,
    revisionProposal: 4,
    execution: 5,
    evaluation: 5,
};

// 자율 노드는 관련 노드 근처에 배치
const AUTONOMOUS_OFFSET = {
    insight: { dx: 0, dy: 160 },
    question: { dx: 0, dy: -140 },
    comparison: { dx: 170, dy: 0 },
    annotation: { dx: -30, dy: 130 },
    summary: { dx: 170, dy: 80 },
};

/**
 * 기존 고정 배치 방식 (기본 에이전트 노드용)
 */
export function getNodePosition(
    nodeType: CanvasNodeType,
    existingNodesOfSameType: number = 0
): { x: number; y: number } {
    const col = PREFERRED_COLUMN[nodeType] ?? 3;
    const row = existingNodesOfSameType;

    return {
        x: BASE_X + col * COLUMN_WIDTH,
        y: BASE_Y + row * ROW_HEIGHT,
    };
}

/**
 * 동적 배치: 기존 노드들의 위치를 고려하여 겹치지 않는 위치 계산
 */
export function getNextPosition(
    existingNodes: CanvasNode[],
    newNodeType: CanvasNodeType,
    nearNodeId?: string,
): { x: number; y: number } {
    // 기본 에이전트 노드는 기존 방식 사용
    if (PREFERRED_COLUMN[newNodeType] !== undefined) {
        const sameTypeCount = existingNodes.filter(n => n.type === newNodeType).length;
        return getNodePosition(newNodeType, sameTypeCount);
    }

    // 자율 노드: 관련 노드 근처에 배치
    const offset = AUTONOMOUS_OFFSET[newNodeType as keyof typeof AUTONOMOUS_OFFSET]
        || { dx: 170, dy: 80 };

    // 관련 노드가 지정된 경우 그 근처에
    if (nearNodeId) {
        const nearNode = existingNodes.find(n => n.id === nearNodeId);
        if (nearNode) {
            const candidate = {
                x: nearNode.position.x + offset.dx,
                y: nearNode.position.y + offset.dy,
            };
            return resolveCollision(existingNodes, candidate);
        }
    }

    // 마지막 노드 기준으로 배치
    if (existingNodes.length > 0) {
        const lastNode = existingNodes[existingNodes.length - 1];
        const candidate = {
            x: lastNode.position.x + offset.dx,
            y: lastNode.position.y + offset.dy,
        };
        return resolveCollision(existingNodes, candidate);
    }

    return { x: BASE_X + 3 * COLUMN_WIDTH, y: BASE_Y };
}

/**
 * 충돌 회피: 기존 노드와 겹치면 아래로 밀어냄
 */
function resolveCollision(
    existingNodes: CanvasNode[],
    candidate: { x: number; y: number },
    minDist: number = 120
): { x: number; y: number } {
    let pos = { ...candidate };
    let maxAttempts = 10;

    while (maxAttempts-- > 0) {
        const collision = existingNodes.some(n =>
            Math.abs(n.position.x - pos.x) < 280 &&
            Math.abs(n.position.y - pos.y) < minDist
        );
        if (!collision) break;
        pos.y += minDist;
    }

    return pos;
}

/**
 * 에이전트 커서의 목표 위치 계산
 */
export function getCursorTargetPosition(
    nodeType: CanvasNodeType,
    existingNodesOfSameType: number = 0
): { x: number; y: number } {
    const pos = getNodePosition(nodeType, existingNodesOfSameType);
    return {
        x: pos.x + 20,
        y: pos.y - 40,
    };
}

export function resetLayout() {
    // No-op — 이전 호환용
}
