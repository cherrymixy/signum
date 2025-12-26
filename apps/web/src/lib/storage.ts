import { Node, Edge } from '@signum/shared';

const STORAGE_KEY = 'signum_canvas_state';

export interface CanvasState {
  nodes: Node[];
  edges: Edge[];
}

export function saveCanvasState(state: CanvasState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save canvas state:', error);
  }
}

export function loadCanvasState(): CanvasState | null {
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



