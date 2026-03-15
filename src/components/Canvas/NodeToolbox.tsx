'use client';

import React from 'react';
import { useAgentCanvasStore } from '@/stores/agentCanvasStore';
import { AGENT_DEFINITIONS } from '@/agents/agentDefinitions';
import { CanvasNodeType } from '@/types';

const NODE_TOOLS: { type: CanvasNodeType; icon: string; label: string }[] = [
    { type: 'intentAnalysis', icon: '💡', label: 'Intent' },
    { type: 'visualScan', icon: '👁', label: 'Visual Scan' },
    { type: 'decodingHypothesis', icon: '👁️', label: 'Decode' },
    { type: 'gapAnalysis', icon: '⚡', label: 'Gap' },
    { type: 'revisionProposal', icon: '🔧', label: 'Revision' },
    { type: 'execution', icon: '🚀', label: 'Execute' },
    { type: 'evaluation', icon: '📊', label: 'Evaluate' },
];

const HUMAN_TOOLS: { type: CanvasNodeType; icon: string; label: string; tooltip: string }[] = [
    { type: 'annotation', icon: '📝', label: '메모', tooltip: '자유 메모 추가' },
    { type: 'question', icon: '❓', label: 'AI 질문', tooltip: 'AI에게 질문하기' },
];

export default function NodeToolbox() {
    const agents = useAgentCanvasStore((s) => s.agents);
    const pipelineStatus = useAgentCanvasStore((s) => s.pipelineStatus);
    const addHumanNode = useAgentCanvasStore((s) => s.addHumanNode);

    // 현재 grab 중인 노드 타입 확인
    const grabbingType = Object.values(agents).find(
        (a) => a.status === 'grabbing' || (a.carrying && a.status === 'carrying')
    )?.carrying;

    const grabbingAgent = Object.values(agents).find(
        (a) => a.status === 'grabbing'
    );
    const grabbingDef = grabbingAgent
        ? AGENT_DEFINITIONS.find((d) => d.id === grabbingAgent.agentId)
        : null;

    const canAddHumanNode = pipelineStatus === 'done' || pipelineStatus === 'error';

    return (
        <div className="absolute top-3 left-3 z-30 flex flex-col gap-1 bg-[#0f0f0f]/80 backdrop-blur-sm border border-[#2a2a2a] rounded-lg p-2">
            <div className="text-[8px] text-[#555] uppercase tracking-wider px-1 mb-0.5">
                Node Toolbox
            </div>
            {NODE_TOOLS.map((tool) => {
                const isGrabbing = grabbingType === tool.type;
                return (
                    <div
                        key={tool.type}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded transition-all duration-300 ${
                            isGrabbing ? 'scale-95 opacity-30' : 'opacity-70 hover:opacity-100'
                        }`}
                        style={
                            isGrabbing && grabbingDef
                                ? { boxShadow: `0 0 12px ${grabbingDef.color}40`, borderColor: grabbingDef.color }
                                : {}
                        }
                    >
                        <span className="text-sm">{tool.icon}</span>
                        <span className="text-[10px] text-[#888]">{tool.label}</span>
                        {isGrabbing && (
                            <span
                                className="ml-auto text-[8px] px-1 rounded animate-pulse"
                                style={{ color: grabbingDef?.color, backgroundColor: `${grabbingDef?.color}20` }}
                            >
                                grabbed
                            </span>
                        )}
                    </div>
                );
            })}

            {/* Human-addable nodes section */}
            <div className="mt-1.5 pt-1.5 border-t border-[#1e1e1e]">
                <div className="text-[8px] text-[#444] uppercase tracking-wider px-1 mb-1">
                    사용자 추가
                </div>
                {HUMAN_TOOLS.map((tool) => (
                    <button
                        key={tool.type}
                        onClick={() => canAddHumanNode && addHumanNode(tool.type)}
                        disabled={!canAddHumanNode}
                        title={canAddHumanNode ? tool.tooltip : '분석 완료 후 추가할 수 있습니다'}
                        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded transition-all text-left ${
                            canAddHumanNode
                                ? 'opacity-80 hover:opacity-100 hover:bg-[#1a1a1a] cursor-pointer'
                                : 'opacity-25 cursor-not-allowed'
                        }`}
                    >
                        <span className="text-sm">{tool.icon}</span>
                        <span className="text-[10px] text-[#94a3b8]">{tool.label}</span>
                        {canAddHumanNode && (
                            <span className="ml-auto text-[8px] text-[#444]">+ 추가</span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}
