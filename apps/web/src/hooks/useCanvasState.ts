import { useState, useCallback, useEffect, useMemo } from 'react';
import { Node, Edge } from '@signum/shared';
import { saveCanvasState, loadCanvasState, CanvasState, isDevelopmentMode } from '@/lib/storage';

export type CanvasMode = 'edit' | 'view';

/**
 * Canvas 모드 감지
 * URL 파라미터 ?edit=true가 있으면 edit 모드, 없으면 view 모드 (기본값)
 */
function getCanvasMode(): CanvasMode {
  if (typeof window === 'undefined') return 'view';
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('edit') === 'true' ? 'edit' : 'view';
}

export function useCanvasState() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [mode, setMode] = useState<CanvasMode>(() => getCanvasMode());

  // 초기 로드 (persistence가 활성화된 경우에만)
  useEffect(() => {
    const saved = loadCanvasState();
    if (saved) {
      setNodes(saved.nodes);
      setEdges(saved.edges);
    }
  }, []);

  // 모드 변경 감지 (URL 파라미터 변경 시)
  useEffect(() => {
    const handleLocationChange = () => {
      setMode(getCanvasMode());
    };
    
    // 초기 모드 설정
    handleLocationChange();
    
    // popstate 이벤트 리스너 (뒤로가기/앞으로가기)
    window.addEventListener('popstate', handleLocationChange);
    
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  // 상태 저장
  const saveState = useCallback(() => {
    saveCanvasState({ nodes, edges });
  }, [nodes, edges]);

  // 노드 추가
  const addNode = useCallback((node: Node) => {
    setNodes((prev) => {
      const updated = [...prev, node];
      saveCanvasState({ nodes: updated, edges });
      return updated;
    });
  }, [edges]);

  // 노드 업데이트
  const updateNode = useCallback((nodeId: string, data: Partial<Node['data']>) => {
    setNodes((prev) => {
      const updated = prev.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node
      );
      saveCanvasState({ nodes: updated, edges });
      return updated;
    });
  }, [edges]);

  // 엣지 추가
  const addEdge = useCallback((edge: Edge) => {
    setEdges((prev) => {
      // 중복 체크
      const exists = prev.some(
        (e) => e.source === edge.source && e.target === edge.target
      );
      if (exists) return prev;

      const updated = [...prev, edge];
      saveCanvasState({ nodes, edges: updated });
      return updated;
    });
  }, [nodes]);

  // 엣지 업데이트
  const setEdgesState = useCallback((newEdges: Edge[]) => {
    setEdges(newEdges);
    saveCanvasState({ nodes, edges: newEdges });
  }, [nodes]);

  // 노드 업데이트 (React Flow용)
  const setNodesState = useCallback((newNodes: Node[]) => {
    setNodes(newNodes);
    saveCanvasState({ nodes: newNodes, edges });
  }, [edges]);

  // edit 모드 여부
  const isEditMode = useMemo(() => mode === 'edit', [mode]);
  const isViewMode = useMemo(() => mode === 'view', [mode]);

  return {
    nodes,
    edges,
    mode,
    isEditMode,
    isViewMode,
    setMode,
    addNode,
    updateNode,
    addEdge,
    setNodes: setNodesState,
    setEdges: setEdgesState,
    saveState,
  };
}



