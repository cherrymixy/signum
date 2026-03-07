'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';
import { GapAnalysis } from '@/types';

interface Props {
    data: { agentId: string; title: string; content: GapAnalysis; status: string };
    selected?: boolean;
}

export default function GapAnalysisNode({ data, selected }: Props) {
    const g = data.content;
    const score = g.overallAlignmentScore;
    const scoreColor = score >= 70 ? 'text-emerald-400 bg-emerald-500/10' : score >= 40 ? 'text-amber-400 bg-amber-500/10' : 'text-red-400 bg-red-500/10';

    return (
        <div className={`agent-node agent-node-enter bg-[#141414] rounded-lg border min-w-[280px] max-w-[320px] ${selected ? 'border-orange-500/50' : 'border-[#2a2a2a]'
            }`} data-agent="gap">
            <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-orange-400 !border-orange-600" />
            <div className="px-3 py-2 border-b border-[#2a2a2a] flex items-center gap-2">
                <span className="text-xs">⚡</span>
                <span className="text-xs font-medium text-[#e5e5e5] flex-1">{data.title}</span>
                <span className={`text-[10px] font-mono px-1.5 rounded ${scoreColor}`}>{score}%</span>
            </div>
            <div className="p-3 space-y-2">
                <p className="text-[11px] text-[#ccc] leading-relaxed">{g.criticalFindings}</p>
                {g.gaps.map((gap, i) => (
                    <div key={i} className="bg-[#0a0a0a] rounded p-2 space-y-1">
                        <div className="flex items-center gap-1.5">
                            <span className={`text-[9px] px-1 rounded font-medium ${gap.severity === 'high' ? 'bg-red-500/20 text-red-400' :
                                    gap.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                        'bg-emerald-500/20 text-emerald-400'
                                }`}>{gap.severity}</span>
                            <span className="text-[10px] text-orange-300 font-medium">{gap.dimension}</span>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <p className="text-[9px] text-[#666]">의도</p>
                                <p className="text-[10px] text-[#aaa]">{gap.intended}</p>
                            </div>
                            <div className="text-[#444] self-center">→</div>
                            <div className="flex-1">
                                <p className="text-[9px] text-[#666]">해석</p>
                                <p className="text-[10px] text-[#aaa]">{gap.decoded}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-orange-400 !border-orange-600" />
        </div>
    );
}
