'use client';

import { useCallback, useMemo } from 'react';
import {
  Node,
  Connection,
  OnNodesChange,
  OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from 'reactflow';
import { NodeType, ImageUploadNodeData, DecodingAnalysisNodeData } from '@signum/shared';
import { useCanvasState } from '@/hooks/useCanvasState';
import FlowCanvas from '@/components/Canvas/FlowCanvas';
import QuickAccessPanel from '@/components/QuickAccess/QuickAccessPanel';
import { v4 as uuidv4 } from 'uuid';

export default function Home() {
  const {
    nodes,
    edges,
    addNode,
    updateNode,
    addEdge,
    setNodes,
    setEdges,
  } = useCanvasState();

  // 노드 업데이트 핸들러
  const handleNodeUpdate = useCallback(
    (nodeId: string, data: Partial<ImageUploadNodeData | DecodingAnalysisNodeData>) => {
      updateNode(nodeId, data);
    },
    [updateNode]
  );

  // React Flow 노드 변경 핸들러
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes(applyNodeChanges(changes, nodes));
    },
    [nodes, setNodes]
  );

  // React Flow 엣지 변경 핸들러
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges(applyEdgeChanges(changes, edges));
    },
    [edges, setEdges]
  );

  // 엣지 연결 핸들러
  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        const newEdge = {
          id: uuidv4(),
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle,
        };
        addEdge(newEdge);
      }
    },
    [addEdge]
  );

  // 드래그 앤 드롭 핸들러
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const reactFlowData = event.dataTransfer.getData('application/reactflow');
      
      // drag data가 없으면 즉시 return
      if (!reactFlowData || reactFlowData.trim() === '') {
        console.warn('Drop ignored: missing reactflow payload');
        return;
      }

      let template;
      try {
        template = JSON.parse(reactFlowData);
      } catch (error) {
        // JSON 파싱 실패 시 무시하고 return
        console.warn('Drop ignored: invalid reactflow payload');
        return;
      }

      if (!template || !template.type) {
        return;
      }

      const reactFlowBounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const position = {
        x: event.clientX - reactFlowBounds.left - 100,
        y: event.clientY - reactFlowBounds.top - 50,
      };

      const newNode: Node = {
        id: uuidv4(),
        type: template.type as NodeType,
        position,
        data: getInitialNodeData(template.type),
      };

      addNode(newNode);
    },
    [addNode]
  );

  // 노드 데이터에 업데이트 핸들러와 연결 정보 추가
  const nodesWithHandlers = useMemo(() => {
    return nodes.map((node) => {
      const baseData = node.data;
      
      // 연결된 이미지 노드 찾기 (decodingAnalysis 노드의 경우)
      let connectedImageNodeId: string | undefined;
      let connectedImageNodeData: { imageId?: string } | undefined;

      if (node.type === 'decodingAnalysis') {
        const connectedEdge = edges.find((e) => e.target === node.id);
        if (connectedEdge) {
          connectedImageNodeId = connectedEdge.source;
          const sourceNode = nodes.find((n) => n.id === connectedEdge.source);
          if (sourceNode && sourceNode.type === 'imageUpload') {
            connectedImageNodeData = {
              imageId: (sourceNode.data as ImageUploadNodeData).imageId,
            };
          }
        }
      }

      return {
        ...node,
        data: {
          ...baseData,
          onUpdate: (data: Partial<any>) => handleNodeUpdate(node.id, data),
          ...(node.type === 'decodingAnalysis' && {
            connectedImageNodeId,
            connectedImageNodeData,
          }),
        },
      };
    });
  }, [nodes, edges, handleNodeUpdate]);

  return (
    <div className="w-screen h-screen flex">
      <div className="flex-1 relative">
        <FlowCanvas
          nodes={nodesWithHandlers}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeUpdate={handleNodeUpdate}
          onDrop={onDrop}
          onDragOver={onDragOver}
        />
      </div>
      <QuickAccessPanel onNodeCreate={addNode} />
    </div>
  );
}

function getInitialNodeData(type: NodeType): ImageUploadNodeData | DecodingAnalysisNodeData {
  if (type === 'imageUpload') {
    return {};
  } else {
    return {
      status: 'idle',
    };
  }
}

