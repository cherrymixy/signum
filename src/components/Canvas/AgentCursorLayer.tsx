'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useStore } from 'reactflow';
import { useAgentCanvasStore } from '@/stores/agentCanvasStore';
import { AGENT_DEFINITIONS } from '@/agents/agentDefinitions';
import { AgentStatus, CanvasNodeType } from '@/types';

const NODE_ICONS: Record<string, string> = {
    intentAnalysis: '💡',
    decodingHypothesis: '👁️',
    gapAnalysis: '⚡',
    revisionProposal: '🔧',
    execution: '🚀',
    evaluation: '📊',
    imageInput: '📷',
};

const STATUS_LABELS: Record<AgentStatus, string> = {
    idle: '',
    thinking: 'Thinking...',
    grabbing: 'Grabbing node',
    carrying: 'Placing...',
    creating: 'Creating',
    connecting: 'Connecting',
    waitingApproval: 'Waiting',
    executing: 'Executing',
    error: 'Error',
};

interface CursorTrail {
    x: number;
    y: number;
    id: number;
}

export default function AgentCursorLayer() {
    const agents = useAgentCanvasStore((s) => s.agents);
    // ReactFlow viewport transform: [translateX, translateY, zoom]
    // 서버에서 오는 커서 좌표는 flow 좌표계 → screen 좌표로 변환 필요
    const transform = useStore((s) => s.transform);
    const [trails, setTrails] = useState<Record<string, CursorTrail[]>>({});
    const trailCounter = useRef(0);
    const prevPositions = useRef<Record<string, { x: number; y: number }>>({});

    // flow 좌표 → screen 픽셀 좌표 변환
    const toScreen = (flowX: number, flowY: number) => ({
        x: flowX * transform[2] + transform[0],
        y: flowY * transform[2] + transform[1],
    });

    // Trail 효과 — 커서 이동 시 잔상 생성
    useEffect(() => {
        AGENT_DEFINITIONS.forEach((def) => {
            const agent = agents[def.id];
            if (!agent || agent.status === 'idle') return;
            const prev = prevPositions.current[def.id];
            if (prev && (prev.x !== agent.cursor.x || prev.y !== agent.cursor.y)) {
                const id = trailCounter.current++;
                setTrails((t) => ({
                    ...t,
                    [def.id]: [
                        ...(t[def.id] || []).slice(-6),
                        { x: prev.x, y: prev.y, id },
                    ],
                }));
                // 잔상 자동 제거
                setTimeout(() => {
                    setTrails((t) => ({
                        ...t,
                        [def.id]: (t[def.id] || []).filter((tr) => tr.id !== id),
                    }));
                }, 600);
            }
            prevPositions.current[def.id] = { ...agent.cursor };
        });
    }, [agents]);

    return (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
            {AGENT_DEFINITIONS.map((def) => {
                const agent = agents[def.id];
                if (!agent || agent.status === 'idle') return null;

                const isCarrying = agent.carrying && (agent.status === 'grabbing' || agent.status === 'carrying');
                const isConnecting = agent.status === 'connecting';
                const isThinking = agent.status === 'thinking';
                const agentTrails = trails[def.id] || [];

                const screenPos = toScreen(agent.cursor.x, agent.cursor.y);

                return (
                    <React.Fragment key={def.id}>
                        {/* Trail 잔상 */}
                        {agentTrails.map((trail, idx) => {
                            const trailScreen = toScreen(trail.x, trail.y);
                            return (
                                <div
                                    key={trail.id}
                                    className="absolute transition-opacity duration-500"
                                    style={{
                                        transform: `translate(${trailScreen.x}px, ${trailScreen.y}px)`,
                                        opacity: 0.15 + idx * 0.05,
                                    }}
                                >
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: def.color }}
                                    />
                                </div>
                            );
                        })}

                        {/* 메인 커서 */}
                        <div
                            className="absolute"
                            style={{
                                transform: `translate(${screenPos.x}px, ${screenPos.y}px)`,
                                transition: 'transform 0.12s linear',
                            }}
                        >
                            <div className="relative">
                                {/* Thinking 상태 pulse */}
                                {isThinking && (
                                    <div
                                        className="absolute -inset-4 rounded-full animate-ping"
                                        style={{
                                            backgroundColor: def.color,
                                            opacity: 0.15,
                                        }}
                                    />
                                )}

                                {/* 마우스 커서 SVG */}
                                <svg
                                    width="24"
                                    height="28"
                                    viewBox="0 0 24 28"
                                    fill="none"
                                    className={`drop-shadow-lg ${isCarrying ? 'animate-bounce-subtle' : ''}`}
                                    style={{ filter: `drop-shadow(0 0 6px ${def.color}60)` }}
                                >
                                    <path
                                        d="M2 2L2 22L7.5 16.5L12 26L16 24L11.5 14L19 14L2 2Z"
                                        fill={def.color}
                                        fillOpacity={0.9}
                                        stroke="#000"
                                        strokeWidth={1.5}
                                        strokeLinejoin="round"
                                    />
                                </svg>

                                {/* 에이전트 이름 + 상태 */}
                                <div
                                    className="absolute top-7 left-5 whitespace-nowrap px-2 py-1 rounded-md text-[10px] font-medium backdrop-blur-sm"
                                    style={{
                                        backgroundColor: `${def.color}18`,
                                        color: def.color,
                                        border: `1px solid ${def.color}30`,
                                        boxShadow: `0 2px 8px ${def.color}15`,
                                    }}
                                >
                                    <span className="font-bold">{def.name}</span>
                                    {STATUS_LABELS[agent.status] && (
                                        <span className="ml-1 opacity-70 text-[9px]">
                                            · {STATUS_LABELS[agent.status]}
                                        </span>
                                    )}
                                    {agent.currentMessage && (
                                        <p className="text-[8px] opacity-60 mt-0.5 max-w-[200px] truncate">
                                            {agent.currentMessage}
                                        </p>
                                    )}
                                </div>

                                {/* 들고 있는 노드 미리보기 */}
                                {isCarrying && agent.carrying && (
                                    <div
                                        className="absolute top-1 left-6 animate-float"
                                        style={{
                                            transform: 'rotate(-5deg)',
                                        }}
                                    >
                                        <div
                                            className="flex items-center gap-1 px-2 py-1 rounded-md border text-[9px] backdrop-blur-sm"
                                            style={{
                                                backgroundColor: `${def.color}15`,
                                                borderColor: `${def.color}40`,
                                                color: def.color,
                                                boxShadow: `0 4px 16px ${def.color}25`,
                                            }}
                                        >
                                            <span>{NODE_ICONS[agent.carrying] || '📦'}</span>
                                            <span className="font-medium">
                                                {agent.carrying
                                                    .replace(/([A-Z])/g, ' $1')
                                                    .trim()}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* 연결 중 점선 */}
                                {isConnecting && (
                                    <div
                                        className="absolute -top-1 -left-1 w-3 h-3 rounded-full animate-pulse"
                                        style={{
                                            backgroundColor: def.color,
                                            boxShadow: `0 0 8px ${def.color}80`,
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    );
}
