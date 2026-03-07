'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';
import { DecodingHypothesisItem } from '@/types';

interface Props {
    data: { agentId: string; title: string; content: DecodingHypothesisItem; status: string };
    selected?: boolean;
}

export default function DecodingHypothesisNode({ data, selected }: Props) {
    const h = data.content;
    const pct = (h.probability * 100).toFixed(0);
    return (
        <div className={`agent-node agent-node-enter bg-[#141414] rounded-lg border min-w-[240px] max-w-[280px] ${selected ? 'border-sky-500/50' : 'border-[#2a2a2a]'
            }`} data-agent="decoder">
            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-sky-400 !border-sky-600" />
            <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center gap-2">
                <span className="text-xs">👁️</span>
                <span className="text-xs font-medium text-[#e5e5e5] flex-1">{data.title}</span>
                <span className="text-[10px] font-mono text-sky-400 bg-sky-500/10 px-1.5 rounded">{pct}%</span>
            </div>
            <div className="p-3 space-y-2">
                <p className="text-[11px] text-[#ccc] leading-relaxed">{h.interpretation}</p>
                <div>
                    <p className="text-[10px] text-sky-400/80 uppercase tracking-wide mb-0.5">근거</p>
                    <p className="text-[10px] text-[#888] leading-relaxed">{h.reasoning}</p>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[#666]">감정 반응:</span>
                    <span className="text-[10px] text-sky-300">{h.emotionalResponse}</span>
                </div>
            </div>
            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-sky-400 !border-sky-600" />
        </div>
    );
}
