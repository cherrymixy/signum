'use client';

import React from 'react';
import { useAgentCanvasStore } from '@/stores/agentCanvasStore';
import { AGENT_DEFINITIONS } from '@/agents/agentDefinitions';

/**
 * 에이전트 커서 오버레이
 * React Flow 위에 absolute positioned로 배치
 */
export default function AgentCursorLayer() {
    const agents = useAgentCanvasStore((s) => s.agents);

    return (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
            {AGENT_DEFINITIONS.map((def) => {
                const agent = agents[def.id];
                if (!agent || agent.status === 'idle') return null;

                return (
                    <div
                        key={def.id}
                        className="absolute transition-all duration-500 ease-out"
                        style={{
                            transform: `translate(${agent.cursor.x}px, ${agent.cursor.y}px)`,
                        }}
                    >
                        {/* 커서 아이콘 */}
                        <div className="relative">
                            {/* thinking 상태일 때 pulse */}
                            {agent.status === 'thinking' && (
                                <div
                                    className="absolute -inset-3 rounded-full animate-ping opacity-20"
                                    style={{ backgroundColor: def.color }}
                                />
                            )}
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-lg border-2"
                                style={{
                                    backgroundColor: `${def.color}20`,
                                    borderColor: def.color,
                                    boxShadow: `0 0 12px ${def.color}40`,
                                }}
                            >
                                {def.icon}
                            </div>
                            {/* 이름 + 상태 라벨 */}
                            <div
                                className="absolute top-9 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 rounded-md text-[10px] font-medium"
                                style={{
                                    backgroundColor: `${def.color}15`,
                                    color: def.color,
                                    border: `1px solid ${def.color}30`,
                                }}
                            >
                                <span className="font-semibold">{def.name}</span>
                                {agent.currentMessage && (
                                    <p className="text-[9px] opacity-70 mt-0.5 max-w-[180px] truncate">
                                        {agent.currentMessage}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
