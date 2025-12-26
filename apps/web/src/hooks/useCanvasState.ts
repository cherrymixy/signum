import { useState, useCallback, useEffect } from 'react';
import { Node, Edge } from '@signum/shared';
import { saveCanvasState, loadCanvasState, CanvasState } from '@/lib/storage';

export function useCanvasState() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  // 초기 로드
  useEffect(() => {
    const saved = loadCanvasState();
    if (saved) {
      setNodes(saved.nodes);
      setEdges(saved.edges);
    }
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

  return {
    nodes,
    edges,
    addNode,
    updateNode,
    addEdge,
    setNodes: setNodesState,
    setEdges: setEdgesState,
    saveState,
  };
}



