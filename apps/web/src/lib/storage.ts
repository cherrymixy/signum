import { Node, Edge } from '@signum/shared';

const STORAGE_KEY = 'signum_canvas_state';

export interface CanvasState {
  nodes: Node[];
  edges: Edge[];
}

/**
 * 개발 모드 감지
 * - URL에 ?edit=true가 있으면 edit 모드
 * - 환경 변수 NEXT_PUBLIC_ENABLE_PERSISTENCE가 'true'일 때만 persistence 활성화
 */
export function isDevelopmentMode(): boolean {
  if (typeof window === 'undefined') return false;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('edit') !== 'true';
}

export function shouldEnablePersistence(): boolean {
  if (typeof window === 'undefined') return false;
  // 개발 중에는 persistence 비활성화 (기본값)
  // 프로덕션에서는 환경 변수로 제어 가능
  return process.env.NEXT_PUBLIC_ENABLE_PERSISTENCE === 'true';
}

/**
 * Canvas 상태를 localStorage에 저장
 * 개발 모드에서는 저장하지 않음
 */
export function saveCanvasState(state: CanvasState): void {
  if (!shouldEnablePersistence()) {
    return;
  }
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save canvas state:', error);
  }
}

/**
 * localStorage에서 Canvas 상태 로드
 * 개발 모드에서는 null 반환 (자동 복구 비활성화)
 */
export function loadCanvasState(): CanvasState | null {
  if (!shouldEnablePersistence()) {
    return null;
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as CanvasState;
  } catch (error) {
    console.error('Failed to load canvas state:', error);
    return null;
  }
}

export function clearCanvasState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear canvas state:', error);
  }
}



