'use client';

import React, { useMemo } from 'react';
import ReactFlow, {
    Background,
    BackgroundVariant,
    MiniMap,
    Controls,
    ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useAgentCanvasStore } from '@/stores/agentCanvasStore';
import AgentCursorLayer from './AgentCursorLayer';

import ImageInputNode from '../Nodes/ImageInputNode';
import IntentAnalysisNode from '../Nodes/IntentAnalysisNode';
import DecodingHypothesisNode from '../Nodes/DecodingHypothesisNode';
import GapAnalysisNode from '../Nodes/GapAnalysisNode';
import RevisionProposalNode from '../Nodes/RevisionProposalNode';
import ExecutionNode from '../Nodes/ExecutionNode';
import EvaluationNode from '../Nodes/EvaluationNode';

const nodeTypes = {
    imageInput: ImageInputNode,
    intentAnalysis: IntentAnalysisNode,
    decodingHypothesis: DecodingHypothesisNode,
    gapAnalysis: GapAnalysisNode,
    revisionProposal: RevisionProposalNode,
    execution: ExecutionNode,
    evaluation: EvaluationNode,
};

function AgentCanvasInner() {
    const nodes = useAgentCanvasStore((s) => s.nodes);
    const edges = useAgentCanvasStore((s) => s.edges);

    // CanvasNode → React Flow Node 변환
    const rfNodes = useMemo(
        () => nodes.map((n) => ({
            id: n.id,
            type: n.type,
            position: n.position,
            data: n.data,
        })),
        [nodes]
    );

    const rfEdges = useMemo(
        () => edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            animated: e.animated ?? true,
            style: { stroke: '#4a4a4a', strokeWidth: 1.5 },
        })),
        [edges]
    );

    return (
        <div className="relative w-full h-full">
            <ReactFlow
                nodes={rfNodes}
                edges={rfEdges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.3 }}
                minZoom={0.3}
                maxZoom={1.5}
                proOptions={{ hideAttribution: true }}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={true}
            >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1a1a1a" />
                <MiniMap
                    nodeColor="#2a2a2a"
                    maskColor="rgba(0,0,0,0.8)"
                    style={{ background: '#0f0f0f', border: '1px solid #2a2a2a' }}
                />
                <Controls
                    showInteractive={false}
                    style={{ background: '#141414', border: '1px solid #2a2a2a' }}
                />
            </ReactFlow>
            <AgentCursorLayer />
        </div>
    );
}

export default function AgentCanvas() {
    return (
        <ReactFlowProvider>
            <AgentCanvasInner />
        </ReactFlowProvider>
    );
}
