/**
 * 노드 자동 배치 엔진
 * 에이전트가 노드를 생성할 때 캔버스 위 위치를 계산합니다.
 */

import { CanvasNodeType } from '@/types';

const COLUMN_WIDTH = 350;
const ROW_HEIGHT = 200;
const BASE_X = 100;
const BASE_Y = 100;

// 각 노드 타입의 열 위치
const COLUMN_MAP: Record<CanvasNodeType, number> = {
    imageInput: 0,
    intentAnalysis: 1,
    decodingHypothesis: 2,
    gapAnalysis: 3,
    revisionProposal: 4,
    execution: 5,
    evaluation: 5,
};

// 같은 열에 여러 노드가 있을 때의 행 오프셋 추적
const rowCounters: Record<number, number> = {};

export function resetLayout() {
    Object.keys(rowCounters).forEach((k) => delete rowCounters[Number(k)]);
}

export function getNodePosition(
    nodeType: CanvasNodeType,
    existingNodesOfSameType: number = 0
): { x: number; y: number } {
    const col = COLUMN_MAP[nodeType];
    const row = existingNodesOfSameType;

    return {
        x: BASE_X + col * COLUMN_WIDTH,
        y: BASE_Y + row * ROW_HEIGHT,
    };
}

/**
 * 에이전트 커서의 목표 위치 계산
 * 에이전트가 작업할 영역의 약간 위쪽 위치를 반환
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
