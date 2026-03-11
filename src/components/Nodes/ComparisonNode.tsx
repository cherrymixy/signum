'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';
import { ComparisonData } from '@/types';

interface Props {
    data: { agentId: string; title: string; content: ComparisonData; status: string };
    selected?: boolean;
}

const WINNER_STYLES = {
    left: { leftBorder: '#4ade80', rightBorder: '#2a2a2a' },
    right: { leftBorder: '#2a2a2a', rightBorder: '#4ade80' },
    neutral: { leftBorder: '#38bdf8', rightBorder: '#38bdf8' },
};

export default function ComparisonNode({ data, selected }: Props) {
    const c = data.content;
    const w = WINNER_STYLES[c.winner || 'neutral'];

    return (
        <div className={`agent-node agent-node-enter bg-[#141414] rounded-lg border min-w-[300px] max-w-[360px] ${selected ? 'border-cyan-500/50' : 'border-[#2a2a2a]'
            }`} data-agent="orchestrator">
            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-cyan-400 !border-cyan-600" />

            {/* Header */}
            <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center gap-2">
                <span className="text-xs">⚖️</span>
                <span className="text-xs font-medium text-[#e5e5e5]">{data.title}</span>
            </div>

            <div className="p-3 space-y-2">
                {/* 좌우 비교 */}
                <div className="flex gap-2">
                    <div className="flex-1 rounded-md p-2" style={{ border: `1px solid ${w.leftBorder}30`, backgroundColor: `${w.leftBorder}08` }}>
                        <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: w.leftBorder }}>{c.leftLabel}</p>
                        <p className="text-[10px] text-[#ccc] leading-relaxed">{c.leftContent}</p>
                    </div>
                    <div className="flex items-center shrink-0">
                        <span className="text-[10px] text-[#444]">VS</span>
                    </div>
                    <div className="flex-1 rounded-md p-2" style={{ border: `1px solid ${w.rightBorder}30`, backgroundColor: `${w.rightBorder}08` }}>
                        <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: w.rightBorder }}>{c.rightLabel}</p>
                        <p className="text-[10px] text-[#ccc] leading-relaxed">{c.rightContent}</p>
                    </div>
                </div>

                {/* 판정 */}
                <div className="bg-[#0a0a0a] rounded-md px-2.5 py-1.5">
                    <p className="text-[9px] text-cyan-400/60 uppercase tracking-wider mb-0.5">판정</p>
                    <p className="text-[11px] text-[#ddd] leading-relaxed">{c.verdict}</p>
                </div>
            </div>

            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-cyan-400 !border-cyan-600" />
        </div>
    );
}
