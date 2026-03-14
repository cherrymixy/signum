'use client';

import React from 'react';
import { useStore } from 'reactflow';
import { useAgentCanvasStore } from '@/stores/agentCanvasStore';
import { AGENT_DEFINITIONS } from '@/agents/agentDefinitions';
import { AgentStatus } from '@/types';

const STATUS_LABELS: Record<AgentStatus, string> = {
    idle: '',
    thinking: 'Thinking',
    grabbing: 'Grabbing',
    carrying: 'Placing',
    creating: 'Creating',
    connecting: 'Connecting',
    waitingApproval: 'Waiting',
    executing: 'Executing',
    error: 'Error',
};

export default function AgentCursorLayer() {
    const agents = useAgentCanvasStore((s) => s.agents);
    const transform = useStore((s) => s.transform);

    const toScreen = (flowX: number, flowY: number) => ({
        x: flowX * transform[2] + transform[0],
        y: flowY * transform[2] + transform[1],
    });

    return (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
            {AGENT_DEFINITIONS.map((def) => {
                const agent = agents[def.id];
                if (!agent || agent.status === 'idle') return null;

                const isCarrying = agent.carrying && (agent.status === 'grabbing' || agent.status === 'carrying');
                const screenPos = toScreen(agent.cursor.x, agent.cursor.y);

                return (
                    <div
                        key={def.id}
                        className="absolute"
                        style={{
                            transform: `translate(${screenPos.x}px, ${screenPos.y}px)`,
                            transition: 'transform 0.15s ease-out',
                        }}
                    >
                        {/* 커서 SVG */}
                        <svg
                            width="20"
                            height="24"
                            viewBox="0 0 24 28"
                            fill="none"
                            style={{ filter: `drop-shadow(0 0 4px ${def.color}50)` }}
                        >
                            <path
                                d="M2 2L2 22L7.5 16.5L12 26L16 24L11.5 14L19 14L2 2Z"
                                fill={def.color}
                                fillOpacity={0.85}
                                stroke="#000"
                                strokeWidth={1.5}
                                strokeLinejoin="round"
                            />
                        </svg>

                        {/* 에이전트 이름 + 상태 레이블 */}
                        <div
                            className="absolute top-6 left-4 whitespace-nowrap px-1.5 py-0.5 rounded text-[9px] font-medium"
                            style={{
                                backgroundColor: `${def.color}20`,
                                color: def.color,
                                border: `1px solid ${def.color}28`,
                            }}
                        >
                            {def.name}
                            {STATUS_LABELS[agent.status] && (
                                <span className="ml-1 opacity-60">· {STATUS_LABELS[agent.status]}</span>
                            )}
                        </div>

                        {/* 노드를 들고 있을 때 작은 뱃지 */}
                        {isCarrying && agent.carrying && (
                            <div
                                className="absolute top-0 left-5 px-1.5 py-0.5 rounded text-[8px] border"
                                style={{
                                    backgroundColor: `${def.color}15`,
                                    borderColor: `${def.color}35`,
                                    color: def.color,
                                }}
                            >
                                {agent.carrying.replace(/([A-Z])/g, ' $1').trim()}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
