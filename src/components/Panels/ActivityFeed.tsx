'use client';

import React from 'react';
import { useAgentCanvasStore } from '@/stores/agentCanvasStore';
import { getAgentDef } from '@/agents/agentDefinitions';
import { AGENT_DEFINITIONS } from '@/agents/agentDefinitions';
import { AgentStatus } from '@/types';

const STATUS_LABELS: Record<AgentStatus, string> = {
    idle: '대기',
    thinking: '분석 중',
    creating: '노드 생성',
    connecting: '연결 중',
    waitingApproval: '승인 대기',
    executing: '실행 중',
    error: '오류',
};

export default function ActivityFeed() {
    const agents = useAgentCanvasStore((s) => s.agents);
    const activityLog = useAgentCanvasStore((s) => s.activityLog);
    const pipelineStatus = useAgentCanvasStore((s) => s.pipelineStatus);
    const pipelineSummary = useAgentCanvasStore((s) => s.pipelineSummary);

    return (
        <div className="w-64 h-full bg-[#0f0f0f] border-l border-[#1a1a1a] flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1a1a1a]">
                <h2 className="text-xs font-semibold text-[#e5e5e5]">Agent Activity</h2>
            </div>

            {/* 에이전트 상태 */}
            <div className="px-3 py-2 border-b border-[#1a1a1a] space-y-1.5">
                {AGENT_DEFINITIONS.map((def) => {
                    const agent = agents[def.id];
                    const isActive = agent.status !== 'idle';
                    return (
                        <div key={def.id} className="flex items-center gap-2">
                            <span className="text-xs">{def.icon}</span>
                            <span className={`text-[11px] flex-1 ${isActive ? 'text-[#ccc]' : 'text-[#555]'}`}>
                                {def.name}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded ${agent.status === 'thinking' ? 'bg-amber-500/10 text-amber-400 animate-pulse' :
                                    agent.status === 'creating' || agent.status === 'connecting' ? `text-[${def.color}]` :
                                        agent.status === 'waitingApproval' ? 'bg-amber-500/10 text-amber-400' :
                                            agent.status === 'error' ? 'bg-red-500/10 text-red-400' :
                                                'text-[#444]'
                                }`} style={isActive && agent.status !== 'thinking' && agent.status !== 'waitingApproval' && agent.status !== 'error' ? { color: def.color, backgroundColor: `${def.color}15` } : {}}>
                                {STATUS_LABELS[agent.status]}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* 파이프라인 요약 */}
            {pipelineSummary && (
                <div className="px-3 py-2 border-b border-[#1a1a1a]">
                    <p className="text-[10px] text-emerald-400">{pipelineSummary}</p>
                </div>
            )}

            {/* 행동 로그 */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
                {activityLog.length === 0 ? (
                    <p className="text-[10px] text-[#444] text-center py-4">분석을 시작하면 에이전트 활동이 표시됩니다</p>
                ) : (
                    activityLog.map((entry) => {
                        const def = getAgentDef(entry.agentId);
                        const time = new Date(entry.timestamp);
                        const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}`;
                        return (
                            <div key={entry.id} className="flex items-start gap-1.5 py-0.5">
                                <span className="text-[9px] text-[#444] font-mono mt-0.5 shrink-0">{timeStr}</span>
                                <span className="text-[9px]">{def.icon}</span>
                                <div className="min-w-0">
                                    <span className="text-[10px] text-[#888]">
                                        {entry.action}
                                    </span>
                                    {entry.detail && (
                                        <p className="text-[9px] text-[#555] truncate">{entry.detail}</p>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
