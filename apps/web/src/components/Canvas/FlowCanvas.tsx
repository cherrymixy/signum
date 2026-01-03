'use client';

import React, { useCallback, useRef, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Connection,
  Background,
  MiniMap,
  ReactFlowProvider,
  OnNodesChange,
  OnEdgesChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import ImageUploadNode from '../NodeComponents/ImageUploadNode';
import DecodingAnalysisNode from '../NodeComponents/DecodingAnalysisNode';
import CustomEdge from './CustomEdge';
import CustomControls from './CustomControls';
import { getEdgeLabel, getEdgeColor } from '@/lib/nodeStyles';

const nodeTypes = {
  imageUpload: ImageUploadNode,
  decodingAnalysis: DecodingAnalysisNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

interface FlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  onNodeUpdate: (nodeId: string, data: Partial<any>) => void;
  onDrop: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  isEditMode?: boolean;
  isDarkMode?: boolean;
}

function FlowCanvasInner({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeUpdate,
  onDrop,
  onDragOver,
  isEditMode = false,
  isDarkMode = true,
}: FlowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const handleConnect = useCallback(
    (params: Connection) => {
      onConnect(params);
    },
    [onConnect]
  );

  // 기존 엣지들도 커스텀 타입 사용하도록 변환 및 라벨/컬러 추가
  const edgesWithCustomType = useMemo(() => {
    return edges.map((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);
      
      // 라벨이 없으면 노드 타입 기반으로 추론
      let label = edge.data?.label;
      let color = edge.data?.color;
      
      if (sourceNode && targetNode) {
        if (!label) {
          label = getEdgeLabel(
            sourceNode.type,
            targetNode.type,
            (sourceNode.data as any)?.type,
            (targetNode.data as any)?.type
          );
        }
        if (!color) {
          color = getEdgeColor(
            sourceNode.type,
            targetNode.type,
            (sourceNode.data as any)?.type,
            (targetNode.data as any)?.type
          );
        }
      }
      
      return {
        ...edge,
        type: edge.type || 'custom',
        data: {
          ...edge.data,
          label: label || edge.data?.label,
          color: color || edge.data?.color || '#4a90e2',
        },
      };
    });
  }, [edges, nodes]);

  return (
    <div
      ref={reactFlowWrapper}
      className="w-full h-full"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <ReactFlow
        nodes={nodes}
        edges={edgesWithCustomType}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
        defaultEdgeOptions={{
          type: 'custom',
        }}
      >
        <Background 
          color={isDarkMode ? '#2a2a2a' : '#e5e5e5'} 
          gap={20} 
          size={1}
          variant="dots"
        />
        <CustomControls isDarkMode={isDarkMode} />
        <MiniMap 
          style={{ 
            backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
            border: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e5e5e5'
          }}
          nodeColor={isDarkMode ? '#2a2a2a' : '#e5e5e5'}
          maskColor={isDarkMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.1)'}
          className={isDarkMode ? 'dark-minimap' : 'light-minimap'}
        />
      </ReactFlow>
    </div>
  );
}

export default function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

