'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';
import { InsightData } from '@/types';

interface Props {
    data: { agentId: string; title: string; content: InsightData; status: string };
    selected?: boolean;
}

const CATEGORY_STYLES: Record<string, { color: string; bg: string; icon: string; label: string }> = {
    discovery: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', icon: '🔍', label: '발견' },
    warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: '⚠️', label: '주의' },
    opportunity: { color: '#4ade80', bg: 'rgba(74,222,128,0.12)', icon: '💡', label: '기회' },
    pattern: { color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', icon: '🔗', label: '패턴' },
};

export default function InsightNode({ data, selected }: Props) {
    const c = data.content;
    const cat = CATEGORY_STYLES[c.category] || CATEGORY_STYLES.discovery;

    return (
        <div className={`agent-node agent-node-enter bg-[#141414] rounded-lg border min-w-[240px] max-w-[280px] ${selected ? 'border-purple-500/50' : 'border-[#2a2a2a]'
            }`} data-agent="orchestrator">
            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-purple-400 !border-purple-600" />

            {/* Header */}
            <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center gap-2">
                <span className="text-xs">{cat.icon}</span>
                <span className="text-xs font-medium text-[#e5e5e5] flex-1">{data.title}</span>
                <span
                    className="text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                    style={{ color: cat.color, backgroundColor: cat.bg }}
                >
                    {cat.label}
                </span>
            </div>

            <div className="p-3 space-y-2">
                <p className="text-[11px] text-[#ddd] leading-relaxed">{c.message}</p>

                {/* 신뢰도 바 */}
                <div>
                    <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[8px] text-[#555] uppercase tracking-wider">신뢰도</span>
                        <span className="text-[10px] font-mono" style={{ color: cat.color }}>{c.confidence}%</span>
                    </div>
                    <div className="h-1.5 bg-[#0a0a0a] rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full viz-bar-fill"
                            style={{
                                width: `${c.confidence}%`,
                                background: `linear-gradient(90deg, ${cat.color}80, ${cat.color})`,
                            }}
                        />
                    </div>
                </div>
            </div>

            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-purple-400 !border-purple-600" />
        </div>
    );
}
