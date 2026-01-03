'use client';

import React from 'react';
import { BaseEdge, EdgeProps, getBezierPath, EdgeLabelRenderer } from 'reactflow';

interface CustomEdgeData {
  label?: string;
  color?: string;
}

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps<CustomEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: data?.color || '#4a90e2',
          strokeWidth: 1.5,
          strokeOpacity: 0.6,
        }}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div className="px-1.5 py-0.5 bg-[#0a0a0a]/80 border border-[#2a2a2a]/50 rounded text-[9px] text-[#555555] font-mono tracking-tight">
              {data.label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

